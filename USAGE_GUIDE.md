# Usage Guide: Coding Agent

This guide provides comprehensive instructions for using the Coding Agent both as an API server and through the CLI interface.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [API Server Usage](#api-server-usage)
- [CLI Usage](#cli-usage)
- [Configuration](#configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### Required Setup

1. **Node.js**: Version 18+ required
2. **Git Repository**: Must be initialized with GitHub remote
3. **API Keys**: At least one AI provider API key
4. **GitHub Token**: For automated PR creation (optional but recommended)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd coding-agent

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Variables

```bash
# AI Provider (choose at least one)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key

# GitHub Integration (optional)
GITHUB_TOKEN=your_github_personal_access_token

# Server Configuration (optional)
PORT=3000
NODE_ENV=development
```

## 🌐 API Server Usage

### Starting the Server

```bash
# Development mode (with hot reload)
pnpm dev

# Production mode
pnpm build
pnpm start
```

The server will start on `http://localhost:3000` (or your configured port).

### Available Endpoints

#### Health Check
```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-28T10:30:00Z",
  "version": "1.0.0"
}
```

#### Get Agent Information
```bash
GET /agent/info
```

**Response:**
```json
{
  "version": "1.0.0",
  "capabilities": ["file_operations", "git_operations", "github_operations", "command_execution"],
  "context": {
    "workingDirectory": "/path/to/project",
    "projectPath": "/path/to/project"
  }
}
```

#### Execute Task
```bash
POST /agent/execute
Content-Type: application/json

{
  "task": "Create a utility function for string validation",
  "context": {
    "workingDirectory": "/optional/working/directory"
  },
  "options": {
    "maxExecutionTime": 300000,
    "allowDangerousCommands": false
  }
}
```

**Response:**
```json
{
  "taskId": "uuid-task-id",
  "status": "completed",
  "result": "Plan executed successfully. Created utility function with tests. Pull request created: https://github.com/owner/repo/pull/123",
  "executionTime": 45000,
  "steps": [
    {
      "tool": "git_branch",
      "action": "create",
      "input": {"branchName": "task-1703567890123"},
      "output": {"success": true},
      "timestamp": "2025-06-28T10:30:00Z",
      "duration": 1500
    }
  ],
  "plan": {
    "id": "plan-uuid",
    "branchName": "task-1703567890123",
    "prUrl": "https://github.com/owner/repo/pull/123",
    "prNumber": 123,
    "summary": "Create utility function with validation and tests"
  }
}
```

#### Execute Task with Streaming
```bash
POST /agent/execute/stream
Content-Type: application/json

{
  "task": "Implement user authentication with JWT",
  "context": {
    "workingDirectory": "/path/to/project"
  }
}
```

**Response:** Server-Sent Events (SSE) stream with real-time updates.

#### Project Analysis
```bash
POST /agent/analyze
Content-Type: application/json

{
  "projectPath": "/path/to/project"
}
```

**Response:**
```json
{
  "projectPath": "/path/to/project",
  "packageInfo": {
    "name": "my-project",
    "version": "1.0.0",
    "dependencies": {...}
  },
  "gitInfo": {
    "isGitRepo": true,
    "branch": "main"
  },
  "languages": ["TypeScript", "JavaScript"],
  "projectStructure": [...]
}
```

#### Get Tasks
```bash
GET /agent/tasks
```

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-uuid",
      "status": "completed",
      "description": "Create utility function",
      "createdAt": "2025-06-28T10:30:00Z"
    }
  ]
}
```

#### Get Specific Task
```bash
GET /agent/tasks/:taskId
```

### cURL Examples

#### Simple Task Execution
```bash
curl -X POST http://localhost:3000/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a README file with project documentation"
  }'
```

#### Complex Task with Options
```bash
curl -X POST http://localhost:3000/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Implement error handling middleware for Express app with logging",
    "options": {
      "maxExecutionTime": 600000
    }
  }'
```

#### Streaming Execution
```bash
curl -N -X POST http://localhost:3000/agent/execute/stream \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Set up unit tests with Jest and create test files for existing modules"
  }'
```

## 💻 CLI Usage

### Starting the CLI

```bash
# Using npm script
pnpm cli

# Direct execution
npx tsx src/cli/index.ts
```

### CLI Commands

#### Interactive Mode
When you start the CLI, you enter interactive mode:

```
🤖 Coding Agent CLI
====================
Type your tasks and I'll help you with coding, git operations, file management, and more!
Type "exit" to quit, "help" for commands, or "analyze" to analyze the current project.

Working Directory: /path/to/project
Project Path: /path/to/project

Agent> 
```

#### Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `help` | Show available commands | `help` |
| `exit` or `quit` | Exit the CLI | `exit` |
| `analyze` | Analyze current project | `analyze` |
| `clear` | Clear the screen | `clear` |
| `context` | Show current context | `context` |

#### Task Execution
Simply type your task in natural language:

```
Agent> Create a new React component for user profile with TypeScript

🔍 Analyzing task...
📋 Creating execution plan...
🌿 Creating feature branch: task-1703567890123
⚡ Executing task steps...
✅ Task completed successfully!
🔀 Pull request created: https://github.com/owner/repo/pull/123
```

### CLI Examples

#### File Operations
```
Agent> Create a new TypeScript file called utils.ts with helper functions for string manipulation

Agent> Read the contents of package.json and show me the dependencies

