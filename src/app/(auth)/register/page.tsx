'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { generateEncryptedQRCode } from '../../../../lib/qr-generator'
import { RegisterFormData } from '../../../../lib/types'
import { AuthUtils } from '../../../../lib/auth-utils'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { 
  User, Mail, Lock, BookOpen, Hash, QrCode, ArrowRight, 
  Loader2, Phone, Home, Calendar, Heart, Briefcase, School, 
  UserCircle, Users, Pill, AlertCircle, CheckCircle, Eye, EyeOff,
  Upload, Camera, X, Shield
} from 'lucide-react'

type RegistrationData = {
  // Level 1: Personal Information
  firstName: string;
  middleName: string;
  lastName: string;
  sex: string;
  dateOfBirth: string;
  contactNumber: string;
  address: string;
  profilePhoto: File | null;
  
  // Level 2: Education Background
  currentGrade: string;
  previousElementary: string;
  previousHighSchool: string;
  
  // Level 3: Parents Information
  fatherName: string;
  fatherOccupation: string;
  motherName: string;
  motherOccupation: string;
  guardianName: string;
  guardianContact: string;
  
  // Level 4: Medical Background
  medicalConditions: string;
  medications: string;
  allergies: string;
  emergencyContact: string;
  
  // Level 5: Account Credentials
  email: string;
  password: string;
  confirmPassword: string;
  lrn: string;
}

