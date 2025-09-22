'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cachedApiService } from '@/lib/cached-api'
import { useLogger, LoggerUtils } from '@/lib/logger'
import { LoadingWrapper, useLoadingState } from '@/components/ui/page-wrapper'
import { DashboardSkeleton } from '@/components/ui/skeleton'
import ErrorBoundary from '@/components/error-boundary'
import { SystemHealth, SystemInfo } from '@/lib/types'
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
  Settings,
  ArrowLeft
} from 'lucide-react'

function SystemPageContent() {
  const router = useRouter();
  const logger = useLogger('SystemPage');
  const { loading, error, startLoading, stopLoading, setError, clearError } = useLoadingState('SystemPage');
  
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isClient, setIsClient] = useState(false)

  // Ensure client-side rendering for time display
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    logger.lifecycle('mount');
    LoggerUtils.logPageChange('', 'system');
    fetchSystemData();
    
    const interval = setInterval(() => {
      fetchSystemData();
    }, 60000); // Update every 60 seconds to reduce UI disruption
    
    return () => {
      clearInterval(interval);
      logger.lifecycle('unmount');
    };
  }, [fetchSystemData, logger]);

  const fetchSystemData = useCallback(async () => {
    setRefreshing(true);
    if (!health && !systemInfo) {
      startLoading();
    }
    clearError();
    
    try {
      logger.info('Fetching system data');
      const startTime = performance.now();
      
      // Use cached API service for better performance
      const healthData = await cachedApiService.healthCheck();
      setHealth(healthData);

      // Fetch detailed system info
      const infoData = await cachedApiService.getSystemInfo();
      setSystemInfo(infoData);

      const loadTime = performance.now() - startTime;
      logger.info('System data loaded', { loadTime: Math.round(loadTime) });
      
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = 'Failed to fetch system data';
      logger.error(errorMessage, { error: err });
      setError(errorMessage);
    } finally {
      stopLoading();
      setRefreshing(false);
    }
  }, [clearError, health, logger, setError, startLoading, stopLoading, systemInfo]);

  // Enhanced refresh handler with logging
  const handleRefresh = useCallback(() => {
    LoggerUtils.logButtonClick('refresh_system');
    fetchSystemData();
  }, [fetchSystemData]);

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

  return (
    <LoadingWrapper
      loading={loading}
      error={error}
      onRetry={fetchSystemData}
      skeleton={<DashboardSkeleton showStats={true} showCharts={false} showTable={false} />}
      componentName="SystemPage"
    >
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header with Back Button - Made responsive */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">System Health</h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Monitor system performance, health status, and service availability
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => {
                  LoggerUtils.logButtonClick('back_button_clicked');
                  router.back();
                }}
                variant="outline"
                size="responsiveSm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden xs:inline">Back</span>
              </Button>
              <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                {isClient ? `Updated: ${lastUpdated.toLocaleTimeString()}` : 'Updated: --:--:--'}
              </div>
              <Button 
                onClick={handleRefresh} 
                disabled={refreshing}
                variant="outline"
                size="responsiveSm"
                className="flex items-center gap-2"
              >
                {refreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="hidden xs:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

      {health && (
        <>
          {/* Overall Status - Made responsive */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center">
                  <Server className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                  System Status
                </div>
                <Badge className={getStatusColor(health.status)}>
                  {getStatusIcon(health.status)}
                  <span className="ml-2 capitalize">{health.status}</span>
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg sm:text-2xl font-bold text-gray-900 mb-1">
                    v{health.version}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">App Version</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg sm:text-2xl font-bold text-blue-600 mb-1">
                    {health?.system?.cpu_percent?.toFixed(1) ?? '0.0'}%
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">CPU Usage</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg sm:text-2xl font-bold text-green-600 mb-1">
                    {health?.system?.memory_percent?.toFixed(1) ?? '0.0'}%
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Memory Usage</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg sm:text-2xl font-bold text-purple-600 mb-1">
                    {health?.system?.disk_percent?.toFixed(1) ?? '0.0'}%
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">Disk Usage</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="services" className="space-y-6">
            {/* Tabs List - Made responsive */}
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 rounded-xl bg-muted p-1">
              <TabsTrigger
                value="services"
                className="text-xs sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-2 py-1 transition-colors"
              >
                Services
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                className="text-xs sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-2 py-1 transition-colors"
              >
                Resources
              </TabsTrigger>
              <TabsTrigger
                value="dependencies"
                className="text-xs sm:text-sm hidden sm:block data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-2 py-1 transition-colors"
              >
                Dependencies
              </TabsTrigger>
              <TabsTrigger
                value="statistics"
                className="text-xs sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-2 py-1 transition-colors"
              >
                Statistics
              </TabsTrigger>
              <TabsTrigger
                value="configuration"
                className="text-xs sm:text-sm hidden lg:block data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg px-2 py-1 transition-colors"
              >
                Configuration
              </TabsTrigger>

              {/* Mobile dropdown alternatives */}
              <TabsTrigger
                value="dependencies-mobile"
                className="text-xs sm:text-sm sm:hidden data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-2 py-1"
              >
                Deps
              </TabsTrigger>
              <TabsTrigger
                value="configuration-mobile"
                className="text-xs sm:text-sm lg:hidden data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-2 py-1"
              >
                Config
              </TabsTrigger>
            </TabsList>


            {/* Services Tab - Made responsive */}
            <TabsContent value="services" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Service Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(health.services).map(([service, status]) => (
                      <div key={service} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {getStatusIcon(status)}
                          <div className="ml-3">
                            <p className="font-medium text-gray-900 text-sm capitalize">
                              {service.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">{status}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Folder className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
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
                            <span className="ml-2 text-xs sm:text-sm text-gray-600">
                              {status ? 'Available' : 'Missing'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    <div className="pt-2 border-t">
                      <p className="text-xs sm:text-sm text-gray-600">
                        Upload Path: <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {health.directories.upload_path}
                        </code>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Resources Tab - Made responsive */}
            <TabsContent value="resources" className="space-y-4">
              {systemInfo && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="p-4">
                        <CardTitle className="flex items-center text-base">
                          <Cpu className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          CPU Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xl sm:text-2xl font-bold">
                              {systemInfo?.system?.cpu_usage_percent?.toFixed(1) ?? '0.0'}%
                            </span>
                            <Cpu className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                          </div>
                          <Progress value={systemInfo?.system?.cpu_usage_percent ?? 0} className="h-2 sm:h-3" />
                          <p className="text-xs sm:text-sm text-gray-600">
                            Python {health?.system?.python_version ?? 'Unknown'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="p-4">
                        <CardTitle className="flex items-center text-base">
                          <Memory className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          Memory Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xl sm:text-2xl font-bold">
                              {systemInfo?.system?.memory?.usage_percent?.toFixed(1) ?? '0.0'}%
                            </span>
                            <Memory className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                          </div>
                          <Progress value={systemInfo?.system?.memory?.usage_percent ?? 0} className="h-2 sm:h-3" />
                          <p className="text-xs sm:text-sm text-gray-600">
                            {systemInfo?.system?.memory?.available_gb?.toFixed(1) ?? '0.0'} GB / {systemInfo?.system?.memory?.total_gb?.toFixed(1) ?? '0.0'} GB available
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="p-4">
                        <CardTitle className="flex items-center text-base">
                          <HardDrive className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          Disk Usage
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xl sm:text-2xl font-bold">
                              {systemInfo?.system?.disk?.usage_percent?.toFixed(1) ?? '0.0'}%
                            </span>
                            <HardDrive className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
                          </div>
                          <Progress value={systemInfo?.system?.disk?.usage_percent ?? 0} className="h-2 sm:h-3" />
                          <p className="text-xs sm:text-sm text-gray-600">
                            {systemInfo?.system?.disk?.free_gb?.toFixed(1) ?? '0.0'} GB free of {systemInfo?.system?.disk?.total_gb?.toFixed(1) ?? '0.0'} GB
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="p-4">
                      <CardTitle className="text-base sm:text-lg">Storage Information</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <h4 className="font-medium text-sm mb-3">Application Storage</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Upload Directory</span>
                              <span className="text-xs sm:text-sm font-medium">
                                {formatBytes((systemInfo?.application?.upload_directory_size_mb ?? 0) * 1024 * 1024)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm mb-3">System Resources</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Total Disk Space</span>
                              <span className="text-xs sm:text-sm font-medium">
                                {systemInfo?.system?.disk?.total_gb?.toFixed(1) ?? '0.0'} GB
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Used Space</span>
                              <span className="text-xs sm:text-sm font-medium">
                                {systemInfo?.system?.disk?.used_gb?.toFixed(1) ?? '0.0'} GB
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Available Space</span>
                              <span className="text-xs sm:text-sm font-medium">
                                {systemInfo?.system?.disk?.free_gb?.toFixed(1) ?? '0.0'} GB
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

            {/* Dependencies Tab - Made responsive */}
            <TabsContent value="dependencies" className="space-y-4">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Shield className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Dependency Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {health.dependencies.spacy ? (
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                          )}
                          <div className="ml-3">
                            <p className="font-medium text-sm">spaCy NLP</p>
                            <p className="text-xs text-gray-500">
                              {health.dependencies.spacy ? 'Available' : 'Missing'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {health.dependencies.nltk ? (
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                          )}
                          <div className="ml-3">
                            <p className="font-medium text-sm">NLTK</p>
                            <p className="text-xs text-gray-500">
                              {health.dependencies.nltk ? 'Available' : 'Missing'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {health.dependencies.sklearn ? (
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                          )}
                          <div className="ml-3">
                            <p className="font-medium text-sm">scikit-learn</p>
                            <p className="text-xs text-gray-500">
                              {health.dependencies.sklearn ? 'Available' : 'Missing'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {health.dependencies.missing.length > 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-medium text-yellow-800 text-sm mb-2">Missing Dependencies</h4>
                        <ul className="text-xs text-yellow-700 space-y-1">
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

            {/* Mobile Dependencies Tab */}
            <TabsContent value="dependencies-mobile" className="space-y-4">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Shield className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Dependency Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
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

                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {health.dependencies.spacy ? (
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                          )}
                          <div className="ml-3">
                            <p className="font-medium text-sm">spaCy NLP</p>
                            <p className="text-xs text-gray-500">
                              {health.dependencies.spacy ? 'Available' : 'Missing'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {health.dependencies.nltk ? (
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                          )}
                          <div className="ml-3">
                            <p className="font-medium text-sm">NLTK</p>
                            <p className="text-xs text-gray-500">
                              {health.dependencies.nltk ? 'Available' : 'Missing'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center">
                          {health.dependencies.sklearn ? (
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                          )}
                          <div className="ml-3">
                            <p className="font-medium text-sm">scikit-learn</p>
                            <p className="text-xs text-gray-500">
                              {health.dependencies.sklearn ? 'Available' : 'Missing'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {health.dependencies.missing.length > 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-medium text-yellow-800 text-sm mb-2">Missing Dependencies</h4>
                        <ul className="text-xs text-yellow-700 space-y-1">
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

            {/* Statistics Tab - Made responsive */}
            <TabsContent value="statistics" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-base">File Processing</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
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
                              <span className="text-xs sm:text-sm text-gray-600">Total Files</span>
                              <span className="font-medium text-sm">{files.total_files ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Parsed</span>
                              <span className="font-medium text-sm text-green-600">{files.parsed_files || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Processing</span>
                              <span className="font-medium text-sm text-blue-600">{files.processing_files || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Failed</span>
                              <span className="font-medium text-sm text-red-600">{files.failed_files || 0}</span>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-base">Job Management</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
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
                              <span className="text-xs sm:text-sm text-gray-600">Total Jobs</span>
                              <span className="font-medium text-sm">{jobs.total_jobs ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Active</span>
                              <span className="font-medium text-sm text-green-600">{jobs.active_jobs ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Draft</span>
                              <span className="font-medium text-sm text-orange-600">{jobs.draft_jobs || 0}</span>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-base">Comparisons</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
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
                              <span className="text-xs sm:text-sm text-gray-600">Total</span>
                              <span className="font-medium text-sm">{comparisons.total_comparisons ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Completed</span>
                              <span className="font-medium text-sm text-green-600">{comparisons.completed || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Pending</span>
                              <span className="font-medium text-sm text-blue-600">{comparisons.pending || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs sm:text-sm text-gray-600">Failed</span>
                              <span className="font-medium text-sm text-red-600">{comparisons.failed || 0}</span>
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
                  <Card className="mt-4">
                    <CardHeader className="p-4">
                      <CardTitle className="text-base">Analytics Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                            {analytics.total_candidates ?? 0}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Total Candidates</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg sm:text-xl font-bold text-blue-600 mb-1">
                            {analytics.average_score?.toFixed(1) || '0.0'}%
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Average Score</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg sm:text-xl font-bold text-green-600 mb-1">
                            {analytics.top_score?.toFixed(1) || '0.0'}%
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Top Score</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}
            </TabsContent>

            {/* Configuration Tab - Made responsive */}
            <TabsContent value="configuration" className="space-y-4">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Application Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <h4 className="font-medium text-sm mb-3">File Processing</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-gray-600">Max File Size</span>
                          <span className="text-xs sm:text-sm font-medium">{health.configuration.max_file_size_mb} MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-gray-600">Async Processing</span>
                          <span className="text-xs sm:text-sm font-medium">
                            {health.configuration.async_processing ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-gray-600">Max Concurrent</span>
                          <span className="text-xs sm:text-sm font-medium">{health.configuration.max_concurrent_processes}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm mb-3">Allowed Extensions</h4>
                      <div className="flex flex-wrap gap-2">
                        {health.configuration.allowed_extensions.map((ext, index) => (
                          <Badge key={index} variant="outline" className="text-xs px-2 py-0.5">
                            {ext}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Mobile Configuration Tab */}
            <TabsContent value="configuration-mobile" className="space-y-4">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Application Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <h4 className="font-medium text-sm mb-3">File Processing</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-gray-600">Max File Size</span>
                          <span className="text-xs sm:text-sm font-medium">{health.configuration.max_file_size_mb} MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-gray-600">Async Processing</span>
                          <span className="text-xs sm:text-sm font-medium">
                            {health.configuration.async_processing ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs sm:text-sm text-gray-600">Max Concurrent</span>
                          <span className="text-xs sm:text-sm font-medium">{health.configuration.max_concurrent_processes}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm mb-3">Allowed Extensions</h4>
                      <div className="flex flex-wrap gap-2">
                        {health.configuration.allowed_extensions.map((ext, index) => (
                          <Badge key={index} variant="outline" className="text-xs px-2 py-0.5">
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
    </LoadingWrapper>
  )
}

// Main SystemPage component with error boundary
export default function SystemPage() {
  return (
    <ErrorBoundary
      errorBoundaryName="SystemPage"
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <SystemPageContent />
    </ErrorBoundary>
  )
}