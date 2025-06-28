import { Request, Response } from 'express';
import { CodingAgent } from '../agents/coding-agent.js';
import { createContextLogger } from '../utils/logger.js';

const logger = createContextLogger('AgentInfoAPI');

// Single agent instance for the API
let agentInstance: CodingAgent | null = null;

function getAgentInstance(): CodingAgent {
  if (!agentInstance) {
    agentInstance = new CodingAgent();
  }
  return agentInstance;
}

export const agentInfoHandler = (req: Request, res: Response) => {
  try {
    const agent = getAgentInstance();
    const context = agent.getContext();
    const activeTasks = agent.getActiveTasks();
    
    res.json({
      context: {
        workingDirectory: context.workingDirectory,
        projectPath: context.projectPath,
        filesCount: context.files.length,
      },
      activeTasks: activeTasks.length,
      capabilities: [
        'file_operations',
        'git_operations',
        'command_execution',
        'project_analysis',
      ],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get agent info', { error: errorMessage });
    res.status(500).json({ error: 'Failed to get agent info' });
  }
};
