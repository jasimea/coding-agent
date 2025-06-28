# VPS Deployment Guide for Autonomous Coding Agent

This guide will help you deploy the Autonomous Coding Agent on a VPS to automatically process JIRA/Trello webhooks and implement code changes using Claude.

## 🚀 Quick Start

### Prerequisites

1. **VPS Requirements:**
   - Ubuntu 20.04+ or similar Linux distribution
   - At least 2GB RAM
   - 20GB+ storage
   - Public IP address and domain name
   - Docker and Docker Compose installed

2. **API Keys & Tokens:**
   - Anthropic API key (for Claude)
   - GitHub Personal Access Token (with repo permissions)
   - Optional: GitLab token, webhook secrets

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for docker group changes
exit
```

### Step 2: Deploy the Application

```bash
# Clone the repository
git clone <your-repo-url> coding-agent
cd coding-agent

# Copy environment template
cp env.example .env

# Edit environment variables
nano .env
```

Fill in your `.env` file:
```env
ANTHROPIC_API_KEY=sk-ant-xxxxx
GITHUB_TOKEN=ghp_xxxxx
WEBHOOK_SECRET=your-secure-secret
PORT=3000
NODE_ENV=production
```

### Step 3: SSL Setup (Recommended)

```bash
# Create SSL directory
mkdir ssl

# Option 1: Use Let's Encrypt (recommended)
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*

# Option 2: Self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem
```

### Step 4: Start the Application

```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f coding-agent

# Verify health
curl http://localhost:3000/health
```

### Step 5: Configure Webhooks

#### JIRA Setup

1. Go to JIRA Administration → System → WebHooks
2. Create a new webhook:
   - **URL**: `https://your-domain.com/webhook/jira`
   - **Events**: Issue Created, Issue Updated
   - **JQL Filter**: `project = YOUR_PROJECT`
   - **Secret**: Your webhook secret

#### Trello Setup

1. Go to Trello Power-Ups → Developer API Keys
2. Create a webhook:
   - **URL**: `https://your-domain.com/webhook/trello`
   - **Model ID**: Your board ID
   - **Description**: Coding Agent Webhook

### Step 6: Test the Setup

```bash
# Manual trigger test
curl -X POST https://your-domain.com/api/tasks/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryUrl": "https://github.com/your-org/your-repo",
    "taskData": {
      "taskId": "TEST-001",
      "title": "Test Implementation",
      "description": "This is a test task",
      "priority": "Medium"
    }
  }'

# Check task status
curl https://your-domain.com/api/tasks/{taskId}/status
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `GITHUB_TOKEN` | Yes | GitHub PAT with repo access |
| `GITLAB_TOKEN` | No | GitLab token (if using GitLab) |
| `WEBHOOK_SECRET` | No | Secret for webhook validation |
| `PORT` | No | Server port (default: 3000) |
| `LOG_LEVEL` | No | Logging level (default: info) |

### Repository Requirements

Your repositories should include the repository URL in:
- JIRA issue description
- Trello card description

Format: `Repository: https://github.com/org/repo`

## 📡 Webhook Endpoints

### JIRA Webhook
- **URL**: `POST /webhook/jira`
- **Triggers**: Issue status changes to development states
- **States**: "In Progress", "Development", "Ready for Development", "To Do"

### Trello Webhook
- **URL**: `POST /webhook/trello`
- **Triggers**: Card moves to development lists
- **Lists**: "In Progress", "Development", "To Do", "Ready for Development"

### API Endpoints
- `GET /health` - Health check
- `GET /api/tasks/:taskId/status` - Task status
- `POST /api/tasks/trigger` - Manual task trigger

## 🔍 Monitoring

### Logs
```bash
# Application logs
docker-compose logs -f coding-agent

# Specific log files
tail -f logs/webhook.log
tail -f logs/task-processor.log
tail -f logs/application.log
```

### Health Monitoring
```bash
# Simple health check script
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ $response -eq 200 ]; then
    echo "Service is healthy"
else
    echo "Service is down (HTTP $response)"
    # Add alerting logic here
fi
```

## 🛠 Maintenance

### Updates
```bash
cd coding-agent
git pull
docker-compose build
docker-compose up -d
```

### Backup
```bash
# Backup active tasks and logs
tar -czf backup-$(date +%Y%m%d).tar.gz active-tasks/ logs/ workspace/
```

