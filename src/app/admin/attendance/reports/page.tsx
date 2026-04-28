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
  Settings,
  Info,
  Trophy,
  Cloud,
  LayoutGrid,
  Table,
  Sparkles,
  Shield,
  Award,
  Activity,
  Zap
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
    full_name: string
    grade: string
    section: string
    profile_photo_base64: string | null
  }
}

interface Student {
  id: string
  lrn: string
  full_name: string
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

export default function AttendanceReportsPage() {
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherHummaries, setTeacherHummaries] = useState<TeacherWithStudents[]>([])
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
  const [aiPeak60, setAiPeak60] = useState<Array<{bucket:string,count:number,weather?:string,holiday?:boolean}>>([])
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

  const [buddyPunching, setBuddyPunching] = useState<Array<{ date: string; section: string; studentA: string; studentB: string; deltaSeconds: number }>>([])
  const [truancyForecast, setTruancyForecast] = useState<Array<{ student_id: string; student_name: string; absentDays: number; lateDays: number; riskReason: string }>>([])
  const [peakHours, setPeakHours] = useState<Array<{ hour: string; count: number }>>([])

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

  // Chart colors - Enhanced palette with gradients
  const COLORS = {
    present: '#10b981',
    late: '#f59e0b',
    absent: '#ef4444',
    primary: ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'],
    gradient: {
      present: ['#10b981', '#34d399'],
      late: ['#f59e0b', '#fbbf24'],
      absent: ['#ef4444', '#f87171']
    }
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
        setTeacherHummaries([])
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
        .select('id, lrn, full_name, grade, section, profile_photo_base64')
        .in('grade', ['11', '12'])
        .order('full_name')

      if (assignedStudentIds !== null) {
        studentsQuery = studentsQuery.in('id', assignedStudentIds)
      } else if (restrictToAssignment) {
        studentsQuery = studentsQuery
          .eq('grade', adminContext!.assigned_grade!)
      }

      const { data: studentsData, error: studentsError } = await studentsQuery

      if (studentsError) throw studentsError
      setStudents(studentsData || [])

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
            full_name,
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
        attendanceQuery = attendanceQuery
          .eq('grade', adminContext!.assigned_grade!)
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
      setAttendanceData(gradeRestrictedAttendance)

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
    calculateTeacherHummaries(filtered)
    calculateAnalytics(filtered)
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
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/l'

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
      .sort((a, b) => b.count - a.count)[0]?.name || 'N/l'

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

  const calculateTeacherHummaries = (data: AttendanceRecord[]) => {
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
          student_name: record.students.full_name,
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
      let totalHessions = 0

      students.forEach(student => {
        student.attendance_rate = Math.round((student.present / student.total_sessions) * 100)
        totalPresent += student.present
        totalLate += student.late
        totalAbsent += student.absent
        totalHessions += student.total_sessions
      })

      students.sort((a, b) => a.student_name.localeCompare(b.student_name))

      const teacher = teachers.find(t => t.id === teacherId)
      const totalMarks = totalPresent + totalLate + totalAbsent

      summaries.push({
        teacher_id: teacherId,
        teacher_name: teacher?.full_name || 'Unknown',
        total_sessions: totalHessions,
        total_students: students.length,
        students: students,
        present_count: totalPresent,
        late_count: totalLate,
        absent_count: totalAbsent,
        attendance_rate: totalMarks > 0 ? Math.round((totalPresent / totalMarks) * 100) : 0
      })
    })

