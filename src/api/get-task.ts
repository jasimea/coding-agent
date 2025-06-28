import { Request, Response } from 'express';
import { CodingAgent } from '../agents/coding-agent.js';
import { createContextLogger } from '../utils/logger.js';

const logger = createContextLogger('GetTaskAPI');

// Single agent instance for the API
let agentInstance: CodingAgent | null = null;

function getAgentInstance(): CodingAgent {
  if (!agentInstance) {
    agentInstance = new CodingAgent();
  }
  return agentInstance;
}

export const getTaskHandler = (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      res.status(400).json({ error: 'Task ID is required' });
      return;
    }
    
    const agent = getAgentInstance();
    const task = agent.getTask(taskId);
    
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    res.json({ task });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get task', { error: errorMessage });
    res.status(500).json({ error: 'Failed to get task' });
  }
};
