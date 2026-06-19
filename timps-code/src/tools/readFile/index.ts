import * as fs from 'node:fs';
import type { RegisteredTool } from '../_shared/index.js';
import { resolvePath } from '../_shared/index.js';

export const readFile: RegisteredTool = {
  definition: {
    name: 'read_file',
    description: 'Read file contents. Use startLine/endLine for large files. Returns numbered lines.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path (relative or absolute)' },
        startLine: { type: 'number', description: 'Start line, 1-based (optional)' },
        endLine: { type: 'number', description: 'End line, 1-based (optional)' },
      },
      required: ['path'],
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      const fp = resolvePath(String(args.path), cwd);
      const content = fs.readFileSync(fp, 'utf-8');
      const lines = content.split('\n');

      if (args.startLine || args.endLine) {
        const s = Math.max(1, Number(args.startLine) || 1) - 1;
        const e = Math.min(lines.length, Number(args.endLine) || lines.length);
        return { content: lines.slice(s, e).map((l, i) => `${s + i + 1}│ ${l}`).join('\n'), isError: false };
      }

      const numbered = lines.map((l, i) => `${i + 1}│ ${l}`).join('\n');
      if (lines.length > 500) {
        return { content: `⚠ Large file (${lines.length} lines). Use startLine/endLine for targeted reads.\n\n${numbered}`, isError: false };
      }
      return { content: numbered, isError: false };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

export const ReadTool = async (args: Record<string, unknown>) => {
  const { path: filePath, limit, offset } = args as any;
  const fs = await import('node:fs');

  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    if (offset || limit) {
      const lines = content.split('\n');
      if (offset) content = lines.slice(Number(offset)).join('\n');
      if (limit) content = lines.slice(0, Number(limit)).join('\n');
    }

    return {
      content: content.slice(0, 50000),
      toolName: 'Read',
    };
  } catch (err: any) {
    return {
      content: `Read error: ${err.message}`,
      isError: true,
      toolName: 'Read',
    };
  }
};
