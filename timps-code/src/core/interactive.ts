// ── TIMPS Code — Enhanced Interactive REPL
// Full-featured terminal interface with Vim mode, history, and productivity shortcuts

import * as readline from 'node:readline';
import chalk from 'chalk';
import { Agent } from './agent.js';
import { Memory } from '../memory/memory.js';
import { TodoStore } from '../utils/todo.js';
import { SnapshotManager } from '../memory/snapshot.js';
import { PermissionSystem } from '../utils/permissions.js';
import type { ModelProvider } from '../config/types.js';
import { handleSlashCommand } from './app.js';
import type { TokenUsage } from '../config/types.js';
import { getAnalytics } from '../utils/analytics.js';
import { isFeatureEnabled } from '../utils/featureFlags.js';

const W = process.stdout.columns || 120;

// Color palette
const c = {
  bg: '#0D1117',
  panel: '#161B22',
  border: '#30363D',
  text: '#E6EDF3',
  dim: '#7D8590',
  accent: '#58A6FF',
  success: '#3FB950',
  error: '#F85149',
  warning: '#D29922',
  purple: '#A371F7',
  cyan: '#39D353',
  bar: '#238636',
  amber: '#D29922',
  magenta: '#F778BA',
};

interface MessageLine {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  timestamp: number;
  attachments?: string[];
}

interface CompletionCandidate {
  type: 'command' | 'file' | 'tool' | 'memory';
  value: string;
  description: string;
}

export class InteractiveREPL {
  private agent: Agent;
  private memory: Memory;
  private todos: TodoStore;
  private snapshots: SnapshotManager;
  private permissions: PermissionSystem;
  private provider: ModelProvider;
  private cwd: string;
  private sessionDir: string;
  private rl: readline.Interface;
  private history: string[] = [];
  private historyIndex = -1;
  private messages: MessageLine[] = [];
  private totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  private isProcessing = false;
  private thinkingText = '';
  private currentToolCalls: { name: string; result: string; success: boolean }[] = [];
  private agentName = 'TIMPS';
  private hasStreamedThinking = false;
  private hasStreamedResponse = false;

  // Vim mode
  private vimMode: 'normal' | 'insert' | 'replace' = 'normal';
  private vimHistoryIndex = -1;
  private vimRegister = '';

  // Auto-complete
  private showCompletions = false;
  private completions: CompletionCandidate[] = [];
  private selectedCompletion = 0;

  // Keyboard shortcuts state
  private ctrlPressed = false;
  private metaPressed = false;

  // Rich features from src 3
  private thinkingEnabled = true;
  private fastMode = false;
  private briefMode = false;
  private voiceMode = false;

