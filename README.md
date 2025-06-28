# 🤖 Autonomous Coding Agent with Webhook Integration

An intelligent coding agent that automatically implements code changes when JIRA issues or Trello cards are moved to development status. The agent uses Claude AI to analyze requirements, generate implementation plans, write code, and create pull requests.

## ✨ Features

### Core Capabilities
- **🎯 Advanced Planning System**: Generates comprehensive implementation plans using Claude AI
- **📡 Webhook Integration**: Responds to JIRA and Trello status changes automatically  
- **🔄 Git Automation**: Clones repositories, creates branches, commits changes, and creates PRs
- **🧪 Test Strategy Generation**: Creates comprehensive testing plans and implementations
- **⚠️ Risk Assessment**: Analyzes potential risks and provides mitigation strategies
- **📊 Real-time Monitoring**: Track task progress and status through API endpoints

### Webhook Triggers
- **JIRA**: Issue status changes to development states (In Progress, Development, etc.)
- **Trello**: Card moves to development lists (To Do, In Progress, Development, etc.)

### Supported Platforms
- **Git**: GitHub, GitLab (with automatic PR/MR creation)
- **Languages**: TypeScript, JavaScript, Python, Java, Go, Rust, PHP, Ruby, C++, and more
- **Frameworks**: React, Vue, Angular, Next.js, Express, Django, Spring Boot, etc.

## 🚀 Quick Start

### Local Development

```bash
# Clone the repository
git clone <your-repo-url>
cd coding-agent

# Install dependencies
pnpm install

# Set up environment variables
cp env.example .env
# Edit .env with your API keys

# Start development server
pnpm run dev
```

### VPS Deployment

For production deployment on a VPS with automatic webhook processing:

```bash
# Download and run deployment script
curl -sSL https://raw.githubusercontent.com/your-org/coding-agent/main/deploy.sh | bash

# Or manual deployment
git clone <your-repo-url> coding-agent
cd coding-agent
chmod +x deploy.sh
./deploy.sh
```

See [VPS_DEPLOYMENT.md](docs/VPS_DEPLOYMENT.md) for detailed deployment instructions.

## 🔧 Configuration

### Required Environment Variables

```env
# Required: Anthropic API Key for Claude
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Required: GitHub Token for creating PRs
GITHUB_TOKEN=ghp_xxxxx

# Optional: GitLab Token
GITLAB_TOKEN=glpat-xxxxx

# Optional: Webhook Security
WEBHOOK_SECRET=your-secure-secret

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

### Repository Requirements

For the agent to work with your repositories, include the repository URL in:

**JIRA Issues:**
```
Repository: https://github.com/your-org/your-repo

## Requirements
- Implement feature X
- Add proper error handling
- Include unit tests

## Acceptance Criteria
- [ ] Feature works as expected
- [ ] Tests pass
- [ ] Documentation updated
```

**Trello Cards:**
```
Repository: https://github.com/your-org/your-repo

Implement new user authentication system with JWT tokens
```

## 📡 API Endpoints

### Webhook Endpoints
- `POST /webhook/jira` - Receives JIRA webhooks
- `POST /webhook/trello` - Receives Trello webhooks

### Management API
- `GET /health` - Health check
- `GET /api/tasks/:taskId/status` - Get task processing status
- `POST /api/tasks/trigger` - Manually trigger task processing

### Example Usage

```bash
# Manual task trigger
curl -X POST https://your-domain.com/api/tasks/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryUrl": "https://github.com/your-org/your-repo",
    "taskData": {
      "taskId": "TASK-001",
      "title": "Add user authentication",
      "description": "Implement JWT-based authentication system",
      "priority": "High",
      "acceptanceCriteria": "Users can login and logout securely"
    }
  }'

# Check task status
curl https://your-domain.com/api/tasks/TASK-001/status
```

## 🖥️ CLI Tool - Local Testing

For local development and testing, use the built-in CLI tool to process tasks against any GitHub repository without setting up webhooks.

### Installation & Setup

```bash
# Ensure environment variables are set
cp env.example .env
# Edit .env with ANTHROPIC_API_KEY and GITHUB_TOKEN

# Build the project (required for CLI)
pnpm build
```

### CLI Commands

#### Process a Custom Task
Process any task against a GitHub repository:

```bash
pnpm cli process \
  --repository "https://github.com/owner/repo" \
  --task-id "LOCAL-001" \
  --title "Add dark mode toggle" \
  --description "Implement a dark mode toggle button in the header that persists user preference" \
  --priority "Medium" \
  --criteria "Toggle works, preference saved, applies across pages"
```

#### Process a GitHub Issue
Automatically fetch and process a GitHub issue:

```bash
pnpm cli issue \
  --repository "https://github.com/owner/repo" \
  --number 42
