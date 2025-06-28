# Autonomous Coding Agent

A powerful autonomous coding agent built with TypeScript, Express, and the Vercel AI SDK. This agent can perform file operations, git operations, execute system commands, and help with various software development tasks.

## 🚀 Features

- **File Operations**: Read, write, create, delete, copy, move files and directories
- **Git Operations**: Status, add, commit, push, pull, branch management, and more
- **Command Execution**: Execute system commands and scripts safely
- **Project Analysis**: Analyze project structure, detect languages, and provide insights
- **Express API**: RESTful API endpoints for integration
- **CLI Interface**: Interactive command-line interface
- **Streaming Support**: Real-time streaming responses
- **Multiple AI Providers**: Support for OpenAI, Anthropic, and Google AI
- **Security**: Rate limiting, input validation, and path safety checks
- **Comprehensive Logging**: Structured logging with Winston

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd coding-agent
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Configure your AI provider by setting one of these environment variables:
```bash
# For OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# For Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# For Google AI
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key_here
```

## 🏃‍♂️ Usage

### Starting the API Server

```bash
# Development mode with hot reload
pnpm dev

# Production mode
pnpm build
pnpm start
```

The server will start on `http://localhost:3000` by default.

### Using the CLI

```bash
# Start interactive CLI
pnpm cli
```

Example CLI interactions:
```
Agent> Create a new React component called Button
Agent> Add all files to git and commit with message 'Initial commit'
Agent> List all files in the src directory
Agent> Run npm install
Agent> analyze
Agent> help
```

### API Endpoints

#### Health Check
```bash
GET /health
```

#### Agent Information
```bash
GET /agent/info
```

#### Execute Task
```bash
POST /agent/execute
Content-Type: application/json

{
  "task": "Create a new file called hello.txt with content 'Hello World'",
  "context": {
    "workingDirectory": "/path/to/project"
  },
  "options": {
    "maxExecutionTime": 30000
  }
}
```

#### Execute Task with Streaming
```bash
POST /agent/execute/stream
Content-Type: application/json

{
  "task": "Analyze this codebase and provide suggestions"
}
```

#### Project Analysis
```bash
POST /agent/analyze
Content-Type: application/json

{
  "projectPath": "/path/to/project"
}
```

#### Get Active Tasks
```bash
GET /agent/tasks
```

#### Get Specific Task
```bash
GET /agent/tasks/:taskId
```

#### API Documentation
```bash
GET /docs
```

## 🔧 Configuration

The agent can be configured through environment variables:

### Server Configuration
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development, production, test)

### AI Provider Configuration
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key
- `GOOGLE_GENERATIVE_AI_API_KEY`: Google AI API key

### Security Configuration
- `JWT_SECRET`: JWT secret for authentication
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window

### Agent Configuration
- `MAX_EXECUTION_TIME_MS`: Maximum execution time for tasks
- `MAX_FILE_SIZE_MB`: Maximum file size for operations
- `ALLOWED_FILE_EXTENSIONS`: Comma-separated list of allowed file extensions

### Git Configuration
- `DEFAULT_GIT_BRANCH`: Default git branch name
- `GIT_TIMEOUT_MS`: Git operation timeout

### Logging Configuration
- `LOG_LEVEL`: Logging level (error, warn, info, debug)
- `LOG_FILE`: Log file path

## 🛡️ Security Features

### Path Safety
- All file operations are restricted to the project directory
- Path traversal attacks are prevented
- Absolute paths are resolved and validated

### Command Safety
- Dangerous commands are blocked
- Restricted system paths are protected
- Environment variables are sanitized

### Rate Limiting
- API endpoints are rate-limited
- Configurable limits per IP address
- Proper HTTP headers for rate limit information

### Input Validation
- All API inputs are validated using Zod schemas
- Proper error handling and sanitization
- Size limits on file operations

## 🔨 Available Tools

### File Operations
- `read_file`: Read file contents
- `write_file`: Write content to a file
- `delete_file`: Delete files or directories
- `list_directory`: List directory contents
- `create_directory`: Create directories
- `copy_file`: Copy files or directories
- `move_file`: Move/rename files or directories
- `file_exists`: Check if file exists

### Git Operations
- `git_status`: Get repository status
- `git_add`: Add files to staging area
- `git_commit`: Commit changes
- `git_push`: Push to remote repository
- `git_pull`: Pull from remote repository
- `git_branch`: Branch management (list, create, switch, delete)
- `git_log`: Show commit history
- `git_diff`: Show differences
- `git_init`: Initialize repository
- `git_clone`: Clone repository

### Command Execution
- `execute_command`: Execute system commands
- `execute_script`: Execute scripts with interpreters
- `npm_install`: Install npm packages
- `build_project`: Build the project
- `run_tests`: Run project tests

## 📝 Example Tasks

### File Management
```
"Create a new TypeScript file called utils.ts with helper functions"
"Read the contents of package.json"
"List all JavaScript files in the src directory"
"Copy all files from src to backup folder"
```

### Git Operations
```
"Show git status"
"Add all changes and commit with message 'Update documentation'"
"Create a new branch called feature/auth"
"Push changes to origin main"
"Show the last 5 commits"
```

### Development Tasks
```
"Install express and @types/express as dependencies"
"Run the build script"
"Execute npm test"
"Analyze the project structure and dependencies"
```

### Complex Tasks
```
"Create a new Express route for user authentication, add it to git, and commit the changes"
"Set up a new React component with TypeScript, add proper styling, and create tests"
"Initialize a new git repository, create a basic README, and make the initial commit"
```

## 🧪 Development

### Running Tests
```bash
pnpm test
```

### Linting
```bash
pnpm lint
```

### Formatting
```bash
pnpm format
```

### Building
```bash
pnpm build
```

## 📖 API Documentation

Once the server is running, visit `http://localhost:3000/docs` for complete API documentation including:
- Available endpoints
- Request/response schemas
- Example requests
- Error codes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🔮 Roadmap

- [ ] Web UI interface
- [ ] Plugin system for custom tools
- [ ] Database integration
- [ ] Multi-language support
- [ ] Docker containerization
- [ ] Kubernetes deployment
- [ ] Advanced security features
- [ ] Performance monitoring
- [ ] Code generation templates
- [ ] Integration with popular IDEs

## 🐛 Troubleshooting

### Common Issues

**API Key Not Found**
- Make sure you've set the appropriate AI provider API key in your `.env` file
- Verify the environment variable name matches the provider you want to use

**Permission Denied**
- Check file permissions in your project directory
- Ensure the agent has read/write access to necessary files
- Verify git repository permissions for git operations

**Rate Limit Exceeded**
- Wait for the rate limit window to reset
- Adjust rate limit configuration if needed
- Consider implementing authentication for higher limits

**Command Execution Failed**
- Verify the command exists and is accessible
- Check working directory and environment variables
- Review security restrictions for dangerous commands

### Debug Mode

Set `LOG_LEVEL=debug` in your environment to enable detailed logging for troubleshooting.

## 📧 Support

For issues, questions, or contributions, please create an issue in the repository or contact the maintainers.
