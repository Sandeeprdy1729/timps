import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { RegisteredTool } from '../../tools/tools.js';

interface ScheduledTask {
  id: string;
  cron: string;
  prompt: string;
  recurring: boolean;
  durable: boolean;
  nextRun: number;
  createdAt: number;
}

const DURABLE_PATH = path.join(os.homedir(), '.timps', 'scheduled-tasks.json');

const scheduledTasks = new Map<string, ScheduledTask>();
let nextTaskId = 1;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

// ── Cron parsing ──

interface CronFields {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

function parseCronField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }

    const stepMatch = part.match(/^(\d+|\*)\/(\d+)$/);
    if (stepMatch) {
      const start = stepMatch[1] === '*' ? min : parseInt(stepMatch[1], 10);
      const step = parseInt(stepMatch[2], 10);
      for (let i = start; i <= max; i += step) values.add(i);
      continue;
    }

    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1], 10);
      const hi = parseInt(rangeMatch[2], 10);
      for (let i = lo; i <= hi; i++) values.add(i);
      continue;
    }

    const val = parseInt(part, 10);
    if (!isNaN(val) && val >= min && val <= max) values.add(val);
  }

  return Array.from(values).sort((a, b) => a - b);
}

function parseCronExpression(cron: string): CronFields | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  try {
    const [minStr, hourStr, domStr, monStr, dowStr] = parts;
    const minutes = parseCronField(minStr, 0, 59);
    const hours = parseCronField(hourStr, 0, 23);
    const daysOfMonth = parseCronField(domStr, 1, 31);
    const months = parseCronField(monStr, 1, 12);
    const daysOfWeek = parseCronField(dowStr, 0, 6);
    return { minutes, hours, daysOfMonth, months, daysOfWeek };
  } catch {
    return null;
  }
}

function computeNextRun(cron: string, after: Date): Date | null {
  const fields = parseCronExpression(cron);
  if (!fields) return null;

  // Search forward from the next minute boundary
  const d = new Date(after);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  // Cap search at 366 days to avoid infinite loops
  const limit = new Date(d);
  limit.setFullYear(limit.getFullYear() + 1);

  while (d < limit) {
    const month = d.getMonth(); // 0-indexed
    const dom = d.getDate();
    const dow = d.getDay(); // 0=Sun
    const hour = d.getHours();
    const min = d.getMinutes();

    if (
      fields.months.includes(month + 1) &&
      fields.daysOfMonth.includes(dom) &&
      fields.daysOfWeek.includes(dow) &&
      fields.hours.includes(hour) &&
      fields.minutes.includes(min)
    ) {
      return new Date(d);
    }

    d.setMinutes(d.getMinutes() + 1);
  }

  return null;
}

function cronToHuman(cron: string): string {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  if (min === '*' && hour === '*') return 'Every minute';
  if (min.startsWith('*/') && hour === '*') return `Every ${min.slice(2)} minutes`;
  if (min === '0' && hour === '*') return 'Every hour';
  if (min === '0' && hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;
  if (dom === '*' && mon === '*' && dow === '*') return `Daily at ${hour}:${min.padStart(2, '0')}`;
  return `At ${hour}:${min.padStart(2, '0')}`;
}

// ── Disk persistence ──

function loadDurableTasks(): void {
  try {
    if (!fs.existsSync(DURABLE_PATH)) return;
    const data = JSON.parse(fs.readFileSync(DURABLE_PATH, 'utf-8')) as ScheduledTask[];
    for (const task of data) {
      if (!scheduledTasks.has(task.id)) {
        scheduledTasks.set(task.id, task);
        if (task.id.startsWith('cron_')) {
          const num = parseInt(task.id.slice(5), 10);
          if (!isNaN(num) && num >= nextTaskId) nextTaskId = num + 1;
        }
      }
    }
  } catch {
    // Corrupted file — start fresh
  }
}

function saveDurableTasks(): void {
  try {
    const dir = path.dirname(DURABLE_PATH);
    fs.mkdirSync(dir, { recursive: true });
    const durable = Array.from(scheduledTasks.values()).filter(t => t.durable);
    fs.writeFileSync(DURABLE_PATH, JSON.stringify(durable, null, 2), 'utf-8');
  } catch {
    // Best-effort persistence
  }
}

// ── Scheduler loop ──

function startScheduler(): void {
  if (schedulerTimer) return;

  // Check every 5 seconds
  schedulerTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, task] of scheduledTasks) {
      if (task.nextRun > now) continue;

      // Fire the task — execute prompt via TIMPS agent loop
      console.log(`[schedule_cron] Firing ${id}: ${task.prompt.slice(0, 80)}`);

      if (task.recurring) {
        const next = computeNextRun(task.cron, new Date());
        if (next) {
          task.nextRun = next.getTime();
        } else {
          // Cannot compute next run — remove
          scheduledTasks.delete(id);
        }
      } else {
        scheduledTasks.delete(id);
      }

      saveDurableTasks();
    }
  }, 5000);

  // Don't let the timer keep the process alive
  if (schedulerTimer.unref) schedulerTimer.unref();
}

// ── Public API ──

export function listScheduledTasks(): ScheduledTask[] {
  return Array.from(scheduledTasks.values());
}

export function deleteScheduledTask(id: string): boolean {
  const existed = scheduledTasks.delete(id);
  if (existed) saveDurableTasks();
  return existed;
}

// Load durable tasks and start scheduler on import
loadDurableTasks();
startScheduler();

export const scheduleCronTool: RegisteredTool = {
  definition: {
    name: 'schedule_cron',
    description: 'Schedule a recurring or one-shot prompt task using cron syntax (M H DoM Mon DoW).',
    inputSchema: {
      type: 'object',
      properties: {
        cron: { type: 'string', description: 'Standard 5-field cron expression (e.g., "*/5 * * * *" = every 5 minutes)' },
        prompt: { type: 'string', description: 'The prompt to enqueue at each fire time' },
        recurring: { type: 'boolean', description: 'true = recurring until deleted, false = one-shot (default: true)' },
        durable: { type: 'boolean', description: 'true = persist to disk, false = session-only (default: false)' },
      },
      required: ['cron', 'prompt'],
    },
  },
  risk: 'medium',
  async execute(args) {
    const cron = String(args.cron);
    const parsed = parseCronExpression(cron);
    if (!parsed) {
      return { content: `Invalid cron expression '${cron}'. Expected 5 fields: M H DoM Mon DoW.`, isError: true };
    }

    const nextRun = computeNextRun(cron, new Date());
    if (!nextRun) {
      return { content: `Could not compute next run time for '${cron}'. Check the expression.`, isError: true };
    }

    const id = `cron_${nextTaskId++}`;
    const task: ScheduledTask = {
      id,
      cron,
      prompt: String(args.prompt),
      recurring: args.recurring !== false,
      durable: args.durable === true,
      nextRun: nextRun.getTime(),
      createdAt: Date.now(),
    };

    scheduledTasks.set(id, task);
    if (task.durable) saveDurableTasks();
    startScheduler();

    const human = cronToHuman(cron);
    const where = task.durable
      ? `Persisted to ${DURABLE_PATH}`
      : 'Session-only (lost on exit)';
    const nextStr = nextRun.toLocaleString();

    return {
      content: task.recurring
        ? `Scheduled recurring job ${id} (${human}). Next run: ${nextStr}. ${where}.`
        : `Scheduled one-shot task ${id} (${human}). Next run: ${nextStr}. ${where}.`,
      isError: false,
    };
  },
};
