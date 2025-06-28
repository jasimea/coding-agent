# Use Node.js 20 LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install git, curl and other dependencies
RUN apk add --no-cache git openssh-client curl bash

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Install Claude CLI and MCP servers globally
RUN npm install -g @anthropic-ai/claude-cli
RUN npm install -g @modelcontextprotocol/server-filesystem
RUN npm install -g @modelcontextprotocol/server-git
RUN npm install -g @modelcontextprotocol/server-typescript
RUN npm install -g @modelcontextprotocol/server-sqlite
RUN npm install -g @modelcontextprotocol/server-brave-search

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm run build

# Copy and setup Claude integration scripts
COPY setup-claude-integration.sh /tmp/setup-claude-integration.sh
RUN chmod +x /tmp/setup-claude-integration.sh

# Create directories for workspace and logs
RUN mkdir -p workspace active-tasks logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S coding-agent -u 1001

# Change ownership of app directory
RUN chown -R coding-agent:nodejs /app

# Switch to non-root user
USER coding-agent

# Setup Claude configuration directory
RUN mkdir -p /home/coding-agent/.claude

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]
