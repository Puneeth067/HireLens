export interface DatabaseConfig {
  url: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors_origins: string[];
  upload_dir: string;
  max_file_size: number;
  allowed_extensions: string[];
  log_level: string;
}

export interface ClientConfig {
  api_url: string;
  upload_max_size: number;
  supported_formats: string[];
}

export interface ATSConfig {
  skills_weight_default: number;
  experience_weight_default: number;
  education_weight_default: number;
  keywords_weight_default: number;
  max_batch_comparisons: number;
  comparison_timeout_seconds: number;
}

export interface AppConfig {
  server: ServerConfig;
  client: ClientConfig;
  ats: ATSConfig;
  database?: DatabaseConfig;
}

export const defaultConfig: AppConfig = {
  server: {
    port: 8000,
    host: '0.0.0.0',
    cors_origins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ],
    upload_dir: 'uploads',
    max_file_size: 10 * 1024 * 1024, // 10MB
    allowed_extensions: ['.pdf', '.docx', '.doc'],
    log_level: 'INFO'
  },
  client: {
    api_url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    upload_max_size: 10 * 1024 * 1024, // 10MB
    supported_formats: ['pdf', 'docx', 'doc']
  },
  ats: {
    skills_weight_default: 40.0,
    experience_weight_default: 30.0,
    education_weight_default: 15.0,
    keywords_weight_default: 15.0,
    max_batch_comparisons: 50,
    comparison_timeout_seconds: 300
  }
};

export function getConfig(): AppConfig {
  return {
    ...defaultConfig,
    server: {
      ...defaultConfig.server,
      port: parseInt(process.env.PORT || '8000'),
      host: process.env.HOST || defaultConfig.server.host,
      upload_dir: process.env.UPLOAD_DIR || defaultConfig.server.upload_dir,
      log_level: process.env.LOG_LEVEL || defaultConfig.server.log_level
    },
    client: {
      ...defaultConfig.client,
      api_url: process.env.NEXT_PUBLIC_API_URL || defaultConfig.client.api_url
    }
  };
}

export function validateConfig(config: AppConfig): boolean {
  // Basic validation
  if (!config.server.port || config.server.port <= 0) {
    throw new Error('Invalid server port');
  }
  
  if (!config.server.upload_dir) {
    throw new Error('Upload directory must be specified');
  }
  
  if (!config.client.api_url) {
    throw new Error('API URL must be specified');
  }
  
  return true;
}