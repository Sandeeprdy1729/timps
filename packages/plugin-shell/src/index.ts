import type { Plugin } from '@timps-ai/plugin-sdk';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const plugin: Plugin = {
  manifest: {
    name: 'shell',
    version: '0.1.0',
    description: 'Enhanced shell tools: run commands with timeout, pipe output, background jobs',
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
      async execute({ command, cwd, timeout_ms = 30000, max_output = 8000 }: {
        command: string; cwd?: string; timeout_ms?: number; max_output?: number;
      }) {
        try {
          const { stdout, stderr } = await execAsync(command, { cwd, timeout: timeout_ms });
          const combined = (stdout + stderr).slice(0, max_output);
          return { content: combined || '(no output)' };
        } catch (err: unknown) {
          const e = err as { stdout?: string; stderr?: string; message?: string };
          const out = ((e.stdout ?? '') + (e.stderr ?? '') + (e.message ?? '')).slice(0, max_output);
          return { content: `ERROR: ${out}`, isError: true };
        }
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
      async execute({ command }: { command: string }) {
        try {
          const path = execSync(`which ${command}`, { encoding: 'utf8' }).trim();
          return { content: `${command} found at: ${path}` };
        } catch {
          return { content: `${command} not found in PATH`, isError: true };
        }
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
      async execute({ prefix }: { prefix?: string }) {
        const vars = Object.entries(process.env)
          .filter(([k]) => !prefix || k.startsWith(prefix))
          .filter(([k]) => !/(KEY|SECRET|TOKEN|PASSWORD|PASS|PRIVATE)/i.test(k))
          .map(([k, v]) => `${k}=${v ?? ''}`)
          .sort()
          .join('\n');
        return { content: vars || 'No matching env vars' };
      },
    },
  ],
};

export default plugin;
