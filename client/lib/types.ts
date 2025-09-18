// Core data structures matching backend models
export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  location?: string;
  github?: string;
  portfolio?: string;
}

export interface Skill {
  name: string;
  category?: string;
  years_of_experience?: number;
}


export interface Education {
  degree: string;
  field_of_study?: string;
  institution?: string;
  graduation_year?: number;
  gpa?: string;
  achievements?: string[];
}

// File management types
export type ParseStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'error';

export interface FileMetadata {
  file_id: string;
  original_filename: string;
  filename: string;
  file_size: number;
  file_type?: string;
  uploaded_at: number;
  status: ParseStatus;
  error_message?: string;
  parsed_at?: string;
  progress?: number;
}

// API response types matching backend
export interface UploadResponse {
  file_id: string;
  message: string;
  filename: string;
  file_size: number;
  status: string;
}

export interface BulkUploadResponse {
  uploaded_files: UploadResponse[];
  total_files: number;
  successful_uploads: number;
  failed_uploads: number;
}

export interface FileListResponse {
  files: FileMetadata[];
  total: number;
}

export interface ParseResponse {
  file_id: string;
  status: string;
  parsed_resume?: ParsedResume;
  message: string;
}

export interface BatchParseResponse {
  total_files: number;
  successful_parses: number;
  failed_parses: number;
  results: ParseResponse[];
}

export interface ParseStatusResponse {
  file_id: string;
  status: string;
  message: string;
  parsed_at?: string;
  filename: string;
}

// Processing statistics
export interface ProcessingStats {
  total_files: number;
  completed: number;
  processing: number;
  pending: number;
  error: number;
  recent_activity: Array<{
    file_id: string;
    filename: string;
    status: string;
    parsed_at?: string;
  }>;
}

// Job Description types
export interface JobRequirements {
  must_have: string[];
  nice_to_have: string[];
  experience_years: number;
  education_level: string;
}

// Job-related enums
export type JobStatus = 'active' | 'paused' | 'closed' | 'draft';

// Update JobType enum to match backend
export type JobType = 'full_time' | 'part_time' | 'contract' | 'internship';

// Update ExperienceLevel enum to match backend exactly
export type ExperienceLevel = 'entry' | 'junior' | 'middle' | 'senior' | 'lead' | 'executive';
// Core job description interface
// Add these to your existing types.ts file:

// Job interfaces matching backend
export interface Job {
  id: string;
  title: string;
  company: string;
  department?: string; // Added missing field
  location: string;
  job_type: JobType;
  experience_level: ExperienceLevel;
  description: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string; // Added missing field
  
  // Backend structure - flat weight fields instead of nested object
  weight_skills: number; // Fixed: was ats_weights.skills_weight
  weight_experience: number; // Fixed: was ats_weights.experience_weight  
  weight_education: number; // Fixed: was ats_weights.education_weight
  weight_keywords: number; // Fixed: was ats_weights.keywords_weight
  
  // Core job content
  responsibilities: string[]; // Added missing required field
  requirements: string[]; // Added missing required field
  nice_to_have?: string[]; // Added missing field
  
  // Skills and qualifications
  required_skills: string[];
  preferred_skills?: string[];
  education_requirements?: string[]; // Added missing field
  certifications?: string[]; // Added missing field
  keywords?: string[]; // Added missing field
  
  status: JobStatus;
  created_at: string;
  updated_at: string;
  posted_date?: string; // Added missing field
  application_deadline?: string; // Added missing field
  created_by?: string; // Added missing field
}

export interface CreateJobRequest {
  title: string;
  company: string;
  department?: string; // Added missing field
  location: string;
  job_type: JobType;
  experience_level: ExperienceLevel;
  description: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string; // Added missing field
  
  // Core job content
  responsibilities: string[]; // Required by backend
  requirements: string[]; // Required by backend
  nice_to_have?: string[]; // Added missing field
  
  required_skills: string[];
  preferred_skills?: string[];
  education_requirements?: string[]; // Added missing field
  certifications?: string[]; // Added missing field
  keywords?: string[]; // Added missing field
  
  // Backend uses flat weight fields
  weight_skills?: number;
  weight_experience?: number;
  weight_education?: number;
  weight_keywords?: number;
  
  application_deadline?: string; // Added missing field
}

