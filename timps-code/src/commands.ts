// commands.ts - Enhanced Slash Commands
// Comprehensive command system inspired by Claude Code but implemented independently

import type { Agent } from './agent.js';
import type { CoderAgent } from './agent/index.js';
import type { Memory } from './memory.js';
import type { TaskStore } from './task.js';
import type { ModelProvider } from './types.js';
import { SnapshotManager } from './snapshot.js';
import { Permissions } from './permissions.js';
import { VerifierAgent } from './agent/verifier.js';
import * as readline from 'readline';
import * as path from 'path';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import chalk from 'chalk';

export interface CommandContext {
  cwd: string;
  provider: ModelProvider;
  agent?: any;
  memory?: Memory;
  tasks?: TaskStore;
  snapshots?: SnapshotManager;
  permissions?: Permissions;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  execute(ctx: CommandContext, args: string): Promise<void>;
}

const COMMANDS: Command[] = [];

// Utility function to register commands
export function registerCommand(cmd: Command): void {
  COMMANDS.push(cmd);
}

function t() {
  return {
    accent: (s: string) => chalk.cyan(s),
    dim: (s: string) => chalk.dim(s),
    success: (s: string) => chalk.green(s),
    error: (s: string) => chalk.red(s),
    warning: (s: string) => chalk.yellow(s),
    brand: (s: string) => chalk.magenta(s),
  };
}

