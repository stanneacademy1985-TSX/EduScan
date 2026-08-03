// app/admin/attendance/unregistered/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { getStoredAdminSession, type AdminSessionUser } from '../../../../../lib/admin-auth'
import { AlertCircle, Loader2, Save, Users } from 'lucide-react'

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

interface PendingUnregisteredEntry {
  lrn: string
  student_name: string
  grade: string
  section: string
  date: string
  teacher_name: string
}

const PENDING_UNREGISTERED_KEY = 'pending_unregistered_attendance'

export default function UnregisteredStudentsPage() {
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null)
  const [students, setStudents] = useState<UnregisteredStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [formData, setFormData] = useState({
    lrn: '',
    studentName: ''
  })

  useEffect(() => {
    setAdmin(getStoredAdminSession())
    if (typeof window === 'undefined') return

    try {
      const storedEntries = window.sessionStorage.getItem(PENDING_UNREGISTERED_KEY)
      if (!storedEntries) return

      const parsedEntries = JSON.parse(storedEntries) as PendingUnregisteredEntry[]
      const grouped = new Map<string, UnregisteredStudent>()

      parsedEntries.forEach((record) => {
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
      console.error('Error loading pending unregistered entries:', error)
      window.sessionStorage.removeItem(PENDING_UNREGISTERED_KEY)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setMessageType('')

    const lrn = formData.lrn.trim()
    const studentName = formData.studentName.trim()

    if (!lrn || !studentName) {
      setMessage('Please fill in both LRN and student name.')
      setMessageType('error')
      return
    }

    setSubmitting(true)

    try {
      const today = new Date().toISOString().split('T')[0]
      const pendingEntry: PendingUnregisteredEntry = {
        lrn,
        student_name: studentName,
        grade: 'Unregistered',
        section: 'Unregistered',
        date: today,
        teacher_name: admin?.full_name || 'Unknown'
      }

      const storedEntriesRaw = window.sessionStorage.getItem(PENDING_UNREGISTERED_KEY)
      const storedEntries = storedEntriesRaw ? JSON.parse(storedEntriesRaw) as PendingUnregisteredEntry[] : []

      if (storedEntries.some((entry) => entry.lrn === lrn)) {
        setMessage(`Pending attendance for ${lrn} is already in the list.`)
        setMessageType('error')
        return
      }

      const nextEntries = [pendingEntry, ...storedEntries]
      window.sessionStorage.setItem(PENDING_UNREGISTERED_KEY, JSON.stringify(nextEntries))

      const grouped = new Map<string, UnregisteredStudent>()
      nextEntries.forEach((record) => {
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
      setMessage(`Temporary entry saved for ${studentName}.`)
      setMessageType('success')
      setFormData({ lrn: '', studentName: '' })
    } catch (error) {
      console.error('Error saving temporary entry locally:', error)
      setMessage('Failed to save the temporary entry. Please try again.')
      setMessageType('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-linear-to-br from-white to-orange-50 p-4 sm:p-6 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 leading-tight">Unregistered Students</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1 max-w-2xl">
          Enter the student's LRN and name to create a temporary attendance record.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-4 sm:mb-5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <Save className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Temporary Attendance Entry</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              For students who are not yet registered. This saves a temporary record that will be linked later by LRN.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              messageType === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">LRN</label>
            <input
              type="text"
              value={formData.lrn}
              onChange={(e) => setFormData(prev => ({ ...prev, lrn: e.target.value }))}
              placeholder="Enter LRN"
              className="w-full rounded-xl border border-gray-300 px-4 py-3.5 text-base outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student Name</label>
            <input
              type="text"
              value={formData.studentName}
              onChange={(e) => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
              placeholder="Enter student name"
              className="w-full rounded-xl border border-gray-300 px-4 py-3.5 text-base outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div className="flex items-end md:pb-0">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3.5 font-medium text-white transition-all hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              Save Entry
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {students.length > 0 ? (
          <>
            <div className="sm:hidden divide-y divide-gray-200">
              {students.map((student) => (
                <div key={student.lrn} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">LRN</p>
                      <p className="mt-1 font-mono text-sm font-medium text-gray-900 break-all">{student.lrn}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                      {student.attendance_count} records
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-700">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Name</p>
                      <p className="mt-1 font-medium text-gray-900">{student.student_name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grade/Section</p>
                        <p className="mt-1 font-medium text-gray-900">{student.grade} - {student.section}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last Attendance</p>
                        <p className="mt-1 font-medium text-gray-900">{student.last_attendance}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recorded By</p>
                      <p className="mt-1 font-medium text-gray-900">{student.teacher_name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-190">
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
          </>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No pending unregistered entries yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Added entries stay here locally so the teacher can take attendance later.
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
            <span>Teacher enters the unregistered student's LRN and name here</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
            <span>The entry is stored locally, not in the database</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center shrink-0 text-xs font-bold">3</div>
            <span>The teacher can use the queued entry later for attendance tracking</span>
          </div>
        </div>
      </div>
    </div>
  )
}