Agent> Copy all files from src/components to backup/components
```

#### Git Operations
```
Agent> Show current git status

Agent> Create a new branch called feature/user-auth and switch to it

Agent> Commit all changes with message "Add user authentication feature"
```

#### Development Tasks
```
Agent> Install express and @types/express as dependencies

Agent> Create a new Express route for handling user registration

Agent> Run the test suite and show me the results
```

#### Complex Workflows
```
Agent> Set up a new React component with TypeScript, add proper styling with CSS modules, create unit tests, and submit for code review

Agent> Implement JWT authentication middleware, add proper error handling, create documentation, and create a pull request
```

### CLI Features

#### Auto-completion
The CLI provides context-aware suggestions for common tasks.

#### History
Use arrow keys to navigate through command history.

#### Progress Tracking
Real-time progress updates during task execution:
- 🔍 Analysis phase
- 📋 Planning phase  
- 🌿 Git setup
- ⚡ Execution
- ✅ Completion
- 🔀 PR creation

## ⚙️ Configuration

### Server Configuration

```bash
# .env file
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
JWT_SECRET=your-secret-key

# Agent behavior
MAX_EXECUTION_TIME_MS=300000
MAX_FILE_SIZE_MB=10
```

### GitHub Integration Setup

1. **Create GitHub Personal Access Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate new token with `repo` scope
   - Copy the token

2. **Configure Environment:**
   ```bash
   GITHUB_TOKEN=ghp_your_token_here
   ```

3. **Verify Setup:**
   ```bash
   # Test API endpoint
   curl http://localhost:3000/agent/info
   
   # Or use CLI
   pnpm cli
   Agent> analyze
   ```

## 🎯 Examples

### Example 1: Creating a New Feature

**Task:** "Create a new user service with CRUD operations, add proper TypeScript types, write unit tests, and create documentation"

**API Request:**
```bash
curl -X POST http://localhost:3000/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a new user service with CRUD operations, add proper TypeScript types, write unit tests, and create documentation"
  }'
```

**CLI Command:**
```
Agent> Create a new user service with CRUD operations, add proper TypeScript types, write unit tests, and create documentation
```

**Expected Workflow:**
1. Creates feature branch `task-1703567890123`
2. Creates `src/services/userService.ts` with CRUD operations
3. Creates `src/types/user.ts` with TypeScript interfaces
4. Creates `tests/userService.test.ts` with unit tests
5. Creates/updates documentation
6. Commits changes with descriptive message
7. Creates pull request

### Example 2: Bug Fix Workflow

**Task:** "Fix the memory leak in the WebSocket connection handler and add proper cleanup"

**API Request:**
```bash
curl -X POST http://localhost:3000/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Fix the memory leak in the WebSocket connection handler and add proper cleanup"
  }'
```

**Expected Workflow:**
1. Creates bugfix branch
2. Analyzes existing WebSocket code
3. Identifies and fixes memory leak
4. Adds proper cleanup mechanisms
5. Updates tests if needed
6. Creates pull request with detailed description

### Example 3: Project Setup

**Task:** "Initialize ESLint and Prettier configuration for this TypeScript project"

**CLI Command:**
```
Agent> Initialize ESLint and Prettier configuration for this TypeScript project
```

**Expected Workflow:**
1. Creates configuration branch
2. Installs ESLint and Prettier dependencies
3. Creates `.eslintrc.js` configuration
4. Creates `.prettierrc` configuration
5. Updates package.json scripts
6. Formats existing code
7. Creates pull request

## 🚨 Troubleshooting

### Common Issues

#### API Key Not Found
```
Error: No AI provider API key found
```

**Solution:**
```bash
# Check your .env file
cat .env | grep API_KEY

# Set the appropriate key
echo "OPENAI_API_KEY=your_key_here" >> .env
```

#### GitHub Token Issues
```
Error: GitHub token is required for PR creation
```

**Solution:**
```bash
# Set GitHub token
echo "GITHUB_TOKEN=ghp_your_token_here" >> .env

# Verify token has correct permissions (repo scope)
curl -H "Authorization: token ghp_your_token_here" https://api.github.com/user
```

#### Git Repository Not Found
```
Error: Current directory is not a Git repository
```

**Solution:**
```bash
# Initialize git repository
git init

# Add GitHub remote
git remote add origin https://github.com/your-username/your-repo.git
```

#### Permission Denied
```
Error: EACCES: permission denied
```

**Solution:**
```bash
# Check file permissions
ls -la

# Fix permissions if needed
chmod 755 .
sudo chown -R $USER:$USER .
```

#### Port Already in Use
```
Error: EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Use different port
PORT=3001 pnpm dev

# Or kill existing process
lsof -ti:3000 | xargs kill -9
```

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug pnpm dev
```

### Getting Help

1. **CLI Help:** Type `help` in the CLI
2. **API Documentation:** Visit `http://localhost:3000/docs`
3. **Health Check:** Visit `http://localhost:3000/health`
4. **Logs:** Check `logs/agent.log` for detailed logs

### Performance Tips

1. **Use Streaming:** For long-running tasks, use the streaming endpoint
2. **Set Timeouts:** Configure appropriate timeouts for your tasks
3. **Monitor Resources:** Check system resources for large operations
4. **Batch Operations:** Group related tasks when possible

---

This usage guide should help you get started with both API and CLI interfaces. For more advanced usage and customization, refer to the source code and configuration files.
