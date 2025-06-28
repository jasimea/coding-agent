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
- Git operations (status, add, commit, push, pull, branch management)
- Command execution (run shell commands, install packages, build projects)

Current context:
- Working directory: ${this.context.workingDirectory}
- Project path: ${this.context.projectPath}

Return a JSON object with this structure:
{
  "steps": [
    {
      "id": "step_1",
      "description": "Description of what to do",
      "action": "file_operation|git_operation|command_execution|analysis",
      "complexity": "low|medium|high",
      "estimatedDuration": "Duration in minutes"
    }
  ],
  "summary": "Brief summary of the overall plan",
  "estimatedTotalTime": "Total estimated time",
  "dependencies": ["List of external dependencies if any"]
}

Focus on creating a practical, executable plan that uses the available tools effectively.`;
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
          dependencies: []
        };
      }

      const plan: AgentPlan = {
        id: uuidv4(),
        task,
        steps: planData.steps || [],
        summary: planData.summary || 'Plan execution',
        estimatedTotalTime: planData.estimatedTotalTime || 'Unknown',
        dependencies: planData.dependencies || [],
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

      logger.info('Plan created, executing steps', {
        taskId,
        planId: plan.id,
        stepsCount: plan.steps.length
      });

      // Step 2: Execute the plan step by step
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
      }

      plan.status = 'completed';

      // Update task status
      task.status = 'completed';
      task.result = `Plan executed successfully. ${plan.summary}`;
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
      // First create a plan, then stream the execution
      const plan = await this.createPlan(request.task);
      task.plan = plan;

      // Create a comprehensive prompt that includes the plan
      const planSummary = plan.steps.map((step, index) => 
        `${index + 1}. ${step.description} (${step.action}, ${step.complexity})`
      ).join('\n');

      const enhancedPrompt = `Execute this task following the planned approach:

Task: ${request.task}

Plan:
${planSummary}

Follow the plan step by step, using appropriate tools for each step. Provide clear progress updates as you complete each step.`;

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
}
