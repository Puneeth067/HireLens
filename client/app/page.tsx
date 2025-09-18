'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cachedApiService } from '@/lib/cached-api'
import { useLogger, LoggerUtils } from '@/lib/logger'
import { LoadingWrapper, useLoadingState } from '@/components/ui/page-wrapper'
import { DashboardSkeleton, AnalyticsCardSkeleton } from '@/components/ui/skeleton'
import ErrorBoundary from '@/components/error-boundary'
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
  Zap,
  Brain,
  Search,
  Settings
} from 'lucide-react'

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

function HomePageContent() {
  const logger = useLogger('HomePage');
  const { loading, error, startLoading, stopLoading, setError, clearError } = useLoadingState('HomePage');
  
  const [stats, setStats] = useState<SystemStats>({
    files: { total_files: 0, parsed_files: 0, processing_files: 0, failed_files: 0 },
    jobs: { total_jobs: 0, active_jobs: 0, draft_jobs: 0 },
    comparisons: { total_comparisons: 0, completed: 0, pending: 0, failed: 0 },
    analytics: { total_candidates: 0, average_score: 0, top_score: 0 }
  })
  
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [systemHealth, setSystemHealth] = useState<'healthy' | 'degraded' | 'error'>('healthy')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true);
    logger.lifecycle('mount');
    LoggerUtils.logPageChange('', 'home');
    
    // Initial data fetch
    fetchSystemData();
    
    // Set up interval for periodic updates
    const interval = setInterval(() => {
      fetchSystemData();
    }, 30000); // Update every 30 seconds
    
    return () => {
      clearInterval(interval);
      logger.lifecycle('unmount');
    };
  }, []); // Empty dependency array to prevent infinite loop

  const fetchSystemData = useCallback(async () => {
    startLoading();
    clearError();
    
    try {
      logger.info('Fetching dashboard data');
      const startTime = performance.now();
      
      // Add debugging information
      console.log('API Configuration:', {
        apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });
      
      // Use cached API service for better performance
      const healthData = await cachedApiService.healthCheck();
      
      const loadTime = performance.now() - startTime;
      logger.info('Dashboard data loaded', { loadTime: Math.round(loadTime) });
      
      setSystemHealth((healthData.status === 'healthy' || healthData.status === 'degraded' || healthData.status === 'error') 
        ? healthData.status 
        : 'healthy');
      
      if (healthData.statistics) {
        setStats({
          files: {
            total_files: healthData.statistics.files?.total_files ?? 0,
            parsed_files: healthData.statistics.files?.parsed_files ?? 0,
            processing_files: healthData.statistics.files?.processing_files ?? 0,
            failed_files: healthData.statistics.files?.failed_files ?? 0
          },
          jobs: {
            total_jobs: healthData.statistics.jobs?.total_jobs ?? 0,
            active_jobs: healthData.statistics.jobs?.active_jobs ?? 0,
            draft_jobs: healthData.statistics.jobs?.draft_jobs ?? 0
          },
          comparisons: {
            total_comparisons: healthData.statistics.comparisons?.total_comparisons ?? 0,
            completed: healthData.statistics.comparisons?.completed ?? 0,
            pending: healthData.statistics.comparisons?.pending ?? 0,
            failed: healthData.statistics.comparisons?.failed ?? 0
          },
          analytics: {
            total_candidates: healthData.statistics.analytics?.total_candidates ?? 0,
            average_score: healthData.statistics.analytics?.average_score ?? 0,
            top_score: healthData.statistics.analytics?.top_score ?? 0
          }
        });
      }

      // Simulate recent activity (you can replace with actual API calls)
      const mockActivity: RecentActivity[] = [
        {
          type: 'upload',
          title: 'Resume Upload',
          description: '5 resumes uploaded successfully',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          status: 'completed'
        },
        {
          type: 'job',
          title: 'New Job Posted',
          description: 'Senior Frontend Developer at TechCorp',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          status: 'completed'
        },
        {
          type: 'comparison',
          title: 'ATS Analysis',
          description: 'Analyzed 12 candidates for Backend Role',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          status: 'completed'
        },
        {
          type: 'ranking',
          title: 'Candidate Ranking',
          description: 'Generated top 10 shortlist for DevOps position',
          timestamp: new Date(Date.now() - 1200000).toISOString(),
          status: 'completed'
        }
      ];
      setRecentActivity(mockActivity);
      setLastRefresh(new Date());
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
      const isNetworkError = errorMessage.includes('Network error') || errorMessage.includes('Failed to fetch');
      
      console.error('Dashboard fetch error:', {
        error: err,
        message: errorMessage,
        isNetworkError,
        timestamp: new Date().toISOString()
      });
      
      logger.error(errorMessage, { 
        error: err, 
        isNetworkError,
        apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      });
      
      setError(isNetworkError 
        ? 'Unable to connect to the backend server. Please ensure the server is running.'
        : errorMessage
      );
      setSystemHealth('error');
    } finally {
      stopLoading();
    }
  }, []); // Remove all dependencies to prevent infinite loop
  // Enhanced click handlers with logging
  const handleQuickAction = useCallback((actionName: string, href: string) => {
    LoggerUtils.logButtonClick(`quick_action_${actionName}`, { href });
  }, []);

  const handleRefresh = useCallback(() => {
    LoggerUtils.logButtonClick('refresh_dashboard');
    fetchSystemData();
  }, []); // Remove fetchSystemData dependency to prevent infinite loop

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
      title: 'AI-Powered Parsing',
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
      description: 'Rank candidates with multi-criteria analysis and AI recommendations',
      icon: Award,
      stats: 'Multi-factor scoring system'
    }
  ]

  return (
    <LoadingWrapper
      loading={loading}
      error={error}
      onRetry={fetchSystemData}
      skeleton={<DashboardSkeleton showStats={true} showCharts={true} showTable={true} />}
      componentName="HomePage"
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white">
          <div className="container mx-auto px-4 py-16">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-full p-4">
                  <Zap className="h-12 w-12" />
                </div>
              </div>
              
              <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                Resume Parser & Insight Generator
              </h1>
              
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Streamline your hiring process with AI-powered resume analysis, 
                intelligent candidate matching, and data-driven insights
              </p>
              
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 px-4 py-2">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  AI-Powered Analysis
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 px-4 py-2">
                  <Target className="h-4 w-4 mr-2" />
                  ATS Scoring
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 px-4 py-2">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Advanced Analytics
                </Badge>
              </div>

              {/* System Status */}
              <div className="flex items-center justify-center space-x-6">
                <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${getStatusColor(systemHealth)}`}>
                  {systemHealth === 'healthy' ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  <span className="font-medium capitalize">System {systemHealth}</span>
                </div>
                
                <div className="text-white/80">
                  <span className="font-semibold">{stats.files.total_files}</span> resumes processed
                </div>
                
                <div className="text-white/80">
                  <span className="font-semibold">{stats.jobs.active_jobs}</span> active jobs
                </div>
                
                {/* Refresh indicator */}
                <div className="text-white/60 text-sm">
                  Last updated: {isMounted && lastRefresh ? lastRefresh.toLocaleTimeString() : '--:--:--'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 -mt-8 relative z-10">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href} onClick={() => handleQuickAction(action.title, action.href)}>
                <Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardContent className="p-6 text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${action.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300`}>
                      <action.icon className="h-8 w-8" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-sm text-gray-600">{action.description}</p>
                    <ArrowRight className="h-4 w-4 mx-auto mt-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

        {/* Main Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Statistics Overview */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  System Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  {/* File Statistics */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">File Processing</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Files</span>
                        <span className="font-semibold">{stats.files.total_files}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Parsed</span>
                        <span className="font-semibold text-green-600">{stats.files.parsed_files}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Processing</span>
                        <span className="font-semibold text-blue-600">{stats.files.processing_files}</span>
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
                    <h4 className="font-semibold text-gray-900">Job Management</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Jobs</span>
                        <span className="font-semibold">{stats.jobs.total_jobs}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Active</span>
                        <span className="font-semibold text-green-600">{stats.jobs.active_jobs}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Draft</span>
                        <span className="font-semibold text-orange-600">{stats.jobs.draft_jobs}</span>
                      </div>
                      {stats.comparisons.total_comparisons > 0 && (
                        <div className="pt-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-500">Completion Rate</span>
                            <span className="text-xs font-medium">
                              {((stats.comparisons.completed / stats.comparisons.total_comparisons) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={(stats.comparisons.completed / stats.comparisons.total_comparisons) * 100} 
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
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Platform Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-4">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
                        <feature.icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{feature.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{feature.description}</p>
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
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full ${getStatusColor(activity.status)}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        <p className="text-xs text-gray-500">{activity.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
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
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {stats.analytics.average_score?.toFixed(1) || 0}%
                    </div>
                    <div className="text-xs text-gray-600">Average ATS Score</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-green-600">
                        {stats.analytics.top_score?.toFixed(1) || 0}%
                      </div>
                      <div className="text-xs text-gray-600">Highest Score</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-blue-600">
                        {stats.analytics.total_candidates || 0}
                      </div>
                      <div className="text-xs text-gray-600">Total Candidates</div>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Link href="/analytics">
                      <Button variant="outline" size="sm" className="w-full">
                        View Detailed Analytics
                        <ArrowRight className="h-3 w-3 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Explore All Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Resume Management',
                description: 'Upload, parse, and manage candidate resumes with AI-powered extraction',
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
                <Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 mb-4 rounded-xl bg-gradient-to-r ${item.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300`}>
                      <item.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                    <div className="flex items-center text-sm text-blue-600 group-hover:text-blue-700 transition-colors">
                      <span>Learn more</span>
                      <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
        </div>
      </div>
    </LoadingWrapper>
  )
}

// Main HomePage component with error boundary
export default function HomePage() {
  return (
    <ErrorBoundary
      errorBoundaryName="HomePage"
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <HomePageContent />
    </ErrorBoundary>
  )
}