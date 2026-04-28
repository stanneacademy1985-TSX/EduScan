'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../../lib/supabase'
import { fetchAdminById, getAssignedStudentIds, getStoredAdminSession, hasAssignedScope, isSuperAdmin, storeAdminSession, type AdminSessionUser } from '../../../../../lib/admin-auth'
import { 
  Calendar,
  Clock,
  Plus,
  Play,
  Pause,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertCircle,
  Settings,
  Save,
  UserCircle,
  CheckCircle,
  XCircle,
  Filter,
  X,
  Menu,
  FileText,
  MessageSquare
} from 'lucide-react'

interface AttendanceSession {
  id: string
  grade: string
  section: string
  date: string
  start_time: string
  end_time: string | null
  is_active: boolean
  teacher_id: string | null
  created_by: string | null
  created_at: string
  late_threshold: string
  absent_threshold: string
  session_description: string | null
  admin_users?: {
    id: string
    full_name: string
    email: string
  }
}

interface Section {
  grade: string
  section: string
  student_count: number
}

interface SessionStudentDetail {
  id: string
  full_name: string
  lrn: string
  status: 'present' | 'late' | 'absent'
  time_in: string | null
  notes: string | null
}

const buildGradeVariants = (grade: string): string[] => {
  const raw = (grade || '').trim()
  if (!raw) return []

  const digits = raw.replace(/[^0-9]/g, '')
  if (digits === '11' || digits === '12') {
    return Array.from(new Set([raw, digits, `Grade ${digits}`]))
  }

  return [raw]
}