export interface UpdateJobRequest extends Partial<CreateJobRequest> {
  status?: JobStatus;
}

export interface JobStats {
  total_jobs: number;
  active_jobs: number;
  draft_jobs: number;
  paused_jobs: number;
  closed_jobs: number;
  recent_jobs: number;
}

export interface JobDescription {
  id?: string;
  title: string;
  company: string;
  department?: string;
  location: string;
  job_type: JobType;
  experience_level: ExperienceLevel;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  
  // Core job content
  description: string;
  responsibilities: string[];
  requirements: string[];
  nice_to_have?: string[];
  
  // Skills and qualifications
  required_skills: string[];
  preferred_skills?: string[];
  education_requirements?: string[];
  certifications?: string[];
  
  // Metadata
  status: JobStatus;
  posted_date?: string;
  application_deadline?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  
  // ATS scoring weights
  keywords?: string[];
  weight_skills: number;
  weight_experience: number;
  weight_education: number;
  weight_keywords: number;
}

// Job description for list/card views
export interface JobDescriptionResponse {
  id: string;
  title: string;
  company: string;
  department?: string;
  location: string;
  job_type: JobType;
  experience_level: ExperienceLevel;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  
  // Summary fields for list views
  required_skills_count: number;
  total_requirements: number;
  applications_count?: number;
}

