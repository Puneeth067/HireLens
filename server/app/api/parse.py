"""
Resume Parsing API Endpoints
FastAPI endpoints for resume parsing functionality
"""
import os
import json
import uuid
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.models.resume import (
    ParsedResume, ParseResponse, BatchParseResponse, ParseStatus as ParseStatusEnum,
    PersonalInfo, Experience, Education, Skills, ParsedData, ResumeFileMetadata
)
from app.services.resume_parser_service import ResumeParserService
from app.services.file_service import FileService
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/parse", tags=["parsing"])

# Import BaseModel for the response class
from pydantic import BaseModel

# Create a ParseStatus response model
class ParseStatusResponse(BaseModel):
    file_id: str
    status: str
    message: str = ""
    parsed_at: Optional[datetime] = None
    filename: str = ""
def get_resume_parser() -> ResumeParserService:
    return ResumeParserService()

def get_file_service() -> FileService:
    return FileService()

@router.post("/single/{file_id}", response_model=ParseResponse)
async def parse_single_resume(
    file_id: str,
    background_tasks: BackgroundTasks,
    parser: ResumeParserService = Depends(get_resume_parser),
    file_service: FileService = Depends(get_file_service)
):
    """
    Parse a single uploaded resume file
    """
    try:
        # Get file metadata
        file_metadata = file_service.get_file_metadata(file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        file_path = os.path.join(settings.UPLOAD_DIR, file_metadata['filename'])
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        # Update status to processing
        file_service.update_file_status(file_id, "processing")
        
        try:
            # Parse the resume
            parsed_resume = parser.parse_resume(file_path, file_metadata['original_filename'])
            
            # Save parsed data
            parsed_data = parsed_resume.model_dump()
            file_service.save_parsed_data(file_id, parsed_data)
            
            # Update status to completed
            file_service.update_file_status(file_id, "completed")
            
            return ParseResponse(
                success=True,
                file_id=file_id,
                filename=file_metadata['original_filename'],
                status=ParseStatusEnum.COMPLETED,
                parsed_data=parsed_resume.parsed_data if hasattr(parsed_resume, 'parsed_data') else None,
                raw_text=parsed_resume.raw_text if hasattr(parsed_resume, 'raw_text') else None,
                metadata=parsed_resume.metadata if hasattr(parsed_resume, 'metadata') else None,
                confidence_score=0.85  # Default confidence score
            )
            
        except Exception as e:
            # Update status to error
            file_service.update_file_status(file_id, "error", str(e))
            raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error parsing resume {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/batch", response_model=BatchParseResponse)
async def parse_batch_resumes(
    file_ids: List[str],
    background_tasks: BackgroundTasks,
    parser: ResumeParserService = Depends(get_resume_parser),
    file_service: FileService = Depends(get_file_service)
):
    """
    Parse multiple resume files in batch
    """
    try:
        results = []
        successful_parses = 0
        failed_parses = 0
        
        for file_id in file_ids:
            file_metadata = None  # Initialize to avoid unbound variable
            try:
                # Get file metadata
                file_metadata = file_service.get_file_metadata(file_id)
                if not file_metadata:
                    results.append(ParseResponse(
                        success=False,
                        file_id=file_id,
                        filename="unknown",
                        status=ParseStatusEnum.FAILED,
                        error_message="File metadata not found",
                        confidence_score=0.0
                    ))
                    failed_parses += 1
                    continue
                
                file_path = os.path.join(settings.UPLOAD_DIR, file_metadata['filename'])
                
                if not os.path.exists(file_path):
                    results.append(ParseResponse(
                        success=False,
                        file_id=file_id,
                        filename=file_metadata.get('original_filename', 'unknown'),
                        status=ParseStatusEnum.FAILED,
                        error_message="File not found on disk",
                        confidence_score=0.0
                    ))
                    failed_parses += 1
                    continue
                
                # Update status to processing
                file_service.update_file_status(file_id, "processing")
                
                # Parse the resume
                parsed_resume = parser.parse_resume(file_path, file_metadata['original_filename'])
                
                # Save parsed data
                parsed_data = parsed_resume.model_dump()
                file_service.save_parsed_data(file_id, parsed_data)
                
                # Update status to completed
                file_service.update_file_status(file_id, "completed")
                
                results.append(ParseResponse(
                    success=True,
                    file_id=file_id,
                    filename=file_metadata['original_filename'],
                    status=ParseStatusEnum.COMPLETED,
                    parsed_data=parsed_resume.parsed_data if hasattr(parsed_resume, 'parsed_data') else None,
                    raw_text=parsed_resume.raw_text if hasattr(parsed_resume, 'raw_text') else None,
                    metadata=parsed_resume.metadata if hasattr(parsed_resume, 'metadata') else None,
                    confidence_score=0.85  # Default confidence score
                ))
                successful_parses += 1
                
            except Exception as e:
                # Update status to error
                file_service.update_file_status(file_id, "error", str(e))
                # Get filename before potential error
                filename = file_metadata.get('original_filename', 'unknown') if file_metadata else 'unknown'
                results.append(ParseResponse(
                    success=False,
                    file_id=file_id,
                    filename=filename,
                    status=ParseStatusEnum.FAILED,
                    error_message=f"Parsing failed: {str(e)}",
                    confidence_score=0.0
                ))
                failed_parses += 1
        
        return BatchParseResponse(
            success=True,
            batch_id=str(uuid.uuid4()),
            total_files=len(file_ids),
            processed_files=successful_parses + failed_parses,
            successful_parses=successful_parses,
            failed_parses=failed_parses,
            results=results,
            overall_status=ParseStatusEnum.COMPLETED if failed_parses == 0 else ParseStatusEnum.PARTIAL
        )
        
    except Exception as e:
        logger.error(f"Unexpected error in batch parsing: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/status/{file_id}", response_model=ParseStatusResponse)
async def get_parse_status(
    file_id: str,
    file_service: FileService = Depends(get_file_service)
):
    """
    Get parsing status for a specific file
    """
    try:
        file_metadata = file_service.get_file_metadata(file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        return ParseStatusResponse(
            file_id=file_id,
            status=file_metadata.get('status', 'pending'),
            message=file_metadata.get('error_message', ''),
            parsed_at=file_metadata.get('parsed_at'),
            filename=file_metadata.get('original_filename', '')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting parse status for {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/result/{file_id}", response_model=ParsedResume)
async def get_parsed_resume(
    file_id: str,
    file_service: FileService = Depends(get_file_service)
):
    """
    Get parsed resume data for a specific file
    """
    try:
        parsed_data = file_service.get_parsed_data(file_id)
        if not parsed_data:
            raise HTTPException(status_code=404, detail="Parsed data not found")
        
        # Convert back to ParsedResume object
        return ParsedResume(**parsed_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting parsed resume for {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/result/{file_id}")
async def delete_parsed_resume(
    file_id: str,
    file_service: FileService = Depends(get_file_service)
):
    """
    Delete parsed resume data and file
    """
    try:
        success = file_service.delete_file(file_id)
        if not success:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {"message": "File and parsed data deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/parsed-resumes")
async def get_all_parsed_resumes(
    file_service: FileService = Depends(get_file_service)
):
    """
    Get all parsed resumes (completed files with parsed data)
    """
    try:
        all_files = file_service.get_all_files()
        parsed_resumes = []
        
        for file_data in all_files:
            if file_data.get('status') == 'completed':
                parsed_data = file_service.get_parsed_data(file_data['file_id'])
                if parsed_data:
                    parsed_resumes.append(ParsedResume(**parsed_data))
        
        return {
            "parsed_resumes": parsed_resumes,
            "total": len(parsed_resumes)
        }
        
    except Exception as e:
        logger.error(f"Error getting parsed resumes: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/parsed-resumes/{file_id}", response_model=ParsedResume)
async def get_parsed_resume_by_id(
    file_id: str,
    file_service: FileService = Depends(get_file_service)
):
    """
    Alias for get_parsed_resume for backward compatibility
    """
    return await get_parsed_resume(file_id, file_service)

@router.get("/stats")
async def get_parsing_stats(
    file_service: FileService = Depends(get_file_service)
):
    """
    Get overall parsing statistics
    """
    try:
        all_files = file_service.get_all_files()
        
        stats = {
            'total_files': len(all_files),
            'completed': 0,
            'processing': 0,
            'pending': 0,
            'error': 0,
            'recent_activity': []
        }
        
        # Count by status and get recent activity
        for file_data in all_files:
            status = file_data.get('status', 'pending')
            stats[status] = stats.get(status, 0) + 1
            
            # Add to recent activity if processed recently
            if file_data.get('parsed_at'):
                stats['recent_activity'].append({
                    'file_id': file_data['file_id'],
                    'filename': file_data.get('original_filename', ''),
                    'status': status,
                    'parsed_at': file_data.get('parsed_at')
                })
        
        # Sort recent activity by date
        stats['recent_activity'].sort(
            key=lambda x: x.get('parsed_at', ''), 
            reverse=True
        )
        stats['recent_activity'] = stats['recent_activity'][:10]  # Last 10 activities
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting parsing stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
