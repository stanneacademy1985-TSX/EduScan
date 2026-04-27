'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { SuperAdminService, TeacherWithStudents } from '../../../../lib/super-admin'
import {
  UserCog,
  Plus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Users,
  BookOpen,
  CheckCircle,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Check,
  X,
  Eye,
  EyeOff,
  Shield,
  School,
  GraduationCap,
  RefreshCw,
  Save,
  Filter
} from 'lucide-react'

interface AvailableStudent {
  id: string
  lrn: string
  full_name: string
  grade: string
  section: string
}

interface AdminLookup {
  email: string
  role: 'admin' | 'teacher'
  assigned_grade?: string
}

export default function ManageTeachersPage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<TeacherWithStudents[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithStudents | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Create teacher form
  const [createForm, setCreateForm] = useState({
    email: '',
    full_name: '',
    password: '',
    confirm_password: '',
    role: 'teacher' as 'admin' | 'teacher',
    assigned_grade: '',
    assigned_section: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)

  // Edit teacher form
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    assigned_grade: '',
    assigned_section: '',
    role: 'teacher' as 'admin' | 'teacher'
  })
  const [editing, setEditing] = useState(false)

  // Assign students form
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([])
  const [assignedStudentIds, setAssignedStudentIds] = useState<Set<string>>(new Set())
  const [filterGrade, setFilterGrade] = useState('all')
  const [assigning, setAssigning] = useState(false)

  const itemsPerPage = 10

  useEffect(() => {
    const checkAuth = () => {
      const session = sessionStorage.getItem('super_admin_session')
      if (!session) {
        router.push('/super-admin/login')
        return
      }
      fetchTeachers()
    }
    checkAuth()
  }, [router])

  const fetchTeachers = async () => {
    try {
      setLoading(true)
      const data = await SuperAdminService.getAllTeachersWithStudents()
      setTeachers(data)
    } catch (error) {
      console.error('Error fetching teachers:', error)
      setMessage({ type: 'error', text: 'Failed to load teachers' })
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableStudents = async (gradeOverride?: string) => {
    const gradeToUse = gradeOverride ?? filterGrade

    try {
      const students = await SuperAdminService.getStudentsByGradeSection(
        gradeToUse !== 'all' ? gradeToUse : undefined,
        undefined
      )
      setAvailableStudents(students)
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (createForm.password !== createForm.confirm_password) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    if (createForm.password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }

    setCreating(true)
    setMessage(null)

    try {
      await SuperAdminService.createAdminAccount(
        createForm.email,
        createForm.full_name,
        createForm.role,
        createForm.password,
        createForm.assigned_grade,
        createForm.assigned_section
      )
      
      setMessage({ type: 'success', text: 'Teacher account created successfully!' })
      setShowCreateModal(false)
      resetCreateForm()
      fetchTeachers()
    } catch (error: unknown) {
      console.error('Error creating teacher:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create teacher account'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setCreating(false)
    }
  }

  const handleEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeacher) return

    setEditing(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('admin_users')
        .update({
          full_name: editForm.full_name.trim(),
          email: editForm.email.toLowerCase().trim(),
          assigned_grade: editForm.assigned_grade || null,
          role: editForm.role
        })
        .eq('id', selectedTeacher.teacher_id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Teacher updated successfully!' })
      setShowEditModal(false)
      fetchTeachers()
    } catch (error: unknown) {
      console.error('Error updating teacher:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update teacher'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setEditing(false)
    }
  }

  const handleDeleteTeacher = async (teacherId: string, teacherName: string) => {
    if (!confirm(`Are you sure you want to delete ${teacherName}? This action cannot be undone.`)) return

    try {
      await SuperAdminService.deleteTeacher(teacherId)
      setMessage({ type: 'success', text: 'Teacher deleted successfully' })
      fetchTeachers()
    } catch (error: unknown) {
      console.error('Error deleting teacher:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete teacher'
      setMessage({ type: 'error', text: errorMessage })
    }
  }

  const handleToggleStatus = async (teacherId: string, currentStatus: boolean) => {
    try {
      await SuperAdminService.toggleTeacherStatus(teacherId, !currentStatus)
      setMessage({ type: 'success', text: `Teacher ${!currentStatus ? 'activated' : 'deactivated'} successfully` })
      fetchTeachers()
    } catch (error: unknown) {
      console.error('Error toggling status:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status'
      setMessage({ type: 'error', text: errorMessage })
    }
  }

  const openAssignModal = async (teacher: TeacherWithStudents) => {
    setSelectedTeacher(teacher)
    const currentStudents = await SuperAdminService.getTeacherStudents(teacher.teacher_id)
    setAssignedStudentIds(new Set(currentStudents.map((s) => s.id)))

    const initialGrade = teacher.grade && teacher.grade !== 'All'
      ? teacher.grade
      : 'all'

    setFilterGrade(initialGrade)
    await fetchAvailableStudents(initialGrade)
    setShowAssignModal(true)
  }

  const handleAssignStudents = async () => {
    if (!selectedTeacher) return

    setAssigning(true)
    try {
      // Get current assignments
      const currentStudents = await SuperAdminService.getTeacherStudents(selectedTeacher.teacher_id)
      const currentIds = new Set(currentStudents.map((s) => s.id))

      // Find students to add and remove
      const toAdd = Array.from(assignedStudentIds).filter(id => !currentIds.has(id))
      const toRemove = Array.from(currentIds).filter(id => !assignedStudentIds.has(id))

      // Add new assignments
      if (toAdd.length > 0) {
        await SuperAdminService.assignStudentsToTeacher(selectedTeacher.teacher_id, toAdd)
      }

      // Remove unassigned students
      for (const studentId of toRemove) {
        await SuperAdminService.removeStudentFromTeacher(selectedTeacher.teacher_id, studentId)
      }

      setMessage({ type: 'success', text: `Updated assignments for ${selectedTeacher.teacher_name}` })
      setShowAssignModal(false)
      fetchTeachers()
    } catch (error: unknown) {
      console.error('Error assigning students:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign students'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setAssigning(false)
    }
  }

  const toggleStudentAssignment = (studentId: string) => {
    const newSet = new Set(assignedStudentIds)
    if (newSet.has(studentId)) {
      newSet.delete(studentId)
    } else {
      newSet.add(studentId)
    }
    setAssignedStudentIds(newSet)
  }

  const resetCreateForm = () => {
    setCreateForm({
      email: '',
      full_name: '',
      password: '',
      confirm_password: '',
      role: 'teacher',
      assigned_grade: '',
      assigned_section: ''
    })
  }

  const openEditModal = async (teacher: TeacherWithStudents) => {
    setSelectedTeacher(teacher)
    
    // Fetch teacher details including email
    const { data, error } = await supabase
      .from('admin_users')
      .select('email, role, assigned_grade')
      .eq('id', teacher.teacher_id)
      .single()
    
    if (error) {
      console.error('Error fetching teacher details:', error)
      return
    }
    
    if (data) {
      setEditForm({
        full_name: teacher.teacher_name,
        email: data.email,
        assigned_grade: data.assigned_grade || '',
        assigned_section: '',
        role: data.role as 'admin' | 'teacher'
      })
    }
    
    setShowEditModal(true)
  }

  // Filter teachers
  const filteredTeachers = teachers.filter(teacher =>
    teacher.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.grade.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage)
  const paginatedTeachers = filteredTeachers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">Admin</span>
    }
    return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">Teacher</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Manage Teachers</h1>
          <p className="text-gray-600 mt-1">Create, edit, and manage teacher accounts and student assignments</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Add New Teacher
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

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Teachers</p>
              <p className="text-2xl font-bold text-gray-800">{teachers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Assigned Students</p>
              <p className="text-2xl font-bold text-gray-800">
                {teachers.reduce((sum, t) => sum + t.student_count, 0)}
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
              <p className="text-2xl font-bold text-gray-800">
                {teachers.filter(t => t.student_count > 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search teachers by name or grade..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Teachers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading teachers...</p>
          </div>
        ) : paginatedTeachers.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Teacher</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Assigned Class</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Students</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedTeachers.map((teacher) => (
                    <tr key={teacher.teacher_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                            <UserCog className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{teacher.teacher_name}</p>
                            <p className="text-xs text-gray-500">ID: {teacher.teacher_id.slice(0, 8)}</p>
                          </div>
                        </div>
                       </td>
                      <td className="px-6 py-4">
                        {getRoleBadge(teacher.grade === 'All' ? 'admin' : 'teacher')}
                       </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">
                            {teacher.grade !== 'All' ? `Grade ${teacher.grade}` : 'All Grades'}
                          </span>
                        </div>
                       </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-gray-800">{teacher.student_count}</span>
                          <span className="text-gray-500 text-sm">students</span>
                        </div>
                       </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Active
                        </span>
                       </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openAssignModal(teacher)}
                            className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                            title="Assign Students"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(teacher)}
                            className="p-2 hover:bg-amber-100 rounded-lg text-amber-600 transition-colors"
                            title="Edit Teacher"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTeacher(teacher.teacher_id, teacher.teacher_name)}
                            className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                            title="Delete Teacher"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                  {Math.min(currentPage * itemsPerPage, filteredTeachers.length)} of{' '}
                  {filteredTeachers.length} teachers
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <UserCog className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No teachers found</p>
          </div>
        )}
      </div>

      {/* Create Teacher Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">Add New Teacher</h2>
              <p className="text-sm text-gray-500 mt-1">Create a teacher or admin account</p>
            </div>

            <form onSubmit={handleCreateTeacher} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Juan Dela Cruz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="teacher@eduscan.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'teacher' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin (can manage students)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Grade
                </label>
                <select
                  value={createForm.assigned_grade}
                  onChange={(e) => setCreateForm({ ...createForm, assigned_grade: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All Grades</option>
                  {[11, 12].map(grade => (
                    <option key={grade} value={grade}>Grade {grade}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={createForm.confirm_password}
                  onChange={(e) => setCreateForm({ ...createForm, confirm_password: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Create Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {showEditModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Edit Teacher</h2>
              <p className="text-sm text-gray-500 mt-1">Update teacher information</p>
            </div>

            <form onSubmit={handleEditTeacher} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'teacher' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Grade
                </label>
                <select
                  value={editForm.assigned_grade}
                  onChange={(e) => setEditForm({ ...editForm, assigned_grade: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All Grades</option>
                  {[11, 12].map(grade => (
                    <option key={grade} value={grade}>Grade {grade}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Students Modal */}
      {showAssignModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Assign Students to {selectedTeacher.teacher_name}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Select students to assign to this teacher
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Grade</label>
                <select
                  value={filterGrade}
                  onChange={(e) => {
                    const selectedGrade = e.target.value
                    setFilterGrade(selectedGrade)
                    fetchAvailableStudents(selectedGrade)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Grades</option>
                  {[11, 12].map(grade => (
                    <option key={grade} value={grade}>Grade {grade}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => fetchAvailableStudents(filterGrade)}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Students
              </button>

              {/* Student List */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={assignedStudentIds.size === availableStudents.length && availableStudents.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignedStudentIds(new Set(availableStudents.map(s => s.id)))
                        } else {
                          setAssignedStudentIds(new Set())
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Select All ({availableStudents.length} students)
                    </span>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {availableStudents.length > 0 ? (
                    availableStudents.map(student => (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={assignedStudentIds.has(student.id)}
                          onChange={() => toggleStudentAssignment(student.id)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{student.full_name}</p>
                          <p className="text-xs text-gray-500">
                            LRN: {student.lrn} • Grade {student.grade}
                          </p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <p>No students found</p>
                      <p className="text-sm mt-1">Try adjusting your filters</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignStudents}
                  disabled={assigning}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {assigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Assignments ({assignedStudentIds.size} students)
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
