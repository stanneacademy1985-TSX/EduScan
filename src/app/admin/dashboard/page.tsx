'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { fetchAdminById, getAssignedStudentIds, getStoredAdminSession, hasAssignedScope, isSuperAdmin, storeAdminSession } from '../../../../lib/admin-auth'
import { useRouter } from 'next/navigation'
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  BarChart3,
  FileText,
  User,
  CalendarDays,
  QrCode,
  PieChart,
  UserPlus
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell
} from 'recharts'
import { PieLabelRenderProps } from 'recharts';

interface AdminUser {
  id: string
  full_name: string
  email: string
  role: string
  name?: string
  assigned_grade?: string | null
  assigned_section?: string | null
}

export default function AdminDashboard() {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Dashboard stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeSessions: 0,
    todayAttendance: 0,
    totalAttendance: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    temporaryCount: 0
  })
  
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [statusDistribution, setStatusDistribution] = useState<any[]>([])

  useEffect(() => {
    const fetchAdminData = async () => {
      const adminSession = getStoredAdminSession()
      if (!adminSession) {
        router.push('/admin/login')
        return
      }
      
      try {
        const adminData = adminSession.id ? await fetchAdminById(adminSession.id) : adminSession
        if (!adminData) {
          router.push('/admin/login')
          return
        }

        if (adminData.role === 'super_admin') {
          storeAdminSession(adminData)
          router.push('/super-admin/dashboard')
          return
        }

        setAdmin(adminData)
        storeAdminSession(adminData)
        localStorage.setItem('admin', JSON.stringify(adminData))
      } catch (error) {
        console.error('Error parsing admin session:', error)
        router.push('/admin/login')
        return
      }
      
      fetchDashboardData()
    }

    fetchAdminData()
  }, [router])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      const currentAdmin = getStoredAdminSession()
      const scopedAdmin = currentAdmin?.id ? await fetchAdminById(currentAdmin.id) : currentAdmin
      const restrictToAssignment = hasAssignedScope(scopedAdmin)
      const assignedStudentIds = await getAssignedStudentIds(scopedAdmin)
      let studentCountQuery = supabase
        .from('students')
        .select('*', { count: 'exact', head: true })

      if (assignedStudentIds !== null && assignedStudentIds.length > 0) {
        studentCountQuery = studentCountQuery.in('id', assignedStudentIds)
      } else if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        studentCountQuery = studentCountQuery.eq('id', '__no_assigned_students__')
      } else if (restrictToAssignment) {
        studentCountQuery = studentCountQuery
          .eq('grade', scopedAdmin!.assigned_grade!)
      }

      const { count: studentCount } = await studentCountQuery

      let sessionCountQuery = supabase
        .from('attendance_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      if (!isSuperAdmin(scopedAdmin) && scopedAdmin?.id) {
        sessionCountQuery = sessionCountQuery.eq('teacher_id', scopedAdmin.id)
      }

      const { count: sessionCount } = await sessionCountQuery

      const today = new Date().toISOString().split('T')[0]
      
      let todayAttendanceQuery = supabase
        .from('attendance')
        .select('status, is_temporary, student_name, lrn')
        .eq('date', today)

      if (!isSuperAdmin(scopedAdmin) && scopedAdmin?.id) {
        todayAttendanceQuery = todayAttendanceQuery.eq('teacher_id', scopedAdmin.id)
      }

      if (assignedStudentIds !== null && assignedStudentIds.length > 0) {
        todayAttendanceQuery = todayAttendanceQuery.or(`student_id.in.(${assignedStudentIds.join(',')}),is_temporary.eq.true`)
      } else if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        todayAttendanceQuery = todayAttendanceQuery.eq('is_temporary', true)
      }

      if (restrictToAssignment) {
        todayAttendanceQuery = todayAttendanceQuery
          .eq('grade', scopedAdmin!.assigned_grade!)
      }

      const { data: todayAttendance, error: todayError } = await todayAttendanceQuery

      if (todayError) throw todayError

      const presentToday = todayAttendance?.filter(a => a.status === 'present').length || 0
      const lateToday = todayAttendance?.filter(a => a.status === 'late').length || 0
      const absentToday = todayAttendance?.filter(a => a.status === 'absent').length || 0
      const temporaryCount = todayAttendance?.filter(a => a.is_temporary === true).length || 0

      let totalAttendanceQuery = supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })

      if (!isSuperAdmin(scopedAdmin) && scopedAdmin?.id) {
        totalAttendanceQuery = totalAttendanceQuery.eq('teacher_id', scopedAdmin.id)
      }

      if (assignedStudentIds !== null && assignedStudentIds.length > 0) {
        totalAttendanceQuery = totalAttendanceQuery.or(`student_id.in.(${assignedStudentIds.join(',')}),is_temporary.eq.true`)
      } else if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        totalAttendanceQuery = totalAttendanceQuery.eq('is_temporary', true)
      }

      if (restrictToAssignment) {
        totalAttendanceQuery = totalAttendanceQuery
          .eq('grade', scopedAdmin!.assigned_grade!)
      }

      const { count: totalAttendanceCount } = await totalAttendanceQuery

      const last7Days = [...Array(7)].map((_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - i)
        return date.toISOString().split('T')[0]
      }).reverse()

      const trendData = await Promise.all(
        last7Days.map(async (date) => {
          let dailyAttendanceQuery = supabase
            .from('attendance')
            .select('status')
            .eq('date', date)

          if (!isSuperAdmin(scopedAdmin) && scopedAdmin?.id) {
            dailyAttendanceQuery = dailyAttendanceQuery.eq('teacher_id', scopedAdmin.id)
          }

          if (assignedStudentIds !== null && assignedStudentIds.length > 0) {
            dailyAttendanceQuery = dailyAttendanceQuery.or(`student_id.in.(${assignedStudentIds.join(',')}),is_temporary.eq.true`)
          } else if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
            dailyAttendanceQuery = dailyAttendanceQuery.eq('is_temporary', true)
          }

          if (restrictToAssignment) {
            dailyAttendanceQuery = dailyAttendanceQuery
              .eq('grade', scopedAdmin!.assigned_grade!)
          }

          const { data: dailyAttendance } = await dailyAttendanceQuery

          return {
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            present: dailyAttendance?.filter(a => a.status === 'present').length || 0,
            late: dailyAttendance?.filter(a => a.status === 'late').length || 0,
            absent: dailyAttendance?.filter(a => a.status === 'absent').length || 0
          }
        })
      )
      setAttendanceTrend(trendData)

      // Status distribution for pie chart
      setStatusDistribution([
        { name: 'Present', value: presentToday, color: '#10b981' },
        { name: 'Late', value: lateToday, color: '#f59e0b' },
        { name: 'Absent', value: absentToday, color: '#ef4444' }
      ].filter(item => item.value > 0))

      let recentActivityQuery = supabase
        .from('attendance')
        .select(`
          id,
          date,
          time_in,
          status,
          student_id,
          student_name,
          lrn,
          is_temporary,
          students:student_id (
            first_name,
            last_name,
            lrn,
            profile_photo_base64
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!isSuperAdmin(scopedAdmin) && scopedAdmin?.id) {
        recentActivityQuery = recentActivityQuery.eq('teacher_id', scopedAdmin.id)
      }

      if (assignedStudentIds !== null && assignedStudentIds.length > 0) {
        recentActivityQuery = recentActivityQuery.or(`student_id.in.(${assignedStudentIds.join(',')}),is_temporary.eq.true`)
      } else if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        recentActivityQuery = recentActivityQuery.eq('is_temporary', true)
      }

      if (restrictToAssignment) {
        recentActivityQuery = recentActivityQuery
          .eq('grade', scopedAdmin!.assigned_grade!)
      }

      const { data: recent } = await recentActivityQuery

      const filteredRecent = (recent || []).filter(activity => {
        if (!activity.is_temporary) return true
        return activity.date === today
      })

      const formattedRecent = filteredRecent.map(activity => ({
        ...activity,
        display_name: activity.is_temporary
          ? `${activity.student_name || 'Unregistered'} (Temporary)`
          : activity.students ? `${activity.students.first_name} ${activity.students.last_name}` : activity.student_name,
        display_lrn: activity.lrn || activity.students?.lrn || 'N/A'
      }))

      setRecentActivity(formattedRecent || [])

      setStats({
        totalStudents: studentCount || 0,
        activeSessions: sessionCount || 0,
        todayAttendance: todayAttendance?.length || 0,
        totalAttendance: totalAttendanceCount || 0,
        presentToday: presentToday,
        lateToday: lateToday,
        absentToday: absentToday,
        temporaryCount: temporaryCount
      })

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderPieLabel = (props: PieLabelRenderProps) => {
    const { name, percent } = props;
    const displayName = typeof name === 'string' ? name : '';
    const percentage = typeof percent === 'number' ? (percent * 100).toFixed(0) : '0';
    return `${displayName} ${percentage}%`;
  }

  // Helper function to get admin display name
  const getAdminDisplayName = () => {
    if (!admin) return 'Admin';
    // Try different possible field names
    return admin.full_name || admin.name || admin.email?.split('@')[0] || 'Admin';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-800">
              Welcome back,{' '}
              <span className="bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {getAdminDisplayName()}!
              </span>
            </h1>
            <p className="text-gray-600 mt-1 text-base">Here's your system overview</p>
          </div>
          
          <div className="bg-white px-5 py-2.5 rounded-xl border border-gray-200 shadow-sm inline-flex items-center">
            <Calendar className="w-4 h-4 text-indigo-600 mr-2" />
            <p className="text-sm font-medium text-gray-700">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalStudents}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-100 to-blue-200 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>Active students</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Sessions</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.activeSessions}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-100 to-green-200 flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-1" />
            <span>Ongoing sessions</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Attendance</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.todayAttendance}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-100 to-amber-200 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <BarChart3 className="w-4 h-4 mr-1" />
            <span>Records marked today</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Attendance</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalAttendance}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>All-time records</span>
          </div>
        </div>
      </div>

      {/* Today's Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-linear-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-700 uppercase tracking-wider">Present Today</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{stats.presentToday}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-linear-to-br from-amber-50 to-yellow-50 rounded-xl p-5 border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Late Today</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{stats.lateToday}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-linear-to-br from-red-50 to-rose-50 rounded-xl p-5 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-red-700 uppercase tracking-wider">Absent Today</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{stats.absentToday}</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Temporary Records</p>
              <p className="text-2xl font-bold text-orange-800 mt-1">{stats.temporaryCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-orange-100 to-orange-200 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-orange-600">
            <Clock className="w-4 h-4 mr-1" />
            <span>Unregistered students</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Attendance Trend */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-linear-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Attendance Trend</h2>
              <p className="text-gray-500 text-xs">Last 7 days</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="present" 
                  name="Present"
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ stroke: '#10b981', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="late" 
                  name="Late"
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={{ stroke: '#f59e0b', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="absent" 
                  name="Absent"
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={{ stroke: '#ef4444', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-linear-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <PieChart className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Today's Distribution</h2>
              <p className="text-gray-500 text-xs">Attendance status breakdown</p>
            </div>
          </div>
          <div className="h-80">
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderPieLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No attendance data for today
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-linear-to-br from-blue-100 to-purple-100 flex items-center justify-center">
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
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                      {activity.is_temporary ? (
                        <UserPlus className="w-5 h-5 text-orange-600" />
                      ) : activity.students?.profile_photo_base64 ? (
                        <img 
                          src={activity.students.profile_photo_base64} 
                          alt={activity.display_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {activity.display_name}
                        {activity.is_temporary && (
                          <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                            Needs Registration
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        LRN: {activity.display_lrn || activity.lrn}
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
              ))}
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button 
          onClick={() => router.push('/admin/students')}
          className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Manage Students</p>
              <p className="text-xs text-gray-500">View and edit records</p>
            </div>
          </div>
        </button>

        <button 
          onClick={() => router.push('/admin/attendance/sessions')}
          className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <CalendarDays className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Sessions</p>
              <p className="text-xs text-gray-500">Create attendance sessions</p>
            </div>
          </div>
        </button>

        <button 
          onClick={() => router.push('/admin/attendance/scanner')}
          className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <QrCode className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">QR Scanner</p>
              <p className="text-xs text-gray-500">Scan student QR codes</p>
            </div>
          </div>
        </button>

        <button 
          onClick={() => router.push('/admin/attendance/reports')}
          className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Reports</p>
              <p className="text-xs text-gray-500">Generate attendance reports</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
