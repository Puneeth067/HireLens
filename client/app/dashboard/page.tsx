'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, 
  FileText, 
  Briefcase, 
  BarChart3, 
  TrendingUp, 
  Award,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Brain,
  Search,
  Settings,
  Loader2,
  RefreshCw,
  Play,
  ExternalLink
} from 'lucide-react'
import apiService from '@/lib/api'
import { cachedApiService } from '@/lib/cached-api'

interface SystemStats {
  files: {
    total_files: number
    parsed_files: number
    processing_files: number
    failed_files: number
  }
  jobs: {
    total_jobs: number
    active_jobs: number
    draft_jobs: number
  }
  comparisons: {
    total_comparisons: number
    completed: number
    pending: number
    failed: number
  }
  analytics: {
    total_candidates: number
    average_score: number
    top_score: number
  }
}

interface RecentActivity {
  type: 'upload' | 'job' | 'comparison' | 'ranking'
  title: string
  description: string
  timestamp: string
  status: 'completed' | 'processing' | 'failed'
}

// Define interfaces for API response types
interface ParsingStats {
  total_files: number
  completed: number
  processing: number
  pending: number
  error: number
  recent_activity: Array<{
    file_id: string
    filename: string
    status: string
    parsed_at?: string
  }>
}

interface JobStats {
  total_jobs: number
  active_jobs: number
  draft_jobs: number
  closed_jobs: number
  recent_jobs: number
}

interface ComparisonStats {
  total_comparisons: number
  avg_score: number
  top_score: number
  recent_comparisons: number
  status_breakdown: {
    completed?: number
    pending?: number
    failed?: number
  }
}

interface AnalyticsSummary {
  total_candidates: number
  total_jobs: number
  total_comparisons: number
  avg_score: number
  recent_activity: number
  trending_skills: Array<{ skill: string; count: number }> | string[]
  top_performing_jobs: Array<{ job_id: string; job_title: string; score: number }> | Array<{ job_id: string; title: string; score: number }>
}

interface HealthCheck {
  status: string
  timestamp: string | number
  version: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<SystemStats>({
    files: { total_files: 0, parsed_files: 0, processing_files: 0, failed_files: 0 },
    jobs: { total_jobs: 0, active_jobs: 0, draft_jobs: 0 },
    comparisons: { total_comparisons: 0, completed: 0, pending: 0, failed: 0 },
    analytics: { total_candidates: 0, average_score: 0, top_score: 0 }
  })
  
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshAllData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Clear all caches to ensure fresh data
      cachedApiService.refreshCache('all')
      
      // Fetch all required data in parallel with error handling
      const results = await Promise.allSettled([
        apiService.getParsingStats().catch(err => {
          console.warn('Failed to fetch parsing stats:', err)
          return {
            total_files: 0,
            completed: 0,
            processing: 0,
            pending: 0,
            error: 0,
            recent_activity: []
          }
        }),
        cachedApiService.getJobStats().catch((err: Error) => {
          console.warn('Failed to fetch job stats:', err)
          return {
            total_jobs: 0,
            active_jobs: 0,
            draft_jobs: 0,
            closed_jobs: 0,
            recent_jobs: 0
          }
        }),
        cachedApiService.getComparisonStats().catch((err: Error) => {
          console.warn('Failed to fetch comparison stats:', err)
          return {
            total_comparisons: 0,
            avg_score: 0,
            top_score: 0,
            recent_comparisons: 0,
            status_breakdown: {
              completed: 0,
              pending: 0,
              failed: 0
            }
          }
        }),
        apiService.getAnalyticsSummary().catch((err: Error) => {
          console.warn('Failed to fetch analytics summary:', err)
          return {
            total_candidates: 0,
            total_jobs: 0,
            total_comparisons: 0,
            avg_score: 0,
            recent_activity: 0,
            trending_skills: [],
            top_performing_jobs: []
          }
        }),
        cachedApiService.healthCheck().catch((err: Error) => {
          console.warn('Failed to fetch health check:', err)
          return {
            status: 'degraded',
            timestamp: new Date().toISOString(),
            version: 'unknown'
          }
        })
      ])

      const [parsingStatsResult, jobStatsResult, comparisonStatsResult, analyticsSummaryResult, healthCheckResult] = results

