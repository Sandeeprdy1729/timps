import type { Plugin } from '@timps/plugin-sdk';
import { execSync } from 'child_process';

function git(args: string, cwd?: string): string {
  try {
    return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
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
      async execute({ message, cwd }: { message: string; cwd?: string }) {
        git('add -A', cwd);
        const out = git(`commit -m ${JSON.stringify(message)}`, cwd);
        return { content: out };
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
      async execute({ branch, cwd }: { branch?: string; cwd?: string }) {
        const b = branch ?? git('rev-parse --abbrev-ref HEAD', cwd);
        const out = git(`push origin ${b}`, cwd);
        return { content: out || `Pushed ${b}` };
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
      async execute({ name, create, cwd }: { name: string; create?: boolean; cwd?: string }) {
        const cmd = create ? `checkout -b ${name}` : `checkout ${name}`;
        const out = git(cmd, cwd);
        return { content: out || `Switched to ${name}` };
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
      async execute({ action, message, cwd }: { action: 'push' | 'pop' | 'list'; message?: string; cwd?: string }) {
        let cmd = 'stash';
        if (action === 'push') cmd = message ? `stash push -m ${JSON.stringify(message)}` : 'stash push';
        else if (action === 'pop') cmd = 'stash pop';
        else cmd = 'stash list';
        const out = git(cmd, cwd);
        return { content: out || 'Done' };
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
      async execute({ n = 20, cwd }: { n?: number; cwd?: string }) {
        const out = git(`log --oneline --graph --all -${n}`, cwd);
        return { content: out };
      },
    },
  ],
};

export default plugin;
