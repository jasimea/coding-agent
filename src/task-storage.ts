import { promises as fs } from "fs";
import path from "path";
import Database from "better-sqlite3";
import { TaskStatus } from "./webhook-types.js";
import { taskProcessorLogger as logger } from "./logger.js";

/**
 * Interface for task storage operations
 */
export interface TaskStorage {
  saveTask(taskId: string, task: TaskStatus): Promise<void>;
  getTask(taskId: string): Promise<TaskStatus | null>;
  updateTask(taskId: string, updates: Partial<TaskStatus>): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  getAllTasks(): Promise<TaskStatus[]>;
  getTasksByRepository(repositoryUrl: string): Promise<TaskStatus[]>;
  getTasksByStatus(status: TaskStatus['status']): Promise<TaskStatus[]>;
  initialize(): Promise<void>;
  close(): Promise<void>;
}

/**
 * SQLite implementation of TaskStorage
 */
export class SQLiteTaskStorage implements TaskStorage {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
      
      this.db = new Database(this.dbPath);
      
      // Create tasks table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          taskId TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          progress TEXT,
          error TEXT,
          repositoryUrl TEXT,
          branchName TEXT,
          pullRequestUrl TEXT,
          planningCommentId TEXT,
          implementationProgress TEXT,
          startTime TEXT,
          endTime TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for common queries
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tasks_repository ON tasks(repositoryUrl);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(createdAt);
      `);

      logger.info("SQLite task storage initialized", { dbPath: this.dbPath });
    } catch (error) {
      logger.error("Failed to initialize SQLite task storage", { error });
      throw error;
    }
  }

  async saveTask(taskId: string, task: TaskStatus): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO tasks (
          taskId, status, progress, error, repositoryUrl, branchName,
          pullRequestUrl, planningCommentId, implementationProgress,
          startTime, endTime, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(
        taskId,
        task.status,
        task.progress,
        task.error,
        task.repositoryUrl,
        task.branchName,
        task.pullRequestUrl,
        task.planningCommentId,
        task.implementationProgress,
        task.startTime,
        task.endTime
      );

      logger.debug("Task saved to SQLite", { taskId });
    } catch (error) {
      logger.error("Failed to save task to SQLite", { taskId, error });
      throw error;
    }
  }

  async getTask(taskId: string): Promise<TaskStatus | null> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const stmt = this.db.prepare("SELECT * FROM tasks WHERE taskId = ?");
      const row = stmt.get(taskId) as any;

      if (!row) return null;

      return {
        taskId: row.taskId,
        status: row.status,
        progress: row.progress,
        error: row.error,
        repositoryUrl: row.repositoryUrl,
        branchName: row.branchName,
        pullRequestUrl: row.pullRequestUrl,
        planningCommentId: row.planningCommentId,
        implementationProgress: row.implementationProgress,
        startTime: row.startTime,
        endTime: row.endTime,
      };
    } catch (error) {
      logger.error("Failed to get task from SQLite", { taskId, error });
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<TaskStatus>): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const fields = Object.keys(updates).filter(key => key !== 'taskId');
      if (fields.length === 0) return;

      const setClause = fields.map(field => `${field} = ?`).join(", ");
      const values = fields.map(field => (updates as any)[field]);

      const stmt = this.db.prepare(`
        UPDATE tasks SET ${setClause}, updatedAt = CURRENT_TIMESTAMP 
        WHERE taskId = ?
      `);

      stmt.run(...values, taskId);
      logger.debug("Task updated in SQLite", { taskId, updates });
    } catch (error) {
      logger.error("Failed to update task in SQLite", { taskId, error });
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const stmt = this.db.prepare("DELETE FROM tasks WHERE taskId = ?");
      stmt.run(taskId);
      logger.debug("Task deleted from SQLite", { taskId });
    } catch (error) {
      logger.error("Failed to delete task from SQLite", { taskId, error });
      throw error;
    }
  }

  async getAllTasks(): Promise<TaskStatus[]> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const stmt = this.db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC");
      const rows = stmt.all() as any[];

      return rows.map(row => ({
        taskId: row.taskId,
        status: row.status,
        progress: row.progress,
        error: row.error,
        repositoryUrl: row.repositoryUrl,
        branchName: row.branchName,
        pullRequestUrl: row.pullRequestUrl,
        planningCommentId: row.planningCommentId,
        implementationProgress: row.implementationProgress,
        startTime: row.startTime,
        endTime: row.endTime,
      }));
    } catch (error) {
      logger.error("Failed to get all tasks from SQLite", { error });
      throw error;
    }
  }

  async getTasksByRepository(repositoryUrl: string): Promise<TaskStatus[]> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const stmt = this.db.prepare("SELECT * FROM tasks WHERE repositoryUrl = ? ORDER BY createdAt DESC");
      const rows = stmt.all(repositoryUrl) as any[];

      return rows.map(row => ({
        taskId: row.taskId,
        status: row.status,
        progress: row.progress,
        error: row.error,
        repositoryUrl: row.repositoryUrl,
        branchName: row.branchName,
        pullRequestUrl: row.pullRequestUrl,
        planningCommentId: row.planningCommentId,
        implementationProgress: row.implementationProgress,
        startTime: row.startTime,
        endTime: row.endTime,
      }));
    } catch (error) {
      logger.error("Failed to get tasks by repository from SQLite", { repositoryUrl, error });
      throw error;
    }
  }

  async getTasksByStatus(status: TaskStatus['status']): Promise<TaskStatus[]> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const stmt = this.db.prepare("SELECT * FROM tasks WHERE status = ? ORDER BY createdAt DESC");
      const rows = stmt.all(status) as any[];

      return rows.map(row => ({
        taskId: row.taskId,
        status: row.status,
        progress: row.progress,
        error: row.error,
        repositoryUrl: row.repositoryUrl,
        branchName: row.branchName,
        pullRequestUrl: row.pullRequestUrl,
        planningCommentId: row.planningCommentId,
        implementationProgress: row.implementationProgress,
        startTime: row.startTime,
        endTime: row.endTime,
      }));
    } catch (error) {
      logger.error("Failed to get tasks by status from SQLite", { status, error });
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info("SQLite task storage closed");
    }
  }
}

/**
 * JSON file implementation of TaskStorage (fallback option)
 */
export class JSONTaskStorage implements TaskStorage {
  private tasksFile: string;
  private tasks: Map<string, TaskStatus> = new Map();

  constructor(tasksFile: string) {
    this.tasksFile = tasksFile;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.tasksFile), { recursive: true });
      
      // Load existing tasks
      try {
        const data = await fs.readFile(this.tasksFile, 'utf-8');
        const taskArray = JSON.parse(data) as TaskStatus[];
        this.tasks = new Map(taskArray.map(task => [task.taskId, task]));
      } catch (error) {
        // File doesn't exist or is empty, start fresh
        this.tasks = new Map();
      }

      logger.info("JSON task storage initialized", { tasksFile: this.tasksFile });
    } catch (error) {
      logger.error("Failed to initialize JSON task storage", { error });
      throw error;
    }
  }

  async saveTask(taskId: string, task: TaskStatus): Promise<void> {
    try {
      this.tasks.set(taskId, task);
      await this.persistTasks();
      logger.debug("Task saved to JSON", { taskId });
    } catch (error) {
      logger.error("Failed to save task to JSON", { taskId, error });
      throw error;
    }
  }

  async getTask(taskId: string): Promise<TaskStatus | null> {
    return this.tasks.get(taskId) || null;
  }

  async updateTask(taskId: string, updates: Partial<TaskStatus>): Promise<void> {
    try {
      const existing = this.tasks.get(taskId);
      if (existing) {
        this.tasks.set(taskId, { ...existing, ...updates });
        await this.persistTasks();
        logger.debug("Task updated in JSON", { taskId, updates });
      }
    } catch (error) {
      logger.error("Failed to update task in JSON", { taskId, error });
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      this.tasks.delete(taskId);
      await this.persistTasks();
      logger.debug("Task deleted from JSON", { taskId });
    } catch (error) {
      logger.error("Failed to delete task from JSON", { taskId, error });
      throw error;
    }
  }

  async getAllTasks(): Promise<TaskStatus[]> {
    return Array.from(this.tasks.values());
  }

  async getTasksByRepository(repositoryUrl: string): Promise<TaskStatus[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.repositoryUrl === repositoryUrl);
  }

  async getTasksByStatus(status: TaskStatus['status']): Promise<TaskStatus[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.status === status);
  }

  async close(): Promise<void> {
    await this.persistTasks();
    logger.info("JSON task storage closed");
  }

  private async persistTasks(): Promise<void> {
    const taskArray = Array.from(this.tasks.values());
    await fs.writeFile(this.tasksFile, JSON.stringify(taskArray, null, 2));
  }
}