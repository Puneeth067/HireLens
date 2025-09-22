# server/app/main.py - Fixed API Routes

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging

import os
import time
from pathlib import Path
import psutil
import sys
import subprocess
import importlib

# Import route modules - using your config structure
from app.config import settings
from app.api.upload import router as upload
from app.api.parse import router as parse
from app.api.jobs import router as jobs
from app.api.comparisons import router as comparisons
from app.api.analytics import router as analytics 
from app.api.ranking import router as ranking  

# Configure logging
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL))
logger = logging.getLogger(__name__)

def install_spacy_model():
    """Install spaCy English model at runtime with robust error handling"""
    try:
        logger.info("Attempting to install spaCy English model...")
        
        # Method 1: Direct spacy download command
        result = subprocess.run([
            sys.executable, "-m", "spacy", "download", "en_core_web_sm"
        ], check=True, capture_output=True, text=True, timeout=300)  # 5 minute timeout
        
        logger.info("spaCy English model installed successfully")
        logger.debug(f"spaCy download output: {result.stdout}")
        return True
        
    except subprocess.TimeoutExpired:
        logger.error("spaCy model installation timed out")
        return False
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to install spaCy model via spacy download: {e}")
        logger.error(f"Error output: {e.stderr}")
        
        # Method 2: Try pip install directly from GitHub (fallback)
        try:
            logger.info("Trying alternative installation method...")
            result = subprocess.run([
                sys.executable, "-m", "pip", "install", 
                "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl"
            ], check=True, capture_output=True, text=True, timeout=300)
            
            logger.info("spaCy English model installed via pip successfully")
            logger.debug(f"Pip install output: {result.stdout}")
            return True
            
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as e2:
            logger.error(f"Alternative installation method also failed: {e2}")
            if isinstance(e2, subprocess.CalledProcessError):
                logger.error(f"Error output: {e2.stderr}")
            return False
    except Exception as e:
        logger.error(f"Unexpected error during spaCy model installation: {e}")
        return False

def verify_and_install_spacy_model():
    """Verify spaCy model installation and install if missing"""
    try:
        import spacy
        
        # Try to load the model
        try:
            spacy.load("en_core_web_sm")
            logger.info("spaCy English model loaded successfully")
            return True
        except OSError:
            logger.warning("spaCy English model not found, attempting installation...")
            if install_spacy_model():
                # Try to load again after installation
                try:
                    importlib.reload(spacy)  # Reload spacy module
                    spacy.load("en_core_web_sm")
                    logger.info("spaCy English model loaded successfully after installation")
                    return True
                except Exception as e:
                    logger.error(f"Failed to load spaCy model after installation: {e}")
                    return False
            else:
                logger.error("Failed to install spaCy English model")
                return False
        except Exception as e:
            logger.error(f"Error loading spaCy model: {e}")
            return False
            
    except ImportError as e:
        logger.error(f"spaCy not installed: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error checking spaCy model: {e}")
        return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    logger.info("Starting Resume Parser API with Analytics...")
    
    # Create necessary directories using your config structure
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "resumes"), exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "temp"), exist_ok=True)
    
    # Create additional directories for our services
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "parsed"), exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "jobs"), exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "comparisons"), exist_ok=True)
    os.makedirs("data/rankings", exist_ok=True)

    
    # CREATE DATA DIRECTORY FOR ANALYTICS - ADD THIS
    data_dir = getattr(settings, 'DATA_DIR', os.path.join(settings.UPLOAD_DIR, "data"))
    os.makedirs(data_dir, exist_ok=True)
    
    # Download required NLTK data
    try:
        import nltk
        import ssl
        try:
            _create_unverified_https_context = ssl._create_unverified_context
        except AttributeError:
            pass
        else:
            ssl._create_default_https_context = _create_unverified_https_context
            
        nltk.download('punkt', quiet=True)
        nltk.download('stopwords', quiet=True)
        nltk.download('wordnet', quiet=True)
        nltk.download('averaged_perceptron_tagger', quiet=True)
        logger.info("NLTK data downloaded successfully")
    except Exception as e:
        logger.warning(f"Failed to download NLTK data: {e}")
    
    # Handle spaCy model download/installation at runtime
    if verify_and_install_spacy_model():
        logger.info("spaCy model handling completed successfully")
    else:
        logger.warning("spaCy model handling failed. Application will run with limited NLP features.")
    
    # Check scikit-learn availability for ATS scoring
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        logger.info("scikit-learn available for ATS scoring")
    except ImportError as e:
        logger.warning(f"scikit-learn not available - ATS scoring will be limited: {e}")
        logger.info("Install scikit-learn with: pip install scikit-learn")
    
    # INITIALIZE ANALYTICS SERVICE - ADD THIS
    try:
        from app.services.analytics_service import analytics_service
        logger.info("Analytics service initialized successfully")
    except Exception as e:
        logger.warning(f"Analytics service initialization warning: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Resume Parser API...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION + "\n\n## New Features\n* Advanced Analytics Dashboard\n* Skills Gap Analysis\n* Hiring Trends and Insights\n* Performance Metrics and Reporting",
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory structure matching your config
uploads_dir = Path(settings.UPLOAD_DIR)
uploads_dir.mkdir(exist_ok=True)

# Create subdirectories
(uploads_dir / "resumes").mkdir(exist_ok=True)
(uploads_dir / "temp").mkdir(exist_ok=True)
(uploads_dir / "parsed").mkdir(exist_ok=True)
(uploads_dir / "jobs").mkdir(exist_ok=True)
(uploads_dir / "comparisons").mkdir(exist_ok=True)

# Mount uploads directory for file serving
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": f"{settings.PROJECT_NAME} is running",
        "version": settings.VERSION,
        "status": "healthy",
        "description": settings.DESCRIPTION,
        "features": [
            "Resume parsing and text extraction",
            "AI-powered skills and experience analysis", 
            "ATS scoring with configurable weights",
            "Bulk processing capabilities",
            "Advanced analytics and reporting",
            "Skill gap analysis and market insights",
            "Job performance tracking"
        ],
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/api/health",
            "system": "/api/system/info",
            "upload": "/api/upload",
            "parse": "/api/parse", 
            "jobs": "/api/jobs",
            "comparisons": "/api/comparisons",
            "analytics": "/api/analytics",
            "ranking": "/api/ranking" 
        }
    }

