// src/lib/auth-utils-server.ts
// Server-only module with bcryptjs - DO NOT import in client code
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  try {
    const hashed = await bcrypt.hash(password, SALT_ROUNDS)
    console.log('Password hashed successfully, length:', hashed.length)
    return hashed
  } catch (error) {
    console.error('Error hashing password:', error)
    throw new Error('Failed to hash password')
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
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
