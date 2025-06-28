import { Request, Response } from 'express';
import { CodingAgent } from '../agents/coding-agent.js';
import { createContextLogger } from '../utils/logger.js';

const logger = createContextLogger('GetTasksAPI');

// Single agent instance for the API
let agentInstance: CodingAgent | null = null;

function getAgentInstance(): CodingAgent {
  if (!agentInstance) {
    agentInstance = new CodingAgent();
  }
  return agentInstance;
}

export const getTasksHandler = (req: Request, res: Response) => {
  try {
    const agent = getAgentInstance();
    const activeTasks = agent.getActiveTasks();
    res.json({ tasks: activeTasks });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get active tasks', { error: errorMessage });
    res.status(500).json({ error: 'Failed to get active tasks' });
  }
};
