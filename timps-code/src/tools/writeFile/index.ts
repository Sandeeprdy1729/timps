import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RegisteredTool } from '../_shared/index.js';
import { resolvePath } from '../_shared/index.js';

export const writeFile: RegisteredTool = {
  definition: {
    name: 'write_file',
    description: 'Create or overwrite a file. Creates parent directories automatically. Prefer edit_file for modifications.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'Full file content' },
      },
      required: ['path', 'content'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      const fp = resolvePath(String(args.path), cwd);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      const existed = fs.existsSync(fp);
      fs.writeFileSync(fp, String(args.content), 'utf-8');
      const lines = String(args.content).split('\n').length;
      return { content: `${existed ? 'Updated' : 'Created'} ${args.path} (${lines} lines)`, isError: false, filesModified: [fp] };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

export const WriteTool = async (args: Record<string, unknown>) => {
  const { path: filePath, content } = args as any;
  const fs = await import('node:fs');

  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return {
      content: `Wrote ${filePath}`,
      toolName: 'Write',
    };
  } catch (err: any) {
    return {
      content: `Write error: ${err.message}`,
      isError: true,
      toolName: 'Write',
    };
  }
};
