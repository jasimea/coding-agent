// src/server.ts
import express, { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { TaskProcessor } from "./task-processor";

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Initialize TaskProcessor with API key from environment variables
const taskProcessor = new TaskProcessor(process.env.ANTHROPIC_API_KEY || "");

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Task status endpoint
app.get("/api/tasks/:taskId/status", async (req, res) => {
  try {
    const status = await taskProcessor.getTaskStatus(req.params.taskId);

    if (!status) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(status);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
});

// List all tasks endpoint
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await taskProcessor.getAllTaskStatuses();
    res.json(tasks);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export default app;
