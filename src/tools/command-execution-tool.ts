import { z } from 'zod';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { Config } from '../config/index.js';
import { createContextLogger } from '../utils/logger.js';
import path from 'path';

const logger = createContextLogger('CommandExecutionTool');
const execPromise = promisify(exec);

// Command execution schemas
const executeCommandSchema = z.object({
  command: z.string().describe('Command to execute'),
  args: z.array(z.string()).optional().describe('Command arguments'),
  workingDirectory: z.string().optional().describe('Working directory for command execution'),
  timeout: z.number().optional().default(Config.agent.maxExecutionTimeMs).describe('Command timeout in milliseconds'),
  shell: z.boolean().optional().default(true).describe('Execute in shell'),
  env: z.record(z.string()).optional().describe('Environment variables'),
});

const executeScriptSchema = z.object({
  script: z.string().describe('Script content to execute'),
  interpreter: z.string().optional().default('bash').describe('Script interpreter (bash, sh, python, node, etc.)'),
  workingDirectory: z.string().optional().describe('Working directory for script execution'),
  timeout: z.number().optional().default(Config.agent.maxExecutionTimeMs).describe('Script timeout in milliseconds'),
  env: z.record(z.string()).optional().describe('Environment variables'),
});

// Security checks
const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'rm -rf *',
  'del /s /q',
  'format',
  'mkfs',
  'dd if=',
  'sudo rm',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  '> /dev/',
  'chmod 777',
  'chown -R',
];

const RESTRICTED_PATHS = [
  '/etc',
  '/bin',
  '/sbin',
  '/usr/bin',
  '/usr/sbin',
  '/boot',
  '/sys',
  '/proc',
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\System32',
];

function isDangerousCommand(command: string): boolean {
  const cmd = command.toLowerCase().trim();
  return DANGEROUS_COMMANDS.some(dangerous => cmd.includes(dangerous.toLowerCase()));
}

function isRestrictedPath(workingDir: string): boolean {
  const dir = path.resolve(workingDir).toLowerCase();
  return RESTRICTED_PATHS.some(restricted => dir.startsWith(restricted.toLowerCase()));
}