// Paginated job list response
export interface JobDescriptionList {
  jobs: JobDescriptionResponse[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Job statistics
export interface JobStats {
  total_jobs: number;
  active_jobs: number;
  draft_jobs: number;
  closed_jobs: number;
  recent_jobs: number; // Jobs created in last 7 days
}

// Job creation payload
export interface JobDescriptionCreate {
  title: string;
  company: string;
  department?: string;
  location: string;
  job_type: JobType;
  experience_level: ExperienceLevel;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  
  description: string;
  responsibilities: string[];
  requirements: string[];
  nice_to_have?: string[];
  
  required_skills: string[];
  preferred_skills?: string[];
  education_requirements?: string[];
  certifications?: string[];
  
  application_deadline?: string;
  keywords?: string[];
  weight_skills?: number;
  weight_experience?: number;
  weight_education?: number;
  weight_keywords?: number;
}

// Job update payload (all fields optional)
export interface JobDescriptionUpdate {
  title?: string;
  company?: string;
  department?: string;
  location?: string;
  job_type?: JobType;
  experience_level?: ExperienceLevel;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  nice_to_have?: string[];
  
  required_skills?: string[];
  preferred_skills?: string[];
  education_requirements?: string[];
  certifications?: string[];
  
  status?: JobStatus;
  application_deadline?: string;
  keywords?: string[];
  weight_skills?: number;
  weight_experience?: number;
  weight_education?: number;
  weight_keywords?: number;
}

// ATS Scoring and Comparison types
export interface SkillsMatch {
  technical_score: number;
  soft_skills_score: number;
  tools_score: number;
  total_score: number;
  matched_skills: string[];
  missing_skills: string[];
}

// ATS Scoring types
export interface ATSScore {
  overall_score: number;
  skills_score: number;
  experience_score: number;
  education_score: number;
  keywords_score: number; // Fixed: was keyword_score
  recommendations: string[];
  matched_skills: string[];
  missing_skills: string[];
  keyword_matches: string[]; // Fixed: was matched_keywords
  created_at: string;
}

// Resume-Job Comparison types
export interface ResumeJobComparison {
  id: string;
  resume_id: string;
  job_id: string;
  resume_filename: string; // Fixed: was resume_name
  candidate_name?: string; // Added missing field
  job_title: string;
  company: string; // Fixed: was company_name
  ats_score?: ATSScore;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string; // Added missing field
  processing_time_seconds?: number; // Added missing field
}

// Batch processing types
export interface BatchProcessingStatus {
  batch_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_count: number;
  completed_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

// Update ParsedResume interface to include id and parsing_status
export interface ParsedResume {
  id: string;
  filename: string;
  raw_text: string;
  contact_info?: ContactInfo;
  skills?: string[]; // Simplified to string array for consistency
  work_experience?: Experience[]; // Renamed from experience
  education?: Education[];
  parsing_status: 'pending' | 'processing' | 'completed' | 'failed';
  parsed_at?: string;
}

// Fix Experience interface naming
export interface Experience {
  job_title: string;
  company: string;
  start_date: string;
  end_date?: string; // Make optional for current positions
  description?: string;
  location?: string;
  is_current?: boolean;
  achievements?: string[];
  technologies?: string[];
}

export interface ExperienceMatch {
  years_match: number;
  role_relevance: number;
  industry_match: number;
  total_score: number;
}

export interface EducationMatch {
  level_match: number;
  field_relevance: number;
  total_score: number;
}

export interface ComparisonBreakdown {
  skills_match: SkillsMatch;
  experience_match: ExperienceMatch;
  education_match: EducationMatch;
  overall_fit: number;
}

export interface ComparisonResult {
  id: string;
  resume_id: string;
  job_description_id: string;
  ats_score: number;
  breakdown: ComparisonBreakdown;
  recommendations: string[];
  missing_skills: string[];
  matched_keywords: string[];
  created_at: string;
}

// UI/Form types for frontend components
export interface UploadedFile {
  file: File;
  id: string;
  status: ParseStatus;
  progress: number;
  result?: ParsedResume;
  error?: string;
  name?: string;
  size?: number;
  uploadedAt?: Date;
}

export interface ProcessingOptions {
  extract_skills: boolean;
  analyze_experience: boolean;
  generate_summary: boolean;
  bulk_processing: boolean;
}

// Generic API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BulkProcessingResult {
  total_files: number;
  processed: number;
  failed: number;
  results: ParsedResume[];
  errors: Array<{
    filename: string;
    error: string;
  }>;
  processing_time: number;
}

// Component props interfaces
export interface ResumeCardProps {
  resume: ParsedResume;
  onSelect?: (resume: ParsedResume) => void;
  onDelete?: (id: string) => void;
  isSelected?: boolean;
}

export interface ComparisonCardProps {
  comparison: ComparisonResult;
  resume: ParsedResume;
  jobDescription: JobDescription;
}

export interface ScoreDisplayProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

// Analytics types
// Add these analytics types to your types.ts file:

// Analytics Dashboard Types
export interface OverviewMetrics {
  total_candidates: number;
  total_active_jobs: number;
  total_comparisons: number;
  average_ats_score: number;
  high_scoring_candidates: number;
  recent_activity_count: number;
  success_rate: number;
  data_period_days: number;
}

export interface ScoreDistribution {
  distribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  average_score: number;
  median_score: number;
  total_candidates: number;
  score_trends: {
    improving: number;
    declining: number;
    stable: number;
  };
}

export interface SkillsAnalytics {
  top_demanded_skills: Array<{
    skill: string;
    demand: number;
    jobs_count: number;
    candidates_count: number;
    gap_score: number;
  }>;
  skill_gaps: Array<{
    skill: string;
    demand: number;
    supply: number;
    gap_percentage: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  emerging_skills: Array<{
    skill: string;
    growth_rate: number;
    recent_mentions: number;
  }>;
  total_unique_skills: number;
  avg_skills_per_job: number;
  avg_skills_per_candidate: number;
}

export interface HiringTrends {
  monthly_trends: Array<{
    month: string;
    month_name: string;
    year: number;
    comparisons: number;
    jobs_created: number;
    avg_score: number;
    high_scoring_count: number;
    growth_rate: number;
  }>;
  overall_growth: {
    comparisons_growth: number;
    jobs_growth: number;
    score_improvement: number;
    period_months: number;
  };
  seasonal_patterns: {
    peak_months: string[];
    low_months: string[];
    average_monthly_activity: number;
  };
  predictions: {
    next_month_comparisons: number;
    next_month_jobs: number;
    confidence_level: number;
  };
}

export interface JobPerformanceMetric {
  job_id: string;
  job_title: string;
  company: string;
  total_applications: number;
  avg_score: number;
  high_scoring_candidates: number;
  top_score: number;
  application_rate: number;
  days_since_posted: number;
  status: JobStatus;
  difficulty_level: 'easy' | 'moderate' | 'challenging' | 'very_challenging';
  recommended_actions: string[];
}

export interface RecruiterInsights {
  key_insights: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: 'opportunity' | 'concern' | 'trend' | 'recommendation';
    action_items: string[];
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    category: string;
  }>;
  market_insights: {
    competitive_analysis: string;
    salary_benchmarks: string;
    skill_market_trends: string;
  };
  challenging_positions: Array<{
    job_id: string;
    job_title: string;
    challenge_reasons: string[];
    suggested_improvements: string[];
  }>;
}

export interface AnalyticsDashboard {
  overview: OverviewMetrics;
  score_distribution: ScoreDistribution;
  skills_analytics: SkillsAnalytics;
  hiring_trends: HiringTrends;
  job_performance: JobPerformanceMetric[];
  recruiter_insights: RecruiterInsights;
  generated_at: string;
}

export interface AnalyticsChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    tension?: number;
  }>;
  chart_type: 'bar' | 'line' | 'horizontalBar' | 'doughnut' | 'pie';
  title: string;
  description: string;
}

