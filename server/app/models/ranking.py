from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class RankingCriteria(BaseModel):
    """Criteria for ranking candidates"""
    skills_weight: float = Field(default=0.4, ge=0, le=1)
    experience_weight: float = Field(default=0.3, ge=0, le=1)
    education_weight: float = Field(default=0.15, ge=0, le=1)
    keyword_weight: float = Field(default=0.15, ge=0, le=1)
    
    # Minimum requirements
    min_overall_score: Optional[float] = Field(default=None, ge=0, le=100)
    min_skills_score: Optional[float] = Field(default=None, ge=0, le=100)
    min_experience_score: Optional[float] = Field(default=None, ge=0, le=100)
    min_education_score: Optional[float] = Field(default=None, ge=0, le=100)
    
    # Additional criteria
    require_degree: bool = Field(default=False)
    min_years_experience: Optional[int] = Field(default=None, ge=0)
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)

class RankedCandidate(BaseModel):
    """A candidate with ranking information"""
    resume_id: str
    comparison_id: str
    rank: int = 0
    composite_score: float
    
    # Individual scores
    skills_score: float
    experience_score: float
    education_score: float
    keyword_score: float
    
    # Additional metrics
    skill_match_percentage: float
    meets_requirements: bool
    
    # Candidate info
    resume_filename: str
    candidate_name: str = "Unknown"
    
    # Optional additional data
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None

class CandidateRanking(BaseModel):
    """Complete ranking result for a job"""
    id: str
    job_id: str
    criteria: RankingCriteria
    candidates: List[RankedCandidate]
    total_candidates: int
    
    # Metadata
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None  # For future user management
    
    # Statistics
    average_score: Optional[float] = None
    median_score: Optional[float] = None
    top_score: Optional[float] = None
    candidates_meeting_requirements: Optional[int] = None
    
    def __init__(self, **data):
        super().__init__(**data)
        self._calculate_statistics()
    
    def _calculate_statistics(self):
        """Calculate ranking statistics"""
        if not self.candidates:
            return
        
        scores = [c.composite_score for c in self.candidates]
        
        self.average_score = sum(scores) / len(scores)
        self.median_score = sorted(scores)[len(scores) // 2]
        self.top_score = max(scores)
        self.candidates_meeting_requirements = sum(
            1 for c in self.candidates if c.meets_requirements
        )

class RankingRequest(BaseModel):
    """Request to create a new ranking"""
    job_id: str
    criteria: RankingCriteria
    filters: Optional[Dict[str, Any]] = None
    name: Optional[str] = None
    description: Optional[str] = None

class RankingFilters(BaseModel):
    """Filters for ranking results"""
    min_score: Optional[float] = Field(default=None, ge=0, le=100)
    max_score: Optional[float] = Field(default=None, ge=0, le=100)
    meets_requirements_only: bool = Field(default=False)
    top_n: Optional[int] = Field(default=None, gt=0)
    exclude_resume_ids: List[str] = Field(default_factory=list)

class CandidateComparison(BaseModel):
    """Side-by-side candidate comparison"""
    job_id: str
    candidates: List[RankedCandidate]
    comparison_metrics: Dict[str, Any]
    created_at: datetime

class ShortlistSuggestion(BaseModel):
    """AI-generated shortlist suggestion"""
    job_id: str
    suggested_candidates: List[RankedCandidate]
    reasoning: str
    confidence_score: float
    diversity_score: float  # How diverse the shortlist is
    created_at: datetime

class RankingUpdate(BaseModel):
    """Update to existing ranking"""
    criteria: Optional[RankingCriteria] = None
    filters: Optional[Dict[str, Any]] = None
    name: Optional[str] = None
    description: Optional[str] = None

class RankingResponse(BaseModel):
    """API response for ranking operations"""
    success: bool
    ranking: Optional[CandidateRanking] = None
    message: str
    error: Optional[str] = None

class RankingListResponse(BaseModel):
    """API response for listing rankings"""
    success: bool
    rankings: List[CandidateRanking]
    total: int
    page: int = 1
    limit: int = 20
    message: str

class CandidateComparisonResponse(BaseModel):
    """API response for candidate comparison"""
    success: bool
    comparison: Optional[Dict[str, Any]] = None
    message: str
    error: Optional[str] = None

class ShortlistResponse(BaseModel):
    """API response for shortlist suggestions"""
    success: bool
    suggestions: List[RankedCandidate]
    total_candidates: int
    selection_criteria: str
    message: str

# For pipeline management
class CandidatePipeline(BaseModel):
    """Candidate pipeline stage"""
    stage_name: str
    stage_order: int
    candidates: List[str]  # resume_ids
    created_at: datetime
    updated_at: Optional[datetime] = None

class PipelineStage(BaseModel):
    """Pipeline stage definition"""
    name: str
    order: int
    description: str
    auto_advance_criteria: Optional[Dict[str, Any]] = None
    notification_settings: Dict[str, bool] = Field(default_factory=dict)

class JobPipeline(BaseModel):
    """Complete pipeline for a job"""
    id: str
    job_id: str
    stages: List[PipelineStage]
    candidate_stages: Dict[str, str]  # resume_id -> stage_name
    created_at: datetime
    updated_at: Optional[datetime] = None