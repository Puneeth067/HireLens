from pydantic import BaseModel, Field, field_validator, model_validator, ValidationInfo
from typing import List, Optional
from datetime import datetime
from enum import Enum


class JobStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"
    DRAFT = "draft"


class ExperienceLevel(str, Enum):
    ENTRY = "entry"
    JUNIOR = "junior"
    MIDDLE = "middle"
    SENIOR = "senior"
    LEAD = "lead"
    EXECUTIVE = "executive"


class JobType(str, Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"
    FREELANCE = "freelance"


class JobDescription(BaseModel):
    id: Optional[str] = None
    title: str = Field(default="", min_length=1, max_length=200)
    company: str = Field(default="", min_length=1, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    location: str = Field(default="", min_length=1, max_length=100)
    job_type: Optional[JobType] = None
    experience_level: Optional[ExperienceLevel] = None
    salary_min: Optional[int] = Field(None, ge=0)
    salary_max: Optional[int] = Field(None, ge=0)
    currency: Optional[str] = Field(default="USD", max_length=3)

    # Core job content
    description: str = Field(default="", min_length=1)  # Reduced min_length for flexibility
    responsibilities: List[str] = Field(default_factory=list)
    requirements: List[str] = Field(default_factory=list)
    nice_to_have: Optional[List[str]] = Field(default_factory=list)

    # Skills and qualifications
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: Optional[List[str]] = Field(default_factory=list)
    education_requirements: Optional[List[str]] = Field(default_factory=list)
    certifications: Optional[List[str]] = Field(default_factory=list)

    # Metadata
    status: JobStatus = Field(default=JobStatus.DRAFT)
    posted_date: Optional[datetime] = None
    application_deadline: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

    # Additional fields for ATS scoring
    keywords: Optional[List[str]] = Field(default_factory=list)
    weight_skills: float = Field(default=0.4, ge=0, le=1)
    weight_experience: float = Field(default=0.3, ge=0, le=1)
    weight_education: float = Field(default=0.2, ge=0, le=1)
    weight_keywords: float = Field(default=0.1, ge=0, le=1)

    @field_validator("salary_max")
    def validate_salary_range(cls, v, info: ValidationInfo):
        """
        Ensure salary_max >= salary_min when both are provided.
        Uses info.data to access sibling field values (pydantic v2).
        """
        if v is not None:
            salary_min = info.data.get("salary_min")
            if salary_min is not None and v < salary_min:
                raise ValueError("salary_max must be greater than or equal to salary_min")
        return v

    @model_validator(mode="after")
    def validate_weights_sum(cls, model):
        """
        If all four weight fields are present, ensure they sum to ~1.0 (tolerance 0.01).
        Applied after model construction so we can access resolved field values.
        """
        weights = [
            model.weight_skills,
            model.weight_experience,
            model.weight_education,
            model.weight_keywords,
        ]
        # Only validate when all weights are present (not None)
        if all(w is not None for w in weights):
            total = sum(weights)
            if abs(total - 1.0) > 0.01:
                raise ValueError("All weight fields must sum to 1.0 (±0.01 tolerance)")
        return model


class JobDescriptionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    company: str = Field(..., min_length=1, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    location: str = Field(..., min_length=1, max_length=100)
    job_type: JobType
    experience_level: ExperienceLevel
    salary_min: Optional[int] = Field(None, ge=0)
    salary_max: Optional[int] = Field(None, ge=0)
    currency: Optional[str] = Field(default="USD", max_length=3)

    description: str = Field(..., min_length=1)
    responsibilities: List[str] = Field(..., min_length=1)
    requirements: List[str] = Field(..., min_length=1)
    nice_to_have: Optional[List[str]] = Field(default_factory=list)

    required_skills: List[str] = Field(..., min_length=1)
    preferred_skills: Optional[List[str]] = Field(default_factory=list)
    education_requirements: Optional[List[str]] = Field(default_factory=list)
    certifications: Optional[List[str]] = Field(default_factory=list)

    application_deadline: Optional[datetime] = None
    keywords: Optional[List[str]] = Field(default_factory=list)
    weight_skills: float = Field(default=0.4, ge=0, le=1)
    weight_experience: float = Field(default=0.3, ge=0, le=1)
    weight_education: float = Field(default=0.2, ge=0, le=1)
    weight_keywords: float = Field(default=0.1, ge=0, le=1)

    @field_validator("salary_max")
    def validate_salary_range(cls, v, info: ValidationInfo):
        if v is not None:
            salary_min = info.data.get("salary_min")
            if salary_min is not None and v < salary_min:
                raise ValueError("salary_max must be greater than or equal to salary_min")
        return v

    @model_validator(mode="after")
    def validate_weights_sum(cls, model):
        weights = [
            model.weight_skills,
            model.weight_experience,
            model.weight_education,
            model.weight_keywords,
        ]
        if all(w is not None for w in weights):
            total = sum(weights)
            if abs(total - 1.0) > 0.01:
                raise ValueError("All weight fields must sum to 1.0 (±0.01 tolerance)")
        return model


class JobDescriptionUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[JobType] = None
    experience_level: Optional[ExperienceLevel] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    currency: Optional[str] = None

    description: Optional[str] = None
    responsibilities: Optional[List[str]] = None
    requirements: Optional[List[str]] = None
    nice_to_have: Optional[List[str]] = None

    required_skills: Optional[List[str]] = None
    preferred_skills: Optional[List[str]] = None
    education_requirements: Optional[List[str]] = None
    certifications: Optional[List[str]] = None

    status: Optional[JobStatus] = None
    application_deadline: Optional[datetime] = None
    keywords: Optional[List[str]] = None
    weight_skills: Optional[float] = None
    weight_experience: Optional[float] = None
    weight_education: Optional[float] = None
    weight_keywords: Optional[float] = None

    @field_validator("title", "company", "location", "description", mode="before")
    @classmethod
    def validate_strings(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            v = v.strip()
            if len(v) == 0:
                return None
        return v

    @field_validator("responsibilities", "requirements", "required_skills", mode="before")
    @classmethod
    def validate_lists(cls, v):
        if v is None:
            return v
        if isinstance(v, list) and len(v) == 0:
            return None
        return v

    @field_validator("salary_min", "salary_max", mode="before")
    @classmethod
    def validate_salaries(cls, v):
        if v is None:
            return v
        if isinstance(v, (int, float)) and v < 0:
            raise ValueError("Salary must be non-negative")
        return v

    @field_validator("weight_skills", "weight_experience", "weight_education", "weight_keywords", mode="before")
    @classmethod
    def validate_weights(cls, v):
        if v is None:
            return v
        if isinstance(v, (int, float)) and (v < 0 or v > 1):
            raise ValueError("Weight must be between 0 and 1")
        return v

    @field_validator("salary_max")
    def validate_salary_range(cls, v, info: ValidationInfo):
        # For updates: only validate if salary_max provided and salary_min present in the incoming payload
        if v is not None:
            salary_min = info.data.get("salary_min")
            if salary_min is not None and v < salary_min:
                raise ValueError("salary_max must be greater than or equal to salary_min")
        return v

    @model_validator(mode="after")
    def validate_weights_sum(cls, model):
        # For partial updates: only enforce sum when all four weights are provided (non-None)
        weights = [
            model.weight_skills,
            model.weight_experience,
            model.weight_education,
            model.weight_keywords,
        ]
        if all(w is not None for w in weights):
            total = sum(weights)
            if abs(total - 1.0) > 0.01:
                raise ValueError("All weight fields must sum to 1.0 (±0.01 tolerance)")
        return model


class JobDescriptionResponse(BaseModel):
    id: str
    title: str
    company: str
    department: Optional[str]
    location: str
    job_type: JobType
    experience_level: ExperienceLevel
    status: JobStatus
    created_at: datetime
    updated_at: datetime

    # Summary fields for list views
    required_skills_count: int
    total_requirements: int
    applications_count: Optional[int] = 0


class JobDescriptionList(BaseModel):
    jobs: List[JobDescriptionResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class JobStats(BaseModel):
    total_jobs: int
    active_jobs: int
    draft_jobs: int
    closed_jobs: int
    recent_jobs: int  # Jobs created in last 7 days


class BulkDeleteRequest(BaseModel):
    job_ids: List[str]
