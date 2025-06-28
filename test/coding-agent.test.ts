import { CodingAgent } from '../src/agents/coding-agent.js';
import { AIProvider } from '../src/ai/provider.js';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import type { CoreMessage } from 'ai';

describe('CodingAgent Git Workflow', () => {
  let agent: CodingAgent;
  let mockAIProvider: AIProvider;

  beforeEach(() => {
    // Create a mock AI provider
    mockAIProvider = {
      generateText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          steps: [
            {
              id: 'step_1',
              description: 'Create hello world function',
              action: 'create',
              complexity: 'simple',
              estimatedDuration: '2 minutes'
            }
          ],
          summary: 'Create a simple hello world function',
          estimatedTotalTime: '2 minutes',
          dependencies: [],
          branchName: 'feature/hello-world',
          commitMessage: 'Add hello world function',
          prTitle: 'Add hello world function',
          prDescription: 'This PR adds a simple hello world function'
        })
      }),
      generateStream: vi.fn(),
      generateWithTools: vi.fn()
    } as any;

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
    
    // Verify the mock was called
    expect(mockAIProvider.generateText).toHaveBeenCalled();
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
