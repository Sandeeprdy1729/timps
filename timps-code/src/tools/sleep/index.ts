// TIMPS Code — Sleep Tool
// Scheduled delays and background task triggers

import type { RegisteredTool } from '../../tools/tools.js';

export interface SleepOptions {
  duration: number;
  reason?: string;
  wakeCondition?: string;
}

export const sleepTool: RegisteredTool = {
  definition: {
    name: 'sleep',
    description: 'Wait for a specified duration before continuing. Useful for polling, rate limiting, or scheduled tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        duration: {
          type: 'number',
          description: 'Duration in milliseconds to sleep',
        },
        reason: {
          type: 'string',
          description: 'Optional reason for the sleep (for logging)',
        },
        until: {
          type: 'string',
          description: 'ISO timestamp to sleep until (alternative to duration)',
        },
      },
      required: ['duration'],
    },
  },
  risk: 'low',
  async execute(args) {
    let durationMs = Number(args.duration);

    if (args.until) {
      const targetTime = new Date(String(args.until)).getTime();
      durationMs = Math.max(0, targetTime - Date.now());
    }

    if (durationMs < 0) {
      return { content: 'Target time already passed', isError: false };
    }

    const reason = args.reason ? ` (${args.reason})` : '';
    console.log(`[sleep] Sleeping for ${durationMs}ms${reason}`);

    await new Promise(resolve => setTimeout(resolve, durationMs));

    return { content: `Slept for ${durationMs}ms`, isError: false };
  },
};

export const WAKE_CONDITIONS = {
  timeout: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  interval: async (fn: () => boolean, intervalMs: number, maxMs: number) => {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (fn()) return true;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return false;
  },
  poll: async <T>(fn: () => Promise<T>, check: (val: T) => boolean, intervalMs: number, maxMs: number) => {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const val = await fn();
      if (check(val)) return val;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return null;
  },
};

export class ScheduledTask {
  private id: string;
  private fn: () => void | Promise<void>;
  private intervalMs: number;
  private isRunning = false;
  private timeoutId?: NodeJS.Timeout;

  constructor(id: string, fn: () => void | Promise<void>, intervalMs: number) {
    this.id = id;
    this.fn = fn;
    this.intervalMs = intervalMs;
  }

  start(): void {
    this.isRunning = true;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (!this.isRunning) return;
    this.timeoutId = setTimeout(async () => {
      try {
        await this.fn();
      } catch (err) {
        console.error(`[scheduled:${this.id}] Error:`, err);
      }
      this.scheduleNext();
    }, this.intervalMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  getId(): string {
    return this.id;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}

class ScheduledTaskManager {
  private tasks = new Map<string, ScheduledTask>();

  create(id: string, fn: () => void | Promise<void>, intervalMs: number): ScheduledTask {
    const task = new ScheduledTask(id, fn, intervalMs);
    this.tasks.set(id, task);
    return task;
  }

  get(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  remove(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }
  }

  list(): Array<{ id: string; isRunning: boolean }> {
    return Array.from(this.tasks.entries()).map(([id, task]) => ({
      id,
      isRunning: task.getIsRunning(),
    }));
  }

  stopAll(): void {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
  }
}

export const taskManager = new ScheduledTaskManager();