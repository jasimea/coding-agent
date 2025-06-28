import { config } from 'dotenv';
import { z } from 'zod';
import path from 'path';

config();

const configSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // AI Provider
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  
  // GitHub Configuration
  GITHUB_TOKEN: z.string().optional(),
  
  // Security
  JWT_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  
  // Agent Configuration
  MAX_EXECUTION_TIME_MS: z.string().default('300000'),
  MAX_FILE_SIZE_MB: z.string().default('10'),
  ALLOWED_FILE_EXTENSIONS: z.string().default('.js,.ts,.py,.java,.cpp,.c,.h,.css,.html,.json,.xml,.yaml,.yml,.md,.txt'),
  
  // Git Configuration
  DEFAULT_GIT_BRANCH: z.string().default('main'),
  GIT_TIMEOUT_MS: z.string().default('30000'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/agent.log'),
});

const env = configSchema.parse(process.env);

export const Config = {
  server: {
    port: parseInt(env.PORT),
    nodeEnv: env.NODE_ENV,
  },
  
  ai: {
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    googleApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
  },
  
  github: {
    token: env.GITHUB_TOKEN,
  },
  
  security: {
    jwtSecret: env.JWT_SECRET || 'default-secret-change-in-production',
    rateLimitWindowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
    rateLimitMaxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
  },
  
  agent: {
    maxExecutionTimeMs: parseInt(env.MAX_EXECUTION_TIME_MS),
    maxFileSizeMb: parseInt(env.MAX_FILE_SIZE_MB),
    allowedFileExtensions: env.ALLOWED_FILE_EXTENSIONS.split(',').map((ext: string) => ext.trim()),
  },
  
  git: {
    defaultBranch: env.DEFAULT_GIT_BRANCH,
    timeoutMs: parseInt(env.GIT_TIMEOUT_MS),
  },
  
  logging: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
  },
  
  // Derived configurations
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
};

export const getWorkspaceRoot = (): string => {
  return process.cwd();
};

export const getLogsDirectory = (): string => {
  return path.join(getWorkspaceRoot(), 'logs');
};

export const validateAIProvider = (): string => {
  if (Config.ai.openaiApiKey) return 'openai';
  if (Config.ai.anthropicApiKey) return 'anthropic';
  if (Config.ai.googleApiKey) return 'google';
  
  throw new Error('No AI provider API key configured. Please set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY');
};
