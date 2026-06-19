import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';
import { shellEscape } from '../../utils/utils.js';

export const gitDiff: RegisteredTool = {
  definition: {
    name: 'git_diff',
    description: 'Show git diff. Options: staged, unstaged, between commits/branches.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Omit for unstaged, "--staged" for staged, or "branch1..branch2"' },
        path: { type: 'string', description: 'Limit to specific file/directory' },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const target = String(args.target || '');
      const fp = args.path ? ` -- ${shellEscape(String(args.path))}` : '';
      const result = childProcess.execSync(
        `git --no-pager diff ${target}${fp}`,
        { cwd, encoding: 'utf-8', timeout: 15000, maxBuffer: 4 * 1024 * 1024 }
      ).trim();
      return { content: result || '(no changes)', isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
