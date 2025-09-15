'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Server,  
  Activity, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  RefreshCw,
  HardDrive,
  Cpu,
  MemoryStick as Memory,
  Folder,
  Shield,
  Settings
} from 'lucide-react'

interface SystemHealth {
  status: string
  timestamp: number
  version: string
  system: {
    cpu_percent: number
    memory_percent: number
    disk_percent: number
    python_version: string
  }
  directories: {
    upload_dir: boolean
    resumes_dir: boolean
    temp_dir: boolean
    data_dir: boolean
    upload_path: string
  }
  services: {
    file_service: string
    job_service: string
    comparison_service: string
    analytics_service: string
    ranking_service: string
    ats_scoring: string
  }
  dependencies: {
    status: string
    spacy: boolean
    nltk: boolean
    sklearn: boolean
    missing: string[]
  }
  statistics: {
    files: Record<string, unknown>
    jobs: Record<string, unknown>
    comparisons: Record<string, unknown>
    analytics: Record<string, unknown>
    rankings: Record<string, unknown>
  }
  configuration: {
    max_file_size_mb: number
    allowed_extensions: string[]
    async_processing: boolean
    max_concurrent_processes: number
  }
}

interface SystemInfo {
  system: {
    cpu_usage_percent: number
    memory: {
      total_gb: number
      available_gb: number
      usage_percent: number
    }
    disk: {
      total_gb: number
      used_gb: number
      free_gb: number
      usage_percent: number
    }
  }
  application: {
    upload_directory_size_mb: number
    configuration: {
      max_file_size_mb: number
      allowed_extensions: string[]
      async_processing: boolean
      max_concurrent_processes: number
    }
    files: Record<string, unknown>
    jobs: Record<string, unknown>
    comparisons: Record<string, unknown>
    analytics: Record<string, unknown>
  }
  timestamp: number
}

