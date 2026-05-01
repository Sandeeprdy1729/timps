import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as childProcess from 'node:child_process';
import type { ModelProvider } from '../config/types.js';
import type { Memory } from '../memory/memory.js';
import { loadConfig, saveConfig, getMemoryDir } from '../config/config.js';
import { t, icons } from '../config/theme.js';
import { listOllamaModels } from '../models/ollama.js';

export interface CommandContext {
  cwd: string;
  provider: ModelProvider;
  memory?: Memory;
  clearHistory?: () => void;
  getStats?: () => { turns: number; tokens: number; cost: number };
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  execute(ctx: CommandContext, args: string): Promise<void>;
}

const COMMANDS: Command[] = [];

function reg(cmd: Command) { COMMANDS.push(cmd); }

// ─────────────────────────────────────────
// /help
// ─────────────────────────────────────────
reg({
  name: 'help', aliases: ['h', '?'],
  description: 'Show all available commands',
  async execute() {
    console.log('\n' + t.brandBold('  ⚡ TIMPS Code Commands\n'));
    for (const cmd of COMMANDS) {
      const alias = cmd.aliases ? chalk.dim(` (${cmd.aliases.join(', ')})`) : '';
      console.log(`  ${t.accent('/' + cmd.name)}${alias}`);
      console.log(`    ${t.dim(cmd.description)}`);
      if (cmd.usage) console.log(`    ${t.dim('Usage:')} ${chalk.gray(cmd.usage)}`);
    }
    console.log();
  },
});

// ─────────────────────────────────────────
// /clear
// ─────────────────────────────────────────
reg({
  name: 'clear', aliases: ['c'],
  description: 'Clear conversation history (keeps system prompt)',
  async execute(ctx) {
    ctx.clearHistory?.();
    console.log(t.success('  ✔ History cleared'));
  },
});

// ─────────────────────────────────────────
// /model
// ─────────────────────────────────────────
reg({
  name: 'model', aliases: ['m'],
  description: 'Show current model info',
  async execute(ctx) {
    const { provider } = ctx;
    console.log(`\n  Provider : ${t.accent(provider.name)}`);
    console.log(`  Model    : ${t.accent(provider.model)}`);
    console.log(`  Tool use : ${provider.supportsFunctionCalling ? t.success('yes') : t.warning('no (text mode)')}\n`);
  },
});

// ─────────────────────────────────────────
// /models
// ─────────────────────────────────────────
reg({
  name: 'models',
  description: 'List available models (Ollama: lists local models)',
  async execute(ctx) {
    if (ctx.provider.name === 'ollama') {
      const config = loadConfig();
      console.log(t.dim('\n  Fetching Ollama models...'));
      const models = await listOllamaModels(config.ollamaUrl);
      if (models.length === 0) {
        console.log(t.warning('  No models found. Run: ollama pull qwen2.5-coder:latest'));
      } else {
        console.log(t.bold('\n  Installed Ollama models:\n'));
        models.forEach(m => console.log(`    ${t.accent(m)}`));
      }
    } else {
      console.log(t.dim('\n  Cloud providers: models are set in config or via --model flag'));
    }
    console.log();
  },
});

// ─────────────────────────────────────────
// /status
// ─────────────────────────────────────────
reg({
  name: 'status', aliases: ['s'],
  description: 'Show session stats: token usage, cost, turns',
  async execute(ctx) {
    const stats = ctx.getStats?.() || { turns: 0, tokens: 0, cost: 0 };
    console.log(`\n  ${t.bold('Session Stats')}`);
    console.log(`  Turns  : ${t.accent(String(stats.turns))}`);
    console.log(`  Tokens : ${t.accent(stats.tokens.toLocaleString())}`);
    if (stats.cost > 0) console.log(`  Cost   : ${t.accent('$' + stats.cost.toFixed(4))}`);
    console.log();
  },
});

