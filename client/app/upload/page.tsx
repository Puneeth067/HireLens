'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Users, FileText, Zap, XCircle } from 'lucide-react';
import FileUpload from '@/components/ui/file-upload';
import { UploadedFile } from '@/lib/types';
import { apiService } from '@/lib/api';
import ErrorBoundary from '@/components/error-boundary';
import { useLogger, logger } from '@/lib/logger';
import { apiCache, CacheInvalidation } from '@/lib/cache';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

function UploadPageContent() {
  const componentLogger = useLogger('UploadPage');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processingMode, setProcessingMode] = useState<'single' | 'bulk'>('single');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Performance tracking
  useEffect(() => {
    componentLogger.lifecycle('mount');
    logger.startPerformanceTimer('upload_page_load');
    
    return () => {
      componentLogger.lifecycle('unmount');
      logger.endPerformanceTimer('upload_page_load');
    };
  }, [componentLogger]);

  const handleFilesSelected = useCallback((files: UploadedFile[]) => {
    componentLogger.userAction('files_selected', { 
      fileCount: files.length,
      fileSizes: files.map(f => f.size || 0),
      fileNames: files.map(f => f.name || 'unknown')
    });
    
    setUploadedFiles(files);
    setError(null);
    
    // Auto-switch to bulk mode if multiple files
    if (files.length > 1) {
      setProcessingMode('bulk');
      componentLogger.userAction('processing_mode_auto_switched', { mode: 'bulk', fileCount: files.length });
    }
  }, [componentLogger]);

  const handleProcessingModeChange = useCallback((mode: 'single' | 'bulk') => {
    componentLogger.userAction('processing_mode_changed', { newMode: mode, previousMode: processingMode });
    setProcessingMode(mode);
  }, [componentLogger, processingMode]);

  const handleProcessResumes = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      setError('No files to process');
      return;
    }

    componentLogger.userAction('process_resumes_initiated', {
      fileCount: uploadedFiles.length,
      processingMode,
      fileIds: uploadedFiles.map(f => f.id)
    });
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Get file IDs from uploaded files
      const fileIds = uploadedFiles
        .filter(file => file.status === 'completed' && file.id)
        .map(file => file.id);
      
      if (fileIds.length === 0) {
        throw new Error('No successfully uploaded files found');
      }

      componentLogger.debug('Starting resume processing', {
        validFileIds: fileIds,
        processingMode,
        totalUploaded: uploadedFiles.length
      });

      // Parse the uploaded resumes
      if (processingMode === 'bulk' && fileIds.length > 1) {
        await apiService.parseBulkResumes(fileIds);
      } else {
        // Parse individually
        for (const fileId of fileIds) {
          await apiService.parseResume(fileId);
        }
      }

      // Invalidate related caches
      CacheInvalidation.onUserAction();
      
      componentLogger.userAction('process_resumes_completed', {
        fileCount: fileIds.length,
        processingMode
      });

      // Navigate to results page
      if (processingMode === 'bulk') {
        router.push('/processing?tab=resumes');
      } else {
        router.push('/processing');
      }
    } catch (error) {
      componentLogger.error('Processing failed', { 
        error, 
        fileCount: uploadedFiles.length,
        processingMode
      });
      setError('Processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedFiles, processingMode, router, componentLogger]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Header Skeleton */}
          <div className="text-center mb-12">
            <div className="h-10 w-96 bg-gray-200 rounded animate-pulse mx-auto mb-4"></div>
            <div className="h-6 w-128 bg-gray-200 rounded animate-pulse mx-auto"></div>
          </div>
          
          {/* Content Skeletons */}
          <div className="space-y-8">
            <CardSkeleton showHeader={true} showContent={true} lines={3} />
            <CardSkeleton showHeader={true} showContent={true} lines={4} />
            <CardSkeleton showHeader={true} showContent={true} lines={5} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setLoading(false);
              }}
            >
              Try Again
            </Button>
            <Button onClick={() => router.push('/')}>
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Upload Resume Files
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload candidate resumes to extract insights, analyze skills, and compare against job requirements
          </p>
        </div>

        {/* Processing Mode Selection */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing Mode</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => handleProcessingModeChange('single')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  processingMode === 'single'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Single Resume</div>
                    <div className="text-sm text-gray-500">Process one resume at a time</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleProcessingModeChange('bulk')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  processingMode === 'bulk'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Users className="w-6 h-6 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Bulk Processing</div>
                    <div className="text-sm text-gray-500">Process multiple resumes</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Files</h2>
          <FileUpload
            onFilesSelected={handleFilesSelected}
            maxFiles={processingMode === 'single' ? 1 : 20}
            multiple={processingMode === 'bulk'}
          />
        </div>

        {/* Processing Options */}
        {uploadedFiles.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing Options</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <div>
                    <div className="font-medium text-gray-900">Extract Skills & Experience</div>
                    <div className="text-sm text-gray-500">Parse technical skills, work experience, and education</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 text-blue-600 rounded"
                  aria-label="Extract Skills & Experience"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="font-medium text-gray-900">Generate Summary</div>
                    <div className="text-sm text-gray-500">Create AI-powered candidate summaries</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 text-blue-600 rounded"
                  aria-label="Generate Summary"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-purple-500" />
                  <div>
                    <div className="font-medium text-gray-900">Calculate ATS Scores</div>
                    <div className="text-sm text-gray-500">Score resumes against job descriptions</div>
                  </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 text-blue-600 rounded"
                  aria-label="Calculate ATS Scores"
                />
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => {
              componentLogger.userAction('back_button_clicked');
              router.back();
            }}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          
          <button
            onClick={handleProcessResumes}
            disabled={uploadedFiles.length === 0 || isProcessing}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Process Resumes</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <div className="text-blue-800 font-medium mb-2">Processing {uploadedFiles.length} resume(s)...</div>
            <div className="text-blue-600 text-sm">Extracting text, analyzing content, and generating insights</div>
            <div className="mt-4 bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full w-2/3 animate-pulse"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main component wrapped with error boundary
export default function UploadPage() {
  useEffect(() => {
    logger.pageView('/upload');
  }, [logger]);

  return (
    <ErrorBoundary
      errorBoundaryName="UploadPage"
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <UploadPageContent />
    </ErrorBoundary>
  );
}