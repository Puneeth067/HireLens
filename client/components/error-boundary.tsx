// components/error-boundary.tsx - Enhanced error boundary with logging and recovery
'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
  errorBoundaryName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
}

interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack: string;
  errorBoundary: string;
  timestamp: string;
  url: string;
  userAgent: string;
  errorId: string;
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    this.logError(error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || '',
      errorBoundary: this.props.errorBoundaryName || 'Unknown',
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'N/A',
      errorId: this.state.errorId,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Error Details:', errorDetails);
      console.groupEnd();
    }

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendErrorToLoggingService(errorDetails);
    }
  };

  private sendErrorToLoggingService = async (errorDetails: ErrorDetails) => {
    try {
      // Replace with your actual logging service endpoint
      await fetch('/api/logging/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'frontend_error',
          level: 'error',
          ...errorDetails,
        }),
      });
    } catch (loggingError) {
      console.error('Failed to send error to logging service:', loggingError);
    }
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
    });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      // Show custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                Something went wrong
              </CardTitle>
              <CardDescription className="text-gray-600">
                We apologize for the inconvenience. An unexpected error has occurred.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Error ID for support */}
              <div className="bg-gray-100 p-3 rounded-md">
                <p className="text-sm text-gray-600">
                  <strong>Error ID:</strong> {this.state.errorId}
                </p>
              </div>

              {/* Error details in development */}
              {process.env.NODE_ENV === 'development' && this.props.showErrorDetails && this.state.error && (
                <details className="bg-red-50 p-3 rounded-md">
                  <summary className="text-sm font-medium text-red-800 cursor-pointer">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 text-xs text-red-700">
                    <p><strong>Message:</strong> {this.state.error.message}</p>
                    {this.state.error.stack && (
                      <pre className="mt-2 whitespace-pre-wrap text-xs">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                {this.state.retryCount < this.maxRetries && (
                  <Button
                    onClick={this.handleRetry}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again ({this.maxRetries - this.state.retryCount} left)
                  </Button>
                )}
                
                <Button
                  onClick={this.handleGoHome}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
                
                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </Button>
              </div>

              {/* Support information */}
              <div className="text-center text-sm text-gray-500">
                <p>
                  If this problem persists, please contact support and provide the Error ID above.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  errorBoundaryName?: string,
  customFallback?: ReactNode
) {
  const WrappedComponent = (props: T) => (
    <ErrorBoundary
      errorBoundaryName={errorBoundaryName || Component.displayName || Component.name}
      fallback={customFallback}
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Hook for manually triggering error boundary
export function useErrorHandler() {
  return React.useCallback((error: Error) => {
    // This will be caught by the nearest error boundary
    throw error;
  }, []);
}

export default ErrorBoundary;