import { SessionManager, SessionMetadata } from '../types/index.js';
import { createContextLogger } from './logger.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';

const logger = createContextLogger('SessionManager');

export class DefaultSessionManager implements SessionManager {
  private sessions: Map<string, SessionMetadata> = new Map();
  private metadataDir: string;

  constructor(metadataDir?: string) {
    this.metadataDir = metadataDir || path.join(process.cwd(), '.coding-agent', 'sessions');
    this.ensureMetadataDir();
    this.loadExistingSessions();
  }

  private async ensureMetadataDir(): Promise<void> {
    try {
      await fs.ensureDir(this.metadataDir);
    } catch (error) {
      logger.error('Failed to create metadata directory', { 
        metadataDir: this.metadataDir,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async loadExistingSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.metadataDir);
      const sessionFiles = files.filter(f => f.endsWith('.session.json'));

      for (const file of sessionFiles) {
        try {
          const sessionData = await fs.readJson(path.join(this.metadataDir, file));
          this.sessions.set(sessionData.sessionId, sessionData);
        } catch (error) {
          logger.warn('Failed to load session file', { 
            file,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Loaded existing sessions', { 
        sessionsCount: this.sessions.size,
        metadataDir: this.metadataDir
      });
    } catch (error) {
      logger.warn('Failed to load existing sessions', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  createSession(workingDirectory?: string): string {
    const sessionId = uuidv4();
    const workDir = workingDirectory || process.cwd();

    const metadata: SessionMetadata = {
      sessionId,
      startTime: new Date(),
      tasks: [],
      plans: [],
      workingDirectory: workDir,
      projectPath: workDir,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalExecutionTime: 0,
      status: 'active'
    };

    this.sessions.set(sessionId, metadata);

    logger.info('Created new session', {
      sessionId,
      workingDirectory: workDir
    });

    // Save immediately to persist the session
    this.saveSessionMetadata(sessionId).catch(error => {
      logger.error('Failed to save new session metadata', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });

    return sessionId;
  }

  getSession(sessionId: string): SessionMetadata | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<SessionMetadata>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to update non-existent session', { sessionId });
      return;
    }

    // Update the session with provided values
    Object.assign(session, updates);

    logger.debug('Updated session metadata', {
      sessionId,
      updates: Object.keys(updates)
    });

    // Auto-save when significant updates occur
    if (updates.status || updates.totalTasks || updates.completedTasks || updates.failedTasks) {
      this.saveSessionMetadata(sessionId).catch(error => {
        logger.error('Failed to auto-save session metadata', {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    }
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to end non-existent session', { sessionId });
      return;
    }

    session.endTime = new Date();
    session.status = session.failedTasks > 0 ? 'failed' : 'completed';

    logger.info('Ended session', {
      sessionId,
      duration: session.endTime.getTime() - session.startTime.getTime(),
      totalTasks: session.totalTasks,
      completedTasks: session.completedTasks,
      failedTasks: session.failedTasks
    });

    // Save final session state
    this.saveSessionMetadata(sessionId).catch(error => {
      logger.error('Failed to save final session metadata', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });
  }

  async saveSessionMetadata(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      const filePath = path.join(this.metadataDir, `${sessionId}.session.json`);
      await fs.writeJson(filePath, session, { spaces: 2 });
      
      logger.debug('Saved session metadata', { 
        sessionId,
        filePath
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to save session metadata', {
        sessionId,
        error: errorMessage
      });
      throw new Error(`Failed to save session metadata: ${errorMessage}`);
    }
  }

  async loadSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
    try {
      const filePath = path.join(this.metadataDir, `${sessionId}.session.json`);
      
      if (!(await fs.pathExists(filePath))) {
        return null;
      }

      const metadata = await fs.readJson(filePath);
      
      // Validate the loaded metadata
      if (!metadata.sessionId || metadata.sessionId !== sessionId) {
        throw new Error('Invalid session metadata');
      }

      // Convert date strings back to Date objects
      metadata.startTime = new Date(metadata.startTime);
      if (metadata.endTime) {
        metadata.endTime = new Date(metadata.endTime);
      }

      // Update in-memory cache
      this.sessions.set(sessionId, metadata);

      logger.debug('Loaded session metadata', { sessionId });
      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load session metadata', {
        sessionId,
        error: errorMessage
      });
      return null;
    }
  }

  listSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values()).sort((a, b) => {
      const aTime = a.startTime instanceof Date ? a.startTime : new Date(a.startTime);
      const bTime = b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
      return bTime.getTime() - aTime.getTime();
    });
  }

  // Additional utility methods
  addTaskToSession(sessionId: string, taskId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.tasks.push(taskId);
      session.totalTasks++;
      this.updateSession(sessionId, { 
        tasks: session.tasks, 
        totalTasks: session.totalTasks 
      });
    }
  }

  addPlanToSession(sessionId: string, planId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.plans.push(planId);
      this.updateSession(sessionId, { plans: session.plans });
    }
  }

  markTaskCompleted(sessionId: string, executionTime: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.completedTasks++;
      session.totalExecutionTime += executionTime;
      this.updateSession(sessionId, { 
        completedTasks: session.completedTasks,
        totalExecutionTime: session.totalExecutionTime
      });
    }
  }

  markTaskFailed(sessionId: string, executionTime: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.failedTasks++;
      session.totalExecutionTime += executionTime;
      this.updateSession(sessionId, { 
        failedTasks: session.failedTasks,
        totalExecutionTime: session.totalExecutionTime
      });
    }
  }

  getSessionStats(sessionId: string): { 
    duration?: number; 
    successRate: number; 
    avgExecutionTime: number 
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const duration = session.endTime 
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    const successRate = session.totalTasks > 0 
      ? (session.completedTasks / session.totalTasks) * 100
      : 0;

    const avgExecutionTime = session.totalTasks > 0
      ? session.totalExecutionTime / session.totalTasks
      : 0;

    return {
      duration,
      successRate,
      avgExecutionTime
    };
  }
}

// Singleton instance
let defaultSessionManager: DefaultSessionManager | null = null;

export function getSessionManager(): DefaultSessionManager {
  if (!defaultSessionManager) {
    defaultSessionManager = new DefaultSessionManager();
  }
  return defaultSessionManager;
}

export function createSessionManager(metadataDir?: string): DefaultSessionManager {
  return new DefaultSessionManager(metadataDir);
}
