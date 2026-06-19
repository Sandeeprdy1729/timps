import type { RegisteredTool, ToolExecutor } from '../../tools/tools.js';
import { getTask, updateTask, deleteTask } from '../taskCreate/index.js';

type TaskStatus = 'pending' | 'in_progress' | 'completed';

export const taskUpdateTool: RegisteredTool = {
  definition: {
    name: 'task_update',
    description: 'Update a task: change subject, description, status, or delete it.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the task to update' },
        subject: { type: 'string', description: 'New subject for the task' },
        description: { type: 'string', description: 'New description for the task' },
        activeForm: { type: 'string', description: 'New active form for in_progress status' },
        status: { type: 'string', description: 'New status for the task', enum: ['pending', 'in_progress', 'completed', 'deleted'] },
        metadata: { type: 'object', description: 'Metadata keys to merge. Set a key to null to delete it.' },
      },
      required: ['taskId'],
    },
  },
  risk: 'medium',
  async execute(args) {
    const taskId = String(args.taskId);
    const existingTask = getTask(taskId);
    if (!existingTask) {
      return { content: `Task not found: ${taskId}`, isError: true };
    }
    const status = args.status ? String(args.status) : undefined;
    if (status === 'deleted') {
      deleteTask(taskId);
      return { content: `Task #${taskId} deleted`, isError: false };
    }
    const updates: Record<string, unknown> = {};
    if (args.subject !== undefined) updates.subject = String(args.subject);
    if (args.description !== undefined) updates.description = String(args.description);
    if (args.activeForm !== undefined) updates.activeForm = String(args.activeForm);
    if (status) updates.status = status as TaskStatus;
    if (args.metadata) {
      const meta = args.metadata as Record<string, unknown>;
      const merged = { ...(existingTask.metadata || {}) };
      for (const [k, v] of Object.entries(meta)) {
        if (v === null) delete merged[k];
        else merged[k] = v;
      }
      updates.metadata = merged;
    }
    const updated = updateTask(taskId, updates);
    const changedFields = Object.keys(updates);
    return {
      content: `Updated task #${taskId}: ${changedFields.join(', ')}`,
      isError: false,
    };
  },
};

export const TaskUpdateTool: ToolExecutor = async (args) => {
  const { id, status } = args as any;
  return { content: `Updated task ${id} to ${status}`, toolName: 'TaskUpdate' };
};