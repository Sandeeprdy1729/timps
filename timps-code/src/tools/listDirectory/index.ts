import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RegisteredTool } from '../_shared/index.js';
import { resolvePath } from '../_shared/index.js';
import { formatSize } from '../../utils/utils.js';

export const listDirectory: RegisteredTool = {
  definition: {
    name: 'list_directory',
    description: 'List files and directories with sizes. Shows tree structure. Use depth to control recursion.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (default: current)' },
        depth: { type: 'number', description: 'Recursion depth (default: 2)' },
        showHidden: { type: 'string', description: 'Show hidden files (default: false)', enum: ['true', 'false'] },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const dp = resolvePath(String(args.path || '.'), cwd);
      const maxDepth = Number(args.depth) || 2;
      const showHidden = String(args.showHidden) === 'true';

      const lines: string[] = [dp];

      function walk(dir: string, prefix: string, depth: number) {
        if (depth > maxDepth) return;
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

        const filtered = entries.filter(e => showHidden || !e.name.startsWith('.'));
        const ignoreDirs = new Set(['node_modules', '.git', 'dist', '__pycache__', '.venv', 'build', 'target']);
        const visible = filtered.filter(e => !(e.isDirectory() && ignoreDirs.has(e.name)));

        visible.forEach((entry, i) => {
          const isLast = i === visible.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          const childPrefix = isLast ? '    ' : '│   ';

          let label = entry.name;
          if (entry.isFile()) {
            try {
              const size = fs.statSync(path.join(dir, entry.name)).size;
              label += ` ${formatSize(size)}`;
            } catch { /* ignore */ }
          } else if (entry.isDirectory()) {
            label += '/';
          }
          lines.push(prefix + connector + label);
          if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), prefix + childPrefix, depth + 1);
          }
        });
      }

      walk(dp, '', 0);
      return { content: lines.join('\n'), isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
