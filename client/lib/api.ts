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
  SystemHealth,
  SystemInfo,
  PaginatedResponse,
  FilterOptions,
  JobStats,
  CreateJobRequest,
  UpdateJobRequest,
  ResumeJobComparison,
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
  JobDescriptionList,
  // Ranking types
  RankingResponse,
  RankingListResponse,
  CandidateComparisonResponse,
  ShortlistResponse,
  RankingUpdate,
  RankingStatisticsResponse,
  RankingCriteria
} from './types';

// Updated API_BASE_URL to work with Vercel deployments
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiService {
  private async fetchWithAuth(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log(`Making API request to: ${url}`, { endpoint, options });
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    // Reduced timeout to 10 seconds to prevent gateway timeouts
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const config: RequestInit = {
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    };

    // Remove Content-Type for FormData requests
    if (options.body instanceof FormData) {
      delete (config.headers as Record<string, string>)['Content-Type'];
    }

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId); // Clear timeout on successful response
      
      console.log(`API response for ${url}:`, response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        // Only log 404 errors for stats endpoint as warnings since they're handled gracefully
        if (response.status === 404 && endpoint === '/api/comparisons/stats') {
          console.warn(`API Warning (${response.status}) for stats endpoint:`, errorText);
        } else {
          console.error(`API Error (${response.status}):`, errorText);
        }
        
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          // Use default error message if JSON parsing fails
        }
        
        // For 404 errors, provide more specific messaging
        if (response.status === 404) {
          // Special handling for comparison creation errors
          if (endpoint === '/api/comparisons' && errorMessage.includes('Resume not found')) {
            throw new Error(`Resume not found: The selected resume is no longer available. Please refresh and try again.`);
          } else if (endpoint === '/api/comparisons' && errorMessage.includes('Job not found')) {
            throw new Error(`Job not found: The selected job is no longer available. Please refresh and try again.`);
          } else {
            throw new Error(`404: ${errorMessage}`);
          }
        }
        
        throw new Error(errorMessage);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId); // Clear timeout on error
      // Only log 404 errors for stats endpoint as warnings since they're handled gracefully
      if (error instanceof Error && error.message.includes('404') && endpoint === '/api/comparisons/stats') {
        console.warn(`API request failed for ${url} (handled gracefully):`, error);
      } else {
        console.error(`API request failed for ${url}:`, error);
      }
      
      // Handle network errors more gracefully
      if (error instanceof TypeError) {
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          throw new Error(`Network error: Unable to connect to ${url}. Please ensure the backend server is running and accessible.`);
        }
        if (error.message.includes('NetworkError') || error.message.includes('network')) {
          throw new Error(`Network connection failed. Please check your internet connection and server status.`);
        }
      }
      
      // Handle timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout: The server took too long to respond. Please try again later.`);
      }
      
      // Re-throw the original error if it's already formatted
      throw error;
    }
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
    console.log('API Service deleteFile called with fileId:', fileId); // Debug log
    const response = await this.fetchWithAuth(`/api/upload/file/${fileId}`, {
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

    // Define proper types instead of using 'any'
    interface ServerParsedData {
      personal_info?: Partial<{
        name?: string;
        email?: string;
        phone?: string;
        linkedin?: string;
        location?: string;
        github?: string;
        portfolio?: string;
      }>;
      skills?: {
        technical?: string[];
        soft?: string[];
        tools?: string[];
        frameworks?: string[];
        languages?: string[];
      };
      experience?: Array<{
        position?: string;
        job_title?: string;
        company?: string;
        start_date?: string;
        end_date?: string;
        description?: string | string[];
        location?: string;
        is_current?: boolean;
        achievements?: string[];
        technologies?: string[];
      }>;
      education?: Array<{
        degree?: string;
        field_of_study?: string;
        institution?: string;
        graduation_year?: string | number;
        gpa?: string;
        achievements?: string[];
      }>;
    }

    interface ServerResume {
      id: string;
      filename: string;
      raw_text: string;
      parsed_data?: ServerParsedData;
      status?: string;
      parsed_at?: string;
      file_id?: string; // Add file_id field
    }

    const toClient = (server: ServerResume): ParsedResume => {
      const personal = server.parsed_data?.personal_info || {};
      const skills = server.parsed_data?.skills || {};
      const experience = server.parsed_data?.experience || [];
      const education = server.parsed_data?.education || [];

      const skillsList: string[] = [
        ...(skills.technical || []),
        ...(skills.soft || []),
        ...(skills.tools || []),
        ...(skills.frameworks || []),
        ...(skills.languages || []),
      ];

      // Define types for map functions
      interface ExperienceItem {
        position?: string;
        job_title?: string;
        company?: string;
        start_date?: string;
        end_date?: string;
        description?: string | string[];
        location?: string;
        is_current?: boolean;
        achievements?: string[];
        technologies?: string[];
      }

      interface EducationItem {
        degree?: string;
        field_of_study?: string;
        institution?: string;
        graduation_year?: string | number;
        gpa?: string;
        achievements?: string[];
      }

      const work_experience = experience.map((e: ExperienceItem) => ({
        job_title: e.position || e.job_title || '',
        company: e.company || '',
        start_date: e.start_date || '',
        end_date: e.end_date || undefined,
        description: Array.isArray(e.description) ? e.description.join(' ') : (e.description || ''),
        location: e.location || '',
        is_current: !!e.is_current,
        achievements: e.achievements || [],
        technologies: e.technologies || [],
      }));

      const edu = education.map((e: EducationItem) => ({
        degree: e.degree || '',
        field_of_study: e.field_of_study || '',
        institution: e.institution || '',
        graduation_year: e.graduation_year ? Number(e.graduation_year) : undefined,
        gpa: e.gpa,
        achievements: e.achievements || [],
      }));

      return {
        // Use file_id as the primary ID for accessing parsed resume data
        id: server.file_id || server.id,
        filename: server.filename,
        raw_text: server.raw_text,
        contact_info: {
          name: personal.name,
          email: personal.email,
          phone: personal.phone,
          linkedin: personal.linkedin,
          github: personal.github,
          portfolio: personal.portfolio,
          location: personal.location,
        },
        skills: skillsList,
        work_experience,
        education: edu,
        parsing_status: (server.status || 'pending') as 'pending' | 'processing' | 'completed' | 'failed',
        parsed_at: server.parsed_at,
      };
    };

    const list = data.parsed_resumes || [];
    return Array.isArray(list) ? list.map(toClient) : [];
  }

  async getParsedResume(id: string): Promise<ParsedResume> {
    // When calling the API, we need to use the file_id, not the parsed data id
    // The id parameter here is the file_id from the client-side ParsedResume object
    const response = await this.fetchWithAuth(`/api/parse/parsed-resumes/${id}`);
    const server = await response.json();



    const personal = server.parsed_data?.personal_info || {};
    const skills = server.parsed_data?.skills || {};
    const experience = server.parsed_data?.experience || [];
    const education = server.parsed_data?.education || [];

    const skillsList: string[] = [
      ...(skills.technical || []),
      ...(skills.soft || []),
      ...(skills.tools || []),
      ...(skills.frameworks || []),
      ...(skills.languages || []),
    ];

    // Define types for map functions
    interface ExperienceItem {
      position?: string;
      job_title?: string;
      company?: string;
      start_date?: string;
      end_date?: string;
      description?: string | string[];
      location?: string;
      is_current?: boolean;
      achievements?: string[];
      technologies?: string[];
    }

    interface EducationItem {
      degree?: string;
      field_of_study?: string;
      institution?: string;
      graduation_year?: string | number;
      gpa?: string;
      achievements?: string[];
    }

    const work_experience = experience.map((e: ExperienceItem) => ({
      job_title: e.position || e.job_title || '',
      company: e.company || '',
      start_date: e.start_date || '',
      end_date: e.end_date || undefined,
      description: Array.isArray(e.description) ? e.description.join(' ') : (e.description || ''),
      location: e.location || '',
      is_current: !!e.is_current,
      achievements: e.achievements || [],
      technologies: e.technologies || [],
    }));

    const edu = education.map((e: EducationItem) => ({
      degree: e.degree || '',
      field_of_study: e.field_of_study || '',
      institution: e.institution || '',
      graduation_year: e.graduation_year ? Number(e.graduation_year) : undefined,
      gpa: e.gpa,
      achievements: e.achievements || [],
    }));

    return {
      // Use file_id as the primary ID for accessing parsed resume data
      id: server.file_id || server.id,
      filename: server.filename,
      raw_text: server.raw_text,
      contact_info: {
        name: personal.name,
        email: personal.email,
        phone: personal.phone,
        linkedin: personal.linkedin,
        github: personal.github,
        portfolio: personal.portfolio,
        location: personal.location,
      },
      skills: skillsList,
      work_experience,
      education: edu,
      parsing_status: (server.status || 'pending') as 'pending' | 'processing' | 'completed' | 'failed',
      parsed_at: server.parsed_at,
    } as ParsedResume;
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

  async cleanupOrphanedFiles(): Promise<{ 
    success: boolean; 
    message: string; 
    details: { files: number; parsed_data: number; metadata_entries: number } 
  }> {
    const response = await this.fetchWithAuth('/api/parse/cleanup', {
      method: 'POST',
    });
    return response.json();
  }

  // ========================================
  // JOB DESCRIPTION METHODS
  // ========================================
  async createJob(jobData: CreateJobRequest): Promise<Job> {
    console.log('Creating job with data:', JSON.stringify(jobData, null, 2));
    const response = await this.fetchWithAuth('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
    const result = await response.json();
    console.log('Job creation response:', result);
    return result;
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
  }): Promise<JobDescriptionList> {
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
        const k = key === 'limit' ? 'per_page' : key;
        queryParams.append(k, value.toString());
      }
    });
    
    const response = await this.fetchWithAuth(`/api/comparisons?${queryParams.toString()}`);
    const data = await response.json();
    
    // Standardize response format handling
    if (data.success !== undefined) {
      // Wrapped response format
      const responseData = data.data || {};
      return {
        comparisons: responseData.comparisons || [],
        total: responseData.total || 0,
        page: responseData.page || 1,
        limit: responseData.limit || responseData.per_page || 10
      };
    } else {
      // Direct response format
      return {
        comparisons: data.comparisons || data.items || data.results || [],
        total: data.total || 0,
        page: data.page || 1,
        limit: data.limit || data.per_page || 10
      };
    }
  }

  async getComparison(id: string): Promise<ResumeJobComparison> {
    const response = await this.fetchWithAuth(`/api/comparisons/${id}`);
    const data = await response.json();
    // Unwrap standard response wrapper if present
    return data?.data || data;
  }

  async createComparison(data: {
    job_id: string;
    resume_id: string;
  }): Promise<ResumeJobComparison> {
    const response = await this.fetchWithAuth('/api/comparisons', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    const res = await response.json();
    return res?.data || res;
  }

  async createBulkComparisons(data: {
    job_id: string;
    resume_ids: string[];
  }): Promise<{ batch_id: string; message: string }> {
    const response = await this.fetchWithAuth('/api/comparisons/batch', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    const res = await response.json();
    const payload = res?.data || res;
    return { batch_id: payload.batch_id, message: res?.message || 'Batch comparison created' };
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
    const response = await this.fetchWithAuth('/api/comparisons/bulk-delete', {
      method: 'DELETE',
      body: JSON.stringify({ comparison_ids: ids })
    });
    const data = await response.json();
    
    // Handle wrapped response
    if (data.data && data.data.deleted_count !== undefined) {
      return data.data;
    }
    return { deleted_count: data.deleted_count || 0 };
  }

  async deleteAllComparisons(): Promise<{ deleted_count: number }> {
    const response = await this.fetchWithAuth('/api/comparisons/all', {
      method: 'DELETE'
    });
    const data = await response.json();
    
    // Handle wrapped response
    if (data.data && data.data.deleted_count !== undefined) {
      return data.data;
    }
    return { deleted_count: data.deleted_count || 0 };
  }

  async getComparisonStats(): Promise<{
    total_comparisons: number;
    avg_score: number;
    top_score: number;
    recent_comparisons: number;
    status_breakdown: Record<string, number>;
  }> {
    try {
      const response = await this.fetchWithAuth('/api/comparisons/stats');
      return response.json();
    } catch (error) {
      // Handle 404 errors gracefully as they indicate no comparisons exist yet
      if (error instanceof Error && error.message.includes('404')) {
        console.log('No comparison stats available yet, returning default values');
        return {
          total_comparisons: 0,
          avg_score: 0,
          top_score: 0,
          recent_comparisons: 0,
          status_breakdown: {}
        };
      }
      // Re-throw other errors
      throw error;
    }
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
    
    const response = await this.fetchWithAuth(`/api/comparisons/analytics?${queryParams.toString()}`);
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
    
    // Default to CSV format
    if (!queryParams.has('format')) {
      queryParams.append('format', 'csv');
    }
    
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
    const response = await this.fetchWithAuth('/api/health');
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
  
  const response = await this.fetchWithAuth(`/api/analytics/date-range?${params.toString()}`);
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
  try {
    // Use the existing dashboard endpoint and extract the needed data
    const dashboard = await this.getAnalyticsDashboard();
    
    // Extract trending skills from skills analytics
    const trending_skills = dashboard.skills_analytics.top_demanded_skills
      .slice(0, 10)
      .map(skill => skill.skill);
    
    // Extract top performing jobs from job performance metrics
    const top_performing_jobs = dashboard.job_performance
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 5)
      .map(job => ({
        job_id: job.job_id,
        title: job.job_title,
        score: job.avg_score
      }));
    
    return {
      total_candidates: dashboard.overview.total_candidates,
      total_jobs: dashboard.overview.total_active_jobs,
      total_comparisons: dashboard.overview.total_comparisons,
      avg_score: dashboard.overview.average_ats_score,
      recent_activity: dashboard.overview.recent_activity_count,
      trending_skills,
      top_performing_jobs
    };
  } catch {
    // Return default values instead of raising an error

    return {
      total_candidates: 0,
      total_jobs: 0,
      total_comparisons: 0,
      avg_score: 0,
      recent_activity: 0,
      trending_skills: [],
      top_performing_jobs: []
    };
    
  }
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
    console.log('API Service bulkDeleteFiles called with fileIds:', fileIds); // Debug log
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

  // ========================================
  // RANKING METHODS
  // ========================================
  
  /**
   * Create a new candidate ranking for a job
   */
  async createRanking(
    jobId: string,
    resumeIds: string[],
    criteria: import('./types').RankingCriteria
  ): Promise<{ ranking_id: string }> {
    const requestBody = {
      job_id: jobId,
      resume_ids: resumeIds,
      criteria: criteria,
    };
    const response = await this.fetchWithAuth('/api/ranking', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    const data: import('./types').RankingResponse = await response.json();
    console.log('API Response for createRanking:', data);
    // The backend returns a RankingResponse with a ranking object that has an id
    if (data.success && data.ranking && data.ranking.id) {
      return { ranking_id: data.ranking.id };
    } else {
      console.error('Failed to extract ranking_id from response:', data);
      return { ranking_id: '' };
    }
  }

  /**
   * Get all rankings for a specific job
   */
  async getRankingsByJob(
    jobId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<RankingListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    const response = await this.fetchWithAuth(`/api/ranking/job/${jobId}?${params.toString()}`);
    return response.json();
  }

  /**
   * Get all candidates that have been compared to a job (before ranking creation)
   */
  async getCandidatesForJob(
    jobId: string
  ): Promise<{
    success: boolean;
    candidates: import('./types').RankedCandidate[];
    total_candidates: number;
    message: string;
  }> {
    const response = await this.fetchWithAuth(`/api/ranking/job/${jobId}/candidates`);
    return response.json();
  }

  /**
   * Get a specific ranking by ID
   */
  async getRanking(rankingId: string): Promise<RankingResponse> {
    const response = await this.fetchWithAuth(`/api/ranking/${rankingId}`);
    return response.json();
  }

  /**
   * Compare specific candidates side by side
   */
  async compareCandidates(
    candidateIds: string[],
    jobId: string
  ): Promise<CandidateComparisonResponse> {
    const response = await this.fetchWithAuth('/api/ranking/compare', {
      method: 'POST',
      body: JSON.stringify({
        candidate_ids: candidateIds,
        job_id: jobId,
      }),
    });
    return response.json();
  }

  /**
   * Get AI-suggested shortlist of top candidates
   */
  async getShortlistSuggestions(
    jobId: string,
    count: number = 10
  ): Promise<ShortlistResponse> {
    const params = new URLSearchParams({
      count: count.toString(),
    });
    
    const response = await this.fetchWithAuth(`/api/ranking/shortlist/${jobId}?${params.toString()}`);
    return response.json();
  }

  /**
   * Update an existing ranking with new criteria or filters
   */
  async updateRanking(
    rankingId: string,
    update: RankingUpdate
  ): Promise<RankingResponse> {
    const response = await this.fetchWithAuth(`/api/ranking/${rankingId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
    return response.json();
  }

  /**
   * Delete a ranking
   */
  async deleteRanking(rankingId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.fetchWithAuth(`/api/ranking/${rankingId}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  /**
   * Get predefined ranking criteria templates
   */
  async getCriteriaTemplates(): Promise<{
    success: boolean;
    templates: Record<string, RankingCriteria>;
    message: string;
  }> {
    const response = await this.fetchWithAuth('/api/ranking/criteria/templates');
    return response.json();
  }

  /**
   * Get ranking statistics for a job
   */
  async getRankingStatistics(jobId: string): Promise<RankingStatisticsResponse> {
    const response = await this.fetchWithAuth(`/api/ranking/statistics/${jobId}`);
    return response.json();
  }

  /**
   * Compare multiple groups of candidates
   */
  async bulkCompareCandidates(
    jobId: string,
    candidateGroups: string[][]
  ): Promise<{
    success: boolean;
    comparisons: Array<{
      group_name: string;
      [key: string]: string | number | boolean | object;
    }>;
    total_groups: number;
    message: string;
  }> {
    const response = await this.fetchWithAuth('/api/ranking/bulk-compare', {
      method: 'POST',
      body: JSON.stringify({
        job_id: jobId,
        candidate_groups: candidateGroups,
      }),
    });
    return response.json();
  }

}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;

// Convenience exports for direct use - properly bound to maintain 'this' context
export const uploadSingleFile = apiService.uploadSingleFile.bind(apiService);
export const uploadBulkFiles = apiService.uploadBulkFiles.bind(apiService);
export const createJob = apiService.createJob.bind(apiService);
export const getJob = apiService.getJob.bind(apiService);
export const updateJob = apiService.updateJob.bind(apiService);
export const deleteJob = apiService.deleteJob.bind(apiService);
export const getJobs = apiService.getJobs.bind(apiService);
export const parseResume = apiService.parseResume.bind(apiService);
export const getParsedResume = apiService.getParsedResume.bind(apiService);
export const deleteParsedResume = apiService.deleteParsedResume.bind(apiService);
export const cleanupOrphanedFiles = apiService.cleanupOrphanedFiles.bind(apiService);
