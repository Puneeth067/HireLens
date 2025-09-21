'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Brain, CheckCircle2, XCircle, Clock, Eye, Trash2, BarChart3, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiService } from '@/lib/api';
import { ParsedResume, FileMetadata, ProcessingStats, Skill,} from '@/lib/types';
import ErrorBoundary from '@/components/error-boundary';
import { useLogger, logger } from '@/lib/logger';
import { apiCache, systemCache, CacheKeys, CacheInvalidation } from '@/lib/cache';
import { 
  DashboardSkeleton, 
  ListSkeleton, 
  TableSkeleton,
  CardSkeleton 
} from '@/components/ui/skeleton';

function ProcessingPageContent() {
  const router = useRouter();
  const componentLogger = useLogger('ProcessingPage');
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [selectedResume, setSelectedResume] = useState<ParsedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);
  const processingFilesRef = useRef<Set<string>>(new Set());
  const deletingFilesRef = useRef<Set<string>>(new Set());
  
  // Update ref when processingFiles changes
  useEffect(() => {
    processingFilesRef.current = processingFiles;
  }, [processingFiles]);

  // Update ref when deletingFiles changes
  useEffect(() => {
    deletingFilesRef.current = deletingFiles;
  }, [deletingFiles]);

  // Performance tracking
  useEffect(() => {
    componentLogger.lifecycle('mount');
    logger.startPerformanceTimer('processing_page_load');
    
    return () => {
      componentLogger.lifecycle('unmount');
    };
  }, [componentLogger]);

  useEffect(() => {
    loadFiles();
    loadStats();
    
    // Set up polling for processing files
    const interval = setInterval(() => {
      if (processingFilesRef.current.size > 0) {
        componentLogger.debug('Polling for processing files update', { processingCount: processingFilesRef.current.size });
        loadFiles();
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      logger.endPerformanceTimer('processing_page_load');
    };
  }, []); // Empty dependency array to prevent infinite loop

  const loadFiles = useCallback(async () => {
    try {
      setError(null);
      componentLogger.debug('Loading files');
      
      // Try cache first
      const cacheKey = CacheKeys.FILTERED_DATA('files', 'all');
      const cachedFiles = apiCache.get<{ files: FileMetadata[] }>(cacheKey);
      
      if (cachedFiles) {
        componentLogger.debug('Files loaded from cache');
        setFiles(cachedFiles.files);
        
        // Update processing files set
        const processing = new Set(
          cachedFiles.files
            .filter(f => f.status === 'processing')
            .map(f => f.file_id)
        );
        setProcessingFiles(processing);
        
        // Still fetch fresh data in background if there are processing files
        if (processing.size === 0) {
          setLoading(false);
          return;
        }
      }
      
      const response = await apiService.getFiles();
      setFiles(response.files);
      
      // Cache the response
      apiCache.set(cacheKey, response, 30000); // 30 seconds for file list
      
      // Update processing files set
      const processing = new Set(
        response.files
          .filter(f => f.status === 'processing')
          .map(f => f.file_id)
      );
      setProcessingFiles(processing);
      
      componentLogger.info('Files loaded successfully', { 
        totalFiles: response.files.length,
        processingFiles: processing.size 
      });
    } catch (error) {
      componentLogger.error('Error loading files', { error });
      setError('Failed to load files. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []); // Remove componentLogger dependency to prevent infinite loop

  const loadStats = useCallback(async () => {
    try {
      componentLogger.debug('Loading processing stats');
      
      // Try cache first
      const cacheKey = CacheKeys.SYSTEM_INFO();
      const cachedStats = systemCache.get<ProcessingStats>(cacheKey);
      
      if (cachedStats) {
        componentLogger.debug('Stats loaded from cache');
        setStats(cachedStats);
        return;
      }
      
      const stats = await apiService.getParsingStats();
      
      // Ensure stats has required properties with defaults
      const safeStats: ProcessingStats = {
        total_files: stats?.total_files || 0,
        completed: stats?.completed || 0,
        processing: stats?.processing || 0,
        pending: stats?.pending || 0,
        error: stats?.error || 0,
        recent_activity: Array.isArray(stats?.recent_activity) ? stats.recent_activity : []
      };
      
      setStats(safeStats);
      
      // Cache the stats
      systemCache.set(cacheKey, safeStats, 60000); // 1 minute cache
      
      componentLogger.info('Processing stats loaded', { stats: safeStats });
    } catch (error) {
      componentLogger.error('Error loading stats', { error });
      
      // Set fallback stats to prevent crashes
      const fallbackStats: ProcessingStats = {
        total_files: 0,
        completed: 0,
        processing: 0,
        pending: 0,
        error: 0,
        recent_activity: []
      };
      setStats(fallbackStats);
    }
  }, []); // Remove componentLogger dependency to prevent infinite loop

  const parseFile = useCallback(async (fileId: string) => {
    try {
      componentLogger.userAction('parse_file_initiated', { fileId });
      setProcessingFiles(prev => new Set([...prev, fileId]));
      
      await apiService.parseResume(fileId);
      
      await loadFiles();
      await loadStats();
      
      // Invalidate cache
      CacheInvalidation.onUserAction();
      
      componentLogger.userAction('parse_file_completed', { fileId });
    } catch (error) {
      componentLogger.error('Error parsing file', { error, fileId });
      setProcessingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
      setError('Failed to parse file. Please try again.');
    }
  }, []); // Remove dependencies to prevent infinite loop

  const viewParsedResume = useCallback(async (fileId: string) => {
    try {
      componentLogger.userAction('view_resume', { fileId });
      
      // Try cache first
      const cacheKey = `parsed_resume_${fileId}`;
      const cachedResume = apiCache.get<ParsedResume>(cacheKey);
      
      if (cachedResume) {
        componentLogger.debug('Resume loaded from cache', { fileId });
        setSelectedResume(cachedResume);
        return;
      }
      
      const resume = await apiService.getParsedResume(fileId);
      setSelectedResume(resume);
      
      // Cache the resume
      apiCache.set(cacheKey, resume, 300000); // 5 minutes cache
      
      componentLogger.info('Resume viewed', { fileId, resumeId: resume.id });
    } catch (error) {
      componentLogger.error('Error loading parsed resume', { error, fileId });
      setError('Failed to load resume. Please try again.');
    }
  }, []); // Remove componentLogger dependency to prevent infinite loop

  const deleteFile = useCallback(async (fileId: string, filename: string) => {
    // Debug log to see which file is being deleted
    console.log('Delete file called for:', { fileId, filename });
    
    // Set the file to delete and open the confirmation dialog
    setFileToDelete({ id: fileId, name: filename });
    setDeleteConfirmationOpen(true);
  }, []);

  const confirmDeleteFile = useCallback(async () => {
    if (!fileToDelete) {
      console.warn('No file selected for deletion');
      return;
    }
    
    const { id: fileId, name: filename } = fileToDelete;
    console.log('Confirming delete for:', { fileId, filename });
    
    try {
      componentLogger.userAction('delete_file', { fileId });
      
      // Set loading state for this file
      setDeletingFiles(prev => new Set(prev).add(fileId));
      
      // Debug log before calling API
      console.log('Calling delete API for file:', fileId);
      await apiService.deleteFile(fileId);
      console.log('Delete API call completed for file:', fileId);
      
      await loadFiles();
      await loadStats();
      
      // Invalidate related caches
      CacheInvalidation.onUserAction();
      apiCache.delete(`parsed_resume_${fileId}`);
      
      componentLogger.userAction('file_deleted', { fileId });
    } catch (error: unknown) {
      // Check if it's a 404 error (file already deleted)
      if (error instanceof Error && error.message.includes('404')) {
        componentLogger.info('File already deleted', { fileId });
        // Refresh the file list to update UI
        await loadFiles();
        await loadStats();
        return;
      }
      
      componentLogger.error('Error deleting file', { error, fileId });
      setError('Failed to delete file. Please try again.');
    } finally {
      // Remove loading state for this file
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
      
      // Close the dialog and clear the file to delete
      setDeleteConfirmationOpen(false);
      setFileToDelete(null);
    }
  }, [fileToDelete, loadFiles, loadStats, componentLogger]);

  // Add state for cleanup loading
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [showCleanupConfirmation, setShowCleanupConfirmation] = useState(false);
  
  // Add cleanup function
  const cleanupOrphanedFiles = useCallback(async () => {
    // Open confirmation dialog instead of proceeding directly
    setShowCleanupConfirmation(true);
  }, []);

  const confirmCleanupOrphanedFiles = useCallback(async () => {
    try {
      componentLogger.userAction('cleanup_orphaned_files');
      setIsCleaningUp(true);
      
      const result = await apiService.cleanupOrphanedFiles();
      
      await loadFiles();
      await loadStats();
      
      // Invalidate all caches
      CacheInvalidation.onUserAction();
      
      componentLogger.userAction('cleanup_completed', { result });
      alert(result.message);
    } catch (error) {
      componentLogger.error('Error cleaning up orphaned files', { error });
      setError('Failed to clean up files. Please try again.');
    } finally {
      setIsCleaningUp(false);
      setShowCleanupConfirmation(false); // Close the dialog
    }
  }, []); // Remove dependencies to prevent infinite loop

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'processing': return <Clock className="w-4 h-4 animate-spin" />;
      case 'error': return <XCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number | string) => {
    // Handle both Unix timestamp (number) and ISO string
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleString();
    }
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-96 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <DashboardSkeleton 
          showStats={true}
          showCharts={false}
          showTable={true}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => {
            setError(null);
            setLoading(true);
            loadFiles();
            loadStats();
          }}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Resume Processing</h1>
            <p className="text-gray-600 mt-1">Manage uploaded resumes and parsed data</p>
          </div>
          <Button
            onClick={() => {
              componentLogger.userAction('back_button_clicked');
              router.back();
            }}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-2xl font-bold">{stats.total_files}</p>
                        <p className="text-sm text-gray-600">Total Files</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-2xl font-bold">{stats.completed}</p>
                        <p className="text-sm text-gray-600">Completed</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-2xl font-bold">{stats.processing}</p>
                        <p className="text-sm text-gray-600">Processing</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-2xl font-bold">{stats.error}</p>
                        <p className="text-sm text-gray-600">Errors</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Cleanup Button */}
            <div className="flex justify-end">
              <Button 
                onClick={cleanupOrphanedFiles} 
                variant="outline"
                disabled={isCleaningUp}
              >
                {isCleaningUp ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Cleaning Up...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clean Up Orphaned Files
                  </>
                )}
              </Button>
            </div>

            {/* Recent Files */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Files</CardTitle>
                <CardDescription>Latest uploaded and processed files</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {files.slice(0, 5).map((file) => (
                    <div key={file.file_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="font-medium">{file.original_filename}</p>
                          <p className="text-sm text-gray-600">{formatFileSize(file.file_size)}</p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(file.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(file.status)}
                          <span className="capitalize">{file.status}</span>
                        </div>
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Files</CardTitle>
                <CardDescription>Manage all uploaded resume files</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {files.map((file) => (
                    <div key={file.file_id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <FileText className="w-6 h-6 text-gray-500" />
                        <div>
                          <h3 className="font-medium">{file.original_filename}</h3>
                          <p className="text-sm text-gray-600">
                            {formatFileSize(file.file_size)} • Uploaded {formatDate(file.uploaded_at)}
                          </p>
                          {file.error_message && (
                            <p className="text-sm text-red-600 mt-1">{file.error_message}</p>
                          )}
                        </div>
                      </div>
                    
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusColor(file.status)}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(file.status)}
                            <span className="capitalize">{file.status}</span>
                          </div>
                        </Badge>
                      
                        <div className="flex space-x-2">
                          {file.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => parseFile(file.file_id)}
                              disabled={processingFiles.has(file.file_id)}
                            >
                              <Brain className="w-4 h-4 mr-2" />
                              Parse
                            </Button>
                          )}
                        
                          {file.status === 'completed' && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => viewParsedResume(file.file_id)}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>Parsed Resume: {file.original_filename}</DialogTitle>
                                  <DialogDescription>
                                    Extracted information from the resume
                                  </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="h-[60vh]">
                                  {selectedResume && (
                                    <ResumeViewer resume={selectedResume} />
                                  )}
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                          )}
                        
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteFile(file.file_id, file.original_filename)}
                            className="text-red-600 hover:text-red-700"
                            disabled={deletingFiles.has(file.file_id)}
                          >
                            {deletingFiles.has(file.file_id) ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                                Deleting...
                              </>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>

                        </div>
                      </div>
                    </div>
                  ))}
                
                  {files.length === 0 && (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No files uploaded yet</p>
                      <Button className="mt-4" onClick={() => window.location.href = '/upload'}>
                        Upload Resume
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={deleteConfirmationOpen} onOpenChange={(open) => {
            setDeleteConfirmationOpen(open);
            if (!open) setFileToDelete(null); // Clear file to delete when dialog is closed
          }}>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  {fileToDelete ? (
                    <>
                      Are you sure you want to delete &quot;<strong>{fileToDelete.name}</strong>&quot;? 
                      This action cannot be undone.
                    </>
                  ) : (
                    "Are you sure you want to delete this file? This action cannot be undone."
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setFileToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmDeleteFile}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Cleanup Confirmation Dialog */}
          <AlertDialog open={showCleanupConfirmation} onOpenChange={setShowCleanupConfirmation}>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle>Clean Up Orphaned Files</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all files that are no longer referenced in the system. 
                  This action cannot be undone. Are you sure you want to proceed?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmCleanupOrphanedFiles}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Clean Up
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest processing activity and system events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.recent_activity && Array.isArray(stats.recent_activity) && stats.recent_activity.map((activity, index) => (
                    <div key={`${activity.file_id}-${index}`} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      {getStatusIcon(activity.status)}
                      <div className="flex-1">
                        <p className="font-medium">{activity.filename}</p>
                        <p className="text-sm text-gray-600">
                          {activity.status === 'completed' ? 'Successfully parsed' : 
                           activity.status === 'error' ? 'Failed to parse' : 
                           'Processing...'}
                        </p>
                      </div>
                      {activity.parsed_at && (
                        <p className="text-sm text-gray-500">
                          {new Date(activity.parsed_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                
                  {(!stats || !stats.recent_activity || !Array.isArray(stats.recent_activity) || stats.recent_activity.length === 0) && (
                    <div className="text-center py-8">
                      <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No recent activity</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Resume Viewer Component
function ResumeViewer({ resume }: { resume: ParsedResume }) {
  return (
    <div className="space-y-6">
      {/* Contact Info */}
      {resume.contact_info && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resume.contact_info.name && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Name</label>
                  <p>{resume.contact_info.name}</p>
                </div>
              )}
              {resume.contact_info.email && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p>{resume.contact_info.email}</p>
                </div>
              )}
              {resume.contact_info.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Phone</label>
                  <p>{resume.contact_info.phone}</p>
                </div>
              )}
              {resume.contact_info.linkedin && (
                <div>
                  <label className="text-sm font-medium text-gray-600">LinkedIn</label>
                  <a href={resume.contact_info.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {resume.contact_info.linkedin}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Skills */}
      {resume.skills && resume.skills.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Skills</h3>
          <div className="space-y-3">
            {Object.entries(
              ((resume.skills as unknown as Skill[])).reduce((acc: Record<string, Skill[]>, skill: Skill) => {
                const category = skill.category || 'other';
                if (!acc[category]) acc[category] = [];
                acc[category].push(skill);
                return acc;
              }, {})
            ).map(([category, skills]) => (
              <div key={category} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 capitalize mb-2">{category}</h4>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill: Skill, index: number) => (
                    <Badge key={`${skill.name}-${index}`} variant="secondary">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {resume.work_experience && resume.work_experience.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Experience</h3>
          <div className="space-y-4">
            {resume.work_experience.map((exp, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{exp.job_title}</h4>
                    <p className="text-gray-600">{exp.company}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {exp.start_date} - {exp.end_date || 'Present'}
                  </div>
                </div>
                {exp.description && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-700 whitespace-pre-line">{exp.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {resume.education && resume.education.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Education</h3>
          <div className="space-y-4">
            {resume.education.map((edu, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium">{edu.degree}</h4>
                {edu.field_of_study && (
                  <p className="text-gray-600">{edu.field_of_study}</p>
                )}
                {edu.institution && (
                  <p className="text-gray-600">{edu.institution}</p>
                )}
                {edu.graduation_year && (
                  <p className="text-sm text-gray-500">{edu.graduation_year}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Main component wrapped with error boundary
export default function ProcessingPage() {
  useEffect(() => {
    logger.pageView('/processing');
  }, []);

  return (
    <ErrorBoundary
      errorBoundaryName="ProcessingPage"
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <ProcessingPageContent />
    </ErrorBoundary>
  );
}