```

This command will:
1. Fetch issue details from GitHub API
2. Extract title, description, labels, and acceptance criteria
3. Process the issue as a task
4. Monitor progress in real-time

#### List Active Tasks
View all currently running tasks:

```bash
pnpm cli list
```

#### Check Task Status
Monitor a specific task:

```bash
pnpm cli status --task-id "LOCAL-001"
```

### CLI Examples

#### Example 1: Fix a Bug in a React App
```bash
pnpm cli process \
  --repository "https://github.com/myorg/react-app" \
  --task-id "BUG-001" \
  --title "Fix login form validation" \
  --description "The login form is not validating email format properly. It should show an error for invalid emails." \
  --priority "High" \
  --labels "bug,frontend"
```

#### Example 2: Add a New Feature
```bash
pnpm cli process \
  --repository "https://github.com/myorg/api-server" \
  --task-id "FEAT-001" \
  --title "Add user profile endpoints" \
  --description "Add CRUD endpoints for user profiles with proper authentication" \
  --criteria "GET, POST, PUT, DELETE /api/profile endpoints with JWT auth"
```

#### Example 3: Process an Existing GitHub Issue
```bash
pnpm cli issue \
  --repository "https://github.com/facebook/react" \
  --number 1234
```

### CLI Progress Monitoring

The CLI provides real-time progress updates:

```
🤖 Autonomous Coding Agent - Local Testing
==========================================

📋 Task Details:
  Repository: https://github.com/myorg/my-app
  Task ID: LOCAL-001
  Title: Add dark mode toggle
  Description: Implement a dark mode toggle...
  Priority: Medium

🚀 Starting task processing...
✅ Task processing started with ID: uuid-12345

📊 Monitoring task progress...
Press Ctrl+C to stop monitoring

⏳ [2.1s] Cloning repository...
📋 [8.3s] Analyzing codebase and generating plan...
📝 [12.7s] Creating feature branch: feature/LOCAL-001-add-dark-mode-toggle
📝 [15.2s] Created pull request: #123
📝 [16.1s] Posted detailed planning comment
⚡ [18.5s] Starting implementation...
⚡ [45.2s] Implementing dark mode toggle component...
⚡ [67.8s] Adding persistence logic...
⚡ [89.1s] Updating theme context...
✅ [92.4s] Implementation completed!

🎉 Task completed successfully!
📖 Review the implementation: https://github.com/myorg/my-app/pull/123
🌿 Branch created: feature/LOCAL-001-add-dark-mode-toggle
⏱️  Total time: 92.4s
```

### CLI vs Webhook Processing

| Feature | CLI | Webhook |
|---------|-----|---------|
| **Trigger** | Manual command | Automatic (JIRA/Trello) |
| **Use Case** | Testing, development | Production automation |
| **Repository** | Any GitHub repo | Must be specified in issue/card |
| **Monitoring** | Real-time in terminal | API endpoints + logs |
| **Task Source** | Custom or GitHub issues | JIRA issues or Trello cards |

### CLI Configuration

Environment variables required for CLI:

```env
# Required for code generation
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Required for GitHub operations
GITHUB_TOKEN=ghp_xxxxx

# Optional: For GitLab repositories
GITLAB_TOKEN=glpat-xxxxx
```

## 🔄 Workflow

### Automatic Processing Flow

1. **Webhook Trigger**: JIRA/Trello status change detected
2. **Repository Clone**: Agent clones the specified repository
3. **Analysis**: Analyzes codebase structure and dependencies
4. **Planning**: Generates comprehensive implementation plan using Claude
5. **Implementation**: Executes the plan (integrates with Claude Code API)
6. **Branch Creation**: Creates feature branch with descriptive name
7. **Code Changes**: Implements required changes and tests
8. **Commit**: Commits changes with detailed commit message
9. **Pull Request**: Creates PR with implementation details and testing notes

### Manual Testing

```bash
# Test webhook endpoints
curl -X POST http://localhost:3000/webhook/jira \
  -H "Content-Type: application/json" \
  -d @test-data/jira-webhook.json

# Monitor processing
docker-compose logs -f coding-agent
```

## 🛡️ Security Features

- **Webhook Validation**: Cryptographic signature verification
- **Rate Limiting**: Prevents abuse with configurable limits
- **CORS Protection**: Restricts cross-origin requests
- **SSL/TLS**: HTTPS-only in production
- **Input Sanitization**: Validates all webhook payloads
- **Token Security**: Secure storage and handling of API tokens

## 📊 Monitoring & Logging

### Log Files
- `logs/webhook.log` - Webhook processing logs
- `logs/task-processor.log` - Task execution logs  
- `logs/application.log` - General application logs

### Monitoring Commands
```bash
# Real-time logs
docker-compose logs -f coding-agent

# Health check
curl http://localhost:3000/health

# Task status monitoring
curl http://localhost:3000/api/tasks/{taskId}/status
```

### Metrics & Alerts
- Response times for webhook processing
- Success/failure rates for task completion
- Repository clone and PR creation rates
- Claude API usage and rate limiting

## 🧪 Testing

### Unit Tests
```bash
pnpm test
```

### Integration Tests
```bash
# Test webhook endpoints
pnpm test:webhooks

