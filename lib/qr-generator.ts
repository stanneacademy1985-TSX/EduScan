import QRCode from 'qrcode'
import { encryptForQR, createQRPayload } from './encryption'

/**
 * Generates an encrypted QR code for a student
 */
export async function generateEncryptedQRCode(lrn: string): Promise<string> {
  try {
    // Create the payload
    const payload = createQRPayload(lrn)
    
    // Encrypt the payload
    const encryptedData = encryptForQR(payload)
    
    // Add prefix to identify encrypted QR codes
    const qrData = `ENC${encryptedData}`
    
    // Generate QR code image
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1E40AF', // Blue color
        light: '#FFFFFF' // White background
      }
    })
    
    return qrCodeDataURL
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw error
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function generateLegacyQRCode(lrn: string): Promise<string> {
  try {
    const qrData = JSON.stringify({
      lrn,
      type: 'attendance',
      timestamp: Date.now()
    })
    
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1E40AF',
        light: '#FFFFFF'
      }
    })
    
    return qrCodeDataURL
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw error
  }
}