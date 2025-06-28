#!/bin/bash

# Claude Code Integration Setup Script
# This script configures the environment for Claude Code to work with cloned repositories

set -e

echo "🔧 Setting up Claude Code Integration"
echo "===================================="

# Check if Claude CLI is installed
if ! command -v claude &> /dev/null; then
    echo "📥 Installing Claude CLI..."
    
    # Install Claude CLI via npm
    if command -v npm &> /dev/null; then
        npm install -g @anthropic-ai/claude-cli
    else
        echo "❌ npm not found. Please install Node.js and npm first."
        exit 1
    fi
else
    echo "✅ Claude CLI already installed"
fi

# Check if Claude CLI is authenticated
if ! claude auth status &> /dev/null; then
    echo "🔐 Please authenticate Claude CLI..."
    echo "Run: claude auth login"
    echo "And follow the authentication process."
    
    read -p "Press Enter when authentication is complete..."
fi

# Create global Claude configuration directory
CLAUDE_CONFIG_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_CONFIG_DIR"

# Create global MCP server configuration
cat > "$CLAUDE_CONFIG_DIR/global_mcp_config.json" << 'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
    },
    "git": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-git"]
    },
    "typescript": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-typescript"]
    },
    "database": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite"]
    },
    "web-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"]
    }
  }
}
EOF

# Install global MCP dependencies
echo "📦 Installing MCP server dependencies..."
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @modelcontextprotocol/server-git
npm install -g @modelcontextprotocol/server-typescript
npm install -g @modelcontextprotocol/server-sqlite
npm install -g @modelcontextprotocol/server-brave-search

# Create Claude Code helper scripts
SCRIPTS_DIR="/usr/local/bin"

# Claude Code development script
cat > "$SCRIPTS_DIR/claude-dev" << 'EOF'
#!/bin/bash

# Claude Code Development Helper
# Usage: claude-dev <repository-path>

if [ $# -eq 0 ]; then
    echo "Usage: claude-dev <repository-path>"
    echo "Example: claude-dev /workspace/task-123/my-repo"
    exit 1
fi

REPO_PATH="$1"

if [ ! -d "$REPO_PATH" ]; then
    echo "Error: Repository path does not exist: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"

# Check if .claude directory exists
if [ ! -d ".claude" ]; then
    echo "Warning: .claude directory not found. This may not be configured for autonomous development."
fi

# Set environment variables for Claude CLI
export CLAUDE_PROJECT_ROOT="$REPO_PATH"

# Check if implementation plan exists
if [ -f ".claude/implementation-plan.md" ]; then
    echo "📋 Implementation plan found: .claude/implementation-plan.md"
fi

if [ -f ".claude/implementation-guidelines.md" ]; then
    echo "📖 Guidelines available: .claude/implementation-guidelines.md"
fi

# Start Claude CLI with project context
echo "🚀 Starting Claude Code development session..."
echo "Repository: $REPO_PATH"
echo "Type 'exit' to end the session."

claude chat --project="$REPO_PATH"
EOF

chmod +x "$SCRIPTS_DIR/claude-dev"

# Create repository analysis script
cat > "$SCRIPTS_DIR/claude-analyze" << 'EOF'
#!/bin/bash

# Repository Analysis for Claude Code
# Usage: claude-analyze <repository-path>

if [ $# -eq 0 ]; then
    echo "Usage: claude-analyze <repository-path>"
    exit 1
fi

REPO_PATH="$1"

if [ ! -d "$REPO_PATH" ]; then
    echo "Error: Repository path does not exist: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"

echo "🔍 Analyzing repository: $REPO_PATH"
echo "=================================="

# Check git status
if [ -d ".git" ]; then
    echo "📊 Git Status:"
    git status --short
    echo ""
    
    echo "🌿 Current Branch:"
    git branch --show-current
    echo ""
    
    echo "📝 Recent Commits:"
    git log --oneline -5
    echo ""
fi

# Check project structure
echo "📁 Project Structure:"
find . -maxdepth 3 -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.vue" -o -name "*.py" -o -name "*.java" -o -name "*.go" -o -name "*.rs" \) | head -20
echo ""

# Check for configuration files
echo "⚙️  Configuration Files:"
ls -la | grep -E "(package\.json|tsconfig\.json|\.env|docker|README)"
echo ""

# Check Claude configuration
if [ -d ".claude" ]; then
    echo "🤖 Claude Configuration:"
    ls -la .claude/
    echo ""
    
    if [ -f ".claude/implementation-plan.md" ]; then
        echo "📋 Implementation Plan Available"
    fi
    
    if [ -f ".claude/implementation-guidelines.md" ]; then
        echo "📖 Guidelines Available"
    fi
else
    echo "⚠️  No Claude configuration found (.claude directory missing)"
fi

echo "Analysis complete!"
EOF

chmod +x "$SCRIPTS_DIR/claude-analyze"

# Create workspace management script
cat > "$SCRIPTS_DIR/claude-workspace" << 'EOF'
#!/bin/bash

# Claude Workspace Management
# Usage: claude-workspace <command> [args]

case "$1" in
    "list")
        echo "📂 Active Workspaces:"
        find /app/workspace -mindepth 2 -maxdepth 2 -type d 2>/dev/null | sort
        ;;
    "clean")
        echo "🧹 Cleaning old workspaces (older than 7 days)..."
        find /app/workspace -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
        echo "Cleanup complete!"
        ;;
    "status")
        echo "📊 Workspace Status:"
        echo "Total workspaces: $(find /app/workspace -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)"
        echo "Disk usage: $(du -sh /app/workspace 2>/dev/null | cut -f1)"
        ;;
    *)
        echo "Usage: claude-workspace <command>"
        echo "Commands:"
        echo "  list    - List all active workspaces"
        echo "  clean   - Remove old workspaces"
        echo "  status  - Show workspace statistics"
        ;;
esac
EOF

chmod +x "$SCRIPTS_DIR/claude-workspace"

echo ""
echo "✅ Claude Code Integration Setup Complete!"
echo "=========================================="
echo ""
echo "🛠️  Available Commands:"
echo "  claude-dev <repo-path>      - Start Claude development session"
echo "  claude-analyze <repo-path>  - Analyze repository structure"
echo "  claude-workspace <command>  - Manage workspaces"
echo ""
echo "📖 Usage Examples:"
echo "  claude-dev /app/workspace/task-123/my-repo"
echo "  claude-analyze /app/workspace/task-123/my-repo"
echo "  claude-workspace list"
echo ""
echo "🔧 Configuration:"
echo "  Global config: ~/.claude/global_mcp_config.json"
echo "  MCP servers installed globally via npm"
echo ""
echo "🚀 Next Steps:"
echo "1. Ensure Claude CLI is authenticated: claude auth status"
echo "2. Test with a repository: claude-analyze <path>"
echo "3. Start development: claude-dev <path>"
