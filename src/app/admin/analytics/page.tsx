'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { fetchAdminById, getAssignedStudentIds, getStoredAdminSession } from '../../../../lib/admin-auth'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Clock,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  Target,
  Eye,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import {
  LineChart as ReLineChart,
  Line,
  BarChart as ReBarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
  Scatter
} from 'recharts'

interface AnalyticsData {
  totalStudents: number
  totalAttendance: number
  averageDaily: number
  peakDay: { date: string; count: number }
  lowestDay: { date: string; count: number }
  attendanceRate: number
  topPerformingSection: { section: string; rate: number }
  mostPunctualStudent: { name: string; lrn: string; onTime: number }
}

interface TrendData {
  date: string
  present: number
  late: number
  absent: number
  excused: number
  total: number
}

interface SectionPerformance {
  section: string
  totalStudents: number
  attendanceCount: number
  attendanceRate: number
  lateCount: number
  absentCount: number
  excusedCount: number
}

interface StudentPerformance {
  id: string
  name: string
  lrn: string
  grade: string
  section: string
  present: number
  late: number
  absent: number
  excused: number
  totalDays: number
  attendanceRate: number
  punctualityRate: number
}

// Define valid status types
type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'semester' | 'year'>('month')
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalStudents: 0,
    totalAttendance: 0,
    averageDaily: 0,
    peakDay: { date: '', count: 0 },
    lowestDay: { date: '', count: 0 },
    attendanceRate: 0,
    topPerformingSection: { section: '', rate: 0 },
    mostPunctualStudent: { name: '', lrn: '', onTime: 0 }
  })
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [sectionPerformance, setSectionPerformance] = useState<SectionPerformance[]>([])
  const [studentRankings, setStudentRankings] = useState<StudentPerformance[]>([])
  const [selectedMetric, setSelectedMetric] = useState<'attendance' | 'punctuality'>('attendance')
  const [currentPage, setCurrentPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const itemsPerPage = 10

  // Chart colors
  const COLORS = {
    present: '#10b981',
    late: '#f59e0b',
    absent: '#ef4444',
    excused: '#8b5cf6',
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444'
  }

  useEffect(() => {
    fetchAnalyticsData()
  }, [timeframe])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)

      const currentAdmin = getStoredAdminSession()
      const scopedAdmin = currentAdmin?.id ? await fetchAdminById(currentAdmin.id) : currentAdmin
      const assignedStudentIds = await getAssignedStudentIds(scopedAdmin)

      if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        calculateAnalytics([], [])
        calculateTrends([], new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0])
        calculateSectionPerformance([], [])
        calculateStudentRankings([], [])
        return
      }

      // Calculate date range based on timeframe
      const endDate = new Date()
      const startDate = new Date()
      
      switch (timeframe) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'semester':
          startDate.setMonth(startDate.getMonth() - 4)
          break
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
      }

      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      // Fetch all students
      let studentsQuery = supabase
        .from('students')
        .select('id, full_name, lrn, grade, section')
        .eq('is_active', true)

      if (assignedStudentIds !== null) {
        studentsQuery = studentsQuery.in('id', assignedStudentIds)
      }

      const { data: students, error: studentsError } = await studentsQuery

      if (studentsError) throw studentsError

      // Fetch attendance for the period
      let attendanceQuery = supabase
        .from('attendance')
        .select(`
          *,
          students (
            full_name,
            lrn,
            grade,
            section
          )
        `)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true })

      if (assignedStudentIds !== null) {
        attendanceQuery = attendanceQuery.in('student_id', assignedStudentIds)
      }

      const { data: attendance, error: attendanceError } = await attendanceQuery

      if (attendanceError) throw attendanceError

      // Calculate analytics
      calculateAnalytics(students || [], attendance || [])
      calculateTrends(attendance || [], startStr, endStr)
      calculateSectionPerformance(students || [], attendance || [])
      calculateStudentRankings(students || [], attendance || [])

    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateAnalytics = (students: any[], attendance: any[]) => {
    const totalStudents = students.length
    const totalAttendance = attendance.length

    // Calculate average daily attendance
    const uniqueDates = new Set(attendance.map(a => a.date))
    const averageDaily = uniqueDates.size > 0 
      ? Math.round((totalAttendance / uniqueDates.size) * 10) / 10
      : 0

    // Find peak and lowest days
    const dailyCounts: { [key: string]: number } = {}
    attendance.forEach(a => {
      dailyCounts[a.date] = (dailyCounts[a.date] || 0) + 1
    })

    let peakDay = { date: '', count: 0 }
    let lowestDay = { date: '', count: Infinity }

    Object.entries(dailyCounts).forEach(([date, count]) => {
      if (count > peakDay.count) {
        peakDay = { date, count }
      }
      if (count < lowestDay.count) {
        lowestDay = { date, count }
      }
    })

    // Calculate attendance rate (assuming 5 days per week for the period)
    const totalPossibleDays = getTotalPossibleDays(timeframe) * totalStudents
    const attendanceRate = totalPossibleDays > 0 
      ? Math.round((totalAttendance / totalPossibleDays) * 100)
      : 0

    // Find top performing grade
    const sectionStats: { [key: string]: { total: number; present: number } } = {}
    attendance.forEach(a => {
      const section = a.grade || a.students?.grade || ''
      if (!section) return
      if (!sectionStats[section]) {
        sectionStats[section] = { total: 0, present: 0 }
      }
      sectionStats[section].total++
      if (a.status === 'present') {
        sectionStats[section].present++
      }
    })

    let topSection = { section: '', rate: 0 }
    Object.entries(sectionStats).forEach(([section, stats]) => {
      const rate = stats.total > 0 ? (stats.present / stats.total) * 100 : 0
      if (rate > topSection.rate) {
        topSection = { section, rate: Math.round(rate) }
      }
    })

    // Find most punctual student
    const studentPunctuality: { [key: string]: { name: string; lrn: string; onTime: number; total: number } } = {}
    attendance.forEach(a => {
      const studentId = a.student_id
      if (!studentPunctuality[studentId]) {
        studentPunctuality[studentId] = {
          name: a.students?.full_name || 'Unknown',
          lrn: a.students?.lrn || '',
          onTime: 0,
          total: 0
        }
      }
      studentPunctuality[studentId].total++
      if (a.status === 'present') {
        studentPunctuality[studentId].onTime++
      }
    })

    let mostPunctual = { name: '', lrn: '', onTime: 0 }
    Object.values(studentPunctuality).forEach(s => {
      if (s.onTime > mostPunctual.onTime) {
        mostPunctual = s
      }
    })

    setAnalytics({
      totalStudents,
      totalAttendance,
      averageDaily,
      peakDay,
      lowestDay: lowestDay.count === Infinity ? { date: 'N/A', count: 0 } : lowestDay,
      attendanceRate,
      topPerformingSection: topSection,
      mostPunctualStudent: mostPunctual
    })
  }

  const calculateTrends = (attendance: any[], startDate: string, endDate: string) => {
    const dailyData: { [key: string]: TrendData } = {}
    
    // Initialize all dates in range
    const currentDate = new Date(startDate)
    const endDateTime = new Date(endDate)
    
    while (currentDate <= endDateTime) {
      const dateStr = currentDate.toISOString().split('T')[0]
      dailyData[dateStr] = {
        date: dateStr,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        total: 0
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Fill with actual data
    attendance.forEach(a => {
      if (dailyData[a.date]) {
        // Use type assertion since we know the status matches one of the keys
        const status = a.status as AttendanceStatus
        if (status in dailyData[a.date]) {
          // Use type-safe increment
          dailyData[a.date][status] = (dailyData[a.date][status] as number) + 1
          dailyData[a.date].total++
        }
      }
    })

    setTrendData(Object.values(dailyData))
  }

  const calculateSectionPerformance = (students: any[], attendance: any[]) => {
    const sectionMap: { [key: string]: SectionPerformance } = {}

    // Initialize grades
    students.forEach(student => {
      const key = student.grade
      if (!key) return
      if (!sectionMap[key]) {
        sectionMap[key] = {
          section: key,
          totalStudents: 0,
          attendanceCount: 0,
          attendanceRate: 0,
          lateCount: 0,
          absentCount: 0,
          excusedCount: 0
        }
      }
      sectionMap[key].totalStudents++
    })

    // Calculate attendance
    attendance.forEach(a => {
      const gradeKey = a.grade || a.students?.grade
      if (gradeKey && sectionMap[gradeKey]) {
        sectionMap[gradeKey].attendanceCount++
        if (a.status === 'late') sectionMap[gradeKey].lateCount++
        if (a.status === 'absent') sectionMap[gradeKey].absentCount++
        if (a.status === 'excused') sectionMap[gradeKey].excusedCount++
      }
    })

    // Calculate rates
    const totalDays = getTotalPossibleDays(timeframe)
    Object.values(sectionMap).forEach(section => {
      const totalPossibleAttendance = section.totalStudents * totalDays
      section.attendanceRate = totalPossibleAttendance > 0
        ? Math.round((section.attendanceCount / totalPossibleAttendance) * 100)
        : 0
    })

    setSectionPerformance(Object.values(sectionMap))
  }

  const calculateStudentRankings = (students: any[], attendance: any[]) => {
    const studentMap: { [key: string]: StudentPerformance } = {}

    // Initialize students
    students.forEach(student => {
      studentMap[student.id] = {
        id: student.id,
        name: student.full_name,
        lrn: student.lrn,
        grade: student.grade,
        section: student.section,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        totalDays: 0,
        attendanceRate: 0,
        punctualityRate: 0
      }
    })

    // Calculate attendance
    attendance.forEach(a => {
      if (studentMap[a.student_id]) {
        studentMap[a.student_id].totalDays++
        // Use type assertion for status
        const status = a.status as AttendanceStatus
        if (status in studentMap[a.student_id]) {
          // Use type-safe increment
          studentMap[a.student_id][status] = (studentMap[a.student_id][status] as number) + 1
        }
      }
    })

    // Calculate rates
    const totalPossibleDays = getTotalPossibleDays(timeframe)
    Object.values(studentMap).forEach(student => {
      student.attendanceRate = totalPossibleDays > 0
        ? Math.round((student.totalDays / totalPossibleDays) * 100)
        : 0
      student.punctualityRate = student.totalDays > 0
        ? Math.round((student.present / student.totalDays) * 100)
        : 0
    })

    // Sort based on selected metric
    const ranked = Object.values(studentMap).sort((a, b) => {
      if (selectedMetric === 'attendance') {
        return b.attendanceRate - a.attendanceRate
      } else {
        return b.punctualityRate - a.punctualityRate
      }
    })

    setStudentRankings(ranked)
  }

  const getTotalPossibleDays = (timeframe: string): number => {
    switch (timeframe) {
      case 'week': return 5
      case 'month': return 22
      case 'semester': return 88
      case 'year': return 220
      default: return 22
    }
  }

  const handleExportAnalytics = () => {
    setExporting(true)
    
    // Create CSV content
    const headers = ['Metric', 'Value']
    const rows = [
      ['Total Students', analytics.totalStudents],
      ['Total Attendance', analytics.totalAttendance],
      ['Average Daily Attendance', analytics.averageDaily],
      ['Peak Day', `${analytics.peakDay.date} (${analytics.peakDay.count} students)`],
      ['Lowest Day', `${analytics.lowestDay.date} (${analytics.lowestDay.count} students)`],
      ['Overall Attendance Rate', `${analytics.attendanceRate}%`],
      ['Top Performing Grade', `${analytics.topPerformingSection.section} (${analytics.topPerformingSection.rate}%)`],
      ['Most Punctual Student', `${analytics.mostPunctualStudent.name} (${analytics.mostPunctualStudent.onTime} on-time)`]
    ]

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics_${timeframe}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()

    setTimeout(() => setExporting(false), 1000)
  }

  // Pagination for student rankings
  const totalPages = Math.ceil(studentRankings.length / itemsPerPage)
  const paginatedRankings = studentRankings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-28 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h1>
          <p className="text-gray-600">Advanced insights and statistics about attendance patterns</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="semester">This Semester</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={fetchAnalyticsData}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleExportAnalytics}
            disabled={exporting}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-500" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{analytics.totalStudents}</p>
          <p className="text-sm text-gray-600 mt-1">Active Students</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 text-green-500" />
            <span className="text-sm text-gray-500">Period</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{analytics.totalAttendance}</p>
          <p className="text-sm text-gray-600 mt-1">Total Attendance Records</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-purple-500" />
            <span className="text-sm text-gray-500">Average</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{analytics.averageDaily}</p>
          <p className="text-sm text-gray-600 mt-1">Daily Attendance</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 text-amber-500" />
            <span className="text-sm text-gray-500">Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{analytics.attendanceRate}%</p>
          <p className="text-sm text-gray-600 mt-1">Overall Attendance Rate</p>
        </div>
      </div>

      {/* Peak/Low Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-linear-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8" />
            <span className="text-green-100">Peak Day</span>
          </div>
          <p className="text-2xl font-bold">{analytics.peakDay.date || 'N/A'}</p>
          <p className="text-green-100 mt-1">{analytics.peakDay.count} students present</p>
        </div>

        <div className="bg-linear-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-8 h-8" />
            <span className="text-red-100">Lowest Day</span>
          </div>
          <p className="text-2xl font-bold">{analytics.lowestDay.date || 'N/A'}</p>
          <p className="text-red-100 mt-1">{analytics.lowestDay.count} students present</p>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Top Performing Grade
          </h2>
          {analytics.topPerformingSection.section ? (
            <div className="text-center py-6">
              <div className="text-5xl font-bold text-blue-600 mb-2">
                {analytics.topPerformingSection.rate}%
              </div>
              <p className="text-xl font-medium text-gray-800">
                Grade {analytics.topPerformingSection.section}
              </p>
              <p className="text-gray-500 mt-2">Highest attendance rate</p>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-6">No data available</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Most Punctual Student
          </h2>
          {analytics.mostPunctualStudent.name ? (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-linear-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-xl font-medium text-gray-800">
                {analytics.mostPunctualStudent.name}
              </p>
              <p className="text-gray-500 mt-1">LRN: {analytics.mostPunctualStudent.lrn}</p>
              <p className="text-green-600 font-medium mt-2">
                {analytics.mostPunctualStudent.onTime} on-time arrivals
              </p>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-6">No data available</p>
          )}
        </div>
      </div>

      {/* Attendance Trend Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <LineChart className="w-5 h-5 text-blue-500" />
          Daily Attendance Trend
        </h2>
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="present" fill={COLORS.present} stroke={COLORS.present} fillOpacity={0.3} />
              <Area type="monotone" dataKey="late" fill={COLORS.late} stroke={COLORS.late} fillOpacity={0.3} />
              <Area type="monotone" dataKey="absent" fill={COLORS.absent} stroke={COLORS.absent} fillOpacity={0.3} />
              <Area type="monotone" dataKey="excused" fill={COLORS.excused} stroke={COLORS.excused} fillOpacity={0.3} />
              <Line type="monotone" dataKey="total" stroke={COLORS.primary} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grade Performance Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-500" />
          Grade Performance
        </h2>
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ReBarChart data={sectionPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="section" />
              <YAxis yAxisId="left" orientation="left" stroke={COLORS.primary} />
              <YAxis yAxisId="right" orientation="right" stroke={COLORS.secondary} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="attendanceCount" name="Attendance Count" fill={COLORS.primary} />
              <Bar yAxisId="right" dataKey="attendanceRate" name="Attendance Rate (%)" fill={COLORS.secondary} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Student Rankings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-pink-500" />
              Student Performance Rankings
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedMetric('attendance')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedMetric === 'attendance'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Attendance Rate
              </button>
              <button
                onClick={() => setSelectedMetric('punctuality')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedMetric === 'punctuality'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Punctuality Rate
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LRN
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Present
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Late
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Absent
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedRankings.map((student, index) => (
                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <p className="font-medium text-gray-900">{student.name}</p>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.lrn}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      Grade {student.grade}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {student.present}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                    {student.late}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                    {student.absent}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      (selectedMetric === 'attendance' ? student.attendanceRate : student.punctualityRate) >= 90
                        ? 'bg-green-100 text-green-700'
                        : (selectedMetric === 'attendance' ? student.attendanceRate : student.punctualityRate) >= 75
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {selectedMetric === 'attendance' ? student.attendanceRate : student.punctualityRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {studentRankings.length > 0 && (
          <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2 sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, studentRankings.length)} of {studentRankings.length} students
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 bg-blue-600 text-white rounded-lg">
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
    </div>
  )
}