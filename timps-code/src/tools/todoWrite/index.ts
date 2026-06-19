import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { RegisteredTool } from '../_shared/index.js';

export const todoWrite: RegisteredTool = {
  definition: {
    name: 'todo_write',
    description: 'Create or update a TODO task list for the current session. Use to track planned steps and mark completion.',
    inputSchema: {
      type: 'object',
      properties: {
        todos: { type: 'string', description: 'JSON array of {id, title, status, priority} objects' },
      },
      required: ['todos'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const todos = JSON.parse(String(args.todos));
      const todoFile = path.join(os.homedir(), '.timps', 'todos.json');
      fs.writeFileSync(todoFile, JSON.stringify(todos, null, 2), 'utf-8');
      const summary = todos.map((t: any) => {
        const s = t.status === 'completed' ? '✔' : t.status === 'in_progress' ? '◐' : '○';
        return `${s} ${t.title}`;
      }).join('\n');
      return { content: `TODOs updated:\n${summary}`, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

export const TodoWriteTool = async (args: Record<string, unknown>) => {
  const { content, status } = args as any;
  return {
    content: `Todo: ${content} [${status || 'pending'}]`,
    toolName: 'TodoWrite',
  };
};
