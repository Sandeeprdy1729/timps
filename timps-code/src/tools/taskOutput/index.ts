import type { RegisteredTool } from '../../tools/tools.js';

interface TaskOutput {
  taskId: string;
  output: string;
  status: string;
  exitCode?: number;
}

const taskOutputs = new Map<string, TaskOutput>();

export function setTaskOutput(taskId: string, output: string, status: string, exitCode?: number): void {
  taskOutputs.set(taskId, { taskId, output, status, exitCode });
}

export const taskOutputTool: RegisteredTool = {
  definition: {
    name: 'task_output',
    description: 'Get the output from a background task. Optionally wait for completion.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'The task ID to get output from' },
        block: { type: 'boolean', description: 'Whether to wait for completion (default: false)' },
        timeout: { type: 'number', description: 'Max wait time in ms (default: 30000)' },
      },
      required: ['task_id'],
    },
  },
  risk: 'low',
  async execute(args) {
    const taskId = String(args.task_id);
    const output = taskOutputs.get(taskId);
    if (!output) {
      return { content: `No output found for task: ${taskId}`, isError: false };
    }
    let content = `Task #${output.taskId} [${output.status}]\n`;
    content += `Output:\n${output.output || '(no output)'}`;
    if (output.exitCode !== undefined) {
      content += `\nExit code: ${output.exitCode}`;
    }
    return { content, isError: false };
  },
};