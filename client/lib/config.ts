// lib/config.ts - Environment configuration management for frontend

interface AppConfig {
  env: 'development' | 'staging' | 'production';
  apiUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableRemoteLogging: boolean;
  enableAnalytics: boolean;
  enableCaching: boolean;
  cacheConfig: {
    defaultTtl: number;
    maxSize: number;
    persistToStorage: boolean;
  };
  features: {
    enableBulkOperations: boolean;
    enableAdvancedAnalytics: boolean;
    enableExportFeatures: boolean;
    enableDocumentPreview: boolean;
  };
  limits: {
    maxFileSize: number;
    maxBatchSize: number;
    allowedExtensions: string[];
  };
  analytics: {
    googleAnalyticsId?: string;
    enableUserTracking: boolean;
    enablePerformanceTracking: boolean;
  };
}

const getConfig = (): AppConfig => {
  const env = (process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development') as AppConfig['env'];
  
  const baseConfig: AppConfig = {
    env,
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    logLevel: (process.env.NEXT_PUBLIC_LOG_LEVEL as AppConfig['logLevel']) || 'info',
    enableRemoteLogging: process.env.NEXT_PUBLIC_ENABLE_REMOTE_LOGGING === 'true',
    enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    enableCaching: process.env.NEXT_PUBLIC_ENABLE_CACHING !== 'false', // Default true
    cacheConfig: {
      defaultTtl: parseInt(process.env.NEXT_PUBLIC_CACHE_TTL || '300000'), // 5 minutes
      maxSize: parseInt(process.env.NEXT_PUBLIC_CACHE_MAX_SIZE || '100'),
      persistToStorage: process.env.NEXT_PUBLIC_CACHE_PERSIST !== 'false',
    },
    features: {
      enableBulkOperations: process.env.NEXT_PUBLIC_ENABLE_BULK_OPERATIONS !== 'false',
      enableAdvancedAnalytics: process.env.NEXT_PUBLIC_ENABLE_ADVANCED_ANALYTICS !== 'false',
      enableExportFeatures: process.env.NEXT_PUBLIC_ENABLE_EXPORT_FEATURES !== 'false',
      enableDocumentPreview: process.env.NEXT_PUBLIC_ENABLE_DOCUMENT_PREVIEW !== 'false',
    },
    limits: {
      maxFileSize: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760'), // 10MB
      maxBatchSize: parseInt(process.env.NEXT_PUBLIC_MAX_BATCH_SIZE || '100'),
      allowedExtensions: (process.env.NEXT_PUBLIC_ALLOWED_EXTENSIONS || 'pdf,docx,doc,txt').split(','),
    },
    analytics: {
      googleAnalyticsId: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
      enableUserTracking: process.env.NEXT_PUBLIC_ENABLE_USER_TRACKING !== 'false',
      enablePerformanceTracking: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_TRACKING !== 'false',
    },
  };

  // Environment-specific overrides
  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        logLevel: 'debug',
        enableRemoteLogging: false,
        enableAnalytics: false,
        cacheConfig: {
          ...baseConfig.cacheConfig,
          defaultTtl: 60000, // 1 minute for development
        },
      };

    case 'staging':
      return {
        ...baseConfig,
        logLevel: 'info',
        enableRemoteLogging: true,
        enableAnalytics: false,
      };

    case 'production':
      return {
        ...baseConfig,
        logLevel: 'warn',
        enableRemoteLogging: true,
        enableAnalytics: true,
        cacheConfig: {
          ...baseConfig.cacheConfig,
          defaultTtl: 600000, // 10 minutes for production
        },
      };

    default:
      return baseConfig;
  }
};

export const config = getConfig();

// Configuration validation
export const validateConfig = (): string[] => {
  const errors: string[] = [];

  if (!config.apiUrl) {
    errors.push('API URL is required');
  }

  if (config.enableAnalytics && !config.analytics.googleAnalyticsId) {
    errors.push('Google Analytics ID is required when analytics is enabled');
  }

  if (config.limits.maxFileSize <= 0) {
    errors.push('Max file size must be greater than 0');
  }

  if (config.limits.allowedExtensions.length === 0) {
    errors.push('At least one file extension must be allowed');
  }

  return errors;
};

// Runtime configuration updates (for admin features)
class ConfigManager {
  private static instance: ConfigManager;
  private dynamicConfig: Partial<AppConfig> = {};

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  updateConfig(updates: Partial<AppConfig>): void {
    this.dynamicConfig = { ...this.dynamicConfig, ...updates };
  }

  getConfig(): AppConfig {
    return { ...config, ...this.dynamicConfig };
  }

  resetConfig(): void {
    this.dynamicConfig = {};
  }
}

export const configManager = ConfigManager.getInstance();

// Helper functions
export const isDevelopment = () => config.env === 'development';
export const isProduction = () => config.env === 'production';
export const isStaging = () => config.env === 'staging';

export default config;