    summaries.sort((a, b) => a.teacher_name.localeCompare(b.teacher_name))
    setTeacherHummaries(summaries)
  }

  const parseTimeInHeconds = (time: string) => {
    const parts = time.split(':').map(Number)
    if (parts.length !== 3) return 0
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  const calculateAnalytics = (data: AttendanceRecord[]) => {
    // Buddy Punching: Rapid sequential different-students scan alerts
    const pockets: Array<{ date: string; section: string; studentA: string; studentB: string; deltaSeconds: number }> = []

    const grouped = data.reduce((acc, record) => {
      const key = `${record.date}-${record.section}`
      if (!acc[key]) acc[key] = []
      acc[key].push(record)
      return acc
    }, {} as Record<string, AttendanceRecord[]>)

    Object.values(grouped).forEach(bucket => {
      const sorted = [...bucket].sort((a, b) => parseTimeInHeconds(a.time_in) - parseTimeInHeconds(b.time_in))
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i]
        const next = sorted[i + 1]
        const deltaSeconds = Math.abs(parseTimeInHeconds(next.time_in) - parseTimeInHeconds(current.time_in))
        if (current.student_id !== next.student_id && deltaSeconds <= 15) {
          pockets.push({
            date: current.date,
            section: current.section,
            studentA: current.students?.full_name || 'Unknown',
            studentB: next.students?.full_name || 'Unknown',
            deltaSeconds
          })
        }
      }
    })

    setBuddyPunching(pockets.slice(0, 20))

    // Truancy forecasting
    const studentTrend = new Map<string, { name: string; absent: number; late: number; total: number }>()
    data.forEach(r => {
      if (!r.student_id) return
      const entry = studentTrend.get(r.student_id) || { name: r.students?.full_name ?? 'Unknown', absent: 0, late: 0, total: 0 }
      entry.total += 1
      if (r.status === 'absent') entry.absent += 1
      if (r.status === 'late') entry.late += 1
      studentTrend.set(r.student_id, entry)
    })

    const predictions = Array.from(studentTrend.entries())
      .map(([student_id, stats]) => {
        const riskReason = stats.absent >= 3
          ? '3+ absences in selected range'
          : (stats.absent + stats.late) / Math.max(stats.total, 1) >= 0.35
            ? 'Frequent tardiness/absences'
            : ''

        return {
          student_id,
          student_name: stats.name,
          absentDays: stats.absent,
          lateDays: stats.late,
          riskReason
        }
      })
      .filter(item => item.riskReason)
      .sort((a, b) => (b.absentDays + b.lateDays) - (a.absentDays + a.lateDays))

    setTruancyForecast(predictions.slice(0, 20))

    // Peak hour analysis
    const hourMap = new Map<string, number>()
    data.forEach(record => {
      if (!record.time_in) return
      const [h] = record.time_in.split(':')
      const hour = `${h.padStart(2, '0')}:00`
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1)
    })

    const hours = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)

    setPeakHours(hours.slice(0, 10))
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
      setAiPeak60(payload.peak60 || [])
      setAiAdvancedAnomalies(payload.advancedAnomalies || payload.advancedlnomalies || [])
      setAiExternalFactors(payload.externalFactors || [])
    } catch (error) {
      console.error('lI analytics error', error)
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

  const expandlll = () => {
    const allTeacherIds = teacherHummaries.map(t => t.teacher_id)
    setExpandedTeachers(new Set(allTeacherIds))
  }

  const collapselll = () => {
    setExpandedTeachers(new Set())
  }

  const getChartData = () => {
    switch (chartType) {
      case 'line':
      case 'area':
        const dailyData: { [key: string]: { date: string, present: number, late: number, absent: number, total: number } } = {}
        filteredData.forEach(record => {
          if (!dailyData[record.date]) {
            dailyData[record.date] = { date: record.date, present: 0, late: 0, absent: 0, total: 0 }
          }
          if (record.status === 'present') dailyData[record.date].present++
          else if (record.status === 'late') dailyData[record.date].late++
          else if (record.status === 'absent') dailyData[record.date].absent++
          dailyData[record.date].total++
        })
        return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date))

      case 'bar':
        return teacherHummaries.map(t => ({
          name: t.teacher_name.split(' ')[0],
          fullName: t.teacher_name,
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
      const doc = new jsPDF()

      doc.setFillColor(59, 130, 246)
      doc.rect(0, 0, 210, 40, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.text('Attendance Report', 105, 25, { align: 'center' })

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 35, { align: 'center' })

      let yPos = 50
      doc.setTextColor(33, 37, 41)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Summary', 20, yPos)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(73, 80, 87)
      
      const summaryData = [
        ['Period:', `${dateRange.start} to ${dateRange.end}`],
        ['Total Students:', summary.totalStudents.toString()],
        ['Total Teachers:', summary.totalTeachers.toString()],
        ['Total Records:', summary.totalAttendance.toString()],
        ['Present:', summary.presentCount.toString()],
        ['Late:', summary.lateCount.toString()],
        ['Absent:', summary.absentCount.toString()],
        ['Avg per Student:', summary.averageAttendance.toString()],
        ['Top Performer:', summary.topPerformer],
        ['Most Active Grade:', summary.mostActiveGrade]
      ]

      let summaryX = 20
      summaryData.forEach((item, index) => {
        if (index < 5) {
          doc.text(item[0], summaryX, yPos + 10 + (index * 7))
          doc.text(item[1], summaryX + 40, yPos + 10 + (index * 7))
        } else if (index < 10) {
          doc.text(item[0], summaryX + 100, yPos + 10 + ((index - 5) * 7))
          doc.text(item[1], summaryX + 140, yPos + 10 + ((index - 5) * 7))
        }
      })

      yPos = 120
      teacherHummaries.slice(0, 3).forEach((teacher, index) => {
        if (index > 0) {
          yPos += 20
        }

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(59, 130, 246)
        doc.text(teacher.teacher_name, 20, yPos)
        
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(73, 80, 87)
        doc.text(`Sessions: ${teacher.total_sessions} | Students: ${teacher.total_students} | Present: ${teacher.present_count} | Late: ${teacher.late_count} | Absent: ${teacher.absent_count} | Rate: ${teacher.attendance_rate}%`, 20, yPos + 6)

        const studentColumns = [
          { header: 'Student', dataKey: 'name' },
          { header: 'Grade/Hec', dataKey: 'grade' },
          { header: 'Hess', dataKey: 'sessions' },
          { header: 'P', dataKey: 'present' },
          { header: 'L', dataKey: 'late' },
          { header: 'l', dataKey: 'absent' },
          { header: 'Rate', dataKey: 'rate' }
        ]

        const studentRows = teacher.students.slice(0, 8).map(s => ({
          name: s.student_name,
          grade: `G${s.grade}`,
          sessions: s.total_sessions,
          present: s.present,
          late: s.late,
          absent: s.absent,
          rate: `${s.attendance_rate}%`
        }))

        autoTable(doc, {
          startY: yPos + 12,
          head: [studentColumns.map(c => c.header)],
          body: studentRows.map(r => Object.values(r)),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [240, 244, 248] },
          margin: { left: 20, right: 20 },
          styles: { fontSize: 8, cellPadding: 3 }
        })

        yPos = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || (yPos + 12)) + 10
      })

      doc.save(`attendance_report_${dateRange.start}_to_${dateRange.end}.pdf`)
    } catch (error) {
      console.error('Error exporting PDF:', error)
    } finally {
      setExporting(false)
    }
  }

