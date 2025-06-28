// src/server.ts
import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TaskManager } from './task-manager';
import { RepoContext } from './types';

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Initialize TaskManager with API key from environment variables
const taskManager = new TaskManager(process.env.ANTHROPIC_API_KEY || '');

// Middleware
app.use(cors());
app.use(express.json());

// Task CRUD endpoints
app.post('/api/tasks', (req, res) => {
  try {
    const taskData = req.body;
    const task = taskManager.createTask(taskData);
    res.status(201).json(task);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: errorMessage });
  }
});

app.get('/api/tasks', (req, res) => {
  const tasks = taskManager.getAllTasks();
  res.json(tasks);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = taskManager.getTask(req.params.id);
  
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  
  res.json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const updatedTask = taskManager.updateTask(req.params.id, req.body);
  
  if (!updatedTask) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  
  res.json(updatedTask);
});

app.delete('/api/tasks/:id', (req, res) => {
  const deleted = taskManager.deleteTask(req.params.id);
  
  if (!deleted) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  
  res.status(204).end();
});

// Planning related endpoints
app.post('/api/tasks/:id/plan', async (req, res) => {
  try {
    const taskId = req.params.id;
    const repoContext: RepoContext = req.body;
    
    const planResult = await taskManager.generatePlanForTask(taskId, repoContext);
    
    if (!planResult) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    res.json(planResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// Filtering endpoints
app.get('/api/tasks/status/:status', (req, res) => {
  const validStatuses = ['Todo', 'InProgress', 'Done'];
  const status = req.params.status;
  
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status parameter' });
    return;
  }
  
  const tasks = taskManager.getTasksByStatus(status as 'Todo' | 'InProgress' | 'Done');
  res.json(tasks);
});

app.get('/api/tasks/assignee/:assignee', (req, res) => {
  const tasks = taskManager.getTasksByAssignee(req.params.assignee);
  res.json(tasks);
});

app.get('/api/tasks/label/:label', (req, res) => {
  const tasks = taskManager.getTasksByLabel(req.params.label);
  res.json(tasks);
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export default app;