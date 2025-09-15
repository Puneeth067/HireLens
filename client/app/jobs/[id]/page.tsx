// client/src/app/jobs/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Job } from '@/lib/types';
import { getJob, deleteJob } from '@/lib/api';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  const handleDelete = async () => {
    if (!job) return;
    
    setIsDeleting(true);
    try {
      await deleteJob(job.id);
      router.push('/jobs');
    } catch (err) {
      setError('Failed to delete job. Please try again.');
      console.error('Error deleting job:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatJobType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatExperienceLevel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1) + ' Level';
  };

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
          <Link
            href="/jobs"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Link
                  href="/jobs"
                  className="text-gray-500 hover:text-gray-700"
                >
                  ← Back to Jobs
                </Link>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{job.title}</h1>
              <div className="flex items-center gap-4 text-gray-600 mb-4">
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H7m2 0v-4a2 2 0 012-2h2a2 2 0 012 2v4" />
                  </svg>
                  {job.company}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {job.location}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatJobType(job.job_type)}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  {formatExperienceLevel(job.experience_level)}
                </span>
              </div>
              {(job.salary_min > 0 || job.salary_max > 0) && (
                <div className="text-lg font-semibold text-gray-900">
                  ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href={`/jobs/${job.id}/edit`}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
              >
                Edit Job
              </Link>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Description */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
              <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                {job.description}
              </div>
            </div>

            {/* Skills Requirements */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Skills Requirements</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.required_skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {job.preferred_skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Preferred Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {job.preferred_skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Job Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Job Type:</span>
                  <span className="text-gray-900">{formatJobType(job.job_type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Experience:</span>
                  <span className="text-gray-900">{formatExperienceLevel(job.experience_level)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="text-gray-900">{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Updated:</span>
                  <span className="text-gray-900">{new Date(job.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* ATS Scoring Weights */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">ATS Scoring Weights</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Skills:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${job.ats_weights.skills_weight}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{job.ats_weights.skills_weight}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Experience:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${job.ats_weights.experience_weight}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{job.ats_weights.experience_weight}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Education:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-600 h-2 rounded-full" 
                        style={{ width: `${job.ats_weights.education_weight}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{job.ats_weights.education_weight}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Keywords:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{ width: `${job.ats_weights.keywords_weight}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{job.ats_weights.keywords_weight}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href={`/compare?job=${job.id}`}
                  className="w-full px-4 py-2 bg-green-600 text-white text-center rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 block"
                >
                  Compare Resumes
                </Link>
                <button
                  onClick={() => navigator.share && navigator.share({
                    title: job.title,
                    text: `${job.title} at ${job.company}`,
                    url: window.location.href
                  })}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:ring-2 focus:ring-gray-500"
                >
                  Share Job
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-gray-900">Delete Job</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete &quot;{job.title}&quoat;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}