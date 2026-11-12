'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { SuperAdminService } from '../../../../lib/super-admin'
import {
  Download,
  Calendar,
  Users,
  UserCog,
  TrendingUp,
  CheckCircle,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart,
  Printer,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Award,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import {
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
  AreaChart,
  Area
} from 'recharts'
import * as XLSX from 'xlsx'

interface ReportData {
  totalStudents: number
  totalTeachers: number
  totalAttendance: number
  presentCount: number
  lateCount: number
  absentCount: number
  attendanceRate: number
  gradeBreakdown: Record<string, number>
  teacherBreakdown: Record<string, { present: number; late: number; absent: number }>
  dateRange: { startDate?: string; endDate?: string }
}

interface DailyTrend {
  date: string
  present: number
  late: number
  absent: number
  total: number
}

interface TeacherPerformance {
  teacher_name: string
  total_sessions: number
  present: number
  late: number
  absent: number
  attendance_rate: number
}

interface AtRiskStudent {
  student_id: string
  student_name: string
  lrn: string
  grade: string
  section: string
  absent_count: number
  late_count: number
  total_days: number
  attendance_rate: number
  risk_level: 'high' | 'medium' | 'low'
}

interface AttendanceStatusRow {
  date: string
  status: 'present' | 'late' | 'absent'
}

interface TeacherAttendanceRow {
  teacher_name: string
  status: 'present' | 'late' | 'absent'
}

// ✅ Added time_in and separated first/last names to match Admin page logic
interface StudentAttendanceRow {
  student_id: string | null
  date: string
  time_in: string
  status: 'present' | 'late' | 'absent'
  students:
    | {
        full_name: string
        first_name?: string
        last_name?: string
        lrn: string
        grade: string
        section: string
        sex?: string | null
      }
    | Array<{
        full_name: string
        first_name?: string
        last_name?: string
        lrn: string
        grade: string
        section: string
        sex?: string | null
      }>
    | null
}

// SF2 types
type Sf2DateColumn = {
  date: string
  dayNumber: string
  weekday: string
}

type Sf2LearnerRow = {
  student_id: string
  student_name: string
  lrn: string
  sex: string
  grade: string
  section: string
  attendanceByDate: Record<string, string>
  presentCount: number
  lateCount: number
  absentCount: number
  teacherNames: string[]
}

type Sf2SectionGroup = {
  grade: string
  section: string
  dates: Sf2DateColumn[]
  learners: Sf2LearnerRow[]
  maleLearners: Sf2LearnerRow[]
  femaleLearners: Sf2LearnerRow[]
  unknownLearners: Sf2LearnerRow[]
  presentCount: number
  lateCount: number
  absentCount: number
  totalCount: number
}

export default function SuperAdminReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([])
  const [teacherPerformance, setTeacherPerformance] = useState<TeacherPerformance[]>([])
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([])
  
  // Filters
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [selectedSection, setSelectedSection] = useState('all')
  
  // UI States
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(true)
  
  const itemsPerPage = 10

  useEffect(() => {
    const checkAuth = () => {
      const session = sessionStorage.getItem('super_admin_session')
      if (!session) {
        router.push('/super-admin/login')
        return
      }
      fetchReportData()
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    fetchReportData()
  }, [dateRange, selectedGrade, selectedSection])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      
      // Get overall report
      const overall = await SuperAdminService.getOverallReport(dateRange.start, dateRange.end)
      setReportData(overall)

      // Fetch daily trend
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('date, status')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: true })

      // Calculate daily trend
      const dailyMap = new Map<string, DailyTrend>()
      attendanceData?.forEach((record: AttendanceStatusRow) => {
        if (!dailyMap.has(record.date)) {
          dailyMap.set(record.date, {
            date: record.date,
            present: 0,
            late: 0,
            absent: 0,
            total: 0
          })
        }
        const day = dailyMap.get(record.date)!
        if (record.status === 'present') day.present++
        else if (record.status === 'late') day.late++
        else if (record.status === 'absent') day.absent++
        day.total++
      })
      setDailyTrend(Array.from(dailyMap.values()))

      // Fetch teacher performance
      const { data: teacherAttendance } = await supabase
        .from('attendance')
        .select('teacher_name, status')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)

      const teacherMap = new Map<string, { present: number; late: number; absent: number; total: number }>()
      teacherAttendance?.forEach((record: TeacherAttendanceRow) => {
        if (!teacherMap.has(record.teacher_name)) {
          teacherMap.set(record.teacher_name, { present: 0, late: 0, absent: 0, total: 0 })
        }
        const stats = teacherMap.get(record.teacher_name)!
        if (record.status === 'present') stats.present++
        else if (record.status === 'late') stats.late++
        else if (record.status === 'absent') stats.absent++
        stats.total++
      })

      const teacherPerf: TeacherPerformance[] = []
      teacherMap.forEach((stats, name) => {
        teacherPerf.push({
          teacher_name: name,
          total_sessions: stats.total,
          present: stats.present,
          late: stats.late,
          absent: stats.absent,
          attendance_rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
        })
      })
      setTeacherPerformance(teacherPerf.sort((a, b) => b.attendance_rate - a.attendance_rate))

      // Fetch at-risk students — ✅ ADDED time_in to match Admin logic
      const { data: studentAttendance } = await supabase
        .from('attendance')
        .select(`
          student_id,
          status,
          date,
          time_in,
          students:student_id (
            full_name,
            lrn,
            grade,
            section
          )
        `)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)

      const studentMap = new Map<string, { name: string; lrn: string; grade: string; section: string; absent: number; late: number; total: number }>()
      studentAttendance?.forEach((record: StudentAttendanceRow) => {
        if (!record.student_id) return
        const student = Array.isArray(record.students) ? record.students[0] : record.students
        if (!studentMap.has(record.student_id)) {
          studentMap.set(record.student_id, {
            name: student?.full_name || 'Unknown',
            lrn: student?.lrn || '',
            grade: student?.grade || '',
            section: student?.section || '',
            absent: 0,
            late: 0,
            total: 0
          })
        }
        const stats = studentMap.get(record.student_id)!
        if (record.status === 'absent') stats.absent++
        else if (record.status === 'late') stats.late++
        stats.total++
      })

      const totalDays = getTotalDaysInRange()
      const atRisk: AtRiskStudent[] = []
      studentMap.forEach((stats, id) => {
        const attendanceRate = stats.total > 0 ? Math.round((stats.total / totalDays) * 100) : 0
        let riskLevel: 'high' | 'medium' | 'low' = 'low'
        
        if (stats.absent >= 5 || attendanceRate < 70) riskLevel = 'high'
        else if (stats.absent >= 3 || attendanceRate < 85) riskLevel = 'medium'
        
        if (riskLevel !== 'low') {
          atRisk.push({
            student_id: id,
            student_name: stats.name,
            lrn: stats.lrn,
            grade: stats.grade,
            section: stats.section,
            absent_count: stats.absent,
            late_count: stats.late,
            total_days: stats.total,
            attendance_rate: attendanceRate,
            risk_level: riskLevel
          })
        }
      })
      setAtRiskStudents(atRisk.sort((a, b) => b.absent_count - a.absent_count))

    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTotalDaysInRange = (): number => {
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    // Assuming 5 school days per week
    return Math.ceil(diffDays * (5/7))
  }

  // ============================================================
  // SF2 HELPERS
  // ============================================================

  const attendanceCodeMap: Record<string, string> = {
    present: 'P',
    late: 'L',
    absent: 'A'
  }

  const getStatusCode = (status: string) =>
    attendanceCodeMap[status] ?? status?.charAt(0)?.toUpperCase() ?? ''

  const normalizeSex = (sex?: string | null) => {
    const normalized = (sex || '').trim().toLowerCase()
    if (normalized === 'male' || normalized === 'm') return 'Male'
    if (normalized === 'female' || normalized === 'f') return 'Female'
    return ''
  }

  const getDateColumns = (startDate: string, endDate: string): Sf2DateColumn[] => {
    const dates: Sf2DateColumn[] = []
    const current = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T00:00:00`)
    const weekLabels = ['SU', 'M', 'T', 'W', 'TH', 'F', 'SA']

    const formatKey = (d: Date) => {
      const y = d.getFullYear()
      const m = `${d.getMonth() + 1}`.padStart(2, '0')
      const day = `${d.getDate()}`.padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    while (current <= end) {
      dates.push({
        date: formatKey(current),
        dayNumber: current.getDate().toString(),
        weekday: weekLabels[current.getDay()]
      })
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  const formatReportMonthLabel = (startDate: string, endDate: string) => {
    const start = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T00:00:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return `${startDate} to ${endDate}`
    }
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    if (sameMonth) {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const getSchoolYearLabel = (startDate: string) => {
    const start = new Date(`${startDate}T00:00:00`)
    if (Number.isNaN(start.getTime())) return ''
    const year = start.getMonth() >= 5 ? start.getFullYear() : start.getFullYear() - 1
    return `${year}-${year + 1}`
  }

  // ✅ Added helper to parse time_in for duplicate resolution
  const parseTimeInHeconds = (time: string) => {
    const parts = time.split(':').map(Number)
    if (parts.length !== 3) return 0
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  // ✅ Added formatLearnerName to match Admin logic (LASTNAME, Firstname)
  const formatLearnerName = (record: StudentAttendanceRow) => {
    const student = Array.isArray(record.students) ? record.students[0] : record.students
    if (!student) return 'UNKNOWN'
    
    const firstName = student.first_name?.trim() || ''
    const lastName = student.last_name?.trim() || ''
    const fullName = student.full_name?.trim() || ''

    if (firstName || lastName) {
      return [lastName, firstName].filter(Boolean).join(', ').toUpperCase()
    }

    return fullName.toUpperCase()
  }

  const buildSf2Sections = (data: StudentAttendanceRow[]): Sf2SectionGroup[] => {
    const dates = getDateColumns(dateRange.start, dateRange.end)
    const sectionMap = new Map<string, Map<string, {
      student: Sf2LearnerRow
      latestByDate: Map<string, { status: string; timeSeconds: number }>
    }>>()

    const getSectionKey = (record: StudentAttendanceRow) => {
      const student = Array.isArray(record.students) ? record.students[0] : record.students
      const grade = student?.grade || 'N/A'
      const section = (student?.section || 'UNASSIGNED').trim() || 'UNASSIGNED'
      return `${grade}||${section}`
    }

    data.forEach(record => {
      const student = Array.isArray(record.students) ? record.students[0] : record.students
      if (!record.student_id || !student) return

      const sectionKey = getSectionKey(record)
      if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, new Map())

      const learners = sectionMap.get(sectionKey)!
      const sex = normalizeSex(student.sex)
      const existing = learners.get(record.student_id)
      const latestByDate = existing?.latestByDate || new Map<string, { status: string; timeSeconds: number }>()

      if (!existing) {
        learners.set(record.student_id, {
          student: {
            student_id: record.student_id,
            student_name: formatLearnerName(record), // ✅ Uses Admin name format
            lrn: student.lrn || '',
            sex,
            grade: student.grade || 'N/A',
            section: student.section || 'UNASSIGNED',
            attendanceByDate: {},
            presentCount: 0,
            lateCount: 0,
            absentCount: 0,
            teacherNames: []
          },
          latestByDate
        })
      }

      const learnerEntry = learners.get(record.student_id)!
      
      // ✅ Uses Admin duplicate resolution logic (latest time_in wins)
      const timeSeconds = parseTimeInHeconds(record.time_in || '00:00:00')
      const currentEntry = learnerEntry.latestByDate.get(record.date)

      if (!currentEntry || timeSeconds >= currentEntry.timeSeconds) {
        learnerEntry.latestByDate.set(record.date, {
          status: record.status,
          timeSeconds
        })
      }
    })

    return Array.from(sectionMap.entries()).map(([sectionKey, learners]) => {
      const [grade, section] = sectionKey.split('||')

      const learnerRows = Array.from(learners.values()).map(({ student, latestByDate }) => {
        const attendanceByDate: Record<string, string> = {}
        let presentCount = 0, lateCount = 0, absentCount = 0

        dates.forEach(dateColumn => {
          const entry = latestByDate.get(dateColumn.date)
          if (entry && entry.status) {
            const code = getStatusCode(entry.status)
            attendanceByDate[dateColumn.date] = code
            if (entry.status === 'present') presentCount += 1
            else if (entry.status === 'late') lateCount += 1
            else if (entry.status === 'absent') absentCount += 1
          }
        })

        return { ...student, attendanceByDate, presentCount, lateCount, absentCount }
      })

      learnerRows.sort((a, b) => a.student_name.localeCompare(b.student_name))

      const maleLearners = learnerRows.filter(l => l.sex === 'Male')
      const femaleLearners = learnerRows.filter(l => l.sex === 'Female')
      const unknownLearners = learnerRows.filter(l => !l.sex)

      const presentCount = learnerRows.reduce((s, l) => s + l.presentCount, 0)
      const lateCount = learnerRows.reduce((s, l) => s + l.lateCount, 0)
      const absentCount = learnerRows.reduce((s, l) => s + l.absentCount, 0)

      return {
        grade, section, dates,
        learners: learnerRows,
        maleLearners, femaleLearners, unknownLearners,
        presentCount, lateCount, absentCount,
        totalCount: learnerRows.length
      }
    }).sort((a, b) => {
      const gc = a.grade.localeCompare(b.grade, undefined, { numeric: true, sensitivity: 'base' })
      if (gc !== 0) return gc
      return a.section.localeCompare(b.section)
    })
  }

  // ============================================================
  // PDF EXPORT — SF2 format (section only, no adviser)
  // ============================================================
  const handleExportPDF = async () => {
    try {
      setExporting(true)

      // ✅ Added time_in and first/last names to select
      const { data: studentAttendance, error } = await supabase
        .from('attendance')
        .select(`
          student_id,
          status,
          date,
          time_in,
          students:student_id (
            full_name,
            first_name,
            last_name,
            lrn,
            grade,
            section,
            sex
          )
        `)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)

      if (error) throw error
      if (!studentAttendance || studentAttendance.length === 0) {
        alert('No attendance data available for the selected period.')
        return
      }

      // Apply grade/section filters
      let filtered = studentAttendance as StudentAttendanceRow[]
      if (selectedGrade !== 'all') {
        filtered = filtered.filter(r => {
          const s = Array.isArray(r.students) ? r.students[0] : r.students
          return s?.grade === selectedGrade
        })
      }
      if (selectedSection !== 'all') {
        filtered = filtered.filter(r => {
          const s = Array.isArray(r.students) ? r.students[0] : r.students
          return s?.section === selectedSection
        })
      }

      const sf2Sections = buildSf2Sections(filtered)
      if (!sf2Sections.length) {
        alert('No attendance data available for the selected filters.')
        return
      }

      // Dynamic imports to avoid SSR bundling issues
      const jspdfModule = await import('jspdf')
      const { jsPDF } = jspdfModule as any
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = (autoTableModule && (autoTableModule as any).default) || autoTableModule

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' })
      const reportMonthLabel = formatReportMonthLabel(dateRange.start, dateRange.end)
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const marginX = 6
      const tableTop = 40
      const footerReserve = 50
      const footerTop = pageHeight - footerReserve - 6

      // Try to load school logo (optional, won't fail export)
      let schoolLogo: string | null = null
      try {
        const response = await fetch('/logo.png')
        if (response.ok) {
          const blob = await response.blob()
          schoolLogo = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error('Unable to read logo'))
            reader.readAsDataURL(blob)
          })
        }
      } catch {
        schoolLogo = null
      }

      for (let i = 0; i < sf2Sections.length; i++) {
        const group = sf2Sections[i]
        if (i > 0) doc.addPage()

        const weekdaySet = new Set(['M', 'T', 'W', 'TH', 'F'])
        const dateHeaders: any[] = []

        // Pad weekday columns so Mon..Fri always appear
        const firstDateStr = group.dates?.[0]?.date
        if (firstDateStr) {
          const firstDate = new Date(`${firstDateStr}T00:00:00`)
          const firstDay = firstDate.getDay()
          const weekLabels = ['SU', 'M', 'T', 'W', 'TH', 'F', 'SA']
          for (let w = 1; w < firstDay; w++) {
            if (w >= 1 && w <= 5) {
              dateHeaders.push({
                date: `__placeholder_${firstDateStr}_${w}`,
                dayNumber: '',
                weekday: weekLabels[w],
                label: weekLabels[w]
              })
            }
          }
        }

        group.dates.forEach(dc => {
          if (weekdaySet.has(dc.weekday)) {
            dateHeaders.push({ ...dc, label: dc.weekday })
          }
        })

        const buildTableBody = (learners: Sf2LearnerRow[], startIdx: number) => {
          const body: any[] = []
          learners.forEach((learner, idx) => {
            body.push([
              (startIdx + idx + 1).toString(),
              learner.student_name,
              ...dateHeaders.map(dc => {
                const code = learner.attendanceByDate[dc.date] || ''
                return code === 'P' ? 'P' : code === 'A' ? 'A' : code === 'L' ? 'L' : ''
              }),
              learner.absentCount.toString(),
              (learner.presentCount + learner.lateCount).toString(),
              learner.lrn ? `LRN ${learner.lrn}` : ''
            ])
          })
          return body
        }

        const calculateDailyTotals = (learners: Sf2LearnerRow[]) =>
          dateHeaders.map(dc =>
            learners.reduce((count, l) =>
              count + (l.attendanceByDate[dc.date] === 'P' ? 1 : 0), 0
            ).toString()
          )

        const completeBody: any[] = []
        let learnerStartIndex = 0

        const appendLearnerGroup = (label: string, learners: Sf2LearnerRow[]) => {
          if (!learners.length) return
          completeBody.push([
            { content: `${label} LEARNERS`, colSpan: 5 + dateHeaders.length, styles: { halign: 'left', fontStyle: 'bold', fillColor: [226, 232, 240] } }
          ])
          buildTableBody(learners, learnerStartIndex).forEach(row => completeBody.push(row))
          learnerStartIndex += learners.length
          const subtotalRow: any[] = [
            '',
            `${label} TOTAL PER DAY`,
            ...calculateDailyTotals(learners),
            learners.reduce((t, l) => t + l.absentCount, 0).toString(),
            learners.reduce((t, l) => t + l.presentCount + l.lateCount, 0).toString(),
            ''
          ]
          completeBody.push(subtotalRow)
          completeBody.push([{ content: '', colSpan: 5 + dateHeaders.length, styles: { fillColor: [248, 250, 252] } }])
        }

        appendLearnerGroup('MALE', group.maleLearners)
        appendLearnerGroup('FEMALE', group.femaleLearners)
        appendLearnerGroup('UNSPECIFIED', group.unknownLearners)

        completeBody.push([
          '',
          'COMBINED TOTAL PER DAY',
          ...calculateDailyTotals(group.learners),
          group.absentCount.toString(),
          (group.presentCount + group.lateCount).toString(),
          ''
        ])

        const rowCount = completeBody.length
        const compactMode = rowCount > 38
        const tableFontSize = compactMode ? 4.5 : rowCount > 30 ? 4.8 : 5.2
        const tablePadding = compactMode ? 0.45 : rowCount > 30 ? 0.55 : 0.75
        const learnerWidth = compactMode ? 42 : 46
        const remarksWidth = compactMode ? 18 : 22
        const dateCellWidth = Math.max(5.2, Math.min(6.6,
          (pageWidth - (marginX * 2) - 6 - learnerWidth - 10 - 10 - remarksWidth) / Math.max(dateHeaders.length, 1)
        ))

        // === HEADER ===
        if (schoolLogo) {
          try { doc.addImage(schoolLogo, 'PNG', marginX, 5, 14, 14) } catch {}
        }

        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.text(process.env.NEXT_PUBLIC_SCHOOL_NAME || 'Saint Anne Academy', pageWidth / 2, 9, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text('School Form 2 (SF2) Daily Attendance Report of Learners', pageWidth / 2, 14, { align: 'center' })
        doc.setFontSize(7.5)
        doc.text('Official SF2-style attendance layout generated from the selected filters', pageWidth / 2, 18, { align: 'center' })

        doc.setDrawColor(0, 0, 0)
        doc.setLineWidth(0.15)
        doc.rect(marginX, 22.5, pageWidth - marginX * 2, 13)
        doc.line(pageWidth / 2, 22.5, pageWidth / 2, 35.5)
        doc.line(marginX, 29, pageWidth - marginX, 29)

        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.text('School Name:', marginX + 2, 26)
        doc.text('School Year:', pageWidth / 2 + 2, 26)
        doc.text('Grade Level:', marginX + 2, 32.5)
        doc.text('Section:', pageWidth / 2 + 2, 32.5) // ✅ Was "Section / Adviser:"

        doc.setFont('helvetica', 'normal')
        doc.text(process.env.NEXT_PUBLIC_SCHOOL_NAME || 'Saint Anne Academy', marginX + 32, 26)
        doc.text(getSchoolYearLabel(dateRange.start) || '________________', pageWidth / 2 + 32, 26)
        doc.text(`Grade ${group.grade}`, marginX + 32, 32.5)
        doc.text(group.section, pageWidth / 2 + 42, 32.5, { // ✅ Was `${group.section} / ${group.adviser}`
          maxWidth: (pageWidth / 2) - 45
        })

        // === TABLE ===
        const tableOptions: any = {
          startY: tableTop,
          head: [[
            'No.',
            "Learner's Name",
            ...dateHeaders.map((dc: any) => dc.label),
            'ABSENT',
            'PRESENT',
            'REMARKS'
          ]],
          body: completeBody,
          theme: 'grid',
          pageBreak: 'avoid',
          rowPageBreak: 'avoid',
          tableWidth: 'auto',
          styles: {
            fontSize: tableFontSize,
            cellPadding: tablePadding,
            valign: 'middle',
            lineColor: [0, 0, 0],
            lineWidth: 0.1
          },
          headStyles: {
            fillColor: [226, 232, 240],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle'
          },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: learnerWidth, halign: 'left' },
            ...Object.fromEntries(dateHeaders.map((_: any, idx: number) => [idx + 2, { cellWidth: dateCellWidth, halign: 'center' }])),
            [dateHeaders.length + 2]: { cellWidth: 10, halign: 'center' },
            [dateHeaders.length + 3]: { cellWidth: 10, halign: 'center' },
            [dateHeaders.length + 4]: { cellWidth: remarksWidth, halign: 'left' }
          },
          margin: { left: marginX, right: marginX, top: tableTop, bottom: footerReserve },
          didParseCell: (data: any) => {
            const rawRow = data.row.raw as any
            if (Array.isArray(rawRow) && rawRow[0]?.content?.includes('LEARNERS')) {
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.fillColor = [59, 130, 246]
              data.cell.styles.textColor = [255, 255, 255]
            }
            if (Array.isArray(rawRow) && rawRow[1]?.content?.includes('TOTAL PER DAY')) {
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.fillColor = [241, 245, 249]
            }
          }
        }

        autoTable(doc, tableOptions)

        // === FOOTER ===
        doc.setDrawColor(0, 0, 0)
        doc.setLineWidth(0.15)
        doc.rect(marginX, footerTop, pageWidth - marginX * 2, 40)

        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('ATTENDANCE CODES / SUMMARY', marginX + 2, footerTop + 6)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(
          `Learners: ${group.totalCount}  |  Present / On Time: ${group.presentCount}  |  Late: ${group.lateCount}  |  Absent: ${group.absentCount}`,
          marginX + 2, footerTop + 12
        )
        doc.text(`Report Month: ${reportMonthLabel}`, marginX + 2, footerTop + 17)

        doc.setFont('helvetica', 'bold')
        doc.text('P - Present', pageWidth / 2 - 30, footerTop + 12)
        doc.setFont('helvetica', 'normal')
        doc.text('L - Late', pageWidth / 2 - 30, footerTop + 17)
        doc.text('A - Absent', pageWidth / 2 - 30, footerTop + 22)

        doc.setFont('helvetica', 'bold')
        doc.text('Guidelines:', marginX + 2, footerTop + 22)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.8)
        doc.text('1. Mark only one code per learner per date.', marginX + 2, footerTop + 27, { maxWidth: (pageWidth / 2) - 12 })
        doc.text('2. Use the final daily status for the day.', marginX + 2, footerTop + 32, { maxWidth: (pageWidth / 2) - 12 })

        doc.setFont('helvetica', 'bold')
        doc.text('Certified true and correct:', pageWidth - marginX - 2, footerTop + 6, { align: 'right' }) // ✅ removed "by the adviser"
        doc.setFont('helvetica', 'normal')
        doc.line(pageWidth - 90, footerTop + 18, pageWidth - 10, footerTop + 18)
        doc.text('Signature over Printed Name', pageWidth - 50, footerTop + 22, { align: 'center' })

        doc.setFontSize(6)
        doc.setTextColor(100, 100, 100)
        doc.text('Generated by EduScan — Super Admin Reports', pageWidth / 2, pageHeight - 4, { align: 'center' })
      }

      doc.save(`SF2_SCHOOL_REPORT_${dateRange.start}_to_${dateRange.end}.pdf`)
    } catch (error) {
      console.error('Error exporting SF2 PDF:', error)
      alert('Failed to generate SF2 PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleExportExcel = () => {
    try {
      setExporting(true)
      const workbook = XLSX.utils.book_new()
      
      // Summary Sheet
      const summarySheet = XLSX.utils.json_to_sheet([{
        'Report Period': `${dateRange.start} to ${dateRange.end}`,
        'Generated On': new Date().toLocaleString(),
        'Total Students': reportData?.totalStudents || 0,
        'Total Teachers': reportData?.totalTeachers || 0,
        'Total Attendance': reportData?.totalAttendance || 0,
        'Present': reportData?.presentCount || 0,
        'Late': reportData?.lateCount || 0,
        'Absent': reportData?.absentCount || 0,
        'Attendance Rate': `${reportData?.attendanceRate || 0}%`
      }])
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
      
      // Teacher Performance Sheet
      const teacherSheet = XLSX.utils.json_to_sheet(teacherPerformance.map(t => ({
        'Teacher': t.teacher_name,
        'Total Sessions': t.total_sessions,
        'Present': t.present,
        'Late': t.late,
        'Absent': t.absent,
        'Attendance Rate': `${t.attendance_rate}%`
      })))
      XLSX.utils.book_append_sheet(workbook, teacherSheet, 'Teacher Performance')
      
      // At-Risk Students Sheet
      const riskSheet = XLSX.utils.json_to_sheet(atRiskStudents.map(s => ({
        'Student Name': s.student_name,
        'LRN': s.lrn,
        'Grade': s.grade,
        'Section': s.section,
        'Absent Days': s.absent_count,
        'Late Days': s.late_count,
        'Attendance Rate': `${s.attendance_rate}%`,
        'Risk Level': s.risk_level.toUpperCase()
      })))
      XLSX.utils.book_append_sheet(workbook, riskSheet, 'At-Risk Students')
      
      // Daily Trend Sheet
      const trendSheet = XLSX.utils.json_to_sheet(dailyTrend.map(d => ({
        'Date': d.date,
        'Present': d.present,
        'Late': d.late,
        'Absent': d.absent,
        'Total': d.total
      })))
      XLSX.utils.book_append_sheet(workbook, trendSheet, 'Daily Trend')
      
      XLSX.writeFile(workbook, `school_report_${dateRange.start}_to_${dateRange.end}.xlsx`)
    } catch (error) {
      console.error('Error exporting Excel:', error)
    } finally {
      setExporting(false)
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default: return 'bg-green-100 text-green-700 border-green-200'
    }
  }

  const pieData = reportData ? [
    { name: 'Present', value: reportData.presentCount, color: '#10b981' },
    { name: 'Late', value: reportData.lateCount, color: '#f59e0b' },
    { name: 'Absent', value: reportData.absentCount, color: '#ef4444' }
  ].filter(item => item.value > 0) : []

  const gradeChartData = reportData ? Object.entries(reportData.gradeBreakdown).map(([grade, count]) => ({
    grade,
    count
  })) : []

  const totalPages = Math.ceil(atRiskStudents.length / itemsPerPage)
  const paginatedRisk = atRiskStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Generating reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">School Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive attendance analytics and insights</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            PDF Report
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Excel Report
          </button>
          <button
            onClick={fetchReportData}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-700">Report Period</h2>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
        
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Grades</option>
                {[11, 12].map(g => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">SHS Only</option>
                {['A', 'B', 'C', 'D', 'E', 'F'].map(s => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-800">{reportData?.totalStudents || 0}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Teachers</p>
              <p className="text-2xl font-bold text-gray-800">{reportData?.totalTeachers || 0}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Attendance Rate</p>
              <p className="text-2xl font-bold text-gray-800">{reportData?.attendanceRate || 0}%</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">At-Risk Students</p>
              <p className="text-2xl font-bold text-red-600">{atRiskStudents.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <LineChart className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Daily Attendance Trend</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="present" fill="#10b981" stroke="#10b981" fillOpacity={0.3} />
                <Area type="monotone" dataKey="late" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.3} />
                <Area type="monotone" dataKey="absent" fill="#ef4444" stroke="#ef4444" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <PieChartIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Attendance Distribution</h2>
          </div>
          <div className="h-80">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grade Breakdown */}
      {gradeChartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-800">Attendance by Grade</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={gradeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Teacher Performance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-800">Teacher Performance Ranking</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Teacher</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Sessions</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Present</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Late</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Absent</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teacherPerformance.slice(0, 10).map((teacher, index) => (
                <tr key={teacher.teacher_name} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-800">{teacher.teacher_name}</td>
                  <td className="px-6 py-4 text-gray-600">{teacher.total_sessions}</td>
                  <td className="px-6 py-4 text-green-600 font-medium">{teacher.present}</td>
                  <td className="px-6 py-4 text-yellow-600 font-medium">{teacher.late}</td>
                  <td className="px-6 py-4 text-red-600 font-medium">{teacher.absent}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            teacher.attendance_rate >= 90 ? 'bg-green-500' :
                            teacher.attendance_rate >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${teacher.attendance_rate}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{teacher.attendance_rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* At-Risk Students */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-800">At-Risk Students</h2>
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
              {atRiskStudents.length} students
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Students with attendance below 85% or 3+ absences</p>
        </div>

        {atRiskStudents.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">LRN</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Absent</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Late</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedRisk.map((student) => (
                    <tr key={student.student_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-800">{student.student_name}</p>
                          <p className="text-xs text-gray-500">ID: {student.student_id.slice(0, 8)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm">{student.lrn}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 rounded-lg text-sm">
                          G{student.grade}-{student.section}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-red-600 font-medium">{student.absent_count}</td>
                      <td className="px-6 py-4 text-yellow-600 font-medium">{student.late_count}</td>
                      <td className="px-6 py-4">
                        <span className={`font-medium ${student.attendance_rate < 70 ? 'text-red-600' : 'text-yellow-600'}`}>
                          {student.attendance_rate}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(student.risk_level)}`}>
                          {student.risk_level.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, atRiskStudents.length)} of{' '}
                  {atRiskStudents.length} at-risk students
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="text-gray-500">No at-risk students detected in this period</p>
            <p className="text-sm text-gray-400 mt-1">Great job! All students have good attendance.</p>
          </div>
        )}
      </div>
    </div>
  )
}
