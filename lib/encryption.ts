import CryptoJS from 'crypto-js'

// Get the secret key from environment variables
const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'MySuperSecretKey2024!@#$'

/**
 * Encrypts data for QR code storage
 * Makes it URL-safe by replacing special characters
 */
export function encryptForQR(data: string): string {
  try {
    // AES encryption
    const encrypted = CryptoJS.AES.encrypt(data, SECRET_KEY).toString()
    
    // Make URL-safe (QR codes work better with these characters)
    return encrypted.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypts QR code data
 * Reverses URL-safe encoding before decryption
 */
export function decryptFromQR(encryptedData: string): string {
  try {
    // Restore original base64 format
    const base64 = encryptedData.replace(/-/g, '+').replace(/_/g, '/')
    
    // Decrypt
    const bytes = CryptoJS.AES.decrypt(base64, SECRET_KEY)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    
    if (!decrypted) {
      throw new Error('Decryption failed - invalid key or corrupted data')
    }
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt QR code')
  }
}

/**
 * Extracts LRN from decrypted data
 * Expected format: lrn123456789timestamp123456789
 */
export function extractLRNFromDecrypted(decryptedData: string): string | null {
  const lrnMatch = decryptedData.match(/lrn(\d+)timestamp/)
  return lrnMatch ? lrnMatch[1] : null
}

/**
 * Creates the payload for QR code
 */
export function createQRPayload(lrn: string): string {
  return `lrn${lrn}timestamp${Date.now()}`
}