export default function SystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    fetchSystemData()
    const interval = setInterval(fetchSystemData, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchSystemData = async () => {
    setRefreshing(true)
    try {
      // Fetch health data
      const healthResponse = await fetch('/api/health')
      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        setHealth(healthData)
      }

      // Fetch detailed system info
      const infoResponse = await fetch('/api/system/info')
      if (infoResponse.ok) {
        const infoData = await infoResponse.json()
        setSystemInfo(infoData)
      }

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch system data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'operational':
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'degraded':
      case 'limited':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case 'error':
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'operational':
      case 'ok':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'degraded':
      case 'limited':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  if (loading && !health) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading system information...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">System Health</h1>
            <p className="text-gray-600">
              Monitor system performance, health status, and service availability
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
            <Button 
              onClick={fetchSystemData} 
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              {refreshing ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {health && (
        <>
          {/* Overall Status */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Server className="h-6 w-6 mr-2" />
                  System Status
                </div>
                <Badge className={getStatusColor(health.status)}>
                  {getStatusIcon(health.status)}
                  <span className="ml-2 capitalize">{health.status}</span>
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    v{health.version}
                  </div>
                  <div className="text-sm text-gray-600">Application Version</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {health.system.cpu_percent.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">CPU Usage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {health.system.memory_percent.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Memory Usage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {health.system.disk_percent.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Disk Usage</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="services" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
            </TabsList>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    Service Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(health.services).map(([service, status]) => (
                      <div key={service} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {getStatusIcon(status)}
                          <div className="ml-3">
                            <p className="font-medium text-gray-900 capitalize">
                              {service.replace('_', ' ')}
                            </p>
                            <p className="text-sm text-gray-500 capitalize">{status}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Folder className="h-5 w-5 mr-2" />
                    Directory Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(health.directories).map(([dir, status]) => {
                      if (dir === 'upload_path') return null
                      return (
                        <div key={dir} className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">
                            {dir.replace('_', ' ')}
                          </span>
                          <div className="flex items-center">
                            {status ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="ml-2 text-sm text-gray-600">
                              {status ? 'Available' : 'Missing'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    <div className="pt-2 border-t">
                      <p className="text-sm text-gray-600">
                        Upload Path: <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {health.directories.upload_path}
                        </code>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Resources Tab */}
            <TabsContent value="resources" className="space-y-4">
              {systemInfo && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Cpu className="h-5 w-5 mr-2" />
                          CPU Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">
                              {systemInfo.system.cpu_usage_percent.toFixed(1)}%
                            </span>
                            <Cpu className="h-8 w-8 text-blue-600" />
                          </div>
                          <Progress value={systemInfo.system.cpu_usage_percent} className="h-3" />
                          <p className="text-sm text-gray-600">
                            Python {health.system.python_version}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Memory className="h-5 w-5 mr-2" />
                          Memory Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">
                              {systemInfo.system.memory.usage_percent.toFixed(1)}%
                            </span>
                            <Memory className="h-8 w-8 text-green-600" />
                          </div>
                          <Progress value={systemInfo.system.memory.usage_percent} className="h-3" />
                          <p className="text-sm text-gray-600">
                            {systemInfo.system.memory.available_gb.toFixed(1)} GB / {systemInfo.system.memory.total_gb.toFixed(1)} GB available
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <HardDrive className="h-5 w-5 mr-2" />
                          Disk Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">
                              {systemInfo.system.disk.usage_percent.toFixed(1)}%
                            </span>
                            <HardDrive className="h-8 w-8 text-purple-600" />
                          </div>
                          <Progress value={systemInfo.system.disk.usage_percent} className="h-3" />
                          <p className="text-sm text-gray-600">
                            {systemInfo.system.disk.free_gb.toFixed(1)} GB free of {systemInfo.system.disk.total_gb.toFixed(1)} GB
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Storage Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium mb-3">Application Storage</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Upload Directory</span>
                              <span className="text-sm font-medium">
                                {formatBytes(systemInfo.application.upload_directory_size_mb * 1024 * 1024)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-3">System Resources</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Total Disk Space</span>
                              <span className="text-sm font-medium">
                                {systemInfo.system.disk.total_gb.toFixed(1)} GB
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Used Space</span>
                              <span className="text-sm font-medium">
                                {systemInfo.system.disk.used_gb.toFixed(1)} GB
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Available Space</span>
                              <span className="text-sm font-medium">
                                {systemInfo.system.disk.free_gb.toFixed(1)} GB
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Dependencies Tab */}
            <TabsContent value="dependencies" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Dependency Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center">
                        {getStatusIcon(health.dependencies.status)}
                        <div className="ml-3">
                          <p className="font-medium">Overall Dependencies</p>
                          <p className="text-sm text-gray-500 capitalize">{health.dependencies.status}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {health.dependencies.spacy ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div className="ml-3">
                            <p className="font-medium">spaCy NLP</p>
                            <p className="text-sm text-gray-500">
                              {health.dependencies.spacy ? 'Available' : 'Missing'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {health.dependencies.nltk ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div className="ml-3">
                            <p className="font-medium">NLTK</p>
                            <p className="text-sm text-gray-500">
                              {health.dependencies.nltk ? 'Available' : 'Missing'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {health.dependencies.sklearn ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div className="ml-3">
                            <p className="font-medium">scikit-learn</p>
                            <p className="text-sm text-gray-500">
                              {health.dependencies.sklearn ? 'Available' : 'Missing'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {health.dependencies.missing.length > 0 && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-medium text-yellow-800 mb-2">Missing Dependencies</h4>
                        <ul className="text-sm text-yellow-700 space-y-1">
                          {health.dependencies.missing.map((dep, index) => (
                            <li key={index}>• {dep}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="statistics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">File Processing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {health.statistics.files && typeof health.statistics.files === 'object' && (() => {
                        type FileStats = {
                          total_files?: number
                          parsed_files?: number
                          processing_files?: number
                          failed_files?: number
                        }
                        const files = health.statistics.files as FileStats
                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Total Files</span>
                              <span className="font-medium">{files.total_files ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Parsed</span>
                              <span className="font-medium text-green-600">{files.parsed_files || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Processing</span>
                              <span className="font-medium text-blue-600">{files.processing_files || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Failed</span>
                              <span className="font-medium text-red-600">{files.failed_files || 0}</span>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Job Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {health.statistics.jobs && typeof health.statistics.jobs === 'object' && (() => {
                        type JobStats = {
                          total_jobs?: number
                          active_jobs?: number
                          draft_jobs?: number
                        }
                        const jobs = health.statistics.jobs as JobStats
                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Total Jobs</span>
                              <span className="font-medium">{jobs.total_jobs ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Active</span>
                              <span className="font-medium text-green-600">{jobs.active_jobs ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Draft</span>
                              <span className="font-medium text-orange-600">{jobs.draft_jobs || 0}</span>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Comparisons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {health.statistics.comparisons && typeof health.statistics.comparisons === 'object' && (() => {
                        type ComparisonStats = {
                          total_comparisons?: number
                          completed?: number
                          pending?: number
                          failed?: number
                        }
                        const comparisons = health.statistics.comparisons as ComparisonStats
                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Total</span>
                              <span className="font-medium">{comparisons.total_comparisons ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Completed</span>
                              <span className="font-medium text-green-600">{comparisons.completed || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Pending</span>
                              <span className="font-medium text-blue-600">{comparisons.pending || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Failed</span>
                              <span className="font-medium text-red-600">{comparisons.failed || 0}</span>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {health.statistics.analytics && typeof health.statistics.analytics === 'object' && (() => {
                type AnalyticsStats = {
                  total_candidates?: number
                  average_score?: number
                  top_score?: number
                }
                const analytics = health.statistics.analytics as AnalyticsStats
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Analytics Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900 mb-1">
                            {analytics.total_candidates ?? 0}
                          </div>
                          <div className="text-sm text-gray-600">Total Candidates</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600 mb-1">
                            {analytics.average_score?.toFixed(1) || '0.0'}%
                          </div>
                          <div className="text-sm text-gray-600">Average Score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600 mb-1">
                            {analytics.top_score?.toFixed(1) || '0.0'}%
                          </div>
                          <div className="text-sm text-gray-600">Top Score</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}
            </TabsContent>

            {/* Configuration Tab */}
            <TabsContent value="configuration" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Application Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">File Processing</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Max File Size</span>
                          <span className="text-sm font-medium">{health.configuration.max_file_size_mb} MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Async Processing</span>
                          <span className="text-sm font-medium">
                            {health.configuration.async_processing ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Max Concurrent</span>
                          <span className="text-sm font-medium">{health.configuration.max_concurrent_processes}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3">Allowed Extensions</h4>
                      <div className="flex flex-wrap gap-2">
                        {health.configuration.allowed_extensions.map((ext, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {ext}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}