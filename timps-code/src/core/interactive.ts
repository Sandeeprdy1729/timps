// ── TIMPS Code — Retro OS Interactive REPL
// System 7 / pixel-art aesthetic with robot mascot and rich interactivity

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

// Strip ANSI escape codes for length calculation
const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, '');

const W = Math.min(process.stdout.columns || 100, 100);

// ── Retro OS Color Palette (matches robot mascot + System 7 aesthetic) ──────
const c = {
  // Robot mascot colors
  tealDark:  '#2D5A4F',   // robot screen — dark teal
  tealMid:   '#4A8C7A',   // accent teal
  tealLight: '#7EC8B8',   // highlight teal
  cream:     '#F5F0E1',   // paper/cream
  tan:       '#C8BF8C',   // robot body tan
  ink:       '#1C1C1C',   // dark outline
  // UI
  bg:        '#111210',   // dark bg
  panel:     '#1A1C18',   // panel bg
  border:    '#2D5A4F',   // teal border
  text:      '#E8E0B0',   // cream text
  dim:       '#64747A',   // muted slate
  // Status
  success:   '#28A070',
  error:     '#C83838',
  warning:   '#E8C94A',
  info:      '#7EC8B8',
  // Retro mac dots
  dotRed:    '#FF5F57',
  dotYellow: '#FEBC2E',
  dotGreen:  '#28C840',
  // Tool colors
  cyan:      '#7EC8B8',
  amber:     '#E8C94A',
  magenta:   '#F778BA',
  purple:    '#A371F7',
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
    const w = W;
    const iw = w - 4;
    const vl = chalk.hex(c.tealDark);
    console.log();
    console.log(`  ${vl('╭' + '─'.repeat(iw) + '╮')}`);

    // Row: model info
    const modelLabel = chalk.hex(c.tealMid).bold('Model');
    const modelVal = chalk.bold.hex(c.cream)(this.provider.model.slice(0, 36));
    const provVal = chalk.hex(c.tealLight)(this.provider.name);
    const row1 = `${modelLabel}    ${modelVal}  ${vl('─')}  ${provVal}`;
    const r1 = stripAnsi(row1);
    console.log(`  ${vl('│')}  ${row1}${' '.repeat(Math.max(0, iw - 2 - r1.length))}  ${vl('│')}`);

    // Row: project
    const projLabel = chalk.hex(c.tealMid).bold('Project');
    const projVal = chalk.hex(c.cream)(this.cwd.split('/').slice(-2).join('/'));
    const r2 = stripAnsi(projLabel).length + 4 + stripAnsi(projVal).length;
    console.log(`  ${vl('│')}  ${projLabel}  ${projVal}${' '.repeat(Math.max(0, iw - 2 - r2))}  ${vl('│')}`);

    console.log(`  ${vl('│')}${' '.repeat(iw + 2)}${vl('│')}`);

    // Row: features
    const feat = [
      `${chalk.hex(c.tealMid)('▸')} ${chalk.hex(c.cream)('Persistent Memory Across Sessions')}`,
      `${chalk.hex(c.tealMid)('▸')} ${chalk.hex(c.cream)('25+ Tools · Swarm · MCP Protocol')}`,
      `${chalk.hex(c.tealMid)('▸')} ${chalk.hex(c.cream)('Local-First · 100% Private')}`,
    ];
    for (const f of feat) {
      const rf = stripAnsi(f);
      console.log(`  ${vl('│')}  ${f}${' '.repeat(Math.max(0, iw - 2 - rf.length))}  ${vl('│')}`);
    }

    console.log(`  ${vl('│')}${' '.repeat(iw + 2)}${vl('│')}`);

    // Row: help hint
    const hint = `${chalk.hex(c.dim)('type')} ${chalk.hex(c.tealLight)('/help')} ${chalk.hex(c.dim)('for commands ·')} ${chalk.hex(c.amber)('Ctrl+C')} ${chalk.hex(c.dim)('to exit')}`;
    const rh = stripAnsi(hint);
    console.log(`  ${vl('│')}  ${hint}${' '.repeat(Math.max(0, iw - 2 - rh.length))}  ${vl('│')}`);

    console.log(`  ${vl('╰' + '─'.repeat(iw) + '╯')}`);
    console.log();

    // Quick shortcut bar (compact like Hermes)
    const shortcuts = [
      ['/', 'cmd'],
      ['Tab', 'comp'],
      ['↑↓', 'hist'],
      ['Ctrl+L', 'clear'],
    ];
    const sc = shortcuts.map(([k, v]) =>
      `${chalk.hex(c.tealMid).bold(k)} ${chalk.hex(c.dim)(v)}`
    ).join(chalk.hex(c.dim)(' · '));
    console.log(`  ${chalk.hex(c.dim)('❯')} ${sc}`);
    console.log();
  }

  private drawStatusLine(): void {
    const model = this.provider.model.slice(0, 24);
    const totalTok = this.totalUsage.inputTokens + this.totalUsage.outputTokens;
    const tokInfo = totalTok > 0 ? ` ${(totalTok / 1000).toFixed(1)}k` : '';
    const maxCtx = 200000;
    const pct = Math.min(100, Math.round((totalTok / maxCtx) * 100));
    const filled = Math.round(pct / 10);
    const pb = chalk.hex(c.tealDark)('█'.repeat(filled)) + chalk.hex('#374151')('░'.repeat(12 - filled));

    // Hermes-style: model │ ctx -- │ [progress] │ tokens │ time
    const vl = chalk.hex('#374151')('│');
    const left = `${chalk.hex(c.tealMid)('⚕')} ${chalk.hex(c.cream)(model)} ${vl} ${chalk.hex(c.dim)('ctx')} -- ${vl} ${pb} ${vl} ${chalk.hex(c.dim)(tokInfo || '--')}`;
    const timeStr = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    const right = `${chalk.hex(c.dim)(timeStr)} `;
    const leftLen  = stripAnsi(left).length;
    const rightLen = stripAnsi(right).length;
    const mid = ' '.repeat(Math.max(1, W - 4 - leftLen - rightLen));

    process.stdout.write(
      `\n ${vl} ${chalk.hex(c.cream)(model)} ${vl} ${chalk.hex(c.dim)('ctx')} -- ${vl} ${pb} ${vl} ${chalk.hex(c.dim)(tokInfo || '--')}${mid}${chalk.hex(c.dim)(timeStr)}\n`
    );
  }

  private printUserMessage(msg: string): void {
    const label = chalk.hex(c.tealLight).bold('  ❯ You');
    const msgLines = msg.split('\n');
    console.log();
    console.log(`  ${chalk.hex(c.tealDark)('┌─')}${label}${chalk.hex(c.tealDark)('─'.repeat(Math.max(1, W - 4 - stripAnsi(label).length)))}`);
    for (const line of msgLines) {
      console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.cream)(line)}`);
    }
    console.log(`  ${chalk.hex(c.tealDark)('└' + '─'.repeat(W - 3))}`);
    console.log();
  }

  private printAssistantSeparator(): void {
    console.log();
    console.log(`  ${chalk.hex(c.tealDark)('└' + '─'.repeat(W - 3))}`);
    console.log();
  }

  private printAssistantHeader(): void {
    const label = chalk.hex(c.tealMid).bold('  🤖 TIMPS');
    console.log(`  ${chalk.hex(c.tealDark)('┌─')}${label}${chalk.hex(c.tealDark)('─'.repeat(Math.max(1, W - 4 - stripAnsi(label).length)))}`);
    console.log(`  ${chalk.hex(c.tealDark)('│')}`);
  }

  private printThinking(text: string): void {
    if (!this.thinkingEnabled) return;
    const spinner = ['◐', '◓', '◑', '◒'];
    const frame = spinner[Math.floor(Date.now() / 200) % spinner.length];
    const maxLen = Math.min(W - 20, 80);
    const display = text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
    process.stdout.write(
      `\r  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.tealMid)(frame)} ${chalk.italic.hex(c.dim)(display.padEnd(maxLen + 2))}`
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
              process.stdout.write(`\r${' '.repeat(W)}\r`); // clear thinking line
              process.stdout.write(`  ${chalk.hex(c.tealDark)('│')} `);
            } else if (!this.hasStreamedResponse) {
              process.stdout.write(`  ${chalk.hex(c.tealDark)('│')} `);
            }
            this.hasStreamedResponse = true;
            responseText += event.content;
            // Prefix each newline with the border char
            process.stdout.write(event.content.replace(/\n/g, `\n  ${chalk.hex(c.tealDark)('│')} `));
            break;

          case 'tool_start': {
            if (this.hasStreamedThinking && !this.hasStreamedResponse) {
              process.stdout.write(`\r${' '.repeat(W)}\r`);
            }
            const toolLine = `${chalk.hex(c.tealMid)('⚙')} ${chalk.hex(c.tan).bold(event.tool)}`;
            process.stdout.write(`\n  ${chalk.hex(c.tealDark)('│')}  ${toolLine}\n`);
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
                `  ${chalk.hex(c.tealDark)('│')}  ${chalk.hex(c.success)('✔')} ${chalk.hex(c.dim)(event.tool)} ${chalk.hex(c.dim)('→')} ${chalk.hex(c.dim)(preview.replace(/\n/g, ' '))}\n`
              );
            }
            break;

          case 'error':
            process.stdout.write(
              `\n  ${chalk.hex(c.tealDark)('│')}  ${chalk.hex(c.error)('✘')} ${chalk.hex(c.error)(event.message)}\n`
            );
            analytics.trackError();
            break;

          case 'ask_user':
            process.stdout.write(
              `\n  ${chalk.hex(c.tealDark)('│')}  ${chalk.hex(c.warning)('?')} ${chalk.hex(c.amber)(event.question)}\n`
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
      process.stdout.write(`\n  ${chalk.hex(c.tealDark)('│')}  ${chalk.hex(c.error)('✘')} ${(err as Error).message}\n`);
      this.printAssistantSeparator();
      getAnalytics().trackError();
    }

    this.isProcessing = false;
    this.drawStatusLine();
  }

  private printSeparator(): void {
    const w = W - 2;
    console.log(chalk.hex('#374151')('─'.repeat(w + 2)));
  }

  private async replLoop(): Promise<void> {
    const prompt = () => new Promise<string>(resolve => {
      const modeIndicator = this.vimMode !== 'normal'
        ? chalk.hex(c.magenta)(`(${this.vimMode.toUpperCase()}) `)
        : '';
      this.printSeparator();
      const promptChar = chalk.hex(c.tealMid)('❯');
      this.rl.question(` ${promptChar} `, answer => resolve(answer));
    });

    for (;;) {
      try {
        const input = await prompt();
        const trimmed = input.trim();

        if (!trimmed) continue;

        // Vim normal mode single-key commands
        if (this.vimMode === 'normal') {
          if (trimmed === 'q' || trimmed === 'quit' || trimmed === 'exit') {
            console.log(chalk.hex(c.dim)('\n  Goodbye! Saving session…'));
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
          console.log(`  ${chalk.hex(c.tealDark)('┌─')}${chalk.hex(c.tealLight).bold('  History ')}${chalk.hex(c.tealDark)('─'.repeat(30))}`);
          for (let i = 0; i < recent.length; i++) {
            const idx = this.history.length - recent.length + i + 1;
            console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.dim)(String(idx).padStart(3))}  ${chalk.hex(c.cream)(recent[i].slice(0, 70))}`);
          }
          console.log(`  ${chalk.hex(c.tealDark)('└' + '─'.repeat(38))}`);
          console.log();
          continue;
        }

        if (trimmed === '/todos' || trimmed === ':todos') {
          const open = this.todos.getOpen?.() || [];
          console.log();
          console.log(`  ${chalk.hex(c.tealDark)('┌─')}${chalk.hex(c.tealLight).bold('  Todos ')}${chalk.hex(c.tealDark)('─'.repeat(32))}`);
          if (open.length === 0) {
            console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.dim)('No open todos')}`);
          } else {
            for (const item of open) {
              console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.warning)('○')} ${chalk.hex(c.cream)(String(item))}`);
            }
          }
          console.log(`  ${chalk.hex(c.tealDark)('└' + '─'.repeat(38))}`);
          console.log();
          continue;
        }

        if (trimmed === '/stats' || trimmed === ':stats') {
          const s  = this.memory.getStats();
          const gs = this.memory.graph.getStats();
          const usage = this.agent.getUsage();
          console.log();
          console.log(`  ${chalk.hex(c.tealDark)('┌─')}${chalk.hex(c.tealLight).bold('  Stats ')}${chalk.hex(c.tealDark)('─'.repeat(32))}`);
          console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.tealMid)('Facts')}      ${chalk.hex(c.cream)(String(s.semanticCount).padStart(6))}`);
          console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.tealMid)('Episodes')}   ${chalk.hex(c.cream)(String(s.episodeCount).padStart(6))}`);
          console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.tealMid)('Graph')}      ${chalk.hex(c.cream)(String(gs.nodeCount).padStart(6))} nodes`);
          console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.tealMid)('Tokens in')}  ${chalk.hex(c.cream)(usage.inputTokens.toLocaleString().padStart(6))}`);
          console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.tealMid)('Tokens out')} ${chalk.hex(c.cream)(usage.outputTokens.toLocaleString().padStart(6))}`);
          console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.tealMid)('Provider')}   ${chalk.hex(c.tan)(this.provider.name)}`);
          console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.tealMid)('Model')}      ${chalk.hex(c.tan)(this.provider.model.slice(0, 30))}`);
          console.log(`  ${chalk.hex(c.tealDark)('└' + '─'.repeat(38))}`);
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
