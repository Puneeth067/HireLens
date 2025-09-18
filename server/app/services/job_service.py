import json
import json
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path

from ..models.job import (
    JobDescription, JobDescriptionCreate, JobDescriptionUpdate, 
    JobDescriptionResponse, JobDescriptionList, JobStats, JobStatus,
    JobType, ExperienceLevel
)
from ..config import settings

class JobService:
    def __init__(self):
        self.jobs_dir = Path(settings.UPLOAD_DIR) / "jobs"
        self.jobs_dir.mkdir(exist_ok=True)
        self.jobs_file = self.jobs_dir / "jobs.json"
        self.ensure_jobs_file()

    def ensure_jobs_file(self):
        """Ensure jobs.json file exists with proper structure"""
        if not self.jobs_file.exists():
            initial_data = {
                "jobs": [],
                "metadata": {
                    "created_at": datetime.now().isoformat(),
                    "last_updated": datetime.now().isoformat(),
                    "version": "1.0"
                }
            }
            with open(self.jobs_file, 'w') as f:
                json.dump(initial_data, f, indent=2, default=str)

    def load_jobs(self) -> Dict[str, Any]:
        """Load jobs from JSON file"""
        try:
            with open(self.jobs_file, 'r') as f:
                data = json.load(f)
                return data
        except (FileNotFoundError, json.JSONDecodeError):
            self.ensure_jobs_file()
            return self.load_jobs()

    def save_jobs(self, data: Dict[str, Any]):
        """Save jobs to JSON file"""
        data["metadata"]["last_updated"] = datetime.now().isoformat()
        with open(self.jobs_file, 'w') as f:
            json.dump(data, f, indent=2, default=str)

    def _validate_job_data(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean job data loaded from storage"""
        # Ensure required fields have defaults if missing
        defaults = {
            "title": "",
            "company": "", 
            "department": None,
            "location": "",
            "salary_min": None,
            "salary_max": None,
            "currency": "USD",
            "description": "",
            "responsibilities": [],
            "requirements": [],
            "required_skills": [],
            "weight_skills": 0.4,
            "weight_experience": 0.3,
            "weight_education": 0.2,
            "weight_keywords": 0.1
        }
        
        for key, default_value in defaults.items():
            if key not in job_data or job_data[key] is None:
                job_data[key] = default_value
                
        return job_data

    def create_job(self, job_data: JobDescriptionCreate, created_by: Optional[str] = None) -> JobDescription:
        """Create a new job description"""
        # Load existing data
        data = self.load_jobs()
        
        # Generate unique ID
        job_id = str(uuid.uuid4())
        
        # Create job object
        now = datetime.now()
        job_dict = job_data.dict()
        job_dict.update({
            "id": job_id,
            "status": JobStatus.DRAFT,
            "created_at": now,
            "updated_at": now,
            "posted_date": None,
            "created_by": created_by
        })
        
        job = JobDescription(**job_dict)
        
        # Add to data
        data["jobs"].append(job.dict())
        
        # Save data
        self.save_jobs(data)
        
        return job

    def get_job(self, job_id: str) -> Optional[JobDescription]:
        """Get a job by ID"""
        data = self.load_jobs()
        
        for job_data in data["jobs"]:
            if job_data["id"] == job_id:
                # Validate and clean job data before creating model
                job_data = self._validate_job_data(job_data)
                return JobDescription(**job_data)
        
        return None

    def update_job(self, job_id: str, updates: JobDescriptionUpdate) -> Optional[JobDescription]:
        """Update a job description"""
        data = self.load_jobs()
        
        for i, job_data in enumerate(data["jobs"]):
            if job_data["id"] == job_id:
                # Apply updates
                update_dict = updates.dict(exclude_unset=True)
                update_dict["updated_at"] = datetime.now()
                
                # If status is being changed to active, set posted_date
                if "status" in update_dict and update_dict["status"] == JobStatus.ACTIVE:
                    if not job_data.get("posted_date"):
                        update_dict["posted_date"] = datetime.now()
                
                job_data.update(update_dict)
                data["jobs"][i] = job_data
                
                # Save data
                self.save_jobs(data)
                
                # Validate and clean job data before creating model
                job_data = self._validate_job_data(job_data)
                return JobDescription(**job_data)
        
        return None

    def delete_job(self, job_id: str) -> bool:
        """Delete a job description"""
        data = self.load_jobs()
        
        for i, job_data in enumerate(data["jobs"]):
            if job_data["id"] == job_id:
                del data["jobs"][i]
                self.save_jobs(data)
                return True
        
        return False

    def list_jobs(
        self, 
        page: int = 1, 
        per_page: int = 20, 
        status: Optional[JobStatus] = None,
        search: Optional[str] = None,
        company: Optional[str] = None,
        job_type: Optional[str] = None
    ) -> JobDescriptionList:
        """List jobs with pagination and filtering"""
        data = self.load_jobs()
        jobs = data["jobs"]
        
        # Apply filters
        if status:
            jobs = [job for job in jobs if job.get("status") == status]
        
        if company:
            jobs = [job for job in jobs if company.lower() in job.get("company", "").lower()]
        
        if job_type:
            jobs = [job for job in jobs if job.get("job_type") == job_type]
        
        if search:
            search_lower = search.lower()
            jobs = [
                job for job in jobs 
                if (search_lower in job.get("title", "").lower() or 
                    search_lower in job.get("description", "").lower() or
                    search_lower in job.get("company", "").lower() or
                    any(search_lower in skill.lower() for skill in job.get("required_skills", [])))
            ]
        
        # Sort by updated_at (most recent first)
        jobs.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        
        # Calculate pagination
        total = len(jobs)
        total_pages = (total + per_page - 1) // per_page
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        
        # Get page data
        page_jobs = jobs[start_idx:end_idx]
        
        # Convert to response format
        job_responses = []
        for job_data in page_jobs:
            # Validate and clean job data
            job_data = self._validate_job_data(job_data)
            job_response = JobDescriptionResponse(
                id=job_data["id"],
                title=job_data["title"],
                company=job_data["company"],
                department=job_data.get("department"),
                location=job_data["location"],
                job_type=job_data.get("job_type") or JobType.FULL_TIME,  # Default fallback
                experience_level=job_data.get("experience_level") or ExperienceLevel.MIDDLE,  # Default fallback
                status=job_data.get("status") or JobStatus.DRAFT,  # Default fallback
                created_at=job_data.get("created_at") or datetime.now(),
                updated_at=job_data.get("updated_at") or datetime.now(),
                required_skills_count=len(job_data.get("required_skills", [])),
                total_requirements=len(job_data.get("requirements", [])),
                applications_count=0  # TODO: Implement when we have applications
            )
            job_responses.append(job_response)
        
        return JobDescriptionList(
            jobs=job_responses,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages
        )

    def get_job_stats(self) -> JobStats:
        """Get job statistics"""
        data = self.load_jobs()
        jobs = data["jobs"]
        
        total_jobs = len(jobs)
        active_jobs = len([job for job in jobs if job.get("status") == JobStatus.ACTIVE])
        draft_jobs = len([job for job in jobs if job.get("status") == JobStatus.DRAFT])
        closed_jobs = len([job for job in jobs if job.get("status") == JobStatus.CLOSED])
        
        # Recent jobs (last 7 days)
        seven_days_ago = datetime.now() - timedelta(days=7)
        recent_jobs = len([
            job for job in jobs 
            if datetime.fromisoformat(job.get("created_at", "1900-01-01")) > seven_days_ago
        ])
        
        return JobStats(
            total_jobs=total_jobs,
            active_jobs=active_jobs,
            draft_jobs=draft_jobs,
            closed_jobs=closed_jobs,
            recent_jobs=recent_jobs
        )

    def duplicate_job(self, job_id: str, created_by: Optional[str] = None) -> Optional[JobDescription]:
        """Create a duplicate of an existing job"""
        original_job = self.get_job(job_id)
        if not original_job:
            return None
        
        # Create job data for duplication
        job_data = original_job.dict()
        
        # Remove fields that should be unique/reset
        fields_to_remove = ["id", "created_at", "updated_at", "posted_date"]
        for field in fields_to_remove:
            job_data.pop(field, None)
        
        # Modify title to indicate it's a copy
        job_data["title"] = f"{job_data['title']} (Copy)"
        job_data["status"] = JobStatus.DRAFT
        
        # Create new job
        job_create = JobDescriptionCreate(**job_data)
        return self.create_job(job_create, created_by)

    def get_companies(self) -> List[str]:
        """Get list of unique companies"""
        data = self.load_jobs()
        companies = list(set(job.get("company", "") for job in data["jobs"] if job.get("company")))
        return sorted(companies)

    def get_popular_skills(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get most popular skills across all job descriptions"""
        data = self.load_jobs()
        skill_counts = {}
        
        for job in data["jobs"]:
            # Count required skills
            for skill in job.get("required_skills", []):
                skill_lower = skill.lower().strip()
                skill_counts[skill_lower] = skill_counts.get(skill_lower, 0) + 2  # Weight required skills more
            
            # Count preferred skills
            for skill in job.get("preferred_skills", []):
                skill_lower = skill.lower().strip()
                skill_counts[skill_lower] = skill_counts.get(skill_lower, 0) + 1
        
        # Sort by count and return top skills
        sorted_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
        
        return [{"skill": skill, "count": count} for skill, count in sorted_skills]