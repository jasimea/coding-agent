import { DefaultSessionManager } from '../src/utils/session-manager.js';
import { CodingAgent } from '../src/agents/coding-agent.js';
import { AgentRequest } from '../src/types/index.js';
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Session Management', () => {
  let sessionManager: DefaultSessionManager;
  let agent: CodingAgent;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test metadata
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-test-'));
    sessionManager = new DefaultSessionManager(tempDir);
    agent = new CodingAgent(undefined, tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
  });

  describe('SessionManager', () => {
    it('should create a new session', () => {
      const sessionId = sessionManager.createSession('/test/path');
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.sessionId).toBe(sessionId);
      expect(session!.workingDirectory).toBe('/test/path');
      expect(session!.status).toBe('active');
      expect(session!.totalTasks).toBe(0);
    });

    it('should track task additions', () => {
      const sessionId = sessionManager.createSession();
      
      sessionManager.addTaskToSession(sessionId, 'task-1');
      sessionManager.addTaskToSession(sessionId, 'task-2');
      
      const session = sessionManager.getSession(sessionId);
      expect(session!.tasks).toHaveLength(2);
      expect(session!.tasks).toContain('task-1');
      expect(session!.tasks).toContain('task-2');
      expect(session!.totalTasks).toBe(2);
    });

    it('should track task completion', () => {
      const sessionId = sessionManager.createSession();
      
      sessionManager.addTaskToSession(sessionId, 'task-1');
      sessionManager.markTaskCompleted(sessionId, 1000);
      
      const session = sessionManager.getSession(sessionId);
      expect(session!.completedTasks).toBe(1);
      expect(session!.totalExecutionTime).toBe(1000);
    });

    it('should track task failures', () => {
      const sessionId = sessionManager.createSession();
      
      sessionManager.addTaskToSession(sessionId, 'task-1');
      sessionManager.markTaskFailed(sessionId, 500);
      
      const session = sessionManager.getSession(sessionId);
      expect(session!.failedTasks).toBe(1);
      expect(session!.totalExecutionTime).toBe(500);
    });

    it('should calculate session stats', () => {
      const sessionId = sessionManager.createSession();
      
      sessionManager.addTaskToSession(sessionId, 'task-1');
      sessionManager.addTaskToSession(sessionId, 'task-2');
      sessionManager.markTaskCompleted(sessionId, 1000);
      sessionManager.markTaskFailed(sessionId, 500);
      
      const stats = sessionManager.getSessionStats(sessionId);
      expect(stats).toBeDefined();
      expect(stats!.successRate).toBe(50); // 1 success out of 2 tasks
      expect(stats!.avgExecutionTime).toBe(750); // (1000 + 500) / 2
    });

    it('should end a session', () => {
      const sessionId = sessionManager.createSession();
      
      sessionManager.endSession(sessionId);
      
      const session = sessionManager.getSession(sessionId);
      expect(session!.status).toBe('completed');
      expect(session!.endTime).toBeDefined();
    });

    it('should save and load session metadata', async () => {
      const sessionId = sessionManager.createSession('/test/path');
      sessionManager.addTaskToSession(sessionId, 'task-1');
      sessionManager.markTaskCompleted(sessionId, 1000);
      
      await sessionManager.saveSessionMetadata(sessionId);
      
      // Create a new session manager to test loading
      const newSessionManager = new DefaultSessionManager(tempDir);
      const loadedSession = await newSessionManager.loadSessionMetadata(sessionId);
      
      expect(loadedSession).toBeDefined();
      expect(loadedSession!.sessionId).toBe(sessionId);
      expect(loadedSession!.workingDirectory).toBe('/test/path');
      expect(loadedSession!.tasks).toContain('task-1');
      expect(loadedSession!.completedTasks).toBe(1);
      expect(loadedSession!.totalExecutionTime).toBe(1000);
    });
  });

  describe('CodingAgent Session Integration', () => {
    it('should have a session ID', () => {
      const sessionId = agent.getSessionId();
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should create a new session', () => {
      const newSessionId = agent.createNewSession('/new/path');
      
      expect(newSessionId).toBeDefined();
      expect(agent.getSessionId()).toBe(newSessionId);
      
      const metadata = agent.getSessionMetadata();
      expect(metadata).toBeDefined();
      expect(metadata!.workingDirectory).toBe('/new/path');
    });

    it('should switch between sessions', () => {
      const originalSessionId = agent.getSessionId();
      const newSessionId = agent.createNewSession('/new/path');
      
      // Switch back to original
      agent.setSessionId(originalSessionId);
      expect(agent.getSessionId()).toBe(originalSessionId);
      
      // Switch to new session
      agent.setSessionId(newSessionId);
      expect(agent.getSessionId()).toBe(newSessionId);
    });

    it('should get session stats', () => {
      const stats = agent.getSessionStats();
      expect(stats).toBeDefined();
      expect(stats!.successRate).toBe(0); // No tasks yet
      expect(stats!.avgExecutionTime).toBe(0);
    });

    it('should list all sessions', () => {
      const session1 = agent.getSessionId();
      const session2 = agent.createNewSession();
      
      const sessions = agent.listAllSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      
      const sessionIds = sessions.map(s => s.sessionId);
      expect(sessionIds).toContain(session1);
      expect(sessionIds).toContain(session2);
    });
  });

  // Note: Full integration tests with actual task execution would require 
  // AI provider setup and are better suited for end-to-end testing
});
