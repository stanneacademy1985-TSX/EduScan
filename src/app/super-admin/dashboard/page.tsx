'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { SuperAdminService } from '../../../../lib/super-admin'
import {
  Users,
  UserCog,
  Calendar,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  School,
  BookOpen,
  FileText,
  PieChart as PieChartIcon
} from 'lucide-react'
import {
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
  Area,
  BarChart as ReBarChart,
  Bar
} from 'recharts'

interface DashboardStats {
  totalStudents: number
  totalTeachers: number
  totalAttendance: number
  presentCount: number
  lateCount: number
  absentCount: number
  attendanceRate: number
  gradeBreakdown: Record<string, number>
  teacherBreakdown: Record<string, { present: number; late: number; absent: number }>
}

interface SessionUser {
  id: string
  email: string
  full_name: string
  role: string
}

interface RecentActivityItem {
  id: string
  date: string
  time_in: string | null
  status: 'present' | 'late' | 'absent'
  section: string
  students: {
    full_name?: string
    lrn?: string
    grade?: string
  } | null
}

interface AttendanceTrendPoint {
  date: string
  present: number
  late: number
  absent: number
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([])
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceTrendPoint[]>([])
  const [admin, setAdmin] = useState<SessionUser | null>(null)

  useEffect(() => {
    const checkAuth = () => {
      const session = sessionStorage.getItem('super_admin_session')
      if (!session) {
        router.push('/super-admin/login')
        return
      }
      setAdmin(JSON.parse(session))
      fetchDashboardData()
    }
    checkAuth()
  }, [router])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      const report = await SuperAdminService.getOverallReport()
      setStats(report)

      const { data: recent } = await supabase
        .from('attendance')
        .select(`
          id,
          date,
          time_in,
          status,
          section,
          students:student_id (
            full_name,
            lrn,
            grade
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      setRecentActivity((recent as RecentActivityItem[] | null) || [])

      const last7Days = [...Array(7)].map((_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - i)
        return date.toISOString().split('T')[0]
      }).reverse()

      const trendData = await Promise.all(
        last7Days.map(async (date) => {
          const { data: dailyAttendance } = await supabase
            .from('attendance')
            .select('status')
            .eq('date', date)

          return {
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            present: dailyAttendance?.filter((a: { status: string }) => a.status === 'present').length || 0,
            late: dailyAttendance?.filter((a: { status: string }) => a.status === 'late').length || 0,
            absent: dailyAttendance?.filter((a: { status: string }) => a.status === 'absent').length || 0
          }
        })
      )
      setAttendanceTrend(trendData)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const pieData = stats ? [
    { name: 'Present', value: stats.presentCount, color: '#10b981' },
    { name: 'Late', value: stats.lateCount, color: '#f59e0b' },
    { name: 'Absent', value: stats.absentCount, color: '#ef4444' }
  ].filter(item => item.value > 0) : []

  const gradeChartData = stats ? Object.entries(stats.gradeBreakdown).map(([grade, count]) => ({
    grade,
    count
  })) : []

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome, <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {admin?.full_name || 'Super Admin'}
            </span>
          </h1>
          <p className="text-gray-600 mt-1">School-wide attendance overview and management</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
          <Shield className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-gray-700">Super Administrator</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats?.totalStudents || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>Enrolled students</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Teachers</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats?.totalTeachers || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <UserCog className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-purple-600">
            <School className="w-4 h-4 mr-1" />
            <span>Faculty members</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats?.totalAttendance || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <FileText className="w-4 h-4 mr-1" />
            <span>Attendance records</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats?.attendanceRate || 0}%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-amber-600">
            {stats?.attendanceRate && stats.attendanceRate > 85 ? (
              <>
                <TrendingUp className="w-4 h-4 mr-1" />
                <span>Above average</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 mr-1" />
                <span>Needs improvement</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-700 uppercase tracking-wider">Present</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{stats?.presentCount || 0}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Late</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{stats?.lateCount || 0}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-5 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-red-700 uppercase tracking-wider">Absent</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{stats?.absentCount || 0}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Attendance Trend</h2>
              <p className="text-gray-500 text-xs">Last 7 days</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="present" stackId="1" fill="#10b981" stroke="#10b981" />
                <Area type="monotone" dataKey="late" stackId="1" fill="#f59e0b" stroke="#f59e0b" />
                <Area type="monotone" dataKey="absent" stackId="1" fill="#ef4444" stroke="#ef4444" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <PieChartIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Status Distribution</h2>
              <p className="text-gray-500 text-xs">Overall attendance breakdown</p>
            </div>
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
                    fill="#8884d8"
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
                No attendance data available
              </div>
            )}
          </div>
        </div>
      </div>

      {gradeChartData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Attendance by Grade</h2>
              <p className="text-gray-500 text-xs">Records per class</p>
            </div>
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

      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Recent Activity</h2>
              <p className="text-gray-500 text-xs">Latest attendance scans</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const student = Array.isArray(activity.students) ? activity.students[0] : activity.students

                return (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {student?.full_name || 'Unknown Student'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.section} • LRN: {activity.students?.lrn}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">
                      {new Date(activity.date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.time_in} • 
                      <span className={`ml-1 font-medium ${
                        activity.status === 'present' ? 'text-green-600' :
                        activity.status === 'late' ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {activity.status}
                      </span>
                    </p>
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-600">No recent activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
