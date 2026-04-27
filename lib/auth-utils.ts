// src/lib/auth-utils.ts
import bcrypt from 'bcryptjs'

export class AuthUtils {
  private static readonly SALT_ROUNDS = 10

  // Hash a password
  static async hashPassword(password: string): Promise<string> {
    try {
      const hashed = await bcrypt.hash(password, this.SALT_ROUNDS)
      console.log('Password hashed successfully, length:', hashed.length)
      return hashed
    } catch (error) {
      console.error('Error hashing password:', error)
      throw new Error('Failed to hash password')
    }
  }

  // Compare password with hash
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!hash || typeof hash !== 'string') {
        console.error('Invalid hash provided')
        return false
      }
      
      const isValid = await bcrypt.compare(password, hash)
      console.log('Password verification result:', isValid)
      return isValid
    } catch (error) {
      console.error('Error verifying password:', error)
      return false
    }
  }

  // Validate password strength (for student registration)
  static validatePasswordStrength(password: string): {
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
}

// Export individual functions for easier imports
export const hashPassword = AuthUtils.hashPassword.bind(AuthUtils)
export const verifyPassword = AuthUtils.verifyPassword.bind(AuthUtils)
export const validatePasswordStrength = AuthUtils.validatePasswordStrength.bind(AuthUtils)