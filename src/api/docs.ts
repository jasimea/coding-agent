import { Request, Response } from 'express';
import { z } from 'zod';

// Validation schemas for documentation
const executeTaskSchema = z.object({
  task: z.string().min(1).max(10000).describe('The task description for the agent to execute'),
  context: z.object({
    workingDirectory: z.string().optional(),
    projectPath: z.string().optional(),
    environment: z.record(z.string()).optional(),
  }).optional(),
  options: z.object({
    maxExecutionTime: z.number().optional(),
    allowDangerousCommands: z.boolean().optional(),
    workingDirectory: z.string().optional(),
  }).optional(),
});

const analyzeProjectSchema = z.object({
  projectPath: z.string().optional().describe('Path to the project to analyze'),
});

export const docsHandler = (req: Request, res: Response) => {
  res.json({
    name: 'Coding Agent API',
    version: '1.0.0',
    description: 'An autonomous coding agent with planning capabilities that can execute tasks, manage files, perform git operations, and run commands.',
    features: [
      'Task planning and execution',
      'File and directory operations',
      'Git repository management',
      'Command execution',
      'Project analysis',
      'Streaming responses'
    ],
    endpoints: {
      'GET /health': 'Health check endpoint',
      'GET /agent/info': 'Get agent information and context',
      'POST /agent/execute': 'Execute a task with the agent (includes planning step)',
      'POST /agent/execute/stream': 'Execute a task with streaming response',
      'POST /agent/analyze': 'Analyze a project structure and dependencies',
      'GET /agent/tasks': 'Get all active tasks',
      'GET /agent/tasks/:taskId': 'Get specific task details',
      'GET /docs': 'This API documentation',
    },
    schemas: {
      executeTask: {
        description: 'Schema for task execution requests',
        schema: executeTaskSchema.shape,
      },
      analyzeProject: {
        description: 'Schema for project analysis requests',
        schema: analyzeProjectSchema.shape,
      },
    },
    planning: {
      description: 'The agent now includes a planning step before execution',
      process: [
        '1. Receive task request',
        '2. Create detailed execution plan',
        '3. Execute plan step by step',
        '4. Return results with plan details'
      ],
      benefits: [
        'Better task breakdown',
        'More predictable execution',
        'Improved error handling',
        'Enhanced visibility into agent reasoning'
      ]
    }
  });
};
