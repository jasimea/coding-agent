import { promises as fs } from "fs";
import path from "path";
import simpleGit, { SimpleGit } from "simple-git";
import { RepositoryConfig } from "./webhook-types.js";
import { taskProcessorLogger as logger } from "./logger.js";

/**
 * Repository information for shared workspace management
 */
export interface RepositoryInfo {
  url: string;
  normalizedUrl: string;
  name: string;
  path: string;
  lastAccessed: string;
  currentBranch: string;
  isClean: boolean;
}

/**
 * Manages shared repository workspaces to avoid repeated cloning
 */
export class SharedRepositoryManager {
  private workspaceDir: string;
  private repositories: Map<string, RepositoryInfo> = new Map();

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
  }

  /**
   * Initialize the repository manager
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.workspaceDir, { recursive: true });
      await this.scanExistingRepositories();
      logger.info("Shared repository manager initialized", { workspaceDir: this.workspaceDir });
    } catch (error) {
      logger.error("Failed to initialize shared repository manager", { error });
      throw error;
    }
  }

  /**
   * Get or clone a repository for use
   */
  async getRepository(repositoryUrl: string, taskId: string): Promise<RepositoryConfig> {
    const normalizedUrl = this.normalizeRepositoryUrl(repositoryUrl);
    const repoInfo = this.repositories.get(normalizedUrl);

    if (repoInfo && await this.isRepositoryValid(repoInfo)) {
      // Repository exists and is valid, update it
      logger.info("Using existing repository", { taskId, repositoryUrl, path: repoInfo.path });
      await this.updateRepository(repoInfo, taskId);
      return {
        url: repositoryUrl,
        branch: repoInfo.currentBranch,
        clonePath: repoInfo.path,
        token: this.getAuthToken(repositoryUrl),
      };
    } else {
      // Clone new repository
      logger.info("Cloning new repository", { taskId, repositoryUrl });
      return await this.cloneRepository(repositoryUrl, taskId);
    }
  }

  /**
   * Clone a repository to the shared workspace
   */
  private async cloneRepository(repositoryUrl: string, taskId: string): Promise<RepositoryConfig> {
    const normalizedUrl = this.normalizeRepositoryUrl(repositoryUrl);
    const repoName = this.extractRepoName(repositoryUrl);
    const repoPath = path.join(this.workspaceDir, repoName);

    try {
      // Remove existing directory if it exists
      try {
        await fs.rm(repoPath, { recursive: true, force: true });
      } catch {
        // Directory doesn't exist, ignore
      }

      // Clone repository
      const git = simpleGit();
      const token = this.getAuthToken(repositoryUrl);
      const authUrl = this.buildAuthUrl(repositoryUrl, token);

      await git.clone(authUrl, repoPath);

      // Get default branch
      const repoGit = simpleGit(repoPath);
      const branches = await repoGit.branch();
      const defaultBranch = branches.current;

      // Store repository info
      const repoInfo: RepositoryInfo = {
        url: repositoryUrl,
        normalizedUrl,
        name: repoName,
        path: repoPath,
        lastAccessed: new Date().toISOString(),
        currentBranch: defaultBranch,
        isClean: true,
      };

      this.repositories.set(normalizedUrl, repoInfo);

      logger.info("Repository cloned successfully", { 
        taskId, 
        repositoryUrl, 
        path: repoPath, 
        branch: defaultBranch 
      });

      return {
        url: repositoryUrl,
        branch: defaultBranch,
        token,
        clonePath: repoPath,
      };
    } catch (error) {
      logger.error("Failed to clone repository", { taskId, repositoryUrl, error });
      throw error;
    }
  }

  /**
   * Update an existing repository
   */
  private async updateRepository(repoInfo: RepositoryInfo, taskId: string): Promise<void> {
    try {
      const git = simpleGit(repoInfo.path);

      // Check if repository is clean
      const status = await git.status();
      if (!status.isClean()) {
        logger.warn("Repository has uncommitted changes, cleaning up", { 
          taskId, 
          repositoryUrl: repoInfo.url 
        });
        
        // Stash any changes
        try {
          await git.stash(['push', '-m', `Auto-stash before task ${taskId}`]);
        } catch (stashError) {
          // If stash fails, try reset --hard
          await git.reset(['--hard', 'HEAD']);
        }
      }

      // Switch to main/master branch
      const branches = await git.branch();
      const mainBranch = this.getMainBranch(branches.all);
      if (branches.current !== mainBranch) {
        await git.checkout(mainBranch);
      }

      // Pull latest changes
      await git.pull();

      // Update repository info
      repoInfo.lastAccessed = new Date().toISOString();
      repoInfo.currentBranch = mainBranch;
      repoInfo.isClean = true;

      logger.info("Repository updated successfully", { 
        taskId, 
        repositoryUrl: repoInfo.url, 
        branch: mainBranch 
      });
    } catch (error) {
      logger.error("Failed to update repository", { 
        taskId, 
        repositoryUrl: repoInfo.url, 
        error 
      });
      throw error;
    }
  }

  /**
   * Check if a repository is valid and accessible
   */
  private async isRepositoryValid(repoInfo: RepositoryInfo): Promise<boolean> {
    try {
      // Check if directory exists
      await fs.access(repoInfo.path);

      // Check if it's a git repository
      const git = simpleGit(repoInfo.path);
      await git.status();

      return true;
    } catch (error) {
      logger.debug("Repository validation failed", { 
        repositoryUrl: repoInfo.url, 
        path: repoInfo.path, 
        error 
      });
      return false;
    }
  }

  /**
   * Scan existing repositories in the workspace
   */
  private async scanExistingRepositories(): Promise<void> {
    try {
      const entries = await fs.readdir(this.workspaceDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const repoPath = path.join(this.workspaceDir, entry.name);
          
          try {
            const git = simpleGit(repoPath);
            const remotes = await git.getRemotes(true);
            
            if (remotes.length > 0) {
              const originRemote = remotes.find(r => r.name === 'origin') || remotes[0];
              if (originRemote && originRemote.refs.fetch) {
                const repositoryUrl = originRemote.refs.fetch;
                const normalizedUrl = this.normalizeRepositoryUrl(repositoryUrl);
                
                const branches = await git.branch();
                const status = await git.status();
                
                const repoInfo: RepositoryInfo = {
                  url: repositoryUrl,
                  normalizedUrl,
                  name: entry.name,
                  path: repoPath,
                  lastAccessed: new Date().toISOString(),
                  currentBranch: branches.current,
                  isClean: status.isClean(),
                };

                this.repositories.set(normalizedUrl, repoInfo);
                logger.debug("Found existing repository", { repositoryUrl, path: repoPath });
              }
            }
          } catch (error) {
            logger.debug("Skipping invalid repository directory", { path: repoPath, error });
          }
        }
      }

      logger.info("Scanned existing repositories", { count: this.repositories.size });
    } catch (error) {
      logger.error("Failed to scan existing repositories", { error });
    }
  }

  /**
   * Clean up old repositories that haven't been accessed recently
   */
  async cleanupOldRepositories(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const repositoriesToRemove: string[] = [];

    for (const [normalizedUrl, repoInfo] of this.repositories.entries()) {
      const lastAccessed = new Date(repoInfo.lastAccessed).getTime();
      
      if (now - lastAccessed > maxAge) {
        try {
          await fs.rm(repoInfo.path, { recursive: true, force: true });
          repositoriesToRemove.push(normalizedUrl);
          logger.info("Removed old repository", { 
            repositoryUrl: repoInfo.url, 
            lastAccessed: repoInfo.lastAccessed 
          });
        } catch (error) {
          logger.error("Failed to remove old repository", { 
            repositoryUrl: repoInfo.url, 
            error 
          });
        }
      }
    }

    // Remove from memory
    repositoriesToRemove.forEach(url => this.repositories.delete(url));

    if (repositoriesToRemove.length > 0) {
      logger.info("Cleaned up old repositories", { count: repositoriesToRemove.length });
    }
  }

  /**
   * Get repository information
   */
  getRepositoryInfo(repositoryUrl: string): RepositoryInfo | null {
    const normalizedUrl = this.normalizeRepositoryUrl(repositoryUrl);
    return this.repositories.get(normalizedUrl) || null;
  }

  /**
   * List all managed repositories
   */
  getAllRepositories(): RepositoryInfo[] {
    return Array.from(this.repositories.values());
  }

  /**
   * Normalize repository URL for consistent comparison
   */
  private normalizeRepositoryUrl(url: string): string {
    return url.toLowerCase()
      .replace(/\.git$/, '')
      .replace(/\/$/, '')
      .replace(/^https?:\/\/[^@]*@/, 'https://') // Remove auth tokens
      .replace(/^https?:\/\//, '');
  }

  /**
   * Extract repository name from URL
   */
  private extractRepoName(url: string): string {
    const parts = url.replace(".git", "").split("/");
    const lastPart = parts[parts.length - 1];
    return lastPart || "unknown-repo";
  }

  /**
   * Get authentication token for repository
   */
  private getAuthToken(repositoryUrl: string): string | undefined {
    if (repositoryUrl.includes("github.com")) {
      return process.env.GITHUB_TOKEN;
    } else if (repositoryUrl.includes("gitlab.com")) {
      return process.env.GITLAB_TOKEN;
    }
    return undefined;
  }

  /**
   * Build authenticated URL for cloning
   */
  private buildAuthUrl(repositoryUrl: string, token?: string): string {
    if (!token) return repositoryUrl;

    if (repositoryUrl.includes("github.com")) {
      return repositoryUrl.replace(
        "https://github.com/",
        `https://${token}@github.com/`,
      );
    } else if (repositoryUrl.includes("gitlab.com")) {
      return repositoryUrl.replace(
        "https://gitlab.com/",
        `https://oauth2:${token}@gitlab.com/`,
      );
    }

    return repositoryUrl;
  }

  /**
   * Determine the main branch from available branches
   */
  private getMainBranch(branches: string[]): string {
    // Look for common main branch names
    const mainBranches = ['main', 'master', 'develop', 'dev'];
    
    for (const mainBranch of mainBranches) {
      if (branches.includes(mainBranch)) {
        return mainBranch;
      }
    }

    // Fallback to first branch
    return branches[0] || 'main';
  }
}