# server/app/config.py - Updated to work with your existing structure and new services

import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    """Application settings and configuration."""
    
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Resume Parser and ATS Scoring API"  # Updated name
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "API for parsing resumes, managing jobs, and ATS scoring"  # Updated description
    
    # CORS Settings
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ]
    
    # For backward compatibility with new services
    allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ]
    
    # File Upload Settings
    UPLOAD_DIR: str = "uploads"
    upload_dir: str = "uploads"  # For compatibility with new services
    
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".docx", ".doc"]  # Added .doc for better compatibility
    
    # Processing Settings
    ENABLE_ASYNC_PROCESSING: bool = True
    MAX_CONCURRENT_PROCESSES: int = 4
    
    # Database Settings (for future use)
    DATABASE_URL: str = "sqlite:///./resume_parser.db"
    
    # AI/ML Settings
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    MODEL_NAME: str = "gpt-3.5-turbo"
    
    # Logging Settings
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "app.log"
    
    # Security Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    
    # ATS Scoring Settings (new)
    ATS_SKILLS_WEIGHT_DEFAULT: float = 40.0
    ATS_EXPERIENCE_WEIGHT_DEFAULT: float = 30.0
    ATS_EDUCATION_WEIGHT_DEFAULT: float = 15.0
    ATS_KEYWORDS_WEIGHT_DEFAULT: float = 15.0
    
    # Comparison Settings (new)
    MAX_BATCH_COMPARISONS: int = 50
    COMPARISON_TIMEOUT_SECONDS: int = 300  # 5 minutes
    
    class Config:
        case_sensitive = True
        env_file = ".env"

# Create settings instance
settings = Settings()

# For compatibility with new services that expect get_settings() function
def get_settings() -> Settings:
    return settings

# Ensure upload directory structure exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "resumes"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "temp"), exist_ok=True)

# Create additional directories for new services
os.makedirs(os.path.join(settings.UPLOAD_DIR, "files"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "parsed"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "jobs"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "comparisons"), exist_ok=True)