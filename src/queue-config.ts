/**
 * Configuration for the task queue management system
 */
export interface QueueConfig {
  redis?: {
    url?: string;
    maxRetries?: number;
    retryDelay?: number;
  };
  storage?: {
    type: 'sqlite' | 'json';
    sqlitePath?: string;
    jsonPath?: string;
  };
  queue?: {
    processingInterval?: number;
    maxConcurrentTasks?: number;
  };
  repository?: {
    lockTimeout?: number;
    cleanupInterval?: number;
    maxRepositoryAge?: number;
  };
}

/**
 * Default configuration values
 */
export const defaultConfig: Required<QueueConfig> = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetries: 3,
    retryDelay: 1000,
  },
  storage: {
    type: (process.env.USE_SQLITE !== 'false') ? 'sqlite' : 'json',
    sqlitePath: process.env.SQLITE_PATH || '~/.coding-agent/tasks.db',
    jsonPath: process.env.JSON_PATH || '~/.coding-agent/tasks.json',
  },
  queue: {
    processingInterval: parseInt(process.env.TASK_PROCESSING_INTERVAL || '5000'),
    maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS || '1'),
  },
  repository: {
    lockTimeout: parseInt(process.env.REPOSITORY_LOCK_TIMEOUT || '3600000'), // 1 hour
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '86400000'), // 24 hours
    maxRepositoryAge: parseInt(process.env.MAX_REPOSITORY_AGE || '604800000'), // 7 days
  },
};

/**
 * Merge user config with defaults
 */
export function createConfig(userConfig?: Partial<QueueConfig>): Required<QueueConfig> {
  return {
    redis: { ...defaultConfig.redis, ...userConfig?.redis },
    storage: { ...defaultConfig.storage, ...userConfig?.storage },
    queue: { ...defaultConfig.queue, ...userConfig?.queue },
    repository: { ...defaultConfig.repository, ...userConfig?.repository },
  };
}