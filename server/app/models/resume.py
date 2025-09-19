from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class FileType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    DOC = "doc"

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class PersonalInfo(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None

class Education(BaseModel):
    institution: str
    degree: str
    field_of_study: str
    graduation_date: Optional[str] = None
    gpa: Optional[str] = None
    achievements: List[str] = Field(default_factory=list)

class Experience(BaseModel):
    company: str
    position: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = False
    description: List[str] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)

class Skills(BaseModel):
    technical: List[str] = Field(default_factory=list)
    soft: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)

class ParsedData(BaseModel):
    personal_info: PersonalInfo = Field(default_factory=PersonalInfo)
    education: List[Education] = Field(default_factory=list)
    experience: List[Experience] = Field(default_factory=list)
    skills: Skills = Field(default_factory=Skills)
    certifications: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)

class FileMetadata(BaseModel):
    id: str = Field(..., description="Unique file identifier")
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    uploaded_at: datetime = Field(default_factory=datetime.now)
    status: str = "uploaded"

class ResumeFileMetadata(BaseModel):
    """Metadata for resume processing"""
    file_size: int
    file_type: FileType
    pages: Optional[int] = None
    upload_date: datetime = Field(default_factory=datetime.now)
    processing_time: Optional[float] = None

class ParsedResume(BaseModel):
    id: str = Field(..., description="Unique identifier for the resume")
    filename: str
    raw_text: str
    parsed_data: ParsedData = Field(default_factory=ParsedData)
    metadata: ResumeFileMetadata
    status: ProcessingStatus = ProcessingStatus.PENDING
    error_message: Optional[str] = None

class UploadResponse(BaseModel):
    """Response model for file upload operations"""
    success: bool
    message: str
    file_id: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None
    status: Optional[str] = None
    metadata: Optional[FileMetadata] = None
    files: Optional[List[FileMetadata]] = None
    errors: Optional[List[str]] = None

class BulkUploadResponse(BaseModel):
    """Response model for bulk file upload operations"""
    success: bool = True
    message: str = "Files uploaded successfully"
    uploaded_files: List[Dict[str, Any]]
    total_files: int
    successful_uploads: int
    failed_uploads: int
    errors: Optional[List[str]] = None

class ErrorResponse(BaseModel):
    """Standard error response model"""
    success: bool = False
    error: str
    detail: Optional[str] = None
    error_code: Optional[str] = None

class ResumeUploadRequest(BaseModel):
    """Request model for resume upload"""
    extract_skills: bool = True
    analyze_experience: bool = True
    generate_summary: bool = True

class BulkUploadRequest(BaseModel):
    """Request model for bulk resume upload"""
    extract_skills: bool = True
    analyze_experience: bool = True
    generate_summary: bool = True
    max_files: int = Field(default=10, ge=1, le=50)

class ResumeResponse(BaseModel):
    """Response model for resume operations"""
    success: bool
    data: Optional[ParsedResume] = None
    message: Optional[str] = None
    error: Optional[str] = None

class BulkProcessingResult(BaseModel):
    """Response model for bulk processing"""
    total_files: int
    processed: int
    failed: int
    results: List[ParsedResume]
    errors: List[Dict[str, str]]
    processing_time: float

class FileStatusResponse(BaseModel):
    """Response model for file status queries"""
    file_id: str
    status: str
    filename: str
    uploaded_at: datetime
    processing_progress: Optional[float] = None
    error_message: Optional[str] = None

class DeleteResponse(BaseModel):
    """Response model for delete operations"""
    success: bool
    message: str
    deleted_file_id: Optional[str] = None

class ListFilesResponse(BaseModel):
    """Response model for listing files"""
    files: List[FileMetadata]
    total: int
    page: Optional[int] = None
    per_page: Optional[int] = None
    total_pages: Optional[int] = None

class ProcessingRequest(BaseModel):
    """Request model for processing uploaded files"""
    file_ids: List[str]
    extract_skills: bool = True
    analyze_experience: bool = True
    generate_summary: bool = True
    extract_contact_info: bool = True

class ProcessingResponse(BaseModel):
    """Response model for processing operations"""
    success: bool
    message: str
    job_id: Optional[str] = None  # For async processing
    results: Optional[List[ParsedResume]] = None
    failed_files: Optional[List[str]] = None
    processing_time: Optional[float] = None

class ValidationError(BaseModel):
    """Model for validation error details"""
    field: str
    message: str
    invalid_value: Optional[Any] = None

class ApiError(BaseModel):
    """Enhanced error model for API responses"""
    success: bool = False
    error: str
    detail: Optional[str] = None
    error_code: Optional[str] = None
    validation_errors: Optional[List[ValidationError]] = None
    timestamp: datetime = Field(default_factory=datetime.now)

class PaginationParams(BaseModel):
    """Parameters for paginated requests"""
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=10, ge=1, le=100)
    sort_by: Optional[str] = None
    sort_order: Optional[str] = Field(default="desc", pattern="^(asc|desc)$")

class FileStats(BaseModel):
    """Statistics about uploaded files"""
    total_files: int
    total_size_mb: float
    pdf_files: int
    docx_files: int
    uploaded_today: int
    processing_queue: int
    completed_today: int
    failed_today: int

class SystemStats(BaseModel):
    """System statistics response"""
    file_stats: FileStats
    uptime: float
    memory_usage_mb: float
    disk_usage_gb: float
    active_processes: int

class HealthCheckResponse(BaseModel):
    """Response model for health check"""
    status: str
    timestamp: datetime = Field(default_factory=datetime.now)
    version: str
    uptime: Optional[float] = None
    system_info: Optional[Dict[str, Any]] = None

class ParseStatus(str, Enum):
    """Status enumeration for parsing operations"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress" 
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"
    CANCELLED = "cancelled"

class ParseResponse(BaseModel):
    """Response model for individual parse operations"""
    success: bool
    file_id: str = Field(..., description="Unique identifier for the parsed file")
    filename: str
    status: ParseStatus
    parsed_data: Optional[ParsedData] = None
    raw_text: Optional[str] = None
    metadata: Optional[ResumeFileMetadata] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    processing_time: Optional[float] = None
    parsed_at: datetime = Field(default_factory=datetime.now)
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score for parsed data quality")
    warnings: List[str] = Field(default_factory=list)

class BatchParseResponse(BaseModel):
    """Response model for batch parsing operations"""
    success: bool
    batch_id: str = Field(..., description="Unique identifier for the batch operation")
    total_files: int
    processed_files: int
    successful_parses: int
    failed_parses: int
    results: List[ParseResponse]
    overall_status: ParseStatus
    batch_processing_time: Optional[float] = None
    started_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    errors: List[Dict[str, Any]] = Field(default_factory=list, description="Batch-level errors")
    summary: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Summary statistics and insights")

class ContactInfo(BaseModel):
    """Contact information model for resume parsing"""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None

class Skill(BaseModel):
    """Individual skill model for resume parsing"""
    name: str
    category: Optional[str] = "other"
    years_of_experience: Optional[int] = None
    proficiency_level: Optional[str] = None  # beginner, intermediate, advanced, expert
    is_primary: bool = False
    mentioned_count: int = 1
