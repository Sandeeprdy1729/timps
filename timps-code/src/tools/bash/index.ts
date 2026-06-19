import * as childProcess from 'node:child_process';
import type { RegisteredTool } from '../_shared/index.js';
import { resolvePath } from '../_shared/index.js';

export const bash: RegisteredTool = {
  definition: {
    name: 'bash',
    description: 'Execute a shell command. Returns stdout and stderr. Use for running tests, builds, installs, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
        cwd: { type: 'string', description: 'Working directory (default: project root)' },
      },
      required: ['command'],
    },
  },
  risk: 'high',
  async execute(args, cwd) {
    try {
      const timeout = (Number(args.timeout) || 30) * 1000;
      const workDir = args.cwd ? resolvePath(String(args.cwd), cwd) : cwd;

      const result = childProcess.execSync(String(args.command), {
        cwd: workDir,
        encoding: 'utf-8',
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        shell: '/bin/bash',
        env: { ...process.env },
      });
      return { content: result.trim() || '(no output)', isError: false };
    } catch (e: unknown) {
      const err = e as { stderr?: string | Buffer; stdout?: string | Buffer; message: string };
      const out = [
        err.stdout?.toString().trim(),
        err.stderr?.toString().trim(),
      ].filter(Boolean).join('\n');
      return { content: out || err.message, isError: true };
    }
  },
};

export const BashTool = async (args: Record<string, unknown>) => {
  const { command, timeout } = args as any;
  const { execSync } = await import('node:child_process');

  try {
    const start = Date.now();
    const output = String(execSync(command, {
      encoding: 'utf-8',
      timeout: timeout || 120000,
      maxBuffer: 10 * 1024 * 1024,
    }));
    return {
      content: output.slice(0, 100000),
      toolName: 'Bash',
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      content: err.message || 'Command failed',
      isError: true,
      toolName: 'Bash',
    };
  }
};
