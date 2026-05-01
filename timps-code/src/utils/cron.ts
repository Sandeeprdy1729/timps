// TIMPS Cron — Scheduled Tasks
// Built-in cron scheduler with delivery to any platform

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateId } from './utils.js';

export interface CronTask {
  id: string;
  name: string;
  description: string;
  schedule: string;
  command: string;
  delivery: string[];
  enabled: boolean;
  lastRun: number | null;
  nextRun: number | null;
  lastStatus: 'success' | 'failed' | null;
  createdAt: number;
  runCount: number;
}

export interface CronManifest {
  tasks: CronTask[];
  version: string;
}

const CRON_DIR = path.join(os.homedir(), '.timps', 'cron');
const MANIFEST_FILE = path.join(CRON_DIR, 'tasks.json');

export class CronScheduler {
  private manifest: CronManifest;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private callback: ((task: CronTask, output: string) => Promise<void>) | null = null;

  constructor() {
    this.manifest = this.loadManifest();
  }

  private loadManifest(): CronManifest {
    try {
      if (fs.existsSync(MANIFEST_FILE)) {
        return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
      }
    } catch { /* ignore */ }
    return { tasks: [], version: '1.0' };
  }

  private saveManifest(): void {
    fs.mkdirSync(CRON_DIR, { recursive: true });
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(this.manifest, null, 2), 'utf-8');
  }

  onOutput(callback: (task: CronTask, output: string) => Promise<void>): void {
    this.callback = callback;
  }

  listTasks(): CronTask[] {
    return this.manifest.tasks.sort((a, b) => (a.nextRun || 0) - (b.nextRun || 0));
  }

  getTask(id: string): CronTask | null {
    return this.manifest.tasks.find(t => t.id === id) || null;
  }

  addTask(task: Omit<CronTask, 'id' | 'lastRun' | 'nextRun' | 'lastStatus' | 'createdAt' | 'runCount'>): CronTask {
    const newTask: CronTask = {
      ...task,
      id: generateId('cron'),
      lastRun: null,
      nextRun: this.calculateNextRun(task.schedule),
      lastStatus: null,
      createdAt: Date.now(),
      runCount: 0,
    };

    this.manifest.tasks.push(newTask);
    this.saveManifest();
    
    if (newTask.enabled) {
      this.scheduleTask(newTask);
    }
    
    return newTask;
  }

  updateTask(id: string, updates: Partial<CronTask>): CronTask | null {
    const task = this.manifest.tasks.find(t => t.id === id);
    if (!task) return null;

    Object.assign(task, updates);
    
    if (updates.schedule) {
      task.nextRun = this.calculateNextRun(task.schedule);
    }
    
    this.saveManifest();
    this.rescheduleAll();
    
    return task;
  }

  deleteTask(id: string): boolean {
    const idx = this.manifest.tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;

    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }

    this.manifest.tasks.splice(idx, 1);
    this.saveManifest();
    
    return true;
  }

  toggleTask(id: string, enabled: boolean): boolean {
    const task = this.manifest.tasks.find(t => t.id === id);
    if (!task) return false;

    task.enabled = enabled;
    this.saveManifest();

    if (enabled) {
      task.nextRun = this.calculateNextRun(task.schedule);
      this.scheduleTask(task);
    } else {
      const interval = this.intervals.get(id);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(id);
      }
      task.nextRun = null;
    }
    
    return true;
  }

  async runTask(id: string): Promise<{ output: string; status: 'success' | 'failed' }> {
    const task = this.manifest.tasks.find(t => t.id === id);
    if (!task) {
      return { output: 'Task not found', status: 'failed' };
    }

    let output = '';
    try {
      const { execSync } = await import('node:child_process');
      output = String(execSync(task.command, { encoding: 'utf-8', timeout: 300000 }));
      task.lastStatus = 'success';
    } catch (err: any) {
      output = err.message;
      task.lastStatus = 'failed';
    }

    task.lastRun = Date.now();
    task.runCount++;
    task.nextRun = this.calculateNextRun(task.schedule);
    this.saveManifest();

    if (this.callback) {
      await this.callback(task, output);
    }

    return { output, status: task.lastStatus };
  }

  private calculateNextRun(schedule: string): number | null {
    const [min] = schedule.split(' ');
    const now = new Date();
    const next = new Date(now);
    
    if (min === '*') {
      next.setMinutes(now.getMinutes() + 1);
    } else if (!isNaN(Number(min))) {
      next.setMinutes(Number(min));
      if (next <= now) next.setHours(next.getHours() + 1);
    }
    
    return next.getTime();
  }

  private scheduleTask(task: CronTask): void {
    const interval = this.intervals.get(task.id);
    if (interval) clearInterval(interval);

    const checkInterval = setInterval(() => {
      if (!task.enabled) return;
      
      const now = Date.now();
      if (task.nextRun && now >= task.nextRun) {
        this.runTask(task.id);
      }
    }, 60000);

    this.intervals.set(task.id, checkInterval);
  }

  rescheduleAll(): void {
    for (const task of this.manifest.tasks) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }
  }

  stopAll(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  getStats(): { total: number; enabled: number; lastRun: number | null } {
    return {
      total: this.manifest.tasks.length,
      enabled: this.manifest.tasks.filter(t => t.enabled).length,
      lastRun: this.manifest.tasks.reduce((max, t) => Math.max(max, t.lastRun || 0), 0),
    };
  }
}

export const cronScheduler = new CronScheduler();

export async function handleCronCommand(args: string[]): Promise<string> {
  if (args[0] === 'list' || !args[0]) {
    const tasks = cronScheduler.listTasks();
    if (tasks.length === 0) return 'No cron tasks. Run: timps cron add "0 9 * * *" "task"';
    
    return 'Cron Tasks:\n' + tasks.map(t => 
      `${t.enabled ? '✓' : '○'} ${t.schedule} — ${t.name} (${t.runCount} runs)`
    ).join('\n');
  }

  if (args[0] === 'add' && args[1] && args[2]) {
    const schedule = args[1];
    const command = args.slice(2).join(' ');
    
    const task = cronScheduler.addTask({
      name: command.split(' ').slice(0, 3).join(' '),
      description: '',
      schedule,
      command,
      delivery: ['console'],
      enabled: true,
    });
    
    return `Added cron task: ${task.id}`;
  }

  if (args[0] === 'run' && args[1]) {
    const result = await cronScheduler.runTask(args[1]);
    return `Task ${args[1]}: ${result.status}\n${result.output}`;
  }

  if (args[0] === 'enable' && args[1]) {
    cronScheduler.toggleTask(args[1], true);
    return `Enabled task: ${args[1]}`;
  }

  if (args[0] === 'disable' && args[1]) {
    cronScheduler.toggleTask(args[1], false);
    return `Disabled task: ${args[1]}`;
  }

  if (args[0] === 'delete' && args[1]) {
    cronScheduler.deleteTask(args[1]);
    return `Deleted task: ${args[1]}`;
  }

  return `Usage: timps cron <list|add|run|enable|disable|delete>`;
}