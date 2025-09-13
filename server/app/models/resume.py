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
    metadata: FileMetadata
    status: ProcessingStatus = ProcessingStatus.PENDING
    error_message: Optional[str] = None

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