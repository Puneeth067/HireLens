from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
import statistics
from ..models.ranking import (
    RankingRequest, RankingResponse, RankingListResponse,
    CandidateComparisonResponse, ShortlistResponse,
    RankingUpdate, RankingCriteria
)
from ..services.ranking_service import RankingService
from ..services.job_service import JobService

router = APIRouter(prefix="/api/ranking", tags=["ranking"])
# Use singleton instance of JobService
job_service = JobService()
ranking_service = RankingService(job_service_instance=job_service)

@router.get("/create")
async def get_create_ranking_page():
    """Endpoint to serve the ranking creation page"""
    return {"message": "Ranking creation page loaded successfully"}

@router.post("/", response_model=RankingResponse)
async def create_ranking(request: RankingRequest):
    """Create a new candidate ranking for a job"""
    try:
        # Validate job exists
        job = job_service.get_job(request.job_id)
        print(f"DEBUG: In create_ranking, job_service.get_job returned: {job}")
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        ranking = ranking_service.create_ranking(request)
        
        return RankingResponse(
            success=True,
            ranking=ranking,
            message=f"Ranking created successfully with {ranking.total_candidates} candidates"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create ranking: {str(e)}")

@router.get("/job/{job_id}", response_model=RankingListResponse)
async def get_rankings_by_job(
    job_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Get all rankings for a specific job"""
    try:
        rankings = ranking_service.get_rankings_by_job(job_id)
        
        # Apply pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_rankings = rankings[start_idx:end_idx]
        
        return RankingListResponse(
            success=True,
            rankings=paginated_rankings,
            total=len(rankings),
            page=page,
            limit=limit,
            message=f"Retrieved {len(paginated_rankings)} rankings"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve rankings: {str(e)}")

@router.get("/{ranking_id}", response_model=RankingResponse)
async def get_ranking(ranking_id: str):
    """Get a specific ranking by ID"""
    try:
        ranking = ranking_service.get_ranking(ranking_id)
        
        if not ranking:
            raise HTTPException(status_code=404, detail="Ranking not found")
        
        return RankingResponse(
            success=True,
            ranking=ranking,
            message="Ranking retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve ranking: {str(e)}")

@router.post("/compare", response_model=CandidateComparisonResponse)
async def compare_candidates(
    candidate_ids: List[str],
    job_id: str
):
    """Compare specific candidates side by side"""
    try:
        if len(candidate_ids) < 2:
            raise HTTPException(status_code=400, detail="At least 2 candidates required for comparison")
        
        if len(candidate_ids) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 candidates allowed for comparison")
        
        comparison = ranking_service.compare_candidates(candidate_ids, job_id)
        
        if "error" in comparison:
            raise HTTPException(status_code=400, detail=comparison["error"])
        
        return CandidateComparisonResponse(
            success=True,
            comparison=comparison,
            message=f"Compared {len(candidate_ids)} candidates successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compare candidates: {str(e)}")

@router.get("/shortlist/{job_id}", response_model=ShortlistResponse)
async def get_shortlist_suggestions(
    job_id: str,
    count: int = Query(10, ge=1, le=50)
):
    """Get AI-suggested shortlist of top candidates"""
    try:
        suggestions = ranking_service.get_shortlist_suggestions(job_id, count)
        
        return ShortlistResponse(
            success=True,
            suggestions=suggestions,
            total_candidates=len(suggestions),
            selection_criteria=f"Top {count} candidates based on composite scoring and requirement matching",
            message=f"Generated shortlist with {len(suggestions)} candidates"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate shortlist: {str(e)}")

@router.put("/{ranking_id}", response_model=RankingResponse)
async def update_ranking(ranking_id: str, update: RankingUpdate):
    """Update an existing ranking with new criteria or filters"""
    try:
        ranking = ranking_service.get_ranking(ranking_id)
        
        if not ranking:
            raise HTTPException(status_code=404, detail="Ranking not found")
        
        # Create new ranking request with updated criteria
        request = RankingRequest(
            job_id=ranking.job_id,
            criteria=update.criteria or ranking.criteria,
            filters=update.filters,
            name=update.name,
            description=update.description
        )
        
        updated_ranking = ranking_service.create_ranking(request)
        
        # Delete old ranking
        ranking_service.delete_ranking(ranking_id)
        
        return RankingResponse(
            success=True,
            ranking=updated_ranking,
            message="Ranking updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update ranking: {str(e)}")

@router.delete("/{ranking_id}")
async def delete_ranking(ranking_id: str):
    """Delete a ranking"""
    try:
        success = ranking_service.delete_ranking(ranking_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Ranking not found")
        
        return {"success": True, "message": "Ranking deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete ranking: {str(e)}")

@router.get("/criteria/templates")
async def get_criteria_templates():
    """Get predefined ranking criteria templates"""
    try:
        templates = {
            "balanced": RankingCriteria(
                skills_weight=0.35,
                experience_weight=0.35,
                education_weight=0.15,
                keyword_weight=0.15
            ),
            "skills_focused": RankingCriteria(
                skills_weight=0.5,
                experience_weight=0.25,
                education_weight=0.1,
                keyword_weight=0.15
            ),
            "experience_focused": RankingCriteria(
                skills_weight=0.25,
                experience_weight=0.5,
                education_weight=0.1,
                keyword_weight=0.15
            ),
            "education_focused": RankingCriteria(
                skills_weight=0.3,
                experience_weight=0.25,
                education_weight=0.3,
                keyword_weight=0.15
            ),
            "keyword_focused": RankingCriteria(
                skills_weight=0.3,
                experience_weight=0.25,
                education_weight=0.15,
                keyword_weight=0.3
            )
        }
        
        return {
            "success": True,
            "templates": templates,
            "message": "Retrieved ranking criteria templates"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve templates: {str(e)}")

@router.get("/statistics/{job_id}")
async def get_ranking_statistics(job_id: str):
    """Get ranking statistics for a job"""
    try:
        rankings = ranking_service.get_rankings_by_job(job_id)
        
        if not rankings:
            # If no rankings exist, derive statistics from raw comparisons
            from ..services.comparison_service import ComparisonService
            from ..services.job_service import JobService
            
            # Use singleton instances
            comparison_service = ComparisonService()
            job_service = JobService()
            # Set job_service in comparison_service to resolve circular dependency
            comparison_service.job_service = job_service
            
            comparisons = comparison_service.get_comparisons_by_job(job_id)
            
            # Filter for completed comparisons with scores
            completed_comparisons = [c for c in comparisons if c.status == "completed" and c.ats_score]
            
            if not completed_comparisons:
                return {
                    "success": True,
                    "statistics": {
                        "total_rankings": 0,
                        "latest_ranking": None,
                        "total_candidates": 0,
                        "average_score": 0,
                        "median_score": 0,
                        "top_score": 0,
                        "candidates_meeting_requirements": 0
                    },
                    "message": "No comparisons found for this job"
                }
            
            # Calculate statistics from comparisons
            scores = [c.ats_score.overall_score for c in completed_comparisons if c.ats_score]
            total_candidates = len(completed_comparisons)
            
            # Simple calculation for meeting requirements (assuming all meet for now)
            candidates_meeting_requirements = total_candidates
            
            stats_data = {
                "total_rankings": 0,
                "latest_ranking": None,
                "total_candidates": total_candidates,
                "average_score": statistics.mean(scores) if scores else 0,
                "median_score": statistics.median(scores) if scores else 0,
                "top_score": max(scores) if scores else 0,
                "candidates_meeting_requirements": candidates_meeting_requirements
            }
            
            return {
                "success": True,
                "statistics": stats_data,
                "message": f"Derived statistics from {total_candidates} comparisons"
            }
        
        latest_ranking = rankings[0]  # Most recent
        
        stats_data = {
            "total_rankings": len(rankings),
            "latest_ranking": {
                "id": latest_ranking.id,
                "created_at": latest_ranking.created_at,
                "total_candidates": latest_ranking.total_candidates,
                "candidates_meeting_requirements": latest_ranking.candidates_meeting_requirements
            },
            "total_candidates": latest_ranking.total_candidates,
            "average_score": latest_ranking.average_score,
            "median_score": latest_ranking.median_score,
            "top_score": latest_ranking.top_score,
            "candidates_meeting_requirements": latest_ranking.candidates_meeting_requirements
        }
        
        return {
            "success": True,
            "statistics": stats_data,
            "message": "Retrieved ranking statistics"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve statistics: {str(e)}")

@router.get("/job/{job_id}/candidates")
async def get_candidates_for_job(job_id: str):
    """Get all candidates that have been compared to a job (before ranking creation)"""
    try:
        # Get all comparisons for this job
        from ..services.comparison_service import ComparisonService
        from ..services.job_service import JobService
        
        # Use singleton instances
        comparison_service = ComparisonService()
        job_service = JobService()
        # Set job_service in comparison_service to resolve circular dependency
        comparison_service.job_service = job_service
        
        comparisons = comparison_service.get_comparisons_by_job(job_id)
        
        # Convert to ranked candidate format (without actual ranking)
        candidates = []
        for comparison in comparisons:
            if comparison.status == "completed" and comparison.ats_score:
                candidate = {
                    "resume_id": comparison.resume_id,
                    "comparison_id": comparison.id,
                    "composite_score": comparison.ats_score.overall_score,
                    "skills_score": comparison.ats_score.skills_score,
                    "experience_score": comparison.ats_score.experience_score,
                    "education_score": comparison.ats_score.education_score,
                    "keyword_score": comparison.ats_score.keywords_score,
                    "skill_match_percentage": comparison.ats_score.skills_score,  # Using as proxy
                    "meets_requirements": True,  # Default to True for display purposes
                    "resume_filename": comparison.resume_filename,
                    "candidate_name": getattr(comparison, 'candidate_name', 'Unknown'),
                    "rank": 0  # Not ranked yet
                }
                candidates.append(candidate)
        
        # Sort by composite score (descending)
        candidates.sort(key=lambda x: x["composite_score"], reverse=True)
        
        return {
            "success": True,
            "candidates": candidates,
            "total_candidates": len(candidates),
            "message": f"Retrieved {len(candidates)} candidates for job {job_id}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve candidates: {str(e)}")

@router.post("/bulk-compare")
async def bulk_compare_candidates(
    job_id: str,
    candidate_groups: List[List[str]]  # Multiple groups of candidates to compare
):
    """Compare multiple groups of candidates"""
    try:
        if len(candidate_groups) > 5:
            raise HTTPException(status_code=400, detail="Maximum 5 comparison groups allowed")
        
        comparisons = []
        
        for i, group in enumerate(candidate_groups):
            if len(group) < 2:
                continue
                
            comparison = ranking_service.compare_candidates(group, job_id)
            
            if "error" not in comparison:
                comparison["group_name"] = f"Group {i + 1}"
                comparisons.append(comparison)
        
        return {
            "success": True,
            "comparisons": comparisons,
            "total_groups": len(comparisons),
            "message": f"Completed {len(comparisons)} group comparisons"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to perform bulk comparison: {str(e)}")