      // Extract data or use defaults
      const parsingStats: ParsingStats = parsingStatsResult.status === 'fulfilled' ? parsingStatsResult.value : {
        total_files: 0,
        completed: 0,
        processing: 0,
        pending: 0,
        error: 0,
        recent_activity: []
      }
      
      const jobStats: JobStats = jobStatsResult.status === 'fulfilled' ? jobStatsResult.value : {
        total_jobs: 0,
        active_jobs: 0,
        draft_jobs: 0,
        closed_jobs: 0,
        recent_jobs: 0
      }
      
      const comparisonStats: ComparisonStats = comparisonStatsResult.status === 'fulfilled' ? comparisonStatsResult.value : {
        total_comparisons: 0,
        avg_score: 0,
        top_score: 0,
        recent_comparisons: 0,
        status_breakdown: {
          completed: 0,
          pending: 0,
          failed: 0
        }
      }
      
      const analyticsSummary: AnalyticsSummary = analyticsSummaryResult.status === 'fulfilled' ? analyticsSummaryResult.value : {
        total_candidates: 0,
        total_jobs: 0,
        total_comparisons: 0,
        avg_score: 0,
        recent_activity: 0,
        trending_skills: [],
        top_performing_jobs: []
      }
      
      const healthCheck: HealthCheck = healthCheckResult.status === 'fulfilled' ? healthCheckResult.value : {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        version: 'unknown'
      }

      // Find the top score from top performing jobs
      let topScore = 0
      if (analyticsSummary.top_performing_jobs && analyticsSummary.top_performing_jobs.length > 0) {
        const scores = analyticsSummary.top_performing_jobs.map(job => 'score' in job ? job.score : 0)
        topScore = Math.max(...scores)
      }

      // Update stats with real data
      setStats({
        files: {
          total_files: parsingStats.total_files,
          parsed_files: parsingStats.completed,
          processing_files: parsingStats.processing,
          failed_files: parsingStats.error
        },
        jobs: {
          total_jobs: jobStats.total_jobs,
          active_jobs: jobStats.active_jobs,
          draft_jobs: jobStats.draft_jobs
        },
        comparisons: {
          total_comparisons: comparisonStats.total_comparisons,
          completed: comparisonStats.status_breakdown.completed || 0,
          pending: comparisonStats.status_breakdown.pending || 0,
          failed: comparisonStats.status_breakdown.failed || 0
        },
        analytics: {
          total_candidates: analyticsSummary.total_candidates || 0,
          average_score: analyticsSummary.avg_score || 0,
          top_score: topScore
        }
      })

      // Update recent activity
      const activities: RecentActivity[] = []
      
      // Add recent parsing activities
      if (parsingStats.recent_activity) {
        parsingStats.recent_activity.slice(0, 3).forEach(activity => {
          activities.push({
            type: 'upload',
            title: 'Resume Parsed',
            description: activity.filename,
            timestamp: activity.parsed_at || new Date().toISOString(),
            status: activity.status === 'completed' ? 'completed' : activity.status === 'error' ? 'failed' : 'processing'
          })
        })
      }

      // Add recent job activities (mock for now as we don't have a direct API)
      // In a real implementation, we would fetch recent jobs and add them here

      setRecentActivity(activities)

      // System health status is available in healthCheck.status

      setLoading(false)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data. Please try again later.')
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAllData()

    // Removed automatic refresh to prevent video interruption
    // Users can manually refresh with the refresh button
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'completed':
        return 'text-green-600 bg-green-50'
      case 'processing':
        return 'text-blue-600 bg-blue-50'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50'
      case 'error':
      case 'failed':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'upload':
        return <Upload className="h-4 w-4" />
      case 'job':
        return <Briefcase className="h-4 w-4" />
      case 'comparison':
        return <BarChart3 className="h-4 w-4" />
      case 'ranking':
        return <Award className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const quickActions = [
    {
      title: 'Upload Resumes',
      description: 'Upload and parse candidate resumes',
      href: '/upload',
      icon: Upload,
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'Create Job',
      description: 'Post new job description and requirements',
      href: '/jobs/create',
      icon: Briefcase,
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'Run Analysis',
      description: 'Compare candidates to jobs',
      href: '/comparisons/create',
      icon: Target,
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: 'View Analytics',
      description: 'See hiring insights and trends',
      href: '/analytics',
      icon: BarChart3,
      color: 'bg-orange-500 hover:bg-orange-600'
    }
  ]