  constructor(opts: {
    agent: Agent; memory: Memory; todos: TodoStore;
    snapshots: SnapshotManager; permissions: PermissionSystem;
    provider: ModelProvider; cwd: string; sessionDir: string;
  }) {
    this.agent = opts.agent;
    this.memory = opts.memory;
    this.todos = opts.todos;
    this.snapshots = opts.snapshots;
    this.permissions = opts.permissions;
    this.provider = opts.provider;
    this.cwd = opts.cwd;
    this.sessionDir = opts.sessionDir;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      completer: this.completer.bind(this),
    });

    // Load analytics
    const analytics = getAnalytics();
    analytics.startSession(this.sessionDir, this.provider.model, this.provider.name);
  }

  async start(initialMessage?: string): Promise<void> {
    if (initialMessage) {
      await this.handleInput(initialMessage);
    }

    // Show initial banner
    this.showWelcome();

    await this.replLoop();
  }

  private showWelcome(): void {
    const model = this.provider.model.slice(0, 28);
    console.log();
    console.log(`  ${chalk.hex(c.accent).bold('TIMPS')} ${chalk.hex(c.dim)('·')} ${chalk.bold(model)}  ${chalk.hex(c.dim)('timps')}  ${chalk.hex(c.success)('○')}`);
    console.log(`  ${chalk.hex(c.dim)('────────────────────────────────────────────────────────')}`);
    console.log(`  ${chalk.hex(c.dim)('Commands:')} ${chalk.hex(c.accent)('/help')} ${chalk.hex(c.dim)('·')} ${chalk.hex(c.accent)('/model')} ${chalk.hex(c.dim)('·')} ${chalk.hex(c.accent)('/context')} ${chalk.hex(c.dim)('·')} ${chalk.hex(c.accent)('/memory')}`);
    console.log(`  ${chalk.hex(c.dim)('Shortcuts:')} ${chalk.hex(c.dim)('Ctrl+C')} exit ${chalk.hex(c.dim)('·')} ${chalk.hex(c.dim)('Tab')} complete ${chalk.hex(c.dim)('·')} ${chalk.hex(c.dim)('↑↓')} history`);
    console.log(`  ${chalk.hex(c.dim)('────────────────────────────────────────────────────────')}`);
    console.log();
  }

  private drawStatusLine(): void {
    const model = this.provider.model.slice(0, 28);
    const totalTok = this.totalUsage.inputTokens + this.totalUsage.outputTokens;
    const totalK = totalTok > 0 ? `${(totalTok / 1000).toFixed(1)}K` : '';
    const pct = Math.round((totalTok / 200000) * 100);
    const tokInfo = totalK ? chalk.hex(c.dim)(` ${totalK} (${pct}%)`) : '';
    const statusDot = this.isProcessing
      ? chalk.hex(c.warning)('●')
      : chalk.hex(c.success)('○');

    const fastIcon = this.fastMode ? chalk.hex(c.cyan)('⚡') : '';
    const briefIcon = this.briefMode ? chalk.hex(c.amber)('◎') : '';
    const vimIcon = this.vimMode !== 'normal' ? chalk.hex(c.magenta)(this.vimMode[0].toUpperCase()) : '';

    process.stdout.write(
      `\n  ${chalk.hex(c.accent).bold('Build')} ${chalk.hex(c.dim)('·')} ${chalk.bold(model)}  ${chalk.hex(c.dim)('timps')}  ${statusDot}${tokInfo} ${fastIcon}${briefIcon}${vimIcon}\n`
    );
  }

  private printUserMessage(msg: string): void {
    console.log();
    console.log(`  ${chalk.hex(c.dim)('>')} ${chalk.hex(c.text)(msg)}`);
    console.log();
  }

  private printAssistantSeparator(): void {
    console.log();
    console.log(`  ${chalk.hex(c.border)('─'.repeat(Math.min(W - 4, 50)))}`);
  }

  private printThinking(text: string): void {
    if (!this.thinkingEnabled) return;
    const maxLen = Math.min(W - 16, 100);
    const display = text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
    process.stdout.write(
      `\r  ${chalk.italic.hex(c.dim)('Thinking:')} ${chalk.italic.hex(c.dim)(display.padEnd(maxLen + 1))}`
    );
  }

  private async handleInput(input: string): Promise<void> {
    if (!input.trim()) return;

    this.isProcessing = true;
    this.hasStreamedThinking = false;
    this.hasStreamedResponse = false;
    this.printUserMessage(input);
    this.history.push(input);
    this.historyIndex = this.history.length;

    try {
      let responseText = '';
      this.currentToolCalls = [];
      const analytics = getAnalytics();

      for await (const event of this.agent.run(input)) {
        switch (event.type) {
          case 'thinking':
            this.thinkingText = event.content;
            this.printThinking(event.content);
            this.hasStreamedThinking = true;
            break;

          case 'text':
            if (this.hasStreamedThinking && !this.hasStreamedResponse) {
              process.stdout.write('\n\n');
            }
            this.hasStreamedResponse = true;
            responseText += event.content;
            process.stdout.write(event.content);
            break;

          case 'tool_start':
            if (this.hasStreamedThinking && !this.hasStreamedResponse) {
              process.stdout.write('\n');
            }
            process.stdout.write(`\n  ${chalk.hex(c.dim)('⚙')} ${chalk.hex(c.cyan)(event.tool)}\n`);
            this.currentToolCalls.push({ name: event.tool, result: '', success: true });
            analytics.trackToolCall(event.tool, 0, true);
            break;

          case 'tool_result':
            if (event.result) {
              const toolResult = this.currentToolCalls[this.currentToolCalls.length - 1];
              if (toolResult) toolResult.result = event.result;
              const preview = event.result.length > 120
                ? event.result.slice(0, 120) + '…'
                : event.result;
              process.stdout.write(`  ${chalk.hex(c.success)('✓')} ${chalk.hex(c.dim)(event.tool)} ${chalk.hex(c.dim)('—')} ${chalk.hex(c.dim)(preview)}\n`);
            }
            break;

          case 'error':
            process.stdout.write(`\n  ${chalk.hex(c.error)('✗')} ${event.message}\n`);
            analytics.trackError();
            break;

          case 'ask_user':
            process.stdout.write(`\n  ${chalk.hex(c.warning)('?')} ${event.question}\n`);
            break;

          case 'done':
            if (event.usage) {
              this.totalUsage.inputTokens += event.usage.inputTokens;
              this.totalUsage.outputTokens += event.usage.outputTokens;
              analytics.trackTokens(event.usage.inputTokens, event.usage.outputTokens);
            }
            break;
        }
      }

      this.messages.push({ role: 'user', content: input, timestamp: Date.now() });
      if (responseText) {
        this.messages.push({ role: 'assistant', content: responseText, timestamp: Date.now() });
      }

      this.printAssistantSeparator();
    } catch (err) {
      process.stdout.write(`\n  ${chalk.hex(c.error)('✗')} ${(err as Error).message}\n`);
      getAnalytics().trackError();
    }

    this.isProcessing = false;
    this.drawStatusLine();
  }

  private async replLoop(): Promise<void> {
    const prompt = () => new Promise<string>(resolve => {
      const modeIndicator = this.vimMode !== 'normal' ? chalk.hex(c.magenta)(`(${this.vimMode}) `) : '';
      this.rl.question(`  ${modeIndicator}${chalk.hex(c.accent)('│')} `, answer => resolve(answer));
    });

    for (;;) {
      try {
        const input = await prompt();
        const trimmed = input.trim();

        if (!trimmed) continue;

        // Vim mode handling
        if (this.vimMode === 'normal') {
          if (trimmed === 'q' || trimmed === 'quit' || trimmed === 'exit') {
            console.log(chalk.hex(c.dim)('\n  Goodbye!\n'));
            this.agent.saveSession(this.sessionDir);
            await this.agent.saveEpisode('success');
            const analytics = getAnalytics();
            analytics.endSession();
            break;
          }
        }

        if (trimmed === 'clear' || trimmed === '/clear' || trimmed === ':clear') {
          console.clear();
          this.messages = [];
          continue;
        }

        if (trimmed === '/history' || trimmed === '/h' || trimmed === ':history') {
          console.log();
          for (let i = 0; i < this.history.length; i++) {
            console.log(`  ${chalk.hex(c.dim)(String(i + 1).padStart(3))}  ${this.history[i].slice(0, 80)}`);
          }
          console.log();
          continue;
        }

        if (trimmed === '/todos' || trimmed === ':todos') {
          const open = this.todos.getOpen();
          console.log();
          open.forEach(t => console.log(`  ${chalk.hex(c.warning)('○')} ${t}`));
          if (open.length === 0) console.log(`  ${chalk.hex(c.dim)('No open todos')}`);
          console.log();
          continue;
        }

        if (trimmed === '/stats' || trimmed === ':stats') {
          const s = this.memory.getStats();
          const gs = this.memory.graph.getStats();
          console.log(`\n  ${chalk.hex(c.dim)('memory')}  ${s.semanticCount} facts · ${s.episodeCount} episodes · ${gs.nodeCount} graph nodes\n`);
          continue;
        }

        if (trimmed.startsWith('/') || trimmed.startsWith(':')) {
          await handleSlashCommand(
            trimmed, this.agent as any, this.memory as any, this.todos as any,
            this.snapshots as any, this.permissions as any, this.provider,
            this.cwd, this.sessionDir, 'ollama' as any
          );
          continue;
        }

        await this.handleInput(trimmed);
      } catch (err) {
        if ((err as Error).message?.includes('EOF')) break;
        console.log(`\n  ${chalk.hex(c.error)('✗')} ${(err as Error).message}`);
      }
    }

    this.rl.close();
  }

  private completer(line: string): [string[], string] {
    const completions: string[] = [];

    if (line.startsWith('/')) {
      // Command completions
      const { COMMAND_REGISTRY } = require('../commands/commands.js');
      const partial = line.slice(1).toLowerCase();
      for (const cmd of COMMAND_REGISTRY) {
        if (cmd.name.startsWith(partial)) {
          completions.push(`/${cmd.name}`);
          if (cmd.aliases) {
            for (const alias of cmd.aliases) {
              if (alias.startsWith(partial)) {
                completions.push(`/${alias}`);
              }
            }
          }
        }
      }
    } else if (line.startsWith(':')) {
      // Vim-style command completions
      const vimCmds = ['w', 'wq', 'q', 'q!', 'clear', 'history', 'todos', 'stats'];
      const partial = line.slice(1).toLowerCase();
      for (const cmd of vimCmds) {
        if (cmd.startsWith(partial)) {
          completions.push(`:${cmd}`);
        }
      }
    }

    return [completions, line];
  }
}

export async function startInteractiveREPL(opts: {
  agent: Agent; memory: Memory; todos: TodoStore;
  snapshots: SnapshotManager; permissions: PermissionSystem;
  provider: ModelProvider; cwd: string; sessionDir: string;
}, initialMessage?: string): Promise<void> {
  const repl = new InteractiveREPL(opts);
  await repl.start(initialMessage);
}
