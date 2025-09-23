// components/ui/page-wrapper.tsx - Enhanced page wrapper with error boundaries, loading states, and logging

'use client';

import React, { ReactNode, Suspense } from 'react';
import ErrorBoundary from '@/components/error-boundary';
import { DashboardSkeleton, JobsPageSkeleton, ComparisonsPageSkeleton, FormSkeleton } from './skeleton';
import { useLogger } from '@/lib/logger';

interface PageWrapperProps {
  children: ReactNode;
  pageName: string;
  loadingType?: 'dashboard' | 'jobs' | 'comparisons' | 'form' | 'default';
  fallbackComponent?: ReactNode;
  showErrorDetails?: boolean;
  className?: string;
}

// Loading component selector based on page type
function getLoadingComponent(type: string) {
  switch (type) {
    case 'dashboard':
      return <DashboardSkeleton showStats={true} showCharts={true} showTable={true} />;
    case 'jobs':
      return <JobsPageSkeleton />;
    case 'comparisons':
      return <ComparisonsPageSkeleton />;
    case 'form':
      return <FormSkeleton fields={6} showActions={true} />;
    default:
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      );
  }
}

// Enhanced page wrapper with logging
function PageWrapperInternal({
  children,
  pageName,
  loadingType = 'default',
  fallbackComponent,
  showErrorDetails = process.env.NODE_ENV === 'development',
  className,
}: PageWrapperProps) {
  const logger = useLogger('PageWrapper');

  // Log page view
  React.useEffect(() => {
    logger.lifecycle('mount', { pageName });
    
    // Track page view
    const startTime = performance.now();
    
    return () => {
      const loadTime = performance.now() - startTime;
      logger.lifecycle('unmount', { pageName, loadTime });
    };
  }, [logger, pageName]); // Remove logger dependency

  return (
    <ErrorBoundary
      errorBoundaryName={`${pageName}Page`}
      fallback={fallbackComponent}
      showErrorDetails={showErrorDetails}
      onError={(error, errorInfo) => {
        logger.error(`Page error in ${pageName}`, {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          pageName,
        });
      }}
    >
      <div className={className}>
        <Suspense fallback={getLoadingComponent(loadingType)}>
          {children}
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

// Higher-order component for wrapping pages
export function withPageWrapper<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  options: {
    pageName: string;
    loadingType?: 'dashboard' | 'jobs' | 'comparisons' | 'form' | 'default';
    className?: string;
  }
) {
  const WrappedPage = (props: T) => (
    <PageWrapperInternal
      pageName={options.pageName}
      loadingType={options.loadingType}
      className={options.className}
    >
      <Component {...props} />
    </PageWrapperInternal>
  );

  WrappedPage.displayName = `withPageWrapper(${Component.displayName || Component.name})`;
  return WrappedPage;
}

// Loading state wrapper for components within pages
interface LoadingWrapperProps {
  loading: boolean;
  error?: string | null;
  children: ReactNode;
  skeleton?: ReactNode;
  componentName?: string;
  onRetry?: () => void;
}

export function LoadingWrapper({
  loading,
  error,
  children,
  skeleton,
  componentName = 'Component',
  onRetry,
}: LoadingWrapperProps) {
  const logger = useLogger('LoadingWrapper');

  if (error) {
    logger.warn(`Error in ${componentName}`, { error, componentName });
    
    return (
      <div className="p-6 text-center">
        <div className="text-red-600 mb-4">
          <p className="font-medium">Something went wrong</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
        {onRetry && (
          <button
            onClick={() => {
              logger.userAction('retry_click', { componentName });
              onRetry();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return skeleton || (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Hook for managing loading states with logging
export function useLoadingState(componentName: string) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const logger = useLogger(componentName);

  const startLoading = React.useCallback(() => {
    logger.debug('Started loading');
    setLoading(true);
    setError(null);
  }, [logger]); // Remove logger dependency

  const stopLoading = React.useCallback(() => {
    logger.debug('Stopped loading');
    setLoading(false);
  }, [logger]); // Remove logger dependency

  const setErrorState = React.useCallback((errorMessage: string) => {
    logger.error('Error occurred', { error: errorMessage });
    setError(errorMessage);
    setLoading(false);
  }, [logger]); // Remove logger dependency

  const clearError = React.useCallback(() => {
    logger.debug('Cleared error');
    setError(null);
  }, [logger]); // Remove logger dependency

  return {
    loading,
    error,
    startLoading,
    stopLoading,
    setError: setErrorState,
    clearError,
  };
}

export default PageWrapperInternal;