# Task Queue Management System

This document describes the task queue management system implemented in the coding agent to handle multiple tasks efficiently while ensuring only one task per repository runs at a time.

## Architecture Overview

The task queue system consists of several key components:

### 1. TaskQueueManager
- **Purpose**: Manages task queuing using Redis as the backend
- **Features**: 
  - Priority-based task queuing
  - Repository locking to prevent concurrent access
  - Automatic lock cleanup for expired locks
  - Task status persistence

### 2. TaskStorage (Interface)
- **Implementations**: 
  - `SQLiteTaskStorage`: Persistent storage using SQLite database
  - `JSONTaskStorage`: File-based storage using JSON (fallback option)
- **Features**:
  - Task CRUD operations
  - Repository-based task filtering
  - Status-based task filtering
  - Automatic indexing for performance

### 3. SharedRepositoryManager
- **Purpose**: Manages repository workspaces to avoid repeated cloning
- **Features**:
  - Repository reuse across tasks
  - Automatic repository updates
  - Workspace cleanup for old repositories
  - Branch management and conflict resolution

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Storage Configuration  
USE_SQLITE=true  # Set to false to use JSON storage

# Repository Authentication
GITHUB_TOKEN=your_github_token
GITLAB_TOKEN=your_gitlab_token

# Queue Processing
TASK_PROCESSING_INTERVAL=5000  # milliseconds
REPOSITORY_LOCK_TIMEOUT=3600000  # 1 hour in milliseconds
```

### Dependencies

Add these dependencies to your project:

```json
{
  "dependencies": {
    "ioredis": "^5.4.1",
    "better-sqlite3": "^9.6.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11"
  }
}
```

## Usage Examples

### Basic Task Processing

```typescript
import { TaskProcessor } from './task-processor.js';

const processor = new TaskProcessor(claudeApiKey);

// Process a task (will be queued automatically)
const taskId = await processor.processTask({
  repositoryUrl: 'https://github.com/user/repo',
  taskData: {
    taskId: 'custom-task-id', // optional
    title: 'Implement new feature',
    description: 'Add user authentication to the application',
    priority: 'high',
    labels: ['feature', 'authentication'],
    acceptanceCriteria: 'Users can login with email/password'
  },
  webhookSource: 'manual'
});

console.log(`Task queued with ID: ${taskId}`);
```

### Monitoring Queue Status

```typescript
// Get current queue status
const status = await processor.getQueueStatus();
console.log(`Queue size: ${status.queueSize}`);
console.log(`Active locks: ${status.activeRepositoryLocks}`);
console.log(`Currently processing: ${status.isProcessing}`);

// Get all tasks
const allTasks = await processor.getAllTaskStatuses();
console.log(`Total tasks: ${allTasks.length}`);

// Get specific task status
const taskStatus = await processor.getTaskStatus(taskId);
if (taskStatus) {
  console.log(`Task ${taskId} status: ${taskStatus.status}`);
}
```

### Repository Management

```typescript
import { SharedRepositoryManager } from './shared-repository-manager.js';

const repoManager = new SharedRepositoryManager('/workspace');
await repoManager.initialize();

// Get repository info
const repoInfo = repoManager.getRepositoryInfo('https://github.com/user/repo');
if (repoInfo) {
  console.log(`Repository path: ${repoInfo.path}`);
  console.log(`Last accessed: ${repoInfo.lastAccessed}`);
  console.log(`Current branch: ${repoInfo.currentBranch}`);
}

// List all managed repositories
const allRepos = repoManager.getAllRepositories();
console.log(`Managing ${allRepos.length} repositories`);

