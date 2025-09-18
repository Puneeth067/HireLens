// client/src/app/jobs/create/page.tsx
'use client';

import { useEffect } from 'react';
import JobForm from '@/components/forms/job-form';
import ErrorBoundary from '@/components/error-boundary';
import { useLogger, logger } from '@/lib/logger';

function CreateJobPageContent() {
  const componentLogger = useLogger('CreateJobPage');

  useEffect(() => {
    componentLogger.lifecycle('mount');
    componentLogger.userAction('create_job_page_visited');
    
    return () => {
      componentLogger.lifecycle('unmount');
    };
  }, [componentLogger]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8">
        <JobForm />
      </div>
    </div>
  );
}

// Main component wrapped with error boundary
export default function CreateJobPage() {
  useEffect(() => {
    logger.pageView('/jobs/create');
  }, []);

  return (
    <ErrorBoundary
      errorBoundaryName="CreateJobPage"
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <CreateJobPageContent />
    </ErrorBoundary>
  );
}