import type { RegisteredTool } from '../../tools/tools.js';
import { getTask } from '../taskCreate/index.js';

export const taskGetTool: RegisteredTool = {
  definition: {
    name: 'task_get',
    description: 'Retrieve a task by its ID. Returns task details including status and description.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to retrieve' },
      },
      required: ['taskId'],
    },
  },
  risk: 'low',
  async execute(args) {
    const taskId = String(args.taskId);
    const task = getTask(taskId);
    if (!task) {
      return { content: `Task not found: ${taskId}`, isError: true };
    }
    const lines = [
      `Task #${task.id}: ${task.subject}`,
      `Status: ${task.status}`,
      `Description: ${task.description}`,
      `Created: ${new Date(task.createdAt).toLocaleString()}`,
    ];
    if (task.activeForm) lines.push(`Active form: ${task.activeForm}`);
    if (task.metadata && Object.keys(task.metadata).length > 0) {
      lines.push(`Metadata: ${JSON.stringify(task.metadata)}`);
    }
    return { content: lines.join('\n'), isError: false };
  },
};