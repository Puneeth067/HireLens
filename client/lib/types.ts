// Core data structures
export interface ParsedResume {
  id: string
  filename: string
  raw_text: string
  parsed_data: {
    personal_info: PersonalInfo
    education: Education[]
    experience: Experience[]
    skills: Skills
    certifications: string[]
    languages: string[]
  }
  metadata: {
    file_size: number
    file_type: string
    pages: number
    upload_date: string
    processing_time: number
  }
}

export interface PersonalInfo {
  name: string
  email: string
  phone: string
  location: string
  linkedin?: string
  github?: string
  portfolio?: string
}

export interface Education {
  institution: string
  degree: string
  field_of_study: string
  graduation_date: string
  gpa?: string
  achievements?: string[]
}

export interface Experience {
  company: string
  position: string
  location: string
  start_date: string
  end_date: string
  is_current: boolean
  description: string[]
  achievements?: string[]
  technologies?: string[]
}

export interface Skills {
  technical: string[]
  soft: string[]
  tools: string[]
  frameworks: string[]
  languages: string[]
}

export interface JobDescription {
  id: string
  title: string
  company: string
  description: string
  requirements: {
    must_have: string[]
    nice_to_have: string[]
    experience_years: number
    education_level: string
  }
  parsed_skills: Skills
}

export interface ComparisonResult {
  resume_id: string
  job_description_id: string
  ats_score: number
  breakdown: {
    skills_match: SkillsMatch
    experience_match: ExperienceMatch
    education_match: EducationMatch
    overall_fit: number
  }
  recommendations: string[]
  missing_skills: string[]
  matched_keywords: string[]
}

export interface SkillsMatch {
  technical_score: number
  soft_skills_score: number
  tools_score: number
  total_score: number
  matched_skills: string[]
  missing_skills: string[]
}

export interface ExperienceMatch {
  years_match: number
  role_relevance: number
  industry_match: number
  total_score: number
}

export interface EducationMatch {
  level_match: number
  field_relevance: number
  total_score: number
}

// UI/Form types
export interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  result?: ParsedResume
  error?: string
}

export interface ProcessingOptions {
  extract_skills: boolean
  analyze_experience: boolean
  generate_summary: boolean
  bulk_processing: boolean
}

// API response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface BulkProcessingResult {
  total_files: number
  processed: number
  failed: number
  results: ParsedResume[]
  errors: Array<{
    filename: string
    error: string
  }>
  processing_time: number
}

// Component props
export interface ResumeCardProps {
  resume: ParsedResume
  onSelect?: (resume: ParsedResume) => void
  onDelete?: (id: string) => void
  isSelected?: boolean
}

export interface ComparisonCardProps {
  comparison: ComparisonResult
  resume: ParsedResume
  jobDescription: JobDescription
}

export interface ScoreDisplayProps {
  score: number
  label: string
  size?: 'sm' | 'md' | 'lg'
  showDetails?: boolean
}