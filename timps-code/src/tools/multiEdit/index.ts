import * as fs from 'node:fs';
import { createPatch } from 'diff';
import type { RegisteredTool } from '../_shared/index.js';
import { resolvePath } from '../_shared/index.js';

export const multiEdit: RegisteredTool = {
  definition: {
    name: 'multi_edit',
    description: 'Apply multiple string replacements to a file in one call. More efficient than multiple edit_file calls.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        edits: { type: 'string', description: 'JSON array of [{oldString, newString}] objects' },
      },
      required: ['path', 'edits'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    try {
      const fp = resolvePath(String(args.path), cwd);
      let content = fs.readFileSync(fp, 'utf-8');
      const original = content;

      const edits: { oldString: string; newString: string }[] = JSON.parse(String(args.edits));
      const results: string[] = [];

      for (const edit of edits) {
        const count = content.split(edit.oldString).length - 1;
        if (count === 0) { results.push(`✘ not found: "${edit.oldString.slice(0, 50)}"`); continue; }
        if (count > 1) { results.push(`✘ ${count} matches (not unique): "${edit.oldString.slice(0, 50)}"`); continue; }
        content = content.replace(edit.oldString, edit.newString);
        results.push(`✔ replaced`);
      }

      fs.writeFileSync(fp, content, 'utf-8');
      const diff = createPatch(String(args.path), original, content, '', '');
      return { content: results.join('\n') + '\n\n' + diff, isError: false, filesModified: [fp] };
    } catch (e) {
      return { content: `Error: ${(e as Error).message}`, isError: true };
    }
  },
};