function sanitizeEnvironment(env?: Record<string, string>): Record<string, string> {
  const safeEnv: Record<string, string> = {};
  
  // Copy safe environment variables from process.env
  const allowedFromProcess = ['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'NODE_ENV'];
  for (const key of allowedFromProcess) {
    const value = process.env[key];
    if (value) {
      safeEnv[key] = value;
    }
  }
  
  if (env) {
    // Only allow safe environment variables
    const allowedPrefixes = ['NODE_', 'NPM_', 'PNPM_', 'YARN_'];
    const allowedKeys = ['PWD', 'OLDPWD', 'TERM', 'SHELL'];
    
    for (const [key, value] of Object.entries(env)) {
      if (allowedPrefixes.some(prefix => key.startsWith(prefix)) || allowedKeys.includes(key)) {
        safeEnv[key] = value;
      }
    }
  }
  
  return safeEnv;
}

// Command execution tools
export const executeCommandTool = {
  description: 'Execute a system command with arguments and return the output',
  parameters: executeCommandSchema,
  execute: async (parameters: z.infer<typeof executeCommandSchema>) => {
    try {
      const workingDir = parameters.workingDirectory || process.cwd();
      
      // Security checks
      if (isDangerousCommand(parameters.command)) {
        throw new Error('Command contains potentially dangerous operations and is blocked');
      }
      
      if (isRestrictedPath(workingDir)) {
        throw new Error('Working directory is in a restricted path');
      }

      logger.info('Executing command', { 
        command: parameters.command, 
        args: parameters.args,
        workingDirectory: workingDir 
      });

      const startTime = Date.now();
      
      let fullCommand: string;
      if (parameters.args && parameters.args.length > 0) {
        fullCommand = `${parameters.command} ${parameters.args.join(' ')}`;
      } else {
        fullCommand = parameters.command;
      }

      const { stdout, stderr } = await execPromise(fullCommand, {
        cwd: workingDir,
        timeout: parameters.timeout,
        env: sanitizeEnvironment(parameters.env),
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      const executionTime = Date.now() - startTime;
      
      logger.info('Command executed successfully', { 
        command: parameters.command,
        executionTime,
        stdoutLength: stdout.length,
        stderrLength: stderr.length
      });

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        executionTime,
        command: fullCommand,
        workingDirectory: workingDir,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      const exitCode = error.code || 1;
      
      logger.error('Command execution failed', { 
        command: parameters.command,
        error: errorMessage,
        exitCode 
      });

      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || errorMessage,
        exitCode,
        executionTime: 0,
        command: parameters.command,
        workingDirectory: parameters.workingDirectory || process.cwd(),
        error: errorMessage,
      };
    }
  },
};

export const executeScriptTool = {
  description: 'Execute a script with specified interpreter (bash, python, node, etc.)',
  parameters: executeScriptSchema,
  execute: async (parameters: z.infer<typeof executeScriptSchema>) => {
    try {
      const workingDir = parameters.workingDirectory || process.cwd();
      
      // Security checks
      if (isDangerousCommand(parameters.script)) {
        throw new Error('Script contains potentially dangerous operations and is blocked');
      }
      
      if (isRestrictedPath(workingDir)) {
        throw new Error('Working directory is in a restricted path');
      }

      logger.info('Executing script', { 
        interpreter: parameters.interpreter,
        workingDirectory: workingDir,
        scriptLength: parameters.script.length
      });

      const startTime = Date.now();
      
      let command: string;
      const args: string[] = [];

      switch (parameters.interpreter) {
        case 'bash':
        case 'sh':
          command = parameters.interpreter;
          args.push('-c', parameters.script);
          break;
        case 'python':
        case 'python3':
          command = parameters.interpreter;
          args.push('-c', parameters.script);
          break;
        case 'node':
          command = 'node';
          args.push('-e', parameters.script);
          break;
        case 'powershell':
          command = 'powershell';
          args.push('-Command', parameters.script);
          break;
        default:
          throw new Error(`Unsupported interpreter: ${parameters.interpreter}`);
      }

      const result = await new Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
      }>((resolve, reject) => {
        const child = spawn(command, args, {
          cwd: workingDir,
          env: sanitizeEnvironment(parameters.env),
          stdio: 'pipe',
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Script execution timed out after ${parameters.timeout}ms`));
        }, parameters.timeout);

        child.on('close', (code) => {
          clearTimeout(timeout);
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code || 0,
          });
        });

        child.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      const executionTime = Date.now() - startTime;
      
      logger.info('Script executed successfully', { 
        interpreter: parameters.interpreter,
        executionTime,
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stderrLength: result.stderr.length
      });

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTime,
        interpreter: parameters.interpreter,
        workingDirectory: workingDir,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      
      logger.error('Script execution failed', { 
        interpreter: parameters.interpreter,
        error: errorMessage
      });

      return {
        success: false,
        stdout: '',
        stderr: errorMessage,
        exitCode: 1,
        executionTime: 0,
        interpreter: parameters.interpreter,
        workingDirectory: parameters.workingDirectory || process.cwd(),
        error: errorMessage,
      };
    }
  },
};

// Define schemas for utility tools
const npmInstallSchema = z.object({
  packages: z.array(z.string()).optional().describe('Packages to install (if empty, installs from package.json)'),
  dev: z.boolean().optional().default(false).describe('Install as dev dependencies'),
  workingDirectory: z.string().optional().describe('Working directory'),
});

const buildProjectSchema = z.object({
  script: z.string().optional().default('build').describe('Build script name'),
  workingDirectory: z.string().optional().describe('Working directory'),
});

const runTestsSchema = z.object({
  script: z.string().optional().default('test').describe('Test script name'),
  workingDirectory: z.string().optional().describe('Working directory'),
});

// Utility tools for common operations
export const npmInstallTool = {
  description: 'Install npm packages',
  parameters: npmInstallSchema,
  execute: async (parameters: z.infer<typeof npmInstallSchema>) => {
    const command = 'npm';
    const args = ['install'];
    
    if (parameters.dev) {
      args.push('--save-dev');
    }
    
    if (parameters.packages && parameters.packages.length > 0) {
      args.push(...parameters.packages);
    }

    return executeCommandTool.execute({
      command,
      args,
      workingDirectory: parameters.workingDirectory,
      timeout: Config.agent.maxExecutionTimeMs,
      shell: true,
    });
  },
};

export const buildProjectTool = {
  description: 'Build the project using npm build script',
  parameters: buildProjectSchema,
  execute: async (parameters: z.infer<typeof buildProjectSchema>) => {
    return executeCommandTool.execute({
      command: 'npm',
      args: ['run', parameters.script || 'build'],
      workingDirectory: parameters.workingDirectory,
      timeout: Config.agent.maxExecutionTimeMs,
      shell: true,
    });
  },
};

export const runTestsTool = {
  description: 'Run project tests',
  parameters: runTestsSchema,
  execute: async (parameters: z.infer<typeof runTestsSchema>) => {
    return executeCommandTool.execute({
      command: 'npm',
      args: ['run', parameters.script || 'test'],
      workingDirectory: parameters.workingDirectory,
      timeout: Config.agent.maxExecutionTimeMs,
      shell: true,
    });
  },
};
