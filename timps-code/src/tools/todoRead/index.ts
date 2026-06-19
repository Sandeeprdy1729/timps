import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { RegisteredTool } from '../_shared/index.js';

export const todoRead: RegisteredTool = {
  definition: {
    name: 'todo_read',
    description: 'Read the current TODO task list.',
    inputSchema: { type: 'object', properties: {} },
  },
  risk: 'low',
  async execute() {
    try {
      const todoFile = path.join(os.homedir(), '.timps', 'todos.json');
      if (!fs.existsSync(todoFile)) return { content: '(no todos)', isError: false };
      const todos = JSON.parse(fs.readFileSync(todoFile, 'utf-8'));
      const summary = todos.map((t: any) => {
        const s = t.status === 'completed' ? '✔' : t.status === 'in_progress' ? '◐' : '○';
        const p = t.priority === 'urgent' ? '!' : t.priority === 'high' ? '↑' : ' ';
        return `${s} ${p} [${t.id}] ${t.title}`;
      }).join('\n');
      return { content: summary || '(empty)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

export const TodoReadTool = async () => {
  return {
    content: 'Todo list from session memory',
    toolName: 'TodoRead',
  };
};
