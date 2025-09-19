"""
Pydantic models for ATS scoring and comparison functionality
"""

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

class ScoreBreakdown(BaseModel):
    """Detailed breakdown of a scoring component"""
    score: float = Field(..., ge=0, le=100, description="Component score (0-100)")
    weight: float = Field(..., ge=0, le=100, description="Weight percentage for this component")
    weighted_score: float = Field(..., ge=0, le=100, description="Score after applying weight")
    details: Dict[str, Any] = Field(default_factory=dict, description="Additional scoring details")

class ATSScore(BaseModel):
    """Complete ATS scoring result"""
    overall_score: float = Field(..., ge=0, le=100, description="Overall ATS compatibility score")
    skills_score: float = Field(..., ge=0, le=100, description="Skills matching score")
    experience_score: float = Field(..., ge=0, le=100, description="Experience matching score")
    education_score: float = Field(..., ge=0, le=100, description="Education matching score")
    keywords_score: float = Field(..., ge=0, le=100, description="Keywords matching score")
    
    breakdown: Dict[str, ScoreBreakdown] = Field(
        default_factory=dict, 
        description="Detailed breakdown of each scoring component"
    )
    
    matched_skills: List[str] = Field(
        default_factory=list, 
        description="Skills that matched between resume and job"
    )
    
    missing_skills: List[str] = Field(
        default_factory=list, 
        description="Required/preferred skills missing from resume"
    )
    
    keyword_matches: List[str] = Field(
        default_factory=list, 
        description="Common keywords found in both resume and job description"
    )
    
    recommendations: List[str] = Field(
        default_factory=list, 
        description="Suggestions for improving the resume for this job"
    )
    
    @validator('overall_score', 'skills_score', 'experience_score', 'education_score', 'keywords_score')
    def validate_scores(cls, v):
        return round(v, 2)

