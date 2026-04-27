import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

type WeatherImpact = {
  condition: string
  temperature: number
  impact: number
  description: string
}

type HolidayImpact = {
  isHoliday: boolean
  holidayName?: string
  type?: string
  impact: number
}

type AttendanceRecord = {
  student_id: string
  date: string
  section: string
  time_in?: string
  status?: 'present' | 'absent' | 'late' | string
  students?: {
    full_name?: string
  }
}

type TruancyPrediction = {
  student_id: string
  student_name: string
  absent: number
  late: number
  total: number
  riskScore: number
  atRisk: boolean
  externalFactors?: string[]
}

const parseTimeInSeconds = (time: string) => {
  if (!time) return 0
  const parts = time.split(':').map(Number)
  if (parts.length !== 3) return 0
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

// Weather API integration for attendance correlation
const getWeatherImpact = async (date: string, location: string = 'Manila,PH'): Promise<WeatherImpact | null> => {
  try {
    // Using OpenWeatherMap API (free tier available)
    const apiKey = process.env.OPENWEATHER_API_KEY
    if (!apiKey) return null

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${location}&dt=${Math.floor(new Date(date).getTime() / 1000)}&appid=${apiKey}&units=metric`
    )

    if (!response.ok) return null

    const weather = await response.json()
    const condition = weather.weather[0].main.toLowerCase()
    const temp = weather.main.temp

    // Weather impact on attendance
    let impact = 0
    if (condition.includes('rain') || condition.includes('storm')) impact = -0.15
    else if (condition.includes('clear') && temp > 30) impact = -0.10
    else if (condition.includes('clear') && temp < 15) impact = -0.08
    else if (condition.includes('cloud')) impact = -0.05

    return {
      condition: weather.weather[0].main,
      temperature: temp,
      impact: impact,
      description: weather.weather[0].description
    }
  } catch (error) {
    console.warn('Weather API error:', error)
    return null
  }
}

// Holiday/Calendar API integration
const getHolidayImpact = async (date: string): Promise<HolidayImpact | null> => {
  try {
    // Using Calendarific API (free tier available)
    const apiKey = process.env.CALENDARIFIC_API_KEY
    if (!apiKey) return null

    const dateObj = new Date(date)
    const year = dateObj.getFullYear()
    const month = dateObj.getMonth() + 1
    const day = dateObj.getDate()

    const response = await fetch(
      `https://calendarific.com/api/v2/holidays?api_key=${apiKey}&country=PH&year=${year}&month=${month}&day=${day}`
    )

    if (!response.ok) return null

    const data = await response.json()
    const holidays = data.response.holidays || []

    if (holidays.length > 0) {
      return {
        isHoliday: true,
        holidayName: holidays[0].name,
        type: holidays[0].type[0] || 'public',
        impact: -0.25 // Significant impact on attendance
      }
    }

    return { isHoliday: false, impact: 0 }
  } catch (error) {
    console.warn('Holiday API error:', error)
    return null
  }
}

