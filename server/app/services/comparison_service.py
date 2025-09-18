"""
Service for managing resume-job comparisons and ATS scoring
"""

import json
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import asyncio
from collections import Counter, defaultdict
import time

from app.models.comparison import (
    ResumeJobComparison, 
    ATSScore, 
    ComparisonStatus,
    BatchComparisonRequest,
    BatchComparisonResponse,
    ComparisonSummary,
    ComparisonFilters,
    ComparisonAnalytics,
    ScoreDistribution
)
from app.models.resume import ParsedResume
from app.models.job import JobDescription
from app.services.ats_scoring_service import calculate_ats_score
from app.services.file_service import FileService
from app.services.job_service import JobService
from app.config import settings

class ComparisonService:
    def __init__(self):
        """Initialize comparison service"""
        self.comparisons_dir = Path(settings.UPLOAD_DIR) / "comparisons"
        self.comparisons_dir.mkdir(exist_ok=True)
        
        self.file_service = FileService()
        self.job_service = JobService()
        
        # In-memory cache for active comparisons
        self._comparison_cache = {}
        self._load_comparisons()
    
    def _load_comparisons(self):
        """Load existing comparisons from storage"""
        try:
            comparisons_file = self.comparisons_dir / "comparisons.json"
            if comparisons_file.exists():
                with open(comparisons_file, 'r') as f:
                    data = json.load(f)
                    for comp_data in data.get('comparisons', []):
                        comparison = ResumeJobComparison(**comp_data)
                        self._comparison_cache[comparison.id] = comparison
        except Exception as e:
            print(f"Error loading comparisons: {e}")
    
    def _save_comparisons(self):
        """Save comparisons to persistent storage"""
        try:
            comparisons_file = self.comparisons_dir / "comparisons.json"
            data = {
                'comparisons': [
                    comparison.dict() for comparison in self._comparison_cache.values()
                ],
                'last_updated': datetime.utcnow().isoformat()
            }
            with open(comparisons_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving comparisons: {e}")
    
    async def create_comparison(
        self, 
        resume_id: str, 
        job_id: str
    ) -> ResumeJobComparison:
        """Create a new resume-job comparison"""
        # Validate resume and job exist
        resume_data = self.file_service.get_parsed_data(resume_id)
        if not resume_data:
            raise ValueError(f"Resume not found: {resume_id}")
        
        job_data = self.job_service.get_job(job_id)
        if not job_data:
            raise ValueError(f"Job not found: {job_id}")
        
        # Create comparison record
        comparison_id = str(uuid.uuid4())
        comparison = ResumeJobComparison(
            id=comparison_id,
            resume_id=resume_id,
            job_id=job_id,
            resume_filename=resume_data.get('filename', 'Unknown'),
            candidate_name=resume_data.get('name', 'Unknown'),
            job_title=job_data.title,
            company=job_data.company,
            status=ComparisonStatus.PENDING,
            ats_score=None,
            completed_at=None,
            processing_time_seconds=None,
            error_message=None
        )
        
        # Store in cache and save
        self._comparison_cache[comparison_id] = comparison
        self._save_comparisons()
        
        # Process comparison asynchronously
        asyncio.create_task(self._process_comparison(comparison_id))
        
        return comparison
    
    async def _process_comparison(self, comparison_id: str):
        """Process a single comparison asynchronously"""
        comparison = self._comparison_cache.get(comparison_id)
        if not comparison:
            return
        
        try:
            start_time = time.time()
            
            # Update status to processing
            comparison.status = ComparisonStatus.PROCESSING
            self._save_comparisons()
            
            # Get resume and job data
            resume_data = self.file_service.get_parsed_data(comparison.resume_id)
            job_data = self.job_service.get_job(comparison.job_id)
            
            if not resume_data or not job_data:
                raise ValueError("Resume or job data not found")
            
            # Parse resume data
            parsed_resume = ParsedResume(**resume_data)
            
            # Calculate ATS score
            scoring_result = calculate_ats_score(parsed_resume, job_data)
            ats_score = ATSScore(**scoring_result)
            
            # Update comparison with results
            processing_time = time.time() - start_time
            comparison.ats_score = ats_score
            comparison.status = ComparisonStatus.COMPLETED
            comparison.completed_at = datetime.utcnow()
            comparison.processing_time_seconds = processing_time
            
            self._save_comparisons()
            
        except Exception as e:
            # Update with error status
            comparison.status = ComparisonStatus.FAILED
            comparison.error_message = str(e)
            comparison.completed_at = datetime.utcnow()
            self._save_comparisons()
    
    async def create_batch_comparison(
        self, 
        request: BatchComparisonRequest
    ) -> BatchComparisonResponse:
        """Create batch comparison for multiple resumes against one job"""
        batch_id = str(uuid.uuid4())
        comparisons = []
        
        # Validate job exists
        job_data = self.job_service.get_job(request.job_id)
        if not job_data:
            raise ValueError(f"Job not found: {request.job_id}")
        
        # Create individual comparisons
        for resume_id in request.resume_ids:
            try:
                comparison = await self.create_comparison(resume_id, request.job_id)
                comparisons.append(comparison)
            except Exception as e:
                # Create failed comparison record
                comparison_id = str(uuid.uuid4())
                failed_comparison = ResumeJobComparison(
                    id=comparison_id,
                    resume_id=resume_id,
                    job_id=request.job_id,
                    resume_filename="Unknown",
                    candidate_name="Unknown",
                    job_title=job_data.title,
                    company=job_data.company,
                    status=ComparisonStatus.FAILED,
                    error_message=str(e),
                    completed_at=datetime.utcnow(),
                    ats_score=None,
                    processing_time_seconds=None
                )
                self._comparison_cache[comparison_id] = failed_comparison
                comparisons.append(failed_comparison)
        
        self._save_comparisons()
        
        return BatchComparisonResponse(
            batch_id=batch_id,
            total_comparisons=len(comparisons),
            comparisons=comparisons,
            status=ComparisonStatus.PROCESSING,
            completed_at=None
        )
    
    def get_comparison(self, comparison_id: str) -> Optional[ResumeJobComparison]:
        """Get a specific comparison by ID"""
        return self._comparison_cache.get(comparison_id)
    
    def list_comparisons(
        self, 
        filters: Optional[ComparisonFilters] = None,
        page: int = 1,
        per_page: int = 10
    ) -> Dict[str, Any]:
        """List comparisons with optional filtering and pagination"""
        comparisons = list(self._comparison_cache.values())
        
        # Apply filters
        if filters:
            comparisons = self._apply_filters(comparisons, filters)
        
        # Sort by creation date (most recent first)
        comparisons.sort(key=lambda x: x.created_at, reverse=True)
        
        # Calculate pagination
        total = len(comparisons)
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_comparisons = comparisons[start_idx:end_idx]
        
        # Calculate summary statistics
        summary = self._calculate_summary(comparisons)
        
        return {
            'comparisons': paginated_comparisons,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page,
            'summary': summary
        }
    
    def _apply_filters(
        self, 
        comparisons: List[ResumeJobComparison], 
        filters: ComparisonFilters
    ) -> List[ResumeJobComparison]:
        """Apply filters to comparison list"""
        filtered = comparisons
        
        if filters.job_id:
            filtered = [c for c in filtered if c.job_id == filters.job_id]
        
        if filters.resume_id:
            filtered = [c for c in filtered if c.resume_id == filters.resume_id]
        
        if filters.status:
            filtered = [c for c in filtered if c.status == filters.status]
        
        if filters.candidate_name:
            name_lower = filters.candidate_name.lower()
            filtered = [c for c in filtered if name_lower in (c.candidate_name or '').lower()]
        
        if filters.company:
            company_lower = filters.company.lower()
            filtered = [c for c in filtered if company_lower in c.company.lower()]
        
        if filters.min_overall_score is not None:
            filtered = [
                c for c in filtered 
                if c.ats_score and c.ats_score.overall_score >= filters.min_overall_score
            ]
        
        if filters.max_overall_score is not None:
            filtered = [
                c for c in filtered 
                if c.ats_score and c.ats_score.overall_score <= filters.max_overall_score
            ]
        
        if filters.min_skills_score is not None:
            filtered = [
                c for c in filtered 
                if c.ats_score and c.ats_score.skills_score >= filters.min_skills_score
            ]
        
        if filters.created_after:
            filtered = [c for c in filtered if c.created_at >= filters.created_after]
        
        if filters.created_before:
            filtered = [c for c in filtered if c.created_at <= filters.created_before]
        
        return filtered
    
    def _calculate_summary(
        self, 
        comparisons: List[ResumeJobComparison]
    ) -> ComparisonSummary:
        """Calculate summary statistics for comparisons"""
        total = len(comparisons)
        completed = len([c for c in comparisons if c.status == ComparisonStatus.COMPLETED])
        pending = len([c for c in comparisons if c.status == ComparisonStatus.PENDING])
        processing = len([c for c in comparisons if c.status == ComparisonStatus.PROCESSING])
        failed = len([c for c in comparisons if c.status == ComparisonStatus.FAILED])
        
        # Calculate average scores for completed comparisons
        completed_comparisons = [c for c in comparisons if c.status == ComparisonStatus.COMPLETED and c.ats_score is not None]
        
        if completed_comparisons:
            avg_overall = sum(c.ats_score.overall_score for c in completed_comparisons if c.ats_score is not None) / len(completed_comparisons)
            avg_skills = sum(c.ats_score.skills_score for c in completed_comparisons if c.ats_score is not None) / len(completed_comparisons)
            avg_experience = sum(c.ats_score.experience_score for c in completed_comparisons if c.ats_score is not None) / len(completed_comparisons)
            avg_education = sum(c.ats_score.education_score for c in completed_comparisons if c.ats_score is not None) / len(completed_comparisons)
            avg_keywords = sum(c.ats_score.keywords_score for c in completed_comparisons if c.ats_score is not None) / len(completed_comparisons)
            
            # Get top candidates
            top_candidates = sorted(
                completed_comparisons, 
                key=lambda x: x.ats_score.overall_score if x.ats_score is not None else 0, 
                reverse=True
            )[:10]
            
            top_candidates_data = [
                {
                    'comparison_id': c.id,
                    'candidate_name': c.candidate_name,
                    'overall_score': c.ats_score.overall_score if c.ats_score is not None else 0,
                    'job_title': c.job_title,
                    'company': c.company
                }
                for c in top_candidates
            ]
            
            # Analyze missing skills
            all_missing_skills = []
            for c in completed_comparisons:
                if c.ats_score is not None:
                    all_missing_skills.extend(c.ats_score.missing_skills)
            
            skill_counts = Counter(all_missing_skills)
            most_common_missing = [
                {'skill': skill, 'count': count, 'percentage': (count / len(completed_comparisons)) * 100}
                for skill, count in skill_counts.most_common(10)
            ]
        else:
            avg_overall = avg_skills = avg_experience = avg_education = avg_keywords = 0.0
            top_candidates_data = []
            most_common_missing = []
        
        return ComparisonSummary(
            total_comparisons=total,
            completed_comparisons=completed,
            pending_comparisons=pending + processing,
            failed_comparisons=failed,
            average_overall_score=round(avg_overall, 2),
            average_skills_score=round(avg_skills, 2),
            average_experience_score=round(avg_experience, 2),
            average_education_score=round(avg_education, 2),
            average_keywords_score=round(avg_keywords, 2),
            top_candidates=top_candidates_data,
            most_common_missing_skills=most_common_missing
        )
    
    def get_analytics(self) -> ComparisonAnalytics:
        """Get advanced analytics for all comparisons"""
        completed_comparisons = [
            c for c in self._comparison_cache.values() 
            if c.status == ComparisonStatus.COMPLETED and c.ats_score is not None
        ]
        
        if not completed_comparisons:
            return ComparisonAnalytics()
        
        # Score distribution
        overall_scores = [c.ats_score.overall_score for c in completed_comparisons if c.ats_score is not None]
        skills_scores = [c.ats_score.skills_score for c in completed_comparisons if c.ats_score is not None]
        
        score_distribution = self._calculate_score_distribution(overall_scores)
        skills_distribution = self._calculate_score_distribution(skills_scores)
        
        # Top performers
        top_performers = sorted(
            completed_comparisons,
            key=lambda x: x.ats_score.overall_score if x.ats_score is not None else 0,
            reverse=True
        )[:10]
        
        top_performing_data = [
            {
                'candidate_name': c.candidate_name,
                'overall_score': c.ats_score.overall_score if c.ats_score is not None else 0,
                'skills_score': c.ats_score.skills_score if c.ats_score is not None else 0,
                'job_title': c.job_title,
                'company': c.company,
                'comparison_id': c.id
            }
            for c in top_performers
        ]
        
        # Skill gap analysis
        all_missing_skills = []
        for c in completed_comparisons:
            if c.ats_score is not None:
                all_missing_skills.extend(c.ats_score.missing_skills)
        
        skill_gaps = Counter(all_missing_skills).most_common(15)
        skill_gap_data = [
            {
                'skill': skill,
                'missing_count': count,
                'percentage': (count / len(completed_comparisons)) * 100
            }
            for skill, count in skill_gaps
        ]
        
        # Processing time statistics
        processing_times = [
            c.processing_time_seconds for c in completed_comparisons 
            if c.processing_time_seconds is not None
        ]
        
        if processing_times:
            processing_stats: Dict[str, float] = {
                'average': sum(processing_times) / len(processing_times),
                'minimum': min(processing_times),
                'maximum': max(processing_times),
                'count': float(len(processing_times))
            }
        else:
            processing_stats = {'average': 0.0, 'minimum': 0.0, 'maximum': 0.0, 'count': 0.0}
        
        return ComparisonAnalytics(
            total_comparisons=len(completed_comparisons),
            score_distribution=score_distribution,
            skills_distribution=skills_distribution,
            top_performing_candidates=top_performing_data,
            skill_gap_analysis=skill_gap_data,
            processing_time_stats=processing_stats
        )
    
    def _calculate_score_distribution(self, scores: List[float]) -> List[ScoreDistribution]:
        """Calculate score distribution in ranges"""
        if not scores:
            return []
        
        ranges = [
            (0, 20, "0-20"),
            (21, 40, "21-40"),
            (41, 60, "41-60"),
            (61, 80, "61-80"),
            (81, 100, "81-100")
        ]
        
        distribution = []
        total_scores = len(scores)
        
        for min_score, max_score, range_label in ranges:
            count = len([s for s in scores if min_score <= s <= max_score])
            percentage = (count / total_scores) * 100 if total_scores > 0 else 0
            
            distribution.append(ScoreDistribution(
                score_range=range_label,
                count=count,
                percentage=round(percentage, 2)
            ))
        
        return distribution
    
    def delete_comparison(self, comparison_id: str) -> bool:
        """Delete a comparison"""
        if comparison_id in self._comparison_cache:
            del self._comparison_cache[comparison_id]
            self._save_comparisons()
            return True
        return False
    
    def get_comparisons_by_job(self, job_id: str) -> List[ResumeJobComparison]:
        """Get all comparisons for a specific job"""
        return [
            c for c in self._comparison_cache.values() 
            if c.job_id == job_id
        ]
    
    def get_comparisons_by_resume(self, resume_id: str) -> List[ResumeJobComparison]:
        """Get all comparisons for a specific resume"""
        return [
            c for c in self._comparison_cache.values() 
            if c.resume_id == resume_id
        ]
    
    def get_comparison_by_resume_and_job(self, resume_id: str, job_id: str) -> Optional[ResumeJobComparison]:
        """Get a specific comparison by resume ID and job ID"""
        for comparison in self._comparison_cache.values():
            if comparison.resume_id == resume_id and comparison.job_id == job_id:
                return comparison
        return None