# FIXED: Add /api prefix to health endpoint
@app.get("/api/health")
async def health_check():
    """Enhanced health check endpoint with analytics status"""
    try:
        # Check system resources
        cpu_percent = psutil.cpu_percent()
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Check directory existence using your config
        upload_dir_exists = os.path.exists(settings.UPLOAD_DIR)
        resumes_dir_exists = os.path.exists(os.path.join(settings.UPLOAD_DIR, "resumes"))
        temp_dir_exists = os.path.exists(os.path.join(settings.UPLOAD_DIR, "temp"))
        
        # CHECK ANALYTICS DATA DIRECTORY - ADD THIS
        data_dir = getattr(settings, 'DATA_DIR', os.path.join(settings.UPLOAD_DIR, "data"))
        data_dir_exists = os.path.exists(data_dir)
        
        # Check dependencies
        dependencies_ok = True
        missing_deps = []
        
        # Check spaCy
        spacy_available = False
        try:
            import spacy
            spacy.load("en_core_web_sm")
            spacy_available = True
        except:
            dependencies_ok = False
            missing_deps.append("spacy en_core_web_sm model")
        
        # Check NLTK
        nltk_available = False
        try:
            import nltk
            nltk.data.find('tokenizers/punkt')
            nltk_available = True
        except:
            dependencies_ok = False
            missing_deps.append("nltk punkt tokenizer")
        
        # Check scikit-learn for ATS scoring
        sklearn_available = False
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            sklearn_available = True
        except ImportError:
            missing_deps.append("scikit-learn (for ATS scoring)")
        
        # Get service statistics
        try:
            from app.services.file_service import FileService
            from app.services.job_service import JobService
            from app.services.comparison_service import ComparisonService
            from app.services.analytics_service import analytics_service  
            from app.services.ranking_service import RankingService
            
            file_service = FileService()
            job_service = JobService()
            comparison_service = ComparisonService(job_service_instance=job_service)
            ranking_service = RankingService()
            
            file_stats = file_service.get_file_stats()
            job_stats = job_service.get_job_stats()
            comparison_stats = {
                "total_comparisons": len(comparison_service._comparison_cache),
                "completed": len([
                    c for c in comparison_service._comparison_cache.values() 
                    if c.status.value == "completed"
                ]),
                "pending": len([
                    c for c in comparison_service._comparison_cache.values() 
                    if c.status.value in ["pending", "processing"]
                ]),
                "failed": len([
                    c for c in comparison_service._comparison_cache.values() 
                    if c.status.value == "failed"
                ])
            }
            ranking_stats = {
                "total_rankings": len(os.listdir("data/rankings")) if os.path.exists("data/rankings") else 0
            }
            
            analytics_stats = analytics_service.get_overview_metrics(days=1)
            analytics_available = True
            
        except Exception as e:
            logger.warning(f"Could not get service statistics: {e}")
            file_stats = {"error": "Service unavailable"}
            job_stats = {"error": "Service unavailable"}
            comparison_stats = {"error": "Service unavailable"}
            analytics_stats = {"error": "Service unavailable"}
            ranking_stats = {"error": "Service unavailable"}
            analytics_available = False
        
        # Determine overall status
        all_dirs_exist = upload_dir_exists and resumes_dir_exists and temp_dir_exists and data_dir_exists
        status = "healthy" if dependencies_ok and all_dirs_exist else "degraded"
        ats_status = "operational" if spacy_available and sklearn_available else "limited"
        
        return {
            "status": status,
            "timestamp": time.time(),
            "version": settings.VERSION,
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "disk_percent": (disk.used / disk.total) * 100,
                "python_version": sys.version.split()[0]
            },
            "directories": {
                "upload_dir": upload_dir_exists,
                "resumes_dir": resumes_dir_exists,
                "temp_dir": temp_dir_exists,
                "data_dir": data_dir_exists,
                "upload_path": settings.UPLOAD_DIR
            },
            "services": {
                "file_service": "operational" if isinstance(file_stats, dict) and "error" not in file_stats else "degraded",
                "job_service": "operational" if isinstance(job_stats, dict) and "error" not in job_stats else "degraded", 
                "comparison_service": "operational" if isinstance(comparison_stats, dict) and "error" not in comparison_stats else "degraded",
                "analytics_service": "operational" if analytics_available else "degraded",
                "ranking_service": "operational",
                "ats_scoring": ats_status
            },
            "dependencies": {
                "status": "ok" if dependencies_ok else "missing",
                "spacy": spacy_available,
                "nltk": nltk_available,
                "sklearn": sklearn_available,
                "missing": missing_deps
            },
            "statistics": {
                "files": file_stats,
                "jobs": job_stats,
                "comparisons": comparison_stats,
                "analytics": analytics_stats,
                "rankings": ranking_stats
            },
            "configuration": {
                "max_file_size_mb": settings.MAX_FILE_SIZE / (1024 * 1024),
                "allowed_extensions": settings.ALLOWED_EXTENSIONS,
                "async_processing": settings.ENABLE_ASYNC_PROCESSING,
                "max_concurrent_processes": settings.MAX_CONCURRENT_PROCESSES
            }
        }
    
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": time.time()
        }

