import { promises as fs } from "fs";
import path from "path";
import { claudeConfigLogger as logger } from "./logger.js";

export interface ClaudeProjectConfig {
  name: string;
  description: string;
  mcp_servers: {
    [key: string]: {
      command: string;
      args?: string[];
      env?: { [key: string]: string };
    };
  };
}

export class ClaudeConfigManager {
  /**
   * Sets up Claude configuration in the target repository
   */
  async setupClaudeConfig(
    repoPath: string,
    repoName: string,
    taskInfo: any,
  ): Promise<void> {
    const claudeDir = path.join(repoPath, ".claude");

    try {
      // Create .claude directory if it doesn't exist
      await fs.mkdir(claudeDir, { recursive: true });

      // Create or update claude_desktop_config.json
      await this.createDesktopConfig(claudeDir, repoName, taskInfo);

      // Create project configuration
      await this.createProjectConfig(claudeDir, repoName, taskInfo);

      // Create MCP server configurations
      await this.setupMCPServers(claudeDir, repoPath);

      // Create implementation guidelines
      await this.createImplementationGuidelines(claudeDir, taskInfo);

      logger.info("Claude configuration setup completed", {
        repoPath,
        claudeDir,
      });
    } catch (error) {
      logger.error("Error setting up Claude configuration", {
        repoPath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  private async createDesktopConfig(
    claudeDir: string,
    repoName: string,
    taskInfo: any,
  ): Promise<void> {
    const configPath = path.join(claudeDir, "claude_desktop_config.json");

    const config = {
      mcpServers: {
        filesystem: {
          command: "npx",
          args: [
            "-y",
            "@modelcontextprotocol/server-filesystem",
            path.dirname(claudeDir),
          ],
        },
        git: {
          command: "npx",
          args: [
            "-y",
            "@modelcontextprotocol/server-git",
            "--repository",
            path.dirname(claudeDir),
          ],
        },
        typescript: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-typescript"],
          env: {
            PROJECT_ROOT: path.dirname(claudeDir),
          },
        },
        database: {
          command: "npx",
          args: [
            "-y",
            "@modelcontextprotocol/server-sqlite",
            "--db-path",
            path.join(path.dirname(claudeDir), "database.sqlite"),
          ],
        },
        "web-search": {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-brave-search"],
          env: {
            BRAVE_API_KEY: "${BRAVE_API_KEY}",
          },
        },
      },
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    logger.info("Claude desktop config created", { configPath });
  }

  private async createProjectConfig(
    claudeDir: string,
    repoName: string,
    taskInfo: any,
  ): Promise<void> {
    const configPath = path.join(claudeDir, "project.json");

    const projectConfig: ClaudeProjectConfig = {
      name: repoName,
      description: `Autonomous coding project for ${repoName}. Current task: ${taskInfo.title}`,
      mcp_servers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "../"],
        },
        git: {
          command: "npx",
          args: [
            "-y",
            "@modelcontextprotocol/server-git",
            "--repository",
            "../",
          ],
        },
        typescript: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-typescript"],
          env: {
            PROJECT_ROOT: "../",
          },
        },
      },
    };

    await fs.writeFile(configPath, JSON.stringify(projectConfig, null, 2));
    logger.info("Claude project config created", { configPath });
  }

  private async setupMCPServers(
    claudeDir: string,
    repoPath: string,
  ): Promise<void> {
    // Create MCP servers directory
    const mcpDir = path.join(claudeDir, "mcp-servers");
    await fs.mkdir(mcpDir, { recursive: true });

    // Create package.json for MCP dependencies
    const packageJsonPath = path.join(mcpDir, "package.json");
    const packageJson = {
      name: "claude-mcp-servers",
      version: "1.0.0",
      description: "MCP servers for Claude autonomous coding",
      dependencies: {
        "@modelcontextprotocol/server-filesystem": "^0.5.0",
        "@modelcontextprotocol/server-git": "^0.5.0",
        "@modelcontextprotocol/server-typescript": "^0.5.0",
        "@modelcontextprotocol/server-sqlite": "^0.5.0",
        "@modelcontextprotocol/server-brave-search": "^0.5.0",
      },
    };

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Create custom MCP server for project-specific tools
    await this.createCustomMCPServer(mcpDir, repoPath);

    logger.info("MCP servers setup completed", { mcpDir });
  }