### Cleanup
```bash
# Clean old Docker images
docker system prune -f

# Clean old workspaces (older than 7 days)
find workspace/ -type d -mtime +7 -exec rm -rf {} +
```

## 🔐 Security Considerations

1. **Use HTTPS**: Always use SSL certificates
2. **Webhook Secrets**: Configure webhook secrets for validation
3. **Rate Limiting**: Nginx configuration includes rate limiting
4. **Token Security**: Store tokens securely, rotate regularly
5. **Network Security**: Use firewall rules to restrict access
6. **Updates**: Keep system and Docker images updated

## 🚨 Troubleshooting

### Common Issues

1. **Webhook not triggered**
   - Check JIRA/Trello webhook configuration
   - Verify URL accessibility from external
   - Check webhook secret validation

2. **Repository clone fails**
   - Verify GitHub/GitLab token permissions
   - Check repository URL format
   - Ensure token has access to the repository

3. **Claude API errors**
   - Verify API key is valid
   - Check API rate limits
   - Monitor API usage

4. **PR creation fails**
   - Verify GitHub token permissions
   - Check repository settings (branch protection)
   - Ensure proper authentication

### Debug Mode
```bash
# Enable debug logging
echo "LOG_LEVEL=debug" >> .env
docker-compose restart coding-agent
```

## 📈 Scaling Considerations

For high-volume usage:

1. **Database**: Add PostgreSQL for task state management
2. **Queue**: Implement Redis-based job queue
3. **Load Balancer**: Use multiple container instances
4. **Monitoring**: Add Prometheus/Grafana monitoring
5. **Storage**: Use external storage for workspace data

## 🔄 Enhanced Workflow with Planning

### Planning-First Processing Flow

1. **Webhook Trigger**: JIRA/Trello status change detected
2. **Repository Clone**: Agent clones the specified repository  
3. **Analysis**: Analyzes codebase structure and dependencies
4. **Detailed Planning**: Generates comprehensive implementation plan using Claude
5. **Claude Environment Setup**: 
   - Creates `.claude` directory with MCP server configurations
   - Sets up development environment for Claude CLI
   - Installs project-specific tooling and guidelines
6. **Branch Creation**: Creates feature branch with descriptive name
7. **Pull Request Creation**: Creates PR with planning summary
8. **Planning Comment**: Posts detailed implementation plan as PR comment
9. **Implementation Ready**: Repository configured for Claude Code development
10. **Progress Updates**: Updates PR comment with implementation progress
11. **Commit**: Commits changes with detailed commit message
12. **Completion**: Marks task as complete with final PR comment update

### Planning-First Benefits

- **📋 Detailed Analysis**: Every task gets comprehensive analysis before implementation
- **🎯 Strategic Planning**: Implementation strategy planned and reviewed before coding
- **📝 Transparent Documentation**: All plans documented and shared via PR comments
- **🔄 Progress Tracking**: Real-time updates on implementation progress
- **✅ Quality Assurance**: Structured approach ensures consistent quality

### Claude Code Integration

Each cloned repository is automatically configured for optimal Claude Code development:

```bash
# Repository structure after processing
repo/
├── .claude/
│   ├── claude_desktop_config.json    # Desktop app configuration
│   ├── project.json                  # Project-specific settings
│   ├── implementation-plan.md        # Detailed implementation plan
│   ├── implementation-guidelines.md  # Development guidelines
│   └── mcp-servers/                  # Custom MCP server configurations
├── .claude_cli_config.json          # CLI configuration
└── IMPLEMENTATION_LOG.md             # Implementation tracking
```

### Available MCP Servers

- **Filesystem**: Complete file system access and operations
- **Git**: Git repository analysis and operations
- **TypeScript**: TypeScript/JavaScript analysis and tooling
- **Database**: SQLite database operations and analysis
- **Web Search**: Documentation and research capabilities
- **Project Tools**: Custom project-specific development tools

## 🤝 Integration Examples

### JIRA Issue Requirements

Issue description should include:
```
Repository: https://github.com/myorg/myrepo

## Acceptance Criteria
- [ ] Feature X should work
- [ ] Tests should pass
- [ ] Documentation updated
```

### Trello Card Requirements

Card description should include:
```
Repository: https://github.com/myorg/myrepo

## Task Details
Implement feature Y with proper error handling

## Acceptance Criteria
- Feature works as expected
- Unit tests included
```

This setup provides a complete autonomous coding workflow where JIRA/Trello status changes automatically trigger code implementation via Claude and create pull requests for review.
