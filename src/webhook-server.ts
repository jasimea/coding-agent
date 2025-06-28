import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { RateLimiterMemory } from "rate-limiter-flexible";
import crypto from "crypto";
import winston from "winston";
import { TaskProcessor } from "./task-processor";
import {
  WebhookPayload,
  JiraWebhookPayload,
  TrelloWebhookPayload,
} from "./webhook-types";

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: "logs/webhook.log" }),
    new winston.transports.Console(),
  ],
});

export class WebhookServer {
  private app: express.Application;
  private taskProcessor: TaskProcessor;
  private rateLimiter: RateLimiterMemory;
  private webhookSecret: string;

  constructor(
    private port: number = 3000,
    private claudeApiKey: string,
    webhookSecret?: string,
  ) {
    this.app = express();
    this.taskProcessor = new TaskProcessor(claudeApiKey);
    this.webhookSecret = webhookSecret || process.env.WEBHOOK_SECRET || "";

    // Rate limiting: 10 requests per minute per IP
    this.rateLimiter = new RateLimiterMemory({
      keyPrefix: "webhook",
      points: 10,
      duration: 60,
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(",") || [
          "http://localhost:3000",
        ],
        credentials: true,
      }),
    );

    // Body parsing
    this.app.use("/webhook", express.raw({ type: "application/json" }));
    this.app.use(express.json());

