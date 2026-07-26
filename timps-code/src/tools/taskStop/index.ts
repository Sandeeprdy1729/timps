import type { RegisteredTool } from '../../tools/tools.js';
import { getCoordinatorService } from '../../services/coordinator/index.js';

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
    description: 'Stop a running background task or coordinator worker by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'The ID of the background task or worker to stop' },
        shell_id: { type: 'string', description: 'Deprecated: use task_id instead' },
      },
      required: ['task_id'],
    },
  },
  risk: 'medium',
  async execute(args) {
    const taskId = String(args.task_id || args.shell_id);

    // Check shell background tasks first
    const task = runningTasks.get(taskId);
    if (task) {
      if (task.status !== 'running') {
        return { content: `Task ${taskId} is not running (status: ${task.status})`, isError: true };
      }
      task.status = 'stopped';
      return {
        content: `Successfully stopped task: ${taskId} (${task.command})`,
        isError: false,
      };
    }

    // Check coordinator workers
    const coordinator = getCoordinatorService();
    const worker = coordinator.getWorker(taskId);
    if (worker) {
      if (worker.status === 'completed' || worker.status === 'failed' || worker.status === 'stopped') {
        return { content: `Worker ${taskId} is already ${worker.status}`, isError: true };
      }
      const stopped = coordinator.stopWorker(taskId);
      if (stopped) {
        return {
          content: `Successfully stopped worker: ${taskId} (${worker.description})`,
          isError: false,
        };
      }
      return { content: `Failed to stop worker: ${taskId}`, isError: true };
    }

    return { content: `No task or worker found with ID: ${taskId}`, isError: true };
  },
};