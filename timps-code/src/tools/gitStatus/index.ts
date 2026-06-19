import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';

export const gitStatus: RegisteredTool = {
  definition: {
    name: 'git_status',
    description: 'Show git repository status: branch, changes, staging area.',
    inputSchema: { type: 'object', properties: {} },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const status = childProcess.execSync('git status', { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
      const branch = childProcess.execSync('git branch --show-current', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      return { content: `Branch: ${branch}\n\n${status}`, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
