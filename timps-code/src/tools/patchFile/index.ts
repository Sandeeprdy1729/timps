import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';
import { resolvePath } from '../_shared/index.js';
import { shellEscape } from '../../utils/utils.js';

export const patchFile: RegisteredTool = {
  definition: {
    name: 'patch_file',
    description: 'Apply a unified diff patch to a file. Useful for applying AI-generated patches.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File to patch' },
        patch: { type: 'string', description: 'Unified diff patch content' },
      },
      required: ['path', 'patch'],
    },
  },
  risk: 'medium',
  async execute(args, cwd) {
    const fp = resolvePath(String(args.path), cwd);
    const tmpPatch = path.join(os.tmpdir(), `timps_patch_${Date.now()}.patch`);
    fs.writeFileSync(tmpPatch, String(args.patch), 'utf-8');
    try {
      const result = childProcess.execSync(
        `patch ${shellEscape(fp)} < ${shellEscape(tmpPatch)}`,
        { cwd, encoding: 'utf-8', timeout: 10000 }
      ).trim();
      return { content: result || 'Patch applied successfully', isError: false, filesModified: [fp] };
    } catch (e: unknown) {
      const err = e as { stderr?: string; message: string };
      return { content: err.stderr?.toString() || err.message, isError: true };
    } finally {
      try { fs.unlinkSync(tmpPatch); } catch { /* ignore */ }
    }
  },
};
