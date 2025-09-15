"""
API endpoints for ATS scoring and comparison functionality
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime

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

router = APIRouter(prefix="/api/comparisons", tags=["comparisons"])

# Initialize service
comparison_service = ComparisonService()

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
            data=comparison.dict()
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create comparison: {str(e)}")

@router.post("/batch", response_model=ComparisonResponse)
async def create_batch_comparison(request: BatchComparisonRequest):
    """Create batch comparison for multiple resumes against one job"""
    try:
        batch_result = await comparison_service.create_batch_comparison(request)
        return ComparisonResponse(
            success=True,
            message=f"Batch comparison created for {batch_result.total_comparisons} resumes",
            data=batch_result.dict()
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create batch comparison: {str(e)}")

@router.get("/", response_model=ComparisonListResponse)
async def list_comparisons(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    resume_id: Optional[str] = Query(None, description="Filter by resume ID"),
    status: Optional[ComparisonStatus] = Query(None, description="Filter by status"),
    candidate_name: Optional[str] = Query(None, description="Filter by candidate name"),
    company: Optional[str] = Query(None, description="Filter by company"),
    min_overall_score: Optional[float] = Query(None, ge=0, le=100, description="Minimum overall score"),
    max_overall_score: Optional[float] = Query(None, ge=0, le=100, description="Maximum overall score"),
    min_skills_score: Optional[float] = Query(None, ge=0, le=100, description="Minimum skills score"),
    created_after: Optional[datetime] = Query(None, description="Filter created after date"),
    created_before: Optional[datetime] = Query(None, description="Filter created before date")
):
    """List comparisons with filtering and pagination"""
    try:
        filters = ComparisonFilters(
            job_id=job_id,
            resume_id=resume_id,
            status=status,
            candidate_name=candidate_name,
            company=company,
            min_overall_score=min_overall_score,
            max_overall_score=max_overall_score,
            min_skills_score=min_skills_score,
            created_after=created_after,
            created_before=created_before
        )
        
        result = comparison_service.list_comparisons(filters, page, per_page)
        return ComparisonListResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list comparisons: {str(e)}")

@router.get("/{comparison_id}", response_model=ComparisonResponse)
async def get_comparison(comparison_id: str):
    """Get a specific comparison by ID"""
    comparison = comparison_service.get_comparison(comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison not found")
    
    return ComparisonResponse(
        success=True,
        message="Comparison retrieved successfully",
        data=comparison.dict()
    )

@router.delete("/{comparison_id}", response_model=ComparisonResponse)
async def delete_comparison(comparison_id: str):
    """Delete a specific comparison"""
    success = comparison_service.delete_comparison(comparison_id)
    if not success:
        raise HTTPException(status_code=404, detail="Comparison not found")
    
    return ComparisonResponse(
        success=True,
        message="Comparison deleted successfully"
    )

@router.get("/job/{job_id}", response_model=ComparisonResponse)
async def get_comparisons_by_job(job_id: str):
    """Get all comparisons for a specific job"""
    try:
        comparisons = comparison_service.get_comparisons_by_job(job_id)
        return ComparisonResponse(
            success=True,
            message=f"Found {len(comparisons)} comparisons for job",
            data=[comp.dict() for comp in comparisons]
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
            data=[comp.dict() for comp in comparisons]
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
            data=summary.dict() if summary else {}
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
            data=analytics.dict()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")

@router.post("/bulk-delete", response_model=ComparisonResponse)
async def bulk_delete_comparisons(comparison_ids: List[str]):
    """Delete multiple comparisons"""
    try:
        deleted_count = 0
        for comparison_id in comparison_ids:
            if comparison_service.delete_comparison(comparison_id):
                deleted_count += 1
        
        return ComparisonResponse(
            success=True,
            message=f"Successfully deleted {deleted_count} out of {len(comparison_ids)} comparisons",
            data={"deleted_count": deleted_count, "requested_count": len(comparison_ids)}
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
            data=comparison.dict()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reprocess comparison: {str(e)}")

@router.get("/export/csv", response_model=ComparisonResponse)
async def export_comparisons_csv():
    """Export comparison results as CSV data"""
    try:
        import io
        import csv
        
        comparisons = [
            c for c in comparison_service._comparison_cache.values()
            if c.status == ComparisonStatus.COMPLETED and c.ats_score
        ]
        
        if not comparisons:
            return ComparisonResponse(
                success=True,
                message="No completed comparisons to export",
                data={"csv_data": "", "row_count": 0}
            )
        
        # Create CSV content
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
        
        return ComparisonResponse(
            success=True,
            message=f"CSV export generated for {len(comparisons)} comparisons",
            data={"csv_data": csv_content, "row_count": len(comparisons)}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export CSV: {str(e)}")