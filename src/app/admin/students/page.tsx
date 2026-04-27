'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'
import { fetchAdminById, getAssignedStudentIds, getStoredAdminSession, hasAssignedScope, storeAdminSession, type AdminSessionUser } from '../../../../lib/admin-auth'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Download, 
  Eye, 
  Edit, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Heart,
  AlertCircle,
  CheckCircle,
  XCircle,
  Save,
  Camera,
  GraduationCap,
  Users,
  BookOpen,
  Briefcase,
  Pill,
  AlertTriangle,
  Info,
  Home,
  Cake,
  VenusAndMars,
  School,
  BadgeCheck,
  Loader2,
  ArrowLeft,
  FileText,
  QrCode
} from 'lucide-react'

interface Student {
  id: string
  lrn: string
  first_name: string
  middle_name: string | null
  last_name: string
  full_name: string
  sex: string
  date_of_birth: string
  contact_number: string
  address: string
  email: string
  grade: string
  section: string
  profile_photo_url: string | null
  profile_photo_base64?: string | null
  father_name: string | null
  father_occupation: string | null
  mother_name: string | null
  mother_occupation: string | null
  guardian_name: string | null
  guardian_contact: string | null
  medical_conditions: string | null
  medications: string | null
  allergies: string | null
  emergency_contact: string
  qr_code_data: string
  is_active: boolean
  created_at: string
  previous_elementary?: string | null
  previous_high_school?: string | null
  previous_shs?: string | null
}

