'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, Briefcase, Zap, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import { JobDescriptionResponse, ParsedResume } from '@/lib/types';
import { apiService } from '@/lib/api';

interface ComparisonMode {
  id: 'single' | 'bulk';
  title: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export default function CreateComparisonPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'single' | 'bulk' | null>(null);
  const [jobs, setJobs] = useState<JobDescriptionResponse[]>([]);
  const [resumes, setResumes] = useState<ParsedResume[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedResumeIds, setSelectedResumeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modes: ComparisonMode[] = [
    {
      id: 'single',
      title: 'Single Comparison',
      description: 'Compare one resume against a job description for detailed analysis',
      icon: Users
    },
    {
      id: 'bulk',
      title: 'Bulk Comparison',
      description: 'Compare multiple resumes against a job description to find the best candidates',
      icon: Briefcase
    }
  ];

  useEffect(() => {
    loadData();
    
    // Set up periodic refresh to prevent stale data
    const interval = setInterval(() => {
      if (!creating) {
        loadData();
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [creating]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [jobsRes, resumesRes] = await Promise.all([
        apiService.getJobs({ limit: 1000, status: 'active' }),
        apiService.getParsedResumes()
      ]);
      
      // Further validate that each resume actually exists and is accessible
      const validatedResumes = [];
      const validationErrors = [];
      
      for (const resume of resumesRes) {
        try {
          // Try to fetch the individual resume to ensure it's accessible
          await apiService.getParsedResume(resume.id);
          validatedResumes.push(resume);
        } catch (error) {
          console.warn(`Resume ${resume.id} failed validation:`, error);
          validationErrors.push(resume.id);
        }
      }
      
      if (validationErrors.length > 0) {
        console.log(`Filtered out ${validationErrors.length} invalid resumes`);
      }
      
      setJobs(jobsRes.jobs);
      setResumes(validatedResumes.filter(r => r.parsing_status === 'completed'));
      
      // Clean up selected resumes that no longer exist
      const validResumeIds = new Set(validatedResumes.map(r => r.id));
      setSelectedResumeIds(prev => prev.filter(id => validResumeIds.has(id)));
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load jobs or resumes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResumeToggle = (resumeId: string) => {
    setSelectedResumeIds(prev => {
      if (mode === 'single') {
        return [resumeId];
      } else {
        return prev.includes(resumeId)
          ? prev.filter(id => id !== resumeId)
          : [...prev, resumeId];
      }
    });
  };

  const createComparisons = async () => {
    if (!selectedJobId || selectedResumeIds.length === 0) return;

    try {
      setCreating(true);
      setError(null);
      setProgress({ completed: 0, total: selectedResumeIds.length });

      // Validate that all selected resumes still exist before creating comparisons
      const validResumeIds = [];
      const invalidResumeIds = [];
      
      for (const resumeId of selectedResumeIds) {
        try {
          await apiService.getParsedResume(resumeId);
          validResumeIds.push(resumeId);
        } catch (error) {
          console.warn(`Resume ${resumeId} is no longer available:`, error);
          invalidResumeIds.push(resumeId);
        }
      }
      
      if (invalidResumeIds.length > 0) {
        // Update the selected resumes list to remove invalid ones
        setSelectedResumeIds(validResumeIds);
        
        if (validResumeIds.length === 0) {
          // No valid resumes left
          await loadData(); // Refresh all data
          throw new Error('All selected resumes are no longer available. The resume list has been refreshed.');
        } else {
          // Some resumes are invalid, but we can proceed with valid ones
          setError(`Some selected resumes (${invalidResumeIds.length}) are no longer available and have been removed from selection.`);
        }
      }

      if (mode === 'single') {
        // Double-check the single resume still exists
        try {
          await apiService.getParsedResume(validResumeIds[0]);
        } catch (error) {
          await loadData();
          throw new Error('The selected resume is no longer available. The resume list has been refreshed.');
        }
        
        const comparison = await apiService.createComparison({
          job_id: selectedJobId,
          resume_id: validResumeIds[0]
        });
        router.push(`/comparisons/${comparison.id}`);
      } else {
        if (validResumeIds.length === 0) {
          throw new Error('No valid resumes selected for bulk comparison.');
        }
        
        const response = await apiService.createBulkComparisons({
          job_id: selectedJobId,
          resume_ids: validResumeIds
        });

        // Poll for completion status
        const checkProgress = async () => {
          try {
            const status = await apiService.getBatchStatus(response.batch_id);
            setProgress({
              completed: status.completed_count,
              total: status.total_count
            });

            if (status.status === 'completed') {
              router.push(`/comparisons?job_id=${selectedJobId}`);
            } else if (status.status === 'failed') {
              throw new Error('Batch processing failed');
            } else {
              setTimeout(checkProgress, 2000);
            }
          } catch (error) {
            console.error('Error checking progress:', error);
            setError('Failed to process batch comparisons. Please try again.');
            setCreating(false);
          }
        };

        checkProgress();
      }
    } catch (error) {
      console.error('Error creating comparisons:', error);
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Resume not found')) {
          // Refresh the resume list since some resumes may have been deleted
          await loadData();
          setError('Some selected resumes are no longer available. The resume list has been refreshed. Please select resumes again.');
        } else if (error.message.includes('Job not found')) {
          // Refresh the job list since the job may have been deleted
          await loadData();
          setError('The selected job is no longer available. The job list has been refreshed. Please select a job again.');
        } else {
          setError(error.message);
        }
      } else {
        setError('Failed to create comparisons. Please try again.');
      }
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <button
            onClick={() => router.push('/comparisons')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
            title='Back to Comparisons'
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Comparison</h1>
            <p className="text-gray-600 mt-1">Compare resumes against job descriptions using ATS scoring</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <h3 className="text-red-800 font-medium">Error</h3>
            </div>
            <p className="text-red-700 mt-2 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-3 text-red-700 hover:text-red-900 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {creating && progress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <div className="flex items-center mb-4">
              <Zap className="h-5 w-5 text-blue-600 animate-pulse mr-2" />
              <h3 className="text-lg font-medium text-blue-900">Processing Comparisons</h3>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
              <div
                className={`bg-blue-600 h-2 rounded-full transition-all duration-300 w-[${(progress.completed / progress.total) * 100}%]`}
              ></div>
            </div>
            <p className="text-blue-700 text-sm">
              {progress.completed} of {progress.total} comparisons completed
            </p>
          </div>
        )}

        {/* Mode Selection */}
        {!mode && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Choose Comparison Mode</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {modes.map((modeOption) => {
                const Icon = modeOption.icon;
                return (
                  <button
                    key={modeOption.id}
                    onClick={() => setMode(modeOption.id)}
                    className="text-left p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center mb-4">
                      <Icon className="h-8 w-8 text-blue-600" />
                      <h3 className="text-lg font-medium text-gray-900 ml-3">{modeOption.title}</h3>
                    </div>
                    <p className="text-gray-600">{modeOption.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Job Selection */}
        {mode && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Job Description</h2>
              {jobs.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No active jobs found</h3>
                  <p className="text-gray-600 mb-4">You need to create a job description first.</p>
                  <button
                    onClick={() => router.push('/jobs/create')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Create Job Description
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedJobId === job.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{job.title}</h3>
                          <p className="text-sm text-gray-600">{job.company} • {job.location}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {job.required_skills_count || 0} required skills • 
                            {job.total_requirements || 0} total requirements
                          </p>
                        </div>
                        {selectedJobId === job.id && (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resume Selection */}
            {selectedJobId && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Select Resume{mode === 'bulk' ? 's' : ''}
                  </h2>
                  <div className="flex items-center space-x-3">
                    {mode === 'bulk' && selectedResumeIds.length > 0 && (
                      <span className="text-sm text-gray-600">
                        {selectedResumeIds.length} selected
                      </span>
                    )}
                    <button
                      onClick={loadData}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                      disabled={loading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                </div>

                {resumes.length === 0 ? (
                  <div className="text-center py-8">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No parsed resumes found</h3>
                    <p className="text-gray-600 mb-4">You need to upload and parse some resumes first.</p>
                    <button
                      onClick={() => router.push('/upload')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      Upload Resumes
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {resumes.map((resume) => (
                      <div
                        key={resume.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedResumeIds.includes(resume.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleResumeToggle(resume.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">
                              {resume.contact_info?.name || resume.filename}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {resume.contact_info?.email || 'No email provided'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {resume.skills?.length || 0} skills • 
                              {resume.work_experience?.length || 0} work experiences • 
                              {resume.education?.length || 0} education entries
                            </p>
                          </div>
                          {selectedResumeIds.includes(resume.id) && (
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {selectedJobId && selectedResumeIds.length > 0 && (
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setMode(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  disabled={creating}
                >
                  Back to Mode Selection
                </button>
                <button
                  onClick={createComparisons}
                  disabled={creating}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      <span>
                        Create {mode === 'single' ? 'Comparison' : `${selectedResumeIds.length} Comparisons`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}