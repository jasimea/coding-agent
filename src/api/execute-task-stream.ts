import { Request, Response } from 'express';
import { z } from 'zod';
import { CodingAgent } from '../agents/coding-agent.js';
import { AgentRequest } from '../types/index.js';
import { createContextLogger } from '../utils/logger.js';

const logger = createContextLogger('ExecuteTaskStreamAPI');

// Single agent instance for the API
let agentInstance: CodingAgent | null = null;

function getAgentInstance(): CodingAgent {
  if (!agentInstance) {
    agentInstance = new CodingAgent();
  }
  return agentInstance;
}

// Request validation schema
const executeTaskSchema = z.object({
  sessionId: z.string().optional().describe('Session ID to associate with this task'),
  task: z.string().min(1).max(10000).describe('The task description for the agent to execute'),
  context: z.object({
    sessionId: z.string().optional(),
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

export const executeTaskStreamHandler = async (req: Request, res: Response) => {
  try {
    const validatedData = executeTaskSchema.parse(req.body);
    
    logger.info('Executing streaming agent task', {
      sessionId: validatedData.sessionId,
      task: validatedData.task.substring(0, 100) + (validatedData.task.length > 100 ? '...' : ''),
    });

    const agent = getAgentInstance();
    
    // If sessionId is provided, switch to that session or create it
    if (validatedData.sessionId) {
      try {
        agent.setSessionId(validatedData.sessionId);
      } catch (error) {
        // Session doesn't exist, create it
        logger.info('Creating new session for streaming', { sessionId: validatedData.sessionId });
        agent.createNewSession(validatedData.context?.workingDirectory || validatedData.options?.workingDirectory);
        agent.setSessionId(validatedData.sessionId);
      }
    }

    const request: AgentRequest = {
      sessionId: validatedData.sessionId,
      task: validatedData.task,
      context: validatedData.context,
      options: validatedData.options,
    };

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const textStream = await agent.executeTaskStream(request);
    
    for await (const textPart of textStream) {
      res.write(textPart);
    }
    
    res.end();
    
    logger.info('Streaming agent task completed');
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request data for streaming', { errors: error.errors });
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Streaming agent task execution failed', { error: errorMessage });
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Streaming Task Execution Failed',
        message: errorMessage,
      });
    }
  }
};
