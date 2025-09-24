// lib/logger.ts - Comprehensive frontend logging system
import appConfig from './config';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  stack?: string;
  component?: string;
  action?: string;
}

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteUrl?: string;
  bufferSize: number;
  flushInterval: number;
  enablePerformanceTracking: boolean;
  enableUserTracking: boolean;
}

interface ApiConfig {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
}

interface ApiResponse {
  status: number;
  statusText?: string;
  config?: ApiConfig;
}

interface ApiError extends Error {
  response?: ApiResponse;
  config?: ApiConfig;
}

class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private sessionId: string;
  private flushTimer?: NodeJS.Timeout;
  private performanceMarks: Map<string, number> = new Map();

  private readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    // Determine the base URL for logging endpoint
    const loggingBaseUrl = process.env.NEXT_PUBLIC_LOGGING_ENDPOINT || 
                          `${appConfig.apiUrl || '/api'}`;
    
    this.config = {
      level: 'info',
      enableConsole: process.env.NODE_ENV === 'development',
      enableRemote: process.env.NODE_ENV === 'production',
      remoteUrl: `${loggingBaseUrl}/logging/frontend`,
      bufferSize: 50,
      flushInterval: 30000, // 30 seconds
      enablePerformanceTracking: true,
      enableUserTracking: true,
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.setupFlushTimer();
    this.setupGlobalErrorHandlers();
    this.logSystemInfo();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupFlushTimer(): void {
    if (this.config.enableRemote) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  private setupGlobalErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      // Unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.error('Unhandled Promise Rejection', {
          error: event.reason,
          promise: 'PromiseRejectionEvent',
          stack: event.reason?.stack,
        });
      });

      // Global JavaScript errors
      window.addEventListener('error', (event) => {
        this.error('Global JavaScript Error', {
          message: event.message || 'Unknown error',
          filename: event.filename || 'unknown',
          lineno: event.lineno || 0,
          colno: event.colno || 0,
          stack: event.error?.stack || 'No stack trace',
        });
      });

      // Resource loading errors
      window.addEventListener('error', (event) => {
        if (event.target !== window) {
          this.error('Resource Loading Error', {
            tagName: (event.target as Element)?.tagName,
            source: (event.target as HTMLImageElement)?.src || (event.target as HTMLScriptElement)?.src,
            type: 'resource_error',
          });
        }
      }, true);
    }
  }

  private logSystemInfo(): void {
    if (typeof window !== 'undefined') {
      this.info('Logger initialized', {
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
      });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.LOG_LEVELS[level] >= this.LOG_LEVELS[this.config.level];
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context: Record<string, unknown> = {}
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      sessionId: this.sessionId,
    };

    if (typeof window !== 'undefined') {
      entry.url = window.location.href;
      entry.userAgent = navigator.userAgent;
    }

    if (context.component) {
      entry.component = context.component as string;
    }

    if (context.action) {
      entry.action = context.action as string;
    }

    if (level === 'error' && context.error instanceof Error) {
      entry.stack = context.error.stack;
    }

    return entry;
  }

  private log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, context);

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Buffer for remote logging
    if (this.config.enableRemote) {
      this.buffer.push(entry);

      // Immediate flush for errors
      if (level === 'error') {
        this.flush();
      } else if (this.buffer.length >= this.config.bufferSize) {
        this.flush();
      }
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;
    
    const consoleMethod = entry.level === 'debug' ? 'debug' :
                         entry.level === 'info' ? 'info' :
                         entry.level === 'warn' ? 'warn' : 'error';

    try {
      if (entry.context && Object.keys(entry.context).length > 0) {
        console[consoleMethod](`${prefix} ${entry.message}`, entry.context);
      } else {
        console[consoleMethod](`${prefix} ${entry.message}`);
      }
    } catch (error) {
      // Fallback to basic console logging if there's an issue
      console.error(`Logger error: ${error}`);
      console[consoleMethod](`${prefix} ${entry.message}`);
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.enableRemote) {
      return;
    }

    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.config.remoteUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          metadata: {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'N/A',
            url: typeof window !== 'undefined' ? window.location.href : 'N/A',
          },
        }),
      });
    } catch (error) {
      // Fallback: add logs back to buffer if remote logging fails
      this.buffer.unshift(...logsToSend);
      console.error('Failed to send logs to remote endpoint:', error);
    }
  }

  // Public logging methods
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  // Specialized logging methods
  userAction(action: string, details?: Record<string, unknown>): void {
    this.info(`User Action: ${action}`, {
      action,
      type: 'user_action',
      ...details,
    });
  }

  apiCall(endpoint: string, method: string, duration?: number, status?: number): void {
    const level = status && status >= 400 ? 'error' : 'info';
    this.log(level, `API Call: ${method} ${endpoint}`, {
      endpoint,
      method,
      duration,
      status,
      type: 'api_call',
    });
  }

  componentLifecycle(component: string, lifecycle: string, details?: Record<string, unknown>): void {
    this.debug(`Component Lifecycle: ${component} - ${lifecycle}`, {
      component,
      lifecycle,
      type: 'component_lifecycle',
      ...details,
    });
  }

  pageView(page: string, loadTime?: number): void {
    this.info(`Page View: ${page}`, {
      page,
      loadTime,
      type: 'page_view',
      timestamp: new Date().toISOString(),
    });
  }

  // Performance tracking
  startPerformanceTimer(key: string): void {
    if (this.config.enablePerformanceTracking) {
      this.performanceMarks.set(key, performance.now());
    }
  }

  endPerformanceTimer(key: string, context?: Record<string, unknown>): number | null {
    if (!this.config.enablePerformanceTracking) {
      return null;
    }

    const startTime = this.performanceMarks.get(key);
    if (!startTime) {
      this.warn(`Performance timer '${key}' was not started`);
      return null;
    }

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(key);

    this.info(`Performance: ${key}`, {
      key,
      duration: Math.round(duration),
      type: 'performance',
      ...context,
    });

    return duration;
  }

  // Configuration methods
  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.info('Log level changed', { newLevel: level });
  }

  setUserId(userId: string): void {
    if (this.config.enableUserTracking) {
      this.info('User identified', { userId, type: 'user_tracking' });
    }
  }

  // Utility methods
  async flushImmediately(): Promise<void> {
    await this.flush();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(); // Final flush
  }
}

