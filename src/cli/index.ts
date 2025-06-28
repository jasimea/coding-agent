#!/usr/bin/env node

import { CodingAgent } from '../agents/coding-agent.js';
import { createContextLogger } from '../utils/logger.js';
import readline from 'readline';

const logger = createContextLogger('CLI');

class CodingAgentCLI {
  private agent: CodingAgent;
  private rl: readline.Interface;

  constructor() {
    this.agent = new CodingAgent();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start() {
    console.log('🤖 Coding Agent CLI');
    console.log('====================');
    console.log('Type your tasks and I\'ll help you with coding, git operations, file management, and more!');
    console.log('Type "exit" to quit, "help" for commands, or "analyze" to analyze the current project.\n');

    const context = this.agent.getContext();
    console.log(`Working Directory: ${context.workingDirectory}`);
    console.log(`Project Path: ${context.projectPath}\n`);

    this.promptUser();
  }

  private promptUser() {
    this.rl.question('Agent> ', async (input) => {
      const command = input.trim();

      if (command === 'exit') {
        console.log('Goodbye! 👋');
        this.rl.close();
        process.exit(0);
      }

      if (command === 'help') {
        this.showHelp();
        this.promptUser();
        return;
      }

      if (command === 'analyze') {
        await this.analyzeProject();
        this.promptUser();
        return;
      }

      if (command === 'context') {
        this.showContext();
        this.promptUser();
        return;
      }

      if (!command) {
        this.promptUser();
        return;
      }

      await this.executeTask(command);
      this.promptUser();
    });
  }

  private showHelp() {
    console.log(`
Available Commands:
==================
• help     - Show this help message
• exit     - Exit the CLI
• analyze  - Analyze the current project
• context  - Show current agent context
• <task>   - Execute any coding task

Example Tasks:
=============
• "Create a new React component called Button"
• "Add all files to git and commit with message 'Initial commit'"
• "List all files in the src directory"
• "Run npm install"
• "Create a README.md file with project description"
• "Show git status"
• "Build the project"
`);
  }

  private async analyzeProject() {
    try {
      console.log('🔍 Analyzing project...\n');
      const analysis = await this.agent.analyzeProject();
      
      console.log('Project Analysis:');
      console.log('================');
      console.log(`Project Path: ${analysis.projectPath}`);
      
      if (analysis.packageInfo) {
        console.log(`Package Name: ${analysis.packageInfo.name}`);
        console.log(`Version: ${analysis.packageInfo.version}`);
        console.log(`Description: ${analysis.packageInfo.description || 'N/A'}`);
      }
      
      if (analysis.gitInfo) {
        console.log('Git Repository: Yes');
      } else {
        console.log('Git Repository: No');
      }
      
      console.log(`Languages Detected: ${analysis.languages.join(', ') || 'None'}`);
      console.log(`Files Count: ${analysis.projectStructure.length}`);
      
      console.log('\nProject Structure:');
      analysis.projectStructure.slice(0, 10).forEach((file: any) => {
        const icon = file.type === 'directory' ? '📁' : '📄';
        console.log(`  ${icon} ${file.name}`);
      });
      
      if (analysis.projectStructure.length > 10) {
        console.log(`  ... and ${analysis.projectStructure.length - 10} more files`);
      }
      
      console.log('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to analyze project: ${errorMessage}\n`);
    }
  }

  private showContext() {
    const context = this.agent.getContext();
    const activeTasks = this.agent.getActiveTasks();
    
    console.log(`
Current Context:
===============
Working Directory: ${context.workingDirectory}
Project Path: ${context.projectPath}
Files Tracked: ${context.files.length}
Active Tasks: ${activeTasks.length}

Environment Variables:
${Object.entries(context.environment)
  .filter(([key]) => key.startsWith('NODE_') || ['PATH', 'USER', 'HOME'].includes(key))
  .slice(0, 5)
  .map(([key, value]) => `  ${key}=${value?.substring(0, 50)}${value && value.length > 50 ? '...' : ''}`)
  .join('\n')}
`);
  }

  private async executeTask(task: string) {
    try {
      console.log(`🔄 Executing: ${task}\n`);
      
      const startTime = Date.now();
      const result = await this.agent.executeTask({ task });
      const duration = Date.now() - startTime;
      
      if (result.status === 'completed') {
        console.log('✅ Task completed successfully!\n');
        
        if (result.result) {
          console.log('Result:');
          console.log('=======');
          console.log(result.result);
          console.log('');
        }
        
        if (result.steps.length > 0) {
          console.log('Steps Executed:');
          console.log('===============');
          result.steps.forEach((step, index) => {
            console.log(`${index + 1}. ${step.tool}: ${step.action}`);
            if (step.output && typeof step.output === 'object') {
              console.log(`   Result: ${JSON.stringify(step.output, null, 2).substring(0, 200)}...`);
            }
          });
          console.log('');
        }
        
        console.log(`⏱️  Execution time: ${duration}ms\n`);
      } else {
        console.log('❌ Task failed!\n');
        if (result.error) {
          console.log(`Error: ${result.error}\n`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Task execution failed: ${errorMessage}\n`);
      logger.error('CLI task execution failed', { task, error: errorMessage });
    }
  }
}

// Start the CLI if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new CodingAgentCLI();
  cli.start().catch((error) => {
    console.error('Failed to start CLI:', error);
    process.exit(1);
  });
}

export { CodingAgentCLI };