// ─────────────────────────────────────────
// /memory
// ─────────────────────────────────────────
reg({
  name: 'memory', aliases: ['mem'],
  description: 'Show memory stats and recent facts',
  usage: '/memory [clear|search <query>]',
  async execute(ctx, args) {
    if (!ctx.memory) {
      console.log(t.dim('  Memory disabled.'));
      return;
    }

    const [sub, ...rest] = args.trim().split(' ');

    if (sub === 'clear') {
      ctx.memory.clearWorking();
      console.log(t.success('  ✔ Working memory cleared'));
      return;
    }

    if (sub === 'search') {
      const query = rest.join(' ');
      if (!query) { console.log(t.dim('  Usage: /memory search <query>')); return; }
      const results = ctx.memory.searchFacts(query, 10);
      if (results.length === 0) {
        console.log(t.dim('  No matching memories found.'));
      } else {
        console.log(t.bold(`\n  Memory search: "${query}"\n`));
        results.forEach(r => console.log(`  ${t.dim('[' + r.type + ']')} ${r.content}`));
      }
      console.log();
      return;
    }

    const stats = ctx.memory.getStats();
    const working = ctx.memory.workingMemory;
    const episodes = ctx.memory.loadEpisodes(5);

    console.log(`\n  ${t.bold('Memory Stats')}`);
    console.log(`  Semantic facts : ${t.accent(String(stats.semanticCount))}`);
    console.log(`  Episodes       : ${t.accent(String(stats.episodeCount))}`);
    console.log(`  Active files   : ${t.accent(String(stats.workingFiles))}`);

    if (working.currentGoal) console.log(`\n  ${t.dim('Goal:')} ${working.currentGoal.slice(0, 80)}`);

    if (episodes.length > 0) {
      console.log(`\n  ${t.bold('Recent sessions:')}`);
      episodes.slice(-5).forEach(e => {
        const dt = new Date(e.timestamp).toLocaleDateString();
        const icon = e.outcome === 'success' ? t.success('✔') : e.outcome === 'failed' ? t.error('✘') : t.warning('◐');
        console.log(`  ${icon} ${dt} — ${e.summary.slice(0, 60)}`);
      });
    }
    console.log();
  },
});

