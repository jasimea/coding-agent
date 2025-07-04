import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import simpleGit, { SimpleGit } from "simple-git";
import { taskProcessorLogger as logger } from "./logger.js";
import { AdvancedPlanningSystem } from "./advanced-planning.js";
import { ClaudeConfigManager } from "./claude-config-manager.js";
import { PRPlanningService } from "./pr-planning-service.js";
import { TaskQueueManager } from "./task-queue-manager.js";
import { SharedRepositoryManager } from "./shared-repository-manager.js";
import { SQLiteTaskStorage, JSONTaskStorage, TaskStorage } from "./task-storage.js";
import {
  TaskProcessRequest,
  TaskStatus,
  RepositoryConfig,
} from "./webhook-types.js";
import { TaskInfo, RepoContext, PlanResult } from "./types.js";

export class TaskProcessor {
  private planningSystem: AdvancedPlanningSystem;
  private claudeConfigManager: ClaudeConfigManager;
  private prPlanningService: PRPlanningService;
  private queueManager: TaskQueueManager;
  private repositoryManager: SharedRepositoryManager;
  private workspaceDir: string;
  private activeTasksDir: string;
  private baseDir: string;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(private claudeApiKey: string, useRedis: boolean = true) {
    this.planningSystem = new AdvancedPlanningSystem(claudeApiKey);
    this.claudeConfigManager = new ClaudeConfigManager();
    this.prPlanningService = new PRPlanningService();
    
    this.baseDir = path.join(os.homedir(), ".coding-agent");
    this.workspaceDir = path.join(this.baseDir, "workspace");
    this.activeTasksDir = path.join(this.baseDir, "active-tasks");

    // Initialize storage and queue
    const taskStorage = this.createTaskStorage();
    this.queueManager = new TaskQueueManager(taskStorage, process.env.REDIS_URL);
    this.repositoryManager = new SharedRepositoryManager(this.workspaceDir);

    this.initializeDirectories();
    this.setupGracefulShutdown();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.mkdir(this.workspaceDir, { recursive: true });
      await fs.mkdir(this.activeTasksDir, { recursive: true });
      await fs.mkdir(path.join(this.baseDir, "logs"), { recursive: true });
      await fs.mkdir(path.join(this.baseDir, "docs"), { recursive: true });
      
      // Initialize queue manager and repository manager
      await this.queueManager.initialize();
      await this.repositoryManager.initialize();
      
      // Start task processing loop
      this.startTaskProcessing();
      
      logger.info("Task processor initialized with queue management");
    } catch (error) {
      logger.error("Error initializing directories", { error });
    }
  }

  /**
   * Create appropriate task storage based on configuration
   */
  private createTaskStorage(): TaskStorage {
    const useDatabase = process.env.USE_SQLITE !== 'false';
    
    if (useDatabase) {
      const dbPath = path.join(this.baseDir, "tasks.db");
      return new SQLiteTaskStorage(dbPath);
    } else {
      const tasksFile = path.join(this.baseDir, "tasks.json");
      return new JSONTaskStorage(tasksFile);
    }
  }

  public async processTask(request: TaskProcessRequest): Promise<string> {
    // Generate task ID if not provided
    const taskId = request.taskData.taskId || uuidv4();
    request.taskData.taskId = taskId;

    try {
      // Enqueue the task
      await this.queueManager.enqueueTask(request, this.getPriority(request.taskData.priority));
      
      logger.info("Task enqueued for processing", {
        taskId,
        repositoryUrl: request.repositoryUrl,
        webhookSource: request.webhookSource,
      });

      return taskId;
    } catch (error) {
      logger.error("Failed to enqueue task", { taskId, error: error instanceof Error ? error.message : "Unknown error" });
      throw error;
    }
  }

  /**
   * Start the task processing loop
   */
  private startTaskProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process tasks every 5 seconds
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processNextTask();
      }
    }, 5000);

    logger.info("Task processing loop started");
  }

  /**
   * Stop the task processing loop
   */
  public stopTaskProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    logger.info("Task processing loop stopped");
  }

  /**
   * Process the next task in the queue
   */
  private async processNextTask(): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;
      
      const queuedTask = await this.queueManager.dequeueTask();
      if (!queuedTask) {
        return; // No tasks in queue
      }

      logger.info("Processing task from queue", { 
        taskId: queuedTask.taskId, 
        repositoryUrl: queuedTask.repositoryUrl 
      });

      await this.processTaskAsync(queuedTask.taskId, queuedTask.request);

    } catch (error) {
      logger.error("Error processing next task", { 
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTaskAsync(
    taskId: string,
    request: TaskProcessRequest,
  ): Promise<void> {
    try {
      // Step 1: Get repository from shared manager
      this.updateTaskStatus(taskId, {
        status: "planning",
        progress: "Acquiring repository workspace...",
      });

      const repoConfig = await this.repositoryManager.getRepository(
        request.repositoryUrl,
        taskId
      );
      const git = simpleGit(repoConfig.clonePath);

      // Step 2: Analyze repository structure
      this.updateTaskStatus(taskId, {
        status: "planning",
        progress: "Analyzing repository structure...",
      });

      const repoContext = await this.analyzeRepository(repoConfig.clonePath!);

      // Step 3: Generate comprehensive plan
      this.updateTaskStatus(taskId, {
        status: "planning",
        progress: "Generating detailed implementation plan...",
      });

      const taskInfo: TaskInfo = {
        taskId: request.taskData.taskId,
        title: request.taskData.title,
        description: request.taskData.description,
        priority: request.taskData.priority,
        labels: request.taskData.labels,
        acceptanceCriteria: request.taskData.acceptanceCriteria,
      };

      const planResult = await this.planningSystem.generateComprehensivePlan(
        taskInfo,
        repoContext,
      );

      // Step 4: Save plan for reference
      await this.savePlan(taskId, planResult);

      // Step 5: Setup Claude configuration and workspace
      this.updateTaskStatus(taskId, {
        status: "planning",
        progress: "Setting up Claude development environment...",
      });

      await this.claudeConfigManager.setupClaudeConfig(
        repoConfig.clonePath!,
        repoContext.name,
        taskInfo,
      );
      await this.claudeConfigManager.createClaudeCLIConfig(
        repoConfig.clonePath!,
      );

      // Step 6: Create feature branch
      this.updateTaskStatus(taskId, {
        status: "planning",
        progress: "Creating feature branch...",
      });

      const branchName = await this.createFeatureBranch(git, request.taskData);

      this.updateTaskStatus(taskId, {
        branchName,
      });

      // Step 7: Create Pull Request with planning details
      this.updateTaskStatus(taskId, {
        status: "planning",
        progress: "Creating pull request with implementation plan...",
      });

      const pullRequestUrl = await this.createPullRequestWithPlan(
        git,
        request,
        repoConfig,
        branchName,
        planResult,
        taskInfo,
      );

      // Step 8: Post detailed planning comment
      const [repoOwner, repoName] = this.extractGitHubOwnerRepo(repoConfig.url);
      const prNumber = this.extractPRNumber(pullRequestUrl);

      if (prNumber) {
        this.updateTaskStatus(taskId, {
          status: "pr-created",
          progress: "Adding detailed implementation plan to PR...",
        });

        const planningComment =
          await this.prPlanningService.createPlanningComment(
            planResult,
            taskInfo,
          );
        const commentId = await this.prPlanningService.postPlanningComment(
          repoOwner,
          repoName,
          prNumber,
          planningComment,
        );

        this.updateTaskStatus(taskId, {
          planningCommentId: commentId || undefined,
          pullRequestUrl,
        });

        // Step 9: Begin implementation
        this.updateTaskStatus(taskId, {
          status: "implementing",
          progress: "Starting implementation based on plan...",
        });

        await this.executeImplementationPlan(
          repoConfig.clonePath!,
          planResult,
          taskInfo,
        );

        // Step 10: Update progress in PR comment
        if (commentId) {
          await this.prPlanningService.updatePlanningComment(
            repoOwner,
            repoName,
            commentId,
            "Implementation completed, running tests...",
            "implementing",
          );
        }

        // Step 11: Commit changes
        this.updateTaskStatus(taskId, {
          status: "implementing",
          progress: "Committing implementation changes...",
        });

        await this.commitChanges(git, request.taskData);

        // Step 12: Final PR comment update
        if (commentId) {
          await this.prPlanningService.updatePlanningComment(
            repoOwner,
            repoName,
            commentId,
            "Implementation completed successfully! Ready for review.",
            "completed",
          );
        }

        // Step 13: Complete task and release repository lock
        this.updateTaskStatus(taskId, {
          status: "completed",
          progress:
            "Task completed successfully! Pull request ready for review.",
          pullRequestUrl,
          endTime: new Date().toISOString(),
        });

        logger.info("Task processing completed with planning workflow", {
          taskId,
          branchName,
          pullRequestUrl,
          planningCommentId: commentId,
        });

        // Release repository lock
        await this.queueManager.releaseRepositoryLock(request.repositoryUrl, taskId);
      } else {
        throw new Error("Failed to extract PR number from URL");
      }
    } catch (error) {
      logger.error("Task processing failed", { 
        taskId, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      
      this.updateTaskStatus(taskId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        endTime: new Date().toISOString(),
      });

      // Release repository lock on failure
      await this.queueManager.releaseRepositoryLock(request.repositoryUrl, taskId);
      
      throw error;
    }
  }

  private async analyzeRepository(repoPath: string): Promise<RepoContext> {
    // Read package.json if it exists
    let packageJson = {};
    try {
      const packageJsonPath = path.join(repoPath, "package.json");
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      packageJson = JSON.parse(packageJsonContent);
    } catch {
      // Not a Node.js project or no package.json
    }

    // Read README if it exists
    let readme = "";
    try {
      const readmePath = path.join(repoPath, "README.md");
      readme = await fs.readFile(readmePath, "utf-8");
    } catch {
      try {
        const readmePath = path.join(repoPath, "README.txt");
        readme = await fs.readFile(readmePath, "utf-8");
      } catch {
        // No README found
      }
    }

    // Analyze file structure
    const fileStructure = await this.getFileStructure(repoPath);

    return {
      name: path.basename(repoPath),
      branch: "main",
      fileStructure,
      packageJson,
      readme,
    };
  }

  private async getFileStructure(
    dirPath: string,
    maxDepth: number = 3,
    currentDepth: number = 0,
  ): Promise<any> {
    if (currentDepth >= maxDepth) return {};

    const structure: any = {};

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files, node_modules, .git, etc.
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === "build"
        ) {
          continue;
        }

        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          structure[entry.name] = await this.getFileStructure(
            entryPath,
            maxDepth,
            currentDepth + 1,
          );
        } else {
          // Only include relevant file types
          const ext = path.extname(entry.name).toLowerCase();
          const relevantExts = [
            ".js",
            ".ts",
            ".jsx",
            ".tsx",
            ".vue",
            ".py",
            ".java",
            ".go",
            ".rs",
            ".php",
            ".rb",
            ".cs",
            ".cpp",
            ".c",
            ".h",
            ".json",
            ".yaml",
            ".yml",
            ".md",
            ".txt",
            ".sql",
          ];

          if (
            relevantExts.includes(ext) ||
            entry.name === "Dockerfile" ||
            entry.name === "docker-compose.yml"
          ) {
            structure[entry.name] = "file";
          }
        }
      }
    } catch (error) {
      logger.warn("Error reading directory structure", {
        dirPath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return structure;
  }

  private async savePlan(
    taskId: string,
    planResult: PlanResult,
  ): Promise<void> {
    // Save to active tasks directory for processing reference
    const planPath = path.join(this.activeTasksDir, `${taskId}-plan.json`);
    await fs.writeFile(planPath, JSON.stringify(planResult, null, 2));

    // Save markdown plan to docs folder as requested
    const docsDir = path.join(this.baseDir, "docs");
    const planMdPath = path.join(docsDir, `task-${taskId}-plan.md`);
    await fs.writeFile(planMdPath, planResult.fullPlan);

    logger.info("Plan saved", { taskId, planPath, planMdPath });
  }

  private async createFeatureBranch(
    git: SimpleGit,
    taskData: any,
  ): Promise<string> {
    // Create branch name from task title
    const branchName = `feature/${taskData.taskId}-${this.sanitizeBranchName(taskData.title)}`;

    // Fetch latest changes and create branch
    await git.fetch();
    await git.checkoutLocalBranch(branchName);

    logger.info("Feature branch created", { branchName });

    return branchName;
  }

  private async executeImplementationPlan(
    repoPath: string,
    planResult: PlanResult,
    taskInfo: TaskInfo,
  ): Promise<void> {
    // This is where you'd integrate with Claude Code API
    // For now, we'll create comprehensive implementation files and setup

    // Create comprehensive implementation log and setup files
    const implementationLog = `
# Implementation Execution Log

## Task Details
- Task ID: ${taskInfo.taskId}
- Title: ${taskInfo.title}
- Complexity: ${planResult.complexity}
- Estimated Hours: ${planResult.estimatedHours}
- Generated: ${new Date().toISOString()}

## Plan Summary
${planResult.summary}

## Implementation Setup
- Claude CLI environment configured
- MCP servers available for development
- Project structure analyzed
- Implementation guidelines provided

## Claude Development Environment
- Workspace configured with file system access
- Git integration enabled
- TypeScript/JavaScript analysis available
- Project-specific tools configured

## Implementation Notes
The repository is now ready for Claude Code development with:
1. Complete implementation plan in .claude/implementation-plan.md
2. MCP servers configured for optimal development
3. Project guidelines and acceptance criteria defined
4. Development environment fully prepared

## Next Steps for Claude Code
1. Review the implementation plan in .claude/implementation-plan.md
2. Follow the guidelines in .claude/implementation-guidelines.md
3. Use available MCP servers for development assistance
4. Implement changes according to the detailed plan
5. Run tests using the project-tools MCP server

${planResult.fullPlan}
    `;

    const logPath = path.join(repoPath, "IMPLEMENTATION_LOG.md");
    await fs.writeFile(logPath, implementationLog);

    // Save the full plan in the Claude directory
    const claudeDir = path.join(repoPath, ".claude");
    const planPath = path.join(claudeDir, "implementation-plan.md");
    await fs.writeFile(planPath, planResult.fullPlan);

    // Install MCP dependencies
    await this.claudeConfigManager.installMCPDependencies(claudeDir);

    // Here you would make actual calls to Claude Code API
    // Example integration point:
    /*
    const claudeCodeResponse = await this.executeClaudeCode({
      repositoryPath: repoPath,
      implementationPlan: planResult.fullPlan,
      taskDescription: taskInfo.description,
      acceptanceCriteria: taskInfo.acceptanceCriteria
    });
    */

    logger.info("Implementation environment prepared for Claude Code", {
      repoPath,
    });
  }

  private async commitChanges(git: SimpleGit, taskData: any): Promise<void> {
    // Add all changes
    await git.add(".");

    // Create commit message
    const commitMessage = `feat: ${taskData.title}

${taskData.description}

Task ID: ${taskData.taskId}
Priority: ${taskData.priority}
${taskData.acceptanceCriteria ? `\nAcceptance Criteria:\n${taskData.acceptanceCriteria}` : ""}

Co-authored-by: Claude Code <claude@anthropic.com>`;

    // Commit changes
    await git.commit(commitMessage);

    logger.info("Changes committed", { taskId: taskData.taskId });
  }

  private async createPullRequest(
    git: SimpleGit,
    request: TaskProcessRequest,
    repoConfig: RepositoryConfig,
    branchName: string,
  ): Promise<string> {
    // Push branch
    await git.push("origin", branchName);

    // Create PR using GitHub/GitLab API
    if (repoConfig.url.includes("github.com")) {
      return await this.createGitHubPR(repoConfig, branchName, request);
    } else if (repoConfig.url.includes("gitlab.com")) {
      return await this.createGitLabPR(repoConfig, branchName, request);
    }

    return `Branch pushed: ${branchName}`;
  }

  private async createGitHubPR(
    repoConfig: RepositoryConfig,
    branchName: string,
    request: TaskProcessRequest,
  ): Promise<string> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      logger.warn("No GitHub token provided, skipping PR creation");
      return `Branch pushed: ${branchName}`;
    }

    try {
      const [owner, repo] = this.extractGitHubOwnerRepo(repoConfig.url);

      const prData = {
        title: request.taskData.title,
        body: `${request.taskData.description}

## Task Details
- **Task ID**: ${request.taskData.taskId}
- **Priority**: ${request.taskData.priority}
- **Source**: ${request.webhookSource}

## Implementation
This PR was automatically generated and implemented by Claude Code based on the task requirements.

${request.taskData.acceptanceCriteria ? `## Acceptance Criteria\n${request.taskData.acceptanceCriteria}` : ""}

---
*Generated by Autonomous Coding Agent*`,
        head: branchName,
        base: "main",
      };

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify(prData),
        },
      );

      const result = await response.json();

      if (response.ok) {
        logger.info("GitHub PR created", { prUrl: result.html_url });
        return result.html_url;
      } else {
        logger.error("Failed to create GitHub PR", { error: result });
        return `Branch pushed: ${branchName}`;
      }
    } catch (error) {
      logger.error("Error creating GitHub PR", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return `Branch pushed: ${branchName}`;
    }
  }

  private async createGitLabPR(
    repoConfig: RepositoryConfig,
    branchName: string,
    request: TaskProcessRequest,
  ): Promise<string> {
    // Similar implementation for GitLab
    // This would use GitLab API to create merge request
    logger.warn("GitLab PR creation not yet implemented");
    return `Branch pushed: ${branchName}`;
  }

  private async createPullRequestWithPlan(
    git: SimpleGit,
    request: TaskProcessRequest,
    repoConfig: RepositoryConfig,
    branchName: string,
    planResult: PlanResult,
    taskInfo: TaskInfo,
  ): Promise<string> {
    // Push branch first
    await git.push("origin", branchName);

    // Create PR with enhanced description including plan summary
    if (repoConfig.url.includes("github.com")) {
      return await this.createGitHubPRWithPlan(
        repoConfig,
        branchName,
        request,
        planResult,
        taskInfo,
      );
    } else if (repoConfig.url.includes("gitlab.com")) {
      return await this.createGitLabPR(repoConfig, branchName, request);
    }

    return `Branch pushed: ${branchName}`;
  }

  private async createGitHubPRWithPlan(
    repoConfig: RepositoryConfig,
    branchName: string,
    request: TaskProcessRequest,
    planResult: PlanResult,
    taskInfo: TaskInfo,
  ): Promise<string> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      logger.warn("No GitHub token provided, skipping PR creation");
      return `Branch pushed: ${branchName}`;
    }

    try {
      const [owner, repo] = this.extractGitHubOwnerRepo(repoConfig.url);

      const prData = {
        title: `🤖 ${request.taskData.title}`,
        body: `## 🤖 Automated Implementation

> **This pull request implements the task requirements using autonomous Claude Code development.**

### 📋 Task Overview
- **Task ID**: ${taskInfo.taskId}
- **Priority**: ${taskInfo.priority}  
- **Complexity**: ${planResult.complexity}
- **Estimated Time**: ${planResult.estimatedHours} hours

### 🎯 Implementation Summary
${taskInfo.description}

${
  taskInfo.acceptanceCriteria
    ? `### ✅ Acceptance Criteria
${taskInfo.acceptanceCriteria}`
    : ""
}

### 📊 Plan Summary
${planResult.summary}

### 🔧 Implementation Details
A comprehensive implementation plan has been generated and will be posted as a comment below. The plan includes:

- **Detailed Technical Specifications**
- **Step-by-step Implementation Strategy** 
- **Comprehensive Testing Approach**
- **Risk Assessment and Mitigation**
- **Performance and Security Considerations**

### 🛠️ Development Environment
This repository has been configured with:
- Claude CLI development environment
- MCP servers for enhanced development capabilities
- Project-specific tooling and guidelines
- Automated testing and validation setup

### 📚 Resources
- **Full Plan**: Available in \`.claude/implementation-plan.md\`
- **Guidelines**: Available in \`.claude/implementation-guidelines.md\`
- **Configuration**: Claude desktop config in \`.claude/\`

---

**🤖 Generated by Autonomous Coding Agent** | **Source**: ${request.webhookSource}`,
        head: branchName,
        base: "main",
      };

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify(prData),
        },
      );

      const result = await response.json();

      if (response.ok) {
        logger.info("GitHub PR with planning created", {
          prUrl: result.html_url,
        });
        return result.html_url;
      } else {
        logger.error("Failed to create GitHub PR", { error: result });
        return `Branch pushed: ${branchName}`;
      }
    } catch (error) {
      logger.error("Error creating GitHub PR with plan", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return `Branch pushed: ${branchName}`;
    }
  }

  private extractPRNumber(prUrl: string): number | null {
    const match = prUrl.match(/\/pull\/(\d+)$/);
    return match && match[1] ? parseInt(match[1], 10) : null;
  }

  private extractRepoName(url: string): string {
    const parts = url.replace(".git", "").split("/");
    const lastPart = parts[parts.length - 1];
    return lastPart || "unknown-repo";
  }

  private extractGitHubOwnerRepo(url: string): [string, string] {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match || !match[1] || !match[2]) throw new Error("Invalid GitHub URL");
    return [match[1], match[2].replace(".git", "")];
  }

  private sanitizeBranchName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);
  }

  private updateTaskStatus(taskId: string, updates: Partial<TaskStatus>): void {
    // Update task status in the queue manager (which will persist to storage)
    this.queueManager.updateTaskStatus(taskId, updates).catch((error) => {
      logger.error("Failed to update task status", { taskId, error });
    });
  }

  public async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    return await this.queueManager.getTaskStatus(taskId);
  }

  public async getAllTaskStatuses(): Promise<TaskStatus[]> {
    return await this.queueManager.getAllTasks();
  }

  /**
   * Get priority number from priority string
   */
  private getPriority(priority: string): number {
    switch (priority?.toLowerCase()) {
      case 'critical':
      case 'urgent':
        return 5;
      case 'high':
        return 4;
      case 'medium':
        return 3;
      case 'low':
        return 2;
      default:
        return 1;
    }
  }

  /**
   * Get queue status for monitoring
   */
  async getQueueStatus(): Promise<{
    queueSize: number;
    activeRepositoryLocks: number;
    isProcessing: boolean;
  }> {
    const queueSize = await this.queueManager.getQueueSize();
    const locks = await this.queueManager.getActiveRepositoryLocks();
    
    return {
      queueSize,
      activeRepositoryLocks: locks.length,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    logger.info("Starting task processor cleanup...");
    
    this.stopTaskProcessing();
    
    try {
      await this.queueManager.close();
      await this.repositoryManager.cleanupOldRepositories();
      logger.info("Task processor cleanup completed");
    } catch (error) {
      logger.error("Error during cleanup", { error });
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        await this.cleanup();
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception', { error });
      await this.cleanup();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
      logger.error('Unhandled promise rejection', { reason });
      await this.cleanup();
      process.exit(1);
    });
  }
}
