// TIMPS Code — Coordinator Service
// Multi-agent orchestration for coordinating parallel work

import { EventEmitter } from 'node:events';
import * as crypto from 'node:crypto';
import { loadConfig } from '../../config/config.js';

export interface WorkerConfig {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  createdAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

export interface CoordinatorMessage {
  type: 'task_result' | 'task_error' | 'task_update' | 'task_complete';
  workerId: string;
  content: string;
  timestamp: number;
}

export interface AgentTask {
  id: string;
  description: string;
  prompt: string;
  subagentType: 'worker' | 'researcher' | 'verifier';
  priority?: 'low' | 'normal' | 'high';
  dependsOn?: string[];
  onComplete?: (result: string) => void;
  onError?: (error: string) => void;
}

export class CoordinatorService extends EventEmitter {
  private workers = new Map<string, WorkerConfig>();
  private tasks = new Map<string, AgentTask>();
  private taskQueue: string[] = [];
  private isRunning = false;
  private coordinatorMode: boolean = false;

  constructor() {
    super();
  }

  enable(): void {
    this.coordinatorMode = true;
    this.emit('modeChanged', true);
  }

  disable(): void {
    this.coordinatorMode = false;
    this.emit('modeChanged', false);
  }

  isEnabled(): boolean {
    return this.coordinatorMode;
  }

  setMode(enabled: boolean): void {
    this.coordinatorMode = enabled;
    this.emit('modeChanged', enabled);
  }

  createWorker(description: string): string {
    const id = `worker_${crypto.randomUUID().slice(0, 8)}`;
    const worker: WorkerConfig = {
      id,
      description,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.workers.set(id, worker);
    return id;
  }

  updateWorkerStatus(workerId: string, status: WorkerConfig['status'], result?: string, error?: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.status = status;
    if (status === 'completed' || status === 'failed') {
      worker.completedAt = Date.now();
    }
    if (result) worker.result = result;
    if (error) worker.error = error;

    this.emit('workerUpdated', worker);
  }

  getWorker(workerId: string): WorkerConfig | undefined {
    return this.workers.get(workerId);
  }

  getAllWorkers(): WorkerConfig[] {
    return Array.from(this.workers.values());
  }

  getWorkersByStatus(status: WorkerConfig['status']): WorkerConfig[] {
    return this.getAllWorkers().filter(w => w.status === status);
  }

  stopWorker(workerId: string): boolean {
    const worker = this.workers.get(workerId);
    if (!worker || worker.status === 'completed' || worker.status === 'failed') {
      return false;
    }

    this.updateWorkerStatus(workerId, 'stopped');
    this.emit('workerStopped', workerId);
    return true;
  }

  stopAllWorkers(): void {
    for (const worker of this.workers.values()) {
      if (worker.status === 'running' || worker.status === 'pending') {
        this.stopWorker(worker.id);
      }
    }
  }

  submitTask(task: Omit<AgentTask, 'id'>): string {
    const id = `task_${crypto.randomUUID().slice(0, 8)}`;
    const fullTask: AgentTask = { ...task, id };
    this.tasks.set(id, fullTask);
    this.taskQueue.push(id);

    this.emit('taskSubmitted', fullTask);
    return id;
  }

  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  getNextTask(): AgentTask | undefined {
    while (this.taskQueue.length > 0) {
      const taskId = this.taskQueue.shift()!;
      const task = this.tasks.get(taskId);
      if (task) {
        if (this.canRunTask(task)) {
          return task;
        } else {
          this.taskQueue.push(taskId);
        }
      }
    }
    return undefined;
  }

  private canRunTask(task: AgentTask): boolean {
    if (!task.dependsOn || task.dependsOn.length === 0) {
      return true;
    }

    return task.dependsOn.every(depId => {
      const depWorker = this.workers.get(depId);
      return depWorker && (depWorker.status === 'completed' || depWorker.status === 'failed');
    });
  }

  completeTask(taskId: string, result: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.onComplete?.(result);
    this.emit('taskCompleted', { task, result });
  }

  failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.onError?.(error);
    this.emit('taskFailed', { task, error });
  }

