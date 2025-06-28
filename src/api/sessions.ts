import { Request, Response } from 'express';
import { z } from 'zod';
import { CodingAgent } from '../agents/coding-agent.js';
import { createContextLogger } from '../utils/logger.js';

const logger = createContextLogger('SessionAPI');

// Single agent instance for the API
let agentInstance: CodingAgent | null = null;

function getAgentInstance(): CodingAgent {
  if (!agentInstance) {
    agentInstance = new CodingAgent();
  }
  return agentInstance;
}

// Create session schema
const createSessionSchema = z.object({
  workingDirectory: z.string().optional().describe('Working directory for the session'),
});

// Get session schema
const getSessionSchema = z.object({
  sessionId: z.string().describe('Session ID to retrieve'),
});

// Session operations
export const createSessionHandler = async (req: Request, res: Response) => {
  try {
    const validatedData = createSessionSchema.parse(req.body);
    
    logger.info('Creating new session', {
      workingDirectory: validatedData.workingDirectory,
    });

    const agent = getAgentInstance();
    const sessionId = agent.createNewSession(validatedData.workingDirectory);
    const metadata = agent.getSessionMetadata(sessionId);

    logger.info('Session created successfully', { sessionId });

    res.json({
      sessionId,
      metadata,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request data for session creation', { errors: error.errors });
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Session creation failed', { error: errorMessage });
    res.status(500).json({
      error: 'Session Creation Failed',
      message: errorMessage,
    });
  }
};

export const getSessionHandler = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    
    if (!sessionId) {
      res.status(400).json({
        error: 'Session ID is required',
      });
      return;
    }

    logger.info('Retrieving session', { sessionId });

    const agent = getAgentInstance();
    const metadata = agent.getSessionMetadata(sessionId);
    
    if (!metadata) {
      res.status(404).json({
        error: 'Session not found',
        sessionId,
      });
      return;
    }

    const stats = agent.getSessionStats(sessionId);

    res.json({
      metadata,
      stats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to retrieve session', { error: errorMessage });
    res.status(500).json({
      error: 'Failed to retrieve session',
      message: errorMessage,
    });
  }
};

export const listSessionsHandler = async (req: Request, res: Response) => {
  try {
    logger.info('Listing all sessions');

    const agent = getAgentInstance();
    const sessions = agent.listAllSessions();

    const sessionsWithStats = sessions.map(session => ({
      metadata: session,
      stats: agent.getSessionStats(session.sessionId),
    }));

    res.json({
      sessions: sessionsWithStats,
      total: sessions.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to list sessions', { error: errorMessage });
    res.status(500).json({
      error: 'Failed to list sessions',
      message: errorMessage,
    });
  }
};

export const endSessionHandler = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    
    if (!sessionId) {
      res.status(400).json({
        error: 'Session ID is required',
      });
      return;
    }

    logger.info('Ending session', { sessionId });

    const agent = getAgentInstance();
    const metadata = agent.getSessionMetadata(sessionId);
    
    if (!metadata) {
      res.status(404).json({
        error: 'Session not found',
        sessionId,
      });
      return;
    }

    agent.endCurrentSession();
    await agent.saveSessionMetadata(sessionId);

    const finalStats = agent.getSessionStats(sessionId);

    res.json({
      message: 'Session ended successfully',
      sessionId,
      stats: finalStats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to end session', { error: errorMessage, sessionId: req.params.sessionId });
    res.status(500).json({
      error: 'Failed to end session',
      message: errorMessage,
    });
  }
};

export const getCurrentSessionHandler = async (req: Request, res: Response) => {
  try {
    const agent = getAgentInstance();
    const currentSessionId = agent.getSessionId();
    const metadata = agent.getSessionMetadata(currentSessionId);
    const stats = agent.getSessionStats(currentSessionId);

    res.json({
      sessionId: currentSessionId,
      metadata,
      stats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get current session', { error: errorMessage });
    res.status(500).json({
      error: 'Failed to get current session',
      message: errorMessage,
    });
  }
};

export const switchSessionHandler = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    
    if (!sessionId) {
      res.status(400).json({
        error: 'Session ID is required',
      });
      return;
    }

    logger.info('Switching to session', { sessionId });

    const agent = getAgentInstance();
    
    try {
      agent.setSessionId(sessionId);
    } catch (error) {
      res.status(404).json({
        error: 'Session not found',
        sessionId,
      });
      return;
    }

    const metadata = agent.getSessionMetadata(sessionId);
    const stats = agent.getSessionStats(sessionId);

    res.json({
      message: 'Switched to session successfully',
      sessionId,
      metadata,
      stats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to switch session', { error: errorMessage, sessionId: req.params.sessionId });
    res.status(500).json({
      error: 'Failed to switch session',
      message: errorMessage,
    });
  }
};
