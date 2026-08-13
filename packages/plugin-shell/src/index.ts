import type { Plugin, ToolResult } from '@timps-ai/plugin-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

const execAsync = promisify(exec);

/**
 * Cross-platform PATH lookup (M69). Pure Node — no `which` binary (Unix-only;
 * it does not exist in cmd/PowerShell, so the old implementation always failed
 * on Windows) and no shell, so a crafted command string like `x; whoami` is
 * treated as a literal filename and can never be executed. Returns the resolved
 * path or null.
 */
function findInPath(command: string): string | null {
  const name = String(command || '').trim();
  if (!name) return null;

  // An absolute/relative path given directly (contains a separator).
  if (name.includes('/') || name.includes('\\')) {
    return isExecutable(name) ? name : null;
  }

  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const exts =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM')
          .split(';')
          .map((e) => e.toLowerCase())
          .filter(Boolean)
      : [''];

  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      if (isExecutable(candidate)) return candidate;
    }
  }
  return null;
}

function isExecutable(p: string): boolean {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

const plugin: Plugin = {
  manifest: {
    name: 'shell',
    version: '0.1.0',
    description: 'Enhanced shell tools: run commands with timeout, check PATH availability, inspect environment variables',
    timps: {
      permissions: ['process:spawn', 'env:read', 'fs:read'],
    },
    tools: [
      {
        name: 'shell_run',
        description: 'Run a shell command with configurable timeout and output truncation.',
        parameters: {
          type: 'object' as const,
          properties: {
            command: { type: 'string' },
            cwd: { type: 'string' },
            timeout_ms: { type: 'integer', description: 'Timeout in milliseconds (default: 30000)', default: 30000 },
            max_output: { type: 'integer', description: 'Max output chars (default: 8000)', default: 8000 },
          },
          required: ['command'],
        },
      },
      {
        name: 'shell_which',
        description: 'Check if a command is available in PATH (cross-platform).',
        parameters: {
          type: 'object' as const,
          properties: { command: { type: 'string' } },
          required: ['command'],
        },
      },
      {
        name: 'shell_env',
        description: 'Get environment variables (filtered by prefix to avoid leaking secrets).',
        parameters: {
          type: 'object' as const,
          properties: {
            prefix: { type: 'string', description: 'Only return vars starting with this prefix (e.g. NODE, PATH)' },
          },
          required: [],
        },
      },
    ],
  },

  tools: {
    async shell_run({ command, cwd, timeout_ms = 30000, max_output = 8000 }: Record<string, unknown>, _ctx): Promise<ToolResult> {
      try {
        const { stdout, stderr } = await execAsync(command as string, { cwd: cwd as string | undefined, timeout: timeout_ms as number });
        const combined = (stdout + stderr).slice(0, max_output as number);
        return { output: combined || '(no output)' };
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        const out = ((e.stdout ?? '') + (e.stderr ?? '') + (e.message ?? '')).slice(0, max_output as number);
        return { output: '', error: out };
      }
    },
    async shell_which({ command }: Record<string, unknown>, _ctx): Promise<ToolResult> {
      const name = String(command ?? '').trim();
      if (!name) return { output: '', error: 'Invalid command name' };
      const path = findInPath(name);
      if (!path) return { output: '', error: `${name} not found in PATH` };
      return { output: `${name} found at: ${path}` };
    },
    async shell_env({ prefix }: Record<string, unknown>, _ctx): Promise<ToolResult> {
      const vars = Object.entries(process.env)
        .filter(([k]) => !prefix || k.startsWith(prefix as string))
        .filter(([k]) => !/(KEY|SECRET|TOKEN|PASSWORD|PASS|PRIVATE)/i.test(k))
        .map(([k, v]) => `${k}=${v ?? ''}`)
        .sort()
        .join('\n');
      return { output: vars || 'No matching env vars' };
    },
  },
};

export default plugin;
