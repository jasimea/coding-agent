#!/usr/bin/env node

import { Command } from "commander";
import dotenv from "dotenv";
import chalk from "chalk";
import { TaskProcessor } from "../task-processor.js";
import { TaskProcessRequest } from "../webhook-types.js";
import { cliLogger as logger } from "../logger.js";

// Load environment variables
dotenv.config();

class AutonomousCodingCLI {
  public taskProcessor: TaskProcessor;

  constructor() {
    const claudeApiKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeApiKey) {
      console.error(
        chalk.red("❌ ANTHROPIC_API_KEY environment variable is required"),
      );
      process.exit(1);
    }

    this.taskProcessor = new TaskProcessor(claudeApiKey);
  }

  async processTask(options: {
    repository: string;
    taskId: string;
    title: string;
    description: string;
    priority?: string;
    acceptanceCriteria?: string;
    labels?: string[];
  }): Promise<void> {
    console.log(chalk.blue("🤖 Autonomous Coding Agent - Local Testing"));
    console.log(chalk.blue("=========================================="));
    console.log();

    // Validate repository URL
    if (!this.isValidGitHubURL(options.repository)) {
      console.error(chalk.red("❌ Invalid GitHub repository URL"));
      console.error(
        chalk.yellow("Expected format: https://github.com/owner/repo"),
      );
      process.exit(1);
    }

    console.log(chalk.green("📋 Task Details:"));
    console.log(`  Repository: ${chalk.cyan(options.repository)}`);
    console.log(`  Task ID: ${chalk.cyan(options.taskId)}`);
    console.log(`  Title: ${chalk.cyan(options.title)}`);
    console.log(`  Description: ${chalk.gray(options.description)}`);
    console.log(`  Priority: ${chalk.yellow(options.priority || "Medium")}`);
    if (options.acceptanceCriteria) {
      console.log(
        `  Acceptance Criteria: ${chalk.gray(options.acceptanceCriteria)}`,
      );
    }
    console.log();

    const taskRequest: TaskProcessRequest = {
      repositoryUrl: options.repository,
      taskData: {
        taskId: options.taskId,
        title: options.title,
        description: options.description,
        priority: options.priority || "Medium",
        labels: options.labels || [],
        acceptanceCriteria: options.acceptanceCriteria,
      },
      webhookSource: "cli",
    };

    try {
      console.log(chalk.blue("🚀 Starting task processing..."));
      const taskId = await this.taskProcessor.processTask(taskRequest);

      console.log(chalk.green(`✅ Task processing started with ID: ${taskId}`));
      console.log();

      // Monitor task progress
      await this.monitorTaskProgress(taskId);
    } catch (error) {
      console.error(chalk.red("❌ Error processing task:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : "Unknown error"),
      );
      process.exit(1);
    }
  }

  async monitorTaskProgress(taskId: string): Promise<void> {
    console.log(chalk.blue("📊 Monitoring task progress..."));
    console.log(chalk.gray("Press Ctrl+C to stop monitoring"));
    console.log();

    const startTime = Date.now();
    let lastStatus = "";

    const checkProgress = async () => {
      try {
        const status = await this.taskProcessor.getTaskStatus(taskId);

        if (!status) {
          console.log(chalk.red("❌ Task not found"));
          return false;
        }

        // Only log if status changed
        if (status.progress !== lastStatus) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const statusEmoji = this.getStatusEmoji(status.status);

          console.log(
            `${statusEmoji} [${elapsed}s] ${status.progress || status.status}`,
          );
          lastStatus = status.progress || "";

          // Show additional info for certain states
          if (status.branchName) {
            console.log(chalk.gray(`  └─ Branch: ${status.branchName}`));
          }

          if (status.pullRequestUrl) {
            console.log(chalk.gray(`  └─ PR: ${status.pullRequestUrl}`));
          }

          if (status.planningCommentId) {
            console.log(chalk.gray(`  └─ Planning comment posted`));
          }
        }

        // Check if task is complete
        if (status.status === "completed") {
          console.log();
          console.log(chalk.green("🎉 Task completed successfully!"));

          if (status.pullRequestUrl) {
            console.log(
              chalk.cyan(
                `📖 Review the implementation: ${status.pullRequestUrl}`,
              ),
            );
          }

          if (status.branchName) {
            console.log(chalk.gray(`🌿 Branch created: ${status.branchName}`));
          }

          const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(chalk.gray(`⏱️  Total time: ${totalTime}s`));

          return false; // Stop monitoring
        }

        if (status.status === "failed") {
          console.log();
          console.log(chalk.red("❌ Task failed"));
          if (status.error) {
            console.log(chalk.red(`Error: ${status.error}`));
          }
          return false; // Stop monitoring
        }

        return true; // Continue monitoring
      } catch (error) {
        console.error(chalk.red("Error checking progress:"), error);
        return false;
      }
    };

    // Initial check
    let shouldContinue = await checkProgress();

    // Continue monitoring
    const interval = setInterval(async () => {
      shouldContinue = await checkProgress();

      if (!shouldContinue) {
        clearInterval(interval);
      }
    }, 2000); // Check every 2 seconds

    // Handle Ctrl+C
    process.on("SIGINT", () => {
      clearInterval(interval);
      console.log();
      console.log(chalk.yellow("⏹️  Monitoring stopped"));
      console.log(
        chalk.gray(`Check task status: GET /api/tasks/${taskId}/status`),
      );
      process.exit(0);
    });
  }

  private getStatusEmoji(status: string): string {
    const emojis: { [key: string]: string } = {
      pending: "⏳",
      planning: "📋",
      "pr-created": "📝",
      implementing: "⚡",
      completed: "✅",
      failed: "❌",
    };
    return emojis[status] || "🔄";
  }

  private isValidGitHubURL(url: string): boolean {
    const githubRegex =
      /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;
    return githubRegex.test(url);
  }

  async generateTaskFromIssue(
    repoUrl: string,
    issueNumber: number,
  ): Promise<void> {
    console.log(chalk.blue("🔍 Fetching GitHub issue details..."));

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error(
        chalk.red(
          "❌ GITHUB_TOKEN environment variable is required for issue fetching",
        ),
      );
      process.exit(1);
    }

    try {
      const [owner, repo] = this.extractOwnerRepo(repoUrl);
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch issue: ${response.status} ${response.statusText}`,
        );
      }

      const issue = await response.json();

      console.log(chalk.green("📋 Issue found:"));
      console.log(`  Title: ${chalk.cyan(issue.title)}`);
      console.log(`  Number: ${chalk.cyan(`#${issue.number}`)}`);
      console.log(`  State: ${chalk.yellow(issue.state)}`);
      console.log(
        `  Labels: ${chalk.gray(issue.labels.map((l: any) => l.name).join(", ") || "None")}`,
      );
      console.log();

      // Extract acceptance criteria from issue body
      const acceptanceCriteria = this.extractAcceptanceCriteria(
        issue.body || "",
      );

      await this.processTask({
        repository: repoUrl,
        taskId: `ISSUE-${issue.number}`,
        title: issue.title,
        description: issue.body || "",
        priority: this.determinePriority(issue.labels),
        acceptanceCriteria,
        labels: issue.labels.map((l: any) => l.name),
      });
    } catch (error) {
      console.error(chalk.red("❌ Error fetching issue:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : "Unknown error"),
      );
      process.exit(1);
    }
  }

  private extractOwnerRepo(url: string): [string, string] {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match || !match[1] || !match[2]) throw new Error("Invalid GitHub URL");
    return [match[1], match[2].replace(".git", "")];
  }

  private extractAcceptanceCriteria(body: string): string {
    const patterns = [
      /(?:acceptance criteria|ac):?\s*(.*?)(?:\n\n|\n$|$)/is,
      /(?:given|when|then).*$/gim,
    ];

    for (const pattern of patterns) {
      const matches = body.match(pattern);
      if (matches) {
        return matches.join("\n");
      }
    }

    return "";
  }

  private determinePriority(labels: any[]): string {
    const priorityLabels = labels.map((l) => l.name.toLowerCase());

    if (
      priorityLabels.some(
        (l) =>
          l.includes("high") || l.includes("urgent") || l.includes("critical"),
      )
    ) {
      return "High";
    }
    if (priorityLabels.some((l) => l.includes("low") || l.includes("minor"))) {
      return "Low";
    }
    return "Medium";
  }

  async showQueueStatus(): Promise<void> {
    console.log(chalk.blue("📊 Task Queue Status"));
    console.log(chalk.blue("=================="));

    try {
      const queueStatus = await this.taskProcessor.getQueueStatus();
      
      console.log(`Queue Size: ${chalk.cyan(queueStatus.queueSize)}`);
      console.log(`Active Repository Locks: ${chalk.yellow(queueStatus.activeRepositoryLocks)}`);
      console.log(`Currently Processing: ${queueStatus.isProcessing ? chalk.green('Yes') : chalk.gray('No')}`);
      
      // Show recent tasks
      const recentTasks = await this.taskProcessor.getAllTaskStatuses();
      const activeTasks = recentTasks.filter(task => 
        task.status !== 'completed' && task.status !== 'failed'
      );
      
      if (activeTasks.length > 0) {
        console.log();
        console.log(chalk.blue("📋 Active Tasks"));
        console.log(chalk.blue("============="));
        
        activeTasks.forEach(task => {
          const statusEmoji = this.getStatusEmoji(task.status);
          console.log(`${statusEmoji} ${task.taskId} - ${task.status}`);
          
          if (task.repositoryUrl) {
            console.log(chalk.gray(`  └─ Repository: ${task.repositoryUrl}`));
          }
          
          if (task.progress) {
            console.log(chalk.gray(`  └─ Progress: ${task.progress}`));
          }
        });
      }
      
    } catch (error) {
      console.error(chalk.red("Error fetching queue status:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : "Unknown error"),
      );
    }
  }

  async listActiveTasks(): Promise<void> {
    console.log(chalk.blue("📊 Active Tasks"));
    console.log(chalk.blue("=============="));

    try {
      const tasks = await this.taskProcessor.getAllTaskStatuses();

      if (tasks.length === 0) {
        console.log(chalk.gray("No active tasks found"));
        return;
      }

      tasks.forEach((task) => {
        const statusEmoji = this.getStatusEmoji(task.status);
        console.log(`${statusEmoji} ${task.taskId} - ${task.status}`);

        if (task.progress) {
          console.log(chalk.gray(`  └─ ${task.progress}`));
        }

        if (task.pullRequestUrl) {
          console.log(chalk.gray(`  └─ PR: ${task.pullRequestUrl}`));
        }
      });
    } catch (error) {
      console.error(chalk.red("Error fetching tasks:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : "Unknown error"),
      );
    }
  }
}

// CLI Program Setup
const program = new Command();

program
  .name("autonomous-coding-cli")
  .description("Local CLI for testing the Autonomous Coding Agent")
  .version("1.0.0");

program
  .command("process")
  .description("Process a task against a GitHub repository")
  .requiredOption("-r, --repository <url>", "GitHub repository URL")
  .requiredOption("-i, --task-id <id>", "Task ID")
  .requiredOption("-t, --title <title>", "Task title")
  .requiredOption("-d, --description <desc>", "Task description")
  .option(
    "-p, --priority <priority>",
    "Task priority (Low|Medium|High)",
    "Medium",
  )
  .option("-c, --criteria <criteria>", "Acceptance criteria")
  .option("-l, --labels <labels>", "Comma-separated labels")
  .action(async (options: any) => {
    const cli = new AutonomousCodingCLI();

    const labels = options.labels
      ? options.labels.split(",").map((l: string) => l.trim())
      : [];

    await cli.processTask({
      repository: options.repository,
      taskId: options.taskId,
      title: options.title,
      description: options.description,
      priority: options.priority,
      acceptanceCriteria: options.criteria,
      labels,
    });
  });

program
  .command("issue")
  .description("Process a GitHub issue automatically")
  .requiredOption("-r, --repository <url>", "GitHub repository URL")
  .requiredOption("-n, --number <number>", "GitHub issue number")
  .action(async (options: any) => {
    const cli = new AutonomousCodingCLI();
    await cli.generateTaskFromIssue(
      options.repository,
      parseInt(options.number),
    );
  });

program
  .command("list")
  .description("List all active tasks")
  .action(async () => {
    const cli = new AutonomousCodingCLI();
    await cli.listActiveTasks();
  });

program
  .command("queue")
  .description("Show current task queue status")
  .action(async () => {
    const cli = new AutonomousCodingCLI();
    await cli.showQueueStatus();
  });

program
  .command("status")
  .description("Check the status of a specific task")
  .requiredOption("-i, --task-id <id>", "Task ID to check")
  .action(async (options: any) => {
    const cli = new AutonomousCodingCLI();
    try {
      const status = await cli.taskProcessor.getTaskStatus(options.taskId);

      if (!status) {
        console.log(chalk.red("❌ Task not found"));
        return;
      }

      console.log(chalk.blue("📊 Task Status"));
      console.log(chalk.blue("============="));
      console.log(`Task ID: ${chalk.cyan(status.taskId)}`);
      console.log(`Status: ${chalk.yellow(status.status)}`);
      console.log(`Progress: ${chalk.gray(status.progress || "N/A")}`);

      if (status.repositoryUrl) {
        console.log(`Repository: ${chalk.cyan(status.repositoryUrl)}`);
      }

      if (status.branchName) {
        console.log(`Branch: ${chalk.green(status.branchName)}`);
      }

      if (status.pullRequestUrl) {
        console.log(`PR: ${chalk.cyan(status.pullRequestUrl)}`);
      }

      if (status.startTime) {
        console.log(`Started: ${chalk.gray(status.startTime)}`);
      }

      if (status.endTime) {
        console.log(`Completed: ${chalk.gray(status.endTime)}`);
      }

      if (status.error) {
        console.log(`Error: ${chalk.red(status.error)}`);
      }
    } catch (error) {
      console.error(chalk.red("Error checking status:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : "Unknown error"),
      );
    }
  });

// Handle CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse(process.argv);
}
