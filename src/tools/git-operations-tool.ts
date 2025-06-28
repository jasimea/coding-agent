import { z } from 'zod';
import { simpleGit, SimpleGit } from 'simple-git';
import { Config } from '../config/index.js';
import { createContextLogger } from '../utils/logger.js';

const logger = createContextLogger('GitOperationsTool');

// Initialize git with timeout
const git: SimpleGit = simpleGit({
  timeout: {
    block: Config.git.timeoutMs,
  },
});

// Git operation schemas
const gitStatusSchema = z.object({
  path: z.string().optional().describe('Path to the repository (default: current directory)'),
});

const gitAddSchema = z.object({
  files: z.array(z.string()).describe('Files to add to staging area'),
  path: z.string().optional().describe('Repository path (default: current directory)'),
});

const gitCommitSchema = z.object({
  message: z.string().describe('Commit message'),
  path: z.string().optional().describe('Repository path (default: current directory)'),
});

const gitPushSchema = z.object({
  remote: z.string().optional().default('origin').describe('Remote name (default: origin)'),
  branch: z.string().optional().describe('Branch to push (default: current branch)'),
  path: z.string().optional().describe('Repository path (default: current directory)'),
});

const gitPullSchema = z.object({
  remote: z.string().optional().default('origin').describe('Remote name (default: origin)'),
  branch: z.string().optional().describe('Branch to pull (default: current branch)'),
  path: z.string().optional().describe('Repository path (default: current directory)'),
});

const gitBranchSchema = z.object({
  action: z.enum(['list', 'create', 'switch', 'delete']).describe('Branch action to perform'),
  branchName: z.string().optional().describe('Branch name (required for create, switch, delete)'),
  path: z.string().optional().describe('Repository path (default: current directory)'),
});

const gitLogSchema = z.object({
  maxCount: z.number().optional().default(10).describe('Maximum number of commits to show'),
  path: z.string().optional().describe('Repository path (default: current directory)'),
});

const gitDiffSchema = z.object({
  cached: z.boolean().optional().default(false).describe('Show staged changes'),
  path: z.string().optional().describe('Repository path (default: current directory)'),
  file: z.string().optional().describe('Specific file to diff'),
});

const gitInitSchema = z.object({
  path: z.string().optional().describe('Repository path (default: current directory)'),
  bare: z.boolean().optional().default(false).describe('Initialize as bare repository'),
});

const gitCloneSchema = z.object({
  url: z.string().describe('Repository URL to clone'),
  destination: z.string().optional().describe('Destination directory'),
  depth: z.number().optional().describe('Create a shallow clone with specified depth'),
});

// Helper function to get git instance for a specific path
function getGitInstance(repoPath?: string): SimpleGit {
  if (repoPath) {
    return simpleGit(repoPath, {
      timeout: {
        block: Config.git.timeoutMs,
      },
    });
  }
  return git;
}

