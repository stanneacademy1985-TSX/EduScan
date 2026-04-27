import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashPassword } from '../../../../lib/auth-utils'
import { generateEncryptedQRCode } from '../../../../lib/qr-generator'
import { ValidationError, validateLrn } from '../../../../lib/lrn-validation'

type StudentInput = {
  lrn?: string
  first_name?: string
  middle_name?: string | null
  last_name?: string
  sex?: string | null
  date_of_birth?: string | null
  contact_number?: string | null
  address?: string | null
  email?: string | null
  grade?: string
  section?: string | null
  previous_elementary?: string | null
  previous_high_school?: string | null
  previous_shs?: string | null
  father_name?: string | null
  father_occupation?: string | null
  mother_name?: string | null
  mother_occupation?: string | null
  guardian_name?: string | null
  guardian_contact?: string | null
  medical_conditions?: string | null
  medications?: string | null
  allergies?: string | null
  emergency_contact?: string | null
  profile_photo_base64?: string | null
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

console.log('API Route - Checking environment:', {
  hasUrl: !!supabaseUrl,
  hasServiceKey: !!serviceRoleKey,
  urlPrefix: supabaseUrl?.substring(0, 30)
})

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null

const normalizeText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const normalizeOptional = (value: unknown): string | null => {
  const normalized = normalizeText(value)
  return normalized || null
}

const buildStudentRecord = async (student: StudentInput) => {
  const lrnValidation = validateLrn(student.lrn)
  const lrn = lrnValidation.lrn
  const firstName = normalizeText(student.first_name)
  const lastName = normalizeText(student.last_name)
  const grade = normalizeText(student.grade)
  const email = normalizeText(student.email)

  if (!lrnValidation.isValid) {
    throw new ValidationError(lrnValidation.errorMessage || 'Invalid LRN.')
  }

  if (!firstName || !lastName || !grade) {
    throw new Error('LRN, first name, last name, and grade are required.')
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.')
  }

  const middleName = normalizeText(student.middle_name)
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ')
  
  console.log(`Generating QR and hash for LRN: ${lrn}`)
  
  const [qrCodeData, passwordHash] = await Promise.all([
    generateEncryptedQRCode(lrn),
    hashPassword(lrn)
  ])

  return {
    lrn,
    first_name: firstName,
    middle_name: middleName || null,
    last_name: lastName,
    sex: normalizeOptional(student.sex) || '',
    date_of_birth: normalizeOptional(student.date_of_birth) || '2000-01-01',
    contact_number: normalizeOptional(student.contact_number) || '',
    address: normalizeOptional(student.address) || '',
    email: email || `${lrn}@students.eduscan.local`,
    grade,
    section: normalizeOptional(student.section) || 'SHS',
    previous_elementary: normalizeOptional(student.previous_elementary) || 'N/A',
    previous_high_school: normalizeOptional(student.previous_high_school),
    previous_shs: normalizeOptional(student.previous_shs),
    father_name: normalizeOptional(student.father_name),
    father_occupation: normalizeOptional(student.father_occupation),
    mother_name: normalizeOptional(student.mother_name),
    mother_occupation: normalizeOptional(student.mother_occupation),
    guardian_name: normalizeOptional(student.guardian_name),
    guardian_contact: normalizeOptional(student.guardian_contact),
    medical_conditions: normalizeOptional(student.medical_conditions),
    medications: normalizeOptional(student.medications),
    allergies: normalizeOptional(student.allergies),
    emergency_contact: normalizeOptional(student.emergency_contact) || normalizeOptional(student.contact_number) || '',
    profile_photo_base64: normalizeOptional(student.profile_photo_base64),
    password_hash: passwordHash,
    qr_code_data: qrCodeData,
    is_active: true,
    created_at: new Date().toISOString()
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!supabase) {
      const errorMsg = 'Supabase service role is not configured. Please check your environment variables.'
      console.error(errorMsg, {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey,
        supabaseUrl: supabaseUrl?.substring(0, 30)
      })
      
      return NextResponse.json(
        { 
          error: errorMsg,
          details: {
            hasSupabaseUrl: !!supabaseUrl,
            hasServiceKey: !!serviceRoleKey
          }
        },
        { status: 500 }
      )
    }

    const body = await req.json()
    console.log('Request body received:', { 
      hasStudent: !!body?.student, 
      hasStudents: !!body?.students,
      bodyKeys: Object.keys(body)
    })
    
    const studentsInput = Array.isArray(body?.students) 
      ? body.students 
      : body?.student 
        ? [body.student] 
        : []

    if (studentsInput.length === 0) {
      return NextResponse.json(
        { error: 'No student data provided. Please provide either "student" or "students" in the request body.' },
        { status: 400 }
      )
    }

    console.log(`Processing ${studentsInput.length} student(s)...`)

    const studentRecords = await Promise.all(
      studentsInput.map((student: StudentInput, index: number) => {
        console.log(`Building record for student ${index + 1}:`, student.lrn)
        return buildStudentRecord(student)
      })
    )

    console.log(`Inserting ${studentRecords.length} records into Supabase...`)

    const { data, error } = await supabase
      .from('students')
      .insert(studentRecords)
      .select()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        {
          error: error.message || 'Unknown database error',
          details: error.details,
          hint: error.hint,
          code: error.code
        },
        { status: error.code === '23505' ? 409 : 500 }
      )
    }

    console.log(`Successfully created ${data?.length || 0} students`)
    
    return NextResponse.json(
      { 
        data, 
        count: studentRecords.length,
        message: `Successfully created ${data?.length || 0} student(s)`
      }, 
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create student record.'
    console.error('Students API unexpected error:', error)

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: message,
          source: 'students_api_validation'
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: message,
        source: 'students_api_catch',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}