export default function RegisterPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<RegistrationData>({
    // Level 1
    firstName: '',
    middleName: '',
    lastName: '',
    sex: 'Male',
    dateOfBirth: '',
    contactNumber: '',
    address: '',
    profilePhoto: null,
    
    // Level 2
    currentGrade: '11',
    previousElementary: '',
    previousHighSchool: '',
    
    // Level 3
    fatherName: '',
    fatherOccupation: '',
    motherName: '',
    motherOccupation: '',
    guardianName: '',
    guardianContact: '',
    
    // Level 4
    medicalConditions: '',
    medications: '',
    allergies: '',
    emergencyContact: '',
    
    // Level 5
    email: '',
    password: '',
    confirmPassword: '',
    lrn: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [qrGenerating, setQrGenerating] = useState(false)
  const [mobileLogoError, setMobileLogoError] = useState(false)
  const [desktopLogoError, setDesktopLogoError] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const grades = ['11', '12']
  const sexes = ['Male', 'Female']

  const steps = [
    { number: 1, title: 'Personal Info', icon: User },
    { number: 2, title: 'Education', icon: School },
    { number: 3, title: 'Parents', icon: Users },
    { number: 4, title: 'Medical', icon: Heart },
    { number: 5, title: 'Account', icon: CheckCircle }
  ]

  const validateStep = (step: number): boolean => {
    setError('')
    
    switch(step) {
      case 1:
        if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.contactNumber || !formData.address) {
          setError('Please fill in all required personal information fields')
          return false
        }
        break
      case 2:
        if (!formData.previousElementary) {
          setError('Please enter your previous elementary school')
          return false
        }
        break
      case 3:
        if (!formData.fatherName && !formData.motherName && !formData.guardianName) {
          setError('Please provide at least one parent or guardian information')
          return false
        }
        break
      case 5:
        if (!formData.email || !formData.password || !formData.confirmPassword || !formData.lrn) {
          setError('Please fill in all account credentials')
          return false
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match')
          return false
        }
        if (formData.lrn.length !== 12 || !/^\d{12}$/.test(formData.lrn)) {
          setError('LRN must be exactly 12 digits')
          return false
        }
        break
    }
    return true
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type - using MIME types that work on mobile
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/heic', 'image/heif', 'image/webp']
    // Also check by extension for mobile devices that might not report MIME types correctly
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif', '.webp']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      setError('Please upload a valid image file (JPEG, PNG, GIF, HEIC, WebP)')
      return
    }

    // Validate file size (max 5MB for mobile compatibility)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setError('Image size should be less than 5MB')
      return
    }

    // Clear any previous preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    // Create preview URL
    try {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setFormData(prev => ({ ...prev, profilePhoto: file }))
      setError('')
      
      // Simulate upload progress
      setUploadProgress(0)
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 10
        })
      }, 50)
    } catch (err) {
      console.error('Error creating preview:', err)
      setError('Failed to preview image. Please try another photo.')
    }
  }

  const removePhoto = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl('')
    setFormData(prev => ({ ...prev, profilePhoto: null }))
    setUploadProgress(0)
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const linkTemporaryAttendanceRecords = async (studentId: string, lrn: string) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .update({
          student_id: studentId,
          is_temporary: false,
          needs_registration: false
        })
        .eq('lrn', lrn)
        .eq('is_temporary', true)

      if (error) {
        console.error('Error linking temporary records:', error)
      } else {
        console.log(`Linked ${lrn} temporary attendance records to student ${studentId}`)
      }
    } catch (error) {
      console.error('Error linking records:', error)
    }
  }

  // Improved file reading function with better error handling for mobile
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Check if FileReader is supported
      if (!window.FileReader) {
        reject(new Error('FileReader is not supported in this browser'))
        return
      }

      const reader = new FileReader()
      
      // Set a timeout for slow mobile devices
      const timeout = setTimeout(() => {
        reader.abort()
        reject(new Error('File reading timed out. Please try a smaller image or different format.'))
      }, 30000) // 30 second timeout

      reader.onload = () => {
        clearTimeout(timeout)
        try {
          const result = reader.result as string
          if (!result) {
            reject(new Error('Failed to read image file - empty result'))
            return
          }
          // Validate that it's actually a base64 image
          if (!result.startsWith('data:image/')) {
            reject(new Error('Invalid image format detected'))
            return
          }
          resolve(result)
        } catch (err) {
          reject(new Error('Failed to process image data'))
        }
      }

      reader.onerror = (error) => {
        clearTimeout(timeout)
        console.error('FileReader error:', reader.error)
        // Provide more specific error messages based on error type
        switch (reader.error?.code) {
          case DOMException.NOT_FOUND_ERR:
            reject(new Error('Image file not found. Please try selecting the image again.'))
            break
          case DOMException.NOT_READABLE_ERR:
            reject(new Error('Cannot read image file. The file might be corrupted or in use by another app.'))
            break
          case DOMException.SECURITY_ERR:
            reject(new Error('Security error reading image. Please check your browser permissions.'))
            break
          default:
            reject(new Error('Failed to read image file. Please try a different photo or format.'))
        }
      }

      reader.onabort = () => {
        clearTimeout(timeout)
        reject(new Error('Image reading was cancelled'))
      }

      // Try reading the file
      try {
        reader.readAsDataURL(file)
      } catch (err) {
        clearTimeout(timeout)
        reject(new Error('Failed to start reading image file. The file might be too large or unsupported.'))
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateStep(5)) {
      return
    }

    // Validate password strength
    const passwordValidation = AuthUtils.validatePasswordStrength(formData.password)
    if (!passwordValidation.isValid) {
      setError(`Password requirements: ${passwordValidation.errors.join(', ')}`)
      return
    }

    setLoading(true)
    setQrGenerating(true)
    setError('')

    try {
      // Hash the password
      const hashedPassword = await AuthUtils.hashPassword(formData.password)
      
      // Convert profile photo to base64 if exists
      let photoBase64 = null
      if (formData.profilePhoto) {
        try {
          photoBase64 = await readFileAsBase64(formData.profilePhoto)
        } catch (photoError: any) {
          setError(photoError.message || 'Failed to process profile photo. Please try again without a photo or use a different image.')
          setLoading(false)
          setQrGenerating(false)
          return
        }
      }

      // Generate encrypted QR code automatically
      setQrGenerating(true)
      const qrCodeData = await generateEncryptedQRCode(formData.lrn)

      // Insert with hashed password and base64 photo
      const { data, error: dbError } = await supabase
        .from('students')
        .insert([
          {
            // Account Credentials
            lrn: formData.lrn,
            email: formData.email,
            password_hash: hashedPassword,
            
            // Personal Information
            first_name: formData.firstName,
            middle_name: formData.middleName,
            last_name: formData.lastName,
            sex: formData.sex,
            date_of_birth: formData.dateOfBirth,
            contact_number: formData.contactNumber,
            address: formData.address,
            profile_photo_base64: photoBase64,
            
            // Education Background
            grade: formData.currentGrade,
            section: 'SHS',
            previous_elementary: formData.previousElementary,
            previous_high_school: formData.previousHighSchool || null,
            
            // Parents Information
            father_name: formData.fatherName || null,
            father_occupation: formData.fatherOccupation || null,
            mother_name: formData.motherName || null,
            mother_occupation: formData.motherOccupation || null,
            guardian_name: formData.guardianName || null,
            guardian_contact: formData.guardianContact || null,
            
            // Medical Background
            medical_conditions: formData.medicalConditions || null,
            medications: formData.medications || null,
            allergies: formData.allergies || null,
            emergency_contact: formData.emergencyContact,
            
            // System Information
            qr_code_data: qrCodeData,
            is_active: true
          }
        ])
        .select()

      if (dbError) throw dbError

      const newStudent = data?.[0]
      if (newStudent?.id) {
        await linkTemporaryAttendanceRecords(newStudent.id, formData.lrn)
      }

      setQrGenerating(false)
      setSuccess('Registration successful! Your encrypted QR code has been generated.')
      
      setTimeout(() => {
        router.push('/login')
      }, 3000)
      
    } catch (err: any) {
      setQrGenerating(false)
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const renderStep = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Personal Information</h3>
            
            {/* Profile Photo Upload Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Profile Photo (Optional)</label>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                {/* Photo Preview/Upload Area */}
                <div className="shrink-0">
                  {previewUrl ? (
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                        <img 
                          src={previewUrl} 
                          alt="Profile preview" 
                          className="w-full h-full object-cover"
                          onError={() => {
                            setError('Failed to load image preview')
                            removePhoto()
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute -top-1 -right-1 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        capture="user"
                      />
                      <div className="w-32 h-32 rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors group-hover:border-blue-400">
                        <Camera className="w-10 h-10 text-gray-400 mb-2" />
                        <span className="text-xs text-gray-500 text-center px-2">Upload Photo</span>
                      </div>
                    </label>
                  )}
                </div>

                {/* Upload Info */}
                <div className="flex-1">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Upload Requirements</h4>
                      <ul className="text-xs text-gray-500 space-y-1">
                        <li className="flex items-center">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></div>
                          File types: JPG, PNG, GIF, WebP
                        </li>
                        <li className="flex items-center">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></div>
                          Max file size: 5MB
                        </li>
                        <li className="flex items-center">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></div>
                          Recommended: Square photo, clear face
                        </li>
                        <li className="flex items-center text-amber-600">
                          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mr-2"></div>
                          For mobile: Use camera or photo library
                        </li>
                      </ul>
                    </div>

                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Processing...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {uploadProgress === 100 && (
                      <div className="flex items-center text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Photo ready for upload
                      </div>
                    )}

                    {!previewUrl && (
                      <div className="pt-2">
                        <label className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer text-sm font-medium">
                          <Upload className="w-4 h-4 mr-2" />
                          Choose File
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            capture="user"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Information Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                  className="w-full px-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Juan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
                <input
                  type="text"
                  value={formData.middleName}
                  onChange={(e) => setFormData(prev => ({ ...prev, middleName: e.target.value }))}
                  className="w-full px-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Santos"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                  className="w-full px-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Dela Cruz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sex *</label>
                <select
                  value={formData.sex}
                  onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value }))}
                  className="w-full px-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                >
                  {sexes.map(sex => (
                    <option key={sex} value={sex}>{sex}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth *</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  required
                  className="w-full px-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={formData.contactNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactNumber: e.target.value }))}
                    required
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="09123456789"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Complete Address *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Home className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    required
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="123 Street, City, Province"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Education Background</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Grade Level *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <BookOpen className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    value={formData.currentGrade}
                    onChange={(e) => setFormData(prev => ({ ...prev, currentGrade: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    {grades.map(grade => (
                      <option key={grade} value={grade}>Grade {grade}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">School Level</label>
                <input
                  type="text"
                  value="Senior High School"
                  disabled
                  className="w-full px-4 py-3 text-base bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Previous Elementary School *</label>
                <input
                  type="text"
                  value={formData.previousElementary}
                  onChange={(e) => setFormData(prev => ({ ...prev, previousElementary: e.target.value }))}
                  required
                  className="w-full px-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="St. Anne's Elementary School"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Previous High School (if applicable)</label>
                <input
                  type="text"
                  value={formData.previousHighSchool}
                  onChange={(e) => setFormData(prev => ({ ...prev, previousHighSchool: e.target.value }))}
                  className="w-full px-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="St. Anne's High School"
                />
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Parents/Guardian Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Father's Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.fatherName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Juan Dela Cruz Sr."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Father's Occupation</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Briefcase className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.fatherOccupation}
                    onChange={(e) => setFormData(prev => ({ ...prev, fatherOccupation: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Engineer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mother's Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.motherName}
                    onChange={(e) => setFormData(prev => ({ ...prev, motherName: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Maria Dela Cruz"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mother's Occupation</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Briefcase className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.motherOccupation}
                    onChange={(e) => setFormData(prev => ({ ...prev, motherOccupation: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Teacher"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Guardian's Name (if different)</label>
                <input
                  type="text"
                  value={formData.guardianName}
                  onChange={(e) => setFormData(prev => ({ ...prev, guardianName: e.target.value }))}
                  className="w-full px-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Guardian's Full Name"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Guardian's Contact Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={formData.guardianContact}
                    onChange={(e) => setFormData(prev => ({ ...prev, guardianContact: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="09123456789"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Medical Background</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Medical Conditions</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <AlertCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    value={formData.medicalConditions}
                    onChange={(e) => setFormData(prev => ({ ...prev, medicalConditions: e.target.value }))}
                    rows={2}
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="List any medical conditions (e.g., Asthma, Diabetes, etc.)"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Medications</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Pill className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    value={formData.medications}
                    onChange={(e) => setFormData(prev => ({ ...prev, medications: e.target.value }))}
                    rows={2}
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="List any regular medications"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <AlertCircle className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    value={formData.allergies}
                    onChange={(e) => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
                    rows={2}
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="List any allergies (e.g., Food, Medicine, etc.)"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact Number *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergencyContact: e.target.value }))}
                    required
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Emergency contact number"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Account Credentials</h3>
            
            {/* QR Code Info Banner */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-purple-800 mb-1">Encrypted QR Code</h4>
                  <p className="text-xs text-purple-600">
                    After registration, we'll automatically generate your secure encrypted QR code. 
                    You can download it from your dashboard.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Learner Reference Number (LRN) *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Hash className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.lrn}
                    onChange={(e) => setFormData(prev => ({ ...prev, lrn: e.target.value }))}
                    required
                    maxLength={12}
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="12-digit LRN"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="student@email.com"
                  />
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      required
                      className="w-full pl-12 pr-12 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Create a strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                
                {/* Password Requirements Display */}
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <p className="font-medium">Password Requirements:</p>
                  <ul className="list-disc list-inside pl-2 space-y-0.5">
                    <li className={formData.password.length >= 8 ? 'text-green-600' : 'text-gray-400'}>
                      At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                      One uppercase letter
                    </li>
                    <li className={/[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                      One lowercase letter
                    </li>
                    <li className={/\d/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                      One number
                    </li>
                    <li className={/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                      One special character
                    </li>
                  </ul>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                    className="w-full pl-12 pr-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Confirm your password"
                  />
                </div>
                {formData.password && formData.confirmPassword && (
                  <div className="mt-2 text-xs">
                    {formData.password === formData.confirmPassword ? (
                      <span className="text-green-600 flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Passwords match
                      </span>
                    ) : (
                      <span className="text-red-600">Passwords do not match</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Left Panel - Brand/Info */}
      <div className="lg:w-1/2 bg-linear-to-br from-pink-600 via-purple-800 to-violet-950 p-5 sm:p-6 lg:p-8 flex flex-col">
        {/* Mobile Logo & Progress */}
        <div className="lg:hidden mb-5 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
                {mobileLogoError ? (
                  <div className="w-full h-full bg-linear-to-br from-indigo-600 to-purple-800 rounded-lg flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-base">EP</span>
                  </div>
                ) : (
                  <Image
                    src="/logo.png"
                    alt="EduScan Logo"
                    width={48}
                    height={48}
                    className="w-12 h-12 object-contain"
                    onError={() => setMobileLogoError(true)}
                  />
                )}
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white">St. Anne's Academy</h1>
                <p className="text-pink-200 text-xs">EduScan Portal</p>
              </div>
            </div>
          </div>
          
          {/* Mobile Progress */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/30 flex items-center justify-center">
                <span className="text-white text-lg font-bold">{currentStep}</span>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">
                  {steps.find(s => s.number === currentStep)?.title}
                </h3>
                <p className="text-gray-200 text-xs">Step {currentStep} of 5</p>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-1.5">
              <div 
                className="bg-pink-400 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 5) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Desktop Content */}
        <div className="hidden lg:flex flex-col h-full">
          <div className="shrink-0">
            {/* Logo Section */}
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-30 h-30 flex items-center justify-center overflow-hidden">
                {desktopLogoError ? (
                  <div className="w-full h-full bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-3xl">EP</span>
                  </div>
                ) : (
                  <Image
                    src="/logo.png"
                    alt="EduScan Logo"
                    width={120}
                    height={120}
                    className="w-full h-full object-contain"
                    onError={() => setDesktopLogoError(true)}
                  />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight">
                  St. Anne's Academy
                </h1>
                <p className="text-pink-200 text-sm">EduScan Portal</p>
              </div>
            </div>

            {/* Welcome Section */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-3">
                Complete Student{' '}
                <span className="text-pink-200">
                  Registration
                </span>
              </h2>
              <p className="text-gray-100 text-sm leading-relaxed">
                Follow the 5-step process to create your account. Your encrypted QR code will be automatically generated.
              </p>
            </div>
          </div>

          {/* Current Step Highlight */}
          <div className="mt-4 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-pink-500/30 flex items-center justify-center">
                  <span className="text-white text-xl font-bold">{currentStep}</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold">
                    {steps.find(s => s.number === currentStep)?.title}
                  </h3>
                  <p className="text-gray-200 text-xs">Step {currentStep} of 5</p>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div 
                  className="bg-pink-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / 5) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="space-y-2 mb-6">
            {steps.map(step => {
              const StepIcon = step.icon
              const isCompleted = step.number < currentStep
              const isCurrent = step.number === currentStep
              
              return (
                <div 
                  key={step.number} 
                  className={`flex items-center space-x-3 p-2 rounded-lg ${isCurrent ? 'bg-white/20' : isCompleted ? 'bg-green-500/10' : 'bg-white/5'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCurrent ? 'bg-pink-500' : isCompleted ? 'bg-green-500' : 'bg-white/20'}`}>
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : (
                      <StepIcon className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${isCurrent ? 'text-white' : isCompleted ? 'text-green-200' : 'text-gray-300'}`}>
                      Step {step.number}: {step.title}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-4 border-t border-white/20">
            <p className="text-gray-100 text-xs">
              © 2024 EduPortal. All rights reserved.
            </p>
            <p className="text-gray-100 text-xs mt-1">
              St. Anne's Academy 
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Registration Form */}
      <div className="lg:w-1/2 flex-1 p-4 sm:p-5 lg:p-8 flex flex-col">
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
          {/* Desktop Header */}
          <div className="hidden lg:block mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Student Registration
            </h1>
            <p className="text-gray-600 text-base">
              Complete all 5 steps to create your account. Your encrypted QR code will be automatically generated.
            </p>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <div className="shrink-0">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mr-3">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                </div>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <div className="shrink-0">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mr-3">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                </div>
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            </div>
          )}

          {/* QR Generation Status */}
          {qrGenerating && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center">
                <div className="shrink-0 mr-3">
                  <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-purple-700 text-sm">Generating your encrypted QR code...</p>
              </div>
            </div>
          )}

          {/* Registration Form */}
          <div className="flex-1 flex flex-col">
            <form 
              onSubmit={currentStep === 5 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }}
              className="flex-1 flex flex-col"
            >
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-5 sm:mb-6 flex-1">
                {renderStep()}
              </div>

              {/* Navigation Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-0 sm:justify-between mt-auto">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1 || loading}
                  className="w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  ← Previous
                </button>

                {currentStep < 5 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="w-full sm:w-auto px-6 py-3 bg-violet-800 hover:bg-purple-600 text-white font-medium rounded-lg text-base transition-all duration-200 flex items-center justify-center group"
                  >
                    Next Step
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Complete Registration
                        <CheckCircle className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>

            {/* Terms & Privacy */}
            <div className="text-center text-sm text-gray-500 mt-6 pt-6 border-t border-gray-200">
              <p>
                By creating an account you agree to our{' '}
                <Link href="/terms" className="text-blue-600 hover:text-blue-800">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-800">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            {/* Login Link */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Already have an account?</span>
              </div>
            </div>

            <div className="text-center">
              <Link
                href="/login"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium text-base group"
              >
                Sign in to your account
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Mobile Back to home */}
            <div className="lg:hidden mt-6 pt-6 border-t border-gray-200">
              <Link
                href="/"
                className="inline-flex items-center text-gray-600 hover:text-gray-800 text-sm"
              >
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