# FIXED: Add /api prefix to system info endpoint
@app.get("/api/system/info")
async def system_info():
    """Detailed system information endpoint with analytics"""
    try:
        from app.services.file_service import FileService
        from app.services.job_service import JobService
        from app.services.comparison_service import ComparisonService
        from app.services.analytics_service import analytics_service
        
        file_service = FileService()
        job_service = JobService()
        comparison_service = ComparisonService(job_service_instance=job_service)
        
        # Get detailed statistics
        file_stats = file_service.get_file_stats()
        job_stats = job_service.get_job_stats()
        
        # Get comparison analytics
        try:
            comparison_analytics = comparison_service.get_analytics()
            comparison_data = comparison_analytics.dict()
        except Exception as e:
            logger.warning(f"Could not get comparison analytics: {e}")
            comparison_data = {"error": "Analytics unavailable"}
        
        # ADD ANALYTICS DATA
        try:
            analytics_overview = analytics_service.get_overview_metrics(days=30)
            analytics_data = analytics_overview
        except Exception as e:
            logger.warning(f"Could not get analytics overview: {e}")
            analytics_data = {"error": "Analytics unavailable"}
        
        # System resource information
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get directory sizes
        def get_dir_size(path):
            try:
                total = 0
                for dirpath, dirnames, filenames in os.walk(path):
                    for filename in filenames:
                        total += os.path.getsize(os.path.join(dirpath, filename))
                return total / (1024 * 1024)  # Convert to MB
            except:
                return 0
        
        upload_size = get_dir_size(settings.UPLOAD_DIR)
        
        return {
            "system": {
                "cpu_usage_percent": cpu_percent,
                "memory": {
                    "total_gb": round(memory.total / (1024**3), 2),
                    "available_gb": round(memory.available / (1024**3), 2),
                    "usage_percent": memory.percent
                },
                "disk": {
                    "total_gb": round(disk.total / (1024**3), 2),
                    "used_gb": round(disk.used / (1024**3), 2),
                    "free_gb": round(disk.free / (1024**3), 2),
                    "usage_percent": round((disk.used / disk.total) * 100, 2)
                }
            },
            "application": {
                "upload_directory_size_mb": round(upload_size, 2),
                "configuration": {
                    "upload_dir": settings.UPLOAD_DIR,
                    "max_file_size_mb": settings.MAX_FILE_SIZE / (1024 * 1024),
                    "allowed_extensions": settings.ALLOWED_EXTENSIONS,
                    "log_level": settings.LOG_LEVEL
                },
                "files": file_stats,
                "jobs": job_stats,
                "comparisons": comparison_data,
                "analytics": analytics_data
            },
            "timestamp": time.time()
        }
        
    except Exception as e:
        logger.error(f"System info failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get system info: {str(e)}")

# Include API routers
app.include_router(upload)
app.include_router(parse)
app.include_router(jobs)
app.include_router(comparisons)
app.include_router(analytics)  
app.include_router(ranking)

# Global exception handlers
## @app.exception_handler(404)
#    # async def not_found_handler(request, exc):
#    """Custom 404 handler"""
#    from fastapi.responses import JSONResponse
#    return JSONResponse(
#        status_code=404,
#        content={
#            "error": "Not Found",
#            "message": f"The requested endpoint was not found",
#            "status_code": 404,
#            "timestamp": time.time()
#        }
#    )
#
@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Custom 500 handler"""
    logger.error(f"Internal server error: {exc}")
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An internal server error occurred",
            "status_code": 500,
            "timestamp": time.time()
        }
    )

if __name__ == "__main__":
    import uvicorn
    import os
    
    # Get port from environment variable or default to 8000
    port = int(os.environ.get("PORT", 8000))
    
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=port, 
        reload=True
    )