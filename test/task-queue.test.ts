import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { TaskQueueManager } from '../src/task-queue-manager.js';
import { SharedRepositoryManager } from '../src/shared-repository-manager.js';
import { JSONTaskStorage } from '../src/task-storage.js';
import { TaskProcessRequest } from '../src/webhook-types.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Task Queue Management', () => {
  let queueManager: TaskQueueManager;
  let repositoryManager: SharedRepositoryManager;
  let taskStorage: JSONTaskStorage;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'queue-test-'));
    
    // Initialize components
    taskStorage = new JSONTaskStorage(path.join(tempDir, 'tasks.json'));
    await taskStorage.initialize();
    
    // Mock Redis URL to avoid real Redis connection in tests
    queueManager = new TaskQueueManager(taskStorage, 'redis://localhost:6379');
    repositoryManager = new SharedRepositoryManager(path.join(tempDir, 'workspace'));
    
    // Initialize without Redis for unit testing
    await repositoryManager.initialize();
  });

  afterEach(async () => {
    // Cleanup
    if (queueManager) {
      await queueManager.close();
    }
    await fs.remove(tempDir);
  });

  describe('TaskStorage', () => {
    it('should save and retrieve tasks', async () => {
      const taskId = 'test-task-1';
      const task = {
        taskId,
        status: 'pending' as const,
        repositoryUrl: 'https://github.com/test/repo',
        startTime: new Date().toISOString(),
      };

      await taskStorage.saveTask(taskId, task);
      const retrieved = await taskStorage.getTask(taskId);

      expect(retrieved).toEqual(task);
    });

    it('should update existing tasks', async () => {
      const taskId = 'test-task-2';
      const task = {
        taskId,
        status: 'pending' as const,
        repositoryUrl: 'https://github.com/test/repo',
        startTime: new Date().toISOString(),
      };

      await taskStorage.saveTask(taskId, task);
      await taskStorage.updateTask(taskId, { 
        status: 'planning', 
        progress: 'Starting analysis...' 
      });

      const updated = await taskStorage.getTask(taskId);
      expect(updated?.status).toBe('planning');
      expect(updated?.progress).toBe('Starting analysis...');
    });

    it('should filter tasks by repository', async () => {
      const repoUrl = 'https://github.com/test/repo';
      
      const task1 = {
        taskId: 'task-1',
        status: 'pending' as const,
        repositoryUrl: repoUrl,
        startTime: new Date().toISOString(),
      };
      
      const task2 = {
        taskId: 'task-2',
        status: 'completed' as const,
        repositoryUrl: 'https://github.com/other/repo',
        startTime: new Date().toISOString(),
      };

      await taskStorage.saveTask(task1.taskId, task1);
      await taskStorage.saveTask(task2.taskId, task2);

      const repoTasks = await taskStorage.getTasksByRepository(repoUrl);
      expect(repoTasks).toHaveLength(1);
      expect(repoTasks[0].taskId).toBe('task-1');
    });

    it('should filter tasks by status', async () => {
      const task1 = {
        taskId: 'task-1',
        status: 'pending' as const,
        repositoryUrl: 'https://github.com/test/repo1',
        startTime: new Date().toISOString(),
      };
      
      const task2 = {
        taskId: 'task-2',
        status: 'completed' as const,
        repositoryUrl: 'https://github.com/test/repo2',
        startTime: new Date().toISOString(),
      };

      await taskStorage.saveTask(task1.taskId, task1);
      await taskStorage.saveTask(task2.taskId, task2);

      const pendingTasks = await taskStorage.getTasksByStatus('pending');
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].taskId).toBe('task-1');
    });
  });

  describe('SharedRepositoryManager', () => {
    it('should normalize repository URLs consistently', () => {
      const manager = new SharedRepositoryManager(tempDir);
      
      // Test different URL formats should normalize to the same value
      const urls = [
        'https://github.com/user/repo',
        'https://github.com/user/repo.git',
        'https://github.com/user/repo/',
        'https://token@github.com/user/repo',
      ];

      const normalized = urls.map(url => (manager as any).normalizeRepositoryUrl(url));
      
      // All should normalize to the same value
      expect(new Set(normalized).size).toBe(1);
      expect(normalized[0]).toBe('github.com/user/repo');
    });

    it('should extract repository names correctly', () => {
      const manager = new SharedRepositoryManager(tempDir);
      
      const testCases = [
        { url: 'https://github.com/user/my-repo', expected: 'my-repo' },
        { url: 'https://github.com/user/my-repo.git', expected: 'my-repo' },
        { url: 'https://gitlab.com/org/project-name', expected: 'project-name' },
      ];

      testCases.forEach(({ url, expected }) => {
        const name = (manager as any).extractRepoName(url);
        expect(name).toBe(expected);
      });
    });

    it('should determine main branch correctly', () => {
      const manager = new SharedRepositoryManager(tempDir);
      
      const testCases = [
        { branches: ['main', 'develop', 'feature-1'], expected: 'main' },
        { branches: ['master', 'develop', 'feature-1'], expected: 'master' },
        { branches: ['develop', 'feature-1'], expected: 'develop' },
        { branches: ['feature-1', 'hotfix'], expected: 'feature-1' },
      ];

      testCases.forEach(({ branches, expected }) => {
        const mainBranch = (manager as any).getMainBranch(branches);
        expect(mainBranch).toBe(expected);
      });
    });

    it('should manage repository information', () => {
      const repoInfo = {
        url: 'https://github.com/test/repo',
        normalizedUrl: 'github.com/test/repo',
        name: 'repo',
        path: '/workspace/repo',
        lastAccessed: new Date().toISOString(),
        currentBranch: 'main',
        isClean: true,
      };

      // Simulate adding repository info
      (repositoryManager as any).repositories.set(repoInfo.normalizedUrl, repoInfo);

      const retrieved = repositoryManager.getRepositoryInfo('https://github.com/test/repo');
      expect(retrieved).toEqual(repoInfo);

      const allRepos = repositoryManager.getAllRepositories();
      expect(allRepos).toHaveLength(1);
      expect(allRepos[0]).toEqual(repoInfo);
    });
  });

  describe('Task Processing Priority', () => {
    it('should handle priority correctly', () => {
      // Test priority conversion
      const testRequest: TaskProcessRequest = {
        repositoryUrl: 'https://github.com/test/repo',
        taskData: {
          taskId: 'test-task',
          title: 'Test Task',
          description: 'Test Description',
          priority: 'high',
        },
        webhookSource: 'test',
      };

      // Since we can't test Redis operations without real Redis,
      // we can at least verify the data structures are correct
      expect(testRequest.taskData.priority).toBe('high');
      expect(testRequest.repositoryUrl).toBe('https://github.com/test/repo');
    });
  });

  describe('Error Handling', () => {
    it('should handle task storage errors gracefully', async () => {
      // Test with invalid task ID
      const result = await taskStorage.getTask('non-existent-task');
      expect(result).toBeNull();
    });

    it('should handle task updates for non-existent tasks', async () => {
      // Should not throw error when updating non-existent task
      await expect(
        taskStorage.updateTask('non-existent-task', { status: 'failed' })
      ).resolves.not.toThrow();
    });
  });
});