import { CodingAgent } from '../src/agents/coding-agent.js';
import { AIProvider } from '../src/ai/provider.js';
import { describe, it, beforeEach, expect } from 'vitest';

describe('CodingAgent Git Workflow', () => {
  let agent: CodingAgent;

  beforeEach(() => {
    // Initialize with a mock AI provider for testing
    const mockAIProvider = new AIProvider();
    agent = new CodingAgent(mockAIProvider, process.cwd());
  });

  it('should create a plan with Git workflow information', async () => {
    const testTask = 'Create a simple hello world function';
    
    // Create a plan
    const plan = await agent['createPlan'](testTask);
    
    // Verify plan structure
    expect(plan).toHaveProperty('id');
    expect(plan).toHaveProperty('task', testTask);
    expect(plan).toHaveProperty('steps');
    expect(plan).toHaveProperty('branchName');
    expect(plan).toHaveProperty('commitMessage');
    expect(plan).toHaveProperty('prTitle');
    expect(plan).toHaveProperty('prDescription');
    
    // Verify plan contains steps
    expect(plan.steps).toBeInstanceOf(Array);
    expect(plan.steps.length).toBeGreaterThan(0);
    
    // Verify Git workflow information is present
    expect(typeof plan.branchName).toBe('string');
    expect(typeof plan.commitMessage).toBe('string');
    expect(typeof plan.prTitle).toBe('string');
    expect(typeof plan.prDescription).toBe('string');
  });

  it('should handle project analysis', async () => {
    const analysis = await agent.analyzeProject();
    
    expect(analysis).toHaveProperty('projectPath');
    expect(analysis).toHaveProperty('packageInfo');
    expect(analysis).toHaveProperty('gitInfo');
    expect(analysis).toHaveProperty('projectStructure');
    expect(analysis).toHaveProperty('languages');
  });

  it('should provide context information', () => {
    const context = agent.getContext();
    
    expect(context).toHaveProperty('workingDirectory');
    expect(context).toHaveProperty('projectPath');
    expect(context).toHaveProperty('files');
    expect(context).toHaveProperty('environment');
  });
});