# Test repository operations
pnpm test:git

# Test Claude integration
pnpm test:claude
```

### Load Testing
```bash
# Test webhook load handling
curl -X POST http://localhost:3000/webhook/jira \
  -H "Content-Type: application/json" \
  -d @test-data/load-test-payload.json \
  --parallel --parallel-immediate --parallel-max 10
```

## 🔧 Development

### Project Structure
```
src/
├── main.ts                 # Application entry point
├── webhook-server.ts       # Webhook handling server
├── task-processor.ts       # Core task processing logic
├── advanced-planning.ts    # Claude-powered planning system
├── webhook-types.ts        # TypeScript interfaces
└── types.ts               # Core type definitions

test/
├── webhook.test.ts        # Webhook endpoint tests
├── task-processor.test.ts # Task processing tests
└── integration.test.ts    # End-to-end tests
```

### Adding New Features
1. **Webhook Sources**: Extend webhook-types.ts and webhook-server.ts
2. **Git Providers**: Add support in task-processor.ts
3. **Planning Logic**: Enhance advanced-planning.ts
4. **Testing**: Add corresponding test files

### Contributing
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 🚨 Troubleshooting

### Common Issues

**Webhook not received:**
- Check firewall and port forwarding
- Verify webhook URL in JIRA/Trello
- Check webhook secret configuration

**Repository clone fails:**
- Verify GitHub/GitLab token permissions
- Check repository URL format
- Ensure token has access to private repos

**Claude API errors:**
- Verify API key validity
- Check rate limits and usage
- Monitor API response times

**PR creation fails:**
- Check token permissions (needs repo write access)
- Verify branch protection rules
- Ensure proper authentication

### Debug Mode
```bash
# Enable debug logging
echo "LOG_LEVEL=debug" >> .env
docker-compose restart coding-agent

# View detailed logs
docker-compose logs -f coding-agent | grep DEBUG
```

## 📚 Documentation

📁 **[docs/](docs/)** - Complete documentation directory

- **[CLI Usage Guide](docs/CLI_USAGE.md)** - Comprehensive CLI examples and local testing
- **[VPS Deployment Guide](docs/VPS_DEPLOYMENT.md)** - Complete VPS setup instructions
- **[Planning Workflow](docs/PLANNING_WORKFLOW.md)** - How the planning-first system works
- [Architecture Overview](docs/architecture.md) - System design and components

## 🤝 Integration Examples

### GitHub Actions Integration
```yaml
name: Trigger Coding Agent
on:
  issues:
    types: [labeled]
jobs:
  trigger:
    if: contains(github.event.label.name, 'ready-for-development')
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Agent
        run: |
          curl -X POST https://your-domain.com/api/tasks/trigger \
            -H "Content-Type: application/json" \
            -d @task-data.json
```

### Custom Webhook Integration
```typescript
// Custom webhook handler example
app.post('/webhook/custom', async (req, res) => {
  const { repositoryUrl, taskDescription } = req.body;
  
  const taskId = await taskProcessor.processTask({
    repositoryUrl,
    taskData: {
      taskId: generateId(),
      title: taskDescription,
      description: taskDescription,
      priority: 'Medium'
    },
    webhookSource: 'custom'
  });
  
  res.json({ taskId });
});
```

## 🎯 Quick Start Summary

### For Local Testing (CLI)
```bash
# Setup
cp env.example .env  # Add your API keys
pnpm install && pnpm build

# Test against any GitHub repo
pnpm cli process \
  --repository "https://github.com/owner/repo" \
  --task-id "TEST-001" \
  --title "Your task title" \
  --description "Detailed task description"

# Or process a GitHub issue directly
pnpm cli issue --repository "https://github.com/owner/repo" --number 42
```

### For Production (Webhook Automation)
```bash
# Deploy to VPS
git clone <repo-url> && cd coding-agent
cp env.example .env  # Configure production settings
./deploy.sh          # Automated deployment

# Configure webhooks in JIRA/Trello to point to your server
# Tasks will be processed automatically when moved to development
```

### Key Features Summary
- 🎯 **Planning-First**: Every task gets comprehensive analysis before implementation
- 🖥️ **CLI Tool**: Test locally against any GitHub repository or issue  
- 📡 **Webhook Integration**: Automatic processing from JIRA/Trello status changes
- 🔄 **Full Automation**: Clone → Plan → Code → Test → PR creation
- 🧠 **Claude AI**: Advanced planning and implementation using Claude
- 📝 **Documentation**: Detailed planning comments and progress tracking

See [CLI_USAGE.md](docs/CLI_USAGE.md) for comprehensive CLI examples and [VPS_DEPLOYMENT.md](docs/VPS_DEPLOYMENT.md) for production deployment.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/coding-agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/coding-agent/discussions)
- **Email**: support@your-domain.com

---

**🤖 Built with Claude AI for autonomous software development**
