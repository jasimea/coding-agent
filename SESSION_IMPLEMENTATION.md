# Session Management Implementation

This document explains the session management feature that has been added to the coding agent.

## Overview

Each interaction with the coding agent now supports session-based management, allowing you to:
- Create sessions with unique identifiers
- Track tasks and plans within sessions
- Persist session metadata to disk
- Resume work across different sessions
- Generate analytics for session performance

## Key Features

### 1. Session Creation
- Automatic session creation when no session ID is provided
- Manual session creation with custom working directories
- Session metadata stored in `.coding-agent/sessions/` directory

### 2. Task Association
- Every task is now associated with a session ID
- Session tracks all tasks, plans, execution times, and outcomes
- Metadata includes success rates and performance metrics

### 3. Metadata Persistence
- Session metadata automatically saved as JSON files
- Includes timestamps, task counts, execution statistics
- Can be loaded and resumed later

## API Usage Examples

### Creating a Session
```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "workingDirectory": "/path/to/project"
  }'
```

Response:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "startTime": "2025-06-28T10:30:00.000Z",
    "workingDirectory": "/path/to/project",
    "projectPath": "/path/to/project",
    "tasks": [],
    "plans": [],
    "totalTasks": 0,
    "completedTasks": 0,
    "failedTasks": 0,
    "totalExecutionTime": 0,
    "status": "active"
  }
}
```

### Executing Tasks with Session ID
```bash
curl -X POST http://localhost:3000/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "task": "Create a new React component called UserProfile"
  }'
```

### Getting Session Information
```bash
curl http://localhost:3000/sessions/550e8400-e29b-41d4-a716-446655440000
```

Response:
```json
{
  "metadata": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "startTime": "2025-06-28T10:30:00.000Z",
    "tasks": ["task-1", "task-2"],
    "plans": ["plan-1", "plan-2"],
    "totalTasks": 2,
    "completedTasks": 2,
    "failedTasks": 0,
    "totalExecutionTime": 45000,
    "status": "active"
  },
  "stats": {
    "duration": 120000,
    "successRate": 100,
    "avgExecutionTime": 22500
  }
}
```

### Listing All Sessions
```bash
curl http://localhost:3000/sessions
```

### Ending a Session
```bash
curl -X POST http://localhost:3000/sessions/550e8400-e29b-41d4-a716-446655440000/end
```

## Code Structure

### New Files Added
- `src/utils/session-manager.ts` - Core session management logic
- `src/api/sessions.ts` - API endpoints for session operations

### Modified Files
- `src/types/index.ts` - Added session-related interfaces
- `src/agents/coding-agent.ts` - Integrated session support
- `src/api/execute-task.ts` - Added session ID handling
- `src/api/execute-task-stream.ts` - Added session ID handling
- `src/server.ts` - Added session API routes
- `src/api/docs.ts` - Updated documentation

### Key Interfaces

#### SessionMetadata
```typescript
interface SessionMetadata {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  tasks: string[]; // Task IDs
  plans: string[]; // Plan IDs
  workingDirectory: string;
  projectPath: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalExecutionTime: number;
  status: 'active' | 'completed' | 'failed';
}
```

#### Updated AgentTask
```typescript
interface AgentTask {
  id: string;
  sessionId: string; // NEW
  type: 'code' | 'git' | 'file' | 'command';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  result?: any;
  error?: string;
  plan?: AgentPlan;
}
```

## Benefits

1. **Traceability**: Full history of what was done in each session
2. **Resumability**: Can continue work in the same context
3. **Analytics**: Performance metrics and success rates
4. **Organization**: Group related tasks together
5. **Debugging**: Easier to trace issues to specific sessions
6. **Collaboration**: Multiple users can work with separate sessions

## File Structure

Session metadata files are stored in:
```
.coding-agent/
  sessions/
    {sessionId}.session.json
```

Each file contains complete session metadata including all tasks, plans, and statistics.

## Usage Patterns

### Pattern 1: Explicit Session Management
```javascript
// Create session for feature development
const session = await createSession({ workingDirectory: '/project/feature-x' });

// Execute multiple related tasks
await executeTask({ sessionId: session.sessionId, task: 'Create component' });
await executeTask({ sessionId: session.sessionId, task: 'Add tests' });
await executeTask({ sessionId: session.sessionId, task: 'Update documentation' });

// End session
await endSession(session.sessionId);
```

### Pattern 2: Automatic Session Management
```javascript
// Agent automatically creates and manages session
await executeTask({ task: 'Build a todo app' });
// Session created automatically, metadata saved
```

### Pattern 3: Session Resumption
```javascript
// List existing sessions
const sessions = await listSessions();

// Switch to previous session
await switchSession(sessions[0].sessionId);

// Continue work in that context
await executeTask({ task: 'Add new feature' });
```

This implementation provides a robust foundation for session-based workflow management while maintaining backward compatibility with existing usage patterns.
