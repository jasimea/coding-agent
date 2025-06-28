import { tool } from 'ai';
import {
  readFileTool,
  writeFileTool,
  deleteFileTool,
  listDirectoryTool,
  createDirectoryTool,
  copyFileTool,
  moveFileTool,
  fileExistsTool,
} from './file-operations-tool.js';
import {
  gitStatusTool,
  gitAddTool,
  gitCommitTool,
  gitPushTool,
  gitPullTool,
  gitBranchTool,
  gitLogTool,
  gitDiffTool,
  gitInitTool,
  gitCloneTool,
} from './git-operations-tool.js';
import {
  executeCommandTool,
  executeScriptTool,
  npmInstallTool,
  buildProjectTool,
  runTestsTool,
} from './command-execution-tool.js';

// Convert our custom tools to Vercel AI SDK format
export const tools = {
  // File Operations
  read_file: tool({
    description: readFileTool.description,
    parameters: readFileTool.parameters,
    execute: readFileTool.execute,
  }),
  
  write_file: tool({
    description: writeFileTool.description,
    parameters: writeFileTool.parameters,
    execute: writeFileTool.execute,
  }),
  
  delete_file: tool({
    description: deleteFileTool.description,
    parameters: deleteFileTool.parameters,
    execute: deleteFileTool.execute,
  }),
  
  list_directory: tool({
    description: listDirectoryTool.description,
    parameters: listDirectoryTool.parameters,
    execute: listDirectoryTool.execute,
  }),
  
  create_directory: tool({
    description: createDirectoryTool.description,
    parameters: createDirectoryTool.parameters,
    execute: createDirectoryTool.execute,
  }),
  
  copy_file: tool({
    description: copyFileTool.description,
    parameters: copyFileTool.parameters,
    execute: copyFileTool.execute,
  }),
  
  move_file: tool({
    description: moveFileTool.description,
    parameters: moveFileTool.parameters,
    execute: moveFileTool.execute,
  }),
  
  file_exists: tool({
    description: fileExistsTool.description,
    parameters: fileExistsTool.parameters,
    execute: fileExistsTool.execute,
  }),

  // Git Operations
  git_status: tool({
    description: gitStatusTool.description,
    parameters: gitStatusTool.parameters,
    execute: gitStatusTool.execute,
  }),
  
  git_add: tool({
    description: gitAddTool.description,
    parameters: gitAddTool.parameters,
    execute: gitAddTool.execute,
  }),
  
  git_commit: tool({
    description: gitCommitTool.description,
    parameters: gitCommitTool.parameters,
    execute: gitCommitTool.execute,
  }),
  
  git_push: tool({
    description: gitPushTool.description,
    parameters: gitPushTool.parameters,
    execute: gitPushTool.execute,
  }),
  
  git_pull: tool({
    description: gitPullTool.description,
    parameters: gitPullTool.parameters,
    execute: gitPullTool.execute,
  }),
  
  git_branch: tool({
    description: gitBranchTool.description,
    parameters: gitBranchTool.parameters,
    execute: gitBranchTool.execute,
  }),
  
  git_log: tool({
    description: gitLogTool.description,
    parameters: gitLogTool.parameters,
    execute: gitLogTool.execute,
  }),
  
  git_diff: tool({
    description: gitDiffTool.description,
    parameters: gitDiffTool.parameters,
    execute: gitDiffTool.execute,
  }),
  
  git_init: tool({
    description: gitInitTool.description,
    parameters: gitInitTool.parameters,
    execute: gitInitTool.execute,
  }),
  
  git_clone: tool({
    description: gitCloneTool.description,
    parameters: gitCloneTool.parameters,
    execute: gitCloneTool.execute,
  }),

  // Command Execution
  execute_command: tool({
    description: executeCommandTool.description,
    parameters: executeCommandTool.parameters,
    execute: executeCommandTool.execute,
  }),
  
  execute_script: tool({
    description: executeScriptTool.description,
    parameters: executeScriptTool.parameters,
    execute: executeScriptTool.execute,
  }),

  // Utility Tools
  npm_install: tool({
    description: npmInstallTool.description,
    parameters: npmInstallTool.parameters,
    execute: npmInstallTool.execute,
  }),
  
  build_project: tool({
    description: buildProjectTool.description,
    parameters: buildProjectTool.parameters,
    execute: buildProjectTool.execute,
  }),
  
  run_tests: tool({
    description: runTestsTool.description,
    parameters: runTestsTool.parameters,
    execute: runTestsTool.execute,
  }),
};

// Export tool names for easier reference
export const toolNames = Object.keys(tools) as Array<keyof typeof tools>;