  private async createCustomMCPServer(
    mcpDir: string,
    repoPath: string,
  ): Promise<void> {
    const serverPath = path.join(mcpDir, "project-tools.js");

    const serverCode = `#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class ProjectToolsServer {
  constructor() {
    this.server = new Server(
      {
        name: 'project-tools',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'run_tests',
            description: 'Run project tests',
            inputSchema: {
              type: 'object',
              properties: {
                command: { type: 'string', description: 'Test command to run' }
              }
            }
          },
          {
            name: 'build_project',
            description: 'Build the project',
            inputSchema: {
              type: 'object',
              properties: {
                command: { type: 'string', description: 'Build command to run' }
              }
            }
          },
          {
            name: 'lint_code',
            description: 'Run linting on the codebase',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Path to lint' }
              }
            }
          },
          {
            name: 'analyze_dependencies',
            description: 'Analyze project dependencies',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'run_tests':
            return await this.runTests(args.command);
          case 'build_project':
            return await this.buildProject(args.command);
          case 'lint_code':
            return await this.lintCode(args.path);
          case 'analyze_dependencies':
            return await this.analyzeDependencies();
          default:
            throw new Error(\`Unknown tool: \${name}\`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: \`Error executing \${name}: \${error.message}\`
            }
          ]
        };
      }
    });
  }

  async runTests(command = 'npm test') {
    try {
      const output = execSync(command, { 
        cwd: '${repoPath}',
        encoding: 'utf8',
        timeout: 30000
      });
      
      return {
        content: [
          {
            type: 'text',
            text: \`Test execution completed:\\n\${output}\`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text', 
            text: \`Test execution failed:\\n\${error.message}\`
          }
        ]
      };
    }
  }

  async buildProject(command = 'npm run build') {
    try {
      const output = execSync(command, {
        cwd: '${repoPath}',
        encoding: 'utf8',
        timeout: 60000
      });
      
      return {
        content: [
          {
            type: 'text',
            text: \`Build completed:\\n\${output}\`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: \`Build failed:\\n\${error.message}\`
          }
        ]
      };
    }
  }

  async lintCode(targetPath = '.') {
    try {
      const output = execSync('npm run lint', {
        cwd: '${repoPath}', 
        encoding: 'utf8',
        timeout: 30000
      });
      
      return {
        content: [
          {
            type: 'text',
            text: \`Linting completed:\\n\${output}\`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: \`Linting failed:\\n\${error.message}\`
          }
        ]
      };
    }
  }

  async analyzeDependencies() {
    try {
      const packagePath = path.join('${repoPath}', 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      const analysis = {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        scripts: packageJson.scripts || {},
        engines: packageJson.engines || {}
      };
      
      return {
        content: [
          {
            type: 'text',
            text: \`Dependency analysis:\\n\${JSON.stringify(analysis, null, 2)}\`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: \`Dependency analysis failed:\\n\${error.message}\`
          }
        ]
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Project Tools MCP server running on stdio');
  }
}

const server = new ProjectToolsServer();
server.run().catch(console.error);
`;

    await fs.writeFile(serverPath, serverCode);

    // Make the server executable
    await fs.chmod(serverPath, 0o755);

    logger.info("Custom MCP server created", { serverPath });
  }

