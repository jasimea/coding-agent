import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Config } from './config/index.js';
import { createContextLogger } from './utils/logger.js';
import { healthHandler } from './api/health.js';
import { agentInfoHandler } from './api/agent-info.js';
import { executeTaskHandler } from './api/execute-task.js';
import { executeTaskStreamHandler } from './api/execute-task-stream.js';
import { analyzeProjectHandler } from './api/analyze-project.js';
import { getTasksHandler } from './api/get-tasks.js';
import { getTaskHandler } from './api/get-task.js';
import { docsHandler } from './api/docs.js';
import { 
  createSessionHandler,
  getSessionHandler,
  listSessionsHandler,
  endSessionHandler,
  getCurrentSessionHandler,
  switchSessionHandler
} from './api/sessions.js';

const logger = createContextLogger('Server');

export class Server {
  private app: express.Application;
  private rateLimiter: RateLimiterMemory;

  constructor() {
    this.app = express();
    this.rateLimiter = new RateLimiterMemory({
      points: Config.security.rateLimitMaxRequests,
      duration: Config.security.rateLimitWindowMs / 1000,
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();

    logger.info('Server initialized');
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: Config.isDevelopment ? true : process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting middleware
    this.app.use(async (req: Request, res: Response, next: NextFunction) => {
      try {
        await this.rateLimiter.consume(req.ip || 'anonymous');
        next();
      } catch (rateLimiterRes: any) {
        const remainingPoints = rateLimiterRes?.remainingPoints || 0;
        const msBeforeNext = rateLimiterRes?.msBeforeNext || 0;

        res.set({
          'Retry-After': Math.round(msBeforeNext / 1000) || 1,
          'X-RateLimit-Limit': Config.security.rateLimitMaxRequests,
          'X-RateLimit-Remaining': remainingPoints,
          'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
        });

        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
        });
      }
    });

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info('Request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', healthHandler);

    // Agent endpoints
    this.app.get('/agent/info', agentInfoHandler);
    this.app.post('/agent/execute', executeTaskHandler);
    this.app.post('/agent/execute/stream', executeTaskStreamHandler);
    this.app.post('/agent/analyze', analyzeProjectHandler);
    this.app.get('/agent/tasks', getTasksHandler);
    this.app.get('/agent/tasks/:taskId', getTaskHandler);

    // Session management endpoints
    this.app.post('/sessions', createSessionHandler);
    this.app.get('/sessions', listSessionsHandler);
    this.app.get('/sessions/current', getCurrentSessionHandler);
    this.app.get('/sessions/:sessionId', getSessionHandler);
    this.app.post('/sessions/:sessionId/switch', switchSessionHandler);
    this.app.post('/sessions/:sessionId/end', endSessionHandler);

    // Documentation
    this.app.get('/docs', docsHandler);
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path,
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: Config.isDevelopment ? error.message : 'Something went wrong',
      });
    });
  }

  public start(port: number = Config.server.port): void {
    this.app.listen(port, () => {
      logger.info('Server started', {
        port,
        environment: Config.server.nodeEnv,
        isDevelopment: Config.isDevelopment,
      });
      
      console.log(`🚀 Coding Agent Server running on port ${port}`);
      console.log(`📚 API Documentation: http://localhost:${port}/docs`);
      console.log(`🔧 Health Check: http://localhost:${port}/health`);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}
