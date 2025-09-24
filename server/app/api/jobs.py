from fastapi import APIRouter, HTTPException, Query, Depends, Request
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any

from ..models.job import (
    JobDescription, JobDescriptionCreate, JobDescriptionUpdate,
    JobDescriptionList, JobStats, JobStatus, JobType, ExperienceLevel, BulkDeleteRequest
)
from app.services.job_service import JobService

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

def get_job_service() -> JobService:
    return JobService()

@router.post("/", response_model=JobDescription)
async def create_job(
    job_data: JobDescriptionCreate,
    created_by: Optional[str] = None,
    service: JobService = Depends(get_job_service)
):
    """Create a new job description"""
    try:
        print(f"Received job creation request: {job_data.dict()}")
        job = service.create_job(job_data, created_by)
        print(f"Job created successfully: {job.id}")
        return job
    except Exception as e:
        print(f"Error creating job: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to create job: {str(e)}")

@router.get("/", response_model=JobDescriptionList)
async def list_jobs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[JobStatus] = None,
    search: Optional[str] = None,
    company: Optional[str] = None,
    job_type: Optional[JobType] = None,
    service: JobService = Depends(get_job_service)
):
    """List jobs with pagination and filtering"""
    return service.list_jobs(
        page=page,
        per_page=per_page,
        status=status,
        search=search,
        company=company,
        job_type=job_type
    )

@router.get("/stats", response_model=JobStats)
async def get_job_stats(service: JobService = Depends(get_job_service)):
    """Get job statistics"""
    return service.get_job_stats()

@router.get("/companies", response_model=List[str])
async def get_companies(service: JobService = Depends(get_job_service)):
    """Get list of unique companies"""
    return service.get_companies()

@router.get("/popular-skills", response_model=List[Dict[str, Any]])
async def get_popular_skills(
    limit: int = Query(20, ge=1, le=100),
    service: JobService = Depends(get_job_service)
):
    """Get most popular skills across all job descriptions"""
    return service.get_popular_skills(limit)

@router.get("/{job_id}", response_model=JobDescription)
async def get_job(job_id: str, service: JobService = Depends(get_job_service)):
    """Get a job by ID"""
    job = service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.put("/{job_id}", response_model=JobDescription)
async def update_job(
    job_id: str,
    updates: JobDescriptionUpdate,
    service: JobService = Depends(get_job_service)
):
    """Update a job description"""
    job = service.update_job(job_id, updates)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.delete("/{job_id}")
async def delete_job(job_id: str, service: JobService = Depends(get_job_service)):
    """Delete a job description"""
    success = service.delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted successfully"}

@router.post("/{job_id}/duplicate", response_model=JobDescription)
async def duplicate_job(
    job_id: str,
    created_by: Optional[str] = None,
    service: JobService = Depends(get_job_service)
):
    """Duplicate an existing job"""
    job = service.duplicate_job(job_id, created_by)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.patch("/{job_id}/status", response_model=JobDescription)
async def update_job_status(
    job_id: str,
    status: JobStatus,
    service: JobService = Depends(get_job_service)
):
    """Update job status (activate, pause, close, etc.)"""
    updates = JobDescriptionUpdate(status=status)
    job = service.update_job(job_id, updates)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/{job_id}/summary")
async def get_job_summary(job_id: str, service: JobService = Depends(get_job_service)):
    """Get a summary of job requirements for ATS scoring"""
    job = service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    summary = {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "required_skills": job.required_skills,
        "preferred_skills": job.preferred_skills,
        "experience_level": job.experience_level,
        "education_requirements": job.education_requirements,
        "keywords": job.keywords,
        "weights": {
            "skills": job.weight_skills,
            "experience": job.weight_experience,
            "education": job.weight_education,
            "keywords": job.weight_keywords
        },
        "requirements_text": " ".join(job.requirements),
        "description_text": job.description
    }
    
    return summary

# Additional endpoints for bulk operations
@router.post("/bulk/status")
async def bulk_update_status(
    job_ids: List[str],
    status: JobStatus,
    service: JobService = Depends(get_job_service)
):
    """Update status for multiple jobs"""
    results = []
    for job_id in job_ids:
        try:
            updates = JobDescriptionUpdate(status=status)
            job = service.update_job(job_id, updates)
            if job:
                results.append({"job_id": job_id, "success": True})
            else:
                results.append({"job_id": job_id, "success": False, "error": "Job not found"})
        except Exception as e:
            results.append({"job_id": job_id, "success": False, "error": str(e)})
    
    return {"results": results}

@router.delete("/bulk")
async def bulk_delete_jobs(
    request: BulkDeleteRequest,
    service: JobService = Depends(get_job_service)
):
    """Delete multiple jobs"""
    results = []
    for job_id in request.job_ids:
        try:
            success = service.delete_job(job_id)
            results.append({"job_id": job_id, "success": success})
        except Exception as e:
            results.append({"job_id": job_id, "success": False, "error": str(e)})
    
    return {"results": results}