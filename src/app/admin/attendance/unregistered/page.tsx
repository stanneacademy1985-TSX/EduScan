// app/admin/attendance/unregistered/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { UserPlus, AlertCircle, Loader2, Users } from 'lucide-react'

interface UnregisteredStudent {
  lrn: string
  student_name: string
  grade: string
  section: string
  attendance_count: number
  last_attendance: string
  teacher_name: string
}

interface AttendanceRecord {
  lrn: string
  student_name: string
  grade: string
  section: string
  date: string
  teacher_name: string
}

export default function UnregisteredStudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<UnregisteredStudent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUnregisteredStudents()
  }, [])

  const fetchUnregisteredStudents = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Get all temporary attendance records grouped by LRN
      const { data, error } = await supabase
        .from('attendance')
        .select('lrn, student_name, grade, section, date, teacher_name, needs_registration')
        .eq('needs_registration', true)
        .eq('is_temporary', true)
        .eq('date', today)
        .order('date', { ascending: false })

      if (error) throw error

      // Group by LRN
      const grouped = new Map<string, UnregisteredStudent>()
      ;(data as AttendanceRecord[] | null)?.forEach((record) => {
        if (!grouped.has(record.lrn)) {
          grouped.set(record.lrn, {
            lrn: record.lrn,
            student_name: record.student_name,
            grade: record.grade,
            section: record.section,
            attendance_count: 1,
            last_attendance: record.date,
            teacher_name: record.teacher_name
          })
        } else {
          const existing = grouped.get(record.lrn)!
          existing.attendance_count++
          if (record.date > existing.last_attendance) {
            existing.last_attendance = record.date
          }
        }
      })

      setStudents(Array.from(grouped.values()))
    } catch (error) {
      console.error('Error fetching unregistered students:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Unregistered Students</h1>
          <p className="text-gray-600 mt-1">
            Today only: students with temporary attendance records who need to complete registration
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/attendance/scanner')}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-all"
        >
          <UserPlus className="w-5 h-5" />
          Record Attendance
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          </div>
        ) : students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">LRN</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">Grade/Section</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">Attendance Count</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">Last Attendance</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-sm font-semibold text-gray-700">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.lrn} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-4 font-mono text-sm">{student.lrn}</td>
                    <td className="px-3 sm:px-6 py-4">{student.student_name}</td>
                    <td className="px-3 sm:px-6 py-4">{student.grade} - {student.section}</td>
                    <td className="px-3 sm:px-6 py-4">
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                        {student.attendance_count} records
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-sm">{student.last_attendance}</td>
                    <td className="px-3 sm:px-6 py-4 text-sm">{student.teacher_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No unregistered students with temporary attendance</p>
            <p className="text-sm text-gray-400 mt-1">
              Temporary records from previous days are hidden automatically to keep this list clean
            </p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          How it works
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-sm text-blue-700">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center shrink-0 text-xs font-bold">1</div>
            <span>Teacher manually enters LRN for unregistered student in scanner</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
            <span>Temporary attendance record is saved with LRN as identifier</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center shrink-0 text-xs font-bold">3</div>
            <span>When student registers, all their temporary records are linked to their new account</span>
          </div>
        </div>
      </div>
    </div>
  )
}