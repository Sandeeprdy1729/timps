import type { Plugin, ToolResult } from '@timps-ai/plugin-sdk';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const plugin: Plugin = {
  manifest: {
    name: 'shell',
    version: '0.1.0',
    description: 'Enhanced shell tools: run commands with timeout, pipe output, background jobs',
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
        description: 'Check if a command is available in PATH.',
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
      try {
        const path = execSync(`which ${command}`, { encoding: 'utf8' }).trim();
        return { output: `${command} found at: ${path}` };
      } catch {
        return { output: '', error: `${command} not found in PATH` };
      }
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
