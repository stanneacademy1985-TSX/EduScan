// src/lib/super-admin.ts
import { supabase } from './supabase'
import { hashPassword } from './auth-utils'

export interface AdminUser {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'admin' | 'teacher'
  assigned_grade?: string
  assigned_section?: string
  is_active: boolean
  created_at: string
  password_hash?: string
  deleted_at?: string
}

export interface TeacherWithStudents {
  teacher_id: string
  teacher_name: string
  grade: string
  section: string
  student_count: number
  students: StudentSummary[]
}

export interface StudentSummary {
  id: string
  lrn: string
  full_name: string
  grade: string
  section: string
  attendance_rate: number
}

export interface OverallReport {
  totalStudents: number
  totalTeachers: number
  totalAttendance: number
  presentCount: number
  lateCount: number
  absentCount: number
  attendanceRate: number
  gradeBreakdown: Record<string, number>
  teacherBreakdown: Record<string, { present: number; late: number; absent: number }>
  dateRange: {
    startDate?: string
    endDate?: string
  }
}

// Type for the nested response from Supabase
interface StudentAssignmentResponse {
  student_id: string
  students: Array<{
    id: string
    lrn: string
    full_name: string
    grade: string
    section: string
  }> | null
}

export class SuperAdminService {
  // Get all teachers (admins with teacher role)
  static async getAllTeachers(): Promise<AdminUser[]> {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .in('role', ['admin', 'teacher'])
      .eq('is_active', true)
      .order('full_name')
    
    if (error) throw error
    return data || []
  }

  // Get all super admins
  static async getAllSuperAdmins(): Promise<AdminUser[]> {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('role', 'super_admin')
      .eq('is_active', true)
      .order('full_name')
    
    if (error) throw error
    return data || []
  }

