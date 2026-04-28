'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../../../lib/supabase'
import { fetchAdminById, getAssignedStudentIds, getStoredAdminSession, hasAssignedScope, isSuperAdmin, storeAdminSession, type AdminSessionUser } from '../../../../../lib/admin-auth'
import { validateLrn } from '../../../../../lib/lrn-validation'
import { useRouter } from 'next/navigation'
import { 
  QrCode,
  Camera,
  CameraOff,
  CheckCircle,
  XCircle,
  AlertCircle,  
  Users,
  Calendar,
  Clock,
  RefreshCw,
  Zap,
  ZapOff,
  Volume2,
  VolumeX,
  Scan,
  Loader2,
  Shield,
  Lock,
  UserPlus,
  CheckSquare,
  MessageSquare
} from 'lucide-react'
import jsQR from 'jsqr'
import { decryptFromQR, extractLRNFromDecrypted } from '../../../../../lib/encryption'

interface Student {
  id: string
  lrn: string
  full_name: string
  first_name: string
  last_name: string
  grade: string
  section: string
  profile_photo_base64: string | null
  guardian_contact?: string | null
  contact_number?: string | null
  email?: string | null
}

interface AttendanceSession {
  id: string
  grade: string
  section: string
  date: string
  start_time: string
  late_threshold: string
  absent_threshold: string
  is_active: boolean
  teacher_id: string
  session_description?: string | null
  admin_users?: {
    full_name: string
  }
}

const buildGradeVariants = (grade: string): string[] => {
  const raw = (grade || '').trim()
  if (!raw) return []

  const digits = raw.replace(/[^0-9]/g, '')
  if (digits === '11' || digits === '12') {
    return Array.from(new Set([raw, digits, `Grade ${digits}`]))
  }

  return [raw]
}

