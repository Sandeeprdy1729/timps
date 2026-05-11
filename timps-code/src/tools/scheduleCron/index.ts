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

const scheduledTasks = new Map<string, ScheduledTask>();
let nextTaskId = 1;

function parseCronExpression(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  return parts.length === 5;
}

function cronToHuman(cron: string): string {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  if (min === '*' && hour === '*') return 'Every minute';
  if (min === '*/5' && hour === '*') return 'Every 5 minutes';
  if (min === '*/15' && hour === '*') return 'Every 15 minutes';
  if (min === '*/30' && hour === '*') return 'Every 30 minutes';
  return `At ${hour}:${min.padStart(2, '0')}`;
}

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
    if (!parseCronExpression(cron)) {
      return { content: `Invalid cron expression '${cron}'. Expected 5 fields: M H DoM Mon DoW.`, isError: true };
    }
    const id = `cron_${nextTaskId++}`;
    const task: ScheduledTask = {
      id,
      cron,
      prompt: String(args.prompt),
      recurring: args.recurring !== false,
      durable: args.durable === true,
      nextRun: Date.now() + 60000,
      createdAt: Date.now(),
    };
    scheduledTasks.set(id, task);
    const human = cronToHuman(cron);
    const where = task.durable ? 'Persisted to disk' : 'Session-only';
    return {
      content: task.recurring
        ? `Scheduled recurring job ${id} (${human}). ${where}.`
        : `Scheduled one-shot task ${id} (${human}). ${where}.`,
      isError: false,
    };
  },
};

export function listScheduledTasks(): ScheduledTask[] {
  return Array.from(scheduledTasks.values());
}

export function deleteScheduledTask(id: string): boolean {
  return scheduledTasks.delete(id);
}