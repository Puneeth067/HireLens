# server/app/utils/logger.py - Enhanced backend logging system

import json
import logging
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Union
import uuid
import functools
import asyncio
from contextlib import contextmanager

# Third-party imports
try:
    import structlog  # type: ignore
    HAS_STRUCTLOG = True
except ImportError:
    structlog = None  # type: ignore
    HAS_STRUCTLOG = False


class PerformanceTimer:
    """Context manager for performance timing"""
    
    def __init__(self, operation_name: str, logger_instance=None):
        self.operation_name = operation_name
        self.logger = logger_instance
        self.start_time = None
        self.end_time = None
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time is not None:
            self.end_time = time.perf_counter()
            duration = (self.end_time - self.start_time) * 1000  # Convert to milliseconds
            
            if self.logger:
                self.logger.info(
                    f"Performance: {self.operation_name}",
                    extra={
                        "operation": self.operation_name,
                        "duration_ms": round(duration, 2),
                        "performance_metric": True
                    }
                )


class StructuredLogger:
    """Enhanced structured logging with performance metrics and context tracking"""
    
    def __init__(
        self,
        name: str = "hirelens",
        level: str = "INFO",
        log_file: Optional[str] = None,
        enable_console: bool = True,
        enable_structured: bool = True,
        enable_performance: bool = True
    ):
        self.name = name
        self.level = level.upper()
        self.enable_performance = enable_performance
        self.request_id = None
        self.user_id = None
        
        # Setup logging
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, self.level))
        
        # Clear existing handlers
        self.logger.handlers.clear()
        
        # Create formatters
        if enable_structured and HAS_STRUCTLOG:
            self._setup_structured_logging()
        else:
            self._setup_standard_logging(log_file, enable_console)
    
    def _setup_structured_logging(self):
        """Setup structured logging with structlog"""
        if not HAS_STRUCTLOG or structlog is None:
            # Fallback to standard logging if structlog is not available
            self._setup_standard_logging(None, True)
            return
            
        structlog.configure(
            processors=[
                structlog.stdlib.filter_by_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.stdlib.PositionalArgumentsFormatter(),
                structlog.processors.TimeStamper(fmt="ISO"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.UnicodeDecoder(),
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )
        
        # Add console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(getattr(logging, self.level))
        self.logger.addHandler(console_handler)
        
        self.structured_logger = structlog.get_logger(self.name)
    
    def _setup_standard_logging(self, log_file: Optional[str], enable_console: bool):
        """Setup standard logging"""
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s - '
            '[%(filename)s:%(lineno)d] - {%(funcName)s}'
        )
        
        # Console handler
        if enable_console:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(getattr(logging, self.level))
            console_handler.setFormatter(formatter)
            self.logger.addHandler(console_handler)
        
        # File handler
        if log_file:
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(getattr(logging, self.level))
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)
    
    def _get_extra_context(self, **kwargs) -> Dict[str, Any]:
        """Get extra context for logging"""
        context = {
            "timestamp": datetime.utcnow().isoformat(),
            "service": "hirelens-backend",
        }
        
        if self.request_id:
            context["request_id"] = self.request_id
        
        if self.user_id:
            context["user_id"] = self.user_id
        
        context.update(kwargs)
        return context
    
    def set_request_context(self, request_id: Optional[str] = None, user_id: Optional[str] = None):
        """Set request context for logging"""
        self.request_id = request_id or str(uuid.uuid4())
        self.user_id = user_id
    
    def clear_request_context(self):
        """Clear request context"""
        self.request_id = None
        self.user_id = None
    
    def debug(self, message: str, **kwargs):
        """Log debug message"""
        extra = self._get_extra_context(**kwargs)
        self.logger.debug(message, extra=extra)
    
    def info(self, message: str, **kwargs):
        """Log info message"""
        extra = self._get_extra_context(**kwargs)
        self.logger.info(message, extra=extra)
    
    def warning(self, message: str, **kwargs):
        """Log warning message"""
        extra = self._get_extra_context(**kwargs)
        self.logger.warning(message, extra=extra)
    
    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log error message with optional exception"""
        extra = self._get_extra_context(**kwargs)
        
        if error:
            extra.update({
                "error_type": type(error).__name__,
                "error_message": str(error),
                "traceback": traceback.format_exc()
            })
        
        self.logger.error(message, extra=extra)
    
    def critical(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log critical message"""
        extra = self._get_extra_context(**kwargs)
        
        if error:
            extra.update({
                "error_type": type(error).__name__,
                "error_message": str(error),
                "traceback": traceback.format_exc()
            })
        
        self.logger.critical(message, extra=extra)
    
    def log_api_call(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float,
        request_size: Optional[int] = None,
        response_size: Optional[int] = None,
        **kwargs
    ):
        """Log API call with performance metrics"""
        extra = self._get_extra_context(
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            duration_ms=duration_ms,
            request_size=request_size,
            response_size=response_size,
            api_call=True,
            **kwargs
        )
        
        level = "error" if status_code >= 400 else "info"
        message = f"API {method} {endpoint} - {status_code} ({duration_ms:.2f}ms)"
        
        if level == "error":
            self.error(message, **extra)
        else:
            self.info(message, **extra)
    
    def log_database_query(
        self,
        query_type: str,
        table: str,
        duration_ms: float,
        rows_affected: Optional[int] = None,
        **kwargs
    ):
        """Log database query with performance metrics"""
        extra = self._get_extra_context(
            query_type=query_type,
            table=table,
            duration_ms=duration_ms,
            rows_affected=rows_affected,
            database_query=True,
            **kwargs
        )
        
        message = f"DB {query_type} {table} ({duration_ms:.2f}ms)"
        if rows_affected is not None:
            message += f" - {rows_affected} rows"
        
        self.info(message, **extra)
    
    def log_business_event(
        self,
        event_type: str,
        event_data: Dict[str, Any],
        success: bool = True,
        **kwargs
    ):
        """Log business events"""
        extra = self._get_extra_context(
            event_type=event_type,
            event_data=event_data,
            success=success,
            business_event=True,
            **kwargs
        )
        
        level = "info" if success else "warning"
        message = f"Business Event: {event_type} - {'Success' if success else 'Failed'}"
        
        if level == "warning":
            self.warning(message, **extra)
        else:
            self.info(message, **extra)
    
    def log_security_event(
        self,
        event_type: str,
        severity: str,
        details: Dict[str, Any],
        **kwargs
    ):
        """Log security events"""
        extra = self._get_extra_context(
            event_type=event_type,
            severity=severity,
            details=details,
            security_event=True,
            **kwargs
        )
        
        message = f"Security Event: {event_type} - {severity}"
        
        if severity in ["high", "critical"]:
            self.critical(message, **extra)
        elif severity == "medium":
            self.error(message, **extra)
        else:
            self.warning(message, **extra)
    
    @contextmanager
    def performance_timer(self, operation_name: str, **kwargs):
        """Context manager for timing operations"""
        start_time = time.perf_counter()
        operation_id = str(uuid.uuid4())
        
        self.debug(f"Starting operation: {operation_name}", operation_id=operation_id, **kwargs)
        
        try:
            yield
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            self.error(
                f"Operation failed: {operation_name}",
                error=e,
                operation_id=operation_id,
                duration_ms=duration_ms,
                **kwargs
            )
            raise
        else:
            duration_ms = (time.perf_counter() - start_time) * 1000
            self.info(
                f"Operation completed: {operation_name}",
                operation_id=operation_id,
                duration_ms=duration_ms,
                **kwargs
            )


