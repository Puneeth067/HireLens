// UI/Form types for frontend components
import type {
  ParsedResume,
  JobDescription,
  ComparisonResult,
  ParseStatus
} from './types';

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
      };
    };
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