  private async createImplementationGuidelines(
    claudeDir: string,
    taskInfo: any,
  ): Promise<void> {
    const guidelinesPath = path.join(claudeDir, "implementation-guidelines.md");

    const guidelines = `# Implementation Guidelines

## Current Task
**ID**: ${taskInfo.taskId}
**Title**: ${taskInfo.title}
**Priority**: ${taskInfo.priority}

## Description
${taskInfo.description}

${
  taskInfo.acceptanceCriteria
    ? `## Acceptance Criteria
${taskInfo.acceptanceCriteria}`
    : ""
}

## Implementation Approach
1. **Analysis**: Review the existing codebase structure and patterns
2. **Planning**: Follow the detailed implementation plan provided
3. **Development**: Implement changes incrementally with proper testing
4. **Testing**: Ensure all tests pass and add new tests as needed
5. **Documentation**: Update documentation as required

## Code Quality Standards
- Follow existing code style and patterns
- Add appropriate error handling
- Include comprehensive tests
- Update documentation
- Use meaningful commit messages

## Available MCP Servers
- **filesystem**: File operations and project structure analysis
- **git**: Git operations and history analysis
- **typescript**: TypeScript/JavaScript analysis and tooling
- **database**: Database operations (if applicable)
- **web-search**: Research and documentation lookup
- **project-tools**: Custom project-specific tools

## Testing Strategy
- Run existing tests to ensure no regressions
- Add unit tests for new functionality
- Include integration tests where appropriate
- Verify edge cases and error conditions

## Deployment Considerations
- Ensure changes are backward compatible
- Consider performance implications
- Review security aspects
- Plan for rollback if needed

---
*This file is automatically generated and updated by the Autonomous Coding Agent*
`;

    await fs.writeFile(guidelinesPath, guidelines);
    logger.info("Implementation guidelines created", { guidelinesPath });
  }

  /**
   * Installs MCP dependencies in the Claude directory
   */
  async installMCPDependencies(claudeDir: string): Promise<void> {
    const mcpDir = path.join(claudeDir, "mcp-servers");

    try {
      // Check if npm is available
      const { execSync } = await import("child_process");

      logger.info("Installing MCP dependencies...", { mcpDir });

      // Install dependencies
      execSync("npm install", {
        cwd: mcpDir,
        stdio: "inherit",
        timeout: 120000, // 2 minutes
      });

      logger.info("MCP dependencies installed successfully", { mcpDir });
    } catch (error) {
      logger.warn("Failed to install MCP dependencies", {
        mcpDir,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't throw - this is not critical for the main workflow
    }
  }

  /**
   * Creates a Claude CLI compatible workspace configuration
   */
  async createClaudeCLIConfig(repoPath: string): Promise<void> {
    const configPath = path.join(repoPath, ".claude_cli_config.json");

    const config = {
      workspace: {
        root: ".",
        include: [
          "src/**/*",
          "test/**/*",
          "tests/**/*",
          "spec/**/*",
          "lib/**/*",
          "app/**/*",
          "pages/**/*",
          "components/**/*",
          "utils/**/*",
          "config/**/*",
          "*.js",
          "*.ts",
          "*.jsx",
          "*.tsx",
          "*.vue",
          "*.py",
          "*.java",
          "*.go",
          "*.rs",
          "*.php",
          "*.rb",
          "*.cs",
          "*.cpp",
          "*.c",
          "*.h",
          "*.json",
          "*.yaml",
          "*.yml",
          "*.md",
          "*.txt",
          "package.json",
          "tsconfig.json",
          "README.md",
          "Dockerfile",
          "docker-compose.yml",
        ],
        exclude: [
          "node_modules/**/*",
          "dist/**/*",
          "build/**/*",
          ".git/**/*",
          "*.log",
          "coverage/**/*",
          ".nyc_output/**/*",
        ],
      },
      mcp_servers: [
        {
          name: "filesystem",
          enabled: true,
        },
        {
          name: "git",
          enabled: true,
        },
        {
          name: "typescript",
          enabled: true,
        },
        {
          name: "project-tools",
          enabled: true,
        },
      ],
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    logger.info("Claude CLI config created", { configPath });
  }
}