export interface AnalyticsExport {
  format: 'csv' | 'json';
  sections: Array<'overview' | 'score_distribution' | 'skills' | 'trends' | 'job_performance' | 'insights'>;
  date_range?: {
    start: string;
    end: string;
  };
}

export interface AnalyticsRequest {
  days?: number;
  months?: number;
  job_ids?: string[];
  include_trends?: boolean;
  include_predictions?: boolean;
}

// Chart.js compatible data structure for frontend components
export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  tension?: number;
  fill?: boolean;
}

export interface ChartConfiguration {
  type: 'bar' | 'line' | 'doughnut' | 'pie' | 'horizontalBar';
  data: {
    labels: string[];
    datasets: ChartDataset[];
  };
  options?: {
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    plugins?: {
      title?: {
        display: boolean;
        text: string;
      };
      legend?: {
        display: boolean;
        position: 'top' | 'bottom' | 'left' | 'right';
      };
    };
    scales?: {
      x?: {
        display?: boolean;
        title?: {
          display?: boolean;
          text?: string;
        };
      };
      y?: {
        display?: boolean;
        title?: {
          display?: boolean;
          text?: string;
        };
        beginAtZero?: boolean;
      };
    };
  };
}
export interface AnalyticsData {
  total_resumes: number;
  total_jobs: number;
  total_comparisons: number;
  avg_ats_score: number;
  top_skills: Array<{ skill: string; count: number }>;
  recent_activity: Array<{ 
    type: string; 
    timestamp: string; 
    details: string;
    file_id?: string;
    resume_id?: string;
    job_id?: string;
  }>;
}

// System health and info types
export interface SystemHealth {
  status: string;
  timestamp: number;
  version: string;
  system: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
    python_version: string;
  };
  services: Record<string, string>;
  directories: {
    upload_dir: boolean;
    data_dir: boolean;
    upload_path: string;
  };
  dependencies: {
    status: string;
    spacy: boolean;
    nltk: boolean;
    sklearn: boolean;
    missing: string[];
  };
  statistics: {
    files?: {
      total_files?: number;
      parsed_files?: number;
      processing_files?: number;
      failed_files?: number;
    };
    jobs?: {
      total_jobs?: number;
      active_jobs?: number;
      draft_jobs?: number;
    };
    comparisons?: {
      total_comparisons?: number;
      completed?: number;
      pending?: number;
      failed?: number;
    };
    analytics?: {
      total_candidates?: number;
      average_score?: number;
      top_score?: number;
    };
  };
  configuration: {
    max_file_size_mb: number;
    async_processing: boolean;
    max_concurrent_processes: number;
    allowed_extensions: string[];
  };
}

export interface SystemInfo {
  upload_dir: string;
  data_dir: string;
  max_file_size: number;
  allowed_extensions: string[];
  cors_origins: string[];
  system: {
    cpu_usage_percent: number;
    memory: {
      usage_percent: number;
      total_gb: number;
      available_gb: number;
    };
    disk: {
      usage_percent: number;
      total_gb: number;
      used_gb: number;
      free_gb: number;
    };
  };
  application: {
    upload_directory_size_mb: number;
  };
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState {
  isValid: boolean;
  errors: ValidationError[];
  touched: Record<string, boolean>;
}

// Filter and search types
export interface FilterOptions {
  status?: ParseStatus[];
  date_range?: {
    start: Date;
    end: Date;
  };
  file_type?: string[];
  search_query?: string;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// Pagination types
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationInfo;
}

// Export legacy types for backward compatibility
export type ResumeData = ParsedResume;
export type PersonalInfo = ContactInfo;
export type Skills = Skill[];

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;