// ─────────────────────────────────────────
// /git
// ─────────────────────────────────────────
reg({
  name: 'git',
  description: 'Quick git status + recent commits',
  async execute(ctx) {
    try {
      const status = childProcess.execSync('git status -s', { cwd: ctx.cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      const branch = childProcess.execSync('git branch --show-current', { cwd: ctx.cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      const log = childProcess.execSync('git log --oneline -5', { cwd: ctx.cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      console.log(`\n  Branch: ${t.accent(branch)}`);
      if (status) { console.log(`\n  ${t.bold('Changes:')}\n${status.split('\n').map(l => '  ' + l).join('\n')}`); }
      else { console.log(`  ${t.dim('Working tree clean')}`); }
      if (log) { console.log(`\n  ${t.bold('Recent commits:')}\n${log.split('\n').map(l => '  ' + chalk.dim(l)).join('\n')}`); }
    } catch {
      console.log(t.dim('  Not a git repository.'));
    }
    console.log();
  },
});

// ─────────────────────────────────────────
// /todo
// ─────────────────────────────────────────
reg({
  name: 'todo', aliases: ['tasks', 't'],
  description: 'Show current todo list',
  async execute() {
    const todoFile = path.join(os.homedir(), '.timps', 'todos.json');
    if (!fs.existsSync(todoFile)) { console.log(t.dim('\n  No todos.\n')); return; }
    try {
      const todos = JSON.parse(fs.readFileSync(todoFile, 'utf-8'));
      if (todos.length === 0) { console.log(t.dim('\n  No todos.\n')); return; }
      console.log(`\n  ${t.bold('Todos:')}\n`);
      todos.forEach((todo: any) => {
        const s = todo.status === 'completed' ? t.success('✔') : todo.status === 'in_progress' ? t.warning('◐') : t.dim('○');
        const p = todo.priority === 'urgent' ? t.error('!') : todo.priority === 'high' ? t.warning('↑') : ' ';
        console.log(`  ${s} ${p} ${t.dim('[' + todo.id + ']')} ${todo.title}`);
      });
      console.log();
    } catch {
      console.log(t.error('  Failed to read todos.'));
    }
  },
});

// ─────────────────────────────────────────
// /doctor
// ─────────────────────────────────────────
reg({
  name: 'doctor',
  description: 'Check system health: Node, git, tools, API keys',
  async execute(ctx) {
    console.log(`\n  ${t.bold('⚡ TIMPS Doctor\n')}`);

    const check = (label: string, ok: boolean, note?: string) => {
      const icon = ok ? t.success('✔') : t.error('✘');
      const msg = note ? ` ${t.dim(note)}` : '';
      console.log(`  ${icon} ${label}${msg}`);
    };

    // Node version
    const nodeVer = process.version;
    const nodeMajor = parseInt(nodeVer.slice(1));
    check('Node.js ' + nodeVer, nodeMajor >= 18, nodeMajor < 18 ? '(requires v18+)' : '');

    // git
    try { childProcess.execSync('git --version', { stdio: 'pipe' }); check('git', true); }
    catch { check('git', false, '(not found — install git)'); }

    // ripgrep (optional but fast)
    try { childProcess.execSync('which rg', { stdio: 'pipe' }); check('ripgrep (rg)', true, '(fast search)'); }
    catch { check('ripgrep (rg)', false, '(optional — brew install ripgrep)'); }

    // API keys
    const config = loadConfig();
    const providers: Array<[string, string]> = [
      ['ANTHROPIC_API_KEY', 'Claude'],
      ['OPENAI_API_KEY', 'OpenAI'],
      ['GEMINI_API_KEY', 'Gemini'],
      ['OPENROUTER_API_KEY', 'OpenRouter'],
      ['DEEPSEEK_API_KEY', 'DeepSeek'],
      ['GROQ_API_KEY', 'Groq'],
    ];
    for (const [env, label] of providers) {
      const hasKey = !!(process.env[env] || config.keys[label.toLowerCase() as any]);
      if (hasKey) check(label + ' API key', true);
    }

    // Ollama
    try {
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json() as any;
        const count = data.models?.length || 0;
        check(`Ollama (${count} models)`, true);
      } else {
        check('Ollama', false, '(not running — try: ollama serve)');
      }
    } catch {
      check('Ollama', false, '(not running — optional)');
    }

    // Config file
    const configPath = path.join(os.homedir(), '.timps', 'config.json');
    check('Config file', fs.existsSync(configPath), fs.existsSync(configPath) ? configPath : '(run: timps --setup)');

    console.log(`\n  Provider: ${t.accent(ctx.provider.name)} | Model: ${t.accent(ctx.provider.model)}\n`);
  },
});

// ─────────────────────────────────────────
// /compact
// ─────────────────────────────────────────
reg({
  name: 'compact',
  description: 'Manually compact conversation context to save tokens',
  async execute(ctx) {
    console.log(t.dim('  Context compaction is handled automatically by the agent.'));
    console.log(t.dim('  Use /clear to completely reset the conversation.'));
  },
});

// ─────────────────────────────────────────
// /config
// ─────────────────────────────────────────
reg({
  name: 'config',
  description: 'Show current configuration',
  async execute() {
    const config = loadConfig();
    console.log(`\n  ${t.bold('Configuration')}`);
    console.log(`  Provider  : ${t.accent(config.defaultProvider)}`);
    console.log(`  Model     : ${t.accent(config.defaultModel)}`);
    console.log(`  Trust     : ${t.accent(config.trustLevel)}`);
    console.log(`  Memory    : ${config.memoryEnabled ? t.success('enabled') : t.dim('disabled')}`);
    console.log(`  Max ctx   : ${t.accent((config.maxContextTokens / 1000).toFixed(0) + 'k tokens')}`);
    if (config.ollamaUrl) console.log(`  Ollama URL: ${t.dim(config.ollamaUrl)}`);
    console.log();
  },
});

// ─────────────────────────────────────────
// /exit / /quit
// ─────────────────────────────────────────
reg({
  name: 'exit', aliases: ['quit', 'q'],
  description: 'Exit TIMPS Code',
  async execute() {
    console.log(t.dim('\n  Goodbye.\n'));
    process.exit(0);
  },
});

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

export function getAllCommands(): Command[] { return COMMANDS; }

export async function handleCommand(
  input: string,
  ctx: CommandContext
): Promise<{ handled: boolean }> {
  if (!input.startsWith('/')) return { handled: false };

  const [rawName, ...rest] = input.slice(1).split(' ');
  const name = rawName.toLowerCase();
  const args = rest.join(' ');

  const cmd = COMMANDS.find(c => c.name === name || c.aliases?.includes(name));
  if (!cmd) {
    console.log(t.error(`  Unknown command: /${name}`) + t.dim(' (try /help)'));
    return { handled: true };
  }

  await cmd.execute(ctx, args);
  return { handled: true };
}
