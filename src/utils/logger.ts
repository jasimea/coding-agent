import winston from 'winston';
import { Config, getLogsDirectory } from '../config/index.js';
import fs from 'fs-extra';
import path from 'path';

// Ensure logs directory exists
const logsDir = getLogsDirectory();
fs.ensureDirSync(logsDir);

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple(),
  winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
  })
);

export const logger = winston.createLogger({
  level: Config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'coding-agent' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logsDir, Config.logging.file),
    }),
  ],
});

// Add console transport in development
if (Config.isDevelopment) {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

export const createContextLogger = (context: string) => {
  return {
    error: (message: string, meta?: any) => logger.error(message, { context, ...meta }),
    warn: (message: string, meta?: any) => logger.warn(message, { context, ...meta }),
    info: (message: string, meta?: any) => logger.info(message, { context, ...meta }),
    debug: (message: string, meta?: any) => logger.debug(message, { context, ...meta }),
  };
};
