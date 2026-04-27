'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'
import { verifyPassword } from '../../../../lib/auth-utils'
import { getStoredAdminSession, storeAdminSession } from '../../../../lib/admin-auth'
import { Mail, Lock, Loader2, ArrowRight, Shield } from 'lucide-react'

export default function SuperAdminLogin() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    const adminSession = getStoredAdminSession()
    if (adminSession?.role === 'super_admin') {
      router.push('/super-admin/dashboard')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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
      const { data: admin, error: fetchError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', formData.email)
        .eq('role', 'super_admin')
        .eq('is_active', true)
        .single()

      if (fetchError || !admin) {
        throw new Error('Invalid credentials or insufficient permissions')
      }

      const isPasswordValid = await verifyPassword(formData.password, admin.password_hash)
      if (!isPasswordValid) {
        throw new Error('Invalid credentials')
      }

      const sessionUser = {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
        assigned_grade: admin.assigned_grade,
        assigned_section: admin.assigned_section,
        is_active: admin.is_active
      }

      storeAdminSession(sessionUser)
      localStorage.setItem('admin', JSON.stringify(sessionUser))

      router.push('/super-admin/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-gray-300 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-white">
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-indigo-600 via-purple-800 to-indigo-950 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center space-x-4 mb-16">
            <div className="w-30 h-30">
              <img 
                src="/logo.png" 
                alt="St. Anne's Academy Logo" 
                className="w-30 h-30 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = `
                    <div class="w-30 h-30 bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg class="w-16 h-16 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                  `;
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">
                Super Admin Portal
              </h1>
              <p className="text-gray-300 text-sm">St. Anne's Academy</p>
            </div>
          </div>

          <div className="mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              Welcome{' '}
              <span className="bg-linear-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
                Super Admin
              </span>
            </h2>
            <p className="text-gray-100 text-lg leading-relaxed max-w-xl">
              Access school-wide management tools for reports, students, and teacher assignments from one secure dashboard.
            </p>
          </div>

          <div className="space-y-6 mb-16">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0 mt-1">
                <div className="w-3 h-3 bg-indigo-400 rounded-full"></div>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">School-Wide Visibility</h3>
                <p className="text-gray-100 text-sm">See attendance trends and performance across all grade levels and sections.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center shrink-0 mt-1">
                <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Teacher & Student Management</h3>
                <p className="text-gray-100 text-sm">Manage teacher accounts and student assignments with centralized control.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0 mt-1">
                <div className="w-3 h-3 bg-indigo-400 rounded-full"></div>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Secure Administration</h3>
                <p className="text-gray-100 text-sm">Operate critical settings and reports in a protected super-admin environment.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/20 relative -top-5">
          <p className="text-gray-100 text-sm">
            EduScan QR Attendance System. All rights reserved.
          </p>
          <p className="text-gray-100 text-xs mt-2">
            St. Anne's Academy - Super Admin Portal
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-16">
        <div className="max-w-md mx-auto w-full">
          <div className="lg:hidden mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12">
                <img 
                  src="/logo.png" 
                  alt="St. Anne's Academy Logo" 
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = `
                      <div class="w-12 h-12 bg-linear-to-br from-indigo-600 to-purple-800 rounded-lg flex items-center justify-center shadow-lg">
                        <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </div>
                    `;
                  }}
                />
              </div>
              <span className="text-2xl font-bold text-gray-900">Super Admin Portal</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Welcome back
            </h1>
            <p className="text-gray-600">
              Sign in to your super administrator account
            </p>
          </div>

          <div className="hidden lg:block mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Super Admin Sign In
            </h1>
            <p className="text-gray-600">
              Enter your credentials to access the super admin dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <div className="shrink-0">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mr-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>
                </div>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Super Admin Email
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
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-gray-400"
                  placeholder="superadmin@stannes.edu.ph"
                />
              </div>
            </div>

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
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-gray-400"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-linear-to-r from-indigo-600 to-purple-800 hover:from-indigo-700 hover:to-purple-900 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group mt-8"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                <>
                  Super Admin Login
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center text-xs text-gray-500 max-w-sm mx-auto pt-4">
              <p>
                By signing in you agree to our{' '}
                <Link href="/terms" className="text-indigo-600 hover:text-indigo-800 font-medium">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-indigo-600 hover:text-indigo-800 font-medium">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Admin portal?</span>
              </div>
            </div>

            <div className="text-center">
              <Link
                href="/admin/login"
                className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-sm group"
              >
                Go to admin login
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </form>

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