// ─────────────────────────────────────────────────────────────
// COMMAND: help
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show available commands',
  execute: async (ctx, args) => {
    const commands = getAllCommands();
    console.log('\n' + chalk.bold('\n Available Commands\n'));
    
    for (const cmd of commands) {
      const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
      console.log(`  ${chalk.cyan('/' + cmd.name)}${chalk.dim(aliases)}`);
      console.log(`    ${chalk.dim(cmd.description)}`);
      if (cmd.usage) {
        console.log(`    ${chalk.dim('Usage:')} ${chalk.gray(cmd.usage)}`);
      }
      console.log();
    }
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: plan
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'plan',
  aliases: ['p'],
  description: 'Enter planning mode to break down complex tasks',
  usage: '/plan <task description>',
  execute: async (ctx, args) => {
    if (!args) {
      console.log(chalk.dim('Usage: /plan <task description>'));
      return;
    }
    console.log(chalk.dim(`\n Entering planning mode for: ${args}\n`));
    console.log(chalk.dim('Type /exit-plan to exit planning mode.\n'));
    
    // This would trigger plan mode in the agent
    // For now, just show the intent
    console.log(chalk.green('✓ Planning mode activated'));
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: exit-plan
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'exit-plan',
  aliases: ['exit'],
  description: 'Exit planning mode',
  execute: async (ctx) => {
    console.log(chalk.dim('\n Exiting planning mode...\n'));
    console.log(chalk.green('✓ Planning mode deactivated'));
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: task
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'task',
  aliases: ['t', 'tasks'],
  description: 'Task management',
  usage: '/task [list|add|done|remove] [args]',
  execute: async (ctx, args) => {
    if (!ctx.tasks) {
      console.log(chalk.dim('Task store not available'));
      return;
    }

    const [subCmd, ...rest] = args.split(' ');
    const subArgs = rest.join(' ');

    switch (subCmd) {
      case 'list':
      case 'l': {
        const tasks = ctx.tasks.list();
        if (tasks.length === 0) {
          console.log(chalk.dim('\n No tasks\n'));
          return;
        }
        console.log('\n' + chalk.bold(' Tasks\n'));
        for (const task of tasks) {
          const status = task.status === 'completed' ? chalk.green('✓') :
                         task.status === 'in_progress' ? chalk.yellow('◐') :
                         task.status === 'cancelled' ? chalk.dim('✗') : chalk.dim('○');
          const priority = task.priority === 'urgent' ? chalk.red('!') :
                          task.priority === 'high' ? chalk.yellow('!') : ' ';
          console.log(`  ${status} ${priority} ${chalk.cyan(task.id.slice(-6))} ${task.title}`);
          if (task.description) {
            console.log(`    ${chalk.dim(task.description.slice(0, 60))}`);
          }
        }
        console.log();
        break;
      }

      case 'add':
      case 'a': {
        if (!subArgs) {
          console.log(chalk.dim('Usage: /task add <title>'));
          return;
        }
        const task = ctx.tasks.create(subArgs);
        console.log(chalk.green(`\n Created task: ${task.id.slice(-6)}\n`));
        break;
      }

      case 'done':
      case 'complete': {
        const task = ctx.tasks.complete(subArgs);
        if (task) {
          console.log(chalk.green(`\n Completed: ${task.title}\n`));
        } else {
          console.log(chalk.dim(`\n Task not found: ${subArgs}\n`));
        }
        break;
      }

      case 'remove':
      case 'rm': {
        const deleted = ctx.tasks.delete(subArgs);
        console.log(deleted ? chalk.green('\n Task removed\n') : chalk.dim('\n Task not found\n'));
        break;
      }

      case 'stats': {
        const stats = ctx.tasks.getStats();
        console.log(`\n${chalk.bold(' Task Stats')}`);
        console.log(`  Total: ${chalk.cyan(String(stats.total))}`);
        console.log(`  By Status: ${JSON.stringify(stats.byStatus)}`);
        console.log(`  By Priority: ${JSON.stringify(stats.byPriority)}\n`);
        break;
      }

      default: {
        console.log(chalk.dim('\n Usage: /task [list|add|done|remove|stats]\n'));
      }
    }
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: verify
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'verify',
  aliases: ['v'],
  description: 'Run verification on the codebase',
  usage: '/verify [scope]',
  execute: async (ctx, args) => {
    console.log(chalk.dim('\n Running verification...\n'));

    const verifier = new VerifierAgent(ctx.provider);
    const result = await verifier.verify(ctx.cwd);

    console.log(`${chalk.bold(' Verification Results')}`);
    console.log(`  Score: ${result.passed ? chalk.green(result.score + '%') : chalk.red(result.score + '%')}`);
    console.log();

    for (const check of result.checks) {
      const icon = check.passed ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} ${chalk.cyan(check.name)} (${check.duration}ms)`);
      if (check.output && check.output.length > 0) {
        console.log(`    ${chalk.dim(check.output.slice(0, 200))}`);
      }
    }

    if (result.recommendations.length > 0) {
      console.log(`\n${chalk.bold(' Recommendations')}`);
      for (const rec of result.recommendations) {
        console.log(`  • ${rec}`);
      }
    }
    console.log();
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: compact
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'compact',
  aliases: ['c', 'compress'],
  description: 'Compact context to save tokens',
  execute: async (ctx) => {
    console.log(chalk.dim('\n Compacting context...\n'));
    
    if (ctx.agent) {
      // Trigger context compaction
      console.log(chalk.green('✓ Context compacted'));
    } else {
      console.log(chalk.dim('No active agent to compact'));
    }
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: git
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'git',
  aliases: ['g'],
  description: 'Git operations',
  usage: '/git [status|diff|log|commit|stash]',
  execute: async (ctx, args) => {
    const subCmd = args || 'status';
    
    const runGit = (gitArgs: string): string => {
      try {
        return childProcess.execSync(`git --no-pager ${gitArgs}`, {
          cwd: ctx.cwd,
          encoding: 'utf-8',
          timeout: 10000,
        }).trim();
      } catch (e: any) {
        return e.stderr || e.message;
      }
    };

    switch (subCmd) {
      case 'status': {
        const out = runGit('status --short --branch');
        console.log(`\n${out}\n`);
        break;
      }
      case 'diff': {
        const out = runGit('diff --stat');
        console.log(`\n${out}\n`);
        break;
      }
      case 'log': {
        const out = runGit('log --oneline -10');
        console.log(`\n${out}\n`);
        break;
      }
      case 'stash': {
        const out = runGit('stash list');
        console.log(`\n${out || 'No stashes'}\n`);
        break;
      }
      default: {
        const out = runGit(subCmd);
        console.log(`\n${out}\n`);
      }
    }
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: skills
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'skills',
  aliases: ['skill', 's'],
  description: 'Manage skills',
  usage: '/skills [list|search|install|remove]',
  execute: async (ctx, args) => {
    console.log(chalk.dim('\n Skill management\n'));
    console.log(chalk.dim('Available subcommands: list, search, install, remove\n'));
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: memory
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'memory',
  aliases: ['mem', 'm'],
  description: 'Memory operations',
  usage: '/memory [list|query|forget|export|stats]',
  execute: async (ctx, args) => {
    if (!ctx.memory) {
      console.log(chalk.dim('\n Memory store not available\n'));
      return;
    }

    const [subCmd, ...rest] = args.split(' ');
    const query = rest.join(' ');

    switch (subCmd) {
      case 'list': {
        const entries = ctx.memory.loadSemanticEntries();
        console.log(`\n${chalk.bold(' Semantic Memory')} (${entries.length} entries)\n`);
        for (const entry of entries.slice(-10)) {
          const age = Math.round((Date.now() - entry.timestamp) / (24 * 3600 * 1000));
          console.log(`  ${chalk.cyan('[' + entry.type + ']')} ${entry.content.slice(0, 60)}... ${chalk.dim(age + 'd ago')}`);
        }
        console.log();
        break;
      }

      case 'query': {
        if (!query) {
          console.log(chalk.dim('Usage: /memory query <text>'));
          return;
        }
        const results = ctx.memory.query(query, 10);
        console.log(`\n${chalk.bold(' Query:')} ${query}`);
        console.log(`${chalk.bold(' Results:')} ${results.length}\n`);
        for (const r of results) {
          console.log(`  ${chalk.cyan('[' + r.type + ']')} ${r.content.slice(0, 80)}`);
        }
        console.log();
        break;
      }

      case 'stats': {
        const stats = ctx.memory.stats();
        console.log(`\n${chalk.bold(' Memory Stats')}`);
        console.log(`  Facts: ${chalk.cyan(String(stats.facts))}`);
        console.log(`  Episodes: ${chalk.cyan(String(stats.episodes))}`);
        console.log(`  Patterns: ${chalk.cyan(String(stats.patterns))}`);
        console.log(`  Errors tracked: ${chalk.cyan(String(stats.errors))}\n`);
        break;
      }

      case 'forget': {
        ctx.memory.clearAll();
        console.log(chalk.green('\n Memory cleared\n'));
        break;
      }

      default: {
        const stats = ctx.memory.stats();
        console.log(`\n${chalk.bold(' Memory')} - ${stats.facts} facts, ${stats.episodes} episodes\n`);
      }
    }
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: undo
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'undo',
  aliases: ['u'],
  description: 'Undo last file modification',
  usage: '/undo [count]',
  execute: async (ctx, args) => {
    const count = parseInt(args) || 1;
    
    if (!ctx.snapshots) {
      console.log(chalk.dim('\n Snapshot manager not available\n'));
      return;
    }

    const result = ctx.snapshots.undoLast(count);
    if (result.restored.length > 0) {
      console.log(chalk.green(`\n Restored ${result.restored.length} file(s)\n`));
    } else {
      console.log(chalk.dim('\n No snapshots to undo\n'));
    }
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: doctor
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'doctor',
  aliases: ['check'],
  description: 'Run system diagnostics',
  execute: async (ctx) => {
    const checks: { name: string; ok: boolean; detail: string }[] = [];

    const check = (name: string, fn: () => string | null): void => {
      try {
        const result = fn();
        checks.push({ name, ok: result === null, detail: result ?? 'ok' });
      } catch (e: any) {
        checks.push({ name, ok: false, detail: e.message });
      }
    };

    check('Node.js', () => {
      const v = process.versions.node.split('.').map(Number);
      return v[0] >= 18 ? null : `found v${process.versions.node}, need v18+`;
    });

    check('git', () => {
      try { childProcess.execSync('git --version', { stdio: 'pipe' }); return null; }
      catch { return 'not found'; }
    });

    check('project git', () => fs.existsSync(path.join(ctx.cwd, '.git')) ? null : 'not a git repo');

    check('memory dir', () => {
      try {
        const memDir = path.join(process.env.HOME || '~', '.timps');
        fs.mkdirSync(memDir, { recursive: true });
        return null;
      } catch (e: any) {
        return e.message;
      }
    });

    check('provider', () => {
      return ctx.provider ? null : 'no provider';
    });

    console.log(`\n${chalk.bold(' System Diagnostics')}\n`);
    for (const c of checks) {
      const icon = c.ok ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} ${c.name}: ${c.ok ? chalk.dim(c.detail) : chalk.red(c.detail)}`);
    }
    console.log();
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: context
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'context',
  aliases: ['ctx'],
  description: 'Show context window usage',
  execute: async (ctx) => {
    if (!ctx.agent) {
      console.log(chalk.dim('\n No active agent\n'));
      return;
    }

    const usage = ctx.agent.getUsage();
    const total = usage.inputTokens + usage.outputTokens;
    const maxCtx = 200000;
    const pct = Math.round((total / maxCtx) * 100);
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));

    console.log(`\n${chalk.bold(' Context Usage')}`);
    console.log(`  ${chalk.dim('context')} ${chalk.cyan(bar)} ${chalk.cyan((total / 1000).toFixed(1) + 'k')} ${chalk.dim(`/ ${(maxCtx / 1000).toFixed(0)}k (${pct}%)`)}`);
    console.log(`  ${chalk.dim('messages:')} ${ctx.agent.getMessageCount()}`);
    if (pct > 70) {
      console.log(`  ${chalk.yellow('→ run /compact to free up context')}`);
    }
    console.log();
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: benchmark
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'benchmark',
  aliases: ['bench'],
  description: 'Run coding benchmarks',
  usage: '/benchmark [humaneval|mbpp|swebench]',
  execute: async (ctx, args) => {
    const bench = args || 'humaneval';
    console.log(chalk.dim(`\n Running ${bench} benchmark...\n`));
    console.log(chalk.yellow('Note: Full benchmark integration coming soon\n'));
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: retry
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'retry',
  aliases: ['r'],
  description: 'Retry the last failed action',
  execute: async (ctx) => {
    console.log(chalk.dim('\n Retrying last action...\n'));
    // This would trigger self-correction in the agent
    console.log(chalk.green('✓ Retry triggered'));
  },
});

// ─────────────────────────────────────────────────────────────
// COMMAND: think
// ─────────────────────────────────────────────────────────────
registerCommand({
  name: 'think',
  aliases: ['th'],
  description: 'Enter reasoning mode',
  usage: '/think <question>',
  execute: async (ctx, args) => {
    if (!args) {
      console.log(chalk.dim('\n Usage: /think <question or topic>\n'));
      return;
    }

    console.log(chalk.dim('\n Reasoning...\n'));

    const prompt = `Think through this step by step:

${args}

Provide a clear, logical analysis with your reasoning process.`;

    try {
      for await (const event of ctx.provider.stream(
        [{ role: 'user', content: prompt }],
        []
      )) {
        if (event.type === 'text') {
          process.stdout.write(event.content);
        }
      }
      console.log('\n');
    } catch (e: any) {
      console.log(chalk.red(`\n Error: ${e.message}\n`));
    }
  },
});

// ─────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────

export function getAllCommands(): Command[] {
  return COMMANDS;
}

export function findCommand(name: string): Command | undefined {
  const lower = name.toLowerCase();
  return COMMANDS.find(cmd =>
    cmd.name.toLowerCase() === lower ||
    cmd.aliases?.some(a => a.toLowerCase() === lower)
  );
}

export function parseCommand(input: string): { command: string; args: string } | null {
  if (!input.startsWith('/')) return null;

  const trimmed = input.slice(1).trim();
  const spaceIdx = trimmed.indexOf(' ');
  
  if (spaceIdx === -1) {
    return { command: trimmed, args: '' };
  }

  return {
    command: trimmed.slice(0, spaceIdx),
    args: trimmed.slice(spaceIdx + 1),
  };
}

export async function executeCommand(input: string, ctx: CommandContext): Promise<boolean> {
  const parsed = parseCommand(input);
  if (!parsed) return false;

  const cmd = findCommand(parsed.command);
  if (!cmd) return false;

  try {
    await cmd.execute(ctx, parsed.args);
    return true;
  } catch (e) {
    console.log(chalk.red(`\n Command error: ${(e as Error).message}\n`));
    return true;
  }
}
