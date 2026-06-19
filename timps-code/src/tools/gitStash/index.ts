import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';
import { shellEscape } from '../../utils/utils.js';

export const gitStash: RegisteredTool = {
  definition: {
    name: 'git_stash',
    description: 'Git stash operations: push, pop, list, apply, drop, show.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Stash action', enum: ['push', 'pop', 'apply', 'list', 'drop', 'show'] },
        message: { type: 'string', description: 'Stash message (for push)' },
        index: { type: 'number', description: 'Stash index (default: 0)' },
      },
      required: ['action'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      const action = String(args.action);
      const idx = Number(args.index) || 0;
      let cmd: string;
      switch (action) {
        case 'push':  cmd = `git stash push -m ${shellEscape(String(args.message || 'timps-stash'))}`; break;
        case 'pop':   cmd = `git stash pop stash@{${idx}}`; break;
        case 'apply': cmd = `git stash apply stash@{${idx}}`; break;
        case 'list':  cmd = 'git stash list'; break;
        case 'drop':  cmd = `git stash drop stash@{${idx}}`; break;
        case 'show':  cmd = `git --no-pager stash show -p stash@{${idx}}`; break;
        default: return { content: `Unknown action: ${action}`, isError: true };
      }
      const result = childProcess.execSync(cmd, { cwd, encoding: 'utf-8', timeout: 10000 }).trim();
      return { content: result || '(done)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
