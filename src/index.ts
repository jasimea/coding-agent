import { Server } from './server.js';
import { Config } from './config/index.js';
import { createContextLogger } from './utils/logger.js';

const logger = createContextLogger('Main');

async function startServer() {
  try {
    logger.info('Starting Coding Agent Server', {
      nodeEnv: Config.server.nodeEnv,
      port: Config.server.port,
    });

    // Create and start the server
    const server = new Server();
    try {
      server.start(Config.server.port);
    } catch (startError) {
      logger.error('Failed to start server', { error: startError });
      console.error('Server start error:', startError);
      throw startError;
    }

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      logger.info('Received shutdown signal', { signal });
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { 
        error: error.message, 
        stack: error.stack,
        name: error.name
      });
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to start server', { error: errorMessage });
    process.exit(1);
  }
}

// Start the server
startServer();
