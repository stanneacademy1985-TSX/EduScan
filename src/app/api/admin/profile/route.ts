export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashPassword } from '../../../../../lib/auth-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase service client is not configured.' }, { status: 500 })
    }

    const body = await req.json()
    const adminId = typeof body.adminId === 'string' ? body.adminId.trim() : ''
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    const profilePhotoBase64 = typeof body.profile_photo_base64 === 'string' && body.profile_photo_base64.trim()
      ? body.profile_photo_base64.trim()
      : null

    if (!adminId || !fullName) {
      return NextResponse.json({ error: 'Admin ID and full name are required.' }, { status: 400 })
    }

    const updatePayload: any = {
      full_name: fullName,
      profile_photo_base64: profilePhotoBase64
    }

    if (typeof body.email === 'string' && body.email.trim()) {
      updatePayload.email = body.email.trim().toLowerCase()
    }

    if (typeof body.password === 'string' && body.password.trim()) {
      const hashed = await hashPassword(body.password.trim())
      updatePayload.password_hash = hashed
    }

    const { data, error } = await supabase
      .from('admin_users')
      .update(updatePayload)
      .eq('id', adminId)
      .select('id, email, full_name, role, assigned_grade, assigned_section, profile_photo_base64, is_active')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ admin: data })
  } catch (error) {
    console.error('API admin profile error', error)
    return NextResponse.json({ error: (error as Error).message || 'Unknown error' }, { status: 500 })
  }
}
