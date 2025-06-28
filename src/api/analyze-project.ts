import { Request, Response } from 'express';
import { z } from 'zod';
import { CodingAgent } from '../agents/coding-agent.js';
import { createContextLogger } from '../utils/logger.js';

const logger = createContextLogger('AnalyzeProjectAPI');

// Single agent instance for the API
let agentInstance: CodingAgent | null = null;

function getAgentInstance(): CodingAgent {
  if (!agentInstance) {
    agentInstance = new CodingAgent();
  }
  return agentInstance;
}

// Request validation schema
const analyzeProjectSchema = z.object({
  projectPath: z.string().optional().describe('Path to the project to analyze'),
});

export const analyzeProjectHandler = async (req: Request, res: Response) => {
  try {
    const validatedData = analyzeProjectSchema.parse(req.body);
    
    logger.info('Analyzing project', { projectPath: validatedData.projectPath });

    // Update agent context if project path is provided
    let agent = getAgentInstance();
    if (validatedData.projectPath) {
      agent = new CodingAgent(undefined, validatedData.projectPath);
      agentInstance = agent; // Update the shared instance
    }

    const analysis = await agent.analyzeProject();
    
    logger.info('Project analysis completed', {
      projectPath: analysis.projectPath,
      languages: analysis.languages,
      filesCount: analysis.projectStructure.length,
    });

    res.json(analysis);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request data for analysis', { errors: error.errors });
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Project analysis failed', { error: errorMessage });
    res.status(500).json({
      error: 'Project Analysis Failed',
      message: errorMessage,
    });
  }
};
