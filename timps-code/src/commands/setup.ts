// ── TIMPS setup — register TIMPS memory as an MCP server for every
// coding agent installed on this machine (Claude Code, Codex, OpenCode,
// Cursor, Windsurf, Gemini CLI, …). The single "npx timps setup" wedge.
//
// Every agent speaks MCP over stdio, so one registration per agent is all
// that's needed. Default mode is LOCAL (MemoryEngine + FileBackend in the
// agent's project cwd) — zero infrastructure, zero API keys. Pass
// --server <url> to point agents at a shared MemoryServer instead.

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface SetupOptions {
  list?: boolean;
  uninstall?: boolean;
  server?: string;
  binary?: string;
  dryRun?: boolean;
  noInstructions?: boolean;
}

export interface McpRegistration {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface AgentTarget {
  id: string;
  name: string;
  detect(): boolean;
  readConfig(): unknown | undefined;
  writeConfig(config: unknown): void;
  register(reg: McpRegistration, config: Record<string, unknown>): void;
  unregister(config: Record<string, unknown>): void;
  /** User-level instruction file this agent reads in every session (for auto-capture). */
  instructionFile?: string;
  /** Cursor-style `.mdc` rule file (YAML frontmatter + `alwaysApply`). */
  instructionMdc?: boolean;
}

const SERVER_NAME = 'timps';
const DEFAULT_COMMAND = 'npx';
const DEFAULT_ARGS = ['-y', '@timps-ai/timps-mcp'];

const c = {
  reset: '\x1b[0m',
  teal: '\x1b[38;5;36m',
  green: '\x1b[38;5;71m',
  yellow: '\x1b[38;5;221m',
  red: '\x1b[38;5;167m',
  dim: '\x1b[38;5;243m',
  bold: '\x1b[1m',
};

function ok(s: string): string {
  return `${c.green}✓${c.reset} ${s}`;
}
function warn(s: string): string {
  return `${c.yellow}⚠${c.reset} ${s}`;
}
function err(s: string): string {
  return `${c.red}✖${c.reset} ${s}`;
}

// ── JSON config helpers ───────────────────────────────────────────────────────

function readJson(file: string): Record<string, unknown> | undefined {
  try {
    if (!fs.existsSync(file)) return undefined;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return undefined;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch (e) {
    console.error(warn(`Could not parse ${file}: ${(e as Error).message}`));
    return undefined;
  }
}

function writeJson(file: string, config: Record<string, unknown>, dryRun: boolean): void {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

// ── TOML config helpers (Codex) ───────────────────────────────────────────────

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function upsertTomlSection(content: string, header: string, body: string, dryRun = false): string {
  const re = new RegExp(`^\\[${escapeRegExp(header)}\\].*$`, 'm');
  const existing = re.exec(content);
  let next: RegExpExecArray | null;
  if (existing) {
    // Replace from the header up to the next top-level or sibling section.
    const after = content.slice(existing.index);
    const sibling = /^\[[\w.-]+\]/m.exec(after.slice(after.indexOf('\n')));
    const end = sibling ? existing.index + after.indexOf('\n') + sibling.index : content.length;
    content = `${content.slice(0, existing.index)}[${header}]\n${body}\n${content.slice(end)}`;
  } else {
    content = `${content.replace(/\s*$/, '')}\n\n[${header}]\n${body}\n`;
  }
  return content;
}

export function tomlString(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// ── Agent detection ───────────────────────────────────────────────────────────

function home(...parts: string[]): string {
  return path.join(os.homedir(), ...parts);
}

function hasBin(name: string): boolean {
  try {
    execSync(`command -v ${name}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ── Registration targets ──────────────────────────────────────────────────────

export const targets: AgentTarget[] = [
  // Claude Code → ~/.claude.json { mcpServers } + ~/.claude/CLAUDE.md
  {
    id: 'claude',
    name: 'Claude Code',
    detect: () => hasBin('claude') || fs.existsSync(home('.claude.json')),
    readConfig: () => readJson(home('.claude.json')),
    writeConfig: (config) => writeJson(home('.claude.json'), config as Record<string, unknown>, false),
    instructionFile: home('.claude/CLAUDE.md'),
    register(reg, config) {
      const mcp = (config.mcpServers as Record<string, unknown> | undefined) ?? {};
      mcp[SERVER_NAME] = { command: reg.command, args: reg.args, ...(Object.keys(reg.env).length ? { env: reg.env } : {}) };
      config.mcpServers = mcp;
    },
    unregister(config) {
      const mcp = config.mcpServers as Record<string, unknown> | undefined;
      if (mcp) delete mcp[SERVER_NAME];
    },
  },

  // OpenCode → ~/.config/opencode/opencode.json { mcp } + ~/.config/opencode/AGENTS.md
  {
    id: 'opencode',
    name: 'OpenCode',
    detect: () => hasBin('opencode') || fs.existsSync(home('.config/opencode/opencode.json')),
    readConfig: () => readJson(home('.config/opencode/opencode.json')),
    writeConfig: (config) => writeJson(home('.config/opencode/opencode.json'), config as Record<string, unknown>, false),
    instructionFile: home('.config/opencode/AGENTS.md'),
    register(reg, config) {
      const mcp = (config.mcp as Record<string, unknown> | undefined) ?? {};
      mcp[SERVER_NAME] = {
        type: 'local',
        command: [reg.command, ...reg.args],
        enabled: true,
        ...(Object.keys(reg.env).length ? { environment: reg.env } : {}),
      };
      config.mcp = mcp;
    },
    unregister(config) {
      const mcp = config.mcp as Record<string, unknown> | undefined;
      if (mcp) delete mcp[SERVER_NAME];
    },
  },

  // Codex → ~/.codex/config.toml [mcp_servers.timps] + ~/.codex/AGENTS.md
  {
    id: 'codex',
    name: 'Codex CLI',
    detect: () => hasBin('codex') || fs.existsSync(home('.codex/config.toml')),
    readConfig: () => {
      const file = home('.codex/config.toml');
      return fs.existsSync(file) ? { _raw: fs.readFileSync(file, 'utf8') } : undefined;
    },
    writeConfig: (config) => {
      const file = home('.codex/config.toml');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, (config as { _raw: string })._raw, 'utf8');
    },
    instructionFile: home('.codex/AGENTS.md'),
    register(reg, config) {
      const raw = (config._raw as string) ?? '';
      const envBlock = Object.keys(reg.env).length
        ? `${Object.entries(reg.env).map(([k, v]) => `${k} = ${tomlString(v)}`).join('\n')}\n`
        : '';
      const body = `${envBlock}command = ${tomlString(reg.command)}\nargs = [${reg.args.map(tomlString).join(', ')}]`;
      (config as Record<string, unknown>)._raw = upsertTomlSection(raw, 'mcp_servers.timps', body, false);
    },
    unregister(config) {
      const raw = (config._raw as string) ?? '';
      const re = /^\[mcp_servers\.timps\]\s*(?:\n(?!\[)[^\n]*)*\n?/m;
      (config as Record<string, unknown>)._raw = raw.replace(re, '');
    },
  },

  // Cursor → ~/.cursor/mcp.json { mcpServers } + ~/.cursor/rules/timps.mdc (global rule)
  {
    id: 'cursor',
    name: 'Cursor',
    detect: () => fs.existsSync(home('.cursor/mcp.json')),
    readConfig: () => readJson(home('.cursor/mcp.json')),
    writeConfig: (config) => writeJson(home('.cursor/mcp.json'), config as Record<string, unknown>, false),
    instructionFile: home('.cursor/rules/timps.mdc'),
    instructionMdc: true,
    register(reg, config) {
      const mcp = (config.mcpServers as Record<string, unknown> | undefined) ?? {};
      mcp[SERVER_NAME] = { command: reg.command, args: reg.args, ...(Object.keys(reg.env).length ? { env: reg.env } : {}) };
      config.mcpServers = mcp;
    },
    unregister(config) {
      const mcp = config.mcpServers as Record<string, unknown> | undefined;
      if (mcp) delete mcp[SERVER_NAME];
    },
  },

  // Windsurf → ~/.codeium/windsurf/mcp_config.json { mcpServers }
  {
    id: 'windsurf',
    name: 'Windsurf',
    detect: () => fs.existsSync(home('.codeium/windsurf/mcp_config.json')),
    readConfig: () => readJson(home('.codeium/windsurf/mcp_config.json')),
    writeConfig: (config) => writeJson(home('.codeium/windsurf/mcp_config.json'), config as Record<string, unknown>, false),
    register(reg, config) {
      const mcp = (config.mcpServers as Record<string, unknown> | undefined) ?? {};
      mcp[SERVER_NAME] = { command: reg.command, args: reg.args, ...(Object.keys(reg.env).length ? { env: reg.env } : {}) };
      config.mcpServers = mcp;
    },
    unregister(config) {
      const mcp = config.mcpServers as Record<string, unknown> | undefined;
      if (mcp) delete mcp[SERVER_NAME];
    },
  },

  // Gemini CLI → ~/.gemini/settings.json { mcpServers } + ~/.gemini/GEMINI.md
  {
    id: 'gemini',
    name: 'Gemini CLI',
    detect: () => hasBin('gemini') || fs.existsSync(home('.gemini/settings.json')) || fs.existsSync(home('.gemini/GEMINI.md')),
    readConfig: () => readJson(home('.gemini/settings.json')),
    writeConfig: (config) => writeJson(home('.gemini/settings.json'), config as Record<string, unknown>, false),
    instructionFile: home('.gemini/GEMINI.md'),
    register(reg, config) {
      const mcp = (config.mcpServers as Record<string, unknown> | undefined) ?? {};
      mcp[SERVER_NAME] = {
        type: 'stdio',
        command: [reg.command, ...reg.args],
        ...(Object.keys(reg.env).length ? { env: reg.env } : {}),
      };
      config.mcpServers = mcp;
    },
    unregister(config) {
      const mcp = config.mcpServers as Record<string, unknown> | undefined;
      if (mcp) delete mcp[SERVER_NAME];
    },
  },
];

// ── Memory instructions (auto-capture) ────────────────────────────────────────
// Each installed agent gets a short, marker-fenced block appended to the
// user-level instruction file it reads in every session. It tells the agent to
// pull TIMPS context at session start and store user data as it happens, so
// capture stops depending on model whims. `timps setup --uninstall` removes it.

export const INSTRUCTION_START = '<!-- timps:memory:start -->';
export const INSTRUCTION_END = '<!-- timps:memory:end -->';

export function buildInstructionBlock(): string {
  return [
    INSTRUCTION_START,
    '# TIMPS Memory (installed by `timps setup`)',
    '',
    'TIMPS is your persistent long-term memory layer, shared across every coding agent on this machine. The `timps` MCP server exposes memory tools prefixed with `timps_`. Use them in every session:',
    '',
    '- **Load context first** — at the start of a session, or before answering a question about the user or project, call `timps_get_memories` and ground your answers on what comes back.',
    '- **Store as you go** — proactively store anything the user says that will matter later: preferences, decisions and the reasoning behind them, project facts, goals, and opinions. Use `timps_store_memory` (or `timps_chat` for a message that also runs contradiction and burnout checks).',
    '- **Never contradict the user\u2019s history** — before stating a strong opinion or recommending a decision, call `timps_check_contradiction`. If it reports a contradiction, surface it and ask instead of asserting.',
    '- **Never fabricate or store secrets** — store only what the user actually said; never store passwords, API keys, or credentials.',
    '- **On "remember?"** — if the user asks "do you know me", "what do you remember", or similar, call `timps_get_memories` before replying.',
    INSTRUCTION_END,
  ].join('\n');
}

const INSTRUCTION_RE = /<!-- timps:memory:start -->[\s\S]*?<!-- timps:memory:end -->\n?/;

export function installInstructions(target: AgentTarget, dryRun = false): 'installed' | 'unchanged' | 'skipped' {
  const file = target.instructionFile;
  if (!file) return 'skipped';
  const block = buildInstructionBlock();
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (INSTRUCTION_RE.test(existing)) return 'unchanged';

  if (dryRun) return 'installed';

  if (target.instructionMdc) {
    const frontmatter = [
      '---',
      'description: TIMPS memory layer — load context and store user data (installed by timps setup)',
      'globs: ["**/*"]',
      'alwaysApply: true',
      '---',
      '',
    ].join('\n');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${frontmatter}${block}\n`, 'utf8');
    return 'installed';
  }

  const next = existing.trim() ? `${existing.replace(/\s*$/, '')}\n\n${block}\n` : `${block}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next, 'utf8');
  return 'installed';
}

export function uninstallInstructions(target: AgentTarget, dryRun = false): boolean {
  const file = target.instructionFile;
  if (!file) return false;
  if (!fs.existsSync(file)) return false;
  const existing = fs.readFileSync(file, 'utf8');
  if (!INSTRUCTION_RE.test(existing)) return false;

  if (dryRun) return true;

  const cleaned = existing.replace(INSTRUCTION_RE, '');
  if (target.instructionMdc) {
    // The .mdc rule file is managed by us — remove it if only our rule remains.
    const remaining = cleaned.replace(/^---[\s\S]*?---\n?/, '').trim();
    if (!remaining) {
      fs.rmSync(file, { force: true });
      return true;
    }
  }
  fs.writeFileSync(file, cleaned.trim() ? `${cleaned.replace(/\s*$/, '')}\n` : '', 'utf8');
  return true;
}

// ── Command resolution ────────────────────────────────────────────────────────

export function buildRegistration(opts: SetupOptions): McpRegistration {
  const env: Record<string, string> = {};
  if (opts.server) {
    env.TIMPS_URL = opts.server;
    // Memory tools (store/recall/contradiction) route through the MemoryClient,
    // which only activates when TIMPS_MEMORY_URL is also set. Override via
    // TIMPS_SETUP_ENV if you run the legacy packages/server API separately.
    env.TIMPS_MEMORY_URL = opts.server;
  }
  const extraEnv = process.env.TIMPS_SETUP_ENV;
  if (extraEnv) {
    for (const pair of extraEnv.split(',')) {
      const eq = pair.indexOf('=');
      if (eq > 0) env[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
  }
  if (opts.binary) {
    return { command: opts.binary, args: [], env };
  }
  return { command: DEFAULT_COMMAND, args: [...DEFAULT_ARGS], env };
}

// ── Command ──────────────────────────────────────────────────────────────────

export function addSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Register TIMPS memory as an MCP server for every installed coding agent (Claude Code, Codex, OpenCode, Cursor, Windsurf, Gemini CLI)')
    .option('--list', 'Only list detected agents, do not modify anything')
    .option('--uninstall', 'Remove TIMPS MCP registrations from all detected agents')
    .option('--server <url>', 'Point agents at a shared MemoryServer instead of local mode (e.g. http://localhost:4100; sets TIMPS_URL + TIMPS_MEMORY_URL — see DEPLOY.md → MemoryServer)')
    .option('--binary <path>', 'Point agents at a specific timps-mcp binary or bundle path')
    .option('--no-instructions', 'Skip installing memory-usage instructions into agent rule files')
    .option('--dry-run', 'Preview changes without writing files')
    .action(async (opts: SetupOptions) => {
      await runSetup(opts);
    });
}

export async function runSetup(opts: SetupOptions): Promise<number> {
  const mode = opts.uninstall ? 'uninstall' : opts.list ? 'list' : 'install';
  const label = mode === 'uninstall' ? 'Uninstall' : mode === 'list' ? 'Scan' : 'Setup';

  console.log(`\n${c.teal}${c.bold}TIMPS ${label}${c.reset} — memory layer for every coding agent\n`);

  const detected = targets.filter((t) => t.detect());

  if (detected.length === 0) {
    console.log(warn('No supported coding agents detected.'));
    console.log(`  ${c.dim}Claude Code, Codex, OpenCode, Cursor, Windsurf, and Gemini CLI are supported.${c.reset}\n`);
    return 1;
  }

  const registration = buildRegistration(opts);
  const commandLabel = registration.args.length
    ? `${registration.command} ${registration.args.join(' ')}`
    : registration.command;
  if (mode === 'install') {
    console.log(`  ${c.dim}Will register MCP server:${c.reset} ${c.teal}${SERVER_NAME}${c.reset} → ${c.dim}${commandLabel}${c.reset}`);
    if (opts.server) {
      console.log(`  ${c.dim}Mode:${c.reset} ${c.teal}server${c.reset} → ${c.dim}${opts.server}${c.reset}`);
      console.log(`  ${c.dim}Memory tools (store/recall/contradiction) →${c.reset} ${c.dim}${opts.server} via TIMPS_MEMORY_URL${c.reset}`);
      console.log(`  ${c.dim}Deploy guide:${c.reset} ${c.teal}DEPLOY.md${c.reset} ${c.dim}→ Option 5: MemoryServer full stack${c.reset}`);
    }
    else console.log(`  ${c.dim}Mode:${c.reset} ${c.teal}local${c.reset} → ${c.dim}FileBackend in the agent's project directory (no server, no API keys)${c.reset}`);
    if (!opts.noInstructions) console.log(`  ${c.dim}Will also install:${c.reset} ${c.teal}memory-usage instructions${c.reset} ${c.dim}in each agent's global rule file (auto-capture of user data)${c.reset}`);
    if (opts.dryRun) console.log(`  ${warn('Dry run — no files will be written.')}\n`);
    else console.log();
  } else {
    console.log();
  }

  let changed = 0;
  for (const t of detected) {
    const config = t.readConfig();
    const exists = config !== undefined;

    if (mode === 'list') {
      const pathLabel = describePath(t.id);
      const instructions = t.instructionFile
        ? `${c.dim} · instructions: ${t.instructionFile.replace(os.homedir(), '~')}${c.reset}`
        : '';
      console.log(`  ${ok(t.name)}${c.dim} (${exists ? 'configured' : 'not configured'})${c.reset}${exists ? `  ${c.dim}→ ${pathLabel}${c.reset}` : ''}${instructions}`);
      continue;
    }

    const next = exists ? config : {};
    const before = JSON.stringify(next);

    if (mode === 'install') {
      t.register(registration, next as Record<string, unknown>);
    } else {
      t.unregister(next as Record<string, unknown>);
    }
    const after = JSON.stringify(next);

    if (before === after) {
      console.log(`  ${c.dim}${t.name}:${c.reset} ${c.dim}already ${mode === 'install' ? 'registered' : 'absent'} (no config change)${c.reset}`);
      continue;
    }

    if (!opts.dryRun) t.writeConfig(next);
    changed++;
    console.log(`  ${ok(t.name)} ${mode === 'install' ? 'registered' : 'unregistered'}`);
  }

  // ── Memory instructions (auto-capture) ──
  let instructionChanges = 0;
  if (mode !== 'list' && !opts.noInstructions) {
    for (const t of detected) {
      if (!t.instructionFile) {
        console.log(`  ${c.dim}${t.name}:${c.reset} ${c.dim}no user-level instruction file supported (MCP registered only)${c.reset}`);
        continue;
      }
      const label = t.instructionFile.replace(os.homedir(), '~');
      if (mode === 'install') {
        const status = installInstructions(t, opts.dryRun);
        if (status === 'unchanged') {
          console.log(`  ${c.dim}${t.name} instructions:${c.reset} ${c.dim}already present (${label})${c.reset}`);
        } else if (status === 'installed') {
          instructionChanges++;
          console.log(`  ${ok(`${t.name} instructions`)}${c.dim} → ${label}${c.reset}`);
        }
      } else if (uninstallInstructions(t, opts.dryRun)) {
        instructionChanges++;
        console.log(`  ${ok(`${t.name} instructions removed`)}${c.dim} (${label})${c.reset}`);
      }
    }
    if (!opts.dryRun) {
      console.log(`  ${c.dim}${mode === 'install' ? 'Installed' : 'Removed'} memory instructions:${c.reset} ${instructionChanges} file${instructionChanges === 1 ? '' : 's'}${c.reset}`);
    } else {
      console.log(`  ${warn('Dry run — memory instructions not written.')}`);
    }
  }

  console.log();
  if (mode === 'list') {
    const missing = targets.filter((t) => !t.detect()).map((t) => t.name);
    if (missing.length) console.log(`  ${c.dim}Not detected: ${missing.join(', ')}${c.reset}\n`);
    console.log(`  ${c.dim}Run${c.reset} ${c.teal}timps setup${c.reset} ${c.dim}to register TIMPS with the detected agents.${c.reset}\n`);
    return 0;
  }

  if (changed === 0 && instructionChanges === 0) {
    console.log(`${warn(`Nothing to ${mode === 'install' ? 'do' : 'remove'}.`)}\n`);
    return 0;
  }

  const mcpPart = changed ? `${changed} agent${changed === 1 ? '' : 's'} ${mode === 'install' ? 'connected to TIMPS memory' : 'disconnected'}` : 'MCP registrations unchanged';
  const instPart = !opts.noInstructions
    ? ` · ${instructionChanges} instruction file${instructionChanges === 1 ? '' : 's'} ${mode === 'install' ? 'updated' : 'removed'}`
    : '';
  console.log(`${ok(`${mcpPart}.${instPart}`)}`);
  console.log(`  ${c.dim}Restart your agent(s) to pick up the new MCP server.${c.reset}`);
  console.log(`  ${c.dim}Verify with:${c.reset} ${c.teal}timps setup --list${c.reset}\n`);
  return 0;
}

function describePath(id: string): string {
  switch (id) {
    case 'claude':
      return home('.claude.json');
    case 'opencode':
      return home('.config/opencode/opencode.json');
    case 'codex':
      return home('.codex/config.toml');
    case 'cursor':
      return home('.cursor/mcp.json');
    case 'windsurf':
      return home('.codeium/windsurf/mcp_config.json');
    case 'gemini':
      return home('.gemini/settings.json');
    default:
      return '';
  }
}
