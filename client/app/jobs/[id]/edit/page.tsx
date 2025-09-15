// client/src/app/jobs/[id]/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import JobForm from '@/components/forms/job-form';
import { Job } from '@/lib/types';
import { getJob } from '@/lib/api';

export default function EditJobPage() {
  const params = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        if (params.id) {
          const jobData = await getJob(params.id as string);
          setJob(jobData);
        }
      } catch (err) {
        setError('Failed to load job details. Please try again.');
        console.error('Error fetching job:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">{error || 'Job not found'}</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Back
          </button>
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