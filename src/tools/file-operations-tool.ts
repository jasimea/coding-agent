import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import { Config } from '../config/index.js';
import { createContextLogger } from '../utils/logger.js';

const logger = createContextLogger('FileOperationsTool');

// Define parameter schemas for each file operation
const readFileSchema = z.object({
  path: z.string().describe('Path to the file to read'),
  encoding: z.string().optional().default('utf8').describe('File encoding (default: utf8)'),
});

const writeFileSchema = z.object({
  path: z.string().describe('Path to the file to write'),
  content: z.string().describe('Content to write to the file'),
  encoding: z.string().optional().default('utf8').describe('File encoding (default: utf8)'),
});

const deleteFileSchema = z.object({
  path: z.string().describe('Path to the file or directory to delete'),
});

const listDirectorySchema = z.object({
  path: z.string().describe('Path to the directory to list'),
});

const createDirectorySchema = z.object({
  path: z.string().describe('Path to the directory to create'),
});

const copyFileSchema = z.object({
  source: z.string().describe('Source path'),
  destination: z.string().describe('Destination path'),
});

const moveFileSchema = z.object({
  source: z.string().describe('Source path'),
  destination: z.string().describe('Destination path'),
});

const fileExistsSchema = z.object({
  path: z.string().describe('Path to check for existence'),
});

// Utility functions
function resolvePath(inputPath: string, workingDirectory: string = process.cwd()): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(workingDirectory, inputPath);
}

function isPathSafe(fullPath: string, projectPath: string = process.cwd()): boolean {
  const resolvedPath = path.resolve(fullPath);
  const resolvedProject = path.resolve(projectPath);
  return resolvedPath.startsWith(resolvedProject);
}

