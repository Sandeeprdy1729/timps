import * as fs from 'node:fs';
import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';

export const runDiagnostics: RegisteredTool = {
  definition: {
    name: 'run_diagnostics',
    description: 'Run project diagnostics: TypeScript type checking, ESLint, or Pyright. Auto-detects project type.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Tool to use: ts, eslint, pyright (default: auto-detect)' },
      },
    },
  },
  risk: 'low',
  async execute(args, cwd) {
    try {
      let cmd: string;
      if (args.type === 'ts') cmd = 'npx tsc --noEmit';
      else if (args.type === 'eslint') cmd = 'npx eslint .';
      else if (args.type === 'pyright') cmd = 'npx pyright';
      else {
        if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) cmd = 'npx tsc --noEmit 2>&1';
        else if (fs.existsSync(path.join(cwd, '.eslintrc.json')) || fs.existsSync(path.join(cwd, 'eslint.config.js'))) cmd = 'npx eslint . 2>&1';
        else if (fs.existsSync(path.join(cwd, 'pyproject.toml')) || fs.existsSync(path.join(cwd, 'requirements.txt'))) cmd = 'python3 -m py_compile *.py 2>&1';
        else cmd = 'echo "No supported diagnostic config detected"';
      }

      const result = childProcess.execSync(cmd, { cwd, encoding: 'utf-8', timeout: 30000 });
      return { content: `Diagnostics passed:\n${result.trim().slice(0, 500)}`, isError: false };
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message: string };
      const out = [err.stdout?.toString().trim(), err.stderr?.toString().trim()].filter(Boolean).join('\n');
      return { content: `Diagnostics output:\n${(out || err.message).slice(0, 3000)}`, isError: false };
    }
  },
};
