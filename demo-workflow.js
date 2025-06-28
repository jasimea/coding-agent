#!/usr/bin/env node

/**
 * Demo script showing the automated Git workflow
 * This demonstrates how tasks are now handled with automatic Git operations
 */

import { CodingAgent } from './src/agents/coding-agent.js';
import { AIProvider } from './src/ai/provider.js';

async function demonstrateWorkflow() {
  console.log('🤖 Coding Agent Git Workflow Demo');
  console.log('==================================\n');

  // Initialize the agent
  const aiProvider = new AIProvider();
  const agent = new CodingAgent(aiProvider, process.cwd());

  try {
    // Example task that would trigger the Git workflow
    const taskRequest = {
      task: 'Create a utility function for string manipulation and add proper JSDoc comments',
      context: {
        workingDirectory: process.cwd(),
      }
    };

    console.log('📋 Task:', taskRequest.task);
    console.log('\n🔄 Workflow Steps:');
    console.log('1. ✅ Planning phase - Create detailed execution plan');
    console.log('2. ✅ Git setup - Create feature branch');
    console.log('3. ✅ Execution - Perform actual work');
    console.log('4. ✅ Git completion - Commit & create PR');

    // In a real scenario, this would execute the full workflow:
    // const response = await agent.executeTask(taskRequest);
    
    console.log('\n📊 Expected Results:');
    console.log('- Feature branch created (e.g., task-1703567890123)');
    console.log('- Changes committed with descriptive message');
    console.log('- Pull request created with proper title and description');
    console.log('- PR URL returned for easy access');

    console.log('\n🔧 Configuration Required:');
    console.log('- GITHUB_TOKEN environment variable');
    console.log('- Git repository with GitHub remote');
    console.log('- AI provider API key (OpenAI, Anthropic, or Google)');

    console.log('\n✨ New Tools Available:');
    console.log('- github_create_pr: Create pull request');
    console.log('- github_create_issue: Create issue');
    console.log('- github_get_repo_info: Get repository information');
    console.log('- git_remote: Get remote repository information');

  } catch (error) {
    console.error('❌ Demo error:', error.message);
  }
}

// Run the demo
demonstrateWorkflow().catch(console.error);
