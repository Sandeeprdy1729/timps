import type { RegisteredTool, ToolExecutor } from '../../tools/tools.js';
import { listTasks } from '../taskCreate/index.js';

export const taskListTool: RegisteredTool = {
  definition: {
    name: 'task_list',
    description: 'List all tasks in the task list. Shows task IDs, subjects, and statuses.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: pending, in_progress, completed', enum: ['pending', 'in_progress', 'completed'] },
      },
    },
  },
  risk: 'low',
  async execute(args) {
    let tasks = listTasks();
    if (args.status) {
      tasks = tasks.filter(t => t.status === args.status);
    }
    if (tasks.length === 0) {
      return { content: 'No tasks found', isError: false };
    }
    const lines = tasks.map(t => {
      const statusIcon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '◐' : '○';
      return `${statusIcon} #${t.id} [${t.status}] ${t.subject}`;
    });
    return { content: lines.join('\n'), isError: false };
  },
};

export const TaskListTool: ToolExecutor = async () => {
  return { content: `Tasks:\n  - Task list here (from storage)`, toolName: 'TaskList' };
};