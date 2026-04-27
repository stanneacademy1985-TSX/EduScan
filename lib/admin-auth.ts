import { supabase } from './supabase'

export interface AdminSessionUser {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'admin' | 'teacher'
  assigned_grade?: string | null
  assigned_section?: string | null
  is_active?: boolean
}

export const ADMIN_SESSION_KEY = 'admin_session'
export const SUPER_ADMIN_SESSION_KEY = 'super_admin_session'

export function isSuperAdmin(admin: AdminSessionUser | null | undefined) {
  return admin?.role === 'super_admin'
}

export function getStoredAdminSession(): AdminSessionUser | null {
  if (typeof window === 'undefined') return null

  const superAdminSession = sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY)
  if (superAdminSession) {
    try {
      return JSON.parse(superAdminSession)
    } catch {
      sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY)
    }
  }

  const adminSession = sessionStorage.getItem(ADMIN_SESSION_KEY)
  if (adminSession) {
    try {
      return JSON.parse(adminSession)
    } catch {
      sessionStorage.removeItem(ADMIN_SESSION_KEY)
    }
  }

  return null
}

export function storeAdminSession(admin: AdminSessionUser) {
  if (typeof window === 'undefined') return

  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin))

  if (admin.role === 'super_admin') {
    sessionStorage.setItem(SUPER_ADMIN_SESSION_KEY, JSON.stringify(admin))
  } else {
    sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY)
  }
}

export function clearAdminSessions() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
  sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY)
  localStorage.removeItem('admin')
}

export function hasAssignedScope(admin: AdminSessionUser | null | undefined) {
  return Boolean(admin && admin.role !== 'super_admin' && admin.assigned_grade)
}

export async function getAssignedStudentIds(admin: AdminSessionUser | null | undefined): Promise<string[] | null> {
  if (!admin) return []
  if (admin.role === 'super_admin') return null
  if (!admin.id) return []

  const { data, error } = await supabase
    .from('student_teacher_assignments')
    .select('student_id')
    .eq('teacher_id', admin.id)

  if (error) {
    throw error
  }

  return (data || []).map((row: { student_id: string }) => row.student_id)
}

export async function fetchAdminById(id: string): Promise<AdminSessionUser | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, full_name, role, assigned_grade, assigned_section, is_active')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error) {
    return null
  }

  return data
}