    // Rate limiting
    this.app.use(async (req, res, next) => {
      try {
        await this.rateLimiter.consume(req.ip || "unknown");
        next();
      } catch {
        res.status(429).json({ error: "Too many requests" });
      }
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        timestamp: new Date().toISOString(),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // JIRA webhook endpoint
    this.app.post(
      "/webhook/jira",
      async (req: Request, res: Response): Promise<void> => {
        try {
          // Verify webhook signature if secret is configured
          if (this.webhookSecret && !this.verifyJiraSignature(req)) {
            logger.warn("Invalid JIRA webhook signature", { ip: req.ip });
            res.status(401).json({ error: "Invalid signature" });
            return;
          }

          const payload = JSON.parse(req.body.toString()) as JiraWebhookPayload;
          logger.info("Received JIRA webhook", {
            issueKey: payload.issue?.key,
            eventType: payload.webhookEvent,
          });

          await this.handleJiraWebhook(payload);
          res.json({ success: true, message: "Webhook processed" });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logger.error("Error processing JIRA webhook", {
            error: errorMessage,
          });
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    // Trello webhook endpoint
    this.app.post(
      "/webhook/trello",
      async (req: Request, res: Response): Promise<void> => {
        try {
          // Verify webhook signature if secret is configured
          if (this.webhookSecret && !this.verifyTrelloSignature(req)) {
            logger.warn("Invalid Trello webhook signature", { ip: req.ip });
            res.status(401).json({ error: "Invalid signature" });
            return;
          }

          const payload = JSON.parse(
            req.body.toString(),
          ) as TrelloWebhookPayload;
          logger.info("Received Trello webhook", {
            cardId: payload.action?.data?.card?.id,
            actionType: payload.action?.type,
          });

          await this.handleTrelloWebhook(payload);
          res.json({ success: true, message: "Webhook processed" });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logger.error("Error processing Trello webhook", {
            error: errorMessage,
          });
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    // Task status endpoint
    this.app.get(
      "/api/tasks/:taskId/status",
      async (req: Request, res: Response): Promise<void> => {
        try {
          const taskId = req.params.taskId;
          if (!taskId) {
            res.status(400).json({ error: "Task ID is required" });
            return;
          }

          const status = await this.taskProcessor.getTaskStatus(taskId);
          res.json(status);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logger.error("Error getting task status", { error: errorMessage });
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    // Manual task trigger endpoint (for testing)
    this.app.post(
      "/api/tasks/trigger",
      async (req: Request, res: Response): Promise<void> => {
        try {
          const { repositoryUrl, taskData } = req.body;

          if (!repositoryUrl || !taskData) {
            res.status(400).json({
              error: "repositoryUrl and taskData are required",
            });
            return;
          }

          const taskId = await this.taskProcessor.processTask({
            repositoryUrl,
            taskData,
            webhookSource: "manual",
          });

          res.json({ success: true, taskId });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logger.error("Error triggering manual task", { error: errorMessage });
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );
  }

  private async handleJiraWebhook(payload: JiraWebhookPayload): Promise<void> {
    // Only process specific events
    const relevantEvents = ["jira:issue_updated", "jira:issue_created"];

    if (!relevantEvents.includes(payload.webhookEvent)) {
      logger.info("Ignoring JIRA webhook event", {
        event: payload.webhookEvent,
      });
      return;
    }

    // Check if status changed to a development status
    const developmentStatuses = [
      "In Progress",
      "Development",
      "Ready for Development",
      "To Do",
    ];

    const currentStatus = payload.issue?.fields?.status?.name;
    const isRelevantStatusChange = developmentStatuses.includes(
      currentStatus || "",
    );

    if (!isRelevantStatusChange) {
      logger.info("Status not relevant for development", {
        status: currentStatus,
      });
      return;
    }

    // Extract repository URL from custom field or issue description
    const repositoryUrl = this.extractRepositoryUrl(
      payload.issue?.fields?.description || "",
    );

    if (!repositoryUrl) {
      logger.warn("No repository URL found in JIRA issue", {
        issueKey: payload.issue?.key,
      });
      return;
    }

    // Create task data from JIRA issue
    const taskData = {
      taskId: payload.issue?.key || "",
      title: payload.issue?.fields?.summary || "",
      description: payload.issue?.fields?.description || "",
      priority: payload.issue?.fields?.priority?.name || "Medium",
      labels: payload.issue?.fields?.labels?.map((l: any) => l.name) || [],
      acceptanceCriteria: this.extractAcceptanceCriteria(
        payload.issue?.fields?.description || "",
      ),
    };

    // Process the task
    await this.taskProcessor.processTask({
      repositoryUrl,
      taskData,
      webhookSource: "jira",
      issueKey: payload.issue?.key,
    });
  }

  private async handleTrelloWebhook(
    payload: TrelloWebhookPayload,
  ): Promise<void> {
    // Only process card moves to development lists
    if (
      payload.action?.type !== "updateCard" ||
      !payload.action?.data?.listAfter
    ) {
      return;
    }

    const developmentLists = [
      "In Progress",
      "Development",
      "To Do",
      "Ready for Development",
    ];

    const targetListName = payload.action.data.listAfter.name;
    const isRelevantMove = developmentLists.includes(targetListName);

    if (!isRelevantMove) {
      logger.info("Card moved to non-development list", {
        list: targetListName,
      });
      return;
    }

    // Extract repository URL from card description
    const repositoryUrl = this.extractRepositoryUrl(
      payload.action?.data?.card?.desc || "",
    );

    if (!repositoryUrl) {
      logger.warn("No repository URL found in Trello card", {
        cardId: payload.action?.data?.card?.id,
      });
      return;
    }

    // Create task data from Trello card
    const taskData = {
      taskId: payload.action?.data?.card?.id || "",
      title: payload.action?.data?.card?.name || "",
      description: payload.action?.data?.card?.desc || "",
      priority: "Medium", // Trello doesn't have built-in priority
      labels: payload.action?.data?.card?.labels?.map((l: any) => l.name) || [],
      acceptanceCriteria: this.extractAcceptanceCriteria(
        payload.action?.data?.card?.desc || "",
      ),
    };

    // Process the task
    await this.taskProcessor.processTask({
      repositoryUrl,
      taskData,
      webhookSource: "trello",
      cardId: payload.action?.data?.card?.id,
    });
  }

  private verifyJiraSignature(req: Request): boolean {
    if (!this.webhookSecret) return true;

    const signature = req.get("X-Hub-Signature-256");
    if (!signature) return false;

    const expectedSignature =
      "sha256=" +
      crypto
        .createHmac("sha256", this.webhookSecret)
        .update(req.body)
        .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  private verifyTrelloSignature(req: Request): boolean {
    if (!this.webhookSecret) return true;

    const signature = req.get("X-Trello-Webhook");
    if (!signature) return false;

    const expectedSignature = crypto
      .createHmac("sha1", this.webhookSecret)
      .update(req.body + process.env.TRELLO_CALLBACK_URL)
      .digest("base64");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  private extractRepositoryUrl(text: string): string | null {
    // Look for GitHub/GitLab URLs in text
    const urlRegex =
      /https?:\/\/(github\.com|gitlab\.com)\/[\w-]+\/[\w-]+(\.git)?/i;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  }

  private extractAcceptanceCriteria(text: string): string {
    // Look for acceptance criteria in common formats
    const patterns = [
      /acceptance criteria:?\s*(.*?)(?:\n\n|\n$|$)/is,
      /ac:?\s*(.*?)(?:\n\n|\n$|$)/is,
      /given.*when.*then.*/is,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1]?.trim() || match[0];
      }
    }

    return "";
  }

  public start(): void {
    this.app.listen(this.port, () => {
      logger.info(`Webhook server running on port ${this.port}`);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}
