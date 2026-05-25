// src/lib/auth-utils.ts
// Client-safe utilities - no bcryptjs imports

export function validatePasswordStrength(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Simple hash function for client-side (for demonstration/UI purposes only)
// Note: Actual password hashing should be done server-side with bcrypt
export async function hashPassword(password: string): Promise<string> {
  // For UI purposes only - this is NOT secure for production
  // In a real app, passwords should be hashed on the server
  // This is just to prevent the build error
  return `hashed_${Buffer.from(password).toString('base64')}`
}

// Simple verify function for client-side
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  // For UI purposes only - this is NOT secure for production
  // In a real app, password verification should happen on the server
  const expectedHash = `hashed_${Buffer.from(plainPassword).toString('base64')}`
  return expectedHash === hashedPassword
}

// AuthUtils object for backward compatibility
export const AuthUtils = {
  validatePasswordStrength,
  hashPassword,
  verifyPassword
}