# Global logger instance
logger = StructuredLogger(
    name="hirelens",
    level="INFO",
    enable_console=True,
    enable_structured=HAS_STRUCTLOG,
    enable_performance=True
)


# Decorators for automatic logging
def log_performance(func_name: Optional[str] = None):
    """Decorator to log function performance"""
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            operation_name = func_name or f"{func.__module__}.{func.__name__}"
            with logger.performance_timer(operation_name):
                return await func(*args, **kwargs)
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            operation_name = func_name or f"{func.__module__}.{func.__name__}"
            with logger.performance_timer(operation_name):
                return func(*args, **kwargs)
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    
    return decorator


def log_api_endpoint(endpoint_name: Optional[str] = None):
    """Decorator to log API endpoint calls"""
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            name = endpoint_name or f"{func.__module__}.{func.__name__}"
            
            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.perf_counter() - start_time) * 1000
                
                # Try to extract status code from result
                status_code = getattr(result, 'status_code', 200)
                
                logger.log_api_call(
                    endpoint=name,
                    method="ASYNC",
                    status_code=status_code,
                    duration_ms=duration_ms
                )
                
                return result
            except Exception as e:
                duration_ms = (time.perf_counter() - start_time) * 1000
                logger.log_api_call(
                    endpoint=name,
                    method="ASYNC",
                    status_code=500,
                    duration_ms=duration_ms,
                    error=str(e)
                )
                raise
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            name = endpoint_name or f"{func.__module__}.{func.__name__}"
            
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.perf_counter() - start_time) * 1000
                
                status_code = getattr(result, 'status_code', 200)
                
                logger.log_api_call(
                    endpoint=name,
                    method="SYNC",
                    status_code=status_code,
                    duration_ms=duration_ms
                )
                
                return result
            except Exception as e:
                duration_ms = (time.perf_counter() - start_time) * 1000
                logger.log_api_call(
                    endpoint=name,
                    method="SYNC",
                    status_code=500,
                    duration_ms=duration_ms,
                    error=str(e)
                )
                raise
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    
    return decorator


def log_business_operation(operation_name: str):
    """Decorator to log business operations"""
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                result = await func(*args, **kwargs)
                logger.log_business_event(
                    event_type=operation_name,
                    event_data={"function": func.__name__},
                    success=True
                )
                return result
            except Exception as e:
                logger.log_business_event(
                    event_type=operation_name,
                    event_data={"function": func.__name__, "error": str(e)},
                    success=False
                )
                raise
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                result = func(*args, **kwargs)
                logger.log_business_event(
                    event_type=operation_name,
                    event_data={"function": func.__name__},
                    success=True
                )
                return result
            except Exception as e:
                logger.log_business_event(
                    event_type=operation_name,
                    event_data={"function": func.__name__, "error": str(e)},
                    success=False
                )
                raise
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    
    return decorator


# FastAPI middleware integration
class LoggingMiddleware:
    """Middleware for automatic request/response logging"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        start_time = time.perf_counter()
        request_id = str(uuid.uuid4())
        
        # Set request context
        logger.set_request_context(request_id=request_id)
        
        # Add request ID to scope for access in endpoints
        scope["request_id"] = request_id
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                duration_ms = (time.perf_counter() - start_time) * 1000
                
                logger.log_api_call(
                    endpoint=scope.get("path", "unknown"),
                    method=scope.get("method", "unknown"),
                    status_code=message["status"],
                    duration_ms=duration_ms,
                    request_id=request_id
                )
            
            await send(message)
        
        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"Request failed: {scope.get('method', 'unknown')} {scope.get('path', 'unknown')}",
                error=e,
                request_id=request_id,
                duration_ms=duration_ms
            )
            raise
        finally:
            logger.clear_request_context()


# Export main components
__all__ = [
    'logger',
    'StructuredLogger',
    'PerformanceTimer',
    'LoggingMiddleware',
    'log_performance',
    'log_api_endpoint',
    'log_business_operation'
]