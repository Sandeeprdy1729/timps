// ── TIMPS Code — Clean Minimal Interactive REPL ──

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

const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, '');

const W = Math.min(process.stdout.columns || 100, 100);

const c = {
  primary:  '#4A8C7A',
  muted:    '#64747A',
  cream:    '#F5F0E1',
  dim:      '#64747A',
  border:   '#374151',
  success:  '#28A070',
  error:    '#C83838',
  warning:  '#E8C94A',
  info:     '#7EC8B8',
  subtle:   '#2D5A4F',
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

  private vimMode: 'normal' | 'insert' | 'replace' = 'normal';
  private vimHistoryIndex = -1;
  private vimRegister = '';

  private showCompletions = false;
  private completions: CompletionCandidate[] = [];
  private selectedCompletion = 0;

  private ctrlPressed = false;
  private metaPressed = false;

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

    const analytics = getAnalytics();
    analytics.startSession(this.sessionDir, this.provider.model, this.provider.name);
  }

  async start(initialMessage?: string): Promise<void> {
    if (initialMessage) {
      await this.handleInput(initialMessage);
    }
    this.showWelcome();
    await this.replLoop();
  }

  private showWelcome(): void {
    const model = chalk.hex(c.primary)(this.provider.model.slice(0, 36));
    const prov = chalk.hex(c.muted)(this.provider.name);
    const proj = chalk.hex(c.cream)(this.cwd.split('/').slice(-2).join('/'));
    const div = chalk.hex(c.border)('─'.repeat(28));

    console.log(`\n  ${chalk.hex(c.primary).bold('timps')}  ${model}  ${prov}`);
    console.log(`  ${chalk.hex(c.muted)('project')}  ${proj}`);
    console.log(`  ${div}`);
    console.log(`  ${chalk.hex(c.muted)('/help for commands')}  ·  ${chalk.hex(c.muted)('Ctrl+C to exit')}`);
    console.log();
  }

  private drawStatusLine(): void {
    const model = this.provider.model.slice(0, 24);
    const totalTok = this.totalUsage.inputTokens + this.totalUsage.outputTokens;
    const maxCtx = 200000;
    const pct = Math.min(100, Math.round((totalTok / maxCtx) * 100));
    const filled = Math.round(pct / 10);
    const pb = chalk.hex(c.primary)('█'.repeat(filled)) + chalk.hex(c.border)('░'.repeat(12 - filled));
    const tokStr = totalTok > 0 ? ` ${(totalTok / 1000).toFixed(1)}k` : '';
    const timeStr = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    const left = `${chalk.hex(c.muted)(model)} ${pb}${tokStr}`;
    const pad = ' '.repeat(Math.max(1, W - 2 - stripAnsi(left).length - 6));
    process.stdout.write(`\n  ${left}${pad}${chalk.hex(c.muted)(timeStr)}\n`);
  }

  private printUserMessage(msg: string): void {
    const lines = msg.split('\n');
    console.log();
    console.log(`  ${chalk.hex(c.primary).bold('◆')} ${chalk.hex(c.cream)(lines[0])}`);
    for (let i = 1; i < lines.length; i++) {
      console.log(`  ${chalk.hex(c.muted)('│')} ${chalk.hex(c.cream)(lines[i])}`);
    }
    console.log();
  }

  private printAssistantSeparator(): void {
    console.log();
  }

  private printAssistantHeader(): void {
    const label = chalk.hex(c.primary).bold('◈') + ' ' + chalk.hex(c.muted)(this.provider.model);
    console.log(`  ${label}`);
  }

  private printThinking(text: string): void {
    if (!this.thinkingEnabled) return;
    const spinner = ['◐', '◓', '◑', '◒'];
    const frame = spinner[Math.floor(Date.now() / 200) % spinner.length];
    const maxLen = Math.min(W - 20, 80);
    const display = text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
    process.stdout.write(
      `\r  ${chalk.hex(c.muted)(frame)} ${chalk.italic.hex(c.muted)(display.padEnd(maxLen + 2))}`
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

      this.printAssistantHeader();

      for await (const event of this.agent.run(input)) {
        switch (event.type) {
          case 'thinking':
            this.thinkingText = event.content;
            this.printThinking(event.content);
            this.hasStreamedThinking = true;
            break;

          case 'text':
            if (this.hasStreamedThinking && !this.hasStreamedResponse) {
              process.stdout.write(`\r${' '.repeat(W)}\r`);
            }
            this.hasStreamedResponse = true;
            responseText += event.content;
            process.stdout.write(event.content);
            break;

          case 'tool_start': {
            if (this.hasStreamedThinking && !this.hasStreamedResponse) {
              process.stdout.write(`\r${' '.repeat(W)}\r`);
            }
            process.stdout.write(`\n  ${chalk.hex(c.muted)('⚙')} ${chalk.hex(c.primary)(event.tool)}\n`);
            this.currentToolCalls.push({ name: event.tool, result: '', success: true });
            analytics.trackToolCall(event.tool, 0, true);
            break;
          }

          case 'tool_result':
            if (event.result) {
              const toolResult = this.currentToolCalls[this.currentToolCalls.length - 1];
              if (toolResult) toolResult.result = event.result;
              const preview = event.result.length > 90
                ? event.result.slice(0, 90) + '…'
                : event.result;
              process.stdout.write(
                `  ${chalk.hex(c.success)('✔')} ${chalk.hex(c.muted)(event.tool)} ${chalk.hex(c.muted)('→')} ${chalk.hex(c.muted)(preview.replace(/\n/g, ' '))}\n`
              );
            }
            break;

          case 'error':
            process.stdout.write(
              `\n  ${chalk.hex(c.error)('✘')} ${chalk.hex(c.error)(event.message)}\n`
            );
            analytics.trackError();
            break;

          case 'ask_user':
            process.stdout.write(
              `\n  ${chalk.hex(c.warning)('?')} ${chalk.hex(c.warning)(event.question)}\n`
            );
            break;

          case 'done':
            if (event.usage) {
              this.totalUsage.inputTokens  += event.usage.inputTokens;
              this.totalUsage.outputTokens += event.usage.outputTokens;
              analytics.trackTokens(event.usage.inputTokens, event.usage.outputTokens);
            }
            break;
        }
      }

      this.messages.push({ role: 'user',      content: input,        timestamp: Date.now() });
      if (responseText) {
        this.messages.push({ role: 'assistant', content: responseText, timestamp: Date.now() });
      }

      this.printAssistantSeparator();
    } catch (err) {
      process.stdout.write(`\n  ${chalk.hex(c.error)('✘')} ${(err as Error).message}\n`);
      this.printAssistantSeparator();
      getAnalytics().trackError();
    }

    this.isProcessing = false;
    this.drawStatusLine();
  }

  private printSeparator(): void {
    console.log(chalk.hex(c.border)('─'.repeat(W - 2)));
  }

  private async replLoop(): Promise<void> {
    const prompt = () => new Promise<string>(resolve => {
      const modeIndicator = this.vimMode !== 'normal'
        ? chalk.hex('#F778BA')(`(${this.vimMode.toUpperCase()}) `)
        : '';
      this.printSeparator();
      const promptChar = chalk.hex(c.primary)('◆');
      this.rl.question(` ${promptChar} `, answer => resolve(answer));
    });

    for (;;) {
      try {
        const input = await prompt();
        const trimmed = input.trim();

        if (!trimmed) continue;

        if (this.vimMode === 'normal') {
          if (trimmed === 'q' || trimmed === 'quit' || trimmed === 'exit') {
            console.log(chalk.hex(c.muted)('\n  Session saved. Goodbye.'));
            this.agent.saveSession(this.sessionDir);
            await this.agent.saveEpisode('success');
            getAnalytics().endSession();
            break;
          }
        }

        if (trimmed === 'clear' || trimmed === '/clear' || trimmed === ':clear') {
          console.clear();
          this.messages = [];
          this.showWelcome();
          continue;
        }

        if (trimmed === '/history' || trimmed === '/h' || trimmed === ':history') {
          console.log();
          const recent = this.history.slice(-20);
          console.log(`  ${chalk.hex(c.primary).bold('History')}`);
          for (let i = 0; i < recent.length; i++) {
            const idx = this.history.length - recent.length + i + 1;
            console.log(`  ${chalk.hex(c.muted)(String(idx).padStart(3))}  ${chalk.hex(c.cream)(recent[i].slice(0, 70))}`);
          }
          console.log();
          continue;
        }

        if (trimmed === '/todos' || trimmed === ':todos') {
          const open = this.todos.getOpen?.() || [];
          console.log();
          console.log(`  ${chalk.hex(c.primary).bold('Todos')}`);
          if (open.length === 0) {
            console.log(`  ${chalk.hex(c.muted)('No open todos')}`);
          } else {
            for (const item of open) {
              console.log(`  ${chalk.hex(c.warning)('○')} ${chalk.hex(c.cream)(String(item))}`);
            }
          }
          console.log();
          continue;
        }

        if (trimmed === '/stats' || trimmed === ':stats') {
          const s  = this.memory.getStats();
          const gs = this.memory.graph.getStats();
          const usage = this.agent.getUsage();
          console.log();
          console.log(`  ${chalk.hex(c.primary).bold('Stats')}`);
          console.log(`  ${chalk.hex(c.muted)('Facts')}      ${chalk.hex(c.cream)(String(s.semanticCount).padStart(6))}`);
          console.log(`  ${chalk.hex(c.muted)('Episodes')}   ${chalk.hex(c.cream)(String(s.episodeCount).padStart(6))}`);
          console.log(`  ${chalk.hex(c.muted)('Graph')}      ${chalk.hex(c.cream)(String(gs.nodeCount).padStart(6))} nodes`);
          console.log(`  ${chalk.hex(c.muted)('Tokens in')}  ${chalk.hex(c.cream)(usage.inputTokens.toLocaleString().padStart(6))}`);
          console.log(`  ${chalk.hex(c.muted)('Tokens out')} ${chalk.hex(c.cream)(usage.outputTokens.toLocaleString().padStart(6))}`);
          console.log(`  ${chalk.hex(c.muted)('Provider')}   ${chalk.hex(c.primary)(this.provider.name)}`);
          console.log(`  ${chalk.hex(c.muted)('Model')}      ${chalk.hex(c.primary)(this.provider.model.slice(0, 30))}`);
          console.log();
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
        console.log(`\n  ${chalk.hex(c.error)('✘')} ${(err as Error).message}`);
      }
    }

    this.rl.close();
  }

  private completer(line: string): [string[], string] {
    const completions: string[] = [];

    if (line.startsWith('/')) {
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
