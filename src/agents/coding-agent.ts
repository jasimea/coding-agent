import { CoreMessage } from 'ai';
import { AIProvider } from '../ai/provider.js';
import { createContextLogger } from '../utils/logger.js';
import { AgentTask, AgentContext, AgentRequest, AgentResponse, AgentStep, AgentPlan } from '../types/index.js';
import { Config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs-extra';

const logger = createContextLogger('CodingAgent');

export class CodingAgent {
  private aiProvider: AIProvider;
  private context: AgentContext;
  private activeTasks: Map<string, AgentTask> = new Map();

  constructor(aiProvider?: AIProvider, workingDirectory?: string) {
    this.aiProvider = aiProvider || new AIProvider();
    this.context = this.initializeContext(workingDirectory);
    
    logger.info('Coding Agent initialized', {
      workingDirectory: this.context.workingDirectory,
      projectPath: this.context.projectPath,
    });
  }

  private initializeContext(workingDirectory?: string): AgentContext {
    const workDir = workingDirectory || process.cwd();
    
    return {
      workingDirectory: workDir,
      projectPath: workDir,
      files: [],
      environment: process.env as Record<string, string>,
    };
  }

  private getSystemPrompt(): string {
    return `You are an autonomous coding agent with advanced capabilities to help with software development tasks.

Your capabilities include:
- Reading, writing, and managing files and directories
- Git operations (status, add, commit, push, pull, branch management, etc.)
- Executing system commands and scripts
- Installing packages and building projects
- Running tests and development tools

Guidelines:
1. Always analyze the request carefully before taking action
2. Use appropriate tools for file operations, git commands, and system execution
3. Provide clear explanations of what you're doing and why
4. Handle errors gracefully and provide helpful error messages
5. When working with code, follow best practices and maintain code quality
6. Always verify your actions and check for potential issues
7. Be security-conscious and avoid dangerous operations
8. Break down complex tasks into smaller, manageable steps

Current working directory: ${this.context.workingDirectory}
Project path: ${this.context.projectPath}

Remember to use the available tools to interact with the file system, git, and execute commands. Always provide detailed responses about what you've accomplished.`;
  }

  private getPlanningPrompt(task: string): string {
    return `You are a planning agent. Your task is to create a detailed plan for accomplishing the given task.

Task: ${task}

Create a plan by breaking down the task into specific, actionable steps. Each step should be:
1. Clear and specific
2. Actionable with the available tools
3. Ordered logically
4. Include the estimated complexity (low, medium, high)

Available tools:
- File operations (read, write, create, delete files and directories)
- Git operations (status, add, commit, push, pull, branch management, remote operations)
- GitHub operations (create pull requests, issues, get repository info)
- Command execution (run shell commands, install packages, build projects)

IMPORTANT: The plan should follow this Git workflow:
1. Get current git status and check if it's a git repository
2. Get git remote information to determine repository details
3. Create a new feature branch for the task
4. Perform the actual work (coding, file operations, etc.)
5. Add and commit changes with a descriptive commit message
6. Push the branch to remote
7. Create a pull request with proper title and description

Current context:
- Working directory: ${this.context.workingDirectory}
- Project path: ${this.context.projectPath}

Return a JSON object with this structure:
{
  "steps": [
    {
      "id": "step_1",
      "description": "Description of what to do",
      "action": "git_setup|file_operation|git_operation|github_operation|command_execution|analysis",
      "complexity": "low|medium|high",
      "estimatedDuration": "Duration in minutes"
    }
  ],
  "summary": "Brief summary of the overall plan",
  "estimatedTotalTime": "Total estimated time",
  "dependencies": ["List of external dependencies if any"],
  "branchName": "Suggested branch name for the feature",
  "commitMessage": "Suggested commit message for the changes",
  "prTitle": "Suggested pull request title",
  "prDescription": "Suggested pull request description"
}

Focus on creating a practical, executable plan that uses the available tools effectively and follows proper Git workflow.`;
  }

  private async createPlan(task: string): Promise<AgentPlan> {
    try {
      logger.info('Creating plan for task', { task: task.substring(0, 100) });

      const messages: CoreMessage[] = [
        {
          role: 'user',
          content: this.getPlanningPrompt(task),
        },
      ];

      // Generate plan without tools (pure text response)
      const result = await this.aiProvider.generateText(
        messages,
        'You are a planning agent that creates detailed execution plans.',
        false
      );

      // Parse the plan from the response
      let planData;
      try {
        // Try to extract JSON from the response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          planData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback: create a simple plan
        logger.warn('Failed to parse plan JSON, creating fallback plan', { parseError });
        planData = {
          steps: [
            {
              id: 'step_1',
              description: task,
              action: 'analysis',
              complexity: 'medium',
              estimatedDuration: '5 minutes'
            }
          ],
          summary: 'Execute the given task',
          estimatedTotalTime: '5 minutes',
          dependencies: [],
          branchName: `task-${Date.now()}`,
          commitMessage: `Complete task: ${task.substring(0, 50)}`,
          prTitle: `Task: ${task.substring(0, 50)}`,
          prDescription: `This PR implements the following task:\n\n${task}`
        };
      }

      const plan: AgentPlan = {
        id: uuidv4(),
        task,
        steps: planData.steps || [],
        summary: planData.summary || 'Plan execution',
        estimatedTotalTime: planData.estimatedTotalTime || 'Unknown',
        dependencies: planData.dependencies || [],
        branchName: planData.branchName,
        commitMessage: planData.commitMessage,
        prTitle: planData.prTitle,
        prDescription: planData.prDescription,
        createdAt: new Date(),
        status: 'pending'
      };

      logger.info('Plan created successfully', {
        planId: plan.id,
        stepsCount: plan.steps.length,
        estimatedTime: plan.estimatedTotalTime
      });

      return plan;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create plan', { error: errorMessage });
      
      // Return a fallback plan
      return {
        id: uuidv4(),
        task,
        steps: [
          {
            id: 'step_1',
            description: task,
            action: 'analysis',
            complexity: 'medium',
            estimatedDuration: '5 minutes'
          }
        ],
        summary: 'Execute the given task (fallback plan)',
        estimatedTotalTime: '5 minutes',
        dependencies: [],
        branchName: `task-${Date.now()}`,
        commitMessage: `Complete task: ${task.substring(0, 50)}`,
        prTitle: `Task: ${task.substring(0, 50)}`,
        prDescription: `This PR implements the following task:\n\n${task}`,
        createdAt: new Date(),
        status: 'pending'
      };
    }
  }

  async executeTask(request: AgentRequest): Promise<AgentResponse> {
    const taskId = uuidv4();
    const startTime = Date.now();
    const steps: AgentStep[] = [];

    const task: AgentTask = {
      id: taskId,
      type: this.categorizeTask(request.task),
      description: request.task,
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.activeTasks.set(taskId, task);

    try {
      logger.info('Starting task execution with planning', {
        taskId,
        type: task.type,
        description: request.task,
      });

      // Update context if provided
      if (request.context) {
        this.updateContext(request.context);
      }

      // Step 1: Create a plan
      const plan = await this.createPlan(request.task);
      task.plan = plan;

      logger.info('Plan created, setting up Git workflow', {
        taskId,
        planId: plan.id,
        stepsCount: plan.steps.length
      });

      // Step 2: Setup Git workflow (create branch, etc.)
      let gitWorkflowInfo: { repoInfo: any; branchName: string } | null = null;
      let workCompleted = false;

      try {
        gitWorkflowInfo = await this.setupGitWorkflow(plan);
        
        logger.info('Git workflow setup completed, executing plan steps', {
          taskId,
          planId: plan.id,
          branchName: gitWorkflowInfo.branchName,
          stepsCount: plan.steps.length
        });
      } catch (gitError) {
        const gitErrorMessage = gitError instanceof Error ? gitError.message : 'Unknown git error';
        logger.warn('Git workflow setup failed, continuing without Git workflow', {
          taskId,
          planId: plan.id,
          error: gitErrorMessage
        });
        // Continue execution without Git workflow
      }

      // Step 3: Execute the plan step by step
      plan.status = 'executing';
      let allSteps: AgentStep[] = [];

      for (const [index, planStep] of plan.steps.entries()) {
        logger.info('Executing plan step', {
          taskId,
          stepId: planStep.id,
          stepIndex: index + 1,
          totalSteps: plan.steps.length,
          description: planStep.description
        });

        // Create a focused prompt for this specific step
        const stepPrompt = `Execute this specific step from the plan:

Step ${index + 1}/${plan.steps.length}: ${planStep.description}

Action type: ${planStep.action}
Complexity: ${planStep.complexity}

Original task: ${request.task}

Focus only on completing this step. Use the appropriate tools to accomplish the step's objective.`;

        const messages: CoreMessage[] = [
          {
            role: 'user',
            content: stepPrompt,
          },
        ];

        // Execute this step with tools
        const stepResult = await this.aiProvider.generateText(
          messages,
          this.getSystemPrompt(),
          true
        );

        // Process tool calls for this step
        if (stepResult.toolCalls) {
          for (const toolCall of stepResult.toolCalls) {
            const stepStartTime = Date.now();
            
            const agentStep: AgentStep = {
              tool: toolCall.toolName,
              action: toolCall.toolName,
              input: toolCall.args,
              output: stepResult.toolResults?.find(r => r.toolCallId === toolCall.toolCallId)?.result || null,
              timestamp: new Date(),
              duration: Date.now() - stepStartTime,
              planStepId: planStep.id,
            };
            
            allSteps.push(agentStep);
          }
        }

        // Add a summary step for this plan step
        const summaryStep: AgentStep = {
          tool: 'planning',
          action: 'step_completion',
          input: { planStepId: planStep.id, description: planStep.description },
          output: stepResult.text,
          timestamp: new Date(),
          duration: 0,
          planStepId: planStep.id,
        };
        
        allSteps.push(summaryStep);

        // Mark that some work was completed
        workCompleted = true;
      }

      plan.status = 'completed';

      // Step 4: Complete Git workflow (commit, push, create PR)
      if (gitWorkflowInfo) {
        try {
          await this.completeGitWorkflow(plan, gitWorkflowInfo.repoInfo, gitWorkflowInfo.branchName, workCompleted);
          
          logger.info('Git workflow completed successfully', {
            taskId,
            planId: plan.id,
            prUrl: plan.prUrl,
            prNumber: plan.prNumber
          });
        } catch (gitError) {
          const gitErrorMessage = gitError instanceof Error ? gitError.message : 'Unknown git error';
          logger.error('Git workflow completion failed', {
            taskId,
            planId: plan.id,
            error: gitErrorMessage
          });
          // Don't fail the entire task if Git workflow fails
        }
      }

      // Update task status
      task.status = 'completed';
      task.result = `Plan executed successfully. ${plan.summary}${plan.prUrl ? ` Pull request created: ${plan.prUrl}` : ''}`;
      task.updatedAt = new Date();

      const executionTime = Date.now() - startTime;

      logger.info('Task execution with planning completed', {
        taskId,
        planId: plan.id,
        executionTime,
        totalSteps: allSteps.length,
      });

      const response: AgentResponse = {
        taskId,
        status: 'completed',
        result: task.result || '',
        steps: allSteps,
        executionTime,
        plan,
      };

      this.activeTasks.delete(taskId);
      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      task.status = 'failed';
      task.error = errorMessage;
      task.updatedAt = new Date();

      if (task.plan) {
        task.plan.status = 'failed';
      }

      logger.error('Task execution with planning failed', {
        taskId,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      });

      const response: AgentResponse = {
        taskId,
        status: 'failed',
        error: errorMessage,
        steps,
        executionTime: Date.now() - startTime,
        plan: task.plan,
      };

      this.activeTasks.delete(taskId);
      return response;
    }
  }

  async executeTaskStream(request: AgentRequest): Promise<AsyncIterable<any>> {
    const taskId = uuidv4();

    const task: AgentTask = {
      id: taskId,
      type: this.categorizeTask(request.task),
      description: request.task,
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.activeTasks.set(taskId, task);

    try {
      logger.info('Starting streaming task execution with planning', {
        taskId,
        type: task.type,
        description: request.task,
      });

      // Update context if provided
      if (request.context) {
        this.updateContext(request.context);
      }

      // For streaming, we'll create a simplified approach
      // First create a plan, then setup Git workflow, then stream the execution
      const plan = await this.createPlan(request.task);
      task.plan = plan;

      // Setup Git workflow
      let gitWorkflowInfo: { repoInfo: any; branchName: string } | null = null;
      try {
        gitWorkflowInfo = await this.setupGitWorkflow(plan);
        logger.info('Git workflow setup completed for streaming execution', {
          taskId,
          planId: plan.id,
          branchName: gitWorkflowInfo.branchName
        });
      } catch (gitError) {
        const gitErrorMessage = gitError instanceof Error ? gitError.message : 'Unknown git error';
        logger.warn('Git workflow setup failed for streaming execution', {
          taskId,
          error: gitErrorMessage
        });
      }

      // Create a comprehensive prompt that includes the plan
      const planSummary = plan.steps.map((step, index) => 
        `${index + 1}. ${step.description} (${step.action}, ${step.complexity})`
      ).join('\n');

      const enhancedPrompt = `Execute this task following the planned approach:

Task: ${request.task}

Plan:
${planSummary}

${gitWorkflowInfo ? `Git workflow has been set up. You are now working on branch: ${gitWorkflowInfo.branchName}` : 'Git workflow could not be set up, proceeding without Git integration.'}

Follow the plan step by step, using appropriate tools for each step. Provide clear progress updates as you complete each step.

At the end, if Git workflow was set up, make sure to commit your changes and the system will automatically create a pull request.`;

      const messages: CoreMessage[] = [
        {
          role: 'user',
          content: enhancedPrompt,
        },
      ];

      // Generate streaming response with tools
      const result = await this.aiProvider.generateStream(
        messages,
        this.getSystemPrompt(),
        true
      );

      return result.textStream;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      task.status = 'failed';
      task.error = errorMessage;
      task.updatedAt = new Date();

      logger.error('Streaming task execution with planning failed', {
        taskId,
        error: errorMessage,
      });

      this.activeTasks.delete(taskId);
      throw error;
    }
  }

  private categorizeTask(task: string): AgentTask['type'] {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('git') || taskLower.includes('commit') || taskLower.includes('push') || taskLower.includes('pull')) {
      return 'git';
    }
    
    if (taskLower.includes('file') || taskLower.includes('read') || taskLower.includes('write') || taskLower.includes('create')) {
      return 'file';
    }
    
    if (taskLower.includes('run') || taskLower.includes('execute') || taskLower.includes('command') || taskLower.includes('script')) {
      return 'command';
    }
    
    return 'code';
  }

  private updateContext(partialContext: Partial<AgentContext>): void {
    if (partialContext.workingDirectory) {
      this.context.workingDirectory = partialContext.workingDirectory;
    }
    
    if (partialContext.projectPath) {
      this.context.projectPath = partialContext.projectPath;
    }
    
    if (partialContext.environment) {
      this.context.environment = { ...this.context.environment, ...partialContext.environment };
    }
    
    if (partialContext.files) {
      this.context.files = partialContext.files;
    }
    
    if (partialContext.gitStatus) {
      this.context.gitStatus = partialContext.gitStatus;
    }
  }

  async analyzeProject(): Promise<any> {
    try {
      logger.info('Analyzing project structure', { projectPath: this.context.projectPath });

      const analysis = {
        projectPath: this.context.projectPath,
        packageInfo: await this.getPackageInfo(),
        gitInfo: await this.getGitInfo(),
        projectStructure: await this.getProjectStructure(),
        languages: await this.detectLanguages(),
      };

      logger.info('Project analysis completed', {
        hasPackageJson: !!analysis.packageInfo,
        isGitRepo: !!analysis.gitInfo,
        filesCount: analysis.projectStructure.length,
        languages: analysis.languages,
      });

      return analysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Project analysis failed', { error: errorMessage });
      throw error;
    }
  }

  private async getPackageInfo(): Promise<any> {
    try {
      const packageJsonPath = path.join(this.context.projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        return await fs.readJson(packageJsonPath);
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  private async getGitInfo(): Promise<any> {
    try {
      const gitPath = path.join(this.context.projectPath, '.git');
      if (await fs.pathExists(gitPath)) {
        return {
          isGitRepo: true,
          gitPath,
        };
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  private async getProjectStructure(): Promise<any[]> {
    try {
      const files: any[] = [];
      const items = await fs.readdir(this.context.projectPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.name.startsWith('.') && !['package.json', '.gitignore', '.env.example'].includes(item.name)) {
          continue; // Skip hidden files except important ones
        }
        
        const fullPath = path.join(this.context.projectPath, item.name);
        const stats = await fs.stat(fullPath);
        
        files.push({
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          extension: path.extname(item.name),
        });
      }
      
      return files;
    } catch {
      return [];
    }
  }

  private async detectLanguages(): Promise<string[]> {
    try {
      const structure = await this.getProjectStructure();
      const extensions = new Set(
        structure
          .filter(file => file.type === 'file')
          .map(file => file.extension)
          .filter(ext => ext)
      );

      const languageMap: Record<string, string> = {
        '.js': 'JavaScript',
        '.ts': 'TypeScript',
        '.py': 'Python',
        '.java': 'Java',
        '.cpp': 'C++',
        '.c': 'C',
        '.cs': 'C#',
        '.go': 'Go',
        '.rs': 'Rust',
        '.php': 'PHP',
        '.rb': 'Ruby',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.dart': 'Dart',
      };

      return Array.from(extensions)
        .map(ext => ext ? languageMap[ext] : undefined)
        .filter((lang): lang is string => Boolean(lang));
    } catch {
      return [];
    }
  }

  getContext(): AgentContext {
    return { ...this.context };
  }

  getActiveTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  getTask(taskId: string): AgentTask | undefined {
    return this.activeTasks.get(taskId);
  }

  private async setupGitWorkflow(plan: AgentPlan): Promise<{ repoInfo: any; branchName: string }> {
    try {
      logger.info('Setting up Git workflow', { planId: plan.id, branchName: plan.branchName });

      // Check if it's a git repository
      const gitInfo = await this.getGitInfo();
      if (!gitInfo?.isGitRepo) {
        throw new Error('Current directory is not a Git repository. Please initialize a Git repository first.');
      }

      // Get git status to ensure we're starting from a clean state
      const gitInstance = this.getGitInstance();
      const status = await gitInstance.status();
      
      // If there are uncommitted changes, we need to handle them
      if (status.files.length > 0) {
        logger.warn('Found uncommitted changes, stashing them before creating branch', {
          files: status.files.length
        });
        await gitInstance.stash(['push', '-m', `Auto-stash before task: ${plan.task}`]);
      }

      // Get remote information
      const remotes = await gitInstance.getRemotes(true);
      const originRemote = remotes.find((remote: any) => remote.name === 'origin');
      
      if (!originRemote) {
        throw new Error('No origin remote found. Please set up a remote repository.');
      }

      // Parse repository information from remote URL
      const { parseGitRemoteUrl } = await import('../tools/github-operations-tool.js');
      const repoInfo = parseGitRemoteUrl(originRemote.refs.fetch);
      
      if (!repoInfo) {
        throw new Error('Could not parse GitHub repository information from remote URL');
      }

      // Ensure we're on the default branch and up to date
      const defaultBranch = Config.git.defaultBranch;
      await gitInstance.checkout(defaultBranch);
      await gitInstance.pull('origin', defaultBranch);

      // Create and checkout the feature branch
      const branchName = plan.branchName || `task-${Date.now()}`;
      await gitInstance.checkoutLocalBranch(branchName);

      logger.info('Git workflow setup completed', {
        planId: plan.id,
        branchName,
        repoOwner: repoInfo.owner,
        repoName: repoInfo.repo,
        defaultBranch
      });

      return { repoInfo, branchName };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to setup Git workflow', { planId: plan.id, error: errorMessage });
      throw new Error(`Failed to setup Git workflow: ${errorMessage}`);
    }
  }

  private async completeGitWorkflow(
    plan: AgentPlan, 
    repoInfo: any, 
    branchName: string, 
    workCompleted: boolean
  ): Promise<void> {
    try {
      if (!workCompleted) {
        logger.info('No work completed, skipping Git workflow completion');
        return;
      }

      logger.info('Completing Git workflow', { 
        planId: plan.id, 
        branchName,
        repoOwner: repoInfo.owner,
        repoName: repoInfo.repo
      });

      const gitInstance = this.getGitInstance();
      
      // Check if there are any changes to commit
      const status = await gitInstance.status();
      if (status.files.length === 0) {
        logger.warn('No changes to commit, skipping Git workflow completion');
        return;
      }

      // Add all changes
      await gitInstance.add('.');
      
      // Commit with the planned commit message
      const commitMessage = plan.commitMessage || `Complete task: ${plan.task}`;
      await gitInstance.commit(commitMessage);

      // Push the branch
      await gitInstance.push('origin', branchName, ['--set-upstream']);

      // Create a pull request if GitHub token is available
      if (Config.github.token) {
        try {
          const { createPullRequestTool } = await import('../tools/github-operations-tool.js');
          
          const prResult = await createPullRequestTool.execute({
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            title: plan.prTitle || `Task: ${plan.task}`,
            head: branchName,
            base: Config.git.defaultBranch,
            body: plan.prDescription || `This PR implements the following task:\n\n${plan.task}\n\n## Changes\n\n- ${plan.summary}`,
            draft: false,
            token: Config.github.token
          });

          logger.info('Pull request created successfully', {
            planId: plan.id,
            prNumber: prResult.pullRequest.number,
            prUrl: prResult.pullRequest.url
          });

          // Store PR information in the plan
          plan.prUrl = prResult.pullRequest.url;
          plan.prNumber = prResult.pullRequest.number;
        } catch (prError) {
          const prErrorMessage = prError instanceof Error ? prError.message : 'Unknown error';
          logger.error('Failed to create pull request', { 
            planId: plan.id,
            error: prErrorMessage 
          });
          // Don't fail the entire workflow if PR creation fails
        }
      } else {
        logger.warn('GitHub token not available, skipping pull request creation');
      }

      logger.info('Git workflow completed successfully', {
        planId: plan.id,
        branchName,
        commitMessage
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to complete Git workflow', { 
        planId: plan.id, 
        branchName,
        error: errorMessage 
      });
      throw new Error(`Failed to complete Git workflow: ${errorMessage}`);
    }
  }

  private getGitInstance(): any {
    const { simpleGit } = require('simple-git');
    return simpleGit(this.context.projectPath, {
      timeout: {
        block: Config.git.timeoutMs,
      },
    });
  }
}