  getTasksByWorker(workerId: string): AgentTask[] {
    return Array.from(this.tasks.values()).filter(t => t.id.startsWith(workerId));
  }

  getPendingTaskCount(): number {
    return this.taskQueue.length;
  }

  clearCompletedWorkers(): void {
    for (const [id, worker] of this.workers.entries()) {
      if (worker.status === 'completed' || worker.status === 'failed' || worker.status === 'stopped') {
        this.workers.delete(id);
      }
    }
  }

  getStatus(): {
    mode: boolean;
    workers: { total: number; running: number; completed: number; failed: number };
    tasks: { total: number; pending: number };
  } {
    const workers = this.getAllWorkers();
    return {
      mode: this.coordinatorMode,
      workers: {
        total: workers.length,
        running: workers.filter(w => w.status === 'running').length,
        completed: workers.filter(w => w.status === 'completed').length,
        failed: workers.filter(w => w.status === 'failed').length,
      },
      tasks: {
        total: this.tasks.size,
        pending: this.taskQueue.length,
      },
    };
  }

  start(): void {
    this.isRunning = true;
    this.emit('started');
  }

  stop(): void {
    this.isRunning = false;
    this.stopAllWorkers();
    this.emit('stopped');
  }

  reset(): void {
    this.stop();
    this.workers.clear();
    this.tasks.clear();
    this.taskQueue = [];
    this.emit('reset');
  }
}

let coordinatorService: CoordinatorService | null = null;

export function getCoordinatorService(): CoordinatorService {
  if (!coordinatorService) {
    coordinatorService = new CoordinatorService();
  }
  return coordinatorService;
}

export const COORDINATOR_SYSTEM_PROMPT = `You are TIMPS Code, an AI assistant that orchestrates software engineering tasks across multiple workers.

## 1. Your Role

You are a **coordinator**. Your job is to:
- Help the user achieve their goal
- Direct workers to research, implement and verify code changes
- Synthesize results and communicate with the user
- Answer questions directly when possible — don't delegate work that you can handle without tools

Every message you send is to the user. Worker results and system notifications are internal signals, not conversation partners — never thank or acknowledge them. Summarize new information for the user as it arrives.

## 2. Your Tools

- **agent** - Spawn a new worker
- **send_message** - Continue an existing worker
- **task_stop** - Stop a running worker

## 3. Workers

Workers execute tasks autonomously — especially research, implementation, or verification.
Workers have access to standard tools: Bash, Read, Edit, Glob, Grep, and more.

## 4. Task Workflow

Most tasks can be broken down into phases:

| Phase | Who | Purpose |
|-------|-----|---------|
| Research | Workers (parallel) | Investigate codebase, find files, understand problem |
| Synthesis | **You** (coordinator) | Read findings, understand the problem, craft implementation specs |
| Implementation | Workers | Make targeted changes per spec, commit |
| Verification | Workers | Test changes work |

## 5. Concurrency

**Parallelism is your superpower. Workers are async. Launch independent workers concurrently whenever possible.**

## 6. Writing Worker Prompts

**Workers can't see your conversation.** Every prompt must be self-contained with everything the worker needs.

### Always synthesize

When workers report research findings, **you must understand them** before directing follow-up work. Include specific file paths, line numbers, and exactly what to change.

### Purpose statement

Include a brief purpose so workers can calibrate depth and emphasis.

### Prompt tips

**Good examples:**

1. Implementation: "Fix the null pointer in src/auth/validate.ts:42. The user field can be undefined when the session expires. Add a null check and return early with an appropriate error. Commit and report the hash."

2. Precise git operation: "Create a new branch from main called 'fix/session-expiry'. Cherry-pick only commit abc123 onto it. Push and create a draft PR targeting main."

**Bad examples:**

1. "Fix the bug we discussed" — no context
2. "Based on your findings, implement the fix" — lazy delegation
3. "Create a PR for the recent changes" — ambiguous scope

## 7. Handling Worker Failures

When a worker reports failure:
- Continue the same worker with send_message — it has the full error context
- If a correction attempt fails, try a different approach or report to the user`;

export function isCoordinatorModeEnabled(): boolean {
  const cfg = loadConfig();
  return cfg.thinkingEnabled === true;
}