export default function StudentsPage() {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecking, setAuthChecking] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null)

  // Bulk import states
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [bulkImportMessage, setBulkImportMessage] = useState({ type: '', text: '' })
  const [bulkImporting, setBulkImporting] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editedStudent, setEditedStudent] = useState<Partial<Student>>({})
  const [editTab, setEditTab] = useState('personal')
  const [saveLoading, setSaveLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const itemsPerPage = 10

  // Check authentication first
  useEffect(() => {
    const checkAuth = async () => {
      const sessionAdmin = getStoredAdminSession()
      if (!sessionAdmin) {
        router.push('/admin/login')
        return
      }

      const freshAdmin = sessionAdmin.id ? await fetchAdminById(sessionAdmin.id) : sessionAdmin
      if (!freshAdmin) {
        router.push('/admin/login')
        return
      }

      if (freshAdmin.role === 'super_admin') {
        storeAdminSession(freshAdmin)
        router.push('/super-admin/students')
        return
      }

      setAdmin(freshAdmin)
      storeAdminSession(freshAdmin)
      localStorage.setItem('admin', JSON.stringify(freshAdmin))
      setAuthChecking(false)
    }
    checkAuth()
  }, [router])

  // Fetch data only if authenticated
  useEffect(() => {
    if (!authChecking) {
      fetchStudents()
    }
  }, [authChecking])

  useEffect(() => {
    if (!authChecking) {
      filterStudents()
    }
  }, [searchTerm, selectedGrade, students, authChecking])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const currentAdmin = getStoredAdminSession()
      const scopedAdmin = currentAdmin?.id ? await fetchAdminById(currentAdmin.id) : currentAdmin

      const assignedStudentIds = await getAssignedStudentIds(scopedAdmin)

      if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        setStudents([])
        setFilteredStudents([])
        return
      }

      let query = supabase
        .from('students')
        .select('*')
        .in('grade', ['11', '12'])
        .order('created_at', { ascending: false })

      if (assignedStudentIds !== null) {
        query = query.in('id', assignedStudentIds)
      }

      const { data, error } = await query

      if (error) throw error
      setStudents(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterStudents = () => {
    let filtered = [...students]

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(student => 
        student.lrn.includes(term) ||
        student.first_name.toLowerCase().includes(term) ||
        student.last_name.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term) ||
        student.full_name.toLowerCase().includes(term)
      )
    }

    // Apply grade filter
    if (selectedGrade !== 'all') {
      filtered = filtered.filter(student => student.grade === selectedGrade)
    }

    setFilteredStudents(filtered)
    setCurrentPage(1)
  }

  const handleViewStudent = (student: Student) => {
    setSelectedStudent(student)
    setEditedStudent(student)
    setIsEditing(false)
    setShowStudentModal(true)
    setMessage({ type: '', text: '' })
  }

  const handleEditStudent = (student: Student) => {
    setSelectedStudent(student)
    setEditedStudent(student)
    setIsEditing(true)
    setShowStudentModal(true)
    setMessage({ type: '', text: '' })
  }

  const handleDeleteClick = (studentId: string) => {
    setStudentToDelete(studentId)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentToDelete)

      if (error) throw error

      // Refresh student list
      fetchStudents()
      setShowDeleteConfirm(false)
      setStudentToDelete(null)
    } catch (error) {
      console.error('Error deleting student:', error)
    }
  }

  const handleBulkCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setBulkImporting(true)
    setBulkImportMessage({ type: '', text: 'Processing file...' })

    try {
      const text = await file.text()
      const rows = text.trim().split(/\r?\n/)
      if (rows.length < 2) throw new Error('CSV file has no data rows')

      const headers = rows[0].split(',').map(h => h.trim().toLowerCase())
      const requiredHeaders = ['lrn', 'first_name', 'last_name', 'grade']
      for (const header of requiredHeaders) {
        if (!headers.includes(header)) {
          throw new Error(`Missing required column: ${header}`)
        }
      }

      const parsed = rows.slice(1).map(row => {
        const values = row.split(',')
        const student: any = {}
        headers.forEach((header, index) => {
          student[header] = (values[index] || '').trim()
        })

        const fullName = `${student.first_name || ''} ${student.middle_name ? student.middle_name + ' ' : ''}${student.last_name || ''}`.trim()
        return {
          ...student,
          section: 'SHS',
          full_name: fullName,
          guardian_name: student.guardian_name || null,
          guardian_contact: student.guardian_contact || null,
          emergency_contact: student.emergency_contact || null
        }
      })

      const { error } = await supabase.from('students').insert(parsed)
      if (error) throw error

      await fetchStudents()
      setBulkImportMessage({ type: 'success', text: `Imported ${parsed.length} student records successfully.` })
      setShowBulkImportModal(false)
    } catch (error: any) {
      console.error('Bulk import error:', error)
      setBulkImportMessage({ type: 'error', text: error?.message || 'Failed to import CSV.' })
    } finally {
      setBulkImporting(false)
      event.target.value = ''
    }
  }

  const normalizePhilippineMobile = (phone: string) => {
    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length === 11 && digits.startsWith('09')) {
      return '+63' + digits.slice(1)
    }
    if (digits.length === 10 && digits.startsWith('9')) {
      return '+63' + digits
    }
    if (digits.length === 12 && digits.startsWith('63')) {
      return '+' + digits
    }
    if (digits.length === 13 && digits.startsWith('0')) {
      return '+' + digits.slice(1)
    }
    return phone
  }

  const sendFamilyAlert = async (student: Student) => {
    const rawMobile = student.guardian_contact || student.contact_number || ''
    const parentPhone = rawMobile ? normalizePhilippineMobile(rawMobile) : ''
    const parentEmail = student.email || ''

    if (!parentPhone && !parentEmail) {
      alert('No guardian/contact phone or email available for this student')
      return
    }

    try {
      const resp = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.full_name,
          mobile: parentPhone,
          email: parentEmail,
          message: `Hi, this is EduScan. Your child ${student.full_name} is now marked as present in school.`
        })
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to send family alert')
      }

      alert(`Family alert sent: ${data.message}`)
    } catch (error: any) {
      console.error('sendFamilyAlert error:', error)
      alert(`Error sending family alert: ${error?.message || 'Unknown'}`)
    }
  }

  const handleExportCSV = () => {
    const headers = [
      'LRN',
      'Full Name',
      'Grade',
      'Email',
      'Contact Number',
      'Sex',
      'Date of Birth',
      'Address'
    ]

    const csvData = filteredStudents.map(student => [
      // Force LRN to be treated as text by adding equals sign and quotes
      `="${student.lrn}"`,
      student.full_name,
      student.grade,
      student.email,
      student.contact_number,
      student.sex,
      student.date_of_birth,
      student.address
    ])

    // Add BOM for UTF-8 to handle special characters
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

  const handleInputChange = (field: string, value: any) => {
    setEditedStudent(prev => ({ ...prev, [field]: value }))
  }

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedStudent) return

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Please upload a valid image file (JPEG, PNG, GIF)' })
      return
    }

    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      setMessage({ type: 'error', text: 'Image size should be less than 2MB' })
      return
    }

    setUploadingPhoto(true)
    setMessage({ type: '', text: '' })

    try {
      const photoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read image file'))
        reader.readAsDataURL(file)
      })

      const { error } = await supabase
        .from('students')
        .update({ profile_photo_base64: photoBase64 })
        .eq('id', selectedStudent.id)

      if (error) throw error

      setSelectedStudent(prev => prev ? { ...prev, profile_photo_base64: photoBase64 } : null)
      setEditedStudent(prev => ({ ...prev, profile_photo_base64: photoBase64 }))

      // Update in students list
      setStudents(prev => prev.map(s => 
        s.id === selectedStudent.id ? { ...s, profile_photo_base64: photoBase64 } : s
      ))

      setMessage({ type: 'success', text: 'Profile photo updated successfully!' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    } catch (error) {
      console.error('Error uploading photo:', error)
      setMessage({ type: 'error', text: 'Failed to upload photo. Please try again.' })
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveProfilePhoto = async () => {
    if (!selectedStudent) return

    setUploadingPhoto(true)
    try {
      const { error } = await supabase
        .from('students')
        .update({ profile_photo_base64: null })
        .eq('id', selectedStudent.id)

      if (error) throw error

      setSelectedStudent(prev => prev ? { ...prev, profile_photo_base64: undefined } : null)
      setEditedStudent(prev => ({ ...prev, profile_photo_base64: undefined }))

      // Update in students list
      setStudents(prev => prev.map(s => 
        s.id === selectedStudent.id ? { ...s, profile_photo_base64: undefined } : s
      ))

      setMessage({ type: 'success', text: 'Profile photo removed successfully!' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    } catch (error) {
      console.error('Error removing photo:', error)
      setMessage({ type: 'error', text: 'Failed to remove photo. Please try again.' })
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSaveChanges = async () => {
    if (!selectedStudent) return
    
    setSaveLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const { error } = await supabase
        .from('students')
        .update({
          first_name: editedStudent.first_name,
          middle_name: editedStudent.middle_name,
          last_name: editedStudent.last_name,
          contact_number: editedStudent.contact_number,
          address: editedStudent.address,
          date_of_birth: editedStudent.date_of_birth,
          sex: editedStudent.sex,
          grade: editedStudent.grade,
          section: 'SHS',
          previous_elementary: editedStudent.previous_elementary,
          previous_high_school: editedStudent.previous_high_school,
          previous_shs: editedStudent.previous_shs,
          father_name: editedStudent.father_name,
          father_occupation: editedStudent.father_occupation,
          mother_name: editedStudent.mother_name,
          mother_occupation: editedStudent.mother_occupation,
          guardian_name: editedStudent.guardian_name,
          guardian_contact: editedStudent.guardian_contact,
          medical_conditions: editedStudent.medical_conditions,
          medications: editedStudent.medications,
          allergies: editedStudent.allergies,
          emergency_contact: editedStudent.emergency_contact
        })
        .eq('id', selectedStudent.id)

      if (error) throw error

      // Update in students list
      setStudents(prev => prev.map(s => 
        s.id === selectedStudent.id ? { ...s, ...editedStudent } : s
      ))

      setSelectedStudent(prev => prev ? { ...prev, ...editedStudent } : null)
      
      setIsEditing(false)
      setMessage({ type: 'success', text: 'Student information updated successfully!' })
      
      setTimeout(() => {
        setMessage({ type: '', text: '' })
      }, 3000)
    } catch (error) {
      console.error('Error updating student:', error)
      setMessage({ type: 'error', text: 'Failed to update information. Please try again.' })
    } finally {
      setSaveLoading(false)
    }
  }

  const getUniqueGrades = () => {
    return ['all', '11', '12']
  }

  const grades = getUniqueGrades()

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Show loading while checking auth
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-20 h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-gray-600 text-lg animate-pulse">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Student Management</h1>
          <p className="text-gray-600 mt-1">Manage student records and information</p>
        </div>
      </div>

      {/* Bulk Import Modal */}

      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-gray-200">
            <div className="flex justify-between items-start gap-2 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Import Students from CSV</h2>
                <p className="text-sm text-gray-500">Upload CSV with LRN, first_name, last_name, grade and optional fields.</p>
              </div>
              <button onClick={() => setShowBulkImportModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <input type="file" accept=".csv" onChange={handleBulkCsvUpload} className="w-full border p-2 rounded" />
            <p className="text-xs text-gray-500 mt-2">Required columns: lrn,first_name,last_name,grade (others allowed: middle_name,email,contact_number,address,guardian_name,guardian_contact,emergency_contact,medical_conditions,medications,allergies).</p>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setShowBulkImportModal(false)} className="px-4 py-2 border rounded">Close</button>
            </div>
            {bulkImportMessage.text && <p className={`mt-3 text-sm ${bulkImportMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>{bulkImportMessage.text}</p>}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{students.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Grade Levels</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{grades.length - 1}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-100 to-emerald-100 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">School</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">St. Anne SHS</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <School className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
          <h2 className="font-semibold text-gray-700">Filter Students</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by LRN, name, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          {/* Grade Filter */}
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
          >
            {grades.map(grade => (
              <option key={grade} value={grade}>
                {grade === 'all' ? 'All Grades' : `Grade ${grade}`}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          <button
            onClick={() => {
              setSearchTerm('')
              setSelectedGrade('all')
            }}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="md:hidden p-3 space-y-3">
          {loading ? (
            <div className="py-8 text-center">
              <div className="flex justify-center">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            </div>
          ) : paginatedStudents.length === 0 ? (
            <div className="py-8 text-center">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No students found</p>
                <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
              </div>
            </div>
          ) : (
            paginatedStudents.map((student) => (
              <div key={student.id} className="rounded-xl border border-gray-200 p-3 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-sm border-2 border-white shrink-0">
                    {student.profile_photo_base64 || student.profile_photo_url ? (
                      <img
                        src={student.profile_photo_base64 || student.profile_photo_url || ''}
                        alt={student.full_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-indigo-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{student.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{student.email}</p>
                    <p className="text-xs text-gray-600 mt-1">LRN: {student.lrn}</p>
                    <p className="text-xs text-gray-600">Grade {student.grade}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleViewStudent(student)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditStudent(student)}
                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => sendFamilyAlert(student)}
                    className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                    title="Send Family Alert"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(student.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-190">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  LRN
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                  Grade
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                  Contact
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 sm:px-6 py-8 sm:py-12 text-center">
                    <div className="flex justify-center">
                      <div className="w-10 h-10 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 sm:px-6 py-8 sm:py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <Users className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-medium">No students found</p>
                      <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-linear-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-sm border-2 border-white shrink-0">
                          {student.profile_photo_base64 || student.profile_photo_url ? (
                            <img 
                              src={student.profile_photo_base64 || student.profile_photo_url || ''} 
                              alt={student.full_name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-indigo-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{student.full_name}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5 max-w-42.5 sm:max-w-60 truncate">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            {student.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="font-mono text-sm bg-gray-100 px-3 py-1.5 rounded-lg">
                        {student.lrn}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                      <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium inline-flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                        Grade {student.grade}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                      <p className="text-sm flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {student.contact_number}
                      </p>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                        <button
                          onClick={() => handleViewStudent(student)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditStudent(student)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => sendFamilyAlert(student)}
                          className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Send Family Alert"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(student.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredStudents.length > 0 && (
          <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2 sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredStudents.length)}</span> of{' '}
              <span className="font-medium">{filteredStudents.length}</span> students
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum = currentPage
                  if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  if (pageNum > 0 && pageNum <= totalPages) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-lg transition-colors ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  }
                  return null
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Student Details/Edit Modal */}
      {showStudentModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowStudentModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                  {isEditing ? 'Edit Student' : 'Student Details'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                ) : null}
                <button
                  onClick={() => setShowStudentModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden lg:block"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Success/Error Message */}
              {message.text && (
                <div className={`p-4 rounded-xl ${
                  message.type === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-700' 
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <div className="flex items-center gap-3">
                    {message.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 shrink-0" />
                    )}
                    <p className="text-sm font-medium">{message.text}</p>
                  </div>
                </div>
              )}

              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-gray-200">
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-linear-to-r from-indigo-500 to-purple-600 blur-xl opacity-60 group-hover:opacity-80 transition-opacity"></div>
                  <div className="relative w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden">
                    {uploadingPhoto ? (
                      <div className="w-full h-full bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                      </div>
                    ) : (
                      <>
                        {(selectedStudent.profile_photo_base64 || selectedStudent.profile_photo_url) ? (
                          <img 
                            src={selectedStudent.profile_photo_base64 || selectedStudent.profile_photo_url || ''} 
                            alt={selectedStudent.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-linear-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                            <User className="w-10 h-10 text-indigo-600" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {isEditing && (
                    <div className="absolute -bottom-2 -right-2 flex gap-1">
                      <label className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-indigo-700 transition-colors border-2 border-white">
                        <Camera className="w-4 h-4 text-white" />
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          onChange={handleProfilePhotoUpload}
                          className="hidden"
                          disabled={uploadingPhoto}
                        />
                      </label>
                      {selectedStudent.profile_photo_base64 && (
                        <button
                          onClick={handleRemoveProfilePhoto}
                          disabled={uploadingPhoto}
                          className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-colors border-2 border-white"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 wrap-break-word">
                    {isEditing ? editedStudent.full_name || selectedStudent.full_name : selectedStudent.full_name}
                  </h3>
                  <p className="text-gray-600 flex items-center gap-2 mt-1 flex-wrap">
                    <span className="font-mono bg-gray-100 px-3 py-1 rounded-lg text-xs sm:text-sm">
                      LRN: {selectedStudent.lrn}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium inline-flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                      Grade {selectedStudent.grade}
                    </span>
                  </div>
                </div>
              </div>

              {!isEditing ? (
                /* View Mode */
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <User className="w-5 h-5 text-indigo-600 shrink-0" />
                      Personal Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Full Name</p>
                        <p className="text-base font-semibold text-gray-900 mt-1">{selectedStudent.full_name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                        <p className="text-base text-gray-900 mt-1">{selectedStudent.email}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Contact Number</p>
                        <p className="text-base font-semibold text-gray-900 mt-1">{selectedStudent.contact_number}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Date of Birth</p>
                        <p className="text-base text-gray-900 mt-1">
                          {new Date(selectedStudent.date_of_birth).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Sex</p>
                        <p className="text-base text-gray-900 mt-1">{selectedStudent.sex || 'Not specified'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs font-medium text-gray-500 uppercase">Address</p>
                        <p className="text-base text-gray-900 mt-1">{selectedStudent.address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Academic Information */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-green-600 shrink-0" />
                      Academic Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Previous Elementary</p>
                        <p className="text-base text-gray-900 mt-1">{selectedStudent.previous_elementary || 'N/A'}</p>
                      </div>
                      {selectedStudent.previous_high_school && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">Previous High School</p>
                          <p className="text-base text-gray-900 mt-1">{selectedStudent.previous_high_school}</p>
                        </div>
                      )}
                      {selectedStudent.previous_shs && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">Previous Senior High School</p>
                          <p className="text-base text-gray-900 mt-1">{selectedStudent.previous_shs}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Parents & Guardian */}
                  {(selectedStudent.father_name || selectedStudent.mother_name || selectedStudent.guardian_name) && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-600 shrink-0" />
                        Parents & Guardian
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                        {selectedStudent.father_name && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Father's Name</p>
                            <p className="text-base font-semibold text-gray-900 mt-1">{selectedStudent.father_name}</p>
                            {selectedStudent.father_occupation && (
                              <p className="text-sm text-gray-600 mt-1">{selectedStudent.father_occupation}</p>
                            )}
                          </div>
                        )}
                        {selectedStudent.mother_name && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Mother's Name</p>
                            <p className="text-base font-semibold text-gray-900 mt-1">{selectedStudent.mother_name}</p>
                            {selectedStudent.mother_occupation && (
                              <p className="text-sm text-gray-600 mt-1">{selectedStudent.mother_occupation}</p>
                            )}
                          </div>
                        )}
                        {selectedStudent.guardian_name && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-medium text-gray-500 uppercase">Guardian's Name</p>
                            <p className="text-base font-semibold text-gray-900 mt-1">{selectedStudent.guardian_name}</p>
                            {selectedStudent.guardian_contact && (
                              <p className="text-sm text-gray-600 mt-1">{selectedStudent.guardian_contact}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Medical Information */}
                  {(selectedStudent.medical_conditions || selectedStudent.medications || selectedStudent.allergies) && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                        <Heart className="w-5 h-5 text-rose-600 shrink-0" />
                        Medical Information
                      </h4>
                      <div className="grid gap-4 mt-4">
                        {selectedStudent.medical_conditions && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Medical Conditions</p>
                            <p className="text-base text-gray-900 mt-1">{selectedStudent.medical_conditions}</p>
                          </div>
                        )}
                        {selectedStudent.medications && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Medications</p>
                            <p className="text-base text-gray-900 mt-1">{selectedStudent.medications}</p>
                          </div>
                        )}
                        {selectedStudent.allergies && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Allergies</p>
                            <p className="text-base text-gray-900 mt-1">{selectedStudent.allergies}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Emergency Contact */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <Phone className="w-5 h-5 text-rose-600 shrink-0" />
                      Emergency Contact
                    </h4>
                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500 uppercase">Emergency Contact Number</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{selectedStudent.emergency_contact}</p>
                    </div>
                  </div>

                  {/* QR Code */}
                  {selectedStudent.qr_code_data && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-indigo-600 shrink-0" />
                        QR Code
                      </h4>
                      <div className="mt-4 flex justify-center">
                        <img 
                          src={selectedStudent.qr_code_data} 
                          alt="Student QR Code"
                          className="w-48 h-48 border border-gray-200 rounded-lg p-2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Edit Mode - Tabbed Form */
                <div className="space-y-6">
                  {/* Edit Tabs */}
                  <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200">
                    {[
                      { id: 'personal', label: 'Personal Info', icon: User },
                      { id: 'education', label: 'Education', icon: GraduationCap },
                      { id: 'parents', label: 'Parents', icon: Users },
                      { id: 'medical', label: 'Medical', icon: Heart }
                    ].map(tab => {
                      const Icon = tab.icon
                      const isActive = editTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setEditTab(tab.id)}
                          className={`
                            px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all duration-200 whitespace-nowrap shrink-0
                            ${isActive 
                              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }
                          `}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`} />
                          {tab.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Personal Info Tab */}
                  {editTab === 'personal' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            First Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editedStudent.first_name || ''}
                            onChange={(e) => handleInputChange('first_name', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Enter first name"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Middle Name
                          </label>
                          <input
                            type="text"
                            value={editedStudent.middle_name || ''}
                            onChange={(e) => handleInputChange('middle_name', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Enter middle name"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Last Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editedStudent.last_name || ''}
                            onChange={(e) => handleInputChange('last_name', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Enter last name"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Contact Number <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <Phone className="w-4 h-4 text-gray-400" />
                            </div>
                            <input
                              type="tel"
                              value={editedStudent.contact_number || ''}
                              onChange={(e) => handleInputChange('contact_number', e.target.value)}
                              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                              placeholder="09123456789"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Date of Birth <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={editedStudent.date_of_birth || ''}
                            onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Sex <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={editedStudent.sex || ''}
                            onChange={(e) => handleInputChange('sex', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none"
                          >
                            <option value="">Select sex</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Complete Address <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <MapPin className="w-4 h-4 text-gray-400" />
                            </div>
                            <input
                              type="text"
                              value={editedStudent.address || ''}
                              onChange={(e) => handleInputChange('address', e.target.value)}
                              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                              placeholder="123 Street, Barangay, City, Province"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Education Tab */}
                  {editTab === 'education' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Grade Level <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <GraduationCap className="w-4 h-4 text-gray-400" />
                            </div>
                            <select
                              value={editedStudent.grade || ''}
                              onChange={(e) => handleInputChange('grade', e.target.value)}
                              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none"
                            >
                              <option value="">Select grade</option>
                              {[11,12].map(grade => (
                                <option key={grade} value={grade}>Grade {grade}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Previous Elementary School <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editedStudent.previous_elementary || ''}
                            onChange={(e) => handleInputChange('previous_elementary', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Name of elementary school"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Previous High School
                          </label>
                          <input
                            type="text"
                            value={editedStudent.previous_high_school || ''}
                            onChange={(e) => handleInputChange('previous_high_school', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Name of high school (if applicable)"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Previous Senior High School
                          </label>
                          <input
                            type="text"
                            value={editedStudent.previous_shs || ''}
                            onChange={(e) => handleInputChange('previous_shs', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Name of senior high school (if applicable)"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Parents Tab */}
                  {editTab === 'parents' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Father's Full Name
                          </label>
                          <input
                            type="text"
                            value={editedStudent.father_name || ''}
                            onChange={(e) => handleInputChange('father_name', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Full name of father"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Father's Occupation
                          </label>
                          <input
                            type="text"
                            value={editedStudent.father_occupation || ''}
                            onChange={(e) => handleInputChange('father_occupation', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Occupation of father"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Mother's Full Name
                          </label>
                          <input
                            type="text"
                            value={editedStudent.mother_name || ''}
                            onChange={(e) => handleInputChange('mother_name', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Full name of mother"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Mother's Occupation
                          </label>
                          <input
                            type="text"
                            value={editedStudent.mother_occupation || ''}
                            onChange={(e) => handleInputChange('mother_occupation', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Occupation of mother"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Guardian's Name
                          </label>
                          <input
                            type="text"
                            value={editedStudent.guardian_name || ''}
                            onChange={(e) => handleInputChange('guardian_name', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Full name of guardian"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Guardian's Contact
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <Phone className="w-4 h-4 text-gray-400" />
                            </div>
                            <input
                              type="tel"
                              value={editedStudent.guardian_contact || ''}
                              onChange={(e) => handleInputChange('guardian_contact', e.target.value)}
                              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                              placeholder="09123456789"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">
                          At least one parent or guardian information is required for emergency purposes.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Medical Tab */}
                  {editTab === 'medical' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Medical Conditions
                          </label>
                          <textarea
                            value={editedStudent.medical_conditions || ''}
                            onChange={(e) => handleInputChange('medical_conditions', e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                            placeholder="List any medical conditions (e.g., Asthma, Diabetes, etc.)"
                          />
                          <p className="text-xs text-gray-500">Leave blank if none</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Current Medications
                          </label>
                          <textarea
                            value={editedStudent.medications || ''}
                            onChange={(e) => handleInputChange('medications', e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                            placeholder="List any regular medications"
                          />
                          <p className="text-xs text-gray-500">Leave blank if none</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Allergies
                          </label>
                          <textarea
                            value={editedStudent.allergies || ''}
                            onChange={(e) => handleInputChange('allergies', e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                            placeholder="List any allergies"
                          />
                          <p className="text-xs text-gray-500">Leave blank if none</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            Emergency Contact Number <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <Phone className="w-4 h-4 text-gray-400" />
                            </div>
                            <input
                              type="tel"
                              value={editedStudent.emergency_contact || ''}
                              onChange={(e) => handleInputChange('emergency_contact', e.target.value)}
                              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                              placeholder="Emergency contact number"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-3">
                        <Heart className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-800">
                          This information helps us provide appropriate care in case of medical emergencies.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Save/Cancel Buttons */}
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setIsEditing(false)
                        setEditedStudent(selectedStudent)
                        setMessage({ type: '', text: '' })
                      }}
                      className="w-full sm:w-auto px-6 py-2.5 text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveChanges}
                      disabled={saveLoading}
                      className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saveLoading ? (
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
                </div>
              )}
            </div>

            {!isEditing && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowStudentModal(false)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Student</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this student? This action cannot be undone.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleProfilePhotoUpload}
        className="hidden"
      />
    </div>
  )
}
