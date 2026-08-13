import type { Plugin, ToolResult } from '@timps-ai/plugin-sdk';
import { execFileSync } from 'child_process';

// Runs git with an argument array — no shell involved, so branch names, commit
// messages, or paths can never be interpreted as shell commands (M67).
function git(args: string[], cwd?: string): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const msg = (e.stderr?.toString?.() ?? e.message ?? String(err)).trim();
    throw new Error(msg);
  }
}

const plugin: Plugin = {
  manifest: {
    name: 'git',
    version: '0.1.0',
    description: 'Enhanced git tools: commit, push, branch, stash, log graph',
    timps: {
      permissions: ['process:spawn'],
    },
    tools: [
      {
        name: 'git_commit',
        description: 'Stage all changes and create a commit with the given message.',
        parameters: {
          type: 'object' as const,
          properties: {
            message: { type: 'string', description: 'Commit message' },
            cwd: { type: 'string' },
          },
          required: ['message'],
        },
      },
      {
        name: 'git_push',
        description: 'Push current branch to origin.',
        parameters: {
          type: 'object' as const,
          properties: { branch: { type: 'string' }, cwd: { type: 'string' } },
          required: [],
        },
      },
      {
        name: 'git_branch',
        description: 'Create or switch branches.',
        parameters: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Branch name to create/switch to' },
            create: { type: 'boolean', description: 'Create new branch' },
            cwd: { type: 'string' },
          },
          required: ['name'],
        },
      },
      {
        name: 'git_stash',
        description: 'Stash current changes or pop latest stash.',
        parameters: {
          type: 'object' as const,
          properties: {
            action: { type: 'string', enum: ['push', 'pop', 'list'], description: 'push=stash, pop=restore, list=show stashes' },
            message: { type: 'string' },
            cwd: { type: 'string' },
          },
          required: ['action'],
        },
      },
      {
        name: 'git_log_graph',
        description: 'Show a visual git log graph.',
        parameters: {
          type: 'object' as const,
          properties: { n: { type: 'integer', default: 20 }, cwd: { type: 'string' } },
          required: [],
        },
      },
    ],
  },

  tools: {
    async git_commit({ message, cwd }: Record<string, unknown>, _ctx): Promise<ToolResult> {
      try {
        git(['add', '-A'], cwd as string | undefined);
        const out = git(['commit', '-m', String(message)], cwd as string | undefined);
        return { output: out };
      } catch (e: any) {
        return { output: '', error: e.message };
      }
    },
    async git_push({ branch, cwd }: Record<string, unknown>, _ctx): Promise<ToolResult> {
      try {
        const b = (branch as string | undefined) ?? git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd as string | undefined);
        const out = git(['push', 'origin', b], cwd as string | undefined);
        return { output: out || `Pushed ${b}` };
      } catch (e: any) {
        return { output: '', error: e.message };
      }
    },
    async git_branch({ name, create, cwd }: Record<string, unknown>, _ctx): Promise<ToolResult> {
      try {
        const cmd = create ? ['checkout', '-b', String(name)] : ['checkout', String(name)];
        const out = git(cmd, cwd as string | undefined);
        return { output: out || `Switched to ${name}` };
      } catch (e: any) {
        return { output: '', error: e.message };
      }
    },
    async git_stash({ action, message, cwd }: Record<string, unknown>, _ctx): Promise<ToolResult> {
      try {
        let cmd: string[] = ['stash'];
        if (action === 'push') cmd = message ? ['stash', 'push', '-m', String(message)] : ['stash', 'push'];
        else if (action === 'pop') cmd = ['stash', 'pop'];
        else cmd = ['stash', 'list'];
        const out = git(cmd, cwd as string | undefined);
        return { output: out || 'Done' };
      } catch (e: any) {
        return { output: '', error: e.message };
      }
    },
    async git_log_graph({ n = 20, cwd }: Record<string, unknown>, _ctx): Promise<ToolResult> {
      try {
        const out = git(['log', '--oneline', '--graph', '--all', `-${n}`], cwd as string | undefined);
        return { output: out };
      } catch (e: any) {
        return { output: '', error: e.message };
      }
    },
  },
};

export default plugin;
