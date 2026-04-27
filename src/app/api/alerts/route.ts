import { NextRequest, NextResponse } from 'next/server'

const normalizePhilippineMobile = (phone: string) => {
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.startsWith('09') && digits.length === 11) return '+63' + digits.slice(1)
  if (digits.startsWith('9') && digits.length === 10) return '+63' + digits
  if (digits.startsWith('63') && digits.length === 12) return '+' + digits
  if (digits.startsWith('0') && digits.length === 13) return '+' + digits.slice(1)
  if (phone.startsWith('+')) return phone
  return phone
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { studentId, studentName, mobile, email, message } = body

    if (!studentId || !studentName || (!mobile && !email)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const twilioSid = process.env.TWILIO_ACCOUNT_SID
    const twilioToken = process.env.TWILIO_AUTH_TOKEN
    const twilioFrom = process.env.TWILIO_FROM_NUMBER

    const safeMobile = mobile ? normalizePhilippineMobile(mobile) : ''

    // Try Twilio SMS first
    if (safeMobile && twilioSid && twilioToken && twilioFrom) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`
      const payload = new URLSearchParams({
        From: twilioFrom,
        To: safeMobile,
        Body: message || `Attendance alert for ${studentName}`
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: payload
      })

      if (!response.ok) {
        const err = await response.text()
        console.error('Twilio send failed', err)
        return NextResponse.json({ error: 'Twilio send failed', detail: err }, { status: 502 })
      }

      if (email && process.env.AZURE_COMMUNICATION_EMAIL_CONNECTION_STRING && process.env.AZURE_COMMUNICATION_EMAIL_FROM) {
        // optional: send email an external service (Azure Communication Service)
        await sendAzureEmail(email, studentName, message)
      }

      return NextResponse.json({ message: 'SMS sent via Twilio' })
    }

    if (email && process.env.AZURE_COMMUNICATION_EMAIL_CONNECTION_STRING && process.env.AZURE_COMMUNICATION_EMAIL_FROM) {
      await sendAzureEmail(email, studentName, message)
      return NextResponse.json({ message: 'Email sent via Azure Communication Service' })
    }

    console.warn('No messaging provider configured. Fallback behavior applies.')
    return NextResponse.json({ message: 'No messaging provider configured. This is a non-fatal fallback for local/test mode.' })
  } catch (error) {
    console.error('API alerts error', error)
    return NextResponse.json({ error: (error as Error).message || 'Unknown error' }, { status: 500 })
  }
}

async function sendAzureEmail(to: string, studentName: string, message: string) {
  const connectionString = process.env.AZURE_COMMUNICATION_EMAIL_CONNECTION_STRING!
  const from = process.env.AZURE_COMMUNICATION_EMAIL_FROM!

  // If you have azure sdk, use @azure/communication-email; using fetch for minimal dependencies:
  const res = await fetch('https://management.azure.com/email/send?api-version=2022-10-01', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AZURE_ACCESS_TOKEN || ''}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      senderAddress: from,
      content: {
        subject: `EduScan attendance alert for ${studentName}`,
        plainText: message || `Attendance alert for ${studentName}`
      },
      recipients: { to: [{ address: to, displayName: studentName }] }
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Azure email failed: ${err}`)
  }
}