  // Create a new teacher/admin account
  static async createAdminAccount(
    email: string,
    fullName: string,
    role: 'admin' | 'teacher',
    password: string,
    assignedGrade?: string,
    assignedSection?: string
  ): Promise<AdminUser> {
    // Hash the password
    const hashedPassword = await hashPassword(password)
    
    console.log('Creating admin account:', { email, fullName, role, assignedGrade })
    console.log('Password hash generated, first 20 chars:', hashedPassword.substring(0, 20))
    console.log('Hash format check - starts with $2a$:', hashedPassword.startsWith('$2a$'))
    
    // Insert into database
    const { data, error } = await supabase
      .from('admin_users')
      .insert({
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        role,
        assigned_grade: assignedGrade || null,
        assigned_section: assignedSection || null,
        password_hash: hashedPassword,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Supabase insert error:', error)
      throw new Error(`Failed to create admin account: ${error.message}`)
    }
    
    console.log('Admin account created successfully:', data.id)
    
    // Verify the password was stored correctly
    const { data: verifyData } = await supabase
      .from('admin_users')
      .select('password_hash')
      .eq('id', data.id)
      .single()
    
    console.log('Stored hash check - starts with $2a$:', verifyData?.password_hash?.startsWith('$2a$'))
    console.log('Stored hash length:', verifyData?.password_hash?.length)
    
    return data
  }

  // Assign students to a teacher
  static async assignStudentsToTeacher(
    teacherId: string,
    studentIds: string[]
  ): Promise<void> {
    if (studentIds.length === 0) return

    // Keep one active assignee per student by clearing prior assignments first.
    const { error: deleteError } = await supabase
      .from('student_teacher_assignments')
      .delete()
      .in('student_id', studentIds)

    if (deleteError) throw deleteError

    const assignments = studentIds.map(studentId => ({
      student_id: studentId,
      teacher_id: teacherId
    }))
    
    const { error } = await supabase
      .from('student_teacher_assignments')
      .insert(assignments)
    
    if (error) throw error
  }

  // Remove student from teacher
  static async removeStudentFromTeacher(
    teacherId: string,
    studentId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('student_teacher_assignments')
      .delete()
      .eq('teacher_id', teacherId)
      .eq('student_id', studentId)
    
    if (error) throw error
  }

  // Get students assigned to a teacher
  static async getTeacherStudents(teacherId: string): Promise<StudentSummary[]> {
    const { data, error } = await supabase
      .from('student_teacher_assignments')
      .select(`
        student_id,
        students:student_id (
          id,
          lrn,
          full_name,
          grade,
          section
        )
      `)
      .eq('teacher_id', teacherId)
    
    if (error) throw error
    
    // Safe mapping with proper null checks - Supabase returns array for nested relationships
    return ((data || []) as StudentAssignmentResponse[]).map((item) => {
      const studentData = item.students
      // Supabase returns an array for nested relationships
      const student = Array.isArray(studentData) && studentData.length > 0 ? studentData[0] : null
      
      return {
        id: student?.id || '',
        lrn: student?.lrn || '',
        full_name: student?.full_name || 'Unknown',
        grade: student?.grade || '',
        section: student?.section || '',
        attendance_rate: 0
      }
    })
  }

  // Get all teachers with their assigned students
  static async getAllTeachersWithStudents(): Promise<TeacherWithStudents[]> {
    const teachers = await this.getAllTeachers()
    const results: TeacherWithStudents[] = []
    
    for (const teacher of teachers) {
      const students = await this.getTeacherStudents(teacher.id)
      results.push({
        teacher_id: teacher.id,
        teacher_name: teacher.full_name,
        grade: teacher.assigned_grade || 'All',
        section: teacher.assigned_section || 'All',
        student_count: students.length,
        students
      })
    }
    
    return results
  }

  // Update teacher's assignment (grade/section)
  static async updateTeacherAssignment(
    teacherId: string,
    grade?: string,
    section?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('admin_users')
      .update({
        assigned_grade: grade,
        assigned_section: section
      })
      .eq('id', teacherId)
    
    if (error) throw error
  }

  // Get overall school report
  static async getOverallReport(
    startDate?: string,
    endDate?: string
  ): Promise<OverallReport> {
    // Total students
    const { count: totalStudents } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
    
    // Total teachers
    const { count: totalTeachers } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .in('role', ['admin', 'teacher'])
      .eq('is_active', true)
    
    // Total attendance records
    let attendanceQuery = supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
    
    if (startDate) attendanceQuery = attendanceQuery.gte('date', startDate)
    if (endDate) attendanceQuery = attendanceQuery.lte('date', endDate)
    
    const { count: totalAttendance } = await attendanceQuery
    
    // Attendance by status
    let statusQuery = supabase
      .from('attendance')
      .select('status')
    
    if (startDate) statusQuery = statusQuery.gte('date', startDate)
    if (endDate) statusQuery = statusQuery.lte('date', endDate)
    
    const { data: statusData } = await statusQuery
    
    const presentCount = statusData?.filter(s => s.status === 'present').length || 0
    const lateCount = statusData?.filter(s => s.status === 'late').length || 0
    const absentCount = statusData?.filter(s => s.status === 'absent').length || 0
    
    // Attendance by grade/section
    let gradeQuery = supabase
      .from('attendance')
      .select('grade, section')
    
    if (startDate) gradeQuery = gradeQuery.gte('date', startDate)
    if (endDate) gradeQuery = gradeQuery.lte('date', endDate)
    
    const { data: gradeData } = await gradeQuery
    
    const gradeStats: Record<string, number> = {}
    gradeData?.forEach(record => {
      const key = `Grade ${record.grade} - Section ${record.section}`
      gradeStats[key] = (gradeStats[key] || 0) + 1
    })
    
    // Attendance by teacher
    let teacherAttendanceQuery = supabase
      .from('attendance')
      .select('teacher_name, status')
    
    if (startDate) teacherAttendanceQuery = teacherAttendanceQuery.gte('date', startDate)
    if (endDate) teacherAttendanceQuery = teacherAttendanceQuery.lte('date', endDate)
    
    const { data: teacherData } = await teacherAttendanceQuery
    
    const teacherStats: Record<string, { present: number; late: number; absent: number }> = {}
    teacherData?.forEach(record => {
      if (!teacherStats[record.teacher_name]) {
        teacherStats[record.teacher_name] = { present: 0, late: 0, absent: 0 }
      }
      if (record.status === 'present') teacherStats[record.teacher_name].present++
      else if (record.status === 'late') teacherStats[record.teacher_name].late++
      else if (record.status === 'absent') teacherStats[record.teacher_name].absent++
    })
    
    return {
      totalStudents: totalStudents || 0,
      totalTeachers: totalTeachers || 0,
      totalAttendance: totalAttendance || 0,
      presentCount,
      lateCount,
      absentCount,
      attendanceRate: totalAttendance ? Math.round((presentCount / totalAttendance) * 100) : 0,
      gradeBreakdown: gradeStats,
      teacherBreakdown: teacherStats,
      dateRange: { startDate, endDate }
    }
  }

  // Deactivate/activate teacher account
  static async toggleTeacherStatus(teacherId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('admin_users')
      .update({ is_active: isActive })
      .eq('id', teacherId)
    
    if (error) throw error
  }

  // Delete teacher account (soft delete)
  static async deleteTeacher(teacherId: string): Promise<void> {
    const { error } = await supabase
      .from('admin_users')
      .update({ 
        is_active: false, 
        deleted_at: new Date().toISOString() 
      })
      .eq('id', teacherId)
    
    if (error) throw error
  }

  // Get unassigned students
  static async getUnassignedStudents(): Promise<StudentSummary[]> {
    const { data: assigned, error: assignedError } = await supabase
      .from('student_teacher_assignments')
      .select('student_id')
    
    if (assignedError) throw assignedError
    
    const assignedIds = assigned?.map(a => a.student_id) || []
    
    let query = supabase
      .from('students')
      .select('id, lrn, full_name, grade, section')
    
    if (assignedIds.length > 0) {
      query = query.not('id', 'in', `(${assignedIds.map(id => `'${id}'`).join(',')})`)
    }
    
    const { data, error } = await query.order('full_name')
    
    if (error) throw error
    
    return (data || []).map(student => ({
      id: student.id,
      lrn: student.lrn,
      full_name: student.full_name,
      grade: student.grade,
      section: student.section,
      attendance_rate: 0
    }))
  }

  // Get students by grade and section
  static async getStudentsByGradeSection(
    grade?: string,
    section?: string
  ): Promise<StudentSummary[]> {
    let query = supabase
      .from('students')
      .select('id, lrn, full_name, grade, section')
      .eq('is_active', true)
    
    if (grade) query = query.eq('grade', grade)
    if (section) query = query.eq('section', section)
    
    const { data, error } = await query.order('full_name')
    
    if (error) throw error
    
    return (data || []).map(student => ({
      id: student.id,
      lrn: student.lrn,
      full_name: student.full_name,
      grade: student.grade,
      section: student.section,
      attendance_rate: 0
    }))
  }

  // Get teacher by ID with full details
  static async getTeacherById(teacherId: string): Promise<AdminUser | null> {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', teacherId)
      .single()
    
    if (error) return null
    return data
  }
}