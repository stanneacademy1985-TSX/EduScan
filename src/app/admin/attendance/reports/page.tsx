'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../../lib/supabase'
import { fetchAdminById, getAssignedStudentIds, getStoredAdminSession, hasAssignedScope, isSuperAdmin, storeAdminSession, type AdminSessionUser } from '../../../../../lib/admin-auth'
import { 
  FileText,
  Download,
  Filter,
  Calendar,
  Users,
  BarChart3,
  PieChart,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  Trash2,
  AlertTriangle,
  UserCircle,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RefreshCw,
  DownloadCloud,
  FileSpreadsheet,
  Printer,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Table,
  Sparkles,
  Shield,
  Activity
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'

interface AttendanceRecord {
  id: string
  student_id: string
  date: string
  time_in: string
  section: string
  status: string
  teacher_id: string
  teacher_name: string
  session_id: string
  students: {
    lrn: string
    first_name: string
    last_name: string
    middle_name?: string
    full_name: string
    sex?: string | null
    grade: string
    section: string
    profile_photo_base64: string | null
  }
}

interface Student {
  id: string
  lrn: string
  first_name: string
  last_name: string
  middle_name?: string
  full_name: string
  sex?: string | null
  grade: string
  section: string
  profile_photo_base64: string | null
}

interface Teacher {
  id: string
  full_name: string
  email: string
}

interface StudentSummary {
  student_id: string
  student_name: string
  lrn: string
  sex?: string | null
  grade: string
  section: string
  total_sessions: number
  present: number
  late: number
  absent: number
  attendance_rate: number
  profile_photo_base64: string | null
}

interface TeacherWithStudents {
  teacher_id: string
  teacher_name: string
  total_sessions: number
  total_students: number
  students: StudentSummary[]
  present_count: number
  late_count: number
  absent_count: number
  attendance_rate: number
}

interface ReportSummary {
  totalStudents: number
  totalAttendance: number
  averageAttendance: number
  mostActiveGrade: string
  topPerformer: string
  dateRange: string
  totalTeachers: number
  presentCount: number
  lateCount: number
  absentCount: number
}

// Helper function to format name as "Last, First M."
const formatStudentName = (firstName?: string, lastName?: string, middleName?: string): string => {
  const last = lastName || ''
  const first = firstName || ''
  const middleInitial = middleName && middleName.trim() ? middleName.charAt(0).toUpperCase() + '.' : ''
  
  if (!last && !first) return 'Unknown'
  
  if (middleInitial) {
    return `${last}, ${first} ${middleInitial}`.trim()
  }
  return `${last}, ${first}`.trim()
}

// Helper function to format learner name for SF2 (uppercase with proper order)
const formatLearnerNameForSF2 = (firstName?: string, lastName?: string, middleName?: string): string => {
  const last = (lastName || '').toUpperCase()
  const first = (firstName || '').toUpperCase()
  const middleInitial = middleName && middleName.trim() ? middleName.charAt(0).toUpperCase() + '.' : ''
  
  if (!last && !first) return 'UNKNOWN'
  
  if (middleInitial) {
    return `${last}, ${first} ${middleInitial}`
  }
  return `${last}, ${first}`.trim()
}

export default function AttendanceReportsPage() {
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherSummaries, setTeacherSummaries] = useState<TeacherWithStudents[]>([])
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [clearOption, setClearOption] = useState<'all' | 'filtered' | 'date' | 'teacher'>('all')
  const [clearDate, setClearDate] = useState(new Date().toISOString().split('T')[0])
  const [clearTeacher, setClearTeacher] = useState('')

  const [aiAnalyticsLoading, setAiAnalyticsLoading] = useState(false)
  const [aiBuddyPunching, setAiBuddyPunching] = useState<Array<{date:string,section:string,a:string,b:string,deltaSeconds:number,risk:string}>>([])
  const [aiTruancy, setAiTruancy] = useState<Array<{student_id:string,student_name:string,absent:number,late:number,total:number,riskScore:number,atRisk:boolean,externalFactors?:string[]}>>([])
  const [aiPeak30, setAiPeak30] = useState<Array<{bucket:string,count:number,weather?:string,holiday?:boolean}>>([])
  const [aiAdvancedAnomalies, setAiAdvancedAnomalies] = useState<Array<{type:string,student_id:string,student_name:string,description:string,severity:string,dates?:string[],count?:number}>>([])
  const [aiExternalFactors, setAiExternalFactors] = useState<Array<{date:string,weather?:any,holiday?:any}>>([])
  const [activeAiModal, setActiveAiModal] = useState<'buddy' | 'truancy' | 'peak' | 'anomalies' | 'external' | null>(null)
  const [summary, setSummary] = useState<ReportSummary>({
    totalStudents: 0,
    totalAttendance: 0,
    averageAttendance: 0,
    mostActiveGrade: '',
    topPerformer: '',
    dateRange: '',
    totalTeachers: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0
  })

  // Filters
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [selectedTeacher, setSelectedTeacher] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'teacher' | 'chart'>('teacher')
  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie' | 'area'>('line')
  const [chartSize, setChartSize] = useState<'normal' | 'large'>('normal')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  // Chart colors
  const COLORS = {
    present: '#10b981',
    late: '#f59e0b',
    absent: '#ef4444',
    primary: ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316']
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
        window.location.href = '/super-admin/reports'
        return
      }

      setAdmin(freshAdmin)
      storeAdminSession(freshAdmin)
      await fetchData(freshAdmin)
    }

    bootstrap()
  }, [])

  useEffect(() => {
    filterData()
  }, [attendanceData, selectedGrade, selectedTeacher, selectedStatus, searchTerm, dateRange])

  useEffect(() => {
    if (!aiAnalyticsLoading) {
      fetchAiAnalytics()
    }
  }, [filteredData, dateRange, selectedGrade])

  const fetchData = async (adminOverride?: AdminSessionUser | null) => {
    try {
      setLoading(true)
      const adminContext = adminOverride ?? admin ?? getStoredAdminSession()
      const restrictToAssignment = hasAssignedScope(adminContext)
      const assignedStudentIds = await getAssignedStudentIds(adminContext)

      if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        setStudents([])
        setTeachers([])
        setAttendanceData([])
        setFilteredData([])
        setTeacherSummaries([])
        setSummary({
          totalStudents: 0,
          totalAttendance: 0,
          averageAttendance: 0,
          mostActiveGrade: '',
          topPerformer: '',
          dateRange: `${dateRange.start} to ${dateRange.end}`,
          totalTeachers: 0,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0
        })
        return
      }

      let studentsQuery = supabase
        .from('students')
        .select('id, lrn, first_name, last_name, middle_name, full_name, sex, grade, section, profile_photo_base64')
        .in('grade', ['11', '12'])
        .order('last_name')

      if (assignedStudentIds !== null) {
        studentsQuery = studentsQuery.in('id', assignedStudentIds)
      } else if (restrictToAssignment) {
        studentsQuery = studentsQuery
          .eq('grade', adminContext!.assigned_grade!)
      }

      const { data: studentsData, error: studentsError } = await studentsQuery
      if (studentsError) throw studentsError
      
      const formattedStudents = (studentsData || []).map(student => ({
        ...student,
        full_name: formatStudentName(student.first_name, student.last_name, student.middle_name)
      }))
      setStudents(formattedStudents)

      let teachersQuery = supabase
        .from('admin_users')
        .select('id, full_name, email')
        .order('full_name')

      if (!isSuperAdmin(adminContext) && adminContext?.id) {
        teachersQuery = teachersQuery.eq('id', adminContext.id)
      }

      const { data: teachersData, error: teachersError } = await teachersQuery
      if (teachersError) throw teachersError
      setTeachers(teachersData || [])

      let attendanceQuery = supabase
        .from('attendance')
        .select(`
          *,
          students (
            lrn,
            first_name,
            last_name,
            middle_name,
            full_name,
            sex,
            grade,
            section,
            profile_photo_base64
          )
        `)
        .order('date', { ascending: false })

      if (!isSuperAdmin(adminContext) && adminContext?.id) {
        attendanceQuery = attendanceQuery.eq('teacher_id', adminContext.id)
      }

      if (assignedStudentIds !== null) {
        attendanceQuery = attendanceQuery.in('student_id', assignedStudentIds)
      }

      if (restrictToAssignment) {
        attendanceQuery = attendanceQuery.eq('grade', adminContext!.assigned_grade!)
      }

      const { data: attendance, error: attendanceError } = await attendanceQuery
      if (attendanceError) throw attendanceError
      
      const attendanceWithTeacherNames = attendance?.map(record => {
        if (!record.teacher_name || record.teacher_name === 'Unknown' || record.teacher_name === 'Unknown Teacher') {
          const teacher = teachersData?.find(t => t.id === record.teacher_id)
          if (teacher) {
            return { ...record, teacher_name: teacher.full_name }
          }
        }
        return record
      })

      const gradeRestrictedAttendance = (attendanceWithTeacherNames || []).filter(
        (record) => record.students?.grade === '11' || record.students?.grade === '12'
      )
      
      const formattedAttendance = gradeRestrictedAttendance.map(record => ({
        ...record,
        students: record.students ? {
          ...record.students,
          full_name: formatStudentName(record.students.first_name, record.students.last_name, record.students.middle_name)
        } : null
      }))
      
      setAttendanceData(formattedAttendance)

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterData = () => {
    let filtered = [...attendanceData]

    filtered = filtered.filter(record => 
      record.date >= dateRange.start && record.date <= dateRange.end
    )

    if (selectedGrade !== 'all') {
      filtered = filtered.filter(record => 
        record.students?.grade === selectedGrade
      )
    }

    if (selectedTeacher !== 'all') {
      filtered = filtered.filter(record => 
        record.teacher_id === selectedTeacher
      )
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(record => 
        record.status === selectedStatus
      )
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(record => 
        record.students?.full_name?.toLowerCase().includes(term) ||
        record.students?.lrn?.includes(term) ||
        record.teacher_name?.toLowerCase().includes(term)
      )
    }

    setFilteredData(filtered)
    calculateSummary(filtered)
    calculateTeacherSummaries(filtered)
    setCurrentPage(1)
  }

  const calculateSummary = (data: AttendanceRecord[]) => {
    const uniqueStudents = new Set(data.map(r => r.student_id))
    const uniqueTeachers = new Set(data.map(r => r.teacher_id).filter(id => id))
    const totalStudents = uniqueStudents.size
    const totalAttendance = data.length
    
    const presentCount = data.filter(r => r.status === 'present').length
    const lateCount = data.filter(r => r.status === 'late').length
    const absentCount = data.filter(r => r.status === 'absent').length

    const averageAttendance = totalStudents > 0 
      ? Math.round((totalAttendance / totalStudents) * 10) / 10
      : 0

    const gradeCounts: { [key: string]: number } = {}
    data.forEach(record => {
      const grade = record.students?.grade || 'N/A'
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1
    })
    
    const mostActiveGrade = Object.entries(gradeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

    const studentCounts: { [key: string]: { name: string, count: number } } = {}
    data.forEach(record => {
      if (!studentCounts[record.student_id]) {
        studentCounts[record.student_id] = {
          name: record.students?.full_name || 'Unknown',
          count: 0
        }
      }
      studentCounts[record.student_id].count++
    })
    
    const topPerformer = Object.values(studentCounts)
      .sort((a, b) => b.count - a.count)[0]?.name || 'N/A'

    setSummary({
      totalStudents,
      totalAttendance,
      averageAttendance,
      mostActiveGrade,
      topPerformer,
      dateRange: `${dateRange.start} to ${dateRange.end}`,
      totalTeachers: uniqueTeachers.size,
      presentCount,
      lateCount,
      absentCount
    })
  }

  const calculateTeacherSummaries = (data: AttendanceRecord[]) => {
    const teacherMap = new Map<string, Map<string, StudentSummary>>()

    data.forEach(record => {
      if (!record.teacher_id || !record.students) return

      if (!teacherMap.has(record.teacher_id)) {
        teacherMap.set(record.teacher_id, new Map())
      }

      const studentMap = teacherMap.get(record.teacher_id)!
      const studentId = record.student_id

      if (!studentMap.has(studentId)) {
        const normalizedSection = record.students.section ||
          (record.students.grade === '11' ? 'SPC' : record.students.grade === '12' ? 'SPP' : record.section)

        studentMap.set(studentId, {
          student_id: studentId,
          student_name: formatStudentName(record.students.first_name, record.students.last_name, record.students.middle_name),
          lrn: record.students.lrn,
          grade: record.students.grade,
          section: normalizedSection,
          total_sessions: 0,
          present: 0,
          late: 0,
          absent: 0,
          attendance_rate: 0,
          profile_photo_base64: record.students.profile_photo_base64
        })
      }

      const studentSummary = studentMap.get(studentId)!
      studentSummary.total_sessions++
      
      if (record.status === 'present') studentSummary.present++
      else if (record.status === 'late') studentSummary.late++
      else if (record.status === 'absent') studentSummary.absent++
    })

    const summaries: TeacherWithStudents[] = []

    teacherMap.forEach((studentMap, teacherId) => {
      const students = Array.from(studentMap.values())
      let totalPresent = 0
      let totalLate = 0
      let totalAbsent = 0
      let totalSessions = 0

      students.forEach(student => {
        student.attendance_rate = Math.round((student.present / student.total_sessions) * 100)
        totalPresent += student.present
        totalLate += student.late
        totalAbsent += student.absent
        totalSessions += student.total_sessions
      })

      students.sort((a, b) => a.student_name.localeCompare(b.student_name))

      const teacher = teachers.find(t => t.id === teacherId)
      const totalMarks = totalPresent + totalLate + totalAbsent

      summaries.push({
        teacher_id: teacherId,
        teacher_name: teacher?.full_name || 'Unknown',
        total_sessions: totalSessions,
        total_students: students.length,
        students: students,
        present_count: totalPresent,
        late_count: totalLate,
        absent_count: totalAbsent,
        attendance_rate: totalMarks > 0 ? Math.round((totalPresent / totalMarks) * 100) : 0
      })
    })

    summaries.sort((a, b) => a.teacher_name.localeCompare(b.teacher_name))
    setTeacherSummaries(summaries)
  }

  const fetchAiAnalytics = async () => {
    if (!dateRange.start || !dateRange.end) return

    setAiAnalyticsLoading(true)
    try {
      const response = await fetch('/api/ai-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateRange.start,
          endDate: dateRange.end,
          grade: selectedGrade !== 'all' ? selectedGrade : undefined
        })
      })

      const raw = await response.text()
      let payload: any = {}

      if (raw) {
        try {
          payload = JSON.parse(raw)
        } catch {
          payload = { message: raw }
        }
      }

      if (!response.ok) {
        console.error('AI analytics fetch failed', payload)
        return
      }

      setAiBuddyPunching(payload.buddyPunching || [])
      setAiTruancy(payload.truancy || [])
      setAiPeak30(payload.peak30 || [])
      setAiAdvancedAnomalies(payload.advancedAnomalies || payload.advancedlnomalies || [])
      setAiExternalFactors(payload.externalFactors || [])
    } catch (error) {
      console.error('AI analytics error', error)
    } finally {
      setAiAnalyticsLoading(false)
    }
  }

  const toggleTeacher = (teacherId: string) => {
    const newExpanded = new Set(expandedTeachers)
    if (newExpanded.has(teacherId)) {
      newExpanded.delete(teacherId)
    } else {
      newExpanded.add(teacherId)
    }
    setExpandedTeachers(newExpanded)
  }

  const getChartData = () => {
    switch (chartType) {
      case 'line':
      case 'area':
        const dailyData: { [key: string]: { date: string, present: number, late: number, absent: number } } = {}
        filteredData.forEach(record => {
          if (!dailyData[record.date]) {
            dailyData[record.date] = { date: record.date, present: 0, late: 0, absent: 0 }
          }
          if (record.status === 'present') dailyData[record.date].present++
          else if (record.status === 'late') dailyData[record.date].late++
          else if (record.status === 'absent') dailyData[record.date].absent++
        })
        return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date))

      case 'bar':
        return teacherSummaries.map(t => ({
          name: t.teacher_name.split(' ')[0],
          sessions: t.total_sessions,
          present: t.present_count,
          late: t.late_count,
          absent: t.absent_count,
          rate: t.attendance_rate
        }))

      case 'pie':
        return [
          { name: 'Present', value: summary.presentCount, color: COLORS.present },
          { name: 'Late', value: summary.lateCount, color: COLORS.late },
          { name: 'Absent', value: summary.absentCount, color: COLORS.absent }
        ].filter(item => item.value > 0)

      default:
        return []
    }
  }

  const handleExportPDF = async () => {
    try {
      setExporting(true)
      const jspdfModule = await import('jspdf')
      const { jsPDF } = jspdfModule as any
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = (autoTableModule && (autoTableModule as any).default) || autoTableModule

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' })
      const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME || 'Saint Anne Academy'
      const schoolYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
      const reportMonthLabel = `${dateRange.start} to ${dateRange.end}`
      
      const pageWidth = doc.internal.pageSize.getWidth()
      const marginX = 10
      
      // Header with proper spacing
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('School Form 2 (SF2) Daily Attendance Report of Learners', pageWidth / 2, 15, { align: 'center' })
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Official SF2-style attendance layout generated from the selected filters', pageWidth / 2, 20, { align: 'center' })
      
      // School info boxes with proper spacing
      const boxStartY = 28
      const boxHeight = 10
      const halfWidth = (pageWidth - (marginX * 2)) / 2
      
      // Row 1
      doc.rect(marginX, boxStartY, halfWidth, boxHeight)
      doc.rect(marginX + halfWidth, boxStartY, halfWidth, boxHeight)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('School Name', marginX + 3, boxStartY + 5)
      doc.text('School Year', marginX + halfWidth + 3, boxStartY + 5)
      doc.setFont('helvetica', 'normal')
      doc.text(schoolName, marginX + 30, boxStartY + 5)
      doc.text(schoolYear, marginX + halfWidth + 30, boxStartY + 5)
      
      // Row 2
      doc.rect(marginX, boxStartY + boxHeight, halfWidth, boxHeight)
      doc.rect(marginX + halfWidth, boxStartY + boxHeight, halfWidth, boxHeight)
      doc.setFont('helvetica', 'bold')
      doc.text('Grade Level', marginX + 3, boxStartY + boxHeight + 5)
      doc.text('Section', marginX + halfWidth + 3, boxStartY + boxHeight + 5)
      doc.setFont('helvetica', 'normal')
      doc.text(`Grade ${selectedGrade !== 'all' ? selectedGrade : 'All'}`, marginX + 25, boxStartY + boxHeight + 5)
      doc.text('SHS', marginX + halfWidth + 20, boxStartY + boxHeight + 5)
      
      // Row 3
      doc.rect(marginX, boxStartY + (boxHeight * 2), halfWidth, boxHeight)
      doc.rect(marginX + halfWidth, boxStartY + (boxHeight * 2), halfWidth, boxHeight)
      doc.setFont('helvetica', 'bold')
      doc.text('Report Month', marginX + 3, boxStartY + (boxHeight * 2) + 5)
      doc.text('Class Adviser', marginX + halfWidth + 3, boxStartY + (boxHeight * 2) + 5)
      doc.setFont('helvetica', 'normal')
      doc.text(reportMonthLabel, marginX + 25, boxStartY + (boxHeight * 2) + 5)
      doc.text('________________________', marginX + halfWidth + 28, boxStartY + (boxHeight * 2) + 5)

      // Table for student data
      const tableData = filteredData.map(record => [
        record.students?.lrn || 'N/A',
        formatLearnerNameForSF2(record.students?.first_name, record.students?.last_name, record.students?.middle_name),
        record.date,
        record.time_in,
        record.status.toUpperCase(),
        record.teacher_name || 'N/A'
      ])

      autoTable(doc, {
        startY: boxStartY + (boxHeight * 3) + 10,
        head: [['LRN', "Learner's Name", 'Date', 'Time In', 'Status', 'Teacher']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 50 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { cellWidth: 20 },
          5: { cellWidth: 40 }
        }
      })

      doc.save(`attendance_report_${dateRange.start}_to_${dateRange.end}.pdf`)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      const excelModule = await import('exceljs')
      const ExcelJS = (excelModule && (excelModule as any).default) || excelModule

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'EduScan'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('Attendance Report')
      
      worksheet.columns = [
        { header: 'LRN', key: 'lrn', width: 18 },
        { header: "Learner's Name", key: 'name', width: 35 },
        { header: 'Grade', key: 'grade', width: 10 },
        { header: 'Section', key: 'section', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Time In', key: 'time', width: 12 },
        { header: 'Teacher', key: 'teacher', width: 25 }
      ]

      filteredData.forEach(record => {
        worksheet.addRow({
          lrn: record.students?.lrn || 'N/A',
          name: formatStudentName(record.students?.first_name, record.students?.last_name, record.students?.middle_name),
          grade: record.students?.grade || 'N/A',
          section: record.students?.section || 'N/A',
          status: record.status.toUpperCase(),
          date: record.date,
          time: record.time_in,
          teacher: record.teacher_name || 'N/A'
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `attendance_report_${dateRange.start}_to_${dateRange.end}.xlsx`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Error exporting Excel:', error)
    } finally {
      setExporting(false)
    }
  }

  const handleClearAttendance = async () => {
    try {
      setClearing(true)
      let query = supabase.from('attendance').delete()

      switch (clearOption) {
        case 'filtered':
          if (selectedGrade !== 'all') {
            const { data: gradeStudents } = await supabase
              .from('students')
              .select('id')
              .eq('grade', selectedGrade)
            const studentIds = gradeStudents?.map(s => s.id) || []
            if (studentIds.length > 0) {
              query = query.in('student_id', studentIds)
            }
          }
          if (selectedTeacher !== 'all') {
            query = query.eq('teacher_id', selectedTeacher)
          }
          if (selectedStatus !== 'all') {
            query = query.eq('status', selectedStatus)
          }
          query = query.gte('date', dateRange.start).lte('date', dateRange.end)
          break
        case 'date':
          query = query.eq('date', clearDate)
          break
        case 'teacher':
          if (clearTeacher) {
            query = query.eq('teacher_id', clearTeacher)
          }
          break
        case 'all':
          query = query.gte('date', '2000-01-01')
          break
      }

      const { error } = await query
      if (error) throw error

      await fetchData()
      setShowClearModal(false)
      alert('Attendance records cleared successfully!')
    } catch (error) {
      console.error('Error clearing attendance:', error)
      alert('Failed to clear attendance records')
    } finally {
      setClearing(false)
    }
  }

  const getUniqueGrades = () => ['all', '11', '12']

  const totalPages = Math.ceil(teacherSummaries.length / itemsPerPage)
  const paginatedTeachers = teacherSummaries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const formatNumber = (num: number) => new Intl.NumberFormat().format(num)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading attendance data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Attendance Reports</h1>
                <p className="text-sm text-gray-500">AI-powered insights • Real-time analytics • Export ready</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl hover:shadow-md">
                {showFilters ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
              </button>

              <div className="relative">
                <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={exporting || filteredData.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                  Export
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border py-1 z-50">
                    <button onClick={() => { handleExportPDF(); setShowExportMenu(false); }} className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2">
                      <Printer className="w-4 h-4 text-orange-600" />
                      PDF (SF2)
                    </button>
                    <button onClick={() => { handleExportExcel(); setShowExportMenu(false); }} className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-green-600" />
                      Excel
                    </button>
                  </div>
                )}
              </div>

              <button onClick={() => setShowClearModal(true)} disabled={exporting || filteredData.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" /> Date Range
                </label>
                <div className="flex gap-2">
                  <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg" />
                  <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <GraduationCap className="w-4 h-4" /> Grade
                </label>
                <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
                  {getUniqueGrades().map(grade => <option key={grade} value={grade}>{grade === 'all' ? 'All Grades' : `Grade ${grade}`}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <UserCircle className="w-4 h-4" /> Teacher
                </label>
                <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="all">All Teachers</option>
                  {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Search className="w-4 h-4" /> Search
                </label>
                <input type="text" placeholder="Search by name, LRN..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { title: 'Records', value: formatNumber(summary.totalAttendance), icon: FileText, color: 'blue' },
            { title: 'Present', value: formatNumber(summary.presentCount), icon: CheckCircle, color: 'green' },
            { title: 'Late', value: formatNumber(summary.lateCount), icon: Clock, color: 'yellow' },
            { title: 'Absent', value: formatNumber(summary.absentCount), icon: XCircle, color: 'red' },
            { title: 'Teachers', value: formatNumber(summary.totalTeachers), icon: UserCircle, color: 'purple' }
          ].map((card, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-${card.color}-100`}>
                  <card.icon className={`w-5 h-5 text-${card.color}-600`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex justify-between items-center bg-white rounded-xl shadow-sm p-4">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button onClick={() => setViewMode('teacher')} className={`px-5 py-2 rounded-lg font-medium ${viewMode === 'teacher' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>
              <Table className="w-4 h-4 inline mr-2" /> Teacher Summary
            </button>
            <button onClick={() => setViewMode('chart')} className={`px-5 py-2 rounded-lg font-medium ${viewMode === 'chart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>
              <LayoutGrid className="w-4 h-4 inline mr-2" /> Analytics
            </button>
          </div>
        </div>

        {/* Teacher Summary View */}
        {viewMode === 'teacher' && (
          <div className="space-y-4">
            {teacherSummaries.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No teacher records found</p>
              </div>
            ) : (
              paginatedTeachers.map((teacher) => (
                <div key={teacher.teacher_id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  <div className="p-5 bg-gray-50 border-b cursor-pointer hover:bg-indigo-50 transition" onClick={() => toggleTeacher(teacher.teacher_id)}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${expandedTeachers.has(teacher.teacher_id) ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                          {expandedTeachers.has(teacher.teacher_id) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{teacher.teacher_name}</h3>
                          <p className="text-sm text-gray-500">{teacher.total_students} Students • {teacher.total_sessions} Sessions</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-green-600">✓ {teacher.present_count}</span>
                        <span className="text-yellow-600">🕐 {teacher.late_count}</span>
                        <span className="text-red-600">✗ {teacher.absent_count}</span>
                      </div>
                    </div>
                  </div>

                  {expandedTeachers.has(teacher.teacher_id) && (
                    <div className="p-4 overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Student</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Sessions</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Present</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Late</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Absent</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teacher.students.map((student) => (
                            <tr key={student.student_id} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-3">{student.student_name}</td>
                              <td className="px-4 py-3">{student.total_sessions}</td>
                              <td className="px-4 py-3 text-green-600">{student.present}</td>
                              <td className="px-4 py-3 text-yellow-600">{student.late}</td>
                              <td className="px-4 py-3 text-red-600">{student.absent}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${student.attendance_rate >= 90 ? 'bg-green-500' : student.attendance_rate >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${student.attendance_rate}%` }} />
                                  </div>
                                  <span>{student.attendance_rate}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Pagination */}
            {teacherSummaries.length > 0 && (
              <div className="flex justify-between items-center bg-white rounded-xl p-4">
                <p className="text-sm text-gray-600">Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, teacherSummaries.length)} of {teacherSummaries.length} teachers</p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-2 border rounded-lg disabled:opacity-50">←</button>
                  <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 border rounded-lg disabled:opacity-50">→</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chart View */}
        {viewMode === 'chart' && (
          <div className={`bg-white rounded-2xl shadow-sm border p-6 transition-all ${chartSize === 'large' ? 'h-[600px]' : 'h-[500px]'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Attendance Analytics Dashboard</h3>
              <div className="flex gap-2">
                <button onClick={() => setChartSize(chartSize === 'normal' ? 'large' : 'normal')} className="p-2 hover:bg-gray-100 rounded-lg">
                  {chartSize === 'normal' ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                  <button onClick={() => setChartType('pie')} className={`p-2 rounded-lg ${chartType === 'pie' ? 'bg-white shadow-sm' : ''}`}><PieChart className="w-4 h-4" /></button>
                  <button onClick={() => setChartType('bar')} className={`p-2 rounded-lg ${chartType === 'bar' ? 'bg-white shadow-sm' : ''}`}><BarChart3 className="w-4 h-4" /></button>
                  <button onClick={() => setChartType('line')} className={`p-2 rounded-lg ${chartType === 'line' ? 'bg-white shadow-sm' : ''}`}><Activity className="w-4 h-4" /></button>
                  <button onClick={() => setChartType('area')} className={`p-2 rounded-lg ${chartType === 'area' ? 'bg-white shadow-sm' : ''}`}><TrendingUp className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="90%">
              {chartType === 'line' && (
                <LineChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              )}
              {chartType === 'area' && (
                <AreaChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="present" fill="#10b98130" stroke="#10b981" />
                  <Area type="monotone" dataKey="late" fill="#f59e0b30" stroke="#f59e0b" />
                  <Area type="monotone" dataKey="absent" fill="#ef444430" stroke="#ef4444" />
                </AreaChart>
              )}
              {chartType === 'bar' && (
                <BarChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#10b981" />
                  <Bar dataKey="late" fill="#f59e0b" />
                  <Bar dataKey="absent" fill="#ef4444" />
                </BarChart>
              )}
              {chartType === 'pie' && (
                <RePieChart>
                  <Pie data={getChartData()} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent! * 100).toFixed(0)}%`} outerRadius={150} dataKey="value">
                    {getChartData().map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RePieChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* AI Details Modal */}
        {activeAiModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">AI Insights Details</h3>
                  <button onClick={() => setActiveAiModal(null)} className="px-3 py-1 bg-gray-100 rounded-lg">Close</button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setActiveAiModal('buddy')} className={`px-3 py-1 rounded-lg text-sm ${activeAiModal === 'buddy' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>Buddy Punching</button>
                  <button onClick={() => setActiveAiModal('truancy')} className={`px-3 py-1 rounded-lg text-sm ${activeAiModal === 'truancy' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>Truancy</button>
                  <button onClick={() => setActiveAiModal('peak')} className={`px-3 py-1 rounded-lg text-sm ${activeAiModal === 'peak' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>Peak Hours</button>
                  <button onClick={() => setActiveAiModal('anomalies')} className={`px-3 py-1 rounded-lg text-sm ${activeAiModal === 'anomalies' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>Anomalies</button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
                {activeAiModal === 'buddy' && aiBuddyPunching.length === 0 && <p className="text-center py-8">No buddy punching patterns detected.</p>}
                {activeAiModal === 'truancy' && aiTruancy.length === 0 && <p className="text-center py-8">No at-risk students predicted.</p>}
                {activeAiModal === 'peak' && aiPeak30.length === 0 && <p className="text-center py-8">No peak hour data available.</p>}
                {activeAiModal === 'anomalies' && aiAdvancedAnomalies.length === 0 && <p className="text-center py-8">No advanced anomalies detected.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Clear Data Modal */}
        {showClearModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <div className="text-center">
                <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Clear Attendance Records</h3>
                <p className="text-gray-600 mb-6">This action cannot be undone</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowClearModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                  <button onClick={handleClearAttendance} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Clear</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
