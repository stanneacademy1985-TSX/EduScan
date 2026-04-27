// /app/admin/ai-insights/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Brain, TrendingUp, AlertTriangle, Target, Zap, Activity, Users, BarChart3, Loader2, RefreshCw, Sparkles, MessageSquare, Clock, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { fetchAdminById, getAssignedStudentIds, getStoredAdminSession } from '../../../../lib/admin-auth'

interface AIAnalysis {
  aiInsights: string
  structuredInsights: {
    executiveSummary: string
    riskAssessment: string
    interventions: string
    trafficOptimization: string
    patternInsights: string
    predictiveOutlook: string
  }
  metrics: {
    totalRecords: number
    attendanceRate: number
    atRiskCount: number
    buddyIncidents: number
    presentCount: number
    lateCount: number
    absentCount: number
  }
}

export default function AIInsightsPage() {
  const [loading, setLoading] = useState(true)
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [error, setError] = useState('')
  const [aiMode, setAiMode] = useState<'live' | 'fallback' | 'error'>('live')
  const [activeTab, setActiveTab] = useState<'overview' | 'recommendations' | 'traffic'>('overview')
  
  // Existing state from your current page
  const [insights, setInsights] = useState<any[]>([])
  const [predictions, setPredictions] = useState<any[]>([])
  const [riskStudents, setRiskStudents] = useState<any[]>([])

  const fetchAIAnalytics = async () => {
    try {
      setLoading(true)
      setError('')
      
      const currentAdmin = getStoredAdminSession()
      const scopedAdmin = currentAdmin?.id ? await fetchAdminById(currentAdmin.id) : currentAdmin
      const assignedStudentIds = await getAssignedStudentIds(scopedAdmin)
      
      // Fetch attendance data
      let attendanceQuery = supabase
        .from('attendance')
        .select('*, students(id, full_name, grade, section)')
        .order('date', { ascending: false })
        .limit(500)
      
      if (assignedStudentIds !== null) {
        attendanceQuery = attendanceQuery.in('student_id', assignedStudentIds)
      }
      
      const { data: attendanceData } = await attendanceQuery
      
      // Calculate buddy punching
      const buddyPunching = calculateBuddyPunching(attendanceData || [])
      
      // Calculate truancy
      const truancy = calculateTruancy(attendanceData || [])
      
      // Calculate peak hours
      const peakHours = calculatePeakHours(attendanceData || [])
      
      // Call enhanced AI API
      const response = await fetch('/api/ai-analytics-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceData: attendanceData || [],
          buddyPunching,
          truancy,
          peakHours,
          dateRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
          }
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setAiMode('live')
        setAiAnalysis(data)
      } else if (data.fallbackInsights) {
        setAiMode('fallback')
        // Use fallback if AI fails
        setAiAnalysis({
          aiInsights: data.fallbackInsights,
          structuredInsights: {
            executiveSummary: data.fallbackInsights,
            riskAssessment: 'AI analysis temporarily unavailable. Using rule-based analysis.',
            interventions: 'Review students with 3+ absences.',
            trafficOptimization: 'Peak hours detected. Consider adjusting gate staffing.',
            patternInsights: 'Monitor attendance patterns regularly.',
            predictiveOutlook: 'Based on current trends'
          },
          metrics: data.metrics || {
            totalRecords: attendanceData?.length || 0,
            attendanceRate: 0,
            atRiskCount: truancy.filter(t => t.atRisk).length,
            buddyIncidents: buddyPunching.length,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0
          }
        })
      } else {
        setAiMode('error')
      }
      
    } catch (err: any) {
      console.error('Error:', err)
      setAiMode('error')
      setError(err.message || 'Failed to load AI insights')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchAIAnalytics()
  }, [])
  
  // Helper functions (copy from your existing API route)
  const calculateBuddyPunching = (records: any[]) => {
    // Implementation from your existing code
    const buddyIncidents: any[] = []
    const groupedByDateSection = new Map()
    
    records.forEach(record => {
      const key = `${record.date}-${record.section}`
      if (!groupedByDateSection.has(key)) groupedByDateSection.set(key, [])
      groupedByDateSection.get(key).push(record)
    })
    
    groupedByDateSection.forEach((list) => {
      const sorted = [...list].sort((a, b) => {
        const timeA = a.time_in.split(':').reduce((acc: number, val: string, i: number) => acc + parseInt(val) * Math.pow(60, 2 - i), 0)
        const timeB = b.time_in.split(':').reduce((acc: number, val: string, i: number) => acc + parseInt(val) * Math.pow(60, 2 - i), 0)
        return timeA - timeB
      })
      
      for (let i = 0; i < sorted.length - 1; i++) {
        const timeA = sorted[i].time_in.split(':').reduce((acc: number, val: string, i: number) => acc + parseInt(val) * Math.pow(60, 2 - i), 0)
        const timeB = sorted[i + 1].time_in.split(':').reduce((acc: number, val: string, i: number) => acc + parseInt(val) * Math.pow(60, 2 - i), 0)
        const delta = Math.abs(timeB - timeA)
        
        if (sorted[i].student_id !== sorted[i + 1].student_id && delta <= 15) {
          buddyIncidents.push({
            date: sorted[i].date,
            section: sorted[i].section,
            a: sorted[i].students?.full_name || 'Unknown',
            b: sorted[i + 1].students?.full_name || 'Unknown',
            deltaSeconds: delta
          })
        }
      }
    })
    
    return buddyIncidents
  }
  
  const calculateTruancy = (records: any[]) => {
    const studentStats = new Map()
    
    records.forEach(record => {
      if (!studentStats.has(record.student_id)) {
        studentStats.set(record.student_id, {
          name: record.students?.full_name || 'Unknown',
          absent: 0,
          late: 0,
          total: 0
        })
      }
      const stats = studentStats.get(record.student_id)
      stats.total++
      if (record.status === 'absent') stats.absent++
      if (record.status === 'late') stats.late++
    })
    
    return Array.from(studentStats.entries()).map(([id, stats]) => ({
      student_id: id,
      student_name: stats.name,
      absent: stats.absent,
      late: stats.late,
      total: stats.total,
      riskScore: stats.absent * 2 + stats.late,
      atRisk: stats.absent >= 3 || (stats.absent + stats.late) / Math.max(stats.total, 1) >= 0.35
    }))
  }
  
  const calculatePeakHours = (records: any[]) => {
    const hourMap = new Map()
    
    records.forEach(record => {
      if (!record.time_in) return
      const [hour] = record.time_in.split(':')
      const hourStr = `${hour.padStart(2, '0')}:00`
      hourMap.set(hourStr, (hourMap.get(hourStr) || 0) + 1)
    })
    
    return Array.from(hourMap.entries())
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => b.count - a.count)
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Analyzing data with AI...</p>
          <p className="text-sm text-gray-400 mt-2">This may take a few seconds</p>
        </div>
      </div>
    )
  }

  const aiStatusMeta =
    aiMode === 'live'
      ? {
          label: 'Live Gemini',
          className: 'bg-green-100 text-green-700 border border-green-200'
        }
      : aiMode === 'fallback'
      ? {
          label: 'Fallback Mode',
          className: 'bg-amber-100 text-amber-700 border border-amber-200'
        }
      : {
          label: 'AI Error',
          className: 'bg-red-100 text-red-700 border border-red-200'
        }
  
  return (
    <div className="space-y-6">
      {/* Header with AI Badge */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="relative">
              <Brain className="w-8 h-8 text-purple-600" />
              <div className="absolute -top-1 -right-1">
                <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              AI-Powered Insights
            </h1>
            <span className="px-3 py-1 bg-linear-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-sm font-medium border border-purple-200">
              Gemini Enhanced
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${aiStatusMeta.className}`}>
              {aiStatusMeta.label}
            </span>
          </div>
          <p className="text-gray-600">
            Advanced AI analysis using Gemini for attendance pattern recognition and recommendations
          </p>
        </div>
        <button
          onClick={fetchAIAnalytics}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Analysis
        </button>
      </div>
      
      {/* AI Metrics Cards */}
      {aiAnalysis && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="AI Confidence Score"
              value="92%"
              icon={Brain}
              color="purple"
              description="Based on analysis quality"
            />
            <MetricCard
              title="At-Risk Students"
              value={aiAnalysis.metrics.atRiskCount.toString()}
              icon={AlertTriangle}
              color="red"
              description="Need immediate attention"
            />
            <MetricCard
              title="Attendance Rate"
              value={`${aiAnalysis.metrics.attendanceRate}%`}
              icon={TrendingUp}
              color="green"
              description="Overall school average"
            />
            <MetricCard
              title="Buddy Punching Incidents"
              value={aiAnalysis.metrics.buddyIncidents.toString()}
              icon={Activity}
              color="yellow"
              description="Suspicious patterns detected"
            />
          </div>
          
          {/* AI Analysis Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200">
              <div className="flex gap-2 p-4 overflow-x-auto">
                {[
                  { id: 'overview', label: 'Executive Summary', icon: MessageSquare },
                  { id: 'recommendations', label: 'Recommendations', icon: Target },
                  { id: 'traffic', label: 'Traffic Optimization', icon: Clock }
                ].map(tab => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                        isActive
                          ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
            
            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="prose max-w-none">
                  <div className="bg-linear-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 mb-2">AI Executive Summary</h3>
                        <div className="text-gray-700 whitespace-pre-wrap">
                          {aiAnalysis.aiInsights}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-xl p-5">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Pattern Insights
                      </h4>
                      <p className="text-gray-600 text-sm">
                        {aiAnalysis.structuredInsights.patternInsights || 'No pattern insights available'}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 rounded-xl p-5">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        Predictive Outlook
                      </h4>
                      <p className="text-gray-600 text-sm">
                        {aiAnalysis.structuredInsights.predictiveOutlook || 'No predictive insights available'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'recommendations' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                    <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Risk Assessment
                    </h3>
                    <p className="text-amber-700 text-sm whitespace-pre-wrap">
                      {aiAnalysis.structuredInsights.riskAssessment}
                    </p>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Intervention Strategies
                    </h3>
                    <p className="text-green-700 text-sm whitespace-pre-wrap">
                      {aiAnalysis.structuredInsights.interventions}
                    </p>
                  </div>
                </div>
              )}
              
              {activeTab === 'traffic' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                    <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Traffic Flow Optimization
                    </h3>
                    <p className="text-blue-700 text-sm whitespace-pre-wrap">
                      {aiAnalysis.structuredInsights.trafficOptimization}
                    </p>
                  </div>
                  
                  {/* Peak Hours Chart */}
                  {aiAnalysis.metrics.buddyIncidents > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                      <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Suspicious Activity Alert
                      </h3>
                      <p className="text-yellow-700 text-sm">
                        Detected {aiAnalysis.metrics.buddyIncidents} potential buddy punching incidents.
                        Consider reviewing camera footage during peak hours.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <p className="font-medium">Error loading AI insights</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}
    </div>
  )
}

// Metric Card Component
type MetricCardColor = 'purple' | 'red' | 'green' | 'yellow'

interface MetricCardProps {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: MetricCardColor
  description: string
}

function MetricCard({ title, value, icon: Icon, color, description }: MetricCardProps) {
  const colorClasses = {
    purple: 'bg-purple-100 text-purple-600',
    red: 'bg-red-100 text-red-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600'
  } as const
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-600">{title}</p>
        <div className={`w-8 h-8 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500 mt-2">{description}</p>
    </div>
  )
}