  const features = [
    {
      title: 'NLP-Driven Parsing',
      description: 'Extract skills, experience, and education from resumes using advanced NLP',
      icon: Brain,
      stats: `${stats.files.parsed_files} resumes parsed`
    },
    {
      title: 'Smart Job Matching',
      description: 'Match candidates to jobs with configurable ATS scoring algorithms',
      icon: Search,
      stats: `${stats.comparisons.completed} comparisons completed`
    },
    {
      title: 'Advanced Analytics',
      description: 'Get insights on hiring trends, skill gaps, and candidate performance',
      icon: TrendingUp,
      stats: `${stats.analytics.average_score?.toFixed(1) || 0}% average match score`
    },
    {
      title: 'Candidate Ranking',
      description: 'Rank candidates with multi-criteria analysis and NLP recommendations',
      icon: Award,
      stats: 'Multi-factor scoring system'
    }
  ]

  // YouTube video section
  const youtubeVideoId = '-TRHvnnKGFY' // Placeholder - replace with actual video ID
  const youtubeUrl = `https://www.youtube.com/embed/${youtubeVideoId}`

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.reload()} size="responsiveSm">Try Again</Button>
              <Button onClick={refreshAllData} variant="outline" size="responsiveSm">Refresh Data</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white rounded-xl p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-full p-3">
              <Image
                src="/favicon-32x32.png" // or "/android-chrome-192x192.png" for higher res
                alt="Recruvizz Logo"
                width={36}
                height={36}
                className="rounded-lg"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold ml-4">RecruVizz Dashboard</h1>
          </div>
          <Button 
            onClick={refreshAllData}
            variant="outline" 
            className="ml-0 sm:ml-auto bg-white/20 text-white border-white/30 hover:bg-white/30 whitespace-nowrap"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Refresh Data</span>
          </Button>
        </div>
        
        <p className="text-base sm:text-lg text-blue-100 mb-6">
          Streamline your hiring process with NLP-Driven resume analysis, 
          intelligent candidate matching, and data-driven insights
        </p>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            <CheckCircle className="h-4 w-4 mr-2" />
            NLP-Driven Analysis
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            <Target className="h-4 w-4 mr-2" />
            ATS Scoring
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            <BarChart3 className="h-4 w-4 mr-2" />
            Advanced Analytics
          </Badge>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {quickActions.map((action, index) => (
          <Link key={index} href={action.href}>
            <Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-white border-0 shadow-lg h-full">
              <CardContent className="p-5 text-center">
                <div className={`w-12 h-12 mx-auto mb-3 rounded-lg ${action.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors text-sm sm:text-base">
                  {action.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">{action.description}</p>
                <ArrowRight className="h-4 w-4 mx-auto mt-2 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Statistics Overview */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                System Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Statistics */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">File Processing</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600">Total Files</span>
                      <span className="font-semibold text-xs sm:text-sm">{stats.files.total_files}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600">Parsed</span>
                      <span className="font-semibold text-green-600 text-xs sm:text-sm">{stats.files.parsed_files}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600">Processing</span>
                      <span className="font-semibold text-blue-600 text-xs sm:text-sm">{stats.files.processing_files}</span>
                    </div>
                    {stats.files.total_files > 0 && (
                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-500">Success Rate</span>
                          <span className="text-xs font-medium">
                            {((stats.files.parsed_files / stats.files.total_files) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={(stats.files.parsed_files / stats.files.total_files) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Job Statistics */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Job Management</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600">Total Jobs</span>
                      <span className="font-semibold text-xs sm:text-sm">{stats.jobs.total_jobs}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600">Active</span>
                      <span className="font-semibold text-green-600 text-xs sm:text-sm">{stats.jobs.active_jobs}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600">Draft</span>
                      <span className="font-semibold text-orange-600 text-xs sm:text-sm">{stats.jobs.draft_jobs}</span>
                    </div>
                    {stats.comparisons.completed + stats.comparisons.pending > 0 && (
                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-500">Completion Rate</span>
                          <span className="text-xs font-medium">
                            {stats.comparisons.completed + stats.comparisons.pending > 0 
                              ? ((stats.comparisons.completed / (stats.comparisons.completed + stats.comparisons.pending)) * 100).toFixed(1) + '%' 
                              : '0.0%'}
                          </span>
                        </div>
                        <Progress 
                          value={stats.comparisons.completed + stats.comparisons.pending > 0 
                            ? (stats.comparisons.completed / (stats.comparisons.completed + stats.comparisons.pending)) * 100 
                            : 0} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features Overview */}
          <Card className="bg-white border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Platform Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg flex-shrink-0">
                      <feature.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{feature.title}</h4>
                      <p className="text-xs sm:text-sm text-gray-600 mb-2">{feature.description}</p>
                      <p className="text-xs text-blue-600 font-medium">{feature.stats}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="space-y-6">
          <Card className="bg-white border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className={`p-2 rounded-full ${getStatusColor(activity.status)} flex-shrink-0`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(activity.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                ))}
                {recentActivity.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-gray-900">
                <TrendingUp className="h-5 w-5 mr-2" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                    {stats.analytics.average_score?.toFixed(1) || 0}%
                  </div>
                  <div className="text-xs sm:text-xs text-gray-600">Average ATS Score</div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-base sm:text-lg font-semibold text-green-600">
                      {stats.analytics.top_score?.toFixed(1) || 0}%
                    </div>
                    <div className="text-xs text-gray-600">Highest Score</div>
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-semibold text-blue-600">
                      {stats.analytics.total_candidates || 0}
                    </div>
                    <div className="text-xs text-gray-600">Total Candidates</div>
                  </div>
                </div>
                
                <div className="pt-2">
                  <Link href="/analytics">
                    <Button variant="outline" size="responsiveSm" className="w-full">
                      <span className="text-xs sm:text-sm">View Detailed Analytics</span>
                      <ArrowRight className="h-3 w-3 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* YouTube Demo Section */}
      <div className="mt-8">
        <Card className="bg-white border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Play className="h-5 w-5 mr-2" />
              Product Demo Video
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4 text-sm sm:text-base">
              Watch a quick walkthrough of RecruVizz in action.
            </p>
            
            {/* Responsive YouTube Embed */}
            <div className="relative pb-[56.25%] h-0 rounded-lg overflow-hidden mb-4"> {/* 16:9 Aspect Ratio */}
              <iframe
                src={youtubeUrl}
                title="RecruVizz Product Demo"
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            
            {/* Fallback Button */}
            <a 
              href={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Watch on YouTube
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="mt-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 text-center">Explore All Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'Resume Management',
              description: 'Upload, parse, and manage candidate resumes with NLP-Driven extraction',
              href: '/processing',
              icon: FileText,
              color: 'from-blue-500 to-blue-600'
            },
            {
              title: 'Job Descriptions',
              description: 'Create and manage job postings with detailed requirements and scoring',
              href: '/jobs',
              icon: Briefcase,
              color: 'from-green-500 to-green-600'
            },
            {
              title: 'ATS Comparisons',
              description: 'Compare candidates against job requirements with intelligent scoring',
              href: '/comparisons',
              icon: Target,
              color: 'from-purple-500 to-purple-600'
            },
            {
              title: 'Candidate Ranking',
              description: 'Rank and shortlist candidates using multi-criteria analysis',
              href: '/ranking',
              icon: Award,
              color: 'from-orange-500 to-orange-600'
            },
            {
              title: 'Analytics Dashboard',
              description: 'Get insights on hiring trends, skill gaps, and performance metrics',
              href: '/analytics',
              icon: BarChart3,
              color: 'from-red-500 to-red-600'
            },
            {
              title: 'System Health',
              description: 'Monitor system performance, health status, and processing statistics',
              href: '/system',
              icon: Settings,
              color: 'from-gray-500 to-gray-600'
            }
          ].map((item, index) => (
            <Link key={index} href={item.href}>
              <Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-white border-0 shadow-lg h-full">
                <CardContent className="p-5">
                  <div className={`w-10 h-10 mb-3 rounded-lg bg-gradient-to-r ${item.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors text-sm sm:text-base">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3">{item.description}</p>
                  <div className="flex items-center text-xs sm:text-sm text-blue-600 group-hover:text-blue-700 transition-colors">
                    <span>Learn more</span>
                    <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}