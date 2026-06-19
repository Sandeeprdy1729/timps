import type { RegisteredTool, ToolExecutor } from '../../tools/tools.js';
import { generateId } from '../../utils/utils.js';

interface Task {
  id: string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

const tasks = new Map<string, Task>();
let nextId = 1;

export const taskCreateTool: RegisteredTool = {
  definition: {
    name: 'task_create',
    description: 'Create a new task in the task list. Use to track work items that need to be done.',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'A brief title for the task' },
        description: { type: 'string', description: 'What needs to be done' },
        activeForm: { type: 'string', description: 'Present continuous form shown when in_progress (e.g., "Running tests")' },
        metadata: { type: 'object', description: 'Arbitrary metadata to attach to the task' },
      },
      required: ['subject', 'description'],
    },
  },
  risk: 'low',
  async execute(args) {
    const id = String(nextId++);
    const task: Task = {
      id,
      subject: String(args.subject),
      description: String(args.description),
      status: 'pending',
      activeForm: args.activeForm ? String(args.activeForm) : undefined,
      metadata: args.metadata as Record<string, unknown> | undefined,
      createdAt: Date.now(),
    };
    tasks.set(id, task);
    return {
      content: `Task #${id} created: ${task.subject}\nDescription: ${task.description}`,
      isError: false,
    };
  },
};

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function listTasks(): Task[] {
  return Array.from(tasks.values());
}

export function updateTask(id: string, updates: Partial<Task>): Task | undefined {
  const task = tasks.get(id);
  if (!task) return undefined;
  const updated = { ...task, ...updates };
  tasks.set(id, updated);
  return updated;
}

export function deleteTask(id: string): boolean {
  return tasks.delete(id);
}

export const TaskCreateTool: ToolExecutor = async (args) => {
  const { title, priority } = args as any;
  const id = generateId('task');
  return { content: `Created task: ${id} - ${title}`, toolName: 'TaskCreate' };
};