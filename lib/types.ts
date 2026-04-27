export interface Student {
  id: string;
  lrn: string;
  email: string;
  
  // Personal Information
  first_name: string;
  middle_name?: string;
  last_name: string;
  sex: string;
  date_of_birth: string;
  contact_number: string;
  address: string;
  profile_photo_base64?: string;
  full_name: string;
  
  // Education Background
  grade: string;
  section: string;
  previous_elementary: string;
  previous_high_school?: string;
  previous_shs?: string;
  
  // Parents/Guardian Information
  father_name?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_occupation?: string;
  guardian_name?: string;
  guardian_contact?: string;
  
  // Medical Background
  medical_conditions?: string;
  medications?: string;
  allergies?: string;
  emergency_contact: string;
  
  // System Information
  qr_code_data: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  date: string;
  time_in: string;
  section: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  created_at: string;
}

// Update the RegisterFormData interface to match your new form
export interface RegisterFormData {
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
  currentSection: string;
  previousElementary: string;
  previousHighSchool: string;
  previousSHS: string;
  
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

export interface LoginFormData {
  email: string;
  password: string;
}


export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  section: string;
  date: string;
  start_time: string;
  end_time?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface StudentWithAttendance extends Student {
  attendance_count: number;
  last_attendance?: string;
  attendance_rate?: number;
}

export interface SectionSummary {
  section: string;
  total_students: number;
  present_today: number;
  absent_today: number;
}

export interface AttendanceReport {
  id: string;
  student_name: string;
  lrn: string;
  section: string;
  date: string;
  time_in: string;
  status: string;
  recorded_by: string;
}

export interface AdminLoginFormData {
  email: string;
  password: string;
}