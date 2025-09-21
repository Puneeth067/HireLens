"""
API endpoints for ATS scoring and comparison functionality
"""

import logging
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.models.comparison import (
    ResumeJobComparison,
    CreateComparisonRequest,
    BatchComparisonRequest,
    BatchComparisonResponse,
    ComparisonFilters,
    ComparisonListResponse,
    ComparisonResponse,
    ComparisonSummary,
    ComparisonAnalytics,
    ComparisonStatus
)
from app.services.comparison_service import ComparisonService
from app.services.job_service import JobService

router = APIRouter(prefix="/api/comparisons", tags=["comparisons"])

# Initialize services
job_service_instance = JobService()
comparison_service = ComparisonService(job_service_instance=job_service_instance)
logger = logging.getLogger(__name__)

class ComparisonStatsResponse(BaseModel):
    """Response model for comparison statistics"""
    total_comparisons: int
    avg_score: float
    top_score: float
    recent_comparisons: int
    status_breakdown: Dict[str, int]

# IMPORTANT: List routes BEFORE parameterized routes to avoid conflicts
# List all comparisons (must come before /{comparison_id})
@router.get("/", response_model=ComparisonListResponse)
async def list_comparisons(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Items per page (alias for per_page)"),
    skip: Optional[int] = Query(None, ge=0, description="Items to skip (converted to page)"),
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    resume_id: Optional[str] = Query(None, description="Filter by resume ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    candidate_name: Optional[str] = Query(None, description="Filter by candidate name"),
    company: Optional[str] = Query(None, description="Filter by company"),
    min_overall_score: Optional[float] = Query(None, ge=0, le=100, description="Minimum overall score"),
    max_overall_score: Optional[float] = Query(None, ge=0, le=100, description="Maximum overall score"),
    min_score: Optional[float] = Query(None, ge=0, le=100, description="Minimum score (alias for min_overall_score)"),
    max_score: Optional[float] = Query(None, ge=0, le=100, description="Maximum score (alias for max_overall_score)"),
    min_skills_score: Optional[float] = Query(None, ge=0, le=100, description="Minimum skills score"),
    search: Optional[str] = Query(None, description="Search query"),
    sort_by: Optional[str] = Query(None, description="Sort field"),
    sort_order: Optional[str] = Query(None, description="Sort order (asc/desc)"),
    created_after: Optional[datetime] = Query(None, description="Filter created after date"),
    created_before: Optional[datetime] = Query(None, description="Filter created before date")
):
    """List comparisons with filtering and pagination"""
    try:
        # Handle pagination aliases
        if limit and not per_page:
            per_page = limit
        if skip is not None:
            page = (skip // per_page) + 1
        
        # Handle score aliases
        if min_score is not None and min_overall_score is None:
            min_overall_score = min_score
        if max_score is not None and max_overall_score is None:
            max_overall_score = max_score
        
        # Convert status string to enum if provided
        status_enum = None
        if status:
            try:
                status_enum = ComparisonStatus(status.lower())
            except ValueError:
                # Handle legacy status values
                status_map = {
                    'complete': ComparisonStatus.COMPLETED,
                    'completed': ComparisonStatus.COMPLETED,
                    'pending': ComparisonStatus.PENDING,
                    'processing': ComparisonStatus.PROCESSING,
                    'failed': ComparisonStatus.FAILED,
                    'error': ComparisonStatus.FAILED
                }
                status_enum = status_map.get(status.lower())
        
        filters = ComparisonFilters(
            job_id=job_id,
            resume_id=resume_id,
            status=status_enum,
            candidate_name=candidate_name,
            company=company,
            min_overall_score=min_overall_score,
            max_overall_score=max_overall_score,
            min_skills_score=min_skills_score,
            created_after=created_after,
            created_before=created_before
        )
        
        result = comparison_service.list_comparisons(filters, page, per_page)
        
        # Update any "Unknown" candidate names with the latest data from resumes
        updated_comparisons = []
        needs_save = False
        for comparison in result.get('comparisons', []):
            if comparison.candidate_name == "Unknown":
                try:
                    resume_data = comparison_service.file_service.get_parsed_data(comparison.resume_id)
                    if resume_data:
                        candidate_name = resume_data.get('parsed_data', {}).get('personal_info', {}).get('name')
                        if candidate_name:
                            # Update the comparison with the correct candidate name
                            comparison.candidate_name = candidate_name
                            # Update in cache
                            cached_comparison = comparison_service._comparison_cache.get(comparison.id)
                            if cached_comparison:
                                cached_comparison.candidate_name = candidate_name
                            needs_save = True
                except Exception as e:
                    # Log the error but continue processing
                    logger.warning(f"Could not update candidate name for comparison {comparison.id}: {e}")
            updated_comparisons.append(comparison)
        
        # If any comparisons were updated, save the changes
        if needs_save:
            comparison_service._save_comparisons()
            # Update the result with the updated comparisons
            result['comparisons'] = updated_comparisons
        
        return ComparisonListResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list comparisons: {str(e)}")

# Create a new comparison
@router.post("/", response_model=ComparisonResponse)
async def create_comparison(request: CreateComparisonRequest):
    """Create a new resume-job comparison"""
    try:
        comparison = await comparison_service.create_comparison(
            resume_id=request.resume_id,
            job_id=request.job_id
        )
        return ComparisonResponse(
            success=True,
            message="Comparison created successfully",
            data=comparison.dict(),
            error=None
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create comparison: {str(e)}")

# Create batch comparison for multiple resumes against one job
@router.post("/batch", response_model=ComparisonResponse)
async def create_batch_comparison(request: BatchComparisonRequest):
    """Create batch comparison for multiple resumes against one job"""
    try:
        batch_result = await comparison_service.create_batch_comparison(request)
        return ComparisonResponse(
            success=True,
            message=f"Batch comparison created for {batch_result.total_comparisons} resumes",
            data=batch_result.dict(),
            error=None
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create batch comparison: {str(e)}")

@router.get("/batch/{batch_id}/status")
async def get_batch_status(batch_id: str):
    """Get the status of a batch comparison"""
    try:
        status = comparison_service.get_batch_status(batch_id)
        return status
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get batch status: {str(e)}")

# Get comparison statistics (must come before parameterized routes)
@router.get("/stats", response_model=ComparisonStatsResponse, summary="Get comparison statistics", description="Get comparison statistics including total comparisons, average score, top score, recent comparisons, and status breakdown.")
async def get_comparison_stats():
    """Get comparison statistics (alias for analytics/summary)"""
    try:
        result = comparison_service.list_comparisons()
        summary = result.get('summary')
        
        # Handle case when there are no comparisons yet
        if not summary:
            stats = {
                "total_comparisons": 0,
                "avg_score": 0.0,
                "top_score": 0.0,
                "recent_comparisons": 0,
                "status_breakdown": {}
            }
        else:
            # Get top score from top candidates
            top_score = 0.0
            if summary.top_candidates:
                top_score = max(
                    candidate.get('overall_score', 0) 
                    for candidate in summary.top_candidates
                )
            
            # Create status breakdown
            status_breakdown = {
                "completed": summary.completed_comparisons,
                "pending": summary.pending_comparisons,
                "failed": summary.failed_comparisons
            }
            
            # Calculate recent comparisons (last 7 days)
            from datetime import datetime, timedelta
            one_week_ago = datetime.utcnow() - timedelta(days=7)
            recent_comparisons = len([
                c for c in comparison_service._comparison_cache.values()
                if c.created_at >= one_week_ago
            ])
            
            # Format to match client expectations
            stats = {
                "total_comparisons": summary.total_comparisons,
                "avg_score": summary.average_overall_score,
                "top_score": top_score,
                "recent_comparisons": recent_comparisons,
                "status_breakdown": status_breakdown
            }
        
        return stats
    except Exception as e:
        # Return default stats instead of raising an error
        return {
            "total_comparisons": 0,
            "avg_score": 0.0,
            "top_score": 0.0,
            "recent_comparisons": 0,
            "status_breakdown": {}
        }

# Export comparisons (must come before parameterized routes)
@router.get("/export")
async def export_comparisons(
    format: str = Query("csv", description="Export format (csv or json)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    min_score: Optional[float] = Query(None, description="Minimum score filter"),
    max_score: Optional[float] = Query(None, description="Maximum score filter"),
    search: Optional[str] = Query(None, description="Search filter")
):
    """Export comparisons as CSV or JSON"""
    try:
        # Get filtered comparisons
        comparisons = [
            c for c in comparison_service._comparison_cache.values()
            if c.status == ComparisonStatus.COMPLETED and c.ats_score
        ]
        
        # Apply filters
        if status:
            comparisons = [c for c in comparisons if c.status.value == status.lower()]
        if job_id:
            comparisons = [c for c in comparisons if c.job_id == job_id]
        if min_score is not None:
            comparisons = [c for c in comparisons if c.ats_score.overall_score >= min_score]
        if max_score is not None:
            comparisons = [c for c in comparisons if c.ats_score.overall_score <= max_score]
        if search:
            search_lower = search.lower()
            comparisons = [c for c in comparisons if 
                         search_lower in c.candidate_name.lower() or 
                         search_lower in c.resume_filename.lower() or
                         search_lower in c.job_title.lower()]
        
        if format.lower() == "csv":
            return await _export_comparisons_csv(comparisons)
        else:
            return await _export_comparisons_json(comparisons)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@router.delete("/all", response_model=ComparisonResponse)
async def delete_all_comparisons():
    """Delete all comparisons"""
    try:
        # Get all comparison IDs
        all_comparison_ids = list(comparison_service._comparison_cache.keys())
        deleted_count = 0
        
        # Delete each comparison
        for comparison_id in all_comparison_ids:
            if comparison_service.delete_comparison(comparison_id):
                deleted_count += 1
        
        return ComparisonResponse(
            success=True,
            message=f"Successfully deleted all {deleted_count} comparisons",
            data={"deleted_count": deleted_count},
            error=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete all comparisons: {str(e)}")

# Parameterized routes (must come AFTER list routes)
@router.get("/{comparison_id}", response_model=ComparisonResponse)
async def get_comparison(comparison_id: str):
    """Get a specific comparison by ID"""
    comparison = comparison_service.get_comparison(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison not found")
    
    # If candidate name is "Unknown", try to update it with the latest data from resume
    if comparison.candidate_name == "Unknown":
        try:
            resume_data = comparison_service.file_service.get_parsed_data(comparison.resume_id)
            if resume_data:
                candidate_name = resume_data.get('parsed_data', {}).get('personal_info', {}).get('name')
                if candidate_name:
                    # Update the comparison with the correct candidate name
                    comparison.candidate_name = candidate_name
                    # Save the updated comparison
                    comparison_service._comparison_cache[comparison_id] = comparison
                    comparison_service._save_comparisons()
        except Exception as e:
            # Log the error but don't fail the request
            logger.warning(f"Could not update candidate name for comparison {comparison_id}: {e}")
    
    return ComparisonResponse(
        success=True,
        message="Comparison retrieved successfully",
        data=comparison.dict(),
        error=None
    )

@router.delete("/{comparison_id}", response_model=ComparisonResponse)
async def delete_comparison(comparison_id: str):
    """Delete a specific comparison"""
    success = comparison_service.delete_comparison(comparison_id)
    if not success:
        raise HTTPException(status_code=404, detail="Comparison not found")
    
    return ComparisonResponse(
        success=True,
        message="Comparison deleted successfully",
        data=None,
        error=None
    )

@router.get("/job/{job_id}", response_model=ComparisonResponse)
async def get_comparisons_by_job(job_id: str):
    """Get all comparisons for a specific job"""
    try:
        comparisons = comparison_service.get_comparisons_by_job(job_id)
        return ComparisonResponse(
            success=True,
            message=f"Found {len(comparisons)} comparisons for job",
            data=[comp.dict() for comp in comparisons],
            error=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job comparisons: {str(e)}")

@router.get("/resume/{resume_id}", response_model=ComparisonResponse)
async def get_comparisons_by_resume(resume_id: str):
    """Get all comparisons for a specific resume"""
    try:
        comparisons = comparison_service.get_comparisons_by_resume(resume_id)
        return ComparisonResponse(
            success=True,
            message=f"Found {len(comparisons)} comparisons for resume",
            data=[comp.dict() for comp in comparisons],
            error=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get resume comparisons: {str(e)}")

@router.get("/analytics/summary", response_model=ComparisonResponse)
async def get_comparison_summary():
    """Get summary statistics for all comparisons"""
    try:
        result = comparison_service.list_comparisons()
        summary = result['summary']
        return ComparisonResponse(
            success=True,
            message="Summary statistics retrieved successfully",
            data=summary.dict() if summary else {},
            error=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get summary: {str(e)}")

@router.get("/analytics/detailed", response_model=ComparisonResponse)
async def get_comparison_analytics():
    """Get detailed analytics for all comparisons"""
    try:
        analytics = comparison_service.get_analytics()
        return ComparisonResponse(
            success=True,
            message="Analytics retrieved successfully",
            data=analytics.dict(),
            error=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")

from pydantic import BaseModel

class BulkDeleteRequest(BaseModel):
    comparison_ids: List[str]

@router.delete("/bulk-delete", response_model=ComparisonResponse)
async def bulk_delete_comparisons(request: BulkDeleteRequest):
    """Delete multiple comparisons"""
    try:
        deleted_count = 0
        for comparison_id in request.comparison_ids:
            if comparison_service.delete_comparison(comparison_id):
                deleted_count += 1
        
        return ComparisonResponse(
            success=True,
            message=f"Successfully deleted {deleted_count} out of {len(request.comparison_ids)} comparisons",
            data={"deleted_count": deleted_count, "requested_count": len(request.comparison_ids)},
            error=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete: {str(e)}")

# Health check endpoint
@router.get("/health", response_model=Dict[str, Any])
async def comparison_health_check():
    """Health check for comparison service"""
    try:
        total_comparisons = len(comparison_service._comparison_cache)
        completed = len([
            c for c in comparison_service._comparison_cache.values() 
            if c.status == ComparisonStatus.COMPLETED
        ])
        pending = len([
            c for c in comparison_service._comparison_cache.values() 
            if c.status in [ComparisonStatus.PENDING, ComparisonStatus.PROCESSING]
        ])
        
        return {
            "status": "healthy",
            "service": "comparison_service",
            "statistics": {
                "total_comparisons": total_comparisons,
                "completed_comparisons": completed,
                "pending_comparisons": pending
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

# Utility endpoints
@router.post("/reprocess/{comparison_id}", response_model=ComparisonResponse)
async def reprocess_comparison(comparison_id: str):
    """Reprocess a failed or completed comparison"""
    try:
        comparison = comparison_service.get_comparison(comparison_id)
        if not comparison:
            raise HTTPException(status_code=404, detail="Comparison not found")
        
        # Reset comparison status and reprocess
        comparison.status = ComparisonStatus.PENDING
        comparison.ats_score = None
        comparison.error_message = None
        comparison.completed_at = None
        comparison.processing_time_seconds = None
        
        # Save and trigger reprocessing
        comparison_service._comparison_cache[comparison_id] = comparison
        comparison_service._save_comparisons()
        
        # Process asynchronously
        import asyncio
        asyncio.create_task(comparison_service._process_comparison(comparison_id))
        
        return ComparisonResponse(
            success=True,
            message="Comparison queued for reprocessing",
            data=comparison.dict(),
            error=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reprocess comparison: {str(e)}")

async def _export_comparisons_csv(comparisons):
    """Export comparisons as CSV with proper headers"""
    import io
    import csv
    from fastapi.responses import Response
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'Comparison ID', 'Candidate Name', 'Resume Filename', 'Job Title', 
        'Company', 'Overall Score', 'Skills Score', 'Experience Score', 
        'Education Score', 'Keywords Score', 'Matched Skills Count', 
        'Missing Skills Count', 'Created At', 'Processing Time (s)'
    ])
    
    # Write data rows
    for comp in comparisons:
        writer.writerow([
            comp.id,
            comp.candidate_name or '',
            comp.resume_filename,
            comp.job_title,
            comp.company,
            comp.ats_score.overall_score,
            comp.ats_score.skills_score,
            comp.ats_score.experience_score,
            comp.ats_score.education_score,
            comp.ats_score.keywords_score,
            len(comp.ats_score.matched_skills),
            len(comp.ats_score.missing_skills),
            comp.created_at.isoformat(),
            comp.processing_time_seconds or 0
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=comparisons-{datetime.now().strftime('%Y%m%d')}.csv"}
    )

async def _export_comparisons_json(comparisons):
    """Export comparisons as JSON"""
    import json
    from fastapi.responses import Response
    
    export_data = {
        "comparisons": [comp.dict() for comp in comparisons],
        "total": len(comparisons),
        "exported_at": datetime.now().isoformat()
    }
    
    return Response(
        content=json.dumps(export_data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=comparisons-{datetime.now().strftime('%Y%m%d')}.json"}
    )

# Legacy CSV export endpoint - deprecated in favor of /export?format=csv
# Keeping for backward compatibility but redirecting to new endpoint
@router.get("/export/csv", response_model=ComparisonResponse, deprecated=True)
async def export_comparisons_csv_legacy():
    """Legacy CSV export endpoint - use /export?format=csv instead"""
    # Redirect to new endpoint
    return await export_comparisons(format="csv")
