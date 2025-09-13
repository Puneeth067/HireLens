from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

# Import route modules (will be created in next steps)
# from app.api.routes import upload, parse, compare

app = FastAPI(
    title="Resume Parser API",
    description="AI-powered resume parsing and job matching system",
    version="1.0.0"
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

# Mount uploads directory for file serving
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Resume Parser API is running",
        "version": "1.0.0",
        "status": "healthy"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "api": "online",
        "uploads_dir": str(uploads_dir.absolute()),
        "uploads_exists": uploads_dir.exists()
    }

# Route includes will be added here
# app.include_router(upload.router, prefix="/api/v1")
# app.include_router(parse.router, prefix="/api/v1") 
# app.include_router(compare.router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True
    )