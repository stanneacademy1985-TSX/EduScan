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
  MessageSquare,
  ChevronDown,
  ChevronUp
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

// Fixed thresholds (no user configuration needed)
const DEFAULT_LATE_THRESHOLD_MINUTES = 15  // 15 minutes after start = late
const DEFAULT_ABSENT_THRESHOLD_MINUTES = 30 // 30 minutes after start = absent

export default function AttendanceSessionsPage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [filteredSessions, setFilteredSessions] = useState<AttendanceSession[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [teachers, setTeachers] = useState<AdminSessionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [sessionDetails, setSessionDetails] = useState<{
    present: SessionStudentDetail[]
    late: SessionStudentDetail[]
    absent: SessionStudentDetail[]
  }>({
    present: [],
    late: [],
    absent: []
  })
  
  // New session form - simplified
  const [newSession, setNewSession] = useState({
    grade: '',
    section: 'SHS',
    date: new Date().toISOString().split('T')[0],
    session_description: ''
  })

  const itemsPerPage = 10

  // Helper function to format time for display
  const formatTime = (time: string) => {
    try {
      if (time && time.length >= 5) {
        const [hours, minutes] = time.split(':')
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${minutes} ${ampm}`
      }
      return time
    } catch {
      return time
    }
  }

  // Calculate thresholds based on session start time
  const calculateLateThreshold = (startTime: string): string => {
    if (!startTime) return '08:15:00'
    const [hours, minutes] = startTime.split(':')
    let totalMinutes = parseInt(hours) * 60 + parseInt(minutes) + DEFAULT_LATE_THRESHOLD_MINUTES
    const newHours = Math.floor(totalMinutes / 60)
    const newMinutes = totalMinutes % 60
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:00`
  }

  const calculateAbsentThreshold = (startTime: string): string => {
    if (!startTime) return '08:30:00'
    const [hours, minutes] = startTime.split(':')
    let totalMinutes = parseInt(hours) * 60 + parseInt(minutes) + DEFAULT_ABSENT_THRESHOLD_MINUTES
    const newHours = Math.floor(totalMinutes / 60)
    const newMinutes = totalMinutes % 60
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:00`
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
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })

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

  const toggleRowExpand = (sessionId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedRows(newExpanded)
  }

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
    const scopedSection = newSession.section || 'SHS'

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

      // Auto-calculate thresholds based on start time
      const lateThreshold = calculateLateThreshold(currentTime)
      const absentThreshold = calculateAbsentThreshold(currentTime)

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
        session_description: ''
      })
      
      await fetchSessions()
      
      showConfirmation(`Session for Grade ${scopedGrade} - ${scopedSection} has been successfully created on ${newSession.date}!`)
      
    } catch (error: any) {
      console.error('Error creating session:', error)
      alert(`Failed to create session: ${error.message || 'Unknown error'}`)
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

  const handleOpenSessionDetails = async (session: AttendanceSession) => {
    setSessionForDetails(session)
    setShowSessionDetailsModal(true)
    setSessionDetailsLoading(true)
    setSessionDetails({ present: [], late: [], absent: [] })

    try {
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

      attendanceRows?.forEach((row: any) => {
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

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-0">
      {/* Confirmation Popup */}
      {showConfirmationPopup && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
          <div className="bg-green-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <p className="text-sm font-medium">{confirmationMessage}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Attendance Sessions</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Create and manage attendance sessions</p>
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
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg flex-1 sm:flex-initial justify-center text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Active Sessions Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Overview</h2>
          <Calendar className="w-5 h-5 opacity-80" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-blue-100 text-xs">Active Sessions</p>
            <p className="text-2xl font-bold">{sessions.filter(s => s.is_active).length}</p>
          </div>
          <div>
            <p className="text-blue-100 text-xs">Today's Sessions</p>
            <p className="text-2xl font-bold">
              {sessions.filter(s => s.date === new Date().toISOString().split('T')[0]).length}
            </p>
          </div>
          <div>
            <p className="text-blue-100 text-xs">Total Classes</p>
            <p className="text-2xl font-bold">{sections.length}</p>
          </div>
          <div>
            <p className="text-blue-100 text-xs">Total Sessions</p>
            <p className="text-2xl font-bold">{sessions.length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-all duration-300 ${showFilters ? 'block' : 'hidden sm:block'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search sessions..."
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

      {/* Sessions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Teacher</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Class</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Thresholds</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Attendance</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    No attendance sessions found
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isExpanded={expandedRows.has(session.id)}
                    onToggleExpand={() => toggleRowExpand(session.id)}
                    onViewDetails={() => handleOpenSessionDetails(session)}
                    onEnd={() => {
                      setSelectedSession(session)
                      setShowEndModal(true)
                    }}
                    onDelete={handleDeleteSession}
                    formatTime={formatTime}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredSessions.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSessions.length)} of {filteredSessions.length} sessions
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session Details Modal */}
      {showSessionDetailsModal && sessionForDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-5 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Session Attendance Details</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Grade {sessionForDetails.grade} • {sessionForDetails.section} • {new Date(sessionForDetails.date).toLocaleDateString()}
                  </p>
                  {sessionForDetails.session_description && (
                    <p className="text-xs text-gray-500 mt-1">{sessionForDetails.session_description}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowSessionDetailsModal(false)
                    setSessionForDetails(null)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {sessionDetailsLoading ? (
              <div className="p-12 flex justify-center">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Present */}
                <div className="border border-green-200 bg-green-50 rounded-xl overflow-hidden">
                  <div className="bg-green-100 px-4 py-3 border-b border-green-200">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-green-800">Present</h4>
                      <span className="px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-bold">
                        {sessionDetails.present.length}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-green-100">
                    {sessionDetails.present.length === 0 ? (
                      <div className="p-4 text-center text-green-600 text-sm">No students marked present</div>
                    ) : (
                      sessionDetails.present.map((student) => (
                        <div key={student.id} className="p-3 hover:bg-green-100/50 transition-colors">
                          <p className="font-medium text-gray-800 text-sm">{student.full_name}</p>
                          <p className="text-xs text-gray-500">LRN: {student.lrn}</p>
                          {student.time_in && <p className="text-xs text-green-600 mt-1">⏰ {formatTime(student.time_in)}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Late */}
                <div className="border border-yellow-200 bg-yellow-50 rounded-xl overflow-hidden">
                  <div className="bg-yellow-100 px-4 py-3 border-b border-yellow-200">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-yellow-800">Late</h4>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-800 text-xs font-bold">
                        {sessionDetails.late.length}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-yellow-100">
                    {sessionDetails.late.length === 0 ? (
                      <div className="p-4 text-center text-yellow-600 text-sm">No students marked late</div>
                    ) : (
                      sessionDetails.late.map((student) => (
                        <div key={student.id} className="p-3 hover:bg-yellow-100/50 transition-colors">
                          <p className="font-medium text-gray-800 text-sm">{student.full_name}</p>
                          <p className="text-xs text-gray-500">LRN: {student.lrn}</p>
                          {student.time_in && <p className="text-xs text-yellow-600 mt-1">⏰ {formatTime(student.time_in)}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Absent */}
                <div className="border border-red-200 bg-red-50 rounded-xl overflow-hidden">
                  <div className="bg-red-100 px-4 py-3 border-b border-red-200">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-red-800">Absent</h4>
                      <span className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-xs font-bold">
                        {sessionDetails.absent.length}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-red-100">
                    {sessionDetails.absent.length === 0 ? (
                      <div className="p-4 text-center text-red-600 text-sm">No students marked absent</div>
                    ) : (
                      sessionDetails.absent.map((student) => (
                        <div key={student.id} className="p-3 hover:bg-red-100/50 transition-colors">
                          <p className="font-medium text-gray-800 text-sm">{student.full_name}</p>
                          <p className="text-xs text-gray-500">LRN: {student.lrn}</p>
                          {student.notes && <p className="text-xs text-red-600 mt-1">📝 {student.notes}</p>}
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

      {/* Create Session Modal - Simplified */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
            <div className="p-5 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Create New Session</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Creating as: <span className="font-semibold text-blue-600">{getCurrentAdminName()}</span>
              </p>
            </div>
            
            <form onSubmit={handleCreateSession} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Grade <span className="text-red-500">*</span>
                </label>
                <select
                  value={newSession.grade}
                  onChange={(e) => {
                    const grade = e.target.value
                    setNewSession({ ...newSession, grade })
                  }}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Choose a grade</option>
                  {groupedSectionList.map(g => (
                    <option key={g.grade} value={g.grade}>Grade {g.grade}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newSession.date}
                  onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Session Description (Optional)</label>
                <textarea
                  value={newSession.session_description}
                  onChange={(e) => setNewSession({ ...newSession, session_description: e.target.value })}
                  placeholder="e.g., First Quarter Examination, Chapter 3 Discussion..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Automatic Thresholds</p>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>Session starts immediately when created</li>
                      <li>{DEFAULT_LATE_THRESHOLD_MINUTES} minutes after start = LATE</li>
                      <li>{DEFAULT_ABSENT_THRESHOLD_MINUTES} minutes after start = ABSENT</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">Create Session</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Session Modal */}
      {showEndModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Pause className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">End Session</h3>
              <p className="text-gray-600 mb-4">
                End session for Grade {selectedSession.grade}?
              </p>
              <div className="bg-amber-50 p-3 rounded-lg mb-6">
                <p className="text-sm text-amber-700">
                  Students who haven't scanned by {formatTime(selectedSession.absent_threshold)} will be marked as ABSENT.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndSession}
                  className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
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

// Session Row Component
function SessionRow({ session, isExpanded, onToggleExpand, onViewDetails, onEnd, onDelete, formatTime }: {
  session: AttendanceSession
  isExpanded: boolean
  onToggleExpand: () => void
  onViewDetails: () => void
  onEnd: () => void
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

  // Calculate thresholds display
  const lateThresholdTime = session.late_threshold ? formatTime(session.late_threshold) : 'N/A'
  const absentThresholdTime = session.absent_threshold ? formatTime(session.absent_threshold) : 'N/A'

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
        </td>
        <td className="px-4 py-3" onClick={onViewDetails}>
          <div className="flex items-center gap-2 cursor-pointer">
            <UserCircle className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="font-medium text-sm">{session.admin_users?.full_name?.split(' ')[0] || 'Unknown'}</span>
          </div>
        </td>
        <td className="px-4 py-3" onClick={onViewDetails}>
          <div className="flex items-center gap-2 cursor-pointer">
            <Users className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="font-medium text-sm">G{session.grade}</span>
          </div>
        </td>
        <td className="px-4 py-3" onClick={onViewDetails}>
          {session.session_description ? (
            <div className="flex items-center gap-2 max-w-xs cursor-pointer">
              <MessageSquare className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-600 truncate" title={session.session_description}>
                {session.session_description.length > 40 ? session.session_description.substring(0, 40) + '...' : session.session_description}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-400 italic cursor-pointer" onClick={onViewDetails}>—</span>
          )}
        </td>
        <td className="px-4 py-3" onClick={onViewDetails}>
          <div className="flex items-center gap-2 cursor-pointer">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm">{new Date(session.date).toLocaleDateString()}</span>
          </div>
        </td>
        <td className="px-4 py-3" onClick={onViewDetails}>
          <div className="flex items-center gap-2 cursor-pointer">
            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm">{formatTime(session.start_time)}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          {session.is_active ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
              Ended
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="text-xs text-gray-500 space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="w-12">Late:</span>
              <span className="font-mono text-gray-700">{lateThresholdTime}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-12">Absent:</span>
              <span className="font-mono text-gray-700">{absentThresholdTime}</span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3" onClick={onViewDetails}>
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
          ) : (
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-medium text-green-600">{attendanceBreakdown.present}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium text-amber-600">{attendanceBreakdown.late}</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-red-600" />
                <span className="text-xs font-medium text-red-600">{attendanceBreakdown.absent}</span>
              </div>
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                {attendanceCount}
              </span>
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {session.is_active ? (
              <button
                onClick={(e) => { e.stopPropagation(); onEnd() }}
                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                title="End Session"
              >
                <Pause className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(session.id) }}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Session"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={10} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <h4 className="font-medium text-sm text-gray-700 mb-2">Session Info</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Teacher:</span> {session.admin_users?.full_name || 'Unknown'}</p>
                  <p><span className="text-gray-500">Grade:</span> {session.grade}</p>
                  <p><span className="text-gray-500">Section:</span> {session.section}</p>
                  <p><span className="text-gray-500">Started:</span> {formatTime(session.start_time)}</p>
                  {session.end_time && <p><span className="text-gray-500">Ended:</span> {formatTime(session.end_time)}</p>}
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <h4 className="font-medium text-sm text-gray-700 mb-2">Thresholds</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Late after:</span> {lateThresholdTime}</p>
                  <p><span className="text-gray-500">Absent after:</span> {absentThresholdTime}</p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <h4 className="font-medium text-sm text-gray-700 mb-2">Description</h4>
                <p className="text-sm text-gray-600">{session.session_description || 'No description provided'}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// Attendance Stats Component
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