// Enhanced anomaly detection with ML-like pattern recognition
const detectAdvancedAnomalies = (records: AttendanceRecord[]): any[] => {
  const anomalies: any[] = []

  // Group by student for individual patterns
  const studentPatterns = new Map<string, any[]>()
  records.forEach(record => {
    if (!studentPatterns.has(record.student_id)) {
      studentPatterns.set(record.student_id, [])
    }
    studentPatterns.get(record.student_id)!.push(record)
  })

  // Detect unusual attendance patterns
  studentPatterns.forEach((studentRecords, studentId) => {
    const sortedRecords = studentRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const studentName = sortedRecords[0]?.students?.full_name || 'Unknown'
    for (let i = 2; i < sortedRecords.length; i++) {
      const recent = sortedRecords.slice(i - 2, i + 1)
      const presentCount = recent.filter(r => r.status === 'present').length
      const absentCount = recent.filter(r => r.status === 'absent').length

      // Sudden drop in attendance (3 consecutive days with decreasing attendance)
      if (absentCount >= 2 && presentCount <= 1) {
        anomalies.push({
          type: 'sudden_absence_pattern',
          student_id: studentId,
          student_name: studentName,
          description: `Sudden increase in absences over recent days`,
          severity: 'high',
          dates: recent.map(r => r.date)
        })
      }
    }

    // Check for time-based anomalies (very early/late arrivals)
    const timeAnomalies = sortedRecords.filter(record => {
      if (!record.time_in) return false
      const [hours] = record.time_in.split(':').map(Number)
      return hours < 6 || hours > 18 // Unusual school hours
    })

    if (timeAnomalies.length > 0) {
      anomalies.push({
        type: 'unusual_timing',
        student_id: studentId,
        student_name: studentName,
        description: `Unusual attendance times detected`,
        severity: 'medium',
        count: timeAnomalies.length
      })
    }
  })

  return anomalies
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { startDate, endDate, grade, section } = await req.json()

    const query = supabase.from('attendance').select(`*, students(id, full_name)`).gte('date', startDate || '2000-01-01').lte('date', endDate || '9999-12-31')

    if (grade) query.eq('grade', grade)
    if (section) query.eq('section', section)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const records = data || []

    // Enhanced buddy punching detection with time gap analysis
    const groupedByDateSection = new Map<string, any[]>()
    for (const row of records) {
      const key = `${row.date}-${row.section}`
      groupedByDateSection.set(key, (groupedByDateSection.get(key) || []).concat(row))
    }

    const buddyPunching: Array<{date:string; section:string; a:string; b:string; deltaSeconds:number; risk:string}> = []
    groupedByDateSection.forEach((list, key) => {
      const sorted = [...list].sort((a, b) => parseTimeInSeconds(a.time_in) - parseTimeInSeconds(b.time_in))
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i]
        const b = sorted[i + 1]
        const delta = Math.abs(parseTimeInSeconds(a.time_in) - parseTimeInSeconds(b.time_in))
        if (a.student_id !== b.student_id && delta <= 15) {
          const risk = delta <= 5 ? 'high' : delta <= 10 ? 'medium' : 'low'
          buddyPunching.push({
            date: a.date,
            section: a.section,
            a: a.students?.full_name || 'Unknown',
            b: b.students?.full_name || 'Unknown',
            deltaSeconds: delta,
            risk
          })
        }
      }
    })

    // Enhanced truancy prediction with external factors
    const studentStats: Record<string, { name: string; absent: number; late: number; total: number; weatherImpact?: number; holidayImpact?: number }> = {}
    for (const row of records) {
      const id = row.student_id
      if (!id) continue
      if (!studentStats[id]) studentStats[id] = { name: row.students?.full_name || 'Unknown', absent: 0, late: 0, total: 0 }
      const stat = studentStats[id]
      stat.total += 1
      if (row.status === 'absent') stat.absent += 1
      if (row.status === 'late') stat.late += 1
    }

    // Add external factor analysis
    const uniqueDates = [...new Set(records.map(r => r.date))]
    const externalFactors = await Promise.all(
      uniqueDates.map(async (date) => {
        const [weather, holiday] = await Promise.all([
          getWeatherImpact(date),
          getHolidayImpact(date)
        ])
        return { date, weather, holiday }
      })
    )

    // Apply external factors to student predictions
    const truancy = Object.entries(studentStats).map(async ([student_id, stat]) => {
      let adjustedAbsent = stat.absent
      let externalNotes = []

      // Apply weather impact
      const weatherFactors = externalFactors.filter(f => f.weather).length
      if (weatherFactors > 0) {
        const avgWeatherImpact = externalFactors
          .filter(f => f.weather)
          .reduce((sum, f) => sum + (f.weather?.impact || 0), 0) / weatherFactors
        adjustedAbsent = Math.max(0, stat.absent - (stat.total * Math.abs(avgWeatherImpact)))
        if (avgWeatherImpact < -0.1) {
          externalNotes.push('Weather conditions may affect attendance')
        }
      }

      // Apply holiday impact
      const holidayFactors = externalFactors.filter(f => f.holiday?.isHoliday)
      if (holidayFactors.length > 0) {
        externalNotes.push(`${holidayFactors.length} holiday(s) in period`)
      }

      const riskScore = adjustedAbsent * 2 + stat.late
      const atRisk = adjustedAbsent >= 3 || (adjustedAbsent + stat.late) / Math.max(stat.total, 1) >= 0.35

      return {
        student_id,
        student_name: stat.name,
        absent: stat.absent,
        late: stat.late,
        total: stat.total,
        riskScore: Math.round(riskScore * 100) / 100,
        atRisk,
        externalFactors: externalNotes.length > 0 ? externalNotes : undefined
      }
    })

    const truancyResults = await Promise.all(truancy)

    // Advanced anomaly detection
    const advancedAnomalies = detectAdvancedAnomalies(records)

    // Enhanced peak analysis with external factors
    const intervalBuckets = (intervalMin: number) => {
      const bucket: Record<string, { count: number; weather?: string; holiday?: boolean }> = {}
      for (const row of records) {
        const time = row.time_in || '00:00:00'
        const [h, m] = time.split(':').map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) continue
        const totalMin = h * 60 + m
        const bucketStart = Math.floor(totalMin / intervalMin) * intervalMin
        const bucketHour = `${String(Math.floor(bucketStart / 60)).padStart(2, '0')}:${String(bucketStart % 60).padStart(2, '0')}`

        if (!bucket[bucketHour]) {
          bucket[bucketHour] = { count: 0 }
        }
        bucket[bucketHour].count += 1

        // Add external factor context
        const dateFactor = externalFactors.find(f => f.date === row.date)
        if (dateFactor) {
          if (dateFactor.weather && !bucket[bucketHour].weather) {
            bucket[bucketHour].weather = dateFactor.weather.condition
          }
          if (dateFactor.holiday?.isHoliday && !bucket[bucketHour].holiday) {
            bucket[bucketHour].holiday = true
          }
        }
      }
      return Object.entries(bucket).map(([hour, data]) => ({
        bucket: hour,
        count: data.count,
        weather: data.weather,
        holiday: data.holiday
      })).sort((a, b) => b.count - a.count)
    }

    const peak30 = intervalBuckets(30).slice(0, 10)
    const peak60 = intervalBuckets(60).slice(0, 10)

    return NextResponse.json({
      buddyPunching,
      truancy: truancyResults,
      peak30,
      peak60,
      advancedAnomalies,
      externalFactors: externalFactors.filter(f => f.weather || f.holiday?.isHoliday)
    })
  } catch (error) {
    console.error('AI analytics route error', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
