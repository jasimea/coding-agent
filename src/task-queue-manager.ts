import Redis from "ioredis";
import { TaskProcessRequest, TaskStatus } from "./webhook-types.js";
import { TaskStorage } from "./task-storage.js";
import { taskProcessorLogger as logger } from "./logger.js";

export interface QueuedTask {
  taskId: string;
  request: TaskProcessRequest;
  priority: number;
  queuedAt: string;
  repositoryUrl: string;
}

export interface RepositoryLock {
  repositoryUrl: string;
  taskId: string;
  lockedAt: string;
  lockTimeout: number;
}

/**
 * Task Queue Manager with Redis backend and repository locking
 */
export class TaskQueueManager {
  private redis: Redis;
  private taskStorage: TaskStorage;
  private readonly queueKey = "coding-agent:task-queue";
  private readonly lockPrefix = "coding-agent:repo-lock:";
  private readonly lockTimeout = 3600000; // 1 hour in milliseconds
  private readonly maxRetries = 3;
  private redisAvailable = false;
  private inMemoryQueue: QueuedTask[] = []; // Fallback when Redis is unavailable

  constructor(taskStorage: TaskStorage, redisUrl?: string) {
    this.taskStorage = taskStorage;
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: this.maxRetries,
      lazyConnect: true,
    });

    // Handle Redis connection events
    this.redis.on("connect", () => {
      this.redisAvailable = true;
      logger.info("Redis connected successfully");
    });

    this.redis.on("error", (error) => {
      this.redisAvailable = false;
      logger.error("Redis connection error", { error: error.message });
    });

    this.redis.on("close", () => {
      this.redisAvailable = false;
      logger.warn("Redis connection closed");
    });
  }

  /**
   * Initialize the queue manager
   */
  async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      this.redisAvailable = true;
      await this.taskStorage.initialize();
      await this.cleanupExpiredLocks();
      logger.info("Task queue manager initialized with Redis");
    } catch (error) {
      logger.error("Failed to initialize Redis", { 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      
      // Initialize storage even if Redis fails
      try {
        await this.taskStorage.initialize();
        this.redisAvailable = false;
        logger.warn("Task queue manager initialized without Redis (using in-memory fallback)");
      } catch (storageError) {
        logger.error("Failed to initialize task storage", { 
          error: storageError instanceof Error ? storageError.message : "Unknown storage error" 
        });
        throw storageError;
      }
    }
  }

  /**
   * Add a task to the queue
   */
  async enqueueTask(request: TaskProcessRequest, priority: number = 1): Promise<string> {
    try {
      const taskId = request.taskData.taskId;
      const queuedTask: QueuedTask = {
        taskId,
        request,
        priority,
        queuedAt: new Date().toISOString(),
        repositoryUrl: request.repositoryUrl,
      };

      // Save task to storage with queued status
      const taskStatus: TaskStatus = {
        taskId,
        status: "pending",
        progress: "Task queued for processing",
        repositoryUrl: request.repositoryUrl,
        startTime: new Date().toISOString(),
      };
      await this.taskStorage.saveTask(taskId, taskStatus);

      if (this.redisAvailable) {
        // Add to Redis queue with priority
        const score = Date.now() + (1000 - priority); // Higher priority = lower score
        await this.redis.zadd(this.queueKey, score, JSON.stringify(queuedTask));
        logger.info("Task enqueued to Redis", { taskId, repositoryUrl: request.repositoryUrl, priority });
      } else {
        // Fallback to in-memory queue
        this.inMemoryQueue.push(queuedTask);
        this.inMemoryQueue.sort((a, b) => b.priority - a.priority); // Sort by priority descending
        logger.info("Task enqueued to in-memory queue", { taskId, repositoryUrl: request.repositoryUrl, priority });
      }

      return taskId;
    } catch (error) {
      logger.error("Failed to enqueue task", { error });
      throw error;
    }
  }

  /**
   * Get the next task from the queue, respecting repository locks
   */
  async dequeueTask(): Promise<QueuedTask | null> {
    try {
      let queuedTask: QueuedTask | null = null;

      if (this.redisAvailable) {
        const taskData = await this.redis.zpopmin(this.queueKey, 1);
        if (!taskData || taskData.length === 0 || !taskData[1]) {
          return null;
        }
        queuedTask = JSON.parse(taskData[1]);
      } else {
        // Use in-memory queue
        if (this.inMemoryQueue.length === 0) {
          return null;
        }
        queuedTask = this.inMemoryQueue.shift()!;
      }

      if (!queuedTask) {
        return null;
      }
      
      // Check if repository is locked
      const isLocked = await this.isRepositoryLocked(queuedTask.repositoryUrl);
      if (isLocked) {
        // Re-queue the task for later processing
        if (this.redisAvailable) {
          await this.redis.zadd(this.queueKey, Date.now() + 5000, JSON.stringify(queuedTask));
        } else {
          this.inMemoryQueue.push(queuedTask);
        }
        logger.debug("Repository locked, re-queuing task", { 
          taskId: queuedTask.taskId, 
          repositoryUrl: queuedTask.repositoryUrl 
        });
        return null;
      }

      // Acquire repository lock
      await this.acquireRepositoryLock(queuedTask.repositoryUrl, queuedTask.taskId);
      
      logger.info("Task dequeued", { taskId: queuedTask.taskId, repositoryUrl: queuedTask.repositoryUrl });
      return queuedTask;
    } catch (error) {
      logger.error("Failed to dequeue task", { error });
      throw error;
    }
  }

  /**
   * Check if a repository is currently locked
   */
  async isRepositoryLocked(repositoryUrl: string): Promise<boolean> {
    try {
      const normalizedUrl = this.normalizeRepositoryUrl(repositoryUrl);
      const lockKey = `${this.lockPrefix}${normalizedUrl}`;
      const lockData = await this.redis.get(lockKey);
      
      if (!lockData) return false;
      
      const lock: RepositoryLock = JSON.parse(lockData);
      const now = Date.now();
      const lockedAt = new Date(lock.lockedAt).getTime();
      
      // Check if lock has expired
      if (now - lockedAt > lock.lockTimeout) {
        await this.redis.del(lockKey);
        logger.info("Expired repository lock removed", { repositoryUrl: normalizedUrl });
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error("Failed to check repository lock", { repositoryUrl, error });
      return false; // Assume unlocked on error
    }
  }

  /**
   * Acquire a lock for a repository
   */
  async acquireRepositoryLock(repositoryUrl: string, taskId: string): Promise<boolean> {
    try {
      const normalizedUrl = this.normalizeRepositoryUrl(repositoryUrl);
      const lockKey = `${this.lockPrefix}${normalizedUrl}`;
      
      const lock: RepositoryLock = {
        repositoryUrl: normalizedUrl,
        taskId,
        lockedAt: new Date().toISOString(),
        lockTimeout: this.lockTimeout,
      };

      // Use SET with NX to ensure atomic lock acquisition
      const result = await this.redis.set(
        lockKey, 
        JSON.stringify(lock), 
        'PX', 
        this.lockTimeout, 
        'NX'
      );

      if (result === 'OK') {
        logger.info("Repository lock acquired", { repositoryUrl: normalizedUrl, taskId });
        return true;
      } else {
        logger.warn("Failed to acquire repository lock", { repositoryUrl: normalizedUrl, taskId });
        return false;
      }
    } catch (error) {
      logger.error("Error acquiring repository lock", { repositoryUrl, taskId, error });
      return false;
    }
  }

  /**
   * Release a repository lock
   */
  async releaseRepositoryLock(repositoryUrl: string, taskId: string): Promise<void> {
    try {
      const normalizedUrl = this.normalizeRepositoryUrl(repositoryUrl);
      const lockKey = `${this.lockPrefix}${normalizedUrl}`;
      
      // Use Lua script to ensure we only release our own lock
      const luaScript = `
        local lockData = redis.call('GET', KEYS[1])
        if lockData then
          local lock = cjson.decode(lockData)
          if lock.taskId == ARGV[1] then
            return redis.call('DEL', KEYS[1])
          end
        end
        return 0
      `;

      const result = await this.redis.eval(luaScript, 1, lockKey, taskId);
      if (result === 1) {
        logger.info("Repository lock released", { repositoryUrl: normalizedUrl, taskId });
      } else {
        logger.warn("Lock not released - not owned by task", { repositoryUrl: normalizedUrl, taskId });
      }
    } catch (error) {
      logger.error("Error releasing repository lock", { repositoryUrl, taskId, error });
    }
  }

  /**
   * Get current queue size
   */
  async getQueueSize(): Promise<number> {
    try {
      if (this.redisAvailable) {
        return await this.redis.zcard(this.queueKey);
      } else {
        return this.inMemoryQueue.length;
      }
    } catch (error) {
      logger.error("Failed to get queue size", { error });
      return this.inMemoryQueue.length; // Fallback to in-memory count
    }
  }

  /**
   * Get queued tasks (for monitoring)
   */
  async getQueuedTasks(limit: number = 10): Promise<QueuedTask[]> {
    try {
      if (this.redisAvailable) {
        const tasks = await this.redis.zrange(this.queueKey, 0, limit - 1);
        return tasks.map(task => JSON.parse(task));
      } else {
        return this.inMemoryQueue.slice(0, limit);
      }
    } catch (error) {
      logger.error("Failed to get queued tasks", { error });
      return this.inMemoryQueue.slice(0, limit); // Fallback to in-memory tasks
    }
  }

  /**
   * Get active repository locks
   */
  async getActiveRepositoryLocks(): Promise<RepositoryLock[]> {
    try {
      const pattern = `${this.lockPrefix}*`;
      const keys = await this.redis.keys(pattern);
      const locks: RepositoryLock[] = [];

      for (const key of keys) {
        const lockData = await this.redis.get(key);
        if (lockData) {
          try {
            locks.push(JSON.parse(lockData));
          } catch (parseError) {
            logger.warn("Invalid lock data found", { key, lockData });
          }
        }
      }

      return locks;
    } catch (error) {
      logger.error("Failed to get active repository locks", { error });
      return [];
    }
  }

  /**
   * Clean up expired locks
   */
  async cleanupExpiredLocks(): Promise<void> {
    try {
      const pattern = `${this.lockPrefix}*`;
      const keys = await this.redis.keys(pattern);
      const now = Date.now();
      let cleanedCount = 0;

      for (const key of keys) {
        const lockData = await this.redis.get(key);
        if (lockData) {
          try {
            const lock: RepositoryLock = JSON.parse(lockData);
            const lockedAt = new Date(lock.lockedAt).getTime();
            
            if (now - lockedAt > lock.lockTimeout) {
              await this.redis.del(key);
              cleanedCount++;
            }
          } catch (parseError) {
            // Clean up invalid lock data
            await this.redis.del(key);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info("Cleaned up expired repository locks", { cleanedCount });
      }
    } catch (error) {
      logger.error("Failed to cleanup expired locks", { error });
    }
  }

  /**
   * Update task status in storage
   */
  async updateTaskStatus(taskId: string, updates: Partial<TaskStatus>): Promise<void> {
    try {
      await this.taskStorage.updateTask(taskId, updates);
    } catch (error) {
      logger.error("Failed to update task status", { taskId, error });
      throw error;
    }
  }

  /**
   * Get task status from storage
   */
  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    try {
      return await this.taskStorage.getTask(taskId);
    } catch (error) {
      logger.error("Failed to get task status", { taskId, error });
      return null;
    }
  }

  /**
   * Get all tasks from storage
   */
  async getAllTasks(): Promise<TaskStatus[]> {
    try {
      return await this.taskStorage.getAllTasks();
    } catch (error) {
      logger.error("Failed to get all tasks", { error });
      return [];
    }
  }

  /**
   * Close the queue manager
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
      await this.taskStorage.close();
      logger.info("Task queue manager closed");
    } catch (error) {
      logger.error("Error closing task queue manager", { error });
    }
  }

  /**
   * Normalize repository URL for consistent locking
   */
  private normalizeRepositoryUrl(url: string): string {
    return url.toLowerCase()
      .replace(/\.git$/, '')
      .replace(/\/$/, '')
      .replace(/^https?:\/\//, '');
  }
}