'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LoginFormData } from '../../../../lib/types'
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react'
import { AuthUtils } from '../../../../lib/auth-utils'

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isClient, setIsClient] = useState(false)
  const [desktopLogoError, setDesktopLogoError] = useState(false)
  const [mobileLogoError, setMobileLogoError] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsClient(true)
    // Check if already logged in THIS TAB
    const currentSession = sessionStorage.getItem('currentSession')
    if (currentSession) {
      router.push('/student/dashboard')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    try {
      const { data: student, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('email', formData.email)
        .single()

      if (fetchError || !student) {
        throw new Error('Invalid email or password')
      }

      const isPasswordValid = await AuthUtils.verifyPassword(
        formData.password, 
        student.password_hash
      )

      if (!isPasswordValid) {
        throw new Error('Invalid email or password')
      }

      // Generate a unique session ID for this login session
      const sessionId = `${student.id}_${Date.now()}_${Math.random().toString(36).substring(2)}`

      const sessionData = {
        id: student.id,
        email: student.email,
        name: student.full_name,
        firstName: student.first_name,
        lastName: student.last_name,
        lrn: student.lrn,
        grade: student.grade,
        section: student.section,
        profilePhoto: student.profile_photo_base64,
        lastLogin: new Date().toISOString(),
        sessionId: sessionId
      }

      // Store ONLY in sessionStorage - this is per tab/browser instance
      sessionStorage.setItem('currentSession', JSON.stringify({
        sessionId: sessionId,
        data: sessionData
      }))

      setSuccess('Login successful!')
      
      setTimeout(() => {
        router.push('/student/dashboard')
      }, 1500)

    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.')
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
  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Panel - Brand/Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-pink-600 via-purple-800 to-violet-950 p-8 xl:p-12 flex-col justify-between">
        <div>
          {/* Logo Section */}
          <div className="flex items-center space-x-4 mb-16">
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
              <p className="text-gray-300 text-sm">EduScan Portal</p>
            </div>
          </div>

          {/* Welcome Section */}
          <div className="mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                EduScanPortal
              </span>
            </h2>
            <p className="text-gray-100 text-lg leading-relaxed max-w-xl">
              Access your personalized student dashboard, track your progress, and connect with your educational journey.
            </p>
          </div>

          {/* Features Section */}
          <div className="space-y-6 mb-16">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Track your attendance progress</h3>
                <p className="text-gray-100 text-sm">Track daily attendance records, view attendance history, and monitor present, late, and absent statuses in real time.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">View student personal information</h3>
                <p className="text-gray-100 text-sm">Access student profiles including name, ID number, course, section, and contact details, all organized in one secure place.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Attendance summaries and reports</h3>
                <p className="text-gray-100 text-sm"> Generate attendance summaries and reports to help identify patterns, monitor consistency, and support academic monitoring.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/20 relative -top-5">
          <p className="text-gray-100 text-sm">
            © 2024 EduPortal. All rights reserved.
          </p>
          <p className="text-gray-100 text-xs mt-2">
            St. Anne's Academy 
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-5 sm:p-8 lg:p-16">
        <div className="max-w-md mx-auto w-full">
          {/* Mobile Header */}
          <div className="lg:hidden mb-7">
            <div className="flex items-center space-x-3 mb-6">
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
              <span className="text-xl sm:text-2xl font-bold text-gray-900">EduScan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Welcome back
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Sign in to your student account
            </p>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Sign in to your account
            </h1>
            <p className="text-gray-600">
              Enter your credentials to access your dashboard
            </p>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mr-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>
                </div>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mr-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                </div>
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, email: e.target.value }))
                    setError('')
                  }}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                  placeholder="youremail@email.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, password: e.target.value }))
                    setError('')
                  }}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {/* Continue Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-3.5 px-4 bg-violet-800 hover:bg-purple-600 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group mt-6 sm:mt-8"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Terms & Privacy */}
            <div className="text-center text-xs text-gray-500 max-w-sm mx-auto pt-2 sm:pt-4">
              <p>
                By signing in you agree to our{' '}
                <Link href="/terms" className="text-blue-600 hover:text-blue-800">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-800">
                  Privacy Policy
                </Link>
                . We'll occasionally send you emails about important updates; you can opt-out anytime.
              </p>
            </div>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Don't have an account?</span>
              </div>
            </div>

            {/* Register Link */}
            <div className="text-center">
              <Link
                href="/register"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm group"
              >
                Create your free account
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </form>

          {/* Mobile Back to home */}
          <div className="lg:hidden mt-8 pt-6 border-t border-gray-200">
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
  )
}