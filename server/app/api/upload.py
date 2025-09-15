from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List, Optional
import shutil
import os
import uuid
from datetime import datetime
import mimetypes

from app.models.resume import FileMetadata, UploadResponse, ErrorResponse
from app.services.file_service import FileService
from app.config import settings

router = APIRouter(prefix="/api/upload", tags=["upload"])

# Initialize file service
file_service = FileService()

# Allowed file types
ALLOWED_EXTENSIONS = {'.pdf', '.docx'}
ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def validate_file(file: UploadFile) -> bool:
    """Validate uploaded file type and size."""
    # Check file extension
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        return False
    
    # Check MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        return False
    
    return True

def get_file_size(file: UploadFile) -> int:
    """Get file size by reading the content."""
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    return size

@router.post("/single", response_model=UploadResponse)
async def upload_single_resume(file: UploadFile = File(...)):
    """Upload and process a single resume file."""
    try:
        # Validate file
        if not validate_file(file):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Check file size
        file_size = get_file_size(file)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File size too large. Maximum allowed: {MAX_FILE_SIZE / (1024*1024):.1f}MB"
            )
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1].lower()
        unique_filename = f"{file_id}{file_extension}"
        
        # Save file to uploads directory
        upload_dir = os.path.join(settings.UPLOAD_DIR, "resumes")
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Create file metadata
        metadata = FileMetadata(
            id=file_id,
            filename=file.filename,
            original_filename=file.filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=file.content_type,
            uploaded_at=datetime.now(),
            status="uploaded"
        )
        
        # Store metadata (in a real app, this would go to a database)
        file_service.store_metadata(metadata)
        
        return UploadResponse(
            success=True,
            message="File uploaded successfully",
            file_id=file_id,
            metadata=metadata
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/bulk", response_model=UploadResponse)
async def upload_bulk_resumes(files: List[UploadFile] = File(...)):
    """Upload and process multiple resume files."""
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files allowed")
    
    try:
        uploaded_files = []
        errors = []
        
        for file in files:
            try:
                # Validate each file
                if not validate_file(file):
                    errors.append(f"{file.filename}: Invalid file type")
                    continue
                
                # Check file size
                file_size = get_file_size(file)
                if file_size > MAX_FILE_SIZE:
                    errors.append(f"{file.filename}: File too large")
                    continue
                
                # Generate unique filename
                file_id = str(uuid.uuid4())
                file_extension = os.path.splitext(file.filename)[1].lower()
                unique_filename = f"{file_id}{file_extension}"
                
                # Save file
                upload_dir = os.path.join(settings.UPLOAD_DIR, "resumes")
                os.makedirs(upload_dir, exist_ok=True)
                file_path = os.path.join(upload_dir, unique_filename)
                
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                
                # Create metadata
                metadata = FileMetadata(
                    id=file_id,
                    filename=file.filename,
                    original_filename=file.filename,
                    file_path=file_path,
                    file_size=file_size,
                    mime_type=file.content_type,
                    uploaded_at=datetime.now(),
                    status="uploaded"
                )
                
                file_service.store_metadata(metadata)
                uploaded_files.append(metadata)
                
            except Exception as e:
                errors.append(f"{file.filename}: {str(e)}")
        
        if not uploaded_files:
            raise HTTPException(status_code=400, detail="No files were successfully uploaded")
        
        return UploadResponse(
            success=True,
            message=f"Successfully uploaded {len(uploaded_files)} files",
            files=uploaded_files,
            errors=errors if errors else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk upload failed: {str(e)}")

@router.get("/status/{file_id}")
async def get_upload_status(file_id: str):
    """Get the status of an uploaded file."""
    try:
        metadata = file_service.get_metadata(file_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            "file_id": file_id,
            "status": metadata.status,
            "filename": metadata.filename,
            "uploaded_at": metadata.uploaded_at
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")

@router.delete("/{file_id}")
async def delete_uploaded_file(file_id: str):
    """Delete an uploaded file."""
    try:
        metadata = file_service.get_metadata(file_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete physical file
        if os.path.exists(metadata.file_path):
            os.remove(metadata.file_path)
        
        # Delete metadata
        file_service.delete_metadata(file_id)
        
        return {"message": "File deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

@router.get("/list")
async def list_uploaded_files():
    """List all uploaded files."""
    try:
        files = file_service.list_files()
        return {
            "files": files,
            "total": len(files)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"List files failed: {str(e)}")