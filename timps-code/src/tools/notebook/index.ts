import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';

export const notebook: RegisteredTool = {
  definition: {
    name: 'notebook',
    description: 'Execute a code snippet and return the output. Supports JavaScript, TypeScript (tsx), and Python.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to execute' },
        language: { type: 'string', description: 'Language: js, ts, python', enum: ['js', 'ts', 'python'] },
      },
      required: ['code', 'language'],
    },
  },
  risk: 'high',
  async execute(args, cwd) {
    const code = String(args.code);
    const lang = String(args.language || 'js');

    let tmpFile: string | undefined;
    try {
      let cmd: string;

      switch (lang) {
        case 'python': {
          tmpFile = path.join(os.tmpdir(), `timps_nb_${Date.now()}.py`);
          fs.writeFileSync(tmpFile, code, 'utf-8');
          cmd = `python3 "${tmpFile}"`;
          break;
        }
        case 'ts': {
          tmpFile = path.join(os.tmpdir(), `timps_nb_${Date.now()}.ts`);
          fs.writeFileSync(tmpFile, code, 'utf-8');
          try { childProcess.execSync('which tsx', { stdio: 'pipe' }); cmd = `tsx "${tmpFile}"`; }
          catch { cmd = `npx tsx "${tmpFile}"`; }
          break;
        }
        default: {
          tmpFile = path.join(os.tmpdir(), `timps_nb_${Date.now()}.mjs`);
          fs.writeFileSync(tmpFile, code, 'utf-8');
          cmd = `node "${tmpFile}"`;
          break;
        }
      }

      const result = childProcess.execSync(cmd, {
        cwd, encoding: 'utf-8', timeout: 30000, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      return { content: result || '(no output)', isError: false };
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message: string };
      const out = [err.stdout?.toString().trim(), err.stderr?.toString().trim()].filter(Boolean).join('\n');
      return { content: out || err.message, isError: true };
    } finally {
      if (tmpFile) { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } }
    }
  },
};
