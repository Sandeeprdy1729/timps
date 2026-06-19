import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';
import { shellEscape } from '../../utils/utils.js';

export const gitLog: RegisteredTool = {
  definition: {
    name: 'git_log',
    description: 'Show git commit history with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of commits (default: 15)' },
        branch: { type: 'string', description: 'Branch name' },
        author: { type: 'string', description: 'Filter by author' },
        path: { type: 'string', description: 'Filter by file path' },
        oneline: { type: 'string', description: 'Oneline format (default: true)', enum: ['true', 'false'] },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const n = Number(args.count) || 15;
      const parts = ['git', '--no-pager', 'log', `-${n}`];
      if (String(args.oneline) !== 'false') parts.push('--oneline', '--graph', '--decorate');
      if (args.branch) parts.push(String(args.branch));
      if (args.author) parts.push(`--author=${shellEscape(String(args.author))}`);
      if (args.path) parts.push('--', shellEscape(String(args.path)));
      const result = childProcess.execSync(parts.join(' '), { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
      return { content: result || '(no commits)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
