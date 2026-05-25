'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { fetchAdminById, getStoredAdminSession, storeAdminSession, type AdminSessionUser } from '../../../../lib/admin-auth'
import { hashPassword, validatePasswordStrength } from '../../../../lib/auth-utils'
import { User, Save, Loader2, AlertCircle, CheckCircle, Edit3 } from 'lucide-react'

interface ProfileForm {
  full_name: string
  email?: string
  password?: string
  confirm_password?: string
  profile_photo_base64?: string | null
}

export default function AdminProfilePage() {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState<ProfileForm>({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    profile_photo_base64: ''
  })
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])

  useEffect(() => {
    const loadProfile = async () => {
      const session = getStoredAdminSession()
      if (!session) {
        router.push('/admin/login')
        return
      }

      const freshAdmin = session.id ? await fetchAdminById(session.id) : session
      if (!freshAdmin || (freshAdmin.role !== 'admin' && freshAdmin.role !== 'teacher')) {
        router.push('/admin/login')
        return
      }

      setAdmin(freshAdmin)
      storeAdminSession(freshAdmin)
      localStorage.setItem('admin', JSON.stringify(freshAdmin))
      setForm({
        full_name: freshAdmin.full_name || '',
        email: freshAdmin.email || '',
        password: '',
        confirm_password: '',
        profile_photo_base64: (freshAdmin as any).profile_photo_base64 || ''
      })
      setLoading(false)
    }

    loadProfile()
  }, [router])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!admin) return
    // Validate password fields client-side
    if (form.password) {
      const strength = validatePasswordStrength(form.password)
      const errors: string[] = []
      if (!strength.isValid) errors.push(...strength.errors)
      if (form.password !== form.confirm_password) errors.push('Passwords do not match')
      setPasswordErrors(errors)
      if (errors.length > 0) {
        setMessage({ type: 'error', text: errors[0] })
        return
      }
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adminId: admin.id,
          full_name: form.full_name.trim(),
          email: form.email?.toLowerCase().trim() || null,
          password: form.password || null,
          profile_photo_base64: form.profile_photo_base64 || null
        })
      })

      const result = await response.json()
      if (!response.ok) {
        // Fallback: perform direct update from client. Hash password client-side if provided.
        const updatePayload: any = {
          full_name: form.full_name.trim(),
          profile_photo_base64: form.profile_photo_base64 || null
        }

        if (form.email) updatePayload.email = form.email.toLowerCase().trim()
        if (form.password) {
          const hashed = await hashPassword(form.password)
          updatePayload.password_hash = hashed
        }

        const fallbackUpdate = await supabase
          .from('admin_users')
          .update(updatePayload)
          .eq('id', admin.id)
          .select('id, email, full_name, role, assigned_grade, assigned_section, profile_photo_base64, is_active')
          .single()

        if (fallbackUpdate.error) {
          throw new Error(result.error || fallbackUpdate.error.message || 'Failed to update profile')
        }

        result.admin = fallbackUpdate.data
      }

      const updatedAdmin: AdminSessionUser = result.admin || {
        ...admin,
        full_name: form.full_name.trim(),
        profile_photo_base64: form.profile_photo_base64 || null
      }

      setAdmin(updatedAdmin)
      storeAdminSession(updatedAdmin)
      localStorage.setItem('admin', JSON.stringify(updatedAdmin))
      setMessage({ type: 'success', text: 'Profile updated successfully.' })
    } catch (error) {
      console.error('Error updating profile:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-2xl">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white blur-3xl"></div>
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-cyan-400 blur-3xl"></div>
        </div>
        <div className="relative flex flex-col gap-5 p-5 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm">
              {form.profile_photo_base64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.profile_photo_base64 as string} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200 sm:text-sm">Account Settings</p>
              <h1 className="text-2xl font-bold sm:text-3xl">My Profile</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-200 sm:text-base">Update the details teachers and admins see across the system.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm self-start lg:self-auto">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-300">Current role</p>
              <p className="font-semibold capitalize">{admin?.role || 'admin'}</p>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mt-6 rounded-2xl border p-4 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        </div>
      )}

        <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_0.95fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Editable Information</h2>
            <p className="text-sm text-slate-500 mt-1">These values are stored in `admin_users` and are used throughout the admin area.</p>
          </div>

            <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-2">Full Name</span>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 sm:text-base"
                placeholder="Your full name"
                required
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-2">Email Address</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 sm:text-base"
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-2">Password</span>
              <input
                type="password"
                value={form.password || ''}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 sm:text-base"
                placeholder="Enter new password (leave blank to keep current)"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</span>
              <input
                type="password"
                value={form.confirm_password || ''}
                onChange={(e) => setForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 sm:text-base"
                placeholder="Confirm new password"
              />
              {passwordErrors.length > 0 && (
                <ul className="mt-2 text-xs text-rose-600 list-disc list-inside">
                  {passwordErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </label>

            <label className="block sm:col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-2">Profile Photo</span>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {form.profile_photo_base64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.profile_photo_base64 as string} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => {
                      const result = reader.result as string
                      setForm(prev => ({ ...prev, profile_photo_base64: result }))
                    }
                    reader.readAsDataURL(file)
                  }}
                  className="w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700 sm:w-auto"
                />
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-60 sm:text-base"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/dashboard')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:text-base"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white shadow-sm sm:p-8">
          <h2 className="text-lg font-bold">Profile Preview</h2>
          <div className="mt-6 space-y-4">
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white/5">
                {form.profile_photo_base64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.profile_photo_base64 as string} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Name</p>
                <p className="mt-1 break-words text-base font-semibold">{form.full_name || 'Your name'}</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