// File operation tools
export const readFileTool = {
  description: 'Read the contents of a file',
  parameters: readFileSchema,
  execute: async (parameters: z.infer<typeof readFileSchema>) => {
    try {
      const fullPath = resolvePath(parameters.path);
      
      if (!isPathSafe(fullPath)) {
        throw new Error('Path is outside project directory');
      }

      const stats = await fs.stat(fullPath);
      
      if (stats.size > Config.agent.maxFileSizeMb * 1024 * 1024) {
        throw new Error(`File size exceeds maximum allowed size of ${Config.agent.maxFileSizeMb}MB`);
      }

      const content = await fs.readFile(fullPath, { encoding: parameters.encoding as BufferEncoding });
      
      logger.info('File read successfully', { path: parameters.path, size: stats.size });
      
      return {
        success: true,
        content,
        size: stats.size,
        path: fullPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to read file', { path: parameters.path, error: errorMessage });
      throw new Error(`Failed to read file: ${errorMessage}`);
    }
  },
};

export const writeFileTool = {
  description: 'Write content to a file',
  parameters: writeFileSchema,
  execute: async (parameters: z.infer<typeof writeFileSchema>) => {
    try {
      const fullPath = resolvePath(parameters.path);
      
      if (!isPathSafe(fullPath)) {
        throw new Error('Path is outside project directory');
      }

      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, parameters.content, { encoding: parameters.encoding as BufferEncoding });
      
      const stats = await fs.stat(fullPath);
      
      logger.info('File written successfully', { path: parameters.path, size: stats.size });
      
      return {
        success: true,
        path: fullPath,
        size: stats.size,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to write file', { path: parameters.path, error: errorMessage });
      throw new Error(`Failed to write file: ${errorMessage}`);
    }
  },
};

export const deleteFileTool = {
  description: 'Delete a file or directory',
  parameters: deleteFileSchema,
  execute: async (parameters: z.infer<typeof deleteFileSchema>) => {
    try {
      const fullPath = resolvePath(parameters.path);
      
      if (!isPathSafe(fullPath)) {
        throw new Error('Path is outside project directory');
      }

      await fs.remove(fullPath);
      
      logger.info('File/directory deleted successfully', { path: parameters.path });
      
      return {
        success: true,
        path: fullPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete file/directory', { path: parameters.path, error: errorMessage });
      throw new Error(`Failed to delete file/directory: ${errorMessage}`);
    }
  },
};

export const listDirectoryTool = {
  description: 'List contents of a directory',
  parameters: listDirectorySchema,
  execute: async (parameters: z.infer<typeof listDirectorySchema>) => {
    try {
      const fullPath = resolvePath(parameters.path);
      
      if (!isPathSafe(fullPath)) {
        throw new Error('Path is outside project directory');
      }

      const items = await fs.readdir(fullPath, { withFileTypes: true });
      const files = [];

      for (const item of items) {
        const itemPath = path.join(fullPath, item.name);
        try {
          const stats = await fs.stat(itemPath);
          files.push({
            name: item.name,
            path: itemPath,
            type: item.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            lastModified: stats.mtime,
            extension: path.extname(item.name),
          });
        } catch (error) {
          // Skip files that can't be accessed
          logger.warn('Could not access file', { path: itemPath, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      logger.info('Directory listed successfully', { path: parameters.path, itemCount: files.length });
      
      return {
        success: true,
        path: fullPath,
        files,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list directory', { path: parameters.path, error: errorMessage });
      throw new Error(`Failed to list directory: ${errorMessage}`);
    }
  },
};

export const createDirectoryTool = {
  description: 'Create a directory (and parent directories if needed)',
  parameters: createDirectorySchema,
  execute: async (parameters: z.infer<typeof createDirectorySchema>) => {
    try {
      const fullPath = resolvePath(parameters.path);
      
      if (!isPathSafe(fullPath)) {
        throw new Error('Path is outside project directory');
      }

      await fs.ensureDir(fullPath);
      
      logger.info('Directory created successfully', { path: parameters.path });
      
      return {
        success: true,
        path: fullPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create directory', { path: parameters.path, error: errorMessage });
      throw new Error(`Failed to create directory: ${errorMessage}`);
    }
  },
};

export const copyFileTool = {
  description: 'Copy a file or directory',
  parameters: copyFileSchema,
  execute: async (parameters: z.infer<typeof copyFileSchema>) => {
    try {
      const sourcePath = resolvePath(parameters.source);
      const destPath = resolvePath(parameters.destination);
      
      if (!isPathSafe(sourcePath) || !isPathSafe(destPath)) {
        throw new Error('Source or destination path is outside project directory');
      }

      await fs.copy(sourcePath, destPath);
      
      logger.info('File/directory copied successfully', { source: parameters.source, destination: parameters.destination });
      
      return {
        success: true,
        source: sourcePath,
        destination: destPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to copy file/directory', { source: parameters.source, destination: parameters.destination, error: errorMessage });
      throw new Error(`Failed to copy file/directory: ${errorMessage}`);
    }
  },
};

export const moveFileTool = {
  description: 'Move/rename a file or directory',
  parameters: moveFileSchema,
  execute: async (parameters: z.infer<typeof moveFileSchema>) => {
    try {
      const sourcePath = resolvePath(parameters.source);
      const destPath = resolvePath(parameters.destination);
      
      if (!isPathSafe(sourcePath) || !isPathSafe(destPath)) {
        throw new Error('Source or destination path is outside project directory');
      }

      await fs.move(sourcePath, destPath);
      
      logger.info('File/directory moved successfully', { source: parameters.source, destination: parameters.destination });
      
      return {
        success: true,
        source: sourcePath,
        destination: destPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to move file/directory', { source: parameters.source, destination: parameters.destination, error: errorMessage });
      throw new Error(`Failed to move file/directory: ${errorMessage}`);
    }
  },
};

export const fileExistsTool = {
  description: 'Check if a file or directory exists',
  parameters: fileExistsSchema,
  execute: async (parameters: z.infer<typeof fileExistsSchema>) => {
    try {
      const fullPath = resolvePath(parameters.path);
      
      if (!isPathSafe(fullPath)) {
        return {
          exists: false,
          path: fullPath,
          reason: 'Path is outside project directory',
        };
      }

      try {
        const stats = await fs.stat(fullPath);
        
        logger.info('File existence checked', { path: parameters.path, exists: true });
        
        return {
          exists: true,
          path: fullPath,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          lastModified: stats.mtime,
        };
      } catch {
        logger.info('File existence checked', { path: parameters.path, exists: false });
        
        return {
          exists: false,
          path: fullPath,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to check file existence', { path: parameters.path, error: errorMessage });
      throw new Error(`Failed to check file existence: ${errorMessage}`);
    }
  },
};
