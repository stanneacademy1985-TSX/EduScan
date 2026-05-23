'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../../../lib/supabase'
import { fetchAdminById, getAssignedStudentIds, getStoredAdminSession, hasAssignedScope, isSuperAdmin, storeAdminSession, type AdminSessionUser } from '../../../../../lib/admin-auth'
import { useRouter } from 'next/navigation'
import { 
  QrCode,
  Camera,
  CameraOff,
  CheckCircle,
  XCircle,
  Users,
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
  Grid,
  LayoutGrid,
  MousePointer,
  Fingerprint
} from 'lucide-react'
import jsQR from 'jsqr'
import { decryptFromQR, extractLRNFromDecrypted } from '../../../../../lib/encryption'

interface Student {
  id: string
  lrn: string
  full_name: string
  first_name: string
  last_name: string
  middle_name?: string
  sex?: string
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

// Helper function to format name as "Last, First M."
const formatStudentName = (student: Student): string => {
  const lastName = student.last_name || ''
  const firstName = student.first_name || ''
  const middleInitial = student.middle_name && student.middle_name.trim() 
    ? student.middle_name.charAt(0).toUpperCase() + '.' 
    : ''
  
  if (!lastName && !firstName) return student.full_name || 'Unknown'
  
  if (middleInitial) {
    return `${lastName}, ${firstName} ${middleInitial}`
  }
  return `${lastName}, ${firstName}`
}

// Simplified name for seat plan (just Last, First)
const getSimplifiedName = (student: Student): string => {
  const lastName = student.last_name || ''
  const firstName = student.first_name || ''
  
  if (!lastName && !firstName) return student.full_name?.split(' ')[0] || 'Student'
  
  if (lastName && firstName) {
    return `${lastName}, ${firstName.charAt(0)}.`
  }
  return lastName || firstName
}

// Helper function to capitalize first letter
const capitalizeName = (name: string): string => {
  if (!name) return ''
  return name.toLowerCase().split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
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
  const [activeTab, setActiveTab] = useState<'scanner' | 'seatplan'>('scanner')
  const [sectionStudents, setSectionStudents] = useState<Student[]>([])
  const [studentAttendanceStatus, setStudentAttendanceStatus] = useState<{ [key: string]: string }>({})
  const [seatArrangement, setSeatArrangement] = useState<Student[]>([])
  
  // Attendance toolbar state
  const [attendanceMode, setAttendanceMode] = useState<'present' | 'late' | 'absent' | null>(null)
  const [isMarkingMode, setIsMarkingMode] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

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
    if (activeTab === 'seatplan' && selectedSession && selectedSessionDetails) {
      fetchSectionStudentsForSeatPlan()
    }
  }, [activeTab, selectedSession, selectedSessionDetails])

  useEffect(() => {
    if (scannerActive && scanning) {
      startScanning()
    }
  }, [scannerActive, scanning])

  // Generate seat arrangement when students are loaded
  useEffect(() => {
    if (sectionStudents.length > 0) {
      generateSeatArrangement(sectionStudents)
    }
  }, [sectionStudents, studentAttendanceStatus])

  const generateSeatArrangement = (students: Student[]) => {
    // Sort students by last name
    const sorted = [...students].sort((a, b) => {
      const lastNameA = a.last_name || a.full_name.split(' ').pop() || ''
      const lastNameB = b.last_name || b.full_name.split(' ').pop() || ''
      return lastNameA.localeCompare(lastNameB)
    })

    // Alternate by gender (Male -> Female -> Male -> Female...)
    const males = sorted.filter(s => s.sex === 'Male')
    const females = sorted.filter(s => s.sex === 'Female')
    const others = sorted.filter(s => s.sex !== 'Male' && s.sex !== 'Female')
    
    const arranged: Student[] = []
    const maxLength = Math.max(males.length, females.length)
    
    for (let i = 0; i < maxLength; i++) {
      if (males[i]) arranged.push(males[i])
      if (females[i]) arranged.push(females[i])
    }
    
    // Add others at the end
    arranged.push(...others)
    
    setSeatArrangement(arranged)
  }

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

  const fetchSectionStudentsForSeatPlan = async () => {
    if (!selectedSessionDetails) return

    try {
      const gradeVariants = buildGradeVariants(selectedSessionDetails.grade)
      const assignedStudentIds = await getAssignedStudentIds(admin)

      if (assignedStudentIds !== null && assignedStudentIds.length === 0) {
        setSectionStudents([])
        setStudentAttendanceStatus({})
        return
      }

      let query = supabase
        .from('students')
        .select('id, lrn, full_name, first_name, last_name, middle_name, sex, grade, section, profile_photo_base64')
        .in('grade', gradeVariants)
        .order('last_name', { ascending: true })

      if (assignedStudentIds !== null) {
        query = query.in('id', assignedStudentIds)
      }

      const { data: students, error: studentError } = await query

      if (studentError) throw studentError

      const formattedStudents = (students || []).map(student => ({
        ...student,
        first_name: capitalizeName(student.first_name || ''),
        last_name: capitalizeName(student.last_name || ''),
        middle_name: student.middle_name ? capitalizeName(student.middle_name) : ''
      }))

      setSectionStudents(formattedStudents || [])

      const { data: alreadyMarked, error: markedError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('session_id', selectedSession)

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

  const buildGradeVariants = (grade: string): string[] => {
    const raw = (grade || '').trim()
    if (!raw) return []

    const digits = raw.replace(/[^0-9]/g, '')
    if (digits === '11' || digits === '12') {
      return Array.from(new Set([raw, digits, `Grade ${digits}`]))
    }

    return [raw]
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
        // Update existing attendance
        const { error: updateError } = await supabase
          .from('attendance')
          .update({ status: status })
          .eq('student_id', studentId)
          .eq('session_id', selectedSession)
          .eq('date', today)

        if (updateError) throw updateError
      } else {
        // Insert new attendance
        const { error: attendanceError } = await supabase
          .from('attendance')
          .insert([{
            student_id: studentId,
            lrn: student.lrn,
            full_name: formatStudentName(student),
            grade: student.grade,
            section: student.section,
            date: today,
            time_in: currentTime,
            status: status,
            session_id: selectedSession,
            teacher_id: admin?.id,
            teacher_name: admin?.full_name || 'Unknown',
            recorded_by: admin?.id
          }])

        if (attendanceError) throw attendanceError
      }

      setStudentAttendanceStatus(prev => ({
        ...prev,
        [studentId]: status
      }))

      // Update stats
      const newPresentCount = status === 'present' ? stats.presentCount + 1 : 
                              status === 'present' && studentAttendanceStatus[studentId] === 'present' ? stats.presentCount : 
                              stats.presentCount
      const newLateCount = status === 'late' ? stats.lateCount + 1 : 
                            status === 'late' && studentAttendanceStatus[studentId] === 'late' ? stats.lateCount : 
                            stats.lateCount
      const newAbsentCount = status === 'absent' ? stats.absentCount + 1 : 
                              status === 'absent' && studentAttendanceStatus[studentId] === 'absent' ? stats.absentCount : 
                              stats.absentCount
      
      setStats(prev => ({
        ...prev,
        todayScans: prev.todayScans + (studentAttendanceStatus[studentId] ? 0 : 1),
        presentCount: newPresentCount,
        lateCount: newLateCount,
        absentCount: newAbsentCount
      }))

      setScanResult({
        success: true,
        message: `${getSimplifiedName(student)} → ${status.toUpperCase()}`
      })
      playSound('success')
      
      // Clear selection after marking
      setSelectedStudentId(null)
      setTimeout(() => {
        setScanResult(null)
      }, 1500)
    } catch (error) {
      console.error('Error recording student attendance:', error)
      setScanResult({
        success: false,
        message: 'Error recording attendance'
      })
      playSound('error')
    }
  }

  const handleStudentCardClick = (studentId: string) => {
    if (!isMarkingMode || !attendanceMode) {
      // If not in marking mode, just select the student for visual feedback
      setSelectedStudentId(selectedStudentId === studentId ? null : studentId)
      return
    }
    
    // In marking mode, record attendance
    recordStudentAttendance(studentId, attendanceMode)
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
        .select('*')
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
          full_name: formatStudentName(student),
          grade: student.grade,
          section: student.section,
          date: today,
          time_in: currentTime,
          status: status,
          session_id: selectedSession,
          teacher_id: session.teacher_id,
          teacher_name: admin?.full_name || 'Unknown',
          recorded_by: admin?.id
        }])

      if (attendanceError) throw attendanceError

      const statusMessage = status === 'present' ? 'PRESENT' : status === 'late' ? 'LATE' : 'ABSENT'
      
      setProcessingMessage('Complete!')
      
      setScanResult({
        success: true,
        message: `${formatStudentName(student)} - ${statusMessage}`,
        student,
        isEncrypted
      })
      playSound('success')
      
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
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${minutes} ${ampm}`
      }
      return time
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
          <p className="text-gray-600">Record attendance via QR scanner or seat plan</p>
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
            onClick={() => setActiveTab('seatplan')}
            className={`flex-1 py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'seatplan'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            Seat Plan
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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
      </div>

      {/* Session Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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
              // Reset marking mode when session changes
              setIsMarkingMode(false)
              setAttendanceMode(null)
              setSelectedStudentId(null)
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

        {selectedSessionDetails && selectedSessionDetails.session_description && (
          <div className="mt-3 bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Session Description:</span> {selectedSessionDetails.session_description}
            </p>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'scanner' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Camera Feed</h2>
              <div className="flex flex-wrap items-center gap-2">
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
                  } ${cameraPermission === false ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {scannerActive ? 'Stop Camera' : 'Start Camera'}
                </button>
              </div>
            </div>

            <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
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
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  
                  <div className="absolute inset-0 border-4 border-blue-500/30 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-56 h-56">
                      <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-blue-500"></div>
                      <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-blue-500"></div>
                      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-blue-500"></div>
                      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-blue-500"></div>
                    </div>
                  </div>

                  {scannerActive && scanning && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan"></div>
                    </div>
                  )}

                  {(isProcessingQR || isProcessing) && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-blue-500/30 rounded-full animate-ping absolute"></div>
                        <div className="w-20 h-20 border-4 border-t-blue-500 border-r-blue-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                      </div>
                      <p className="text-white font-medium mt-4 text-lg">{processingMessage || 'Processing QR Code...'}</p>
                      <p className="text-gray-300 text-sm mt-3">Please wait...</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <p className="text-sm text-gray-500 mt-4 text-center">
              Position the QR code within the frame to scan automatically
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
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
          </div>
        </div>
      ) : (
        // Seat Plan View with Attendance Toolbar
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Attendance Toolbar */}
          <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4 sm:p-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Grid className="w-5 h-5 text-blue-600" />
                Classroom Seat Plan
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isMarkingMode 
                  ? `✓ Marking: ${attendanceMode?.toUpperCase()} mode. Tap on any student card.`
                  : 'Select Present/Late/Absent, then tap on student cards to mark attendance.'}
              </p>
            </div>

            {/* Color Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Late</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Absent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                <span>Not Marked</span>
              </div>
            </div>

            {/* Attendance Mode Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setIsMarkingMode(true)
                  setAttendanceMode('present')
                  setSelectedStudentId(null)
                }}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                  isMarkingMode && attendanceMode === 'present'
                    ? 'bg-green-600 text-white shadow-lg ring-2 ring-green-500 ring-offset-2'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                Present
                {isMarkingMode && attendanceMode === 'present' && (
                  <span className="ml-1 text-xs bg-green-700 px-1.5 py-0.5 rounded-full">ACTIVE</span>
                )}
              </button>
              <button
                onClick={() => {
                  setIsMarkingMode(true)
                  setAttendanceMode('late')
                  setSelectedStudentId(null)
                }}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                  isMarkingMode && attendanceMode === 'late'
                    ? 'bg-yellow-600 text-white shadow-lg ring-2 ring-yellow-500 ring-offset-2'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
              >
                <Clock className="w-4 h-4" />
                Late
                {isMarkingMode && attendanceMode === 'late' && (
                  <span className="ml-1 text-xs bg-yellow-700 px-1.5 py-0.5 rounded-full">ACTIVE</span>
                )}
              </button>
              <button
                onClick={() => {
                  setIsMarkingMode(true)
                  setAttendanceMode('absent')
                  setSelectedStudentId(null)
                }}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                  isMarkingMode && attendanceMode === 'absent'
                    ? 'bg-red-600 text-white shadow-lg ring-2 ring-red-500 ring-offset-2'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                <XCircle className="w-4 h-4" />
                Absent
                {isMarkingMode && attendanceMode === 'absent' && (
                  <span className="ml-1 text-xs bg-red-700 px-1.5 py-0.5 rounded-full">ACTIVE</span>
                )}
              </button>
              
              {isMarkingMode && (
                <button
                  onClick={() => {
                    setIsMarkingMode(false)
                    setAttendanceMode(null)
                    setSelectedStudentId(null)
                  }}
                  className="px-4 py-2.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200 flex items-center gap-2 text-sm"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              )}
            </div>

            {!isMarkingMode && (
              <div className="mt-3 p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-xs text-blue-700">
                  <MousePointer className="w-3 h-3" />
                  <span>Select a mode above, then tap on any student card to mark attendance.</span>
                </div>
              </div>
            )}
          </div>

          {/* Seat Plan Grid - Perfectly Sized Responsive Cards */}
          <div className="p-4">
            {sectionStudents.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No students in this section</p>
              </div>
            ) : (
              <>
                {/* Responsive grid that actually works on mobile */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {seatArrangement.map((student, index) => {
                    const status = studentAttendanceStatus[student.id]
                    const isMarked = !!status
                    const displayName = getSimplifiedName(student)
                    const isSelected = selectedStudentId === student.id
                    
                    return (
                      <div
                        key={student.id}
                        onClick={() => handleStudentCardClick(student.id)}
                        className={`relative rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                          isMarked
                            ? status === 'present'
                              ? 'bg-green-50 border-green-400'
                              : status === 'late'
                              ? 'bg-yellow-50 border-yellow-400'
                              : 'bg-red-50 border-red-400'
                            : isSelected
                            ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300'
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                        } ${isMarkingMode && attendanceMode && !isMarked ? 'active:scale-95 transition-transform' : ''}`}
                      >
                        {/* Seat Number Badge */}
                        <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-gray-800 text-white text-[10px] font-bold flex items-center justify-center shadow-md z-10">
                          {index + 1}
                        </div>
                        
                        <div className="p-2 pt-3">
                          <div className="text-center">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm leading-tight break-words">
                              {displayName}
                            </p>
                          </div>
                          
                          {/* Status Indicator */}
                          {isMarked && (
                            <div className="mt-1.5 pt-1.5 border-t border-current border-opacity-20">
                              <div className={`text-center py-0.5 px-1 rounded ${
                                status === 'present' ? 'bg-green-200 text-green-800' :
                                status === 'late' ? 'bg-yellow-200 text-yellow-800' :
                                'bg-red-200 text-red-800'
                              }`}>
                                <span className="text-[10px] font-bold uppercase">
                                  {status === 'present' ? 'P' : status === 'late' ? 'L' : 'A'}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Marking mode indicator for unmarked cards */}
                          {!isMarked && isMarkingMode && attendanceMode && (
                            <div className="mt-1.5 pt-1.5 text-center">
                              <div className="text-[10px] text-gray-400 italic">
                                Tap
                              </div>
                            </div>
                          )}
                          
                          {/* Hover/Tap overlay for marking mode */}
                          {isMarkingMode && attendanceMode && !isMarked && (
                            <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Fingerprint className="w-5 h-5 text-white mb-1" />
                              <p className="text-white text-[10px] font-medium">Mark</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            
            {/* Summary Stats */}
            {sectionStudents.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-600">Total</p>
                    <p className="text-lg font-bold text-blue-600">{sectionStudents.length}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-600">Present</p>
                    <p className="text-lg font-bold text-green-600">{stats.presentCount}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-600">Late</p>
                    <p className="text-lg font-bold text-yellow-600">{stats.lateCount}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-600">Absent</p>
                    <p className="text-lg font-bold text-red-600">{stats.absentCount}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center col-span-2 sm:col-span-1">
                    <p className="text-xs text-gray-600">Complete</p>
                    <p className="text-lg font-bold text-purple-600">
                      {Math.round(((stats.presentCount + stats.lateCount + stats.absentCount) / sectionStudents.length) * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-200">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800">Secure Attendance System</h3>
            <p className="text-sm text-blue-700 mt-1">
              QR codes are encrypted end-to-end. Seat plan mode: select Present/Late/Absent, then tap on student cards.
              {activeTab === 'seatplan' && !isMarkingMode && " Select a mode above to start marking."}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(100vh); }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        .active\\:scale-95:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  )
}