class ComparisonStatus(str, Enum):
    """Status of resume-job comparison"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ResumeJobComparison(BaseModel):
    """Complete comparison between resume and job description"""
    id: str = Field(..., description="Unique comparison identifier")
    batch_id: Optional[str] = Field(None, description="Batch identifier if part of a batch")
    resume_id: str = Field(..., description="Resume identifier")
    job_id: str = Field(..., description="Job description identifier")
    
    # Resume and job metadata
    resume_filename: str = Field(..., description="Original resume filename")
    candidate_name: Optional[str] = Field(None, description="Candidate name from resume")
    job_title: str = Field(..., description="Job title from job description")
    company: str = Field(..., description="Company name from job description")
    
    # Scoring results
    ats_score: Optional[ATSScore] = Field(None, description="Complete ATS scoring results")
    
    # Processing metadata
    status: ComparisonStatus = Field(default=ComparisonStatus.PENDING, description="Comparison status")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Comparison creation time")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update time")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    processing_time_seconds: Optional[float] = Field(None, description="Time taken to process comparison")
    error_message: Optional[str] = Field(None, description="Error message if comparison failed")
    
    @validator('updated_at', always=True)
    def set_updated_at(cls, v):
        return datetime.utcnow()
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class BatchComparisonRequest(BaseModel):
    """Request for batch processing multiple resume-job comparisons"""
    resume_ids: List[str] = Field(..., min_length=1, description="List of resume IDs to process")
    job_id: str = Field(..., description="Job description ID to compare against")
    
    @validator('resume_ids')
    def validate_unique_resume_ids(cls, v):
        if len(v) != len(set(v)):
            raise ValueError('Resume IDs must be unique')
        return v

class BatchComparisonResponse(BaseModel):
    """Response for batch comparison processing"""
    batch_id: str = Field(..., description="Unique batch processing identifier")
    total_comparisons: int = Field(..., description="Total number of comparisons in batch")
    comparisons: List[ResumeJobComparison] = Field(
        default_factory=list, 
        description="List of comparison results"
    )
    status: ComparisonStatus = Field(default=ComparisonStatus.PENDING, description="Batch processing status")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Batch creation time")
    completed_at: Optional[datetime] = Field(None, description="Batch completion time")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ComparisonSummary(BaseModel):
    """Summary statistics for comparisons"""
    total_comparisons: int = Field(default=0, description="Total number of comparisons")
    completed_comparisons: int = Field(default=0, description="Number of completed comparisons")
    pending_comparisons: int = Field(default=0, description="Number of pending comparisons")
    failed_comparisons: int = Field(default=0, description="Number of failed comparisons")
    
    average_overall_score: float = Field(default=0.0, description="Average overall ATS score")
    average_skills_score: float = Field(default=0.0, description="Average skills score")
    average_experience_score: float = Field(default=0.0, description="Average experience score")
    average_education_score: float = Field(default=0.0, description="Average education score")
    average_keywords_score: float = Field(default=0.0, description="Average keywords score")
    
    top_candidates: List[Dict[str, Any]] = Field(
        default_factory=list, 
        description="Top candidates by overall score"
    )
    
    most_common_missing_skills: List[Dict[str, Any]] = Field(
        default_factory=list, 
        description="Most commonly missing skills across all candidates"
    )

class ComparisonFilters(BaseModel):
    """Filters for comparison queries"""
    job_id: Optional[str] = Field(None, description="Filter by specific job ID")
    resume_id: Optional[str] = Field(None, description="Filter by specific resume ID")
    status: Optional[ComparisonStatus] = Field(None, description="Filter by comparison status")
    candidate_name: Optional[str] = Field(None, description="Filter by candidate name")
    company: Optional[str] = Field(None, description="Filter by company name")
    
    min_overall_score: Optional[float] = Field(None, ge=0, le=100, description="Minimum overall score")
    max_overall_score: Optional[float] = Field(None, ge=0, le=100, description="Maximum overall score")
    min_skills_score: Optional[float] = Field(None, ge=0, le=100, description="Minimum skills score")
    
    created_after: Optional[datetime] = Field(None, description="Filter comparisons created after this date")
    created_before: Optional[datetime] = Field(None, description="Filter comparisons created before this date")
    
    @validator('max_overall_score')
    def validate_score_range(cls, v, values):
        min_score = values.get('min_overall_score')
        if min_score is not None and v is not None and v < min_score:
            raise ValueError('max_overall_score must be greater than or equal to min_overall_score')
        return v

class CreateComparisonRequest(BaseModel):
    """Request to create a single comparison"""
    resume_id: str = Field(..., description="Resume ID to compare")
    job_id: str = Field(..., description="Job ID to compare against")

class ComparisonListResponse(BaseModel):
    """Response for listing comparisons with pagination"""
    comparisons: List[ResumeJobComparison] = Field(
        default_factory=list, 
        description="List of comparisons"
    )
    total: int = Field(default=0, description="Total number of comparisons matching filters")
    page: int = Field(default=1, description="Current page number")
    per_page: int = Field(default=10, description="Items per page")
    total_pages: int = Field(default=0, description="Total number of pages")
    
    summary: Optional[ComparisonSummary] = Field(
        None, 
        description="Summary statistics for the filtered comparisons"
    )

# Response models for API endpoints
class ComparisonResponse(BaseModel):
    """Standard response wrapper for comparison operations"""
    success: bool = Field(default=True, description="Whether the operation was successful")
    message: str = Field(default="Operation completed successfully", description="Response message")
    data: Optional[Any] = Field(None, description="Response data")
    error: Optional[str] = Field(None, description="Error message if operation failed")

class ScoreDistribution(BaseModel):
    """Score distribution analytics"""
    score_range: str = Field(..., description="Score range (e.g., '0-20', '21-40')")
    count: int = Field(..., description="Number of candidates in this range")
    percentage: float = Field(..., description="Percentage of total candidates")

class ComparisonAnalytics(BaseModel):
    """Advanced analytics for comparisons"""
    total_comparisons: int = Field(default=0, description="Total comparisons")
    score_distribution: List[ScoreDistribution] = Field(
        default_factory=list, 
        description="Distribution of overall scores"
    )
    skills_distribution: List[ScoreDistribution] = Field(
        default_factory=list, 
        description="Distribution of skills scores"
    )
    
    top_performing_candidates: List[Dict[str, Any]] = Field(
        default_factory=list, 
        description="Top 10 candidates by score"
    )
    
    skill_gap_analysis: List[Dict[str, Any]] = Field(
        default_factory=list, 
        description="Most common missing skills across all candidates"
    )
    
    processing_time_stats: Dict[str, float] = Field(
        default_factory=dict, 
        description="Processing time statistics (avg, min, max)"
    )