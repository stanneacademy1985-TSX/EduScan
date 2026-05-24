import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { studentId, studentName, mobile, email, message } = body

    if (!studentId || !studentName || (!mobile && !email)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