// Create and export logger instances
export const logger = new Logger();

// React hook for component-specific logging
export function useLogger(componentName: string) {
  const componentLogger = {
    debug: (message: string, context?: Record<string, unknown>) => 
      logger.debug(message, { component: componentName, ...context }),
    
    info: (message: string, context?: Record<string, unknown>) => 
      logger.info(message, { component: componentName, ...context }),
    
    warn: (message: string, context?: Record<string, unknown>) => 
      logger.warn(message, { component: componentName, ...context }),
    
    error: (message: string, context?: Record<string, unknown>) => 
      logger.error(message, { component: componentName, ...context }),
    
    userAction: (action: string, details?: Record<string, unknown>) => 
      logger.userAction(action, { component: componentName, ...details }),
    
    lifecycle: (lifecycle: string, details?: Record<string, unknown>) => 
      logger.componentLifecycle(componentName, lifecycle, details),
  };

  return componentLogger;
}

// API interceptor for automatic API logging
export function createApiLogger() {
  return {
    request: (config: ApiConfig) => {
      logger.startPerformanceTimer(`api_${config.method}_${config.url}`);
      logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        method: config.method,
        url: config.url,
        headers: config.headers,
        type: 'api_request',
      });
      return config;
    },
    
    response: (response: ApiResponse) => {
      const duration = logger.endPerformanceTimer(`api_${response.config?.method}_${response.config?.url}`);
      logger.apiCall(
        response.config?.url || 'unknown',
        response.config?.method?.toUpperCase() || 'unknown',
        duration || undefined,
        response.status
      );
      return response;
    },
    
    error: (error: ApiError) => {
      const config = error.config;
      logger.endPerformanceTimer(`api_${config?.method}_${config?.url}`);
      logger.error(`API Error: ${config?.method?.toUpperCase()} ${config?.url}`, {
        method: config?.method,
        url: config?.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        type: 'api_error',
        error: error,
      });
      throw error;
    },
  };
}

// Utility functions for specific logging scenarios
export const LoggerUtils = {
  // Log page navigation
  logPageChange: (from: string, to: string) => {
    logger.userAction('page_navigation', {
      from,
      to,
      timestamp: new Date().toISOString(),
    });
  },

  // Log form interactions
  logFormEvent: (formName: string, event: string, field?: string, value?: unknown) => {
    logger.userAction(`form_${event}`, {
      form: formName,
      field,
      value: typeof value === 'string' ? value : undefined,
      type: 'form_interaction',
    });
  },

  // Log button clicks
  logButtonClick: (buttonName: string, context?: Record<string, unknown>) => {
    logger.userAction('button_click', {
      button: buttonName,
      ...context,
    });
  },

  // Log search actions
  logSearch: (query: string, results?: number, filters?: Record<string, unknown>) => {
    logger.userAction('search', {
      query,
      results,
      filters,
      type: 'search',
    });
  },
};

export default logger;