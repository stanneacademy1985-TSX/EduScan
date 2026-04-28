'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'
import { Student, Attendance } from '../../../../lib/types'
import { useRouter } from 'next/navigation'
import { 
  User, 
  QrCode, 
  Calendar, 
  Clock, 
  Download, 
  LogOut, 
  Home,
  CheckCircle,
  XCircle,
  Clock as ClockIcon,
  BarChart,
  Edit2,
  Save,
  X,
  Camera,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Hash,
  Users,
  Heart,
  AlertCircle,
  UserCircle,
  Briefcase,
  Pill,
  Trash2,
  LayoutDashboard,
  Menu,
  ChevronLeft,
  ChevronRight,
  FileText,
  HeartHandshake,
  Cake,
  VenusAndMars,
  Home as HomeIcon,
  School,
  BadgeCheck,
  AlertTriangle,
  Info,
  BookOpen,
  Shield,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { generateEncryptedQRCode } from '../../../../lib/qr-generator'

// Extend Attendance type to include teacher_name and session_description
interface ExtendedAttendance extends Attendance {
  teacher_name?: string
  teacher_id?: string
  session_description?: string
  session_date?: string
}

export default function StudentDashboard() {
  const [student, setStudent] = useState<Student | null>(null)
  const [attendance, setAttendance] = useState<ExtendedAttendance[]>([])
  const [selectedSessionDescription, setSelectedSessionDescription] = useState<{
    date: string
    teacherName: string
    description: string
  } | null>(null)
  const [teacherStats, setTeacherStats] = useState<{[key: string]: {
    teacherName: string,
    total: number,
    present: number,
    late: number,
    absent: number,
    rate: number
  }}>({})
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTab, setEditTab] = useState('personal')
  const [editedStudent, setEditedStudent] = useState<Partial<Student>>({})
  const [saveLoading, setSaveLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [qrGenerating, setQrGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Helper function to format time to 12-hour format
  const formatTime = (time: string) => {
    if (!time) return 'N/A'
    
    try {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const hour12 = hour % 12 || 12
      return `${hour12}:${minutes} ${ampm}`
    } catch {
      return time
    }
  }

  const openSessionDescription = (record: ExtendedAttendance) => {
    if (!record.session_description) return

    setSelectedSessionDescription({
      date: record.date,
      teacherName: record.teacher_name || 'Unknown',
      description: record.session_description
    })
  }

  const closeSessionDescription = () => {
    setSelectedSessionDescription(null)
  }

  const getSessionDescriptionPreview = (description: string, maxLength = 96) => {
    if (!description) return ''
    return description.length > maxLength ? `${description.slice(0, maxLength).trim()}...` : description
  }

  const formatSessionDate = (date: string) => {
    if (!date) return 'Unknown date'

    try {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return date
    }
  }

  // Build teacher options from current attendance records
  const teacherOptions = Array.from(new Map(attendance.map(a => [a.teacher_id, a.teacher_name])))
    .filter(([id]) => id)
    .map(([id, name]) => ({ id: id as string, name: name || 'Unknown' }))

  const filteredAttendance = (selectedTeacherId && selectedTeacherId !== 'all')
    ? attendance.filter(r => r.teacher_id === selectedTeacherId)
    : attendance

  useEffect(() => {
    if (!selectedSessionDescription) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSessionDescription()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSessionDescription])

  useEffect(() => {
    setIsClient(true)
    
    const checkAuth = async () => {
      const currentSession = sessionStorage.getItem('currentSession')
      
      if (!currentSession) {
        router.push('/login')
        return
      }

      try {
        const session = JSON.parse(currentSession)
        await fetchStudentData(session.data)
      } catch (error) {
        console.error('Error parsing session data:', error)
        sessionStorage.removeItem('currentSession')
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  const fetchStudentData = async (studentLocal: any) => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentLocal.id)
        .single()

      if (studentError) throw studentError
      setStudent(studentData)
      setEditedStudent(studentData)

      // Check if student has a QR code, if not generate one
      if (!studentData.qr_code_data) {
        generateInitialQRCode(studentData.id, studentData.lrn)
      }

      // Fetch attendance with session details including session_description
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          *,
          teachers:teacher_id (
            full_name
          )
        `)
        .eq('student_id', studentLocal.id)
        .order('date', { ascending: false })

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError)
      }

      if (!attendanceError && attendanceData) {
        // Fetch session descriptions for all attendance records
        const sessionIds = attendanceData
          .map(record => record.session_id)
          .filter(id => id !== null && id !== undefined)
        
        console.log('Session IDs to fetch:', sessionIds)
        
        let sessionMap: { [key: string]: any } = {}
        
        if (sessionIds.length > 0) {
          const { data: sessionData, error: sessionError } = await supabase
            .from('attendance_sessions')
            .select(`
              id,
              teacher_id,
              session_description,
              date,
              start_time,
              end_time,
              late_threshold,
              absent_threshold,
              admin_users:teacher_id (
                full_name
              )
            `)
            .in('id', sessionIds)
          
          if (sessionError) {
            console.error('Error fetching sessions - Full error:', {
              message: sessionError.message,
              code: sessionError.code,
              details: sessionError.details,
              hint: sessionError.hint
            })
          } else {
            console.log('Sessions fetched successfully:', sessionData)
            if (sessionData) {
              sessionMap = sessionData.reduce((acc: any, session: any) => ({
                ...acc,
                [session.id]: session
              }), {})
            }
          }
        }

        const extendedData = attendanceData.map(record => ({
          ...record,
          teacher_name: record.teachers?.full_name || sessionMap[record.session_id]?.admin_users?.full_name || 'Unknown',
          teacher_id: record.teacher_id || sessionMap[record.session_id]?.teacher_id || null,
          session_description: sessionMap[record.session_id]?.session_description || null,
          session_date: sessionMap[record.session_id]?.date || record.date
        }))
        setAttendance(extendedData)
        calculateTeacherStats(extendedData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateInitialQRCode = async (studentId: string, lrn: string) => {
    try {
      console.log('Generating initial QR code for student...')
      const qrCodeDataURL = await generateEncryptedQRCode(lrn)

      const { error } = await supabase
        .from('students')
        .update({ qr_code_data: qrCodeDataURL })
        .eq('id', studentId)

      if (error) throw error

      // Update the student state with the new QR code
      setStudent(prev => prev ? { ...prev, qr_code_data: qrCodeDataURL } : null)
      
      console.log('✅ Initial QR code generated successfully')
    } catch (error) {
      console.error('Error generating initial QR code:', error)
    }
  }

  const calculateTeacherStats = (attendanceData: ExtendedAttendance[]) => {
    const stats: {[key: string]: any} = {}

    attendanceData.forEach(record => {
      const teacherId = record.teacher_id || 'unknown'
      const teacherName = record.teacher_name || 'Unknown Teacher'
      
      if (!stats[teacherId]) {
        stats[teacherId] = {
          teacherName,
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          rate: 0
        }
      }

      stats[teacherId].total++
      if (record.status === 'present') stats[teacherId].present++
      else if (record.status === 'late') stats[teacherId].late++
      else if (record.status === 'absent') stats[teacherId].absent++
    })

    Object.keys(stats).forEach(teacherId => {
      const stat = stats[teacherId]
      stat.rate = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0
    })

    setTeacherStats(stats)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('currentSession')
    router.push('/login')
  }

  const handleDownloadQR = () => {
    if (!student?.qr_code_data) return
    const link = document.createElement('a')
    link.href = student.qr_code_data
    link.download = `QR_${student.lrn}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedStudent(student || {})
      setEditTab('personal')
    }
    setIsEditing(!isEditing)
    setMessage({ type: '', text: '' })
  }

  const handleInputChange = (field: string, value: any) => {
    setEditedStudent(prev => ({ ...prev, [field]: value }))
  }

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !student) return

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
        .eq('id', student.id)

      if (error) throw error

      setStudent(prev => prev ? { ...prev, profile_photo_base64: photoBase64 } : null)
      setEditedStudent(prev => ({ ...prev, profile_photo_base64: photoBase64 }))

      const currentSession = sessionStorage.getItem('currentSession')
      if (currentSession) {
        const session = JSON.parse(currentSession)
        session.data = {
          ...session.data,
          profilePhoto: photoBase64
        }
        sessionStorage.setItem('currentSession', JSON.stringify(session))
      }

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
    if (!student) return

    setUploadingPhoto(true)
    try {
      const { error } = await supabase
        .from('students')
        .update({ profile_photo_base64: null })
        .eq('id', student.id)

      if (error) throw error

      setStudent(prev => prev ? { ...prev, profile_photo_base64: undefined } : null)
      setEditedStudent(prev => ({ ...prev, profile_photo_base64: undefined }))

      const currentSession = sessionStorage.getItem('currentSession')
      if (currentSession) {
        const session = JSON.parse(currentSession)
        session.data = {
          ...session.data,
          profilePhoto: null
        }
        sessionStorage.setItem('currentSession', JSON.stringify(session))
      }

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
    if (!student) return
    
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
          section: editedStudent.section,
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
        .eq('id', student.id)

      if (error) throw error

      const currentSession = sessionStorage.getItem('currentSession')
      if (currentSession) {
        const session = JSON.parse(currentSession)
        session.data = {
          ...session.data,
          name: `${editedStudent.first_name} ${editedStudent.last_name}`,
          firstName: editedStudent.first_name,
          lastName: editedStudent.last_name,
          grade: editedStudent.grade,
          section: editedStudent.section
        }
        sessionStorage.setItem('currentSession', JSON.stringify(session))
      }

      await fetchStudentData(editedStudent)
      
      setIsEditing(false)
      setMessage({ type: 'success', text: 'Information updated successfully!' })
      
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
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'late':
        return <ClockIcon className="w-4 h-4 text-amber-500" />
      case 'absent':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <CheckCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'late':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'absent':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const renderProfilePhoto = (size: 'sm' | 'md' | 'lg' = 'md') => {
    const dimensions = {
      sm: 'w-8 h-8',
      md: 'w-16 h-16',
      lg: 'w-20 h-20'
    }[size]
    
    if (student?.profile_photo_base64) {
      return (
        <img 
          src={student.profile_photo_base64} 
          alt={student.full_name}
          className={`${dimensions} rounded-full object-cover border-2 border-white shadow-md`}
        />
      )
    }
    return (
      <div className={`${dimensions} rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center border-2 border-white shadow-md`}>
        <User className={size === 'lg' ? 'w-8 h-8 text-blue-600' : size === 'md' ? 'w-6 h-6 text-blue-600' : 'w-4 h-4 text-blue-600'} />
      </div>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Welcome Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
                  Welcome back,{' '}
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {student?.first_name}!
                  </span>
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">Here's your profile overview</p>
              </div>
              
              <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm inline-flex items-center self-start sm:self-center">
                <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                <p className="text-xs sm:text-sm font-medium text-gray-700">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
            </div>

            {/* Profile & QR Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Student Information Card */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-200 p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">Student Information</h2>
                    <p className="text-gray-500 text-xs">Complete profile details</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">LRN</p>
                      <p className="font-mono font-bold text-gray-900 text-sm sm:text-base break-all">{student?.lrn}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</p>
                      <p className="font-bold text-gray-900 text-sm sm:text-base break-words">{student?.full_name}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</p>
                      <p className="text-xs sm:text-sm text-gray-900 break-all">{student?.email}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</p>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">{student?.contact_number}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Grade & Section</p>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">Grade {student?.grade} - {student?.section}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Emergency</p>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">{student?.emergency_contact}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg p-5 sm:p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 sm:w-40 h-32 sm:h-40 bg-white/10 rounded-full -mr-12 -mt-12"></div>
                <div className="absolute bottom-0 left-0 w-28 sm:w-32 h-28 sm:h-32 bg-white/10 rounded-full -ml-10 -mb-10"></div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <QrCode className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">Your QR Code</h2>
                      <p className="text-blue-100 text-xs">Scan for attendance</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-3 border-white/50 overflow-hidden shadow-lg">
                        {renderProfilePhoto('lg')}
                      </div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5 bg-green-400 border-2 border-white rounded-full"></div>
                    </div>

                    {student?.qr_code_data ? (
                      <>
                        <div className="relative mb-4">
                          <img
                            src={student.qr_code_data}
                            alt="Student QR Code"
                            className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 bg-white rounded-xl shadow-lg p-2"
                          />
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
                            <Shield className="w-3 h-3 text-purple-600" />
                          </div>
                        </div>
                        
                        <div className="w-full space-y-2">
                          <button
                            onClick={handleDownloadQR}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-md text-sm"
                          >
                            <Download className="w-4 h-4" />
                            Download QR Code
                          </button>
                          
                          <div className="flex items-center justify-center gap-2 text-xs text-blue-100">
                            <Shield className="w-3 h-3" />
                            <span className="hidden sm:inline">Encrypted QR Code • AES-256</span>
                            <span className="sm:hidden">Encrypted • AES-256</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-white">
                        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-xs sm:text-sm">Generating your secure QR code...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Attendance - Mobile Card View */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800">Recent Attendance</h2>
                      <p className="text-gray-500 text-xs">Your latest records</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-medium text-sm w-full sm:w-auto"
                  >
                    <BarChart className="w-4 h-4" />
                    View Full History
                  </button>
                </div>
              </div>

              {attendance.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-700 mb-1">No attendance records yet</h3>
                  <p className="text-sm text-gray-500">Records will appear after your first scan</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {/* Mobile Card View - Visible on mobile */}
                  <div className="block md:hidden">
                    {attendance.slice(0, 5).map((record) => (
                      <div key={record.id} className="p-4 space-y-2 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(record.date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                            {getStatusIcon(record.status)}
                            <span className="capitalize">{record.status}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{formatTime(record.time_in)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCircle className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 break-words">{record.teacher_name || 'Unknown'}</span>
                        </div>
                        {record.session_description && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-xs text-blue-800 font-medium">📋 Session Details:</p>
                            <p className="text-xs text-blue-700 mt-1 break-words">{record.session_description}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View - Hidden on mobile */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="py-3 px-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="py-3 px-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                          <th className="py-3 px-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Teacher</th>
                          <th className="py-3 px-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="py-3 px-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Session Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {attendance.slice(0, 5).map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50/50">
                            <td className="py-3 px-5 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">
                                {new Date(record.date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            </td>
                            <td className="py-3 px-5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {formatTime(record.time_in)}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-5">
                              <span className="text-sm text-gray-600">
                                {record.teacher_name || 'Unknown'}
                              </span>
                            </td>
                            <td className="py-3 px-5 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                                {getStatusIcon(record.status)}
                                {record.status}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              {record.session_description ? (
                                <div className="max-w-xs">
                                  <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-lg inline-block">
                                    {record.session_description}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">No description</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      
      case 'profile':
        return (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Profile header - keeping existing code */}
            <div className="relative px-4 sm:px-6 md:px-8 py-5 sm:py-6 bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-24 -right-24 w-48 sm:w-64 h-48 sm:h-64 bg-white rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-48 sm:w-64 h-48 sm:h-64 bg-white rounded-full blur-3xl"></div>
              </div>
              
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 blur-xl opacity-60"></div>
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-xl overflow-hidden">
                      {renderProfilePhoto('lg')}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">My Profile</h2>
                    <p className="text-indigo-100 text-xs sm:text-sm mt-1">Manage your personal information</p>
                  </div>
                </div>
                <button
                  onClick={handleEditToggle}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl transition-all duration-200 font-medium text-sm border border-white/30 flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {isEditing ? (
                    <>
                      <X className="w-4 h-4" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" />
                      Edit Profile
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Message display */}
            {message.text && (
              <div className={`mx-4 sm:mx-6 md:mx-8 mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700' 
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                <div className="flex items-center gap-3">
                  {message.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <p className="text-xs sm:text-sm font-medium">{message.text}</p>
                </div>
              </div>
            )}

            {/* Photo upload section - keeping existing code */}
            {isEditing && (
              <div className="mx-4 sm:mx-6 md:mx-8 mt-4 sm:mt-6 p-4 sm:p-6 bg-gradient-to-r from-indigo-50/50 via-purple-50/50 to-pink-50/50 rounded-xl border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                  <div className="relative group flex-shrink-0 self-center sm:self-auto">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 blur-xl opacity-60 group-hover:opacity-80 transition-opacity"></div>
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white shadow-xl overflow-hidden">
                      {uploadingPhoto ? (
                        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        <>
                          {student?.profile_photo_base64 ? (
                            <img 
                              src={student.profile_photo_base64} 
                              alt="Profile" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                              <User className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform duration-200 border-2 border-white">
                      <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleProfilePhotoUpload}
                        className="hidden"
                        disabled={uploadingPhoto}
                      />
                    </label>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center justify-center sm:justify-start gap-2">
                      <BadgeCheck className="w-4 h-4 text-indigo-600" />
                      Profile Photo
                    </h4>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="flex items-center justify-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl transition-all duration-200 text-xs sm:text-sm font-medium shadow-md hover:shadow-lg disabled:opacity-50"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Upload New Photo
                      </button>
                      {student?.profile_photo_base64 && (
                        <button
                          onClick={handleRemoveProfilePhoto}
                          disabled={uploadingPhoto}
                          className="flex items-center justify-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white hover:bg-gray-50 text-red-600 rounded-xl transition-all duration-200 text-xs sm:text-sm font-medium border border-gray-300 shadow-sm hover:shadow-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Square image recommended. Max size: 2MB (JPG, PNG, GIF)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rest of profile content - keeping existing code */}
            <div className="p-4 sm:p-6 md:p-8">
              {!isEditing ? (
                <div className="space-y-6 sm:space-y-8">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Full Name</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{student?.full_name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">LRN</p>
                        <p className="text-sm sm:text-base font-mono font-semibold text-gray-900 mt-1 break-all">{student?.lrn}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                        <p className="text-sm sm:text-base text-gray-900 mt-1 break-all">{student?.email}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Contact Number</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1">{student?.contact_number}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Date of Birth</p>
                        <p className="text-sm sm:text-base text-gray-900 mt-1">
                          {student?.date_of_birth && new Date(student.date_of_birth).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Sex</p>
                        <p className="text-sm sm:text-base text-gray-900 mt-1">{student?.sex || 'Not specified'}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-medium text-gray-500 uppercase">Address</p>
                        <p className="text-sm sm:text-base text-gray-900 mt-1 break-words">{student?.address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Academic Information */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                      Academic Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Grade Level</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1">Grade {student?.grade}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Section</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1">Section {student?.section}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-medium text-gray-500 uppercase">Previous Elementary</p>
                        <p className="text-sm sm:text-base text-gray-900 mt-1 break-words">{student?.previous_elementary || 'N/A'}</p>
                      </div>
                      {student?.previous_high_school && (
                        <div className="sm:col-span-2">
                          <p className="text-xs font-medium text-gray-500 uppercase">Previous High School</p>
                          <p className="text-sm sm:text-base text-gray-900 mt-1 break-words">{student.previous_high_school}</p>
                        </div>
                      )}
                      {student?.previous_shs && (
                        <div className="sm:col-span-2">
                          <p className="text-xs font-medium text-gray-500 uppercase">Previous Senior High School</p>
                          <p className="text-sm sm:text-base text-gray-900 mt-1 break-words">{student.previous_shs}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Parents & Guardian */}
                  {(student?.father_name || student?.mother_name || student?.guardian_name) && (
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                        <HeartHandshake className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                        Parents & Guardian
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                        {student?.father_name && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Father's Name</p>
                            <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{student.father_name}</p>
                            {student.father_occupation && (
                              <p className="text-xs sm:text-sm text-gray-600 mt-1">{student.father_occupation}</p>
                            )}
                          </div>
                        )}
                        {student?.mother_name && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Mother's Name</p>
                            <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{student.mother_name}</p>
                            {student.mother_occupation && (
                              <p className="text-xs sm:text-sm text-gray-600 mt-1">{student.mother_occupation}</p>
                            )}
                          </div>
                        )}
                        {student?.guardian_name && (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-medium text-gray-500 uppercase">Guardian's Name</p>
                            <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{student.guardian_name}</p>
                            {student.guardian_contact && (
                              <p className="text-xs sm:text-sm text-gray-600 mt-1 break-all">{student.guardian_contact}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Medical Information */}
                  {(student?.medical_conditions || student?.medications || student?.allergies) && (
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                        <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
                        Medical Information
                      </h3>
                      <div className="grid gap-4 sm:gap-6 mt-4">
                        {student?.medical_conditions && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Medical Conditions</p>
                            <p className="text-sm sm:text-base text-gray-900 mt-1 break-words">{student.medical_conditions}</p>
                          </div>
                        )}
                        {student?.medications && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Medications</p>
                            <p className="text-sm sm:text-base text-gray-900 mt-1 break-words">{student.medications}</p>
                          </div>
                        )}
                        {student?.allergies && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">Allergies</p>
                            <p className="text-sm sm:text-base text-gray-900 mt-1 break-words">{student.allergies}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Emergency Contact */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-2">
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
                      Emergency Contact
                    </h3>
                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500 uppercase">Emergency Contact Number</p>
                      <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1">{student?.emergency_contact}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Edit tabs - keeping existing code */}
                  <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2 border-b border-gray-200">
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
                            px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-all duration-200 whitespace-nowrap
                            ${isActive 
                              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }
                          `}
                        >
                          <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`} />
                          {tab.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Edit forms - keeping existing code, just need to ensure grade/section dropdowns use SPC/SPP */}
                  {editTab === 'personal' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <UserCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                            First Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editedStudent.first_name || ''}
                            onChange={(e) => handleInputChange('first_name', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                            placeholder="Enter your first name"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <UserCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                            Middle Name
                          </label>
                          <input
                            type="text"
                            value={editedStudent.middle_name || ''}
                            onChange={(e) => handleInputChange('middle_name', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                            placeholder="Enter your middle name"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <UserCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                            Last Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editedStudent.last_name || ''}
                            onChange={(e) => handleInputChange('last_name', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                            placeholder="Enter your last name"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                            Contact Number <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                            </div>
                            <input
                              type="tel"
                              value={editedStudent.contact_number || ''}
                              onChange={(e) => handleInputChange('contact_number', e.target.value)}
                              className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                              placeholder="09123456789"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Cake className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                            Date of Birth <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={editedStudent.date_of_birth || ''}
                            onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <VenusAndMars className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                            Sex <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={editedStudent.sex || ''}
                            onChange={(e) => handleInputChange('sex', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none text-sm"
                          >
                            <option value="">Select sex</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2 space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <HomeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                            Complete Address <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                            </div>
                            <input
                              type="text"
                              value={editedStudent.address || ''}
                              onChange={(e) => handleInputChange('address', e.target.value)}
                              className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                              placeholder="123 Street, Barangay, City, Province"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {editTab === 'education' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                            Grade Level <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                            </div>
                            <select
                              value={editedStudent.grade || ''}
                              onChange={(e) => {
                                const newGrade = e.target.value;
                                handleInputChange('grade', newGrade);
                                // Auto-set section based on grade
                                if (newGrade === '11') {
                                  handleInputChange('section', 'SPC');
                                } else if (newGrade === '12') {
                                  handleInputChange('section', 'SPP');
                                }
                              }}
                              className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none text-sm"
                            >
                              <option value="">Select grade</option>
                              <option value="11">Grade 11</option>
                              <option value="12">Grade 12</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                            Section <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                            </div>
                            <select
                              value={editedStudent.section || ''}
                              onChange={(e) => handleInputChange('section', e.target.value)}
                              className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none text-sm"
                              disabled={!editedStudent.grade}
                            >
                              <option value="">Select section</option>
                              {editedStudent.grade === '11' && (
                                <option value="SPC">SPC</option>
                              )}
                              {editedStudent.grade === '12' && (
                                <option value="SPP">SPP</option>
                              )}
                            </select>
                          </div>
                          {!editedStudent.grade && (
                            <p className="text-xs text-amber-600 mt-1">Please select grade first</p>
                          )}
                        </div>

                        <div className="sm:col-span-2 space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <School className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                            Previous Elementary School <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editedStudent.previous_elementary || ''}
                            onChange={(e) => handleInputChange('previous_elementary', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                            placeholder="Name of elementary school"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <School className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                            Previous High School
                          </label>
                          <input
                            type="text"
                            value={editedStudent.previous_high_school || ''}
                            onChange={(e) => handleInputChange('previous_high_school', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                            placeholder="Name of high school (if applicable)"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <School className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                            Previous Senior High School
                          </label>
                          <input
                            type="text"
                            value={editedStudent.previous_shs || ''}
                            onChange={(e) => handleInputChange('previous_shs', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                            placeholder="Name of senior high school (if applicable)"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {editTab === 'parents' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <UserCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                            Father's Full Name
                          </label>
                          <input
                            type="text"
                            value={editedStudent.father_name || ''}
                            onChange={(e) => handleInputChange('father_name', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                            placeholder="Full name of father"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                            Father's Occupation
                          </label>
                          <input
                            type="text"
                            value={editedStudent.father_occupation || ''}
                            onChange={(e) => handleInputChange('father_occupation', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                            placeholder="Occupation of father"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <UserCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                            Mother's Full Name
                          </label>
                          <input
                            type="text"
                            value={editedStudent.mother_name || ''}
                            onChange={(e) => handleInputChange('mother_name', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                            placeholder="Full name of mother"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                            Mother's Occupation
                          </label>
                          <input
                            type="text"
                            value={editedStudent.mother_occupation || ''}
                            onChange={(e) => handleInputChange('mother_occupation', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                            placeholder="Occupation of mother"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <UserCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                            Guardian's Name
                          </label>
                          <input
                            type="text"
                            value={editedStudent.guardian_name || ''}
                            onChange={(e) => handleInputChange('guardian_name', e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                            placeholder="Full name of guardian"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                            Guardian's Contact
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                            </div>
                            <input
                              type="tel"
                              value={editedStudent.guardian_contact || ''}
                              onChange={(e) => handleInputChange('guardian_contact', e.target.value)}
                              className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                              placeholder="09123456789"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-3 sm:p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 sm:gap-3">
                        <Info className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs sm:text-xs text-amber-800">
                          At least one parent or guardian information is required for emergency purposes.
                        </p>
                      </div>
                    </div>
                  )}

                  {editTab === 'medical' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
                            Medical Conditions
                          </label>
                          <textarea
                            value={editedStudent.medical_conditions || ''}
                            onChange={(e) => handleInputChange('medical_conditions', e.target.value)}
                            rows={3}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all resize-none text-sm"
                            placeholder="List any medical conditions (e.g., Asthma, Diabetes, etc.)"
                          />
                          <p className="text-xs text-gray-500">Leave blank if none</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
                            Current Medications
                          </label>
                          <textarea
                            value={editedStudent.medications || ''}
                            onChange={(e) => handleInputChange('medications', e.target.value)}
                            rows={3}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all resize-none text-sm"
                            placeholder="List any regular medications"
                          />
                          <p className="text-xs text-gray-500">Leave blank if none</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
                            Allergies
                          </label>
                          <textarea
                            value={editedStudent.allergies || ''}
                            onChange={(e) => handleInputChange('allergies', e.target.value)}
                            rows={3}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all resize-none text-sm"
                            placeholder="List any allergies"
                          />
                          <p className="text-xs text-gray-500">Leave blank if none</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
                            Emergency Contact Number <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                            </div>
                            <input
                              type="tel"
                              value={editedStudent.emergency_contact || ''}
                              onChange={(e) => handleInputChange('emergency_contact', e.target.value)}
                              className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-sm"
                              placeholder="Emergency contact number"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-3 sm:p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-2 sm:gap-3">
                        <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs sm:text-xs text-rose-800">
                          This information helps us provide appropriate care in case of medical emergencies.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
                    <button
                      onClick={handleEditToggle}
                      className="px-4 sm:px-6 py-2 sm:py-3 text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium flex items-center justify-center gap-2 text-sm"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveChanges}
                      disabled={saveLoading}
                      className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {saveLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
          </div>
        )
      
      case 'qr':
        return (
          <div className="max-w-2xl mx-auto px-4 sm:px-0">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-xl p-4 sm:p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 sm:w-48 h-32 sm:h-48 bg-white/10 rounded-full -mr-12 -mt-12 sm:-mr-16 sm:-mt-16"></div>
              <div className="absolute bottom-0 left-0 w-28 sm:w-36 h-28 sm:h-36 bg-white/10 rounded-full -ml-10 -mb-10 sm:-ml-12 sm:-mb-12"></div>
              
              <div className="relative">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">My QR Code</h2>
                      <p className="text-blue-100 text-xs">Your LRN: {student?.lrn}</p>
                    </div>
                  </div>
                  
                  <div className="bg-green-500/20 backdrop-blur-sm px-2 py-1 sm:px-3 rounded-full flex items-center gap-1 border border-green-400/30 w-fit">
                    <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-300" />
                    <span className="text-[10px] sm:text-xs text-green-300">Encrypted</span>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center py-2 sm:py-4">
                  <div className="relative mb-3 sm:mb-5">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-3 border-white/50 overflow-hidden shadow-lg">
                      {renderProfilePhoto('lg')}
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5 bg-green-400 border-2 border-white rounded-full"></div>
                  </div>

                  {student?.qr_code_data ? (
                    <>
                      <div className="relative mb-4 sm:mb-5">
                        <img
                          src={student.qr_code_data}
                          alt="Student QR Code"
                          className="w-32 h-32 sm:w-40 sm:h-40 md:w-44 md:h-44 bg-white rounded-xl shadow-lg p-2 sm:p-3"
                        />
                        <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-6 h-6 sm:w-7 sm:h-7 bg-white rounded-full flex items-center justify-center shadow-lg">
                          <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-600" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                        <button
                          onClick={handleDownloadQR}
                          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-md text-sm sm:text-base"
                        >
                          <Download className="w-4 h-4" />
                          Download QR Code
                        </button>
                      </div>
                      
                      <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-800/30 backdrop-blur-sm rounded-xl border border-white/20">
                        <p className="text-[10px] sm:text-xs text-white text-center leading-relaxed">
                          <span className="font-bold text-green-300">🔐 Permanently Encrypted QR Code</span><br />
                          <span className="hidden sm:inline">Your QR code is encrypted with AES-256 and will never expire. Only authorized scanners can read it.</span>
                          <span className="sm:hidden">Encrypted with AES-256. Only authorized scanners can read it.</span>
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-white">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-xs sm:text-sm">Generating your secure QR code...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      
      case 'history':
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold text-white">Attendance History</h2>
                    <p className="text-blue-100 text-xs sm:text-sm">Complete record of your attendance by teacher</p>
                  </div>
                </div>
              </div>

              {Object.keys(teacherStats).length > 0 && (
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Teacher Performance Summary</h3>
                  
                  {/* Mobile Card View */}
                  <div className="block md:hidden space-y-3">
                    {Object.values(teacherStats).map((stat, index) => (
                      <div key={index} className="bg-gray-50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <UserCircle className="w-5 h-5 text-gray-500" />
                            <span className="font-semibold text-gray-900">{stat.teacherName}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            stat.rate >= 90 ? 'bg-green-100 text-green-700' :
                            stat.rate >= 75 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {stat.rate}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-gray-500">Sessions</p>
                            <p className="font-bold text-gray-900">{stat.total}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-gray-500">Present</p>
                            <p className="font-bold text-green-600">{stat.present}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-xs text-gray-500">Late</p>
                            <p className="font-bold text-yellow-600">{stat.late}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Teacher</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sessions</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Present</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Late</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Absent</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Object.values(teacherStats).map((stat, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <UserCircle className="w-5 h-5 text-gray-400" />
                                <span className="font-medium text-gray-900">{stat.teacherName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">{stat.total}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                {stat.present}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                {stat.late}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                {stat.absent}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                stat.rate >= 90 ? 'bg-green-100 text-green-700' :
                                stat.rate >= 75 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {stat.rate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed Attendance Records with Session Description */}
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Detailed Attendance Records</h3>
                  <div className="ml-2">
                    <label className="sr-only">Filter by teacher</label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white"
                    >
                      <option value="all">All teachers</option>
                      {teacherOptions.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {filteredAttendance.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-gray-400" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-1">No attendance records yet</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Your attendance history will appear here after your first scan</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="block md:hidden space-y-3">
                      {filteredAttendance.map((record) => (
                        <div key={record.id} className="bg-gray-50 rounded-2xl p-4 space-y-3 shadow-sm border border-gray-100">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                              <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="font-medium text-gray-900 text-sm break-words">
                                {new Date(record.date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </span>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                              {getStatusIcon(record.status)}
                              <span className="capitalize">{record.status}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-700 break-words">{formatTime(record.time_in)}</span>
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <UserCircle className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-700 break-words">{record.teacher_name || 'Unknown'}</span>
                          </div>
                          {record.session_description && (
                            <button
                              type="button"
                              onClick={() => openSessionDescription(record)}
                              className="mt-2 w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                            >
                              <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-blue-800 mb-1">Session Description</p>
                                  <p className="text-sm text-blue-700 break-words leading-relaxed">
                                    {getSessionDescriptionPreview(record.session_description)}
                                  </p>
                                  {record.session_description.length > 96 && (
                                    <span className="mt-2 inline-flex text-xs font-medium text-blue-800">
                                      Tap to view full description
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          )}
                          <div className="text-xs text-gray-500 break-words">
                            {formatSessionDate(record.date)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto -mx-4 px-4">
                      <table className="w-full min-w-[820px]">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time In</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Teacher</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Session Description</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Day</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredAttendance.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50/50">
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(record.date).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </span>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-900">
                                    {formatTime(record.time_in)}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <UserCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-sm text-gray-600 break-words">
                                    {record.teacher_name || 'Unknown'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                                  {getStatusIcon(record.status)}
                                  {record.status}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {record.session_description ? (
                                  <div className="max-w-lg">
                                    <button
                                      type="button"
                                      onClick={() => openSessionDescription(record)}
                                      className="w-full text-left flex items-start gap-2 rounded-lg px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                                    >
                                      <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-blue-800 mb-1">Session Description</p>
                                        <p className="text-xs text-blue-700 break-words leading-relaxed">
                                          {getSessionDescriptionPreview(record.session_description)}
                                        </p>
                                        {record.session_description.length > 96 && (
                                          <span className="mt-2 inline-flex text-[11px] font-medium text-blue-800">
                                            Click to view full description
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">No description</span>
                                )}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap align-top">
                                <span className="text-sm text-gray-600">
                                  {new Date(record.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (!isClient || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 sm:mt-6 text-gray-600 text-sm sm:text-lg animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center px-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-700">Student not found</h2>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 sm:mt-6 px-6 sm:px-8 py-2 sm:py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-base sm:text-lg"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        ></div>
      )}

      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          bg-white border-r border-gray-200 shadow-lg
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-20' : 'w-64'}
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-16 sm:h-20 flex items-center px-3 sm:px-4 border-b border-gray-200 relative">
          {!sidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 relative flex-shrink-0">
                  <img 
                    src="/logo.png" 
                    alt="St. Anne's Academy" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<span className="text-white font-bold text-base sm:text-lg bg-gradient-to-br from-pink-600 to-purple-800 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center">SAA</span>';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-sm font-bold text-gray-900 truncate">EduScan Portal</h2>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">Student Dashboard</p>
                </div>
              </div>
              <button 
                onClick={() => setSidebarCollapsed(true)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors z-10"
              >
                <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600" />
              </button>
            </>
          ) : (
            <>
              <div className="w-full flex justify-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 relative flex-shrink-0">
                  <img 
                    src="/logo.png" 
                    alt="SAA" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<span className="text-white font-bold text-base sm:text-lg bg-gradient-to-br from-pink-600 to-purple-800 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center">SAA</span>';
                    }}
                  />
                </div>
              </div>
              <button 
                onClick={() => setSidebarCollapsed(false)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors z-10"
              >
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600" />
              </button>
            </>
          )}
        </div>

        {!sidebarCollapsed ? (
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              {renderProfilePhoto('sm')}
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{student.first_name} {student.last_name}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate">Grade {student.grade} - {student.section}</p>
                <p className="text-[10px] font-mono text-gray-400 mt-0.5 truncate">{student.lrn.slice(-8)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 sm:p-4 border-b border-gray-200 flex justify-center">
            <div className="relative">
              {renderProfilePhoto('sm')}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
          </div>
        )}

        <nav className="p-2 sm:p-3 space-y-1">
          <button
            onClick={() => { setActiveTab('overview'); setMobileSidebarOpen(false); }}
            className={`
              w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl transition-colors
              ${activeTab === 'overview' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-xs sm:text-sm font-medium truncate">Overview</span>}
          </button>

          <button
            onClick={() => { setActiveTab('profile'); setMobileSidebarOpen(false); }}
            className={`
              w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl transition-colors
              ${activeTab === 'profile' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-xs sm:text-sm font-medium truncate">My Profile</span>}
          </button>

          <button
            onClick={() => { setActiveTab('qr'); setMobileSidebarOpen(false); }}
            className={`
              w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl transition-colors
              ${activeTab === 'qr' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <QrCode className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-xs sm:text-sm font-medium truncate">My QR Code</span>}
          </button>

          <button
            onClick={() => { setActiveTab('history'); setMobileSidebarOpen(false); }}
            className={`
              w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl transition-colors
              ${activeTab === 'history' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-xs sm:text-sm font-medium truncate">Attendance History</span>}
          </button>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-xs sm:text-sm font-medium truncate">Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="lg:hidden p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                </button>
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 lg:hidden">
                  {activeTab === 'overview' && 'Overview'}
                  {activeTab === 'profile' && 'My Profile'}
                  {activeTab === 'qr' && 'My QR Code'}
                  {activeTab === 'history' && 'Attendance History'}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
          {renderContent()}
        </main>

        {selectedSessionDescription && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6"
            onClick={closeSessionDescription}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="session-description-title"
              className="w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 sm:px-6 py-4">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-blue-600">Attendance Session</p>
                  <h2 id="session-description-title" className="text-lg sm:text-xl font-bold text-gray-900 mt-1 break-words">
                    Session Description
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                    {selectedSessionDescription.date} • {selectedSessionDescription.teacherName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSessionDescription}
                  className="flex-shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                  aria-label="Close session description"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[calc(88vh-110px)] overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm sm:text-base leading-relaxed text-blue-900 whitespace-pre-wrap break-words">
                      {selectedSessionDescription.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-auto py-2 sm:py-3 px-3 sm:px-4 lg:px-6 border-t border-gray-200 bg-white/80">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2 text-[10px] sm:text-xs text-gray-500">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                <img 
                  src="/logo.png" 
                  alt="St. Anne's Academy" 
                  className="w-full h-full object-contain opacity-75"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <span className="font-medium text-gray-700 whitespace-nowrap">St. Anne's Academy</span>
            </div>
            <p className="text-gray-600 text-center">EduScan QR Attendance System • © {new Date().getFullYear()}</p>
            <p className="text-gray-500 font-mono">Grade {student.grade}-{student.section}</p>
          </div>
        </footer>
      </div>

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