export default function QRScannerPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanningRef = useRef<boolean>(false)
  const animationRef = useRef<number>(0)
  const scanCooldownRef = useRef<{ [key: string]: number }>({})
  const lastFrameTimeRef = useRef<number>(0)
  const frameSkipRef = useRef<number>(0)
  
  const [scannerActive, setScannerActive] = useState(false)
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null)
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<string>('')
  const [lastScanTime, setLastScanTime] = useState<number>(0)
  const [isProcessingQR, setIsProcessingQR] = useState(false)
  const [processingMessage, setProcessingMessage] = useState<string>('')
  const [scanResult, setScanResult] = useState<{
    success: boolean
    message: string
    student?: Student
    isEncrypted?: boolean
    isTemporary?: boolean
    needsRegistration?: boolean
  } | null>(null)
  
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [selectedSessionDetails, setSelectedSessionDetails] = useState<AttendanceSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null)
  const [stats, setStats] = useState({
    todayScans: 0,
    activeSession: null as AttendanceSession | null,
    sectionStudents: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0
  })
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualLRN, setManualLRN] = useState('')
  const [manualName, setManualName] = useState('')
  const [tempRegistrationLoading, setTempRegistrationLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'scanner' | 'manual'>('scanner')
  const [manualRemarks, setManualRemarks] = useState('')
  const [manualStatus, setManualStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present')
  const [useManualStatus, setUseManualStatus] = useState(false)
  const [markAllLoading, setMarkAllLoading] = useState(false)
  const [sectionStudents, setSectionStudents] = useState<Array<{
    id: string
    lrn: string
    full_name: string
    grade: string
    section: string
    profile_photo_base64: string | null
  }>>([])
  const [studentAttendanceStatus, setStudentAttendanceStatus] = useState<{ [key: string]: string }>({})
  const [studentRemarks, setStudentRemarks] = useState<{ [key: string]: string }>({})

  const [beepSound] = useState(() => {
    if (typeof Audio !== 'undefined') {
      return new Audio('/valid.mp3')
    }
    return null
  })
  
  const [errorSound] = useState(() => {
    if (typeof Audio !== 'undefined') {
      return new Audio('/invalid.mp3')
    }
    return null
  })

  useEffect(() => {
    const bootstrap = async () => {
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
        router.push('/super-admin/dashboard')
        return
      }

      setAdmin(freshAdmin)
      storeAdminSession(freshAdmin)
      localStorage.setItem('admin', JSON.stringify(freshAdmin))

      await fetchActiveSessions(freshAdmin)
      checkCameraPermission()
    }

    bootstrap()

    return () => {
      stopCamera()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedSession) {
      fetchSessionStats()
      fetchSectionStudentCount()
      const session = sessions.find(s => s.id === selectedSession)
      setSelectedSessionDetails(session || null)
    }
  }, [selectedSession, sessions])

  useEffect(() => {
    if (activeTab === 'manual' && selectedSession && selectedSessionDetails) {
      fetchSectionStudentsForManualRecording()
    }
  }, [activeTab, selectedSession, selectedSessionDetails])

  useEffect(() => {
    if (scannerActive && scanning) {
      startScanning()
    }
  }, [scannerActive, scanning])

  const fetchActiveSessions = async (adminOverride?: AdminSessionUser | null) => {
    try {
      const adminContext = adminOverride ?? admin ?? getStoredAdminSession()

      let query = supabase
        .from('attendance_sessions')
        .select(`
          *,
          admin_users!attendance_sessions_teacher_id_fkey (
            full_name
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (!isSuperAdmin(adminContext) && adminContext?.id) {
        query = query.eq('teacher_id', adminContext.id)
      }

      if (hasAssignedScope(adminContext) && adminContext?.assigned_grade) {
        query = query.eq('grade', adminContext.assigned_grade)

        if (adminContext.assigned_section) {
          query = query.eq('section', adminContext.assigned_section)
        }
      }

      const { data, error } = await query

      if (error) throw error
      setSessions(data || [])
      
      if (data && data.length > 0) {
        setSelectedSession(data[0].id)
        setSelectedSessionDetails(data[0])
        setStats(prev => ({ ...prev, activeSession: data[0] }))
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSessionStats = async () => {
    try {
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', selectedSession)

      const { data } = await supabase
        .from('attendance')
        .select('status')
        .eq('session_id', selectedSession)

      const presentCount = data?.filter(a => a.status === 'present').length || 0
      const lateCount = data?.filter(a => a.status === 'late').length || 0
      const absentCount = data?.filter(a => a.status === 'absent').length || 0

      setStats(prev => ({ 
        ...prev, 
        todayScans: count || 0,
        presentCount,
        lateCount,
        absentCount
      }))
    } catch (error) {
      console.error('Error fetching session stats:', error)
    }
  }

  const fetchSectionStudentCount = async () => {
    if (!stats.activeSession) return

    try {
      const gradeVariants = buildGradeVariants(stats.activeSession.grade)

      let query = supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .in('grade', gradeVariants)

      const { count } = await query

      setStats(prev => ({ ...prev, sectionStudents: count || 0 }))
    } catch (error) {
      console.error('Error fetching section count:', error)
    }
  }

  const fetchSectionStudentsForManualRecording = async () => {
    if (!selectedSessionDetails) return

    try {
      const today = new Date().toISOString().split('T')[0]
      const gradeVariants = buildGradeVariants(selectedSessionDetails.grade)
      const assignedStudentIds = await getAssignedStudentIds(admin)

      if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        setSectionStudents([])
        setStudentAttendanceStatus({})
        return
      }

      let query = supabase
        .from('students')
        .select('id, lrn, full_name, grade, section, profile_photo_base64')
        .in('grade', gradeVariants)
        .order('full_name', { ascending: true })

      if (assignedStudentIds !== null) {
        query = query.in('id', assignedStudentIds)
      }

      const { data: students, error: studentError } = await query

      if (studentError) throw studentError

      setSectionStudents(students || [])

      const { data: alreadyMarked, error: markedError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('session_id', selectedSession)
        .eq('date', today)

      if (markedError) throw markedError

      const statusMap: { [key: string]: string } = {}
      alreadyMarked?.forEach(record => {
        if (record.student_id) {
          statusMap[record.student_id] = record.status
        }
      })

      setStudentAttendanceStatus(statusMap)
    } catch (error) {
      console.error('Error fetching section students:', error)
    }
  }

  const checkCameraPermission = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermission(false)
        setCameraError('Camera not supported in this browser')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      setCameraPermission(true)
      stream.getTracks().forEach(track => track.stop())
    } catch (error) {
      console.error('Camera permission error:', error)
      setCameraPermission(false)
      setCameraError('Unable to access camera. Please check permissions.')
    }
  }

  const startCamera = async () => {
    setCameraError(null)
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser')
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
            .then(() => {
              setScannerActive(true)
              setCameraPermission(true)
              setScanning(true)
              setCameraError(null)
            })
            .catch(err => {
              console.error('Error playing video:', err)
              setCameraError('Failed to start video playback')
            })
        }
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      setCameraPermission(false)
      setCameraError(error instanceof Error ? error.message : 'Failed to access camera')
      setScannerActive(false)
      setScanning(false)
    }
  }

  const stopCamera = () => {
    setScanning(false)
    scanningRef.current = false
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = 0
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => {
        track.stop()
      })
      videoRef.current.srcObject = null
    }
    setScannerActive(false)
  }

  const startScanning = () => {
    if (!videoRef.current || !canvasRef.current) return
    scanningRef.current = true
    lastFrameTimeRef.current = performance.now()
    frameSkipRef.current = 0
    scanQRCode()
  }

  const playSound = (type: 'success' | 'error') => {
    if (!soundEnabled) return
    
    try {
      if (type === 'success' && beepSound) {
        beepSound.currentTime = 0
        beepSound.play().catch(() => {})
      } else if (type === 'error' && errorSound) {
        errorSound.currentTime = 0
        errorSound.play().catch(() => {})
      }
    } catch (e) {
      // Ignore audio errors
    }
  }

  const scanQRCode = () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) {
      animationRef.current = requestAnimationFrame(scanQRCode)
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanQRCode)
      return
    }

    const now = performance.now()
    const elapsed = now - lastFrameTimeRef.current
    
    // Limit frame rate to 15 FPS for better performance
    if (elapsed < 66) {
      animationRef.current = requestAnimationFrame(scanQRCode)
      return
    }
    
    lastFrameTimeRef.current = now

    const scanWidth = 320
    const scanHeight = 240
    
    canvas.width = scanWidth
    canvas.height = scanHeight
    
    if (canvas.width === 0 || canvas.height === 0) {
      animationRef.current = requestAnimationFrame(scanQRCode)
      return
    }

    context.drawImage(video, 0, 0, scanWidth, scanHeight)

    try {
      const imageData = context.getImageData(0, 0, scanWidth, scanHeight)
      
      frameSkipRef.current++
      if (frameSkipRef.current % 2 === 0) {
        const code = jsQR(imageData.data, scanWidth, scanHeight, {
          inversionAttempts: "attemptBoth",
        })

        if (code && !isProcessingQR) {
          const now = Date.now()
          const lastScanForCode = scanCooldownRef.current[code.data] || 0
          
          if (now - lastScanForCode > 3000) {
            scanCooldownRef.current[code.data] = now
            handleQRCode(code.data)
          }
        }
      }
    } catch (err) {
      console.error('QR scan error:', err)
    }

    animationRef.current = requestAnimationFrame(scanQRCode)
  }

  const compareTimeStrings = (time1: string, time2: string): number => {
    const [h1, m1, s1] = time1.split(':').map(Number)
    const [h2, m2, s2] = time2.split(':').map(Number)
    
    if (h1 !== h2) return h1 - h2
    if (m1 !== m2) return m1 - m2
    return s1 - s2
  }

  const determineAttendanceStatus = (scanTime: string, session: AttendanceSession): string => {
    const formatTimeForComparison = (time: string): string => {
      if (time.length === 5) return `${time}:00`
      return time
    }

    const scanTimeFormatted = formatTimeForComparison(scanTime)
    const lateThresholdFormatted = formatTimeForComparison(session.late_threshold)
    const absentThresholdFormatted = formatTimeForComparison(session.absent_threshold)

    if (compareTimeStrings(scanTimeFormatted, lateThresholdFormatted) <= 0) {
      return 'present'
    } else if (compareTimeStrings(scanTimeFormatted, absentThresholdFormatted) <= 0) {
      return 'late'
    } else {
      return 'absent'
    }
  }

  const handleManualAttendance = async () => {
    const lrnValidation = validateLrn(manualLRN)

    if (!lrnValidation.isValid) {
      setScanResult({
        success: false,
        message: lrnValidation.errorMessage || 'Invalid LRN'
      })
      playSound('error')
      return
    }

    const cleanedManualLRN = lrnValidation.lrn

    if (!selectedSession) {
      setScanResult({
        success: false,
        message: 'Please select an active session first'
      })
      return
    }

    setTempRegistrationLoading(true)

    try {
      const session = selectedSessionDetails
      if (!session) throw new Error('Session not found')

      const { data: existingStudent } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('lrn', cleanedManualLRN)
        .maybeSingle()

      const nowTime = new Date()
      const hours = nowTime.getHours().toString().padStart(2, '0')
      const minutes = nowTime.getMinutes().toString().padStart(2, '0')
      const seconds = nowTime.getSeconds().toString().padStart(2, '0')
      const currentTime = `${hours}:${minutes}:${seconds}`
      const today = new Date().toISOString().split('T')[0]

      const { data: existingTemp } = await supabase
        .from('attendance')
        .select('id')
        .eq('lrn', cleanedManualLRN)
        .eq('date', today)
        .eq('is_temporary', true)
        .maybeSingle()

      if (existingTemp) {
        setScanResult({
          success: false,
          message: `Temporary attendance already recorded for LRN: ${cleanedManualLRN} today`
        })
        playSound('error')
        setShowManualEntry(false)
        return
      }

      let status = manualStatus
      if (!useManualStatus) {
        status = determineAttendanceStatus(currentTime, session) as 'present' | 'absent' | 'late'
      }

      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert([{
          student_id: existingStudent?.id || null,
          lrn: cleanedManualLRN,
          student_name: manualName || existingStudent?.full_name || 'Unregistered Student',
          grade: session.grade,
          section: session.section,
          date: today,
          time_in: currentTime,
          status,
          session_id: selectedSession,
          teacher_id: admin?.id,
          teacher_name: admin?.full_name || 'Unknown',
          recorded_by: admin?.id,
          is_temporary: !existingStudent,
          needs_registration: !existingStudent,
          notes: manualRemarks || null
        }])

      if (attendanceError) throw attendanceError

      const statusMessage = status === 'present' ? 'PRESENT' : status === 'late' ? 'LATE' : status === 'excused' ? 'EXCUSED' : 'ABSENT'

      setScanResult({
        success: true,
        message: existingStudent
          ? `${existingStudent.full_name} - ${statusMessage}${manualRemarks ? ` (${manualRemarks})` : ''}`
          : `[TEMPORARY] ${manualName || 'Student'} (LRN: ${cleanedManualLRN}) - ${statusMessage}${manualRemarks ? ` (${manualRemarks})` : ''}`,
        isTemporary: !existingStudent,
        needsRegistration: !existingStudent
      })
      playSound('success')

      await fetchSessionStats()
      setShowManualEntry(false)
      setManualLRN('')
      setManualName('')
      setManualRemarks('')
      setManualStatus('present')
      setUseManualStatus(false)

      setTimeout(() => {
        setScanResult(null)
      }, 3000)
    } catch (error) {
      console.error('Error recording manual attendance:', error)
      setScanResult({
        success: false,
        message: 'Error recording attendance'
      })
      playSound('error')
    } finally {
      setTempRegistrationLoading(false)
    }
  }

  const markAllStudentsPresent = async () => {
    if (!selectedSession || !selectedSessionDetails) {
      setScanResult({
        success: false,
        message: 'Please select an active session first'
      })
      return
    }

    if (!window.confirm('Mark all currently listed students as PRESENT? This will override late/absent/excused marks for today.')) {
      return
    }

    setMarkAllLoading(true)

    try {
      const today = new Date().toISOString().split('T')[0]

      let listedStudents = sectionStudents

      if (listedStudents.length === 0) {
        const gradeVariants = buildGradeVariants(selectedSessionDetails.grade)

        let query = supabase
          .from('students')
          .select('id, lrn, full_name, grade, section, profile_photo_base64')
          .in('grade', gradeVariants)
          .order('full_name', { ascending: true })

        const { data, error: studentError } = await query
        if (studentError) throw studentError
        listedStudents = data || []
        setSectionStudents(listedStudents)
      }

      if (listedStudents.length === 0) {
        setScanResult({
          success: false,
          message: 'No listed students found to mark as PRESENT'
        })
        playSound('error')
        return
      }

      const listedStudentIds = listedStudents.map((s) => s.id)

      const { data: alreadyMarked, error: markedError } = await supabase
        .from('attendance')
        .select('id, student_id, status')
        .eq('session_id', selectedSession)
        .eq('date', today)
        .in('student_id', listedStudentIds)

      if (markedError) throw markedError

      const existingByStudentId = new Map<string, { id: string; status: string }>()
      for (const record of alreadyMarked || []) {
        if (record.student_id && record.id) {
          existingByStudentId.set(record.student_id, {
            id: record.id,
            status: record.status
          })
        }
      }

      const nowTime = new Date()
      const hours = nowTime.getHours().toString().padStart(2, '0')
      const minutes = nowTime.getMinutes().toString().padStart(2, '0')
      const seconds = nowTime.getSeconds().toString().padStart(2, '0')
      const currentTime = `${hours}:${minutes}:${seconds}`

      const studentsToInsert = listedStudents.filter((student) => !existingByStudentId.has(student.id))
      const attendanceIdsToUpdate = Array.from(existingByStudentId.values())
        .filter((record) => record.status !== 'present')
        .map((record) => record.id)

      const recordsToInsert = studentsToInsert.map((student) => ({
        student_id: student.id,
        lrn: student.lrn,
        full_name: student.full_name,
        grade: student.grade,
        section: student.section,
        date: today,
        time_in: currentTime,
        status: 'present',
        session_id: selectedSession,
        teacher_id: admin?.id,
        teacher_name: admin?.full_name || 'Unknown',
        recorded_by: admin?.id,
        notes: 'Marked present via bulk operation'
      }))

      if (attendanceIdsToUpdate.length > 0) {
        const { error: updateError } = await supabase
          .from('attendance')
          .update({ status: 'present', notes: 'Marked present via bulk operation' })
          .in('id', attendanceIdsToUpdate)

        if (updateError) throw updateError
      }

      if (recordsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('attendance')
          .insert(recordsToInsert)

        if (insertError) throw insertError
      }

      const updatedStatusMap = { ...studentAttendanceStatus }
      for (const student of listedStudents) {
        updatedStatusMap[student.id] = 'present'
      }
      setStudentAttendanceStatus(updatedStatusMap)

      setScanResult({
        success: true,
        message: `Successfully marked ${listedStudents.length} listed student(s) as PRESENT`
      })
      playSound('success')

      await fetchSessionStats()

      setTimeout(() => {
        setScanResult(null)
      }, 4000)
    } catch (error) {
      console.error('Error marking all students present:', error)
      setScanResult({
        success: false,
        message: 'Error marking all students present'
      })
      playSound('error')
    } finally {
      setMarkAllLoading(false)
    }
  }

  const recordStudentAttendance = async (studentId: string, status: string) => {
    if (!selectedSession || !selectedSessionDetails) {
      setScanResult({
        success: false,
        message: 'Please select an active session first'
      })
      return
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const student = sectionStudents.find(s => s.id === studentId)
      if (!student) return

      const nowTime = new Date()
      const hours = nowTime.getHours().toString().padStart(2, '0')
      const minutes = nowTime.getMinutes().toString().padStart(2, '0')
      const seconds = nowTime.getSeconds().toString().padStart(2, '0')
      const currentTime = `${hours}:${minutes}:${seconds}`

      if (studentAttendanceStatus[studentId]) {
        setScanResult({
          success: false,
          message: `${student.full_name} is already marked as ${studentAttendanceStatus[studentId]}`
        })
        playSound('error')
        return
      }

      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert([{
          student_id: studentId,
          lrn: student.lrn,
          full_name: student.full_name,
          grade: student.grade,
          section: student.section,
          date: today,
          time_in: currentTime,
          status: status,
          session_id: selectedSession,
          teacher_id: admin?.id,
          teacher_name: admin?.full_name || 'Unknown',
          recorded_by: admin?.id,
          notes: studentRemarks[studentId] || null
        }])

      if (attendanceError) throw attendanceError

      setStudentAttendanceStatus(prev => ({
        ...prev,
        [studentId]: status
      }))

      setScanResult({
        success: true,
        message: `${student.full_name} - ${status.toUpperCase()}${studentRemarks[studentId] ? ` (${studentRemarks[studentId]})` : ''}`
      })
      playSound('success')

      await fetchSessionStats()

      setTimeout(() => {
        setScanResult(null)
      }, 2000)
    } catch (error) {
      console.error('Error recording student attendance:', error)
      setScanResult({
        success: false,
        message: 'Error recording attendance'
      })
      playSound('error')
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

  const sendAttendanceFamilyNotification = async (student: Student, status: string, timeIn: string) => {
    const rawMobile = student.guardian_contact || student.contact_number || ''
    const mobile = rawMobile ? normalizePhilippineMobile(rawMobile) : ''
    const email = student.email || ''
    if (!mobile && !email) {
      return
    }

    const messageBody = `Hi, this is EduScan. Your child ${student.full_name} is now marked as ${status} in school at ${timeIn}.` +
      ` Thank you.`

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.full_name,
          mobile,
          email,
          message: messageBody,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        console.warn('Family alert send failed for attendance:', data)
      } else {
        console.info('Family alert send result:', data)
      }
    } catch (err) {
      console.error('sendAttendanceFamilyNotification error:', err)
    }
  }

  const handleQRCode = async (qrData: string) => {
    try {
      const now = Date.now()
      
      if (isProcessingQR) return
      if (qrData === lastScan && now - lastScanTime < 5000) return

      setIsProcessingQR(true)
      setProcessingMessage('Decoding QR code...')
      setLastScanTime(now)
      setLastScan(qrData)

      let lrn: string
      let isEncrypted = false

      if (qrData.startsWith('ENC')) {
        try {
          setProcessingMessage('Decrypting secure QR code...')
          isEncrypted = true
          const encryptedPart = qrData.substring(3)
          const decrypted = decryptFromQR(encryptedPart)
          const extractedLrn = extractLRNFromDecrypted(decrypted)
          
          if (!extractedLrn) {
            throw new Error('Invalid decrypted format')
          }
          
          lrn = extractedLrn
          console.log('Decrypted encrypted QR code')
        } catch (error) {
          console.error('Decryption failed:', error)
          setScanResult({
            success: false,
            message: 'Invalid or tampered QR code',
            isEncrypted: true
          })
          playSound('error')
          setIsProcessingQR(false)
          setProcessingMessage('')
          return
        }
      } else {
        try {
          setProcessingMessage('Verifying QR code...')
          const parsed = JSON.parse(qrData)
          lrn = parsed.lrn
        } catch {
          const lrnMatch = qrData.match(/lrn(\d+)/)
          lrn = lrnMatch ? lrnMatch[1] : qrData
        }
      }

      if (!selectedSession) {
        setScanResult({
          success: false,
          message: 'Please select an active session first',
          isEncrypted
        })
        playSound('error')
        setIsProcessingQR(false)
        setProcessingMessage('')
        return
      }

      setProcessingMessage('Validating session...')

      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select(`
          *,
          admin_users!attendance_sessions_teacher_id_fkey (
            full_name
          )
        `)
        .eq('id', selectedSession)
        .single()

      if (sessionError || !session) {
        setScanResult({
          success: false,
          message: 'Selected session not found',
          isEncrypted
        })
        playSound('error')
        setIsProcessingQR(false)
        setProcessingMessage('')
        return
      }

      setProcessingMessage('Looking up student record...')

      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('lrn', lrn)
        .maybeSingle()

      if (studentError || !student) {
        setScanResult({
          success: false,
          message: `Student with LRN ${lrn} not found`,
          isEncrypted
        })
        playSound('error')
        setIsProcessingQR(false)
        setProcessingMessage('')
        return
      }

      if (admin?.id) {
        setProcessingMessage('Verifying teacher assignment...')
        const { data: assignment, error: assignmentError } = await supabase
          .from('student_teacher_assignments')
          .select('student_id')
          .eq('teacher_id', admin.id)
          .eq('student_id', student.id)
          .maybeSingle()

        if (assignmentError) {
          throw assignmentError
        }

        if (!assignment) {
          setScanResult({
            success: false,
            message: `${student.full_name} is not assigned to you by the super admin`,
            isEncrypted
          })
          playSound('error')
          setIsProcessingQR(false)
          setProcessingMessage('')
          return
        }
      }

      if (student.grade !== session.grade || student.section !== session.section) {
        setScanResult({
          success: false,
          message: `Student is from Grade ${student.grade}-${student.section}, but this session is for Grade ${session.grade}-${session.section}`,
          isEncrypted
        })
        playSound('error')
        setIsProcessingQR(false)
        setProcessingMessage('')
        return
      }

      setProcessingMessage('Checking for duplicate attendance...')

      const today = new Date().toISOString().split('T')[0]
      
      const { data: existing, error: existingError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .eq('date', today)
        .eq('session_id', selectedSession)

      if (existingError) throw existingError

      if (existing && existing.length > 0) {
        setScanResult({
          success: false,
          message: `${student.full_name} already marked as ${existing[0].status} today`,
          isEncrypted
        })
        playSound('error')
        setIsProcessingQR(false)
        setProcessingMessage('')
        return
      }

      setProcessingMessage('Recording attendance...')

      const now_time = new Date()
      const hours = now_time.getHours().toString().padStart(2, '0')
      const minutes = now_time.getMinutes().toString().padStart(2, '0')
      const seconds = now_time.getSeconds().toString().padStart(2, '0')
      const currentTime = `${hours}:${minutes}:${seconds}`

      const status = determineAttendanceStatus(currentTime, session)

      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert([{
          student_id: student.id,
          lrn: student.lrn,
          full_name: student.full_name,
          grade: student.grade,
          section: student.section,
          date: today,
          time_in: currentTime,
          status: status,
          session_id: selectedSession,
          teacher_id: session.teacher_id,
          teacher_name: session.admin_users?.full_name || 'Unknown',
          recorded_by: admin?.id
        }])

      if (attendanceError) throw attendanceError

      const statusMessage = status === 'present' ? 'PRESENT' : status === 'late' ? 'LATE' : 'ABSENT'
      
      setProcessingMessage('Complete!')
      
      setScanResult({
        success: true,
        message: `${student.full_name} - ${statusMessage}`,
        student,
        isEncrypted
      })
      playSound('success')

      sendAttendanceFamilyNotification(student, statusMessage.toLowerCase(), currentTime)
      
      await fetchSessionStats()

      setTimeout(() => {
        setScanResult(null)
        setIsProcessingQR(false)
        setProcessingMessage('')
      }, 3000)

    } catch (error) {
      console.error('Error:', error)
      setScanResult({
        success: false,
        message: 'Error processing attendance'
      })
      playSound('error')
      setIsProcessingQR(false)
      setProcessingMessage('')
    }
  }

  const formatTime = (time: string) => {
    try {
      if (time.length === 8 && time.includes(':')) {
        const [hours, minutes] = time.split(':')
        return new Date(`2000-01-01T${hours}:${minutes}:00`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      }
      return new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return time
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading scanner...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Attendance Marking</h1>
          <p className="text-gray-600">Record attendance via QR scanner or manual entry</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="bg-green-100 text-green-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium">
            <Shield className="w-4 h-4" />
            <span>Encryption Active</span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
              onClick={() => fetchActiveSessions()}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh sessions"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex-1 py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'scanner'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <QrCode className="w-5 h-5" />
            QR Scanner
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'manual'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <UserPlus className="w-5 h-5" />
            Manual Recording
          </button>
          <button
            onClick={() => markAllStudentsPresent()}
            disabled={markAllLoading || !selectedSession}
            className={`flex-1 py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors ${
              markAllLoading || !selectedSession
                ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
            }`}
            title="Mark all unmarked students as present"
          >
            {markAllLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckSquare className="w-5 h-5" />
            )}
            Mark All Present
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Scan className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Today's Scans</p>
              <p className="text-xl font-bold text-gray-800">{stats.todayScans}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Present</p>
              <p className="text-xl font-bold text-green-600">{stats.presentCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Late</p>
              <p className="text-xl font-bold text-yellow-600">{stats.lateCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Absent</p>
              <p className="text-xl font-bold text-red-600">{stats.absentCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Encryption</p>
              <p className="text-sm font-bold text-purple-600">AES-256</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Select Active Session:
          </label>
          <select
            value={selectedSession}
            onChange={(e) => {
              setSelectedSession(e.target.value)
              const session = sessions.find(s => s.id === e.target.value)
              setSelectedSessionDetails(session || null)
              setStats(prev => ({ ...prev, activeSession: session || null }))
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Choose a session</option>
            {sessions.map(session => (
              <option key={session.id} value={session.id}>
                {session.admin_users?.full_name || 'Unknown'} - Grade {session.grade} - Section {session.section}
                {session.session_description && ` - ${session.session_description}`}
              </option>
            ))}
          </select>
        </div>

        {selectedSessionDetails && (
          <div className="mt-3 space-y-3">
            {selectedSessionDetails.session_description && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Session Description:</span> {selectedSessionDetails.session_description}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-sm bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Late Threshold:</span>
                <span className="font-medium text-yellow-600">{formatTime(selectedSessionDetails.late_threshold)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Absent Threshold:</span>
                <span className="font-medium text-red-600">{formatTime(selectedSessionDetails.absent_threshold)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {activeTab === 'scanner' ? (
          <>
            <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-gray-200 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Camera Feed</h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  {scannerActive ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <Zap className="w-4 h-4" />
                      Camera Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-600 text-sm">
                      <ZapOff className="w-4 h-4" />
                      Camera Off
                    </span>
                  )}
                  <button
                    onClick={scannerActive ? stopCamera : startCamera}
                    disabled={cameraPermission === false}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      scannerActive 
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } ${cameraPermission === false ? 'opacity-50 cursor-not-allowed' : ''} w-full sm:w-auto`}
                  >
                    {scannerActive ? 'Stop Camera' : 'Start Camera'}
                  </button>
                </div>
              </div>

              <div className="relative w-full aspect-3/4 sm:aspect-video max-h-[70vh] sm:max-h-none bg-gray-900 rounded-lg overflow-hidden">
                {cameraPermission === false ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <CameraOff className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Camera Access Denied</p>
                    <p className="text-sm text-gray-400 mt-2 text-center px-4">
                      {cameraError || 'Please allow camera access'}
                    </p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      playsInline
                      autoPlay
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full"
                      style={{ display: 'none' }}
                    />
                    
                    <div className="absolute inset-0 border-2 sm:border-4 border-blue-500/30 pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-56 sm:h-56 lg:w-64 lg:h-64">
                        <div className="absolute top-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-t-4 border-l-4 border-blue-500"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-t-4 border-r-4 border-blue-500"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-b-4 border-l-4 border-blue-500"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-b-4 border-r-4 border-blue-500"></div>
                      </div>
                    </div>

                    {scannerActive && scanning && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-blue-500 to-transparent animate-scan"></div>
                      </div>
                    )}

                    {/* Enhanced Processing Overlay */}
                    {(isProcessingQR || isProcessing) && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                        <div className="relative">
                          <div className="w-20 h-20 border-4 border-blue-500/30 rounded-full animate-ping absolute"></div>
                          <div className="w-20 h-20 border-4 border-t-blue-500 border-r-blue-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                        </div>
                        <p className="text-white font-medium mt-4 text-lg">{processingMessage || 'Processing QR Code...'}</p>
                        <div className="mt-3 w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full animate-pulse w-full"></div>
                        </div>
                        <p className="text-gray-300 text-sm mt-3">Please wait...</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <p className="text-xs sm:text-sm text-gray-500 mt-4 text-center">
                Position the QR code within the frame to scan automatically
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Scan Results</h2>
              
              {scanResult ? (
                <div className={`p-4 rounded-lg ${
                  scanResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {scanResult.success ? (
                      scanResult.isEncrypted ? (
                        <Lock className="w-6 h-6 text-green-600 shrink-0" />
                      ) : (
                        <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                      )
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        scanResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {scanResult.success ? 'Attendance Marked' : 'Scan Failed'}
                        {scanResult.isEncrypted && scanResult.success && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                            <Lock className="w-3 h-3" />
                            Encrypted
                          </span>
                        )}
                      </p>
                      <p className={`text-sm mt-1 ${
                        scanResult.success ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {scanResult.message}
                      </p>
                      
                      {scanResult.student && (
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-100 to-purple-100 flex items-center justify-center overflow-hidden">
                              {scanResult.student.profile_photo_base64 ? (
                                <img 
                                  src={scanResult.student.profile_photo_base64} 
                                  alt={scanResult.student.full_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Users className="w-6 h-6 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{scanResult.student.full_name}</p>
                              <p className="text-sm text-gray-500">LRN: {scanResult.student.lrn}</p>
                              <p className="text-xs text-gray-400">
                                Grade {scanResult.student.grade} - Section {scanResult.student.section}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-gray-600">No scans yet</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {scannerActive 
                      ? 'Scan a student QR code to see results here'
                      : 'Start the camera to begin scanning'}
                  </p>
                </div>
              )}

              {stats.todayScans > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-gray-700 mb-3">Today's Statistics</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Present:</span>
                      <span className="font-bold text-green-600">{stats.presentCount}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Late:</span>
                      <span className="font-bold text-yellow-600">{stats.lateCount}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Absent:</span>
                      <span className="font-bold text-red-600">{stats.absentCount}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm text-gray-600">Total:</span>
                      <span className="font-bold text-blue-600">{stats.todayScans}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="lg:col-span-3 bg-white rounded-xl shadow-xs border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">Quick Student Attendance</h2>

            <div className="mb-6 border border-gray-200 rounded-xl bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Manual Unregistered Entry</p>
                  <p className="text-xs text-gray-600 mt-1">Use this when a student is not registered yet. Enter LRN and name to save temporary attendance.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualEntry((prev) => !prev)}
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  {showManualEntry ? 'Hide Form' : 'Add Temporary Attendance'}
                </button>
              </div>

              {showManualEntry && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Student LRN</label>
                    <input
                      type="text"
                      value={manualLRN}
                      onChange={(e) => setManualLRN(e.target.value)}
                      placeholder="Enter 12-digit LRN"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Enter student full name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                      <input
                        type="checkbox"
                        checked={useManualStatus}
                        onChange={(e) => setUseManualStatus(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Override attendance status manually
                    </label>
                    {useManualStatus && (
                      <select
                        value={manualStatus}
                        onChange={(e) => setManualStatus(e.target.value as 'present' | 'absent' | 'late' | 'excused')}
                        className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                        <option value="excused">Excused</option>
                      </select>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (optional)</label>
                    <textarea
                      value={manualRemarks}
                      onChange={(e) => setManualRemarks(e.target.value)}
                      placeholder="Optional notes for this attendance record"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleManualAttendance}
                      disabled={tempRegistrationLoading || !selectedSession || !manualLRN.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {tempRegistrationLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Temporary Attendance
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualEntry(false)
                        setManualLRN('')
                        setManualName('')
                        setManualRemarks('')
                        setManualStatus('present')
                        setUseManualStatus(false)
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>

                  {!selectedSession && (
                    <p className="md:col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Select an active session first before recording temporary attendance.
                    </p>
                  )}
                </div>
              )}
            </div>

            {scanResult && (
              <div className={`p-4 rounded-lg mb-6 ${
                scanResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {scanResult.success ? (
                    <CheckCircle className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${
                      scanResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {scanResult.success ? 'Attendance Recorded' : 'Error'}
                    </p>
                    <p className={`text-sm mt-1 ${
                      scanResult.success ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {scanResult.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {sectionStudents.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No students in this section</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {sectionStudents.map((student) => {
                  const isMarked = !!studentAttendanceStatus[student.id]
                  const status = studentAttendanceStatus[student.id]

                  return (
                    <div
                      key={student.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isMarked
                          ? 'bg-gray-50 border-gray-300'
                          : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-100 to-purple-100 flex items-center justify-center shrink-0 overflow-hidden">
                            {student.profile_photo_base64 ? (
                              <img
                                src={student.profile_photo_base64}
                                alt={student.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Users className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{student.full_name}</p>
                            <p className="text-xs text-gray-500">LRN: {student.lrn}</p>
                            <p className="text-xs text-gray-400">Grade {student.grade} - {student.section}</p>
                            {isMarked && (
                              <p className={`text-xs font-semibold mt-1 ${
                                status === 'present' ? 'text-green-600' :
                                status === 'late' ? 'text-yellow-600' :
                                status === 'excused' ? 'text-blue-600' :
                                'text-red-600'
                              }`}>
                                Marked as {status.toUpperCase()}
                              </p>
                            )}
                          </div>
                        </div>

                        {!isMarked ? (
                          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                            <button
                              onClick={() => recordStudentAttendance(student.id, 'present')}
                              className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-colors"
                            >
                              Present
                            </button>
                            <button
                              onClick={() => recordStudentAttendance(student.id, 'late')}
                              className="px-3 py-1.5 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg text-sm font-medium transition-colors"
                            >
                              Late
                            </button>
                            <button
                              onClick={() => recordStudentAttendance(student.id, 'absent')}
                              className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors"
                            >
                              Absent
                            </button>
                            <button
                              onClick={() => recordStudentAttendance(student.id, 'excused')}
                              className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-colors"
                            >
                              Excused
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm font-semibold text-gray-500 shrink-0">Done</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {stats.todayScans > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="font-medium text-gray-700 mb-4">Session Statistics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-600">Total Marked</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{stats.todayScans}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-600">Present</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{stats.presentCount}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-600">Late</p>
                    <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.lateCount}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-600">Absent</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{stats.absentCount}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-200">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800">Secure Attendance System</h3>
            <p className="text-sm text-blue-700 mt-1">
              QR codes are encrypted end-to-end. Manual attendance remains available for fallback and quick classroom operations.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
