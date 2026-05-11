import type { RegisteredTool } from '../../tools/tools.js';

interface RunningTask {
  id: string;
  status: string;
  command: string;
}

const runningTasks = new Map<string, RunningTask>();

export function registerRunningTask(id: string, command: string): void {
  runningTasks.set(id, { id, status: 'running', command });
}

export const taskStopTool: RegisteredTool = {
  definition: {
    name: 'task_stop',
    description: 'Stop a running background task by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'The ID of the background task to stop' },
        shell_id: { type: 'string', description: 'Deprecated: use task_id instead' },
      },
      required: ['task_id'],
    },
  },
  risk: 'medium',
  async execute(args) {
    const taskId = String(args.task_id || args.shell_id);
    const task = runningTasks.get(taskId);
    if (!task) {
      return { content: `No task found with ID: ${taskId}`, isError: true };
    }
    if (task.status !== 'running') {
      return { content: `Task ${taskId} is not running (status: ${task.status})`, isError: true };
    }
    task.status = 'stopped';
    return {
      content: `Successfully stopped task: ${taskId} (${task.command})`,
      isError: false,
    };
  },
};