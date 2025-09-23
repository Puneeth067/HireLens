'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ErrorBoundary from '@/components/error-boundary';
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
} from "@/components/ui/alert-dialog"
import { 
  Users, BarChart3, Trophy, Clock, Search, Filter, 
  Download, XCircle, Trash2, ArrowLeft, RefreshCw
} from 'lucide-react';
import apiService from '@/lib/api';
import { logger, useLogger } from '@/lib/logger';
import { jobsCache, comparisonsCache, CacheKeys } from '@/lib/cache';
import { ComparisonStats, ComparisonFilters, ResumeJobComparison, JobDescriptionResponse } from '@/lib/types';

function ComparisonsPageContent() {
  const router = useRouter();
  const componentLogger = useLogger('ComparisonsPage');
  const [comparisons, setComparisons] = useState<ResumeJobComparison[]>([]);
  const [stats, setStats] = useState<ComparisonStats | null>(null);
  const [jobs, setJobs] = useState<JobDescriptionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noComparisons, setNoComparisons] = useState(false);
  const [filters, setFilters] = useState<ComparisonFilters>({
    status: 'all',
    job_id: 'all',
    min_score: 0,
    max_score: 100,
    search: '',
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteAllConfirmationOpen, setDeleteAllConfirmationOpen] = useState(false);
  const [comparisonToDelete, setComparisonToDelete] = useState<string | null>(null);

  // Refs to track if data has been loaded to prevent infinite loops
  const hasLoadedData = useRef(false);
  const filtersRef = useRef(filters);
  const currentPageRef = useRef(currentPage);
  const forceRefreshRef = useRef(false);

  // Performance tracking
  useEffect(() => {
    componentLogger.lifecycle('mount');
    logger.startPerformanceTimer('comparisons_page_load');
    
    return () => {
      componentLogger.lifecycle('unmount');
      logger.endPerformanceTimer('comparisons_page_load');
    };
  }, [componentLogger]);

  const loadData = useCallback(async () => {
    // Prevent infinite loops by checking if filters or page actually changed
    const filtersChanged = JSON.stringify(filtersRef.current) !== JSON.stringify(filters);
    const pageChanged = currentPageRef.current !== currentPage;
    
    // Always load fresh data when resetAllData is called, regardless of filters/page changes
    if (!filtersChanged && !pageChanged && hasLoadedData.current && !forceRefreshRef.current) {
      return;
    }
    
    // Update refs
    filtersRef.current = filters;
    currentPageRef.current = currentPage;
    hasLoadedData.current = true;
    forceRefreshRef.current = false;

    try {
      setLoading(true);
      setError(null);
      setNoComparisons(false);
      
      componentLogger.debug('Loading comparisons data', {
        page: currentPage,
        filters: filters
      });
      
      // Try cache for jobs first, but always fetch fresh comparison data
      const jobsCacheKey = CacheKeys.JOBS_LIST(1, 'all');
      const statsCacheKey = CacheKeys.ANALYTICS_OVERVIEW();
      
      const cachedJobs = jobsCache.get<{ jobs: JobDescriptionResponse[] }>(jobsCacheKey);
      
      // ALWAYS fetch fresh comparison data to avoid cache inconsistencies
      const comparisonsRes = await apiService.getComparisons({
        page: currentPage,
        limit: 12,
        status: filters.status !== 'all' ? filters.status : undefined,
        job_id: filters.job_id !== 'all' ? filters.job_id : undefined,
        min_score: filters.min_score,
        max_score: filters.max_score,
        search: filters.search || undefined,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order as 'asc' | 'desc'
      });
      
      setComparisons(comparisonsRes.comparisons);
      setTotalPages(Math.ceil(comparisonsRes.total / 12));
      
      // Check if there are no comparisons
      if (comparisonsRes.total === 0) {
        setNoComparisons(true);
      }
      
      // ALWAYS fetch fresh stats to avoid cache inconsistencies
      try {
        componentLogger.debug('Fetching fresh comparison stats from API');
        const statsRes = await apiService.getComparisonStats();
        componentLogger.debug('Received fresh comparison stats', statsRes);
        setStats(statsRes);
        // Cache the fresh stats for a short period
        comparisonsCache.set(statsCacheKey, statsRes, 30000); // 30 seconds cache
      } catch (statsError) {
        // Handle case when there are no comparisons yet
        componentLogger.warn('Failed to load stats, using default values', { error: statsError });
        setStats({
          total_comparisons: 0,
          avg_score: 0,
          top_score: 0,
          recent_comparisons: 0,
          status_breakdown: {}
        });
      }
      
      // Load jobs if not cached or if reset was requested
      if (!cachedJobs || forceRefreshRef.current) {
        const jobsRes = await apiService.getJobs({ limit: 1000 });
        setJobs(jobsRes.jobs);
        jobsCache.set(jobsCacheKey, jobsRes, 300000); // 5 minutes cache
      } else {
        setJobs(cachedJobs.jobs);
      }
      
      componentLogger.info('Comparisons data loaded', {
        comparisonsCount: comparisonsRes.comparisons.length,
        totalComparisons: comparisonsRes.total,
        page: currentPage,
        fromCache: { jobs: !!cachedJobs }
      });
    } catch (error) {
      componentLogger.error('Error loading comparisons', { error, filters, page: currentPage });
      setError('Failed to load comparisons. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, componentLogger]);

  // Use effect with proper dependency management
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = useCallback((key: keyof ComparisonFilters, value: string | number) => {
    componentLogger.userAction('filter_changed', { filterKey: key, filterValue: value });
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  }, [componentLogger]);

  const resetFilters = useCallback(() => {
    componentLogger.userAction('filters_reset');
    setFilters({
      status: 'all',
      job_id: 'all',
      min_score: 0,
      max_score: 100,
      search: '',
      sort_by: 'created_at',
      sort_order: 'desc'
    });
    setCurrentPage(1);
  }, [componentLogger]);

  const exportComparisons = useCallback(async () => {
    try {
      componentLogger.userAction('export_comparisons_initiated', { filters });
      const blob = await apiService.exportComparisons(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comparisons-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      componentLogger.userAction('export_comparisons_completed');
    } catch (error) {
      componentLogger.error('Error exporting comparisons', { error, filters });
    }
  }, [componentLogger, filters]);

  const handleDeleteComparison = useCallback(async (comparisonId: string) => {
    try {
      componentLogger.userAction('delete_comparison_initiated', { comparisonId });
      await apiService.deleteComparison(comparisonId);
      
      // Remove the deleted comparison from the state
      setComparisons(prev => prev.filter(comp => comp.id !== comparisonId));
      
      // Update stats if they exist
      if (stats) {
        setStats({
          ...stats,
          total_comparisons: stats.total_comparisons - 1
        });
      }
      
      // Also update the total pages if needed
      const newTotal = (stats?.total_comparisons || 1) - 1;
      const newTotalPages = Math.ceil(newTotal / 12);
      setTotalPages(newTotalPages);
      
      // If we're on a page that no longer exists, go to the previous page
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
      
      // Clear cached stats to ensure fresh data on next load
      const statsCacheKey = CacheKeys.ANALYTICS_OVERVIEW();
      comparisonsCache.delete(statsCacheKey);
      
      componentLogger.userAction('delete_comparison_completed', { comparisonId });
    } catch (error) {
      componentLogger.error('Error deleting comparison', { error, comparisonId });
      alert('Failed to delete comparison. Please try again.');
    }
  }, [componentLogger, stats, currentPage]);

  const resetAllData = useCallback(async () => {
    try {
      componentLogger.userAction('reset_all_data_initiated');
      
      // Clear all caches to ensure fresh data
      comparisonsCache.clear();
      jobsCache.clear();
      
      // Also clear any cached stats
      const statsCacheKey = CacheKeys.ANALYTICS_OVERVIEW();
      comparisonsCache.delete(statsCacheKey);
      
      // Reset filters
      resetFilters();
      
      // Set force refresh flag
      forceRefreshRef.current = true;
      
      // Reload data
      hasLoadedData.current = false;
      await loadData();
      
      componentLogger.userAction('reset_all_data_completed');
    } catch (error) {
      componentLogger.error('Error resetting all data', { error });
      alert('Failed to reset data. Please try again.');
    }
  }, [componentLogger, loadData, resetFilters]);

  const deleteAllComparisons = useCallback(async () => {
    try {
      componentLogger.userAction('delete_all_comparisons_initiated');
      
      // Set state to open the delete all confirmation dialog
      setDeleteAllConfirmationOpen(true);
    } catch (error) {
      componentLogger.error('Error deleting all comparisons', { error });
      alert('Failed to delete all comparisons. Please try again.');
    }
  }, [componentLogger]);

  const confirmDeleteAllComparisons = useCallback(async () => {
    try {
      // Close the dialog
      setDeleteAllConfirmationOpen(false);
      
      // Delete all comparisons
      const result = await apiService.deleteAllComparisons();
      
      // Clear all caches to ensure fresh data
      comparisonsCache.clear();
      jobsCache.clear();
      
      // Also clear any cached stats
      const statsCacheKey = CacheKeys.ANALYTICS_OVERVIEW();
      comparisonsCache.delete(statsCacheKey);
      
      // Reset filters
      resetFilters();
      
      // Set force refresh flag
      forceRefreshRef.current = true;
      
      // Reload data
      hasLoadedData.current = false;
      await loadData();
      
      componentLogger.userAction('delete_all_comparisons_completed', { deletedCount: result.deleted_count });
      alert(`Successfully deleted ${result.deleted_count} comparisons.`);
    } catch (error) {
      componentLogger.error('Error deleting all comparisons', { error });
      alert('Failed to delete all comparisons. Please try again.');
    }
  }, [componentLogger, loadData, resetFilters]);


  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setLoading(true);
                hasLoadedData.current = false; // Reset the loaded flag to allow reload
                loadData();
              }}
            >
              Try Again
            </Button>
            <Button onClick={resetAllData} variant="outline">
              Refresh Data
            </Button>
            <Button onClick={() => window.location.href = '/'}>
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Resume Comparisons</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Compare candidates against job requirements</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                componentLogger.userAction('back_button_clicked');
                router.back();
              }}
              variant="outline"
              size="responsiveSm"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Back</span>
            </Button>
            <Button
              onClick={deleteAllComparisons}
              variant="outline"
              size="responsiveSm"
              className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden xs:inline">Delete All</span>
            </Button>
            <Button
              onClick={resetAllData}
              variant="outline"
              size="responsiveSm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden xs:inline">Refresh All</span>
            </Button>
            <Link
              href="/comparisons/create"
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <BarChart3 className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">New Comparison</span>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center">
                <Users className="h-6 w-6 text-blue-600" />
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Total Comparisons</p>
                  <p className="text-lg font-bold text-gray-900">{stats.total_comparisons}</p>
                  <p className="text-xs text-gray-500">Active: {(stats.status_breakdown?.completed || 0) + (stats.status_breakdown?.pending || 0)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center">
                <BarChart3 className="h-6 w-6 text-green-600" />
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Average Score</p>
                  <p className="text-lg font-bold text-gray-900">{stats.avg_score.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500">Completed: {stats.status_breakdown?.completed || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center">
                <Trophy className="h-6 w-6 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Top Score</p>
                  <p className="text-lg font-bold text-gray-900">{stats.top_score.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500">Pending: {stats.status_breakdown?.pending || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center">
                <Clock className="h-6 w-6 text-purple-600" />
                <div className="ml-3">
                  <p className="text-xs font-medium text-gray-600">Recent (7 days)</p>
                  <p className="text-lg font-bold text-gray-900">{stats.recent_comparisons}</p>
                  <p className="text-xs text-gray-500">Failed: {stats.status_breakdown?.failed || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by resume name or job title..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  componentLogger.userAction('filters_toggled', { showFilters: !showFilters });
                  setShowFilters(!showFilters);
                }}
                className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 text-sm"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden xs:inline">Filters</span>
              </button>
              <button
                onClick={exportComparisons}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm"
              >
                <Download className="h-4 w-4" />
                <span className="hidden xs:inline">Export</span>
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    aria-label='Select status filter'
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Job</label>
                  <select
                    value={filters.job_id}
                    onChange={(e) => handleFilterChange('job_id', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    aria-label='Select job filter'
                  >
                    <option value="all">All Jobs</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>{job.title} - {job.company}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Min Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.min_score}
                    onChange={(e) => handleFilterChange('min_score', parseInt(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    aria-label='Minimum score filter'
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Max Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.max_score}
                    onChange={(e) => handleFilterChange('max_score', parseInt(e.target.value) || 100)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    aria-label='Select maximum score filter'
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-3">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={filters.sort_by}
                    onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    aria-label='Select sort by filter'
                  >
                    <option value="created_at">Sort by Date</option>
                    <option value="overall_score">Sort by Score</option>
                    <option value="resume_name">Sort by Resume</option>
                  </select>
                  <select
                    value={filters.sort_order}
                    onChange={(e) => handleFilterChange('sort_order', e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    aria-label='Select sort order filter'
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
                <button
                  onClick={resetFilters}
                  className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Comparisons Grid */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : noComparisons ? (
          <div className="bg-white rounded-lg shadow-sm p-6 sm:p-12 text-center">
            <BarChart3 className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No comparisons found</h3>
            <p className="text-gray-600 mb-4 text-sm sm:text-base">Create comparisons by matching resumes with job descriptions.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/jobs"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base text-center"
              >
                View Jobs
              </Link>
              <Link
                href="/upload"
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm sm:text-base text-center"
              >
                Upload Resumes
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {comparisons.map((comparison) => (
              <div key={comparison.id} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base">{comparison.candidate_name || comparison.resume_filename}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{comparison.job_title}</p>
                    <p className="text-xs text-gray-500">{comparison.company}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(comparison.status)}`}>
                    {comparison.status}
                  </span>
                </div>
                
                {comparison.status === 'completed' && comparison.ats_score && (
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-700">ATS Score</span>
                      <span className={`text-base font-bold px-2 py-1 rounded ${getScoreColor(comparison.ats_score.overall_score)}`}>
                        {comparison.ats_score.overall_score.toFixed(1)}%
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Skills:</span>
                        <span>{comparison.ats_score.skills_score.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Experience:</span>
                        <span>{comparison.ats_score.experience_score.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Education:</span>
                        <span>{comparison.ats_score.education_score.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Keywords:</span>
                        <span>{comparison.ats_score.keywords_score.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{new Date(comparison.created_at).toLocaleDateString()}</span>
                  <div className="flex gap-2">
                    <Link
                      href={`/comparisons/${comparison.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Details →
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setComparisonToDelete(comparison.id);
                        setDeleteConfirmationOpen(true);
                      }}
                      className="text-red-600 hover:text-red-800"
                      title="Delete comparison"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the comparison
                and remove it from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setComparisonToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (comparisonToDelete) {
                    handleDeleteComparison(comparisonToDelete);
                    setComparisonToDelete(null);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete All Confirmation Dialog */}
        <AlertDialog open={deleteAllConfirmationOpen} onOpenChange={setDeleteAllConfirmationOpen}>
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete ALL comparisons
                and remove them from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteAllConfirmationOpen(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDeleteAllComparisons}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center">
            <nav className="flex items-center space-x-1 sm:space-x-2">
              <button
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  componentLogger.userAction('pagination_previous', { currentPage, newPage });
                  setCurrentPage(newPage);
                }}
                disabled={currentPage === 1}
                className="px-2 py-1 sm:px-3 sm:py-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-xs sm:text-sm"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => {
                    componentLogger.userAction('pagination_page_clicked', { currentPage, newPage: page });
                    setCurrentPage(page);
                  }}
                  className={`px-2 py-1 sm:px-3 sm:py-2 rounded-md border text-xs sm:text-sm ${
                    currentPage === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => {
                  const newPage = Math.min(totalPages, currentPage + 1);
                  componentLogger.userAction('pagination_next', { currentPage, newPage });
                  setCurrentPage(newPage);
                }}
                disabled={currentPage === totalPages}
                className="px-2 py-1 sm:px-3 sm:py-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-xs sm:text-sm"
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}

// Main component wrapped with error boundary
export default function ComparisonsPage() {
  useEffect(() => {
    logger.pageView('/comparisons');
  }, []);

  return (
    <ErrorBoundary
      errorBoundaryName="ComparisonsPage"
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <ComparisonsPageContent />
    </ErrorBoundary>
  );
}