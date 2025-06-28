export interface AgentTask {
  id: string;
  type: 'code' | 'git' | 'file' | 'command';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  result?: any;
  error?: string;
  plan?: AgentPlan;
}

export interface AgentContext {
  workingDirectory: string;
  projectPath: string;
  files: FileInfo[];
  gitStatus?: GitStatus;
  environment: Record<string, string>;
}

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  lastModified: Date;
  content?: string;
}

export interface GitStatus {
  branch: string;
  staged: string[];
  modified: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

export interface AgentRequest {
  task: string;
  context?: Partial<AgentContext>;
  options?: {
    maxExecutionTime?: number;
    allowDangerousCommands?: boolean;
    workingDirectory?: string;
  };
}

export interface AgentResponse {
  taskId: string;
  status: 'started' | 'completed' | 'failed';
  result?: any;
  error?: string;
  steps: AgentStep[];
  executionTime: number;
  plan?: AgentPlan;
}

export interface AgentStep {
  tool: string;
  action: string;
  input: any;
  output: any;
  timestamp: Date;
  duration: number;
  planStepId?: string;
}

import { z } from 'zod';

export interface AITool {
  description: string;
  parameters: z.ZodSchema;
  execute(parameters: any): Promise<any>;
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'google';
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

// Planning-related interfaces
export interface PlanStep {
  id: string;
  description: string;
  action: 'file_operation' | 'git_operation' | 'command_execution' | 'analysis';
  complexity: 'low' | 'medium' | 'high';
  estimatedDuration: string;
}

export interface AgentPlan {
  id: string;
  task: string;
  steps: PlanStep[];
  summary: string;
  estimatedTotalTime: string;
  dependencies: string[];
  createdAt: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}
