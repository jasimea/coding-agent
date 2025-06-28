// src/task-manager.ts
import { AdvancedPlanningSystem } from './advanced-planning';
import { TaskInfo, RepoContext, PlanResult } from './types';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Todo' | 'InProgress' | 'Done';
  assignee?: string;
  dueDate?: Date;
  labels?: string[];
  acceptanceCriteria?: string;
  createdAt: Date;
  updatedAt: Date;
  planningResult?: PlanResult;
}

export class TaskManager {
  private tasks: Map<string, Task>;
  private planningSystem: AdvancedPlanningSystem;
  
  constructor(apiKey: string) {
    this.tasks = new Map<string, Task>();
    this.planningSystem = new AdvancedPlanningSystem(apiKey);
  }
  
  createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    
    const task: Task = {
      id,
      ...taskData,
      createdAt: now,
      updatedAt: now
    };
    
    this.tasks.set(id, task);
    return task;
  }
  
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }
  
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }
  
  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Task | null {
    const task = this.tasks.get(id);
    
    if (!task) {
      return null;
    }
    
    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date()
    };
    
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }
  
  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }
  
  async generatePlanForTask(taskId: string, repoContext: RepoContext): Promise<PlanResult | null> {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return null;
    }
    
    const taskInfo: TaskInfo = {
      taskId: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      labels: task.labels,
      acceptanceCriteria: task.acceptanceCriteria
    };
    
    const planResult = await this.planningSystem.generateComprehensivePlan(taskInfo, repoContext);
    
    // Update the task with the planning result
    this.updateTask(taskId, { planningResult: planResult });
    
    return planResult;
  }
  
  getTasksByStatus(status: Task['status']): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }
  
  getTasksByAssignee(assignee: string): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.assignee === assignee);
  }
  
  getTasksByLabel(label: string): Task[] {
    return Array.from(this.tasks.values()).filter(
      task => task.labels && task.labels.includes(label)
    );
  }
}