const handleExportExcel = () => {
  try {
    setExporting(true)

    const workbook = XLSX.utils.book_new()

    // Prepare student data for all teachers
    const studentRows: any[] = []

    teacherHummaries.forEach(teacher => {
      teacher.students.forEach(student => {
        studentRows.push({
          Name: student.student_name,
          Grade: student.grade,
          Sessions: student.total_sessions,
          Present: student.present,
          Late: student.late,
          Absent: student.absent
        })
      })
    })

    // Sort by Name
    studentRows.sort((a, b) => a.Name.localeCompare(b.Name))

    const studentSheet = XLSX.utils.json_to_sheet(studentRows)
    studentSheet['!cols'] = [
      { wch: 35 }, // Name
      { wch: 10 }, // Grade
      { wch: 12 }, // Sessions
      { wch: 10 }, // Present
      { wch: 8 },  // Late
      { wch: 10 }  // Absent
    ]

    XLSX.utils.book_append_sheet(workbook, studentSheet, 'Students Attendance')

    XLSX.writeFile(workbook, `attendance_report_${dateRange.start}_to_${dateRange.end}.xlsx`)
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
            const { data: teacherHessions } = await supabase
              .from('attendance_sessions')
              .select('id')
              .eq('teacher_id', selectedTeacher)
            
            const sessionIds = teacherHessions?.map(s => s.id) || []
            if (sessionIds.length > 0) {
              query = query.in('session_id', sessionIds)
            } else {
              query = query.eq('session_id', '00000000-0000-0000-0000-000000000000')
            }
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
            const { data: teacherHessions } = await supabase
              .from('attendance_sessions')
              .select('id')
              .eq('teacher_id', clearTeacher)
            
            const sessionIds = teacherHessions?.map(s => s.id) || []
            if (sessionIds.length > 0) {
              query = query.in('session_id', sessionIds)
            } else {
              query = query.eq('session_id', '00000000-0000-0000-0000-000000000000')
            }
          } else {
            query = query.eq('session_id', '00000000-0000-0000-0000-000000000000')
          }
          break

        case 'all':
          query = query.gte('date', '2000-01-01')
          break
      }

      const { error } = await query

      if (error) {
        console.error('Delete error:', error)
        throw error
      }

      await fetchData()
      setShowClearModal(false)
      alert('Attendance records cleared successfully!')

    } catch (error: any) {
      console.error('Error clearing attendance:', error)
      alert(`Failed to clear attendance records: ${error.message || 'Please try again.'}`)
    } finally {
      setClearing(false)
    }
  }

  const getUniqueGrades = () => {
    return ['all', '11', '12']
  }

  const totalPages = Math.ceil(teacherHummaries.length / itemsPerPage)
  const paginatedTeachers = teacherHummaries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading attendance data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/30 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-10">
        
        {/* Header with Modern Glass Morphism - Fully Responsive */}
        <div className="relative overflow-visible bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
          
          <div className="relative px-4 sm:px-6 py-4 sm:py-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-linear-to-r from-indigo-600 to-purple-600 rounded-2xl blur-lg opacity-50"></div>
                  <div className="relative p-2 sm:p-3 bg-linear-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
                    <FileText className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-linear-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                    Attendance Reports
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                    <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
                    AI-powered insights • Real-time analytics • Export ready
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="group flex items-center gap-1 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all duration-200 text-sm"
                >
                  {showFilters ? <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
                  <span className="text-xs sm:text-sm font-medium">{showFilters ? 'Hide' : 'Show'}</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={exporting || filteredData.length === 0}
                    className="group flex items-center gap-1 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-linear-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 text-sm"
                  >
                    {exporting ? <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> : <DownloadCloud className="w-3 h-3 sm:w-4 sm:h-4" />}
                    <span className="text-xs sm:text-sm font-medium">Export</span>
                    <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-44 sm:w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-in slide-in-from-top-2">
                      <button onClick={() => { handleExportPDF(); setShowExportMenu(false); }} className="w-full px-3 sm:px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 sm:gap-3 text-slate-700 transition-colors text-sm">
                        <Printer className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600" />
                        <span>PDF</span>
                      </button>
                      <button onClick={() => { handleExportExcel(); setShowExportMenu(false); }} className="w-full px-3 sm:px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 sm:gap-3 text-slate-700 transition-colors text-sm">
                        <FileSpreadsheet className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                        <span>Excel</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowClearModal(true)}
                  disabled={exporting || filteredData.length === 0}
                  className="group flex items-center gap-1 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-linear-to-r from-rose-600 to-red-600 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 text-sm"
                >
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm font-medium hidden xs:inline">Clear</span>
                </button>

                <button
                  onClick={() => fetchData()}
                  disabled={loading}
                  className="p-2 sm:p-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section - Fully Responsive Grid */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 sm:p-6 animate-in slide-in-from-top-4">
            <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-5 pb-2 border-b border-slate-100">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
              <h3 className="font-semibold text-slate-700 text-sm sm:text-base">Advanced Filters</h3>
              <span className="text-xs text-slate-400 ml-auto">Apply filters to refine your data</span>
            </div>
            
            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
                  <span>Date Range</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="flex-1 px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm" />
                  <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="flex-1 px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700 flex items-center gap-2">
                  <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
                  <span>Grade Level</span>
                </label>
                <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="w-full px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm">
                  {getUniqueGrades().map(grade => <option key={grade} value={grade}>{grade === 'all' ? 'All Grades' : `Grade ${grade}`}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700 flex items-center gap-2">
                  <UserCircle className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
                  <span>Teacher</span>
                </label>
                <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} className="w-full px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm truncate">
                  <option value="all">All Teachers</option>
                  {teachers.map(teacher => <option key={teacher.id} value={teacher.id} className="truncate">{teacher.full_name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 sm:gap-5 mt-4 sm:mt-5">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
                  <span>Status</span>
                </label>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm">
                  <option value="all">All Status</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Search className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
                  <span>Search</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 sm:w-4 sm:h-4" />
                  <input type="text" placeholder="Search by student, LRN, or teacher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm" />
                </div>
              </div>
            </div>

            {(selectedGrade !== 'all' || selectedTeacher !== 'all' || selectedStatus !== 'all' || searchTerm) && (
              <div className="mt-4 sm:mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 flex items-center gap-1"><Filter className="w-3 h-3" />Active:</span>
                {selectedGrade !== 'all' && <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs border border-indigo-100">Grade {selectedGrade}</span>}
                {selectedTeacher !== 'all' && <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs border border-indigo-100">Teacher</span>}
                {selectedStatus !== 'all' && <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs border border-indigo-100 capitalize">{selectedStatus}</span>}
                {searchTerm && <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs border border-indigo-100">"{searchTerm}"</span>}
                <button onClick={() => { setSearchTerm(''); setSelectedGrade('all'); setSelectedTeacher('all'); setSelectedStatus('all'); }} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Clear</button>
              </div>
            )}
          </div>
        )}

        {/* KPI Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-5">
          {[
            { title: 'Records', value: formatNumber(summary.totalAttendance), icon: FileText, color: 'from-blue-600 to-indigo-600', bg: 'bg-blue-50', textColor: 'text-blue-600' },
            { title: 'Present', value: formatNumber(summary.presentCount), icon: CheckCircle, color: 'from-emerald-600 to-green-600', bg: 'bg-emerald-50', textColor: 'text-emerald-600', change: summary.totalAttendance > 0 ? `${((summary.presentCount / summary.totalAttendance) * 100).toFixed(1)}%` : '0%' },
            { title: 'Late', value: formatNumber(summary.lateCount), icon: Clock, color: 'from-amber-600 to-yellow-600', bg: 'bg-amber-50', textColor: 'text-amber-600', change: summary.totalAttendance > 0 ? `${((summary.lateCount / summary.totalAttendance) * 100).toFixed(1)}%` : '0%' },
            { title: 'Absent', value: formatNumber(summary.absentCount), icon: XCircle, color: 'from-rose-600 to-red-600', bg: 'bg-rose-50', textColor: 'text-rose-600', change: summary.totalAttendance > 0 ? `${((summary.absentCount / summary.totalAttendance) * 100).toFixed(1)}%` : '0%' },
            { title: 'Teachers', value: formatNumber(summary.totalTeachers), icon: UserCircle, color: 'from-purple-600 to-pink-600', bg: 'bg-purple-50', textColor: 'text-purple-600' }
          ].map((card, idx) => (
            <div key={idx} className="group relative bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-100">
              <div className={`absolute inset-0 bg-linear-to-br ${card.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
              <div className="p-3 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl ${card.bg} group-hover:scale-110 transition-transform duration-300`}>
                    <card.icon className={`w-3 h-3 sm:w-5 sm:h-5 ${card.textColor}`} />
                  </div>
                  {card.change && <span className="text-[10px] sm:text-xs font-medium text-slate-400">{card.change}</span>}
                </div>
                <p className="text-lg sm:text-2xl font-bold text-slate-800">{card.value}</p>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">{card.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* View Toggle - Responsive */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white rounded-xl shadow-md p-3 sm:p-4 border border-slate-100">
          <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setViewMode('teacher')}
              className={`flex-1 sm:flex-none px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                viewMode === 'teacher'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Table className="w-3 h-3 sm:w-4 sm:h-4" />
              Teacher Summary
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`flex-1 sm:flex-none px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                viewMode === 'chart'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3 h-3 sm:w-4 sm:h-4" />
              Analytics
            </button>
          </div>

          {viewMode === 'chart' && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setChartSize(chartSize === 'normal' ? 'large' : 'normal')}
                className="p-1.5 sm:p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                title={chartSize === 'normal' ? 'Enlarge chart' : 'Normal size'}
              >
                {chartSize === 'normal' ? <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" /> : <Minimize2 className="w-3 h-3 sm:w-4 sm:h-4" />}
              </button>
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                <button onClick={() => setChartType('pie')} className={`p-1.5 sm:p-2 rounded-lg transition-all ${chartType === 'pie' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`} title="Pie Chart"><PieChart className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                <button onClick={() => setChartType('bar')} className={`p-1.5 sm:p-2 rounded-lg transition-all ${chartType === 'bar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`} title="Bar Chart"><BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                <button onClick={() => setChartType('line')} className={`p-1.5 sm:p-2 rounded-lg transition-all ${chartType === 'line' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`} title="Line Chart"><Activity className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                <button onClick={() => setChartType('area')} className={`p-1.5 sm:p-2 rounded-lg transition-all ${chartType === 'area' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`} title="Area Chart"><TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /></button>
              </div>
            </div>
          )}
        </div>

        {/* Teacher Summary View - Responsive Tables */}
        {viewMode === 'teacher' && (
          <div className="space-y-4">
            {teacherHummaries.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 sm:p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 sm:p-4 bg-slate-100 rounded-full">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-base sm:text-lg">No teacher records found</p>
                  <p className="text-slate-400 text-xs sm:text-sm">Try adjusting your filters or date range</p>
                </div>
              </div>
            ) : (
              paginatedTeachers.map((teacher) => {
                const grade11Students = teacher.students.filter(s => s.grade === '11')
                const grade12Students = teacher.students.filter(s => s.grade === '12')
                
                return (
                <div
                  key={teacher.teacher_id}
                  className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-slate-100 overflow-hidden"
                >
                  {/* Teacher Header */}
                  <div
                    className="p-3 sm:p-5 bg-linear-to-r from-slate-50 to-white border-b border-slate-100 cursor-pointer hover:from-indigo-50 hover:to-indigo-50/30 transition-all duration-300 group"
                    onClick={() => toggleTeacher(teacher.teacher_id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`p-2 sm:p-3 rounded-xl transition-all duration-300 flex-shrink-0 ${
                          expandedTeachers.has(teacher.teacher_id)
                            ? 'bg-indigo-600 text-white rotate-180'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100'
                        }`}>
                          {expandedTeachers.has(teacher.teacher_id) ? (
                            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-slate-800 flex flex-wrap items-center gap-2">
                            <span className="truncate">{teacher.teacher_name}</span>
                            <span className={`px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full flex-shrink-0 ${
                              teacher.attendance_rate >= 90 ? 'bg-emerald-100 text-emerald-700' :
                              teacher.attendance_rate >= 75 ? 'bg-amber-100 text-amber-700' :
                              'bg-rose-100 text-rose-700'
                            }`}>
                              {teacher.attendance_rate}% Rate
                            </span>
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                              {teacher.total_students} Students
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                              {teacher.total_sessions} Sessions
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl self-start sm:self-auto">
                        <span className="flex items-center gap-0.5 sm:gap-1 text-emerald-600 text-xs sm:text-sm">
                          <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                          {teacher.present_count}
                        </span>
                        <span className="flex items-center gap-0.5 sm:gap-1 text-amber-600 text-xs sm:text-sm">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                          {teacher.late_count}
                        </span>
                        <span className="flex items-center gap-0.5 sm:gap-1 text-rose-600 text-xs sm:text-sm">
                          <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                          {teacher.absent_count}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Student Tables - Mobile Responsive */}
                  {expandedTeachers.has(teacher.teacher_id) && (
                    <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
                      {/* Grade 11 Section */}
                      {grade11Students.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-indigo-200">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                              <span className="text-[10px] sm:text-xs font-bold text-indigo-600">11</span>
                            </div>
                            <h4 className="text-sm sm:text-md font-semibold text-indigo-700">Grade 11 Students</h4>
                            <span className="text-[10px] sm:text-xs text-slate-400 ml-auto">{grade11Students.length} students</span>
                          </div>
                          
                          {/* Desktop Table View - hidden on mobile */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full min-w-[860px]">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Student</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Section</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Sessions</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Present</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Late</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Absent</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Rate</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {grade11Students.map((student) => (
                                  <tr key={student.student_id} className="hover:bg-slate-50 transition-colors duration-150">
                                    <td className="px-3 sm:px-6 py-3">
                                      <div className="flex items-center gap-3">
                                        {student.profile_photo_base64 ? (
                                          <img src={student.profile_photo_base64} alt={student.student_name} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-slate-200" />
                                        ) : (
                                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-linear-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-[10px] sm:text-sm">
                                            {student.student_name.charAt(0)}
                                          </div>
                                        )}
                                        <div>
                                          <p className="font-medium text-slate-900 text-xs sm:text-sm">{student.student_name}</p>
                                          <p className="text-[10px] sm:text-xs text-slate-500">LRN: {student.lrn}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3">
                                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-100 text-slate-700 rounded-xl text-[10px] sm:text-xs font-medium">
                                        {student.section}
                                      </span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 font-semibold text-slate-900 text-xs sm:text-sm">{student.total_sessions}</td>
                                    <td className="px-3 sm:px-6 py-3">
                                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] sm:text-xs font-medium">{student.present}</span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3">
                                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-50 text-amber-700 rounded-xl text-[10px] sm:text-xs font-medium">{student.late}</span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3">
                                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-rose-50 text-rose-700 rounded-xl text-[10px] sm:text-xs font-medium">{student.absent}</span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3">
                                      <div className="flex items-center gap-1 sm:gap-2">
                                        <div className="w-12 sm:w-16 h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full transition-all duration-500 ${
                                            student.attendance_rate >= 90 ? 'bg-emerald-500' :
                                            student.attendance_rate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                          }`} style={{ width: `${student.attendance_rate}%` }} />
                                        </div>
                                        <span className={`text-[10px] sm:text-sm font-medium ${
                                          student.attendance_rate >= 90 ? 'text-emerald-700' :
                                          student.attendance_rate >= 75 ? 'text-amber-700' : 'text-rose-700'
                                        }`}>{student.attendance_rate}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Card View - visible on mobile */}
                          <div className="space-y-3 md:hidden">
                            {grade11Students.map((student) => (
                              <div key={student.student_id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <div className="flex items-center gap-3 mb-2">
                                  {student.profile_photo_base64 ? (
                                    <img src={student.profile_photo_base64} alt={student.student_name} className="w-10 h-10 rounded-full object-cover border-2 border-slate-200" />
                                  ) : (
                                    <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                      {student.student_name.charAt(0)}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 text-sm truncate">{student.student_name}</p>
                                    <p className="text-xs text-slate-500">LRN: {student.lrn}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Section:</span>
                                    <span className="font-medium text-slate-700">{student.section}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Sessions:</span>
                                    <span className="font-semibold text-slate-900">{student.total_sessions}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Present:</span>
                                    <span className="text-emerald-600 font-medium">{student.present}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Late:</span>
                                    <span className="text-amber-600 font-medium">{student.late}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Absent:</span>
                                    <span className="text-rose-600 font-medium">{student.absent}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1">
                                    <span className="text-slate-500">Rate:</span>
                                    <div className="flex items-center gap-1">
                                      <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${
                                          student.attendance_rate >= 90 ? 'bg-emerald-500' :
                                          student.attendance_rate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`} style={{ width: `${student.attendance_rate}%` }} />
                                      </div>
                                      <span className={`font-medium ${
                                        student.attendance_rate >= 90 ? 'text-emerald-700' :
                                        student.attendance_rate >= 75 ? 'text-amber-700' : 'text-rose-700'
                                      }`}>{student.attendance_rate}%</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grade 12 Section */}
                      {grade12Students.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-purple-200">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-100 flex items-center justify-center">
                              <span className="text-[10px] sm:text-xs font-bold text-purple-600">12</span>
                            </div>
                            <h4 className="text-sm sm:text-md font-semibold text-purple-700">Grade 12 Students</h4>
                            <span className="text-[10px] sm:text-xs text-slate-400 ml-auto">{grade12Students.length} students</span>
                          </div>
                          
                          {/* Desktop Table View */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full min-w-[860px]">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Student</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Section</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Sessions</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Present</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Late</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Absent</th>
                                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Rate</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {grade12Students.map((student) => (
                                  <tr key={student.student_id} className="hover:bg-slate-50 transition-colors duration-150">
                                    <td className="px-3 sm:px-6 py-3">
                                      <div className="flex items-center gap-3">
                                        {student.profile_photo_base64 ? (
                                          <img src={student.profile_photo_base64} alt={student.student_name} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-slate-200" />
                                        ) : (
                                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-linear-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-[10px] sm:text-sm">
                                            {student.student_name.charAt(0)}
                                          </div>
                                        )}
                                        <div>
                                          <p className="font-medium text-slate-900 text-xs sm:text-sm">{student.student_name}</p>
                                          <p className="text-[10px] sm:text-xs text-slate-500">LRN: {student.lrn}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3">
                                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-100 text-slate-700 rounded-xl text-[10px] sm:text-xs font-medium">
                                        {student.section}
                                      </span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 font-semibold text-slate-900 text-xs sm:text-sm">{student.total_sessions}</td>
                                    <td className="px-3 sm:px-6 py-3">
                                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] sm:text-xs font-medium">{student.present}</span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3">
                                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-50 text-amber-700 rounded-xl text-[10px] sm:text-xs font-medium">{student.late}</span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3">
                                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-rose-50 text-rose-700 rounded-xl text-[10px] sm:text-xs font-medium">{student.absent}</span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3">
                                      <div className="flex items-center gap-1 sm:gap-2">
                                        <div className="w-12 sm:w-16 h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full transition-all duration-500 ${
                                            student.attendance_rate >= 90 ? 'bg-emerald-500' :
                                            student.attendance_rate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                          }`} style={{ width: `${student.attendance_rate}%` }} />
                                        </div>
                                        <span className={`text-[10px] sm:text-sm font-medium ${
                                          student.attendance_rate >= 90 ? 'text-emerald-700' :
                                          student.attendance_rate >= 75 ? 'text-amber-700' : 'text-rose-700'
                                        }`}>{student.attendance_rate}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Card View */}
                          <div className="space-y-3 md:hidden">
                            {grade12Students.map((student) => (
                              <div key={student.student_id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <div className="flex items-center gap-3 mb-2">
                                  {student.profile_photo_base64 ? (
                                    <img src={student.profile_photo_base64} alt={student.student_name} className="w-10 h-10 rounded-full object-cover border-2 border-slate-200" />
                                  ) : (
                                    <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                      {student.student_name.charAt(0)}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 text-sm truncate">{student.student_name}</p>
                                    <p className="text-xs text-slate-500">LRN: {student.lrn}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Section:</span>
                                    <span className="font-medium text-slate-700">{student.section}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Sessions:</span>
                                    <span className="font-semibold text-slate-900">{student.total_sessions}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Present:</span>
                                    <span className="text-emerald-600 font-medium">{student.present}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Late:</span>
                                    <span className="text-amber-600 font-medium">{student.late}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                                    <span className="text-slate-500">Absent:</span>
                                    <span className="text-rose-600 font-medium">{student.absent}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1">
                                    <span className="text-slate-500">Rate:</span>
                                    <div className="flex items-center gap-1">
                                      <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${
                                          student.attendance_rate >= 90 ? 'bg-emerald-500' :
                                          student.attendance_rate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`} style={{ width: `${student.attendance_rate}%` }} />
                                      </div>
                                      <span className={`font-medium ${
                                        student.attendance_rate >= 90 ? 'text-emerald-700' :
                                        student.attendance_rate >= 75 ? 'text-amber-700' : 'text-rose-700'
                                      }`}>{student.attendance_rate}%</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No students message */}
                      {grade11Students.length === 0 && grade12Students.length === 0 && (
                        <div className="text-center py-6 sm:py-8 text-slate-500 text-sm">
                          No students assigned to this teacher
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
              })
            )}

            {/* Pagination - Responsive */}
            {teacherHummaries.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <p className="text-xs sm:text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                  <span className="font-semibold text-slate-900">{Math.min(currentPage * itemsPerPage, teacherHummaries.length)}</span> of{' '}
                  <span className="font-semibold text-slate-900">{teacherHummaries.length}</span> teachers
                </p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 sm:p-2 border border-slate-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all duration-200">
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                  <div className="flex gap-1">
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      let pageNum = currentPage
                      if (totalPages <= 5) pageNum = i + 1
                      else if (currentPage <= 3) pageNum = i + 1
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
                      else pageNum = currentPage - 2 + i
                      
                      return (
                        <button key={i} onClick={() => setCurrentPage(pageNum)} className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl font-medium transition-all duration-200 text-xs sm:text-sm ${
                          currentPage === pageNum ? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-700'
                        }`}>
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-1.5 sm:p-2 border border-slate-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all duration-200">
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chart View - Responsive */}
        {viewMode === 'chart' && (
          <div className={`bg-white rounded-2xl shadow-lg border border-slate-100 p-3 sm:p-6 transition-all duration-300 ${chartSize === 'large' ? 'h-96 sm:h-150' : 'h-80 sm:h-112.5'}`}>
            <div className="mb-3 sm:mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <div>
                <h3 className="text-sm sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  Attendance Analytics Dashboard
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                  {chartType === 'pie' && 'Overall distribution of attendance records'}
                  {chartType === 'bar' && 'Teacher performance comparison'}
                  {chartType === 'line' && 'Daily trends over time'}
                  {chartType === 'area' && 'Stacked area visualization'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-indigo-50 rounded-lg">
                  <Sparkles className="w-2 h-2 sm:w-3 sm:h-3 text-indigo-500" />
                  <span className="text-[10px] sm:text-xs text-indigo-600">AI Analysis Ready</span>
                </div>
                <button
                  onClick={() => setActiveAiModal('buddy')}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  <Shield className="w-2 h-2 sm:w-3 sm:h-3" />
                  AI Details
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="85%">
              {chartType === 'line' && (
                <LineChart data={getChartData()} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="lateGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                    <linearGradient id="absentGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#e2e8f0' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ paddingTop: 16, fontSize: '12px' }} />
                  <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={{ r: 2, fill: '#10b981', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2, fill: '#f59e0b', strokeWidth: 2, stroke: 'white' }} />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={{ r: 2, fill: '#ef4444', strokeWidth: 2, stroke: 'white' }} />
                </LineChart>
              )}
              {chartType === 'area' && (
                <AreaChart data={getChartData()} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="presentArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="lateArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                    <linearGradient id="absentArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="present" stroke="#10b981" fill="url(#presentArea)" strokeWidth={2} />
                  <Area type="monotone" dataKey="late" stroke="#f59e0b" fill="url(#lateArea)" strokeWidth={2} />
                  <Area type="monotone" dataKey="absent" stroke="#ef4444" fill="url(#absentArea)" strokeWidth={2} />
                </AreaChart>
              )}
              {chartType === 'bar' && (
                <BarChart data={getChartData()} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="presentBar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/></linearGradient>
                    <linearGradient id="lateBar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0.4}/></linearGradient>
                    <linearGradient id="absentBar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0.4}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="present" fill="url(#presentBar)" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="late" fill="url(#lateBar)" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="absent" fill="url(#absentBar)" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              )}
              {chartType === 'pie' && (
                <RePieChart>
                  <Pie
                    data={getChartData()}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={({ name, percent }) => percent ? `${name}: ${(percent * 100).toFixed(0)}%` : name}
                    outerRadius={chartSize === 'large' ? 120 : 80}
                    fill="#8884d8"
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1000}
                  >
                    {getChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={(entry as {color?: string}).color || COLORS.primary[index % COLORS.primary.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '12px' }} formatter={(value) => [`${value} records`, 'Count']} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 20, fontSize: '11px' }} />
                </RePieChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* AI Details Modal - Responsive */}
        {activeAiModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">AI Insights Details</h3>
                  <button onClick={() => setActiveAiModal(null)} className="px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">Close</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1 sm:gap-2">
                  <button onClick={() => setActiveAiModal('buddy')} className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs rounded-lg transition-colors ${activeAiModal === 'buddy' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Buddy Punching</button>
                  <button onClick={() => setActiveAiModal('truancy')} className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs rounded-lg transition-colors ${activeAiModal === 'truancy' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Truancy Forecast</button>
                  <button onClick={() => setActiveAiModal('peak')} className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs rounded-lg transition-colors ${activeAiModal === 'peak' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Peak Hours</button>
                  <button onClick={() => setActiveAiModal('anomalies')} className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs rounded-lg transition-colors ${activeAiModal === 'anomalies' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Advanced Anomalies</button>
                  <button onClick={() => setActiveAiModal('external')} className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs rounded-lg transition-colors ${activeAiModal === 'external' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>External Factors</button>
                </div>
              </div>

              <div className="p-3 sm:p-4 overflow-y-auto max-h-[calc(80vh-72px)] text-xs sm:text-sm text-slate-700">
                {activeAiModal === 'buddy' && (
                  aiBuddyPunching.length === 0 ? <p className="text-slate-500 text-center py-6 sm:py-8">No buddy punching patterns detected.</p> : (
                    <div className="space-y-2">
                      {aiBuddyPunching.map((item, idx) => (
                        <div key={`buddy-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div>
                            <span className="font-semibold text-indigo-700">{item.a}</span>
                            <span className="text-slate-400 mx-1">&</span>
                            <span className="font-semibold text-indigo-700">{item.b}</span>
                            <span className="text-slate-500 ml-2 text-[10px] sm:text-xs">({item.deltaSeconds}s apart)</span>
                            <div className="text-[10px] sm:text-xs text-slate-400 mt-1">{item.date}</div>
                          </div>
                          <span className={`px-2 py-1 rounded text-[10px] sm:text-xs font-medium self-start sm:self-center ${
                            item.risk === 'high' ? 'bg-red-100 text-red-700' : 
                            item.risk === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
                            'bg-green-100 text-green-700'
                          }`}>
                            {item.risk} risk
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                )}
                {activeAiModal === 'truancy' && (
                  aiTruancy.length === 0 ? <p className="text-slate-500 text-center py-6 sm:py-8">No at-risk students predicted.</p> : (
                    <div className="space-y-2">
                      {aiTruancy.map((item, idx) => (
                        <div key={`truancy-${idx}`} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-semibold text-rose-600 text-sm">{item.student_name}</span>
                            <span className="text-slate-500 text-[10px] sm:text-xs">Risk Score: {item.riskScore}</span>
                          </div>
                          <div className="text-slate-600 text-[10px] sm:text-xs mt-1">
                            {item.absent} absences, {item.late} late arrivals out of {item.total} sessions
                            {item.externalFactors && <span className="text-blue-600 block mt-1">📊 {item.externalFactors.join(', ')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
                {activeAiModal === 'peak' && (
                  aiPeak30.length === 0 ? <p className="text-slate-500 text-center py-6 sm:py-8">No peak hour data available.</p> : (
                    <div className="space-y-2">
                      {aiPeak30.map((item, idx) => (
                        <div key={`peak-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex flex-wrap items-center gap-2">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
                            <span className="font-mono font-medium text-xs sm:text-sm">{item.bucket}</span>
                            {item.weather && <span className="text-blue-500 text-[10px] sm:text-xs">🌤️ {item.weather}</span>}
                            {item.holiday && <span className="text-red-500 text-[10px] sm:text-xs">🎉 Holiday</span>}
                          </div>
                          <span className="font-bold text-indigo-600 text-xs sm:text-sm">{item.count} scans</span>
                        </div>
                      ))}
                    </div>
                  )
                )}
                {activeAiModal === 'anomalies' && (
                  aiAdvancedAnomalies.length === 0 ? <p className="text-slate-500 text-center py-6 sm:py-8">No advanced anomalies detected.</p> : (
                    <div className="space-y-2">
                      {aiAdvancedAnomalies.map((item, idx) => (
                        <div key={`anomaly-${idx}`} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-semibold text-purple-600 text-sm">{item.student_name}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium self-start sm:self-center ${
                              item.severity === 'high' ? 'bg-red-100 text-red-700' : 
                              item.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-green-100 text-green-700'
                            }`}>{item.severity}</span>
                          </div>
                          <p className="text-slate-600 text-[10px] sm:text-xs mt-1">{item.description}</p>
                          {item.dates && <p className="text-slate-400 text-[10px] sm:text-xs mt-1">Dates: {item.dates.join(', ')}</p>}
                        </div>
                      ))}
                    </div>
                  )
                )}
                {activeAiModal === 'external' && (
                  aiExternalFactors.length === 0 ? <p className="text-slate-500 text-center py-6 sm:py-8">No external factors data available.</p> : (
                    <div className="space-y-2">
                      {aiExternalFactors.map((factor, idx) => (
                        <div key={`external-${idx}`} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="font-medium text-slate-700 text-xs sm:text-sm">{factor.date}</div>
                          <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 text-[10px] sm:text-xs">
                            {factor.weather && <span className="text-blue-600">🌡️ {factor.weather.condition} • {factor.weather.temperature}°C</span>}
                            {factor.holiday?.isHoliday && <span className="text-red-600">🏖️ {factor.holiday.holidayName}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Clear Data Modal - Responsive */}
        {showClearModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in zoom-in-95">
              <div className="p-4 sm:p-6 border-b border-slate-100">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-linear-to-br from-rose-500 to-red-500 flex items-center justify-center shadow-lg flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800">Clear Attendance Records</h3>
                    <p className="text-xs sm:text-sm text-slate-500">This action cannot be undone</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 space-y-4">
                <p className="text-xs sm:text-sm text-slate-600">Select what attendance records you want to clear:</p>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {[
                    { value: 'all', label: 'All Attendance Records', desc: 'Clear all attendance records from the database' },
                    { value: 'filtered', label: 'Currently Filtered Records', desc: 'Clear only the records shown in the current view' },
                    { value: 'date', label: 'By Specific Date', desc: 'Clear records for a specific date' },
                    { value: 'teacher', label: 'By Teacher', desc: 'Clear records for a specific teacher' }
                  ].map((option) => (
                    <label key={option.value} className={`flex flex-col sm:flex-row sm:items-start gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                      clearOption === option.value ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-rose-200 hover:bg-rose-50/50'
                    }`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" name="clearOption" value={option.value} checked={clearOption === option.value} onChange={(e) => setClearOption(e.target.value as any)} className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 text-sm">{option.label}</p>
                          <p className="text-xs text-slate-500">{option.desc}</p>
                        </div>
                      </div>
                      {clearOption === option.value && option.value === 'date' && (
                        <input type="date" value={clearDate} onChange={(e) => setClearDate(e.target.value)} onClick={(e) => e.stopPropagation()} className="mt-2 sm:mt-3 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-sm" />
                      )}
                      {clearOption === option.value && option.value === 'teacher' && (
                        <select value={clearTeacher} onChange={(e) => setClearTeacher(e.target.value)} onClick={(e) => e.stopPropagation()} className="mt-2 sm:mt-3 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-sm">
                          <option value="">Select teacher</option>
                          {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
                        </select>
                      )}
                    </label>
                  ))}
                </div>
                <div className="bg-linear-to-br from-rose-50 to-red-50 p-3 sm:p-4 rounded-xl border border-rose-100">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs sm:text-sm text-rose-700">
                      <p className="font-medium mb-1">⚠️ Warning</p>
                      <p>This action will permanently delete the selected attendance records. This cannot be undone.</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2 sm:pt-4">
                  <button onClick={() => setShowClearModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 font-medium text-sm order-2 sm:order-1">Cancel</button>
                  <button onClick={handleClearAttendance} disabled={clearing || (clearOption === 'teacher' && !clearTeacher)} className="flex-1 px-4 py-2.5 bg-linear-to-r from-rose-600 to-red-600 text-white rounded-xl hover:from-rose-700 hover:to-red-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-lg shadow-rose-500/25 text-sm order-1 sm:order-2">
                    {clearing ? <><Loader2 className="w-4 h-4 animate-spin" /> Clearing...</> : <><Trash2 className="w-4 h-4" /> Clear Records</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: fadeIn 0.3s ease-out; }
        @keyframes zoomIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .zoom-in-95 { animation: zoomIn 0.2s ease-out; }
        @keyframes slideInBottom {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .slide-in-from-bottom-2 { animation: slideInBottom 0.2s ease-out; }
        .slide-in-from-top-4 { animation: slideInBottom 0.3s ease-out; }
        
        @media (min-width: 480px) {
          .xs\\:inline { display: inline; }
          .xs\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  )
}
