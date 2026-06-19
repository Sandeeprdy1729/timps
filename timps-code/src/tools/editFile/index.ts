import * as fs from 'node:fs';
import { createPatch } from 'diff';
import type { RegisteredTool } from '../_shared/index.js';
import { resolvePath } from '../_shared/index.js';

export const editFile: RegisteredTool = {
  definition: {
    name: 'edit_file',
    description: 'Replace exact text in a file. oldString must be unique and match exactly. Shows a diff on success. Preferred over write_file for modifications.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        oldString: { type: 'string', description: 'Exact text to find (must appear exactly once)' },
        newString: { type: 'string', description: 'Replacement text' },
      },
      required: ['path', 'oldString', 'newString'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      const fp = resolvePath(String(args.path), cwd);
      const content = fs.readFileSync(fp, 'utf-8');
      const old = String(args.oldString);
      const replacement = String(args.newString);

      const count = content.split(old).length - 1;
      if (count === 0) return { content: `oldString not found in ${args.path}.\n\nHint: read the file first to verify the exact text.`, isError: true };
      if (count > 1) return { content: `oldString found ${count} times — must be unique. Add more context to make it unique.`, isError: true };

      const newContent = content.replace(old, replacement);
      fs.writeFileSync(fp, newContent, 'utf-8');
      const diff = createPatch(String(args.path), content, newContent, '', '');
      return { content: diff, isError: false, filesModified: [fp] };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};

export const EditTool = async (args: Record<string, unknown>) => {
  const { path, old_string, new_string } = args as any;
  const fs = await import('node:fs');

  try {
    let content = fs.readFileSync(path, 'utf-8');

    if (!content.includes(old_string)) {
      return {
        content: `Could not find "${old_string.slice(0, 50)}" in ${path}`,
        isError: true,
        toolName: 'Edit',
      };
    }

    content = content.replace(old_string, new_string);
    fs.writeFileSync(path, content, 'utf-8');

    return {
      content: `Edited ${path}`,
      toolName: 'Edit',
    };
  } catch (err: any) {
    return {
      content: `Edit error: ${err.message}`,
      isError: true,
      toolName: 'Edit',
    };
  }
};