export default function AttendanceSessionsPage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [filteredSessions, setFilteredSessions] = useState<AttendanceSession[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [teachers, setTeachers] = useState<AdminSessionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showConfirmationPopup, setShowConfirmationPopup] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null)
  const [sessionForDetails, setSessionForDetails] = useState<AttendanceSession | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('all')
  const [selectedSection, setSelectedSection] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [currentAdmin, setCurrentAdmin] = useState<AdminSessionUser | null>(null)
  const [sessionDetailsLoading, setSessionDetailsLoading] = useState(false)
  const [sessionDetails, setSessionDetails] = useState<{
    present: SessionStudentDetail[]
    late: SessionStudentDetail[]
    absent: SessionStudentDetail[]
  }>({
    present: [],
    late: [],
    absent: []
  })
  
  // New session form
  const [newSession, setNewSession] = useState({
    grade: '',
    section: 'SHS',
    date: new Date().toISOString().split('T')[0],
    late_threshold: '08:15',
    absent_threshold: '09:00',
    session_description: ''
  })

  // Session settings
  const [sessionSettings, setSessionSettings] = useState({
    late_threshold: '08:15',
    absent_threshold: '09:00'
  })

  const itemsPerPage = 10

  // Helper function to format time for display
  const formatTime = (time: string) => {
    try {
      if (time.length === 8 && time.includes(':')) {
        const [hours, minutes] = time.split(':')
        return new Date(`2000-01-01T${hours}:${minutes}:00`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      }
      return new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return time
    }
  }

  // Show confirmation popup
  const showConfirmation = (message: string) => {
    setConfirmationMessage(message)
    setShowConfirmationPopup(true)
    setTimeout(() => {
      setShowConfirmationPopup(false)
    }, 3000)
  }

  useEffect(() => {
    const bootstrap = async () => {
      const sessionAdmin = getStoredAdminSession()
      if (!sessionAdmin) {
        window.location.href = '/admin/login'
        return
      }

      const freshAdmin = sessionAdmin.id ? await fetchAdminById(sessionAdmin.id) : sessionAdmin
      if (!freshAdmin) {
        window.location.href = '/admin/login'
        return
      }

      if (freshAdmin.role === 'super_admin') {
        storeAdminSession(freshAdmin)
        window.location.href = '/super-admin/dashboard'
        return
      }

      setCurrentAdmin(freshAdmin)
      storeAdminSession(freshAdmin)

      await Promise.all([
        fetchSessions(freshAdmin),
        fetchSections(freshAdmin),
        fetchTeachers(freshAdmin)
      ])
    }

    bootstrap()
  }, [])

  // Initialize form with first available grade and section
  useEffect(() => {
    if (sections.length > 0 && currentAdmin && !newSession.grade) {
      const normalizedGrade = normalizeGrade(sections[0].grade)
      const firstSection = sections.find(s => normalizeGrade(s.grade) === normalizedGrade)
      
      if (firstSection) {
        setNewSession(prev => ({
          ...prev,
          grade: normalizedGrade,
          section: firstSection.section
        }))
      }
    }
  }, [sections, currentAdmin, newSession.grade])

  const fetchSessions = async (adminOverride?: AdminSessionUser | null) => {
    try {
      setLoading(true)
      const adminContext = adminOverride ?? currentAdmin ?? getStoredAdminSession()
      
      let sessionsQuery = supabase
        .from('attendance_sessions')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isSuperAdmin(adminContext) && adminContext?.id) {
        sessionsQuery = sessionsQuery.eq('teacher_id', adminContext.id)
      }

      if (hasAssignedScope(adminContext) && adminContext?.assigned_grade) {
        const normalizedAssignedGrade = normalizeGrade(adminContext.assigned_grade)
        sessionsQuery = sessionsQuery.in('grade', [adminContext.assigned_grade, normalizedAssignedGrade])

        if (adminContext.assigned_section) {
          sessionsQuery = sessionsQuery.eq('section', adminContext.assigned_section)
        }
      }

      const { data: sessionsData, error: sessionsError } = await sessionsQuery

      if (sessionsError) {
        console.error('Supabase error:', sessionsError)
        throw sessionsError
      }

      const sessionsWithTeachers = await Promise.all(
        (sessionsData || []).map(async (session) => {
          if (session.teacher_id) {
            const { data: teacherData } = await supabase
              .from('admin_users')
              .select('id, full_name, email')
              .eq('id', session.teacher_id)
              .single()
            
            return {
              ...session,
              admin_users: teacherData || null
            }
          }
          return {
            ...session,
            admin_users: null
          }
        })
      )

      setSessions(sessionsWithTeachers)
    } catch (error) {
      console.error('Error fetching sessions:', error)
      alert('Failed to load sessions. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeachers = async (adminOverride?: AdminSessionUser | null) => {
    try {
      const adminContext = adminOverride ?? currentAdmin ?? getStoredAdminSession()

      let query = supabase
        .from('admin_users')
        .select('id, full_name, email, role, assigned_grade, assigned_section, is_active')
        .order('full_name')

      if (!isSuperAdmin(adminContext) && adminContext?.id) {
        query = query.eq('id', adminContext.id)
      }

      const { data, error } = await query

      if (error) throw error
      setTeachers(data || [])
    } catch (error) {
      console.error('Error fetching teachers:', error)
    }
  }

  const fetchSections = async (adminOverride?: AdminSessionUser | null) => {
    try {
      const adminContext = adminOverride ?? currentAdmin ?? getStoredAdminSession()
      const assignedStudentIds = await getAssignedStudentIds(adminContext)

      if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        setSections([])
        return
      }

      let query = supabase
        .from('students')
        .select('grade, section')

      if (assignedStudentIds !== null) {
        query = query.in('id', assignedStudentIds)
      } else if (hasAssignedScope(adminContext) && adminContext?.assigned_grade) {
        const normalizedAssignedGrade = normalizeGrade(adminContext.assigned_grade)
        query = query.in('grade', [adminContext.assigned_grade, normalizedAssignedGrade])

        if (adminContext.assigned_section) {
          query = query.eq('section', adminContext.assigned_section)
        }
      }

      const { data: students, error } = await query

      if (error) {
        console.error('Error fetching students:', error)
        throw error
      }

      const sectionMap = new Map()
      students?.forEach(student => {
        const key = `${student.grade}-${student.section}`
        if (!sectionMap.has(key)) {
          sectionMap.set(key, {
            grade: student.grade,
            section: student.section,
            student_count: 1
          })
        } else {
          const existing = sectionMap.get(key)
          existing.student_count += 1
          sectionMap.set(key, existing)
        }
      })

      setSections(Array.from(sectionMap.values()))
    } catch (error) {
      console.error('Error fetching sections:', error)
    }
  }

  const filterSessions = () => {
    let filtered = [...sessions]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(session => 
        session.grade.toLowerCase().includes(term) ||
        session.section.toLowerCase().includes(term) ||
        `${session.grade} ${session.section}`.toLowerCase().includes(term) ||
        session.admin_users?.full_name?.toLowerCase().includes(term) ||
        session.date.includes(term) ||
        (session.session_description && session.session_description.toLowerCase().includes(term))
      )
    }

    if (selectedTeacher !== 'all') {
      filtered = filtered.filter(session => 
        session.teacher_id === selectedTeacher
      )
    }

    if (selectedSection !== 'all') {
      filtered = filtered.filter(session => normalizeGrade(session.grade) === selectedSection)
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(session => 
        selectedStatus === 'active' ? session.is_active : !session.is_active
      )
    }

    setFilteredSessions(filtered)
    setCurrentPage(1)
  }

  useEffect(() => {
    filterSessions()
  }, [searchTerm, selectedTeacher, selectedSection, selectedStatus, sessions])

  useEffect(() => {
    if (hasAssignedScope(currentAdmin)) {
      setSelectedTeacher(currentAdmin?.id || 'all')
    }
  }, [currentAdmin])

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const currentAdminData = currentAdmin?.id ? await fetchAdminById(currentAdmin.id) : currentAdmin
    if (!currentAdminData) {
      alert('Your session has expired. Please log in again.')
      window.location.href = '/admin/login'
      return
    }

    if (!currentAdminData?.id) {
      alert('You must be logged in to create a session')
      return
    }

    const scopedGrade = normalizeGrade(newSession.grade)
    const scopedSection = newSession.section || firstSectionByGrade[scopedGrade] || 'SHS'

    if (!newSession.date) {
      alert('Please select a session date')
      return
    }
    
    if (!scopedGrade) {
      alert('Please select a grade')
      return
    }
    
    try {
      const { data: existing, error: checkError } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('grade', scopedGrade)
        .eq('section', scopedSection)
        .eq('date', newSession.date)
        .eq('teacher_id', currentAdminData.id)
        .eq('is_active', true)

      if (checkError) {
        console.error('Error checking existing sessions:', checkError)
        throw checkError
      }

      if (existing && existing.length > 0) {
        alert('You already have an active session for this grade on this date')
        return
      }

      const now = new Date()
      const hours = now.getHours().toString().padStart(2, '0')
      const minutes = now.getMinutes().toString().padStart(2, '0')
      const currentTime = `${hours}:${minutes}:00`

      const lateThreshold = newSession.late_threshold.includes(':') 
        ? newSession.late_threshold + ':00' 
        : newSession.late_threshold
      const absentThreshold = newSession.absent_threshold.includes(':') 
        ? newSession.absent_threshold + ':00' 
        : newSession.absent_threshold

      const sessionData = {
        grade: scopedGrade,
        section: scopedSection,
        date: newSession.date,
        start_time: currentTime,
        teacher_id: currentAdminData.id,
        late_threshold: lateThreshold,
        absent_threshold: absentThreshold,
        session_description: newSession.session_description || null,
        is_active: true,
        created_by: currentAdminData.id,
        created_at: new Date().toISOString()
      }

      const { error: insertError } = await supabase
        .from('attendance_sessions')
        .insert([sessionData])

      if (insertError) {
        console.error('Insert error details:', insertError)
        alert(`Database error: ${insertError.message}`)
        throw insertError
      }

      setShowCreateModal(false)
      setNewSession({
        grade: '',
        section: 'SHS',
        date: new Date().toISOString().split('T')[0],
        late_threshold: '08:15',
        absent_threshold: '09:00',
        session_description: ''
      })
      
      await fetchSessions()
      
      // Show confirmation popup
      showConfirmation(`Session for Grade ${scopedGrade} - ${scopedSection} has been successfully created on ${newSession.date}!`)
      
    } catch (error: any) {
      console.error('Error creating session:', error)
      alert(`Failed to create session: ${error.message || 'Unknown error'}`)
    }
  }

  const handleUpdateSettings = async () => {
    if (!selectedSession) return

    try {
      const lateThreshold = sessionSettings.late_threshold.includes(':') 
        ? sessionSettings.late_threshold + ':00' 
        : sessionSettings.late_threshold
      const absentThreshold = sessionSettings.absent_threshold.includes(':') 
        ? sessionSettings.absent_threshold + ':00' 
        : sessionSettings.absent_threshold

      const { error } = await supabase
        .from('attendance_sessions')
        .update({
          late_threshold: lateThreshold,
          absent_threshold: absentThreshold
        })
        .eq('id', selectedSession.id)

      if (error) throw error

      setShowSettingsModal(false)
      setSelectedSession(null)
      await fetchSessions()
      showConfirmation(`Session settings for Grade ${selectedSession.grade} have been updated successfully!`)
    } catch (error) {
      console.error('Error updating session settings:', error)
      alert('Failed to update session settings')
    }
  }

  const handleEndSession = async () => {
    if (!selectedSession) return

    try {
      const now = new Date()
      const currentTime = now.toTimeString().split(' ')[0]

      await markAbsentStudents(selectedSession)

      const { error } = await supabase
        .from('attendance_sessions')
        .update({
          is_active: false,
          end_time: currentTime
        })
        .eq('id', selectedSession.id)

      if (error) throw error

      setShowEndModal(false)
      setSelectedSession(null)
      await fetchSessions()
      showConfirmation(`Session for Grade ${selectedSession.grade} has been ended successfully! Absent students have been marked.`)
    } catch (error) {
      console.error('Error ending session:', error)
      alert('Failed to end session')
    }
  }

  const markAbsentStudents = async (session: AttendanceSession) => {
    try {
      const adminContext = currentAdmin ?? getStoredAdminSession()
      const assignedStudentIds = await getAssignedStudentIds(adminContext)

      if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        return
      }

      let studentsQuery = supabase
        .from('students')
        .select('id, lrn, full_name, grade')
        .eq('grade', session.grade)
        .eq('section', session.section)

      if (assignedStudentIds !== null) {
        studentsQuery = studentsQuery.in('id', assignedStudentIds)
      }

      const { data: students, error: studentsError } = await studentsQuery

      if (studentsError) throw studentsError

      const { data: attended, error: attendedError } = await supabase
        .from('attendance')
        .select('student_id')
        .eq('session_id', session.id)

      if (attendedError) throw attendedError

      const attendedIds = new Set(attended?.map(a => a.student_id) || [])
      const absentStudents = students?.filter(s => !attendedIds.has(s.id)) || []

      if (absentStudents.length > 0) {
        const teacher = teachers.find(t => t.id === session.teacher_id)
        const teacherName = teacher?.full_name || 'Unknown'

        const absentRecords = absentStudents.map(student => ({
          student_id: student.id,
          lrn: student.lrn,
          full_name: student.full_name,
          grade: student.grade,
          date: session.date,
          time_in: session.absent_threshold,
          section: session.section,
          status: 'absent',
          session_id: session.id,
          teacher_id: session.teacher_id,
          teacher_name: teacherName
        }))

        const { error: insertError } = await supabase
          .from('attendance')
          .insert(absentRecords)

        if (insertError) {
          console.error('Error inserting absent records:', insertError)
          throw insertError
        }
      }
    } catch (error) {
      console.error('Error marking absent students:', error)
      throw error
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? Note: All attendance records will be preserved for historical reporting.')) {
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('attendance')
        .update({ session_id: null })
        .eq('session_id', sessionId)

      if (updateError) {
        console.error('Error updating attendance records:', updateError)
      }

      const { error } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) {
        if (error.code === '23503') {
          alert('Cannot delete session because it has attendance records. Please remove the foreign key constraint first.')
          return
        }
        throw error
      }

      await fetchSessions()
      showConfirmation('Session deleted successfully! Attendance records have been preserved.')
    } catch (error: any) {
      console.error('Error deleting session:', error)
      alert(`Failed to delete session: ${error.message || 'Unknown error'}`)
    }
  }

  // FIXED: This function now only shows students who have actually submitted attendance
  const handleOpenSessionDetails = async (session: AttendanceSession) => {
    setSessionForDetails(session)
    setShowSessionDetailsModal(true)
    setSessionDetailsLoading(true)
    setSessionDetails({ present: [], late: [], absent: [] })

    try {
      // Fetch attendance records with student data using a join
      const { data: attendanceRows, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          student_id,
          status,
          time_in,
          notes,
          students:student_id (
            id,
            lrn,
            full_name
          )
        `)
        .eq('session_id', session.id)

      if (attendanceError) throw attendanceError

      const present: SessionStudentDetail[] = []
      const late: SessionStudentDetail[] = []
      const absent: SessionStudentDetail[] = []

      // Process only students who have submitted attendance
      attendanceRows?.forEach((row: any) => {
        // Handle the nested students data properly
        const student = row.students
        
        if (!student) return

        const entry: SessionStudentDetail = {
          id: student.id,
          full_name: student.full_name,
          lrn: student.lrn,
          status: row.status as 'present' | 'late' | 'absent',
          time_in: row.time_in || null,
          notes: row.notes || null
        }

        if (row.status === 'present') {
          present.push(entry)
        } else if (row.status === 'late') {
          late.push(entry)
        } else if (row.status === 'absent') {
          absent.push(entry)
        }
      })

      setSessionDetails({ present, late, absent })
    } catch (error) {
      console.error('Error loading session details:', error)
      alert('Failed to load session details')
    } finally {
      setSessionDetailsLoading(false)
    }
  }

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage)
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getCurrentAdminName = () => {
    return currentAdmin?.full_name || currentAdmin?.email?.split('@')[0] || 'Admin'
  }

  const normalizeGrade = (grade: string): string => {
    const match = grade.match(/(11|12)/)
    return match ? match[1] : grade
  }

  const groupedSections = sections.reduce((acc, item) => {
    const normalizedGrade = normalizeGrade(item.grade)
    if (!acc[normalizedGrade]) {
      acc[normalizedGrade] = {
        grade: normalizedGrade,
        total: 0,
        sections: [] as Section[]
      }
    }

    acc[normalizedGrade].total += item.student_count
    acc[normalizedGrade].sections.push(item)

    return acc
  }, {} as Record<string, { grade: string; total: number; sections: Section[] }>)

  const groupedSectionList = Object.values(groupedSections)
    .filter(group => group.grade === '11' || group.grade === '12')
    .sort((a, b) => Number(a.grade) - Number(b.grade))

  const firstSectionByGrade = groupedSectionList.reduce((acc, group) => {
    const firstSection = [...group.sections].sort((a, b) => a.section.localeCompare(b.section))[0]
    acc[group.grade] = firstSection?.section || ''
    return acc
  }, {} as Record<string, string>)

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-0">
      {/* Confirmation Popup */}
      {showConfirmationPopup && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
          <div className="bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <p className="text-sm font-medium">{confirmationMessage}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 sticky top-0 bg-gray-50 z-20 py-3 sm:py-0 sm:static sm:bg-transparent">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Attendance Sessions</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Create and manage attendance sessions with custom time thresholds</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex-1 justify-center"
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filter</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-1 sm:flex-initial justify-center text-sm sm:text-base"
          >
            <Plus className="w-4 h-4" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Active Sessions Summary */}
      <div className="bg-linear-to-br from-blue-600 to-purple-600 rounded-xl p-4 sm:p-6 text-white overflow-x-auto">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold">Active Sessions</h2>
          <Calendar className="w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-[300px] sm:min-w-0">
          <div>
            <p className="text-blue-100 text-xs sm:text-sm">Total Active</p>
            <p className="text-xl sm:text-2xl font-bold">{sessions.filter(s => s.is_active).length}</p>
          </div>
          <div>
            <p className="text-blue-100 text-xs sm:text-sm">Today's Sessions</p>
            <p className="text-xl sm:text-2xl font-bold">
              {sessions.filter(s => s.date === new Date().toISOString().split('T')[0]).length}
            </p>
          </div>
          <div>
            <p className="text-blue-100 text-xs sm:text-sm">Total Grades</p>
            <p className="text-xl sm:text-2xl font-bold">{sections.length}</p>
          </div>
          <div>
            <p className="text-blue-100 text-xs sm:text-sm">Total Sessions</p>
            <p className="text-xl sm:text-2xl font-bold">{sessions.length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 transition-all duration-300 ${showFilters ? 'block' : 'hidden sm:block'}`}>
        <div className={`grid grid-cols-1 gap-3 ${isSuperAdmin(currentAdmin) ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by teacher, grade, description, or date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {isSuperAdmin(currentAdmin) && (
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="all">All Teachers</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="all">All Grades</option>
            {groupedSectionList.map(group => (
              <option key={`grade-filter-${group.grade}`} value={group.grade}>
                Grade {group.grade} ({group.total} students)
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
          </select>
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thresholds</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 sm:px-6 py-8 sm:py-12 text-center">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 sm:px-6 py-8 sm:py-12 text-center text-gray-500">
                    No attendance sessions found
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onViewDetails={() => handleOpenSessionDetails(session)}
                    onEnd={() => {
                      setSelectedSession(session)
                      setShowEndModal(true)
                    }}
                    onSettings={() => {
                      setSelectedSession(session)
                      setSessionSettings({
                        late_threshold: session.late_threshold ? session.late_threshold.slice(0, 5) : '08:15',
                        absent_threshold: session.absent_threshold ? session.absent_threshold.slice(0, 5) : '09:00'
                      })
                      setShowSettingsModal(true)
                    }}
                    onDelete={handleDeleteSession}
                    formatTime={formatTime}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Tablet View (md to lg) */}
        <div className="hidden md:block lg:hidden">
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : paginatedSessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No attendance sessions found</div>
            ) : (
              paginatedSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 space-y-3 cursor-pointer hover:bg-blue-50/40 transition-colors"
                  onClick={() => handleOpenSessionDetails(session)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-sm">{session.admin_users?.full_name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">Grade {session.grade}</span>
                      </div>
                    </div>
                    {session.is_active ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs">
                        <Play className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-600 text-xs">
                        <Pause className="w-3 h-3" />
                        Ended
                      </span>
                    )}
                  </div>
                  {session.session_description && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                      <MessageSquare className="w-3 h-3" />
                      <span className="truncate">{session.session_description}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(session.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(session.start_time)}</span>
                    </div>
                    <div className="col-span-2 text-gray-500">
                      <span className="font-medium">Thresholds:</span> Late: {formatTime(session.late_threshold)} | Absent: {formatTime(session.absent_threshold)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <AttendanceStats sessionId={session.id} />
                    <div className="flex items-center gap-2">
                      {session.is_active ? (
                        <>
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedSession(session)
                              setSessionSettings({
                                late_threshold: session.late_threshold ? session.late_threshold.slice(0, 5) : '08:15',
                                absent_threshold: session.absent_threshold ? session.absent_threshold.slice(0, 5) : '09:00'
                              })
                              setShowSettingsModal(true)
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedSession(session)
                              setShowEndModal(true)
                            }}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteSession(session.id)
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : paginatedSessions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No attendance sessions found</div>
          ) : (
            paginatedSessions.map((session) => (
              <div
                key={session.id}
                className="p-4 space-y-3 cursor-pointer hover:bg-blue-50/40 transition-colors"
                onClick={() => handleOpenSessionDetails(session)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{session.admin_users?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Grade {session.grade}</p>
                  </div>
                  {session.is_active ? (
                    <span className="flex items-center gap-1 text-green-600 text-xs bg-green-50 px-2 py-1 rounded-full">
                      <Play className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-600 text-xs bg-gray-100 px-2 py-1 rounded-full">
                      <Pause className="w-3 h-3" />
                      Ended
                    </span>
                  )}
                </div>
                {session.session_description && (
                  <div className="flex items-start gap-1 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                    <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="text-xs">{session.session_description}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(session.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(session.start_time)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <AttendanceStats sessionId={session.id} />
                  <div className="flex items-center gap-2">
                    {session.is_active ? (
                      <>
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedSession(session)
                            setSessionSettings({
                              late_threshold: session.late_threshold ? session.late_threshold.slice(0, 5) : '08:15',
                              absent_threshold: session.absent_threshold ? session.absent_threshold.slice(0, 5) : '09:00'
                            })
                            setShowSettingsModal(true)
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedSession(session)
                            setShowEndModal(true)
                          }}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDeleteSession(session.id)
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {filteredSessions.length > 0 && (
          <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2 sm:justify-between">
            <p className="text-xs sm:text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSessions.length)} of {filteredSessions.length} sessions
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg text-sm">
                {currentPage}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showSessionDetailsModal && sessionForDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-xl w-full h-full sm:h-auto sm:max-w-5xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 z-10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">Session Attendance Details</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Grade {sessionForDetails.grade} • {sessionForDetails.section} • {new Date(sessionForDetails.date).toLocaleDateString()}
                  </p>
                  {sessionForDetails.session_description && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {sessionForDetails.session_description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowSessionDetailsModal(false)
                    setSessionForDetails(null)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {sessionDetailsLoading ? (
              <div className="p-10 flex justify-center">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="border border-green-200 bg-green-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-green-700">Present</h4>
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                      {sessionDetails.present.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {sessionDetails.present.length === 0 ? (
                      <p className="text-sm text-green-700/80">No students marked present.</p>
                    ) : (
                      sessionDetails.present.map((student) => (
                        <div key={student.id} className="bg-white border border-green-100 rounded-lg p-2.5">
                          <p className="text-sm font-medium text-gray-800">{student.full_name}</p>
                          <p className="text-xs text-gray-500">LRN: {student.lrn}</p>
                          {student.time_in && <p className="text-xs text-gray-500">Time In: {formatTime(student.time_in)}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-yellow-700">Late</h4>
                    <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                      {sessionDetails.late.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {sessionDetails.late.length === 0 ? (
                      <p className="text-sm text-yellow-700/80">No students marked late.</p>
                    ) : (
                      sessionDetails.late.map((student) => (
                        <div key={student.id} className="bg-white border border-yellow-100 rounded-lg p-2.5">
                          <p className="text-sm font-medium text-gray-800">{student.full_name}</p>
                          <p className="text-xs text-gray-500">LRN: {student.lrn}</p>
                          {student.time_in && <p className="text-xs text-gray-500">Time In: {formatTime(student.time_in)}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border border-red-200 bg-red-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-red-700">Absent</h4>
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                      {sessionDetails.absent.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {sessionDetails.absent.length === 0 ? (
                      <p className="text-sm text-red-700/80">No students marked absent.</p>
                    ) : (
                      sessionDetails.absent.map((student) => (
                        <div key={student.id} className="bg-white border border-red-100 rounded-lg p-2.5">
                          <p className="text-sm font-medium text-gray-800">{student.full_name}</p>
                          <p className="text-xs text-gray-500">LRN: {student.lrn}</p>
                          {student.time_in && <p className="text-xs text-gray-500">Time In: {formatTime(student.time_in)}</p>}
                          {student.notes && <p className="text-xs text-gray-500">Note: {student.notes}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">Create New Session</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                You are creating this session as: <span className="font-semibold text-blue-600">
                  {getCurrentAdminName()}
                </span>
              </p>
            </div>
            
            <form onSubmit={handleCreateSession} className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Grade */}
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Grade <span className="text-red-500">*</span>
                </label>
                <select
                  value={newSession.grade}
                  onChange={(e) => {
                    const grade = e.target.value
                    const section = firstSectionByGrade[grade] || 'SHS'
                    setNewSession({ ...newSession, grade, section })
                  }}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                >
                  <option value="">Choose a grade</option>
                  {groupedSectionList.map(g => (
                    <option key={g.grade} value={g.grade}>Grade {g.grade}</option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Section</label>
                <select
                  value={newSession.section}
                  onChange={(e) => setNewSession({ ...newSession, section: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                >
                  <option value="">Choose a section</option>
                  {sections
                    .filter(s => normalizeGrade(s.grade) === normalizeGrade(newSession.grade || ''))
                    .sort((a,b) => a.section.localeCompare(b.section))
                    .map(s => (
                      <option key={`${s.grade}-${s.section}`} value={s.section}>{s.section} ({s.student_count})</option>
                    ))}
                </select>
              </div>
              {/* Session Description */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Session Description</label>
                <textarea
                  value={newSession.session_description}
                  onChange={(e) => setNewSession({ ...newSession, session_description: e.target.value })}
                  placeholder="e.g., First Quarter Examination, Chapter 3 Discussion, Laboratory Activity..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: Describe the purpose or content of this session</p>
              </div>

              {/* Date */}
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Session Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={newSession.date}
                  onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Immediately</label>
                <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">Session starts when created</div>
              </div>

              {/* Custom Time Thresholds */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2 text-sm">
                  <Settings className="w-4 h-4" />
                  Set Custom Time Thresholds
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Late Threshold
                    </label>
                    <input
                      type="time"
                      value={newSession.late_threshold}
                      onChange={(e) => setNewSession({ ...newSession, late_threshold: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Students scanning after this time will be LATE</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Absent Threshold
                    </label>
                    <input
                      type="time"
                      value={newSession.absent_threshold}
                      onChange={(e) => setNewSession({ ...newSession, absent_threshold: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Students not scanned by this time will be ABSENT</p>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 bg-blue-50 p-3 sm:p-4 rounded-lg">
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-xs sm:text-sm text-blue-700">
                    <p className="font-medium mb-1">Session will start immediately upon creation</p>
                    <p>You will be automatically assigned as the teacher for this session. Start time will be recorded as the current time.</p>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">Create Session</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Settings Modal */}
      {showSettingsModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Session Settings</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Grade {selectedSession.grade}
              </p>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Late Threshold
                </label>
                <input
                  type="time"
                  value={sessionSettings.late_threshold}
                  onChange={(e) => setSessionSettings({
                    ...sessionSettings,
                    late_threshold: e.target.value
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Students scanning after this time will be marked as LATE
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Absent Threshold
                </label>
                <input
                  type="time"
                  value={sessionSettings.absent_threshold}
                  onChange={(e) => setSessionSettings({
                    ...sessionSettings,
                    absent_threshold: e.target.value
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Students who haven't scanned by this time will be marked as ABSENT
                </p>
              </div>

              <div className="bg-amber-50 p-3 sm:p-4 rounded-lg">
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs sm:text-sm text-amber-700">
                    <p className="font-medium mb-1">How attendance status is determined:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Scans before {formatTime(sessionSettings.late_threshold + ':00')} → <span className="text-green-600">PRESENT</span></li>
                      <li>Scans between {formatTime(sessionSettings.late_threshold + ':00')} and {formatTime(sessionSettings.absent_threshold + ':00')} → <span className="text-yellow-600">LATE</span></li>
                      <li>No scan by {formatTime(sessionSettings.absent_threshold + ':00')} → <span className="text-red-600">ABSENT</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSettings}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Save className="w-4 h-4" />
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End Session Modal */}
      {showEndModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 sm:p-6">
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">End Session</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-5 sm:mb-6">
                Are you sure you want to end this session for Grade {selectedSession.grade}?
                <br />
                <span className="text-xs sm:text-sm text-amber-600 mt-2 block">
                  Students who haven't scanned by {formatTime(selectedSession.absent_threshold)} will be marked as ABSENT.
                </span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndModal(false)}
                  className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndSession}
                  className="flex-1 px-3 sm:px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
                >
                  End Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Attendance Stats Component (reused)
function AttendanceStats({ sessionId }: { sessionId: string }) {
  const [attendanceCount, setAttendanceCount] = useState(0)
  const [attendanceBreakdown, setAttendanceBreakdown] = useState({
    present: 0,
    late: 0,
    absent: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAttendanceStats()
  }, [sessionId])

  const fetchAttendanceStats = async () => {
    try {
      const { count, error: countError } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)

      if (countError) throw countError
      setAttendanceCount(count || 0)

      const { data, error: breakdownError } = await supabase
        .from('attendance')
        .select('status')
        .eq('session_id', sessionId)

      if (breakdownError) throw breakdownError

      const breakdown = {
        present: data?.filter(a => a.status === 'present').length || 0,
        late: data?.filter(a => a.status === 'late').length || 0,
        absent: data?.filter(a => a.status === 'absent').length || 0
      }
      setAttendanceBreakdown(breakdown)

    } catch (error) {
      console.error('Error fetching attendance stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex items-center gap-1">
        <CheckCircle className="w-3 h-3 text-green-600" />
        <span className="text-green-600">{attendanceBreakdown.present}</span>
      </span>
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3 text-yellow-600" />
        <span className="text-yellow-600">{attendanceBreakdown.late}</span>
      </span>
      <span className="flex items-center gap-1">
        <XCircle className="w-3 h-3 text-red-600" />
        <span className="text-red-600">{attendanceBreakdown.absent}</span>
      </span>
      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs ml-1">
        {attendanceCount}
      </span>
    </div>
  )
}

// Session Row Component (for desktop)
function SessionRow({ session, onViewDetails, onEnd, onSettings, onDelete, formatTime }: {
  session: AttendanceSession
  onViewDetails: () => void
  onEnd: () => void
  onSettings: () => void
  onDelete: (id: string) => void 
  formatTime: (time: string) => string
}) {
  const [attendanceCount, setAttendanceCount] = useState(0)
  const [attendanceBreakdown, setAttendanceBreakdown] = useState({
    present: 0,
    late: 0,
    absent: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAttendanceStats()
  }, [session.id])

  const fetchAttendanceStats = async () => {
    try {
      const { count, error: countError } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)

      if (countError) throw countError
      setAttendanceCount(count || 0)

      const { data, error: breakdownError } = await supabase
        .from('attendance')
        .select('status')
        .eq('session_id', session.id)

      if (breakdownError) throw breakdownError

      const breakdown = {
        present: data?.filter(a => a.status === 'present').length || 0,
        late: data?.filter(a => a.status === 'late').length || 0,
        absent: data?.filter(a => a.status === 'absent').length || 0
      }
      setAttendanceBreakdown(breakdown)

    } catch (error) {
      console.error('Error fetching attendance stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={onViewDetails}>
      <td className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="font-medium text-sm">{session.admin_users?.full_name || 'Unknown'}</span>
        </div>
      </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="font-medium text-sm">Grade {session.grade}</span>
        </div>
      </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4">
        {session.session_description ? (
          <div className="flex items-center gap-2 max-w-xs">
            <MessageSquare className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-600 truncate" title={session.session_description}>
              {session.session_description}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400 italic">No description</span>
        )}
       </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-sm">{new Date(session.date).toLocaleDateString()}</span>
        </div>
       </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-sm">
            {formatTime(session.start_time)}
            {session.end_time && ` - ${formatTime(session.end_time)}`}
          </span>
        </div>
       </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4">
        {session.is_active ? (
          <span className="flex items-center gap-1 text-green-600 text-sm">
            <Play className="w-4 h-4" />
            Active
          </span>
        ) : (
          <span className="flex items-center gap-1 text-gray-600 text-sm">
            <Pause className="w-4 h-4" />
            Ended
          </span>
        )}
       </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="text-xs text-gray-600">
          <div>Late: {session.late_threshold ? formatTime(session.late_threshold) : '08:15 AM'}</div>
          <div>Absent: {session.absent_threshold ? formatTime(session.absent_threshold) : '09:00 AM'}</div>
        </div>
       </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4">
        {loading ? (
          <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle className="w-3 h-3 text-green-600" />
              <span className="text-green-600">{attendanceBreakdown.present}</span>
              <Clock className="w-3 h-3 text-yellow-600 ml-2" />
              <span className="text-yellow-600">{attendanceBreakdown.late}</span>
              <XCircle className="w-3 h-3 text-red-600 ml-2" />
              <span className="text-red-600">{attendanceBreakdown.absent}</span>
            </div>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
              Total: {attendanceCount}
            </span>
          </div>
        )}
       </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2">
          {session.is_active ? (
            <>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onSettings()
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Session Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onEnd()
                }}
                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                title="End Session"
              >
                <Pause className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={(event) => {
                event.stopPropagation()
                onDelete(session.id)
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete Session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
       </td>
    </tr>
  )
}