// Cleanup old repositories (older than 7 days)
await repoManager.cleanupOldRepositories(7 * 24 * 60 * 60 * 1000);
```

## Task Flow

1. **Task Submission**: Task is submitted via `processTask()` method
2. **Queuing**: Task is added to Redis queue with priority
3. **Repository Check**: System checks if repository is locked
4. **Lock Acquisition**: If available, repository lock is acquired
5. **Repository Acquisition**: Repository is cloned or existing workspace is updated
6. **Task Processing**: Task is processed (planning, implementation, PR creation)
7. **Lock Release**: Repository lock is released upon completion or failure
8. **Status Update**: Final task status is persisted to storage

## Repository Locking

### How It Works
- Each repository URL is normalized and used as a lock key
- Only one task can hold a lock for a repository at a time
- Locks have a timeout (default: 1 hour) to prevent deadlocks
- Failed tasks automatically release their locks

### Lock Key Format
```
coding-agent:repo-lock:github.com/user/repo
```

### Lock Data Structure
```json
{
  "repositoryUrl": "github.com/user/repo",
  "taskId": "task-123",
  "lockedAt": "2024-01-15T10:30:00.000Z",
  "lockTimeout": 3600000
}
```

## Storage Schema

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS tasks (
  taskId TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  progress TEXT,
  error TEXT,
  repositoryUrl TEXT,
  branchName TEXT,
  pullRequestUrl TEXT,
  planningCommentId TEXT,
  implementationProgress TEXT,
  startTime TEXT,
  endTime TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_tasks_repository ON tasks(repositoryUrl);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created ON tasks(createdAt);
```

### Task Status Values
- `pending`: Task is queued and waiting
- `planning`: Task is being analyzed and planned
- `pr-created`: Pull request has been created
- `implementing`: Implementation is in progress
- `completed`: Task completed successfully
- `failed`: Task failed with error

## Error Handling

### Common Scenarios
1. **Redis Connection Failure**: System falls back to in-memory queuing
2. **Repository Clone Failure**: Task is marked as failed, lock is released
3. **Lock Timeout**: Expired locks are automatically cleaned up
4. **Storage Failure**: Errors are logged, system continues with degraded functionality

### Cleanup Procedures
```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  await processor.cleanup();
  process.exit(0);
});

// Clean up expired locks manually
await queueManager.cleanupExpiredLocks();

// Clean up old repositories
await repositoryManager.cleanupOldRepositories();
```

## Performance Considerations

### Queue Processing
- Tasks are processed every 5 seconds by default
- Only one task is processed at a time per processor instance
- Multiple processor instances can run in parallel (distributed processing)

### Repository Management
- Repositories are reused across tasks to avoid repeated cloning
- Old repositories are cleaned up automatically
- Git operations are optimized (stash, reset, pull)

### Storage Optimization
- SQLite indexes improve query performance
- JSON storage is used as a lightweight fallback
- Task data is normalized to minimize storage size

## Monitoring and Debugging

### Log Categories
- Task queuing and processing
- Repository management
- Lock acquisition and release
- Storage operations
- Error conditions

### Health Checks
```typescript
// Check system health
const health = {
  queueSize: await queueManager.getQueueSize(),
  activeLocks: await queueManager.getActiveRepositoryLocks(),
  repositoryCount: repositoryManager.getAllRepositories().length,
  tasksInStorage: (await taskStorage.getAllTasks()).length
};

console.log('System Health:', health);
```

## Migration from Old System

The new queue system is backward compatible. Existing code will continue to work, but will now benefit from:

1. **Repository Reuse**: No more repeated cloning
2. **Serialized Access**: No conflicts between concurrent tasks
3. **Persistent Storage**: Task state survives application restarts
4. **Better Monitoring**: Comprehensive task and queue status information

### Breaking Changes
- Task processing is now asynchronous by default
- Repository paths have changed (now shared, not per-task)
- Some internal APIs have been refactored

## Troubleshooting

### Common Issues

1. **Tasks Stuck in Queue**
   - Check Redis connectivity
   - Verify repository locks aren't expired
   - Check system resources

2. **Repository Lock Conflicts**
   - Clean up expired locks
   - Check for long-running tasks
   - Verify lock timeout configuration

3. **Storage Issues**
   - Check database permissions
   - Verify disk space
   - Check SQLite file corruption

### Debug Commands
```bash
# Check Redis queue
redis-cli ZRANGE coding-agent:task-queue 0 -1

# Check repository locks
redis-cli KEYS "coding-agent:repo-lock:*"

# Check task storage (SQLite)
sqlite3 ~/.coding-agent/tasks.db "SELECT * FROM tasks ORDER BY createdAt DESC LIMIT 10;"
```