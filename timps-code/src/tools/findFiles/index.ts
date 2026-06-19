import { glob } from 'glob';
import type { RegisteredTool } from '../_shared/index.js';
import { resolvePath } from '../_shared/index.js';

export const findFiles: RegisteredTool = {
  definition: {
    name: 'find_files',
    description: 'Find files matching a glob pattern. Fast file discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.test.*")' },
        cwd: { type: 'string', description: 'Base directory (default: project root)' },
        maxResults: { type: 'number', description: 'Max results (default: 100)' },
      },
      required: ['pattern'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const base = args.cwd ? resolvePath(String(args.cwd), cwd) : cwd;
      const max = Number(args.maxResults) || 100;

      const files = await glob(String(args.pattern), {
        cwd: base,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/__pycache__/**', '**/.venv/**'],
        maxDepth: 10,
      });

      const sorted = files.sort().slice(0, max);
      if (sorted.length === 0) return { content: `No files matching: ${args.pattern}`, isError: false };
      return { content: sorted.join('\n') + (files.length > max ? `\n... (${files.length - max} more)` : ''), isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
