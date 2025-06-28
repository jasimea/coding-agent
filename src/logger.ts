import winston from 'winston';
import path from 'path';

// Ensure logs directory exists
import { promises as fs } from 'fs';

const initializeLogsDirectory = async () => {
  try {
    await fs.mkdir('logs', { recursive: true });
  } catch (error) {
    console.error('Failed to create logs directory:', error);
  }
};

// Initialize logs directory immediately
initializeLogsDirectory();

// Create base logger configuration
const createLogger = (service: string) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.label({ label: service })
    ),
    defaultMeta: { service },
    transports: [
      // File transport for all logs
      new winston.transports.File({ 
        filename: path.join('logs', 'application.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      }),
      // Service-specific file transport
      new winston.transports.File({ 
        filename: path.join('logs', `${service}.log`),
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3
      }),
      // Console transport with colored output for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
          })
        )
      })
    ]
  });
};

// Create service-specific loggers
export const mainLogger = createLogger('main');
export const webhookLogger = createLogger('webhook');
export const taskProcessorLogger = createLogger('task-processor');
export const claudeConfigLogger = createLogger('claude-config');
export const prPlanningLogger = createLogger('pr-planning');
export const cliLogger = createLogger('cli');

// Default export for general use
export default createLogger('general');

// Utility function to create custom loggers
export const getLogger = (service: string) => createLogger(service);
