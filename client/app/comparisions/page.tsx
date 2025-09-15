'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, BarChart3, Users, Trophy, Clock } from 'lucide-react';
import { ResumeJobComparison, Job } from '@/lib/types';
import { apiService } from '@/lib/api';

interface ComparisonStats {
  total_comparisons: number;
  avg_score: number;
  top_score: number;
  recent_comparisons: number;
  status_breakdown: Record<string, number>;
}

interface ComparisonFilters {
  status: string;
  job_id: string;
  min_score: number;
  max_score: number;
  search: string;
  sort_by: string;
  sort_order: string;
}

export default function ComparisonsPage() {
  const [comparisons, setComparisons] = useState<ResumeJobComparison[]>([]);
  const [stats, setStats] = useState<ComparisonStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [comparisonsRes, statsRes, jobsRes] = await Promise.all([
        apiService.getComparisons({
          page: currentPage,
          limit: 12,
          status: filters.status !== 'all' ? filters.status : undefined,
          job_id: filters.job_id !== 'all' ? filters.job_id : undefined,
          min_score: filters.min_score,
          max_score: filters.max_score,
          search: filters.search || undefined,
          sort_by: filters.sort_by,
          sort_order: filters.sort_order as 'asc' | 'desc'
        }),
        apiService.getComparisonStats(),
        apiService.getJobs({ limit: 1000 })
      ]);

      setComparisons(comparisonsRes.comparisons);
      setTotalPages(Math.ceil(comparisonsRes.total / 12));
      setStats(statsRes);
      setJobs(jobsRes.jobs);
    } catch (error) {
      console.error('Error loading comparisons:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (key: keyof ComparisonFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
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
  };

  const exportComparisons = async () => {
    try {
      const blob = await apiService.exportComparisons(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comparisons-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting comparisons:', error);
    }
  };

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Resume Comparisons</h1>
          <p className="text-gray-600 mt-2">View and manage ATS scoring results</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Comparisons</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_comparisons}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.avg_score.toFixed(1)}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <Trophy className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Top Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.top_score.toFixed(1)}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Recent (7 days)</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.recent_comparisons}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by resume name or job title..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
              <button
                onClick={exportComparisons}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label='Select status filter'
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job</label>
                  <select
                    value={filters.job_id}
                    onChange={(e) => handleFilterChange('job_id', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label='Select job filter'
                  >
                    <option value="all">All Jobs</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>{job.title} - {job.company}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.min_score}
                    onChange={(e) => handleFilterChange('min_score', parseInt(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label='Minimum score filter'
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.max_score}
                    onChange={(e) => handleFilterChange('max_score', parseInt(e.target.value) || 100)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label='Select maximum score filter'
                  />
                </div>
              </div>
              <div className="flex justify-between items-center mt-4">
                <div className="flex gap-2">
                  <select
                    value={filters.sort_by}
                    onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label='Select sort by filter'
                  >
                    <option value="created_at">Sort by Date</option>
                    <option value="overall_score">Sort by Score</option>
                    <option value="resume_name">Sort by Resume</option>
                  </select>
                  <select
                    value={filters.sort_order}
                    onChange={(e) => handleFilterChange('sort_order', e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label='Select sort order filter'
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Comparisons Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : comparisons.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No comparisons found</h3>
            <p className="text-gray-600">Try adjusting your filters or create some new comparisons.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
            {comparisons.map((comparison) => (
              <div key={comparison.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{comparison.resume_name}</h3>
                    <p className="text-sm text-gray-600 truncate">{comparison.job_title}</p>
                    <p className="text-xs text-gray-500">{comparison.company_name}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(comparison.status)}`}>
                    {comparison.status}
                  </span>
                </div>
                
                {comparison.status === 'completed' && comparison.ats_score && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">ATS Score</span>
                      <span className={`text-lg font-bold px-2 py-1 rounded ${getScoreColor(comparison.ats_score.overall_score)}`}>
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
                        <span>{comparison.ats_score.keyword_score.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{new Date(comparison.created_at).toLocaleDateString()}</span>
                  <a
                    href={`/comparisons/${comparison.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View Details →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center">
            <nav className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 rounded-md border ${
                    currentPage === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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