// client/src/app/jobs/[id]/edit/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import JobForm from '@/components/forms/job-form';
import { Job } from '@/lib/types';
import { apiService } from '@/lib/api';
import ErrorBoundary from '@/components/error-boundary';
import { useLogger, logger } from '@/lib/logger';
import { jobsCache, CacheKeys } from '@/lib/cache';
import { FormSkeleton } from '@/components/ui/skeleton';
import { XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function EditJobPageContent() {
  const componentLogger = useLogger('EditJobPage');
  const params = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Performance tracking
  useEffect(() => {
    componentLogger.lifecycle('mount');
    logger.startPerformanceTimer('edit_job_page_load');
    
    return () => {
      componentLogger.lifecycle('unmount');
      logger.endPerformanceTimer('edit_job_page_load');
    };
  }, [componentLogger]);

  const fetchJob = useCallback(async () => {
    try {
      if (!params.id) {
        setError('Job ID not provided');
        setLoading(false);
        return;
      }

      setError(null);
      componentLogger.debug('Loading job for editing', { jobId: params.id });
      
      // Try cache first
      const cacheKey = CacheKeys.JOB_DETAIL(params.id as string);
      const cachedJob = jobsCache.get<Job>(cacheKey);
      
      if (cachedJob) {
        componentLogger.debug('Job loaded from cache for editing', { jobId: params.id });
        setJob(cachedJob);
        setLoading(false);
        return;
      }
      
      const jobData = await apiService.getJob(params.id as string);
      setJob(jobData);
      
      // Cache the job data
      jobsCache.set(cacheKey, jobData, 300000); // 5 minutes cache
      
      componentLogger.info('Job loaded for editing', { 
        jobId: params.id, 
        jobTitle: jobData.title,
        company: jobData.company 
      });
    } catch (err) {
      componentLogger.error('Error fetching job for editing', { error: err, jobId: params.id });
      setError('Failed to load job details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [params.id, componentLogger]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header skeleton */}
            <div className="mb-8">
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-96 bg-gray-200 rounded animate-pulse"></div>
            </div>
            
            {/* Form skeleton */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <FormSkeleton fields={8} showActions={true} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-red-500 mb-4">
            {error ? (
              <XCircle className="h-12 w-12 mx-auto" />
            ) : (
              <AlertCircle className="h-12 w-12 mx-auto" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error ? 'Something went wrong' : 'Job not found'}
          </h2>
          <p className="text-gray-600 mb-4">{error || 'The job you are trying to edit does not exist.'}</p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchJob();
              }}
            >
              Try Again
            </Button>
            <Link href="/jobs">
              <Button>
                Back to Jobs
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8">
        <JobForm job={job} isEdit={true} />
      </div>
    </div>
  );
}

// Main component wrapped with error boundary
export default function EditJobPage() {
  useEffect(() => {
    logger.pageView('/jobs/[id]/edit');
  }, []);

  return (
    <ErrorBoundary
      errorBoundaryName="EditJobPage"
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <EditJobPageContent />
    </ErrorBoundary>
  );
}