// Git tools
export const gitStatusTool = {
  description: 'Get the status of a git repository',
  parameters: gitStatusSchema,
  execute: async (parameters: z.infer<typeof gitStatusSchema>) => {
    try {
      const gitInstance = getGitInstance(parameters.path);
      const status = await gitInstance.status();
      
      logger.info('Git status retrieved', { path: parameters.path, files: status.files.length });
      
      return {
        success: true,
        branch: status.current,
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged,
        modified: status.modified,
        not_added: status.not_added,
        deleted: status.deleted,
        renamed: status.renamed,
        conflicted: status.conflicted,
        files: status.files,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get git status', { path: parameters.path, error: errorMessage });
      throw new Error(`Failed to get git status: ${errorMessage}`);
    }
  },
};

export const gitAddTool = {
  description: 'Add files to git staging area',
  parameters: gitAddSchema,
  execute: async (parameters: z.infer<typeof gitAddSchema>) => {
    try {
      const gitInstance = getGitInstance(parameters.path);
      await gitInstance.add(parameters.files);
      
      logger.info('Files added to git staging area', { path: parameters.path, files: parameters.files });
      
      return {
        success: true,
        files: parameters.files,
        message: `Added ${parameters.files.length} file(s) to staging area`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add files to git', { path: parameters.path, files: parameters.files, error: errorMessage });
      throw new Error(`Failed to add files to git: ${errorMessage}`);
    }
  },
};

export const gitCommitTool = {
  description: 'Commit staged changes to git repository',
  parameters: gitCommitSchema,
  execute: async (parameters: z.infer<typeof gitCommitSchema>) => {
    try {
      const gitInstance = getGitInstance(parameters.path);
      const result = await gitInstance.commit(parameters.message);
      
      logger.info('Git commit created', { path: parameters.path, hash: result.commit, message: parameters.message });
      
      return {
        success: true,
        commit: result.commit,
        summary: result.summary,
        message: parameters.message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to commit to git', { path: parameters.path, message: parameters.message, error: errorMessage });
      throw new Error(`Failed to commit to git: ${errorMessage}`);
    }
  },
};

export const gitPushTool = {
  description: 'Push commits to remote repository',
  parameters: gitPushSchema,
  execute: async (parameters: z.infer<typeof gitPushSchema>) => {
    try {
      const gitInstance = getGitInstance(parameters.path);
      const result = await gitInstance.push(parameters.remote, parameters.branch);
      
      logger.info('Git push completed', { path: parameters.path, remote: parameters.remote, branch: parameters.branch });
      
      return {
        success: true,
        remote: parameters.remote,
        branch: parameters.branch,
        result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to push to git', { path: parameters.path, remote: parameters.remote, branch: parameters.branch, error: errorMessage });
      throw new Error(`Failed to push to git: ${errorMessage}`);
    }
  },
};

export const gitPullTool = {
  description: 'Pull changes from remote repository',
  parameters: gitPullSchema,
  execute: async (parameters: z.infer<typeof gitPullSchema>) => {
    try {
      const gitInstance = getGitInstance(parameters.path);
      const result = await gitInstance.pull(parameters.remote, parameters.branch);
      
      logger.info('Git pull completed', { path: parameters.path, remote: parameters.remote, branch: parameters.branch });
      
      return {
        success: true,
        remote: parameters.remote,
        branch: parameters.branch,
        summary: result.summary,
        files: result.files,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to pull from git', { path: parameters.path, remote: parameters.remote, branch: parameters.branch, error: errorMessage });
      throw new Error(`Failed to pull from git: ${errorMessage}`);
    }
  },
};

export const gitBranchTool = {
  description: 'Manage git branches (list, create, switch, delete)',
  parameters: gitBranchSchema,
  execute: async (parameters: z.infer<typeof gitBranchSchema>) => {
    try {
      const gitInstance = getGitInstance(parameters.path);
      let result;

      switch (parameters.action) {
        case 'list':
          result = await gitInstance.branch();
          logger.info('Git branches listed', { path: parameters.path, count: result.all.length });
          return {
            success: true,
            action: 'list',
            current: result.current,
            all: result.all,
            branches: result.branches,
          };

        case 'create':
          if (!parameters.branchName) {
            throw new Error('Branch name is required for create action');
          }
          await gitInstance.checkoutLocalBranch(parameters.branchName);
          logger.info('Git branch created and switched', { path: parameters.path, branch: parameters.branchName });
          return {
            success: true,
            action: 'create',
            branch: parameters.branchName,
            message: `Created and switched to branch '${parameters.branchName}'`,
          };

        case 'switch':
          if (!parameters.branchName) {
            throw new Error('Branch name is required for switch action');
          }
          await gitInstance.checkout(parameters.branchName);
          logger.info('Git branch switched', { path: parameters.path, branch: parameters.branchName });
          return {
            success: true,
            action: 'switch',
            branch: parameters.branchName,
            message: `Switched to branch '${parameters.branchName}'`,
          };

        case 'delete':
          if (!parameters.branchName) {
            throw new Error('Branch name is required for delete action');
          }
          await gitInstance.deleteLocalBranch(parameters.branchName);
          logger.info('Git branch deleted', { path: parameters.path, branch: parameters.branchName });
          return {
            success: true,
            action: 'delete',
            branch: parameters.branchName,
            message: `Deleted branch '${parameters.branchName}'`,
          };

        default:
          throw new Error(`Unknown branch action: ${parameters.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to perform git branch operation', { 
        path: parameters.path, 
        action: parameters.action, 
        branch: parameters.branchName, 
        error: errorMessage 
      });
      throw new Error(`Failed to perform git branch operation: ${errorMessage}`);
    }
  },
};

export const gitLogTool = {
  description: 'Show git commit history',
  parameters: gitLogSchema,
  execute: async (parameters: z.infer<typeof gitLogSchema>) => {
    try {
      const gitInstance = getGitInstance(parameters.path);
      const log = await gitInstance.log({ maxCount: parameters.maxCount });
      
      logger.info('Git log retrieved', { path: parameters.path, commits: log.all.length });
      
      return {
        success: true,
        total: log.total,
        latest: log.latest,
        all: log.all.map(commit => ({
          hash: commit.hash,
          date: commit.date,
          message: commit.message,
          author: commit.author_name,
          email: commit.author_email,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get git log', { path: parameters.path, error: errorMessage });
      throw new Error(`Failed to get git log: ${errorMessage}`);
    }
  },
};

export const gitDiffTool = {
  description: 'Show git diff (changes between commits, working tree, etc.)',
  parameters: gitDiffSchema,
  execute: async (parameters: z.infer<typeof gitDiffSchema>) => {
    try {
      const gitInstance = getGitInstance(parameters.path);
      let diff;

      if (parameters.file) {
        diff = parameters.cached 
          ? await gitInstance.diff(['--cached', parameters.file])
          : await gitInstance.diff([parameters.file]);
      } else {
        diff = parameters.cached 
          ? await gitInstance.diff(['--cached'])
          : await gitInstance.diff();
      }
      
      logger.info('Git diff retrieved', { 
        path: parameters.path, 
        cached: parameters.cached, 
        file: parameters.file,
        hasChanges: diff.length > 0 
      });
      
      return {
        success: true,
        diff,
        cached: parameters.cached,
        file: parameters.file,
        hasChanges: diff.length > 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get git diff', { path: parameters.path, error: errorMessage });
      throw new Error(`Failed to get git diff: ${errorMessage}`);
    }
  },
};

export const gitInitTool = {
  description: 'Initialize a new git repository',
  parameters: gitInitSchema,
  execute: async (parameters: z.infer<typeof gitInitSchema>) => {
    try {
      const gitInstance = getGitInstance(parameters.path);
      await gitInstance.init(parameters.bare);
      
      logger.info('Git repository initialized', { path: parameters.path, bare: parameters.bare });
      
      return {
        success: true,
        path: parameters.path || process.cwd(),
        bare: parameters.bare,
        message: 'Git repository initialized successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize git repository', { path: parameters.path, error: errorMessage });
      throw new Error(`Failed to initialize git repository: ${errorMessage}`);
    }
  },
};

export const gitCloneTool = {
  description: 'Clone a git repository',
  parameters: gitCloneSchema,
  execute: async (parameters: z.infer<typeof gitCloneSchema>) => {
    try {
      const options: any = {};
      if (parameters.depth) {
        options['--depth'] = parameters.depth;
      }

      const destination = parameters.destination || parameters.url.split('/').pop()?.replace('.git', '') || 'cloned-repo';
      await git.clone(parameters.url, destination, options);
      
      logger.info('Git repository cloned', { 
        url: parameters.url, 
        destination: destination,
        depth: parameters.depth 
      });
      
      return {
        success: true,
        url: parameters.url,
        destination: destination,
        depth: parameters.depth,
        message: 'Repository cloned successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to clone git repository', { url: parameters.url, error: errorMessage });
      throw new Error(`Failed to clone git repository: ${errorMessage}`);
    }
  },
};
