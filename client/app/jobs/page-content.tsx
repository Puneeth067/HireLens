'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
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
  Copy as DocumentDuplicateIcon,
  ArrowLeft
} from 'lucide-react';

import { JobDescriptionList, JobStats } from '@/lib/types';
import { cachedApiService } from '@/lib/cached-api';
import { useLogger, LoggerUtils } from '@/lib/logger';
import { useLoadingState } from '@/components/ui/page-wrapper';
import { Button } from '@/components/ui/button';
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

export default function JobsPageContent() {
  const router = useRouter();
  const logger = useLogger('JobsPage');
  const { loading, error, startLoading, stopLoading, setError, clearError } = useLoadingState('JobsPage');
  const pathname = usePathname();
  // Only use useSearchParams inside a client component
  const searchParams = useSearchParams();
  
  const [jobs, setJobs] = useState<JobDescriptionList | null>(null);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [jobToDelete, setJobToDelete] = useState<{ id: string; title: string } | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

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
  }, [logger]);

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
  }, [logger]);

  // Separate effect for initial load (run once)
  useEffect(() => {
    logger.lifecycle('mount');
    LoggerUtils.logPageChange('', 'jobs');
    
    // Load stats and companies only once
    if (!hasLoadedStatsRef.current) {
      loadStats();
    }
    loadCompanies();
    
    // Listen for job creation events
    const handleJobCreated = () => {
      // Reset to first page and reload jobs
      setCurrentPage(1);
      // Force immediate refresh
      setTimeout(() => {
        loadJobs();
        loadStats();
      }, 100);
    };
    
    // Listen for job update events
    const handleJobUpdated = () => {
      // Force immediate refresh
      setTimeout(() => {
        loadJobs();
        loadStats();
      }, 100);
    };
    
    // Listen for job delete events
    const handleJobDeleted = () => {
      // Force immediate refresh
      setTimeout(() => {
        loadJobs();
        loadStats();
      }, 100);
    };
    
    // Listen for general refresh events
    const handleJobListRefresh = () => {
      // Force immediate refresh
      setTimeout(() => {
        loadJobs();
        loadStats();
      }, 100);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('jobCreated', handleJobCreated);
      window.addEventListener('jobUpdated', handleJobUpdated);
      window.addEventListener('jobDeleted', handleJobDeleted);
      window.addEventListener('jobListRefresh', handleJobListRefresh);
    }
    
    // The refresh should only happen on user actions, not automatically every 5 seconds
    /*
    const pollingInterval = setInterval(() => {
      loadJobs();
      loadStats();
    }, 5000); // Poll every 5 seconds for more responsive updates
    */
    
    return () => {
      logger.lifecycle('unmount');
      if (typeof window !== 'undefined') {
        window.removeEventListener('jobCreated', handleJobCreated);
        window.removeEventListener('jobUpdated', handleJobUpdated);
        window.removeEventListener('jobDeleted', handleJobDeleted);
        window.removeEventListener('jobListRefresh', handleJobListRefresh);
      }
      // clearInterval(pollingInterval); // This line can also be removed since we're not using polling
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount
  
  // Effect to handle route changes and search param changes
  useEffect(() => {
    // This will run when pathname or searchParams change
    loadJobs();
    loadStats();
  }, [pathname, searchParams, loadJobs, loadStats]);

  // Separate effect for jobs (run when filters change)
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Add effect to handle window focus to refresh data when user returns to the page
  useEffect(() => {
    const handleWindowFocus = () => {
      // Refresh jobs and stats when window gains focus
      loadJobs();
      loadStats();
    };
    
    // Add event listener for window focus
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWindowFocus);
    }
    
    return () => {
      // Cleanup event listener
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWindowFocus);
      }
    };
  }, [loadJobs, loadStats]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    LoggerUtils.logSearch(searchTerm, undefined, { statusFilter, companyFilter });
    setCurrentPage(1);
    // loadJobs will be called automatically via useEffect when currentPage changes
  }, [searchTerm, statusFilter, companyFilter]);

  const handleDeleteJob = useCallback(async (jobId: string, jobTitle: string) => {
    // Set the job to delete and open the confirmation dialog
    setJobToDelete({ id: jobId, title: jobTitle });
    setShowDeleteConfirmation(true);
  }, []);

  const confirmDeleteJob = useCallback(async () => {
    if (!jobToDelete) return;
    
    const { id: jobId } = jobToDelete;
    
    try {
      LoggerUtils.logButtonClick('delete_job', { jobId });
      await cachedApiService.deleteJob(jobId);
      logger.info('Job deleted successfully', { jobId });
      
      // Dispatch a custom event to notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jobDeleted', { detail: { jobId } }));
        // Also dispatch a general refresh event
        window.dispatchEvent(new CustomEvent('jobListRefresh'));
      }
      
      // Force immediate refresh after a short delay
      setTimeout(() => {
        loadJobs();
        loadStats();
      }, 100);
    } catch (err) {
      logger.error('Failed to delete job', { jobId, error: err });
      alert('Failed to delete job');
    } finally {
      // Close the dialog and clear the job to delete
      setShowDeleteConfirmation(false);
      setJobToDelete(null);
    }
  }, [jobToDelete, loadJobs, loadStats, logger]);

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
      
      // Dispatch a general refresh event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jobListRefresh'));
      }
      
      // Force immediate refresh after a short delay
      setTimeout(() => {
        loadJobs();
        loadStats();
      }, 100);
    } catch (err) {
      logger.error('Failed to duplicate job', { jobId, error: err });
      alert('Failed to duplicate job');
    }
  }, [loadJobs, loadStats, logger]);

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

  // Wrap the component that uses useSearchParams in Suspense
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Job Descriptions</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage your job postings and requirements</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              LoggerUtils.logButtonClick('back_button_clicked');
              router.back();
            }}
            variant="outline"
            size="responsiveSm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Back</span>
          </Button>
          <Link
            href="/jobs/create"
            onClick={() => LoggerUtils.logButtonClick('create_job')}
            className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <PlusIcon className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Create Job</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BriefcaseIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Jobs</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.total_jobs}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <ClockIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Active Jobs</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.active_jobs}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DocumentDuplicateIcon className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Draft Jobs</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.draft_jobs}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BuildingOfficeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Recent Jobs</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.recent_jobs}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border mb-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Search Jobs
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, company, skills..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center text-sm"
            >
              <FunnelIcon className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Filters</span>
            </button>
            
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Search
            </button>
          </div>
        </form>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                title="Filter jobs by status"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Company
              </label>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                title="Filter jobs by company"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {jobs.jobs.map(job => (
              <div key={job.id} className="bg-white rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getJobTypeIcon(job.job_type)}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{job.title}</h3>
                    <p className="text-gray-600 text-sm">{job.company}</p>
                    {job.department && (
                      <p className="text-gray-500 text-xs">{job.department}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  <div className="flex items-center text-xs text-gray-600">
                    <BuildingOfficeIcon className="w-3 h-3 mr-1.5" />
                    {job.location}
                  </div>
                  <div className="flex items-center text-xs text-gray-600">
                    <BriefcaseIcon className="w-3 h-3 mr-1.5" />
                    {formatExperienceLevel(job.experience_level)} Level
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-500 mb-3">
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
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View job"
                    >
                      <EyeIcon className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href={`/jobs/${job.id}/edit`}
                      onClick={() => handleJobClick(job.id, 'edit')}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Edit job"
                    >
                      <PencilIcon className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => handleDuplicateJob(job.id)}
                      className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Duplicate job"
                    >
                      <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job.id, job.title)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete job"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>

        {/* Pagination */}
        {jobs && jobs.total_pages > 1 && (
          <div className="flex justify-center mt-6">
            <nav className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1.5 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-xs"
              >
                Previous
              </button>
              {Array.from({ length: jobs.total_pages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-2.5 py-1.5 rounded-md border text-xs ${
                    currentPage === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(jobs.total_pages, prev + 1))}
                disabled={currentPage === jobs.total_pages}
                className="px-2 py-1.5 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-xs"
              >
                Next
              </button>
            </nav>
          </div>
        )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {jobToDelete ? (
                <>
                  Are you sure you want to delete &quot;<strong>{jobToDelete.title}</strong>&quot;? 
                  This action cannot be undone.
                </>
              ) : (
                "Are you sure you want to delete this job? This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setJobToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteJob}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}