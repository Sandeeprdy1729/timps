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
    const line = (s = '') => `  ${chalk.hex(c.tealDark)('│')}${s}${chalk.hex(c.tealDark)('│')}`;
    const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - stripAnsi(s).length));

    // Robot pixel art (inline chalk)
    const rd = chalk.hex(c.tealDark);
    const rm = chalk.hex(c.tealMid);
    const rt = chalk.hex(c.tan);
    const rc = chalk.hex(c.cream);
    const ri = chalk.hex(c.ink);
    const robot = [
      `  ${rd('┌──────┐')}  `,
      `  ${rd('│')}${rc(' ◉  ◉ ')}${rd('│')}  `,
      `  ${rd('│')}${rc('  ‿   ')}${rd('│')}  `,
      `  ${rd('└──────┘')}  `,
      `  ${rt('┆')} ${rm('░░░░')} ${rt('┆')}  `,
      ` ${rt('┌┴──────┴┐')} `,
      ` ${rt('│')}  ${rm('▣ ▣ ▣')}  ${rt('│')} `,
      ` ${rt('└┬──────┬┘')} `,
      `  ${ri('██')}      ${ri('██')}  `,
    ];

    const sep = chalk.hex(c.tealDark)('═'.repeat(w - 4));
    const innerW = w - 4;

    // Header bar
    console.log();
    console.log(`  ${chalk.hex(c.tealDark)('╔' + '═'.repeat(w - 4) + '╗')}`);
    // Dots row
    const dotsRow = ` ${chalk.hex(c.dotRed)('●')} ${chalk.hex(c.dotYellow)('●')} ${chalk.hex(c.dotGreen)('●')}`;
    const title = chalk.hex(c.tealMid).bold('  TIMPS  ') + chalk.hex(c.dim)('— AI Coding Agent');
    console.log(`  ${chalk.hex(c.tealDark)('║')}${dotsRow}  ${title}${' '.repeat(Math.max(0, innerW - 3 - stripAnsi(title).length - 3))}${chalk.hex(c.tealDark)('║')}`);
    console.log(`  ${chalk.hex(c.tealDark)('╠' + '═'.repeat(w - 4) + '╣')}`);

    // Robot + text rows
    const textLines = [
      `  ${chalk.hex(c.tealLight).bold('TIMPS Code')} ${chalk.hex(c.dim)('v2.0')}`,
      ``,
      `  ${chalk.hex(c.tealMid)('▸')} ${chalk.hex(c.cream)('Persistent Memory Across Sessions')}`,
      `  ${chalk.hex(c.tealMid)('▸')} ${chalk.hex(c.cream)('25+ Tools · Swarm · MCP Protocol')}`,
      `  ${chalk.hex(c.tealMid)('▸')} ${chalk.hex(c.cream)('Local-First · 100% Private')}`,
      ``,
      `  ${chalk.hex(c.dim)('Type')} ${chalk.hex(c.tealLight)('/help')} ${chalk.hex(c.dim)('for commands ·')} ${chalk.hex(c.dim)('Tab')} ${chalk.hex(c.dim)('to autocomplete')}`,
      `  ${chalk.hex(c.dim)('↑↓')} ${chalk.hex(c.dim)('history ·')} ${chalk.hex(c.amber)('Ctrl+C')} ${chalk.hex(c.dim)('to exit')}`,
      ``,
    ];

    for (let i = 0; i < Math.max(robot.length, textLines.length); i++) {
      const rob = robot[i] ?? '              ';
      const txt = textLines[i] ?? '';
      const robRaw = stripAnsi(rob);
      const txtRaw = stripAnsi(txt);
      const content = `${rob}  ${txt}`;
      const padLen = Math.max(0, innerW - robRaw.length - 2 - txtRaw.length);
      console.log(`  ${chalk.hex(c.tealDark)('║')}${content}${' '.repeat(padLen)}${chalk.hex(c.tealDark)('║')}`);
    }

    console.log(`  ${chalk.hex(c.tealDark)('╚' + '═'.repeat(w - 4) + '╝')}`);
    console.log();

    // Quick shortcut bar
    const shortcuts = [
      ['/', 'command'],
      ['Tab', 'complete'],
      ['↑↓', 'history'],
      ['Ctrl+L', 'clear'],
      ['Ctrl+C', 'exit'],
    ];
    const shortcutStr = shortcuts.map(([k, v]) =>
      `${chalk.hex(c.tealMid).bold(k)} ${chalk.hex(c.dim)(v)}`
    ).join(chalk.hex(c.dim)('  ·  '));
    console.log(`  ${chalk.hex(c.dim)('>')} ${shortcutStr}`);
    console.log();
  }

  private drawStatusLine(): void {
    const model = this.provider.model.slice(0, 30);
    const totalTok = this.totalUsage.inputTokens + this.totalUsage.outputTokens;
    const tokInfo = totalTok > 0 ? ` ${(totalTok / 1000).toFixed(1)}k tok` : '';
    const statusDot = this.isProcessing
      ? chalk.hex(c.warning)('●')
      : chalk.hex(c.success)('●');

    const flags = [
      this.fastMode  ? chalk.hex(c.cyan)('⚡ fast') : '',
      this.briefMode ? chalk.hex(c.amber)('◎ brief') : '',
      this.vimMode !== 'normal' ? chalk.hex(c.magenta)(`VIM:${this.vimMode[0].toUpperCase()}`) : '',
    ].filter(Boolean).join(' ');

    const left  = ` ${statusDot} ${chalk.hex(c.tealMid).bold('TIMPS')} ${chalk.hex(c.dim)('·')} ${chalk.hex(c.cream)(model)}`;
    const right = `${flags}${tokInfo} ${chalk.hex(c.dim)(new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }))} `;

    const leftLen  = stripAnsi(left).length;
    const rightLen = stripAnsi(right).length;
    const mid = ' '.repeat(Math.max(1, W - 4 - leftLen - rightLen));

    process.stdout.write(
      `\n  ${chalk.hex(c.tealDark)('┌' + '─'.repeat(W - 4) + '┐')}\n`
    );
    process.stdout.write(
      `  ${chalk.hex(c.tealDark)('│')}${left}${mid}${right}${chalk.hex(c.tealDark)('│')}\n`
    );
    process.stdout.write(
      `  ${chalk.hex(c.tealDark)('└' + '─'.repeat(W - 4) + '┘')}\n`
    );
  }

  private printUserMessage(msg: string): void {
    const label = chalk.hex(c.tealLight).bold('  ❯ You');
    const msgLines = msg.split('\n');
    console.log();
    console.log(`  ${chalk.hex(c.tealDark)('┌─')}${label}${chalk.hex(c.tealDark)('─'.repeat(Math.max(1, W - 6 - stripAnsi(label).length - 2)))}`);
    for (const line of msgLines) {
      console.log(`  ${chalk.hex(c.tealDark)('│')} ${chalk.hex(c.cream)(line)}`);
    }
    console.log(`  ${chalk.hex(c.tealDark)('└' + '─'.repeat(W - 4))}`);
    console.log();
  }

  private printAssistantSeparator(): void {
    console.log();
    console.log(`  ${chalk.hex(c.tealDark)('└' + '─'.repeat(W - 4))}`);
    console.log();
  }

  private printAssistantHeader(): void {
    const label = chalk.hex(c.tealMid).bold('  🤖 TIMPS');
    console.log(`  ${chalk.hex(c.tealDark)('┌─')}${label}${chalk.hex(c.tealDark)('─'.repeat(Math.max(1, W - 6 - stripAnsi(label).length - 2)))}`);
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

  private async replLoop(): Promise<void> {
    const prompt = () => new Promise<string>(resolve => {
      const modeIndicator = this.vimMode !== 'normal'
        ? chalk.hex(c.magenta)(`(${this.vimMode.toUpperCase()}) `)
        : '';
      const promptChar = chalk.hex(c.tealMid)('│');
      this.rl.question(`  ${modeIndicator}${promptChar} `, answer => resolve(answer));
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
