#!/usr/bin/env node

import dotenv from "dotenv";
import { WebhookServer } from "./webhook-server";
import { mainLogger as logger } from "./logger";

// Load environment variables
dotenv.config();

async function main() {
  // Validate required environment variables
  const claudeApiKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeApiKey) {
    logger.error("ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  const port = parseInt(process.env.PORT || "3000", 10);
  const webhookSecret = process.env.WEBHOOK_SECRET;

  // Create and start webhook server
  const server = new WebhookServer(port, claudeApiKey, webhookSecret);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    process.exit(0);
  });

  // Start the server
  try {
    server.start();
    logger.info("🚀 Autonomous Coding Agent is running!", {
      port,
      endpoints: [
        "/webhook/jira",
        "/webhook/trello",
        "/api/tasks/:taskId/status",
        "/api/tasks/trigger",
        "/health",
      ],
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error("Unhandled error during startup", { error });
  process.exit(1);
});
