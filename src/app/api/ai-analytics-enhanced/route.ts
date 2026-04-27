import { NextRequest, NextResponse } from 'next/server'

interface AttendanceRecord {
  status?: string
}

interface BuddyPunching {
  date: string
  section: string
  a: string
  b: string
  deltaSeconds?: number
  risk?: string
}

interface TruancyStudent {
  student_id: string
  student_name: string
  absent: number
  late: number
  total: number
  riskScore: number
  atRisk: boolean
  externalFactors?: string[]
}

interface PeakHour {
  bucket: string
  count: number
  weather?: string
  holiday?: boolean
}

interface AnalyticsRequest {
  attendanceData?: AttendanceRecord[]
  buddyPunching?: BuddyPunching[]
  truancy?: TruancyStudent[]
  peakHours?: PeakHour[]
  dateRange?: {
    start?: string
    end?: string
  }
  grade?: string
  section?: string
}

type Metrics = {
  totalRecords: number
  attendanceRate: number
  atRiskCount: number
  buddyIncidents: number
  presentCount: number
  lateCount: number
  absentCount: number
}

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const buildMetrics = (data: AnalyticsRequest): Metrics => {
  const attendanceData = toArray<AttendanceRecord>(data.attendanceData)
  const truancy = toArray<TruancyStudent>(data.truancy)
  const buddyPunching = toArray<BuddyPunching>(data.buddyPunching)

  const totalRecords = attendanceData.length
  const presentCount = attendanceData.filter((r) => r.status === 'present').length
  const lateCount = attendanceData.filter((r) => r.status === 'late').length
  const absentCount = attendanceData.filter((r) => r.status === 'absent').length
  const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0

  return {
    totalRecords,
    attendanceRate,
    atRiskCount: truancy.filter((t) => Boolean(t.atRisk)).length,
    buddyIncidents: buddyPunching.length,
    presentCount,
    lateCount,
    absentCount
  }
}

const buildPrompt = (data: AnalyticsRequest, metrics: Metrics): string => {
  const truancy = toArray<TruancyStudent>(data.truancy)
  const peakHours = toArray<PeakHour>(data.peakHours)

  const topAtRisk = truancy
    .filter((t) => t.atRisk)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5)
    .map((t) => `${t.student_name} (${t.absent} absences, ${t.late} late arrivals)`)
    .join('\n')

  const peakHourSummary = peakHours
    .slice(0, 5)
    .map((p) => `${p.bucket}: ${p.count} scans`)
    .join('\n')

  return `
You are an AI Attendance Analyst for EduScan, an IoT-based QR attendance system.
Analyze the following school attendance data and provide practical recommendations.

ATTENDANCE SUMMARY
- Date Range: ${data.dateRange?.start || 'N/A'} to ${data.dateRange?.end || 'N/A'}
- Grade Level: ${data.grade || 'All Grades'}
- Section: ${data.section || 'All Sections'}
- Total Attendance Records: ${metrics.totalRecords}
- Overall Attendance Rate: ${metrics.attendanceRate}%
- Present: ${metrics.presentCount}
- Late: ${metrics.lateCount}
- Absent: ${metrics.absentCount}

ANOMALIES DETECTED
- Buddy Punching Incidents: ${metrics.buddyIncidents}

AT-RISK STUDENTS
- Students at Risk: ${metrics.atRiskCount} out of ${truancy.length}
${topAtRisk ? `Top At-Risk Students:\n${topAtRisk}` : 'No at-risk students identified.'}

PEAK HOUR ANALYSIS
${peakHourSummary || 'No peak hour data available.'}

Provide these sections with clear headings:
1. Executive Summary
2. Risk Assessment
3. Intervention Strategies
4. Traffic Flow Optimization
5. Pattern Insights
6. Predictive Outlook

Keep the response concise, professional, and actionable.
`
}

const extractSection = (text: string, heading: string, nextHeading?: string): string => {
  const lower = text.toLowerCase()
  const start = lower.indexOf(heading.toLowerCase())
  if (start === -1) return ''

  let end = text.length
  if (nextHeading) {
    const next = lower.indexOf(nextHeading.toLowerCase(), start + heading.length)
    if (next !== -1) end = next
  }

  return text
    .substring(start + heading.length, end)
    .replace(/^[\s:\-#*]+/, '')
    .trim()
}

const buildStructuredInsights = (aiResponse: string) => {
  return {
    executiveSummary: extractSection(aiResponse, 'Executive Summary', 'Risk Assessment'),
    riskAssessment: extractSection(aiResponse, 'Risk Assessment', 'Intervention Strategies'),
    interventions: extractSection(aiResponse, 'Intervention Strategies', 'Traffic Flow Optimization'),
    trafficOptimization: extractSection(aiResponse, 'Traffic Flow Optimization', 'Pattern Insights'),
    patternInsights: extractSection(aiResponse, 'Pattern Insights', 'Predictive Outlook'),
    predictiveOutlook: extractSection(aiResponse, 'Predictive Outlook')
  }
}

const generateFallbackInsights = (data: AnalyticsRequest, metrics: Metrics): string => {
  const peakHours = toArray<PeakHour>(data.peakHours)

  return [
    'Attendance Summary',
    `- Total Records: ${metrics.totalRecords}`,
    `- Attendance Rate: ${metrics.attendanceRate}%`,
    `- Students at Risk: ${metrics.atRiskCount}`,
    `- Buddy Punching Incidents: ${metrics.buddyIncidents}`,
    `- Peak Hours: ${peakHours.slice(0, 3).map((p) => p.bucket).join(', ') || 'N/A'}`,
    '',
    'Recommendations',
    '- Monitor at-risk students and schedule early intervention.',
    '- Review recurring late/absent trends by section and day.',
    '- Adjust gate staffing around identified peak scan windows.'
  ].join('\n')
}

const parseGeminiText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return ''

  const maybePayload = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
        }>
      }
    }>
  }

  const text = maybePayload.candidates
    ?.flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || '')
    .join('\n')
    .trim()

  return text || ''
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRetryableGeminiStatus = (status: number) => status === 429 || status === 503

const generateGeminiInsights = async (prompt: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable')
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const maxAttempts = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1000
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`Gemini API request failed (${response.status}): ${errorText}`)

      if (isRetryableGeminiStatus(response.status) && attempt < maxAttempts) {
        lastError = error
        await sleep(500 * attempt)
        continue
      }

      throw error
    }

    const payload = await response.json()
    const text = parseGeminiText(payload)
    if (!text) {
      throw new Error('Gemini returned an empty response')
    }

    return text
  }

  throw lastError || new Error('Gemini request failed after retries')
}

export async function POST(req: NextRequest) {
  let requestData: AnalyticsRequest = {}

  try {
    try {
      requestData = (await req.json()) as AnalyticsRequest
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
          fallbackInsights: 'Invalid request payload. Please provide valid analytics data.',
          metrics: buildMetrics({}),
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      )
    }

    const metrics = buildMetrics(requestData)
    const fallbackInsights = generateFallbackInsights(requestData, metrics)
    const aiInsights = (await generateGeminiInsights(buildPrompt(requestData, metrics))) || fallbackInsights
    const structuredInsights = buildStructuredInsights(aiInsights)

    return NextResponse.json({
      success: true,
      aiInsights,
      structuredInsights,
      metrics,
      timestamp: new Date().toISOString()
    })
  } catch (error: unknown) {
    console.error('AI analytics enhanced route error:', error)
    const metrics = buildMetrics(requestData)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected AI analytics error',
        fallbackInsights: generateFallbackInsights(requestData, metrics),
        metrics,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    )
  }
}