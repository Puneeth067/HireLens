'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { 
  PlusIcon, 
  SearchIcon as MagnifyingGlassIcon, 
  FuelIcon as FunnelIcon,
  BriefcaseIcon,
  BuildingIcon as BuildingOfficeIcon,
  ClockIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  Copy as DocumentDuplicateIcon
} from 'lucide-react';

import { JobDescriptionList, JobStats } from '@/lib/types';
import { cachedApiService } from '@/lib/cached-api';
import { useLogger, LoggerUtils } from '@/lib/logger';
import { LoadingWrapper, useLoadingState } from '@/components/ui/page-wrapper';
import { JobsPageSkeleton, AnalyticsCardSkeleton } from '@/components/ui/skeleton';
import ErrorBoundary from '@/components/error-boundary';


function JobsPageContent() {
  const logger = useLogger('JobsPage');
  const { loading, error, startLoading, stopLoading, setError, clearError } = useLoadingState('JobsPage');
  
  const [jobs, setJobs] = useState<JobDescriptionList | null>(null);
  const [stats, setStats] = useState<JobStats | null>(null);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Use refs to store stable references to loading functions
  const loadingFunctionsRef = useRef<{
    startLoading: () => void;
    stopLoading: () => void;
    setError: (error: string) => void;
    clearError: () => void;
  }>({ startLoading: () => {}, stopLoading: () => {}, setError: () => {}, clearError: () => {} });
  
  // Update refs when loading functions change
  React.useEffect(() => {
    loadingFunctionsRef.current = { startLoading, stopLoading, setError, clearError };
  }, [startLoading, stopLoading, setError, clearError]);

  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [companies, setCompanies] = useState<string[]>([]);
  const apiCall = async (endpoint: string, options?: RequestInit) => {
    const response = await fetch(`http://localhost:8000${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    return response.json();
  };

  const loadJobs = useCallback(async () => {
    try {
      loadingFunctionsRef.current.startLoading();
      loadingFunctionsRef.current.clearError();
      const params: {
        skip?: number;
        limit?: number;
        search?: string;
        status?: string;
        company?: string;
      } = {
        skip: (currentPage - 1) * 12,
        limit: 12
      };
      
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      if (companyFilter) params.company = companyFilter;
      
      logger.info('Loading jobs', { params });
      const data = await cachedApiService.getJobs(params);
      
      setJobs(data);
      logger.info('Jobs loaded successfully', { count: data.jobs?.length || 0 });
    } catch (err) {
      const errorMessage = 'Failed to load jobs';
      logger.error(errorMessage, { error: err });
      loadingFunctionsRef.current.setError(errorMessage);
    } finally {
      loadingFunctionsRef.current.stopLoading();
    }
  }, [currentPage, searchTerm, statusFilter, companyFilter]);

  // Use ref to ensure stable reference for one-time load
  const hasLoadedStatsRef = useRef(false);
  
  const loadStats = useCallback(async () => {
    try {
      logger.info('Loading job stats');
      const data = await cachedApiService.getJobStats();
      setStats(data);
      logger.info('Job stats loaded successfully');
      hasLoadedStatsRef.current = true;
    } catch (err) {
      logger.error('Error loading job stats', { error: err });
    }
  }, []);

  // Use ref to ensure stable reference for one-time load
  const hasLoadedCompaniesRef = useRef(false);
  
  const loadCompanies = useCallback(async () => {
    if (hasLoadedCompaniesRef.current) return;
    
    try {
      logger.info('Loading companies');
      // Note: Using a placeholder method - update with actual API when available
      const data = await cachedApiService.getJobs({ limit: 1000 });
      const uniqueCompanies = [...new Set(data.jobs.map(job => job.company).filter(Boolean))];
      setCompanies(uniqueCompanies);
      logger.info('Companies loaded successfully', { count: uniqueCompanies.length });
      hasLoadedCompaniesRef.current = true;
    } catch (err) {
      logger.error('Error loading companies', { error: err });
    }
  }, []);

  // Separate effect for initial load (run once)
  useEffect(() => {
    logger.lifecycle('mount');
    LoggerUtils.logPageChange('', 'jobs');
    
    // Load stats and companies only once
    if (!hasLoadedStatsRef.current) {
      loadStats();
    }
    loadCompanies();
    
    return () => {
      logger.lifecycle('unmount');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount
  
  // Separate effect for jobs (run when filters change)
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    LoggerUtils.logSearch(searchTerm, undefined, { statusFilter, companyFilter });
    setCurrentPage(1);
    // loadJobs will be called automatically via useEffect when currentPage changes
  }, [searchTerm, statusFilter, companyFilter]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job?')) return;
    
    try {
      LoggerUtils.logButtonClick('delete_job', { jobId });
      await cachedApiService.deleteJob(jobId);
      logger.info('Job deleted successfully', { jobId });
      loadJobs();
      loadStats();
    } catch (err) {
      logger.error('Failed to delete job', { jobId, error: err });
      alert('Failed to delete job');
    }
  }, [loadJobs, loadStats]);

  const handleDuplicateJob = useCallback(async (jobId: string) => {
    try {
      LoggerUtils.logButtonClick('duplicate_job', { jobId });
      // Direct API call for duplication since it's not in the main API service
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/jobs/${jobId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to duplicate job');
      }
      
      logger.info('Job duplicated successfully', { jobId });
      loadJobs();
      loadStats();
    } catch (err) {
      logger.error('Failed to duplicate job', { jobId, error: err });
      alert('Failed to duplicate job');
    }
  }, [loadJobs, loadStats]);

  // Enhanced click handlers with logging
  const handleJobClick = useCallback((jobId: string, action: string) => {
    LoggerUtils.logButtonClick(`job_${action}`, { jobId });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getJobTypeIcon = (jobType: string) => {
    switch (jobType) {
      case 'full_time': return '💼';
      case 'part_time': return '⏰';
      case 'contract': return '📝';
      case 'internship': return '🎓';
      case 'freelance': return '💻';
      default: return '💼';
    }
  };

  const formatExperienceLevel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1).replace('_', ' ');
  };

  return (
    <LoadingWrapper
      loading={loading}
      error={error}
      onRetry={loadJobs}
      skeleton={<JobsPageSkeleton />}
      componentName="JobsPage"
    >
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Job Descriptions</h1>
              <p className="text-gray-600 mt-1">Manage your job postings and requirements</p>
            </div>
            <Link
              href="/jobs/create"
              onClick={() => LoggerUtils.logButtonClick('create_job')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Create Job
            </Link>
          </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BriefcaseIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_jobs}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ClockIcon className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active_jobs}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <DocumentDuplicateIcon className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Draft Jobs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.draft_jobs}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BuildingOfficeIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Recent Jobs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.recent_jobs}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg p-6 shadow-sm border mb-8">
          <form onSubmit={handleSearch} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Jobs
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title, company, skills..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
            >
              <FunnelIcon className="w-5 h-5 mr-2" />
              Filters
            </button>
            
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  title="Filter jobs by status"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company
                </label>
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  title="Filter jobs by company"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Companies</option>
                  {companies.map(company => (
                    <option key={company} value={company}>{company}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Jobs Grid */}
        {jobs && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {jobs.jobs.map(job => (
                <div key={job.id} className="bg-white rounded-lg p-6 shadow-sm border hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getJobTypeIcon(job.job_type)}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{job.title}</h3>
                      <p className="text-gray-600 text-sm">{job.company}</p>
                      {job.department && (
                        <p className="text-gray-500 text-sm">{job.department}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <BuildingOfficeIcon className="w-4 h-4 mr-2" />
                      {job.location}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <BriefcaseIcon className="w-4 h-4 mr-2" />
                      {formatExperienceLevel(job.experience_level)} Level
                    </div>
                  </div>

                  <div className="flex justify-between text-sm text-gray-500 mb-4">
                    <span>{job.required_skills_count} Required Skills</span>
                    <span>{job.total_requirements} Requirements</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                      Updated {new Date(job.updated_at).toLocaleDateString()}
                    </p>
                    
                    <div className="flex gap-1">
                      <Link
                        href={`/jobs/${job.id}`}
                        onClick={() => handleJobClick(job.id, 'view')}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View job"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/jobs/${job.id}/edit`}
                        onClick={() => handleJobClick(job.id, 'edit')}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Edit job"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDuplicateJob(job.id)}
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Duplicate job"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete job"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {jobs.jobs.length === 0 && (
              <div className="text-center py-12">
                <BriefcaseIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm || statusFilter || companyFilter 
                    ? "Try adjusting your search filters"
                    : "Get started by creating your first job description"
                  }
                </p>
                <Link
                  href="/jobs/create"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Create Job
                </Link>
              </div>
            )}

            {/* Pagination */}
            {jobs.total_pages > 1 && (
              <div className="flex justify-center items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                
                <div className="flex space-x-1">
                  {Array.from({ length: Math.min(5, jobs.total_pages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 text-sm rounded-lg ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(jobs.total_pages, prev + 1))}
                  disabled={currentPage === jobs.total_pages}
                  className="px-3 py-2 text-sm bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </LoadingWrapper>
  );
}

// Main JobsPage component with error boundary
export default function JobsPage() {
  return (
    <ErrorBoundary
      errorBoundaryName="JobsPage"
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <JobsPageContent />
    </ErrorBoundary>
  );
}
