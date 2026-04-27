'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { SuperAdminService } from '../../../../lib/super-admin'
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Mail,
  Phone,
  GraduationCap,
  BookOpen,
  Filter,
  X,
  Download,
  UserCheck,
  UserX,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye
} from 'lucide-react'

interface Student {
  id: string
  lrn: string
  full_name: string
  email: string
  grade: string
  section: string
  contact_number: string
  profile_photo_url?: string | null
  profile_photo_base64?: string | null
  is_assigned: boolean
  teacher_id?: string
  teacher_name?: string
}

interface Teacher {
  id: string
  full_name: string
  assigned_grade: string
}

interface StudentTeacherAssignment {
  student_id: string
  teacher_id: string
}

type StudentRow = Omit<Student, 'is_assigned' | 'teacher_name'>

export default function SuperAdminStudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  
  // Filters
  const [filterTeacher, setFilterTeacher] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterAssignment, setFilterAssignment] = useState('all') // all, assigned, unassigned
  
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const itemsPerPage = 10

  useEffect(() => {
    const checkAuth = () => {
      const session = sessionStorage.getItem('super_admin_session')
      if (!session) {
        router.push('/super-admin/login')
        return
      }
      fetchData()
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    filterStudents()
  }, [students, searchTerm, filterTeacher, filterGrade, filterAssignment])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch all students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, lrn, full_name, email, grade, section, contact_number, profile_photo_url, profile_photo_base64')
        .in('grade', ['11', '12'])
        .order('full_name')

      if (studentsError) throw studentsError

      // Fetch all teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('admin_users')
        .select('id, full_name, assigned_grade')
        .in('role', ['admin', 'teacher'])

      if (teachersError) throw teachersError
      setTeachers(teachersData || [])

      // Fetch student-teacher assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, teacher_id')

      if (assignmentsError) throw assignmentsError

      // Create assignment map
      const assignmentMap = new Map()
      assignments?.forEach((assign: StudentTeacherAssignment) => {
        assignmentMap.set(assign.student_id, assign.teacher_id)
      })

      // Create teacher name map
      const teacherNameMap = new Map()
      teachersData?.forEach((teacher: Teacher) => {
        teacherNameMap.set(teacher.id, teacher.full_name)
      })

      // Combine data
      const studentsWithAssignment = (studentsData || []).map((student: StudentRow) => {
        const teacherId = assignmentMap.get(student.id)
        return {
          ...student,
          is_assigned: !!teacherId,
          teacher_id: teacherId,
          teacher_name: teacherId ? teacherNameMap.get(teacherId) : undefined
        }
      })

      setStudents(studentsWithAssignment)
      setFilteredStudents(studentsWithAssignment)

    } catch (error) {
      console.error('Error fetching data:', error)
      setMessage({ type: 'error', text: 'Failed to load students' })
    } finally {
      setLoading(false)
    }
  }

  const filterStudents = () => {
    let filtered = [...students]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(student =>
        student.full_name.toLowerCase().includes(term) ||
        student.lrn.includes(term) ||
        student.email.toLowerCase().includes(term)
      )
    }

    // Teacher filter
    if (filterTeacher !== 'all') {
      filtered = filtered.filter(student => student.teacher_id === filterTeacher)
    }

    // Grade filter
    if (filterGrade !== 'all') {
      filtered = filtered.filter(student => student.grade === filterGrade)
    }

    // Assignment filter
    if (filterAssignment === 'assigned') {
      filtered = filtered.filter(student => student.is_assigned)
    } else if (filterAssignment === 'unassigned') {
      filtered = filtered.filter(student => !student.is_assigned)
    }

    setFilteredStudents(filtered)
    setCurrentPage(1)
  }

  const handleAssignStudent = async () => {
    if (!selectedStudent || !selectedTeacherId) return

    setAssigning(true)
    try {
      await SuperAdminService.assignStudentsToTeacher(selectedTeacherId, [selectedStudent.id])
      setMessage({ type: 'success', text: `Student assigned to teacher successfully` })
      setShowAssignModal(false)
      fetchData()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to assign student'
      setMessage({ type: 'error', text: message })
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassignStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Remove ${studentName} from their current teacher?`)) return

    try {
      // Find the teacher this student is assigned to
      const { data: assignment } = await supabase
        .from('student_teacher_assignments')
        .select('teacher_id')
        .eq('student_id', studentId)
        .single()

      if (assignment) {
        await SuperAdminService.removeStudentFromTeacher(assignment.teacher_id, studentId)
        setMessage({ type: 'success', text: `Student unassigned successfully` })
        fetchData()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to unassign student'
      setMessage({ type: 'error', text: message })
    }
  }

  const handleExportCSV = () => {
    const headers = ['LRN', 'Full Name', 'Email', 'Grade', 'Contact', 'Assigned Teacher', 'Status']
    
    const csvData = filteredStudents.map(student => [
      `="${student.lrn}"`,
      student.full_name,
      student.email,
      student.grade,
      student.contact_number,
      student.teacher_name || 'Unassigned',
      student.is_assigned ? 'Assigned' : 'Unassigned'
    ])

    const BOM = "\uFEFF"
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `students_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getUniqueGrades = () => {
    const grades = new Set(students.map(s => s.grade))
    return ['all', ...Array.from(grades).sort()]
  }

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading students...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Student Management</h1>
          <p className="text-gray-600 mt-1">View and manage all students, assign to teachers</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-800">{students.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Assigned to Teachers</p>
              <p className="text-2xl font-bold text-gray-800">
                {students.filter(s => s.is_assigned).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <UserX className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Unassigned</p>
              <p className="text-2xl font-bold text-gray-800">
                {students.filter(s => !s.is_assigned).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Teachers</p>
              <p className="text-2xl font-bold text-gray-800">{teachers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-700">Filter Students</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, LRN, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
            />
          </div>

          {/* Teacher Filter */}
          <select
            value={filterTeacher}
            onChange={(e) => setFilterTeacher(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
          >
            <option value="all">All Teachers</option>
            {teachers.map(teacher => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.full_name}
                {teacher.assigned_grade && ` (Grade ${teacher.assigned_grade})`}
              </option>
            ))}
          </select>

          {/* Grade Filter */}
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
          >
            {getUniqueGrades().map(grade => (
              <option key={grade} value={grade}>
                {grade === 'all' ? 'All Grades' : `Grade ${grade}`}
              </option>
            ))}
          </select>

          {/* Assignment Filter */}
          <select
            value={filterAssignment}
            onChange={(e) => setFilterAssignment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
          >
            <option value="all">All Students</option>
            <option value="assigned">Assigned to Teachers</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>

        {/* Active Filters Reset */}
        {(filterTeacher !== 'all' || filterGrade !== 'all' || filterAssignment !== 'all' || searchTerm) && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => {
                setFilterTeacher('all')
                setFilterGrade('all')
                setFilterAssignment('all')
                setSearchTerm('')
              }}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {paginatedStudents.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      LRN
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Assigned Teacher
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-100 to-purple-100 flex items-center justify-center overflow-hidden">
                            {student.profile_photo_base64 || student.profile_photo_url ? (
                              <img
                                src={student.profile_photo_base64 || student.profile_photo_url || ''}
                                alt={student.full_name}
                                className="w-10 h-10 object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-indigo-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{student.full_name}</p>
                            <p className="text-xs text-gray-500">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {student.lrn}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <GraduationCap className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            Grade {student.grade}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{student.contact_number || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {student.is_assigned ? (
                          <div className="flex items-center gap-1">
                            <UserCheck className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-gray-700">{student.teacher_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-orange-600 flex items-center gap-1">
                            <UserX className="w-4 h-4" />
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {student.is_assigned ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Assigned
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {!student.is_assigned ? (
                            <button
                              onClick={() => {
                                setSelectedStudent(student)
                                setShowAssignModal(true)
                              }}
                              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" />
                              Assign
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnassignStudent(student.id, student.full_name)}
                              className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition-colors flex items-center gap-1"
                            >
                              <UserX className="w-3 h-3" />
                              Unassign
                            </button>
                          )}
                        </div>
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
                  {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of{' '}
                  {filteredStudents.length} students
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
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No students found matching your filters</p>
          </div>
        )}
      </div>

      {/* Assign Student Modal */}
      {showAssignModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Assign Student to Teacher</h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedStudent.full_name} (Grade {selectedStudent.grade})
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Teacher
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Choose a teacher...</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                      {teacher.assigned_grade && ` (Grade ${teacher.assigned_grade})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignStudent}
                  disabled={!selectedTeacherId || assigning}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {assigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Assign
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

