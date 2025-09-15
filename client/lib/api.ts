import {
  UploadedFile,
  ParsedResume,
  Job,
  ComparisonResult,
  ApiResponse,
  FileMetadata,
  UploadResponse,
  BulkUploadResponse,
  FileListResponse,
  ParseResponse,
  BatchParseResponse,
  ParseStatusResponse,
  ProcessingStats,
  AnalyticsData,
  SystemHealth,
  SystemInfo,
  PaginatedResponse,
  FilterOptions,
  SortOptions,
  JobStats,
  CreateJobRequest,
  UpdateJobRequest,
  ResumeJobComparison,
  ATSScore,
  BatchProcessingStatus,
  OverviewMetrics,
  ScoreDistribution,
  SkillsAnalytics,
  HiringTrends,
  JobPerformanceMetric,
  RecruiterInsights,
  AnalyticsDashboard,
  AnalyticsChartData,
  AnalyticsExport,
  AnalyticsRequest
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiService {
  private async fetchWithAuth(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      ...options,
    };

    // Remove Content-Type for FormData requests
    if (options.body instanceof FormData) {
      delete (config.headers as Record<string, string>)['Content-Type'];
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  }

  // ========================================
  // FILE UPLOAD METHODS
  // ========================================
  async uploadSingleFile(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.fetchWithAuth('/api/upload/single', {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async uploadBulkFiles(files: File[]): Promise<BulkUploadResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await this.fetchWithAuth('/api/upload/bulk', {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async getUploadStatus(fileId: string): Promise<ParseStatusResponse> {
    const response = await this.fetchWithAuth(`/api/upload/status/${fileId}`);
    return response.json();
  }

  async deleteFile(fileId: string): Promise<{ message: string }> {
    const response = await this.fetchWithAuth(`/api/upload/${fileId}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async getFiles(): Promise<FileListResponse> {
    const response = await this.fetchWithAuth('/api/upload/files');
    return response.json();
  }

  // ========================================
  // RESUME PARSING METHODS
  // ========================================
  async parseResume(fileId: string): Promise<ParseResponse> {
    const response = await this.fetchWithAuth(`/api/parse/single/${fileId}`, {
      method: 'POST',
    });
    return response.json();
  }

  async parseBulkResumes(fileIds: string[]): Promise<BatchParseResponse> {
    const response = await this.fetchWithAuth('/api/parse/batch', {
      method: 'POST',
      body: JSON.stringify(fileIds),
    });
    return response.json();
  }

  async getParseStatus(fileId: string): Promise<ParseStatusResponse> {
    const response = await this.fetchWithAuth(`/api/parse/status/${fileId}`);
    return response.json();
  }

  async getParsedResumes(): Promise<ParsedResume[]> {
    const response = await this.fetchWithAuth('/api/parse/parsed-resumes');
    const data = await response.json();
    return data.parsed_resumes || [];
  }

  async getParsedResume(id: string): Promise<ParsedResume> {
    const response = await this.fetchWithAuth(`/api/parse/parsed-resumes/${id}`);
    return response.json();
  }

  async deleteParsedResume(fileId: string): Promise<{ message: string }> {
    const response = await this.fetchWithAuth(`/api/parse/result/${fileId}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async getParsingStats(): Promise<ProcessingStats> {
    const response = await this.fetchWithAuth('/api/parse/stats');
    return response.json();
  }

  // ========================================
  // JOB DESCRIPTION METHODS
  // ========================================
  async createJob(jobData: CreateJobRequest): Promise<Job> {
    const response = await this.fetchWithAuth('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
    return response.json();
  }

  async getJob(jobId: string): Promise<Job> {
    const response = await this.fetchWithAuth(`/api/jobs/${jobId}`);
    return response.json();
  }

  async updateJob(jobId: string, jobData: UpdateJobRequest): Promise<Job> {
    const response = await this.fetchWithAuth(`/api/jobs/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify(jobData),
    });
    return response.json();
  }

  async deleteJob(jobId: string): Promise<{ message: string }> {
    const response = await this.fetchWithAuth(`/api/jobs/${jobId}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async getJobs(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    company?: string;
    job_type?: string;
    search?: string;
  }): Promise<{ jobs: Job[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await this.fetchWithAuth(`/api/jobs?${searchParams.toString()}`);
    return response.json();
  }

  async getJobStats(): Promise<JobStats> {
    const response = await this.fetchWithAuth('/api/jobs/stats');
    return response.json();
  }

  async getCompanies(): Promise<string[]> {
    const response = await this.fetchWithAuth('/api/jobs/companies');
    return response.json();
  }

  async duplicateJob(jobId: string): Promise<Job> {
    const response = await this.fetchWithAuth(`/api/jobs/${jobId}/duplicate`, {
      method: 'POST',
    });
    return response.json();
  }

  async updateJobStatus(jobId: string, status: string): Promise<Job> {
    const response = await this.fetchWithAuth(`/api/jobs/${jobId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return response.json();
  }

  async getPopularSkills(limit: number = 20): Promise<Array<{ skill: string; count: number }>> {
    const response = await this.fetchWithAuth(`/api/jobs/popular-skills?limit=${limit}`);
    return response.json();
  }

  async bulkUpdateJobStatus(jobIds: string[], status: string): Promise<{
    results: Array<{ job_id: string; success: boolean; error?: string }>;
  }> {
    const response = await this.fetchWithAuth('/api/jobs/bulk/status', {
      method: 'POST',
      body: JSON.stringify({ job_ids: jobIds, status }),
    });
    return response.json();
  }

  async bulkDeleteJobs(jobIds: string[]): Promise<{
    results: Array<{ job_id: string; success: boolean; error?: string }>;
  }> {
    const response = await this.fetchWithAuth('/api/jobs/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ job_ids: jobIds }),
    });
    return response.json();
  }

  // ========================================
  // COMPARISON METHODS
  // ========================================
  async getComparisons(params: {
    page?: number;
    limit?: number;
    status?: string;
    job_id?: string;
    min_score?: number;
    max_score?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<{ comparisons: ResumeJobComparison[]; total: number; page: number; limit: number }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const response = await this.fetchWithAuth(`/api/comparisons?${queryParams}`);
    return response.json();
  }

  async getComparison(id: string): Promise<ResumeJobComparison> {
    const response = await this.fetchWithAuth(`/api/comparisons/${id}`);
    return response.json();
  }

  async createComparison(data: {
    job_id: string;
    resume_id: string;
  }): Promise<ResumeJobComparison> {
    const response = await this.fetchWithAuth('/api/comparisons', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async createBulkComparisons(data: {
    job_id: string;
    resume_ids: string[];
  }): Promise<{ batch_id: string; message: string }> {
    const response = await this.fetchWithAuth('/api/comparisons/bulk', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async getBatchStatus(batchId: string): Promise<BatchProcessingStatus> {
    const response = await this.fetchWithAuth(`/api/comparisons/batch/${batchId}/status`);
    return response.json();
  }

  async updateComparison(id: string, data: Partial<ResumeJobComparison>): Promise<ResumeJobComparison> {
    const response = await this.fetchWithAuth(`/api/comparisons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async deleteComparison(id: string): Promise<void> {
    await this.fetchWithAuth(`/api/comparisons/${id}`, {
      method: 'DELETE'
    });
  }

  async deleteBulkComparisons(ids: string[]): Promise<{ deleted_count: number }> {
    const response = await this.fetchWithAuth('/api/comparisons/bulk/delete', {
      method: 'DELETE',
      body: JSON.stringify({ comparison_ids: ids })
    });
    return response.json();
  }

  async getComparisonStats(): Promise<{
    total_comparisons: number;
    avg_score: number;
    top_score: number;
    recent_comparisons: number;
    status_breakdown: Record<string, number>;
  }> {
    const response = await this.fetchWithAuth('/api/comparisons/stats');
    return response.json();
  }

  async getComparisonAnalytics(params: {
    job_id?: string;
    date_range?: string;
  } = {}): Promise<{
    score_distribution: { range: string; count: number }[];
    top_candidates: Array<{
      comparison_id: string;
      resume_name: string;
      overall_score: number;
      job_title: string;
    }>;
    skill_gaps: Array<{
      skill: string;
      missing_count: number;
      total_candidates: number;
      gap_percentage: number;
    }>;
    trends: Array<{
      date: string;
      avg_score: number;
      comparison_count: number;
    }>;
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const response = await this.fetchWithAuth(`/api/comparisons/analytics?${queryParams}`);
    return response.json();
  }

  async exportComparisons(filters: {
    status?: string;
    job_id?: string;
    min_score?: number;
    max_score?: number;
    search?: string;
  } = {}): Promise<Blob> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const response = await this.fetchWithAuth(`/api/comparisons/export?${queryParams}`);
    return response.blob();
  }

  // ========================================
  // LEGACY ATS COMPARISON METHODS (for backward compatibility)
  // ========================================
  async compareResumeToJob(resumeFileId: string, jobId: string): Promise<ComparisonResult> {
    const response = await this.fetchWithAuth('/api/compare', {
      method: 'POST',
      body: JSON.stringify({
        resume_file_id: resumeFileId,
        job_id: jobId,
      }),
    });
    return response.json();
  }

  async compareBulkResumesToJob(resumeFileIds: string[], jobId: string): Promise<ComparisonResult[]> {
    const response = await this.fetchWithAuth('/api/compare/bulk', {
      method: 'POST',
      body: JSON.stringify({
        resume_file_ids: resumeFileIds,
        job_id: jobId,
      }),
    });
    return response.json();
  }

  async listComparisons(
    page: number = 1,
    limit: number = 20,
    jobId?: string
  ): Promise<PaginatedResponse<ComparisonResult>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (jobId) {
      params.append('job_id', jobId);
    }

    const response = await this.fetchWithAuth(`/api/compare?${params.toString()}`);
    return response.json();
  }

  // ========================================
  // SYSTEM METHODS
  // ========================================

  async healthCheck(): Promise<SystemHealth> {
    const response = await this.fetchWithAuth('/health');
    return response.json();
  }

  async getSystemInfo(): Promise<SystemInfo> {
    const response = await this.fetchWithAuth('/api/system/info');
    return response.json();
  }

  // ========================================
  // UTILITY AND EXPORT METHODS
  // ========================================
  async downloadFile(fileId: string): Promise<Blob> {
    const response = await this.fetchWithAuth(`/api/upload/download/${fileId}`);
    return response.blob();
  }

  async previewFile(fileId: string): Promise<{
    filename: string;
    content_preview: string;
    metadata: FileMetadata;
  }> {
    const response = await this.fetchWithAuth(`/api/upload/preview/${fileId}`);
    return response.json();
  }

  async exportResumes(fileIds: string[], format: 'csv' | 'json' | 'xlsx'): Promise<Blob> {
    const response = await this.fetchWithAuth('/api/export/resumes', {
      method: 'POST',
      body: JSON.stringify({
        file_ids: fileIds,
        format,
      }),
    });
    return response.blob();
  }

  // ========================================
  // LEGACY WRAPPER METHODS (for backward compatibility)
  // ========================================
  async uploadSingleResume(file: File): Promise<ApiResponse<UploadedFile>> {
    try {
      const result = await this.uploadSingleFile(file);
      return {
        success: true,
        data: {
          file,
          id: result.file_id,
          status: 'completed',
          progress: 100,
          name: result.filename,
          size: result.file_size,
        },
        message: result.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async uploadBulkResumes(files: File[]): Promise<ApiResponse<UploadedFile[]>> {
    try {
      const result = await this.uploadBulkFiles(files);
      const uploadedFiles = result.uploaded_files.map((upload, index) => ({
        file: files[index],
        id: upload.file_id,
        status: 'completed' as const,
        progress: 100,
        name: upload.filename,
        size: upload.file_size,
      }));

      return {
        success: true,
        data: uploadedFiles,
        message: `${result.successful_uploads} files uploaded successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk upload failed',
      };
    }
  }

  async listUploadedFiles(): Promise<{ files: UploadedFile[]; total: number }> {
    const result = await this.getFiles();
    const files = result.files.map(file => ({
      file: new File([], file.original_filename),
      id: file.file_id,
      status: file.status,
      progress: file.status === 'completed' ? 100 : file.progress || 0,
      name: file.original_filename,
      size: file.file_size,
      uploadedAt: new Date(file.uploaded_at * 1000),
    }));

    return { files, total: result.total };
  }

  // Alias methods for backward compatibility
  async createJobDescription(jobData: CreateJobRequest): Promise<Job> {
    return this.createJob(jobData);
  }

  async getJobDescription(jobId: string): Promise<Job> {
    return this.getJob(jobId);
  }

  async updateJobDescription(jobId: string, jobData: UpdateJobRequest): Promise<Job> {
    return this.updateJob(jobId, jobData);
  }

  async deleteJobDescription(jobId: string): Promise<{ message: string }> {
    return this.deleteJob(jobId);
  }

  async listJobDescriptions(
    page: number = 1,
    limit: number = 20,
    filters?: FilterOptions
  ): Promise<PaginatedResponse<Job>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters?.search_query) {
      params.append('search', filters.search_query);
    }

    const response = await this.fetchWithAuth(`/api/jobs?${params.toString()}`);
    return response.json();
  }

  // ========================================
// ANALYTICS METHODS
// ========================================

/**
 * Get high-level overview metrics for the dashboard
 */
async getOverviewMetrics(days: number = 30): Promise<OverviewMetrics> {
  const response = await this.fetchWithAuth(`/api/analytics/overview?days=${days}`);
  return response.json();
}

/**
 * Get ATS score distribution data for charts
 */
async getScoreDistribution(): Promise<ScoreDistribution> {
  const response = await this.fetchWithAuth('/api/analytics/scores/distribution');
  return response.json();
}

/**
 * Get comprehensive skills analytics including demand, supply, and gaps
 */
async getSkillsAnalytics(): Promise<SkillsAnalytics> {
  const response = await this.fetchWithAuth('/api/analytics/skills');
  return response.json();
}

/**
 * Get hiring trends over time with monthly breakdowns
 */
async getHiringTrends(months: number = 12): Promise<HiringTrends> {
  const response = await this.fetchWithAuth(`/api/analytics/trends?months=${months}`);
  return response.json();
}

/**
 * Get performance metrics for all jobs
 */
async getJobPerformanceMetrics(): Promise<JobPerformanceMetric[]> {
  const response = await this.fetchWithAuth('/api/analytics/jobs/performance');
  return response.json();
}

/**
 * Get actionable insights and recommendations for recruiters
 */
async getRecruiterInsights(): Promise<RecruiterInsights> {
  const response = await this.fetchWithAuth('/api/analytics/insights');
  return response.json();
}

/**
 * Get complete analytics dashboard with all metrics
 */
async getAnalyticsDashboard(days: number = 30, months: number = 12): Promise<AnalyticsDashboard> {
  const response = await this.fetchWithAuth(`/api/analytics/dashboard?days=${days}&months=${months}`);
  return response.json();
}

/**
 * Get chart data for score distribution visualization
 */
async getScoreDistributionChart(): Promise<AnalyticsChartData> {
  const response = await this.fetchWithAuth('/api/analytics/charts/score-distribution');
  return response.json();
}

/**
 * Get chart data for top demanded skills
 */
async getSkillsDemandChart(): Promise<AnalyticsChartData> {
  const response = await this.fetchWithAuth('/api/analytics/charts/skills-demand');
  return response.json();
}

/**
 * Get chart data for hiring trends over time
 */
async getHiringTrendsChart(months: number = 6): Promise<AnalyticsChartData> {
  const response = await this.fetchWithAuth(`/api/analytics/charts/hiring-trends?months=${months}`);
  return response.json();
}

/**
 * Export analytics data in various formats
 */
async exportAnalyticsData(exportConfig: AnalyticsExport): Promise<{
  content: string;
  filename: string;
  content_type: string;
}> {
  const response = await this.fetchWithAuth('/api/analytics/export', {
    method: 'POST',
    body: JSON.stringify(exportConfig),
  });
  return response.json();
}

/**
 * Download analytics export as a file blob
 */
async downloadAnalyticsExport(exportConfig: AnalyticsExport): Promise<Blob> {
  const response = await this.fetchWithAuth('/api/analytics/export', {
    method: 'POST',
    body: JSON.stringify(exportConfig),
  });
  
  // Handle both file download and content response
  if (response.headers.get('content-type')?.includes('application/json')) {
    const data = await response.json();
    const blob = new Blob([data.content], { type: data.content_type });
    return blob;
  }
  
  return response.blob();
}

/**
 * Health check for analytics service
 */
async getAnalyticsHealth(): Promise<{
  status: string;
  timestamp: string;
  analytics_service: string;
  data_available: {
    has_comparisons: boolean;
    has_jobs: boolean;
    has_candidates: boolean;
  };
}> {
  const response = await this.fetchWithAuth('/api/analytics/health');
  return response.json();
}

/**
 * Get analytics data for a specific time period
 */
async getAnalyticsByDateRange(
  startDate: string,
  endDate: string,
  sections?: string[]
): Promise<Partial<AnalyticsDashboard>> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  
  if (sections && sections.length > 0) {
    sections.forEach(section => params.append('sections', section));
  }
  
  const response = await this.fetchWithAuth(`/api/analytics/date-range?${params}`);
  return response.json();
}

/**
 * Get analytics summary for quick dashboard cards
 */
async getAnalyticsSummary(): Promise<{
  total_candidates: number;
  total_jobs: number;
  total_comparisons: number;
  avg_score: number;
  recent_activity: number;
  trending_skills: string[];
  top_performing_jobs: Array<{
    job_id: string;
    title: string;
    score: number;
  }>;
}> {
  const response = await this.fetchWithAuth('/api/analytics/summary');
  return response.json();
}

/**
 * Get real-time analytics updates (for dashboard refresh)
 */
async getAnalyticsUpdates(lastUpdate?: string): Promise<{
  has_updates: boolean;
  last_updated: string;
  updated_sections: string[];
  summary: {
    new_comparisons: number;
    new_jobs: number;
    score_changes: number;
  };
}> {
  const params = lastUpdate ? `?since=${encodeURIComponent(lastUpdate)}` : '';
  const response = await this.fetchWithAuth(`/api/analytics/updates${params}`);
  return response.json();
}

/**
 * Get detailed analytics for a specific job
 */
async getJobAnalyticsDetail(jobId: string): Promise<{
  job: Job;
  performance: JobPerformanceMetric;
  candidate_distribution: {
    score_ranges: Array<{ range: string; count: number }>;
    skill_matches: Array<{ skill: string; match_count: number }>;
  };
  recommendations: string[];
  benchmarks: {
    industry_avg_score: number;
    similar_jobs_avg: number;
    market_position: 'above' | 'average' | 'below';
  };
}> {
  const response = await this.fetchWithAuth(`/api/analytics/jobs/${jobId}/detail`);
  return response.json();
}

/**
 * Get skills market analysis
 */
async getSkillsMarketAnalysis(): Promise<{
  trending_up: Array<{ skill: string; growth: number }>;
  trending_down: Array<{ skill: string; decline: number }>;
  stable: Array<{ skill: string; demand: number }>;
  emerging: Array<{ skill: string; mentions: number }>;
  market_insights: string[];
}> {
  const response = await this.fetchWithAuth('/api/analytics/skills/market');
  return response.json();
}

/**
 * Generate analytics report for specific criteria
 */
async generateAnalyticsReport(criteria: {
  job_ids?: string[];
  date_range?: { start: string; end: string };
  include_predictions?: boolean;
  format?: 'summary' | 'detailed';
}): Promise<{
  report_id: string;
  status: 'generating' | 'completed' | 'failed';
  download_url?: string;
  sections: string[];
  generated_at: string;
}> {
  const response = await this.fetchWithAuth('/api/analytics/reports/generate', {
    method: 'POST',
    body: JSON.stringify(criteria),
  });
  return response.json();
}

// Update the existing getAnalytics method to use the new dashboard endpoint
async getAnalytics(): Promise<AnalyticsDashboard> {
  return this.getAnalyticsDashboard();
}



async getJobSummary(jobId: string): Promise<{
  id: string;
  title: string;
  company: string;
  required_skills: string[];
  preferred_skills: string[];
  experience_level: string;
  education_requirements: string[];
  keywords: string[];
  weights: {
    skills: number;
    experience: number;
    education: number;
    keywords: number;
  };
  requirements_text: string;
  description_text: string;
}> {
  const response = await this.fetchWithAuth(`/api/jobs/${jobId}/summary`);
  return response.json();
}


  async getResumeAnalytics(resumeFileId: string): Promise<{
    skills_breakdown: Record<string, number>;
    experience_summary: {
      total_years: number;
      companies: string[];
      roles: string[];
    };
    comparison_history: Array<{
      job_title: string;
      company: string;
      ats_score: number;
      compared_at: string;
    }>;
  }> {
    const response = await this.fetchWithAuth(`/api/analytics/resume/${resumeFileId}`);
    return response.json();
  }

  async getJobAnalytics(jobId: string): Promise<{
    total_applications: number;
    average_score: number;
    top_candidates: Array<{
      resume_filename: string;
      ats_score: number;
      matched_skills: string[];
    }>;
    skills_demand: Record<string, number>;
  }> {
    const response = await this.fetchWithAuth(`/api/analytics/job/${jobId}`);
    return response.json();
  }

  // Bulk Operations
  async bulkDeleteFiles(fileIds: string[]): Promise<{
    deleted: string[];
    failed: Array<{ file_id: string; error: string }>;
  }> {
    const response = await this.fetchWithAuth('/api/upload/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ file_ids: fileIds }),
    });
    return response.json();
  }

  async bulkUpdateFileStatus(updates: Array<{ file_id: string; status: string }>): Promise<{
    updated: string[];
    failed: Array<{ file_id: string; error: string }>;
  }> {
    const response = await this.fetchWithAuth('/api/upload/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
    return response.json();
  }

  // Search and Filter
  async searchResumes(query: string, filters?: FilterOptions): Promise<{
    results: Array<{
      file_id: string;
      filename: string;
      parsed_resume: ParsedResume;
      relevance_score: number;
    }>;
    total: number;
  }> {
    const params = new URLSearchParams({ query });
    
    if (filters?.date_range) {
      params.append('start_date', filters.date_range.start.toISOString());
      params.append('end_date', filters.date_range.end.toISOString());
    }

    if (filters?.status) {
      filters.status.forEach(status => params.append('status', status));
    }

    const response = await this.fetchWithAuth(`/api/search/resumes?${params.toString()}`);
    return response.json();
  }

  async searchJobs(query: string): Promise<{
    results: Array<{
      job: Job;
      relevance_score: number;
    }>;
    total: number;
  }> {
    const response = await this.fetchWithAuth(`/api/search/jobs?query=${encodeURIComponent(query)}`);
    return response.json();
  }


  async listResumes(): Promise<{ resumes: ParsedResume[]; total: number }> {
    // This would need to be implemented to get all parsed resumes
    // For now, return empty array
    return { resumes: [], total: 0 };
  }
}
// Export singleton instance
export const apiService = new ApiService();
export default apiService;

// Convenience exports for direct use
export const {
  uploadSingleFile,
  uploadBulkFiles,
  createJob,
  getJob,
  updateJob,
  deleteJob,
  getJobs,
  parseResume,
  getParsedResume
} = apiService;