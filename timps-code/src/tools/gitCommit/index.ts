import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';
import { shellEscape } from '../../utils/utils.js';

export const gitCommit: RegisteredTool = {
  definition: {
    name: 'git_commit',
    description: 'Stage all changes and commit with a message.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' },
        stageAll: { type: 'string', description: 'Stage all changes (default: true)', enum: ['true', 'false'] },
      },
      required: ['message'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      if (String(args.stageAll) !== 'false') {
        childProcess.execSync('git add -A', { cwd, encoding: 'utf-8', timeout: 10000 });
      }
      const result = childProcess.execSync(
        `git commit -m ${shellEscape(String(args.message))}`,
        { cwd, encoding: 'utf-8', timeout: 15000 }
      ).trim();
      return { content: result, isError: false };
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message: string };
      return { content: err.stderr?.toString() || err.message, isError: true };
    }
  },
};
