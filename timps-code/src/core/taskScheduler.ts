// ── TIMPS Task Scheduler — Background Tasks & Cron
// Inspired by Hermes Agent's cron system

import * as childProcess from 'node:child_process';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression?: string;
  intervalMs?: number;
  command: string;
  enabled: boolean;
  lastRun?: number;
  lastResult?: 'success' | 'failed';
  notifyOnComplete: boolean;
  notifyOnError: boolean;
}

export interface BackgroundTask {
  id: string;
  command: string;
  pid?: number;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  output: string;
  notifyOnComplete: boolean;
}

export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private backgroundTasks: Map<string, BackgroundTask> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    this.loadTasks();
  }
  
  private loadTasks(): void {
    // Load from config file
    try {
      const configPath = this.getConfigPath();
      if (require('fs').existsSync(configPath)) {
        const data = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
        for (const task of data.tasks || []) {
          this.tasks.set(task.id, task);
        }
      }
    } catch (e) {
      // Start fresh
    }
  }
  
  private getConfigPath(): string {
    return require('path').join(
      require('os').homedir(), 
      '.timps', 
      'scheduler.json'
    );
  }
  
  private saveTasks(): void {
    try {
      const tasks = [...this.tasks.values()];
      const configDir = require('path').join(
        require('os').homedir(), 
        '.timps'
      );
      require('fs').mkdirSync(configDir, { recursive: true });
      require('fs').writeFileSync(
        this.getConfigPath(),
        JSON.stringify({ tasks }, null, 2)
      );
    } catch (e) {
      // Ignore save errors
    }
  }
  
  async addTask(params: {
    name: string;
    command: string;
    cronExpression?: string;
    intervalMs?: number;
    notifyOnComplete?: boolean;
    notifyOnError?: boolean;
  }): Promise<ScheduledTask> {
    const task: ScheduledTask = {
      id: `task_${Date.now()}`,
      name: params.name,
      cronExpression: params.cronExpression,
      intervalMs: params.intervalMs,
      command: params.command,
      enabled: true,
      notifyOnComplete: params.notifyOnComplete ?? true,
      notifyOnError: params.notifyOnError ?? true,
    };
    
    this.tasks.set(task.id, task);
    this.saveTasks();
    
    // Start if enabled
    if (task.enabled && task.intervalMs) {
      this.startIntervalTask(task);
    }
    
    return task;
  }
  
  async removeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (task) {
      // Stop if running
      this.stopTask(taskId);
      this.tasks.delete(taskId);
      this.saveTasks();
      return true;
    }
    return false;
  }
  
  async listTasks(): Promise<ScheduledTask[]> {
    return [...this.tasks.values()];
  }
  
  async runTaskNow(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    await this.executeCommand(task.command);
    task.lastRun = Date.now();
    this.saveTasks();
  }
  
  private startIntervalTask(task: ScheduledTask): void {
    if (!task.intervalMs || task.intervalMs <= 0) return;
    
    const interval = setInterval(async () => {
      if (task.enabled) {
        await this.executeCommand(task.command);
        task.lastRun = Date.now();
        this.saveTasks();
      }
    }, task.intervalMs);
    
    this.intervals.set(task.id, interval);
  }
  
  stopTask(taskId: string): void {
    const interval = this.intervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }
    
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = false;
      this.saveTasks();
    }
  }
  
  resumeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.intervalMs) {
      task.enabled = true;
      this.startIntervalTask(task);
      this.saveTasks();
    }
  }
  
  private async executeCommand(command: string): Promise<string> {
    return new Promise((resolve) => {
      childProcess.exec(command, { timeout: 300000 }, (err, stdout, stderr) => {
        if (err) {
          resolve(`Error: ${err.message}`);
        } else {
          resolve(stdout || stderr);
        }
      });
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // Background Task Execution
  // ═══════════════════════════════════════════════════════════
  
  async runInBackground(params: {
    command: string;
    notifyOnComplete?: boolean;
  }): Promise<BackgroundTask> {
    const task: BackgroundTask = {
      id: `bg_${Date.now()}`,
      command: params.command,
      status: 'running',
      startTime: Date.now(),
      output: '',
      notifyOnComplete: params.notifyOnComplete ?? false,
    };
    
    this.backgroundTasks.set(task.id, task);
    
    // Start process
    const child = childProcess.spawn(params.command, [], {
      shell: true,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    task.pid = child.pid;
    
    // Capture output
    const outputChunks: Buffer[] = [];
    child.stdout?.on('data', (chunk) => outputChunks.push(chunk));
    child.stderr?.on('data', (chunk) => outputChunks.push(chunk));
    
    child.on('close', (code) => {
      task.status = code === 0 ? 'completed' : 'failed';
      task.endTime = Date.now();
      task.output = Buffer.concat(outputChunks).toString();
      
      // Cleanup after some time
      setTimeout(() => {
        this.backgroundTasks.delete(task.id);
      }, 60000);
    });
    
    child.on('error', (err) => {
      task.status = 'failed';
      task.endTime = Date.now();
      task.output = `Error: ${err.message}`;
    });
    
    return task;
  }
  
  async getBackgroundTask(taskId: string): Promise<BackgroundTask | null> {
    return this.backgroundTasks.get(taskId) || null;
  }
  
  async listBackgroundTasks(): Promise<BackgroundTask[]> {
    return [...this.backgroundTasks.values()];
  }
  
  async killBackgroundTask(taskId: string): Promise<boolean> {
    const task = this.backgroundTasks.get(taskId);
    if (task && task.pid) {
      try {
        process.kill(task.pid);
        task.status = 'failed';
        task.endTime = Date.now();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  
  getSchedulerStats(): {
    scheduledTasks: number;
    runningBackground: number;
    enabledTasks: number;
  } {
    let runningBackground = 0;
    for (const task of this.backgroundTasks.values()) {
      if (task.status === 'running') runningBackground++;
    }
    
    return {
      scheduledTasks: this.tasks.size,
      runningBackground,
      enabledTasks: [...this.tasks.values()].filter(t => t.enabled).length,
    };
  }
}

export const taskScheduler = new TaskScheduler();