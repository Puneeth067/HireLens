from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
from app.utils.logger import logger

router = APIRouter(prefix="/api/logging", tags=["logging"])

class LogEntry(BaseModel):
    timestamp: str
    level: str
    message: str
    context: Optional[Dict[str, Any]] = None
    userId: Optional[str] = None
    sessionId: Optional[str] = None
    url: Optional[str] = None
    userAgent: Optional[str] = None
    stack: Optional[str] = None
    component: Optional[str] = None
    action: Optional[str] = None

class LogRequest(BaseModel):
    logs: List[LogEntry]
    metadata: Optional[Dict[str, Any]] = None

@router.post("/frontend")
async def log_frontend_messages(log_request: LogRequest):
    """Receive and process frontend logs"""
    try:
        # Process each log entry
        for log_entry in log_request.logs:
            # Add context from metadata
            context = log_entry.context or {}
            if log_request.metadata:
                context.update(log_request.metadata)
            
            # Log based on level
            if log_entry.level == "error":
                logger.error(f"Frontend Error: {log_entry.message}", **context)
            elif log_entry.level == "warn":
                logger.warning(f"Frontend Warning: {log_entry.message}", **context)
            elif log_entry.level == "info":
                logger.info(f"Frontend Info: {log_entry.message}", **context)
            elif log_entry.level == "debug":
                logger.debug(f"Frontend Debug: {log_entry.message}", **context)
        
        return {"success": True, "message": f"Processed {len(log_request.logs)} log entries"}
    except Exception as e:
        logger.error(f"Failed to process frontend logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process logs")