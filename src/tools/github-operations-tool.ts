import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { createContextLogger } from '../utils/logger.js';

const logger = createContextLogger('GitHubOperationsTool');

// GitHub operation schemas
const createPullRequestSchema = z.object({
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  title: z.string().describe('Pull request title'),
  head: z.string().describe('Branch containing the changes'),
  base: z.string().default('main').describe('Branch where changes should be merged (default: main)'),
  body: z.string().optional().describe('Pull request description'),
  draft: z.boolean().optional().default(false).describe('Create as draft PR'),
  token: z.string().optional().describe('GitHub token (if not provided, will use GITHUB_TOKEN env var)'),
});

const createIssueSchema = z.object({
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  title: z.string().describe('Issue title'),
  body: z.string().optional().describe('Issue description'),
  labels: z.array(z.string()).optional().describe('Labels to add to the issue'),
  assignees: z.array(z.string()).optional().describe('Users to assign to the issue'),
  token: z.string().optional().describe('GitHub token (if not provided, will use GITHUB_TOKEN env var)'),
});

const getRepositoryInfoSchema = z.object({
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  token: z.string().optional().describe('GitHub token (if not provided, will use GITHUB_TOKEN env var)'),
});

// Helper function to get Octokit instance
function getOctokitInstance(token?: string): Octokit {
  const authToken = token || process.env.GITHUB_TOKEN;
  if (!authToken) {
    throw new Error('GitHub token is required. Provide it as parameter or set GITHUB_TOKEN environment variable.');
  }
  
  return new Octokit({
    auth: authToken,
  });
}

// Helper function to extract owner/repo from git remote URL
export function parseGitRemoteUrl(remoteUrl: string): { owner: string; repo: string } | null {
  try {
    // Handle both SSH and HTTPS URLs
    const sshMatch = remoteUrl.match(/git@github\.com:([^\/]+)\/(.+?)(?:\.git)?$/);
    if (sshMatch && sshMatch[1] && sshMatch[2]) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }
    
    const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^\/]+)\/(.+?)(?:\.git)?$/);
    if (httpsMatch && httpsMatch[1] && httpsMatch[2]) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }
    
    return null;
  } catch (error) {
    logger.error('Failed to parse git remote URL', { remoteUrl, error });
    return null;
  }
}

// GitHub tools
export const createPullRequestTool = {
  description: 'Create a pull request on GitHub',
  parameters: createPullRequestSchema,
  execute: async (parameters: z.infer<typeof createPullRequestSchema>) => {
    try {
      const octokit = getOctokitInstance(parameters.token);
      
      const response = await octokit.rest.pulls.create({
        owner: parameters.owner,
        repo: parameters.repo,
        title: parameters.title,
        head: parameters.head,
        base: parameters.base,
        body: parameters.body,
        draft: parameters.draft,
      });
      
      logger.info('Pull request created', {
        owner: parameters.owner,
        repo: parameters.repo,
        number: response.data.number,
        title: parameters.title,
        head: parameters.head,
        base: parameters.base,
      });
      
      return {
        success: true,
        pullRequest: {
          number: response.data.number,
          title: response.data.title,
          body: response.data.body,
          head: response.data.head.ref,
          base: response.data.base.ref,
          url: response.data.html_url,
          state: response.data.state,
          draft: response.data.draft,
          mergeable: response.data.mergeable,
          mergeable_state: response.data.mergeable_state,
        },
        message: `Pull request #${response.data.number} created successfully`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create pull request', {
        owner: parameters.owner,
        repo: parameters.repo,
        error: errorMessage,
      });
      throw new Error(`Failed to create pull request: ${errorMessage}`);
    }
  },
};

export const createIssueTool = {
  description: 'Create an issue on GitHub',
  parameters: createIssueSchema,
  execute: async (parameters: z.infer<typeof createIssueSchema>) => {
    try {
      const octokit = getOctokitInstance(parameters.token);
      
      const response = await octokit.rest.issues.create({
        owner: parameters.owner,
        repo: parameters.repo,
        title: parameters.title,
        body: parameters.body,
        labels: parameters.labels,
        assignees: parameters.assignees,
      });
      
      logger.info('Issue created', {
        owner: parameters.owner,
        repo: parameters.repo,
        number: response.data.number,
        title: parameters.title,
      });
      
      return {
        success: true,
        issue: {
          number: response.data.number,
          title: response.data.title,
          body: response.data.body,
          url: response.data.html_url,
          state: response.data.state,
          labels: response.data.labels.map(label => typeof label === 'string' ? label : label.name),
          assignees: response.data.assignees?.map(assignee => assignee?.login).filter(Boolean),
        },
        message: `Issue #${response.data.number} created successfully`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create issue', {
        owner: parameters.owner,
        repo: parameters.repo,
        error: errorMessage,
      });
      throw new Error(`Failed to create issue: ${errorMessage}`);
    }
  },
};

export const getRepositoryInfoTool = {
  description: 'Get repository information from GitHub',
  parameters: getRepositoryInfoSchema,
  execute: async (parameters: z.infer<typeof getRepositoryInfoSchema>) => {
    try {
      const octokit = getOctokitInstance(parameters.token);
      
      const response = await octokit.rest.repos.get({
        owner: parameters.owner,
        repo: parameters.repo,
      });
      
      logger.info('Repository information retrieved', {
        owner: parameters.owner,
        repo: parameters.repo,
        defaultBranch: response.data.default_branch,
      });
      
      return {
        success: true,
        repository: {
          name: response.data.name,
          fullName: response.data.full_name,
          owner: response.data.owner.login,
          description: response.data.description,
          private: response.data.private,
          defaultBranch: response.data.default_branch,
          cloneUrl: response.data.clone_url,
          sshUrl: response.data.ssh_url,
          htmlUrl: response.data.html_url,
          language: response.data.language,
          forksCount: response.data.forks_count,
          stargazersCount: response.data.stargazers_count,
          watchersCount: response.data.watchers_count,
          openIssuesCount: response.data.open_issues_count,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get repository information', {
        owner: parameters.owner,
        repo: parameters.repo,
        error: errorMessage,
      });
      throw new Error(`Failed to get repository information: ${errorMessage}`);
    }
  },
};
