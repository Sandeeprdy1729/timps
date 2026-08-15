import { describe, expect, it } from 'vitest';
import {
  buildRegistration,
  targets,
  tomlString,
  upsertTomlSection,
  buildInstructionBlock,
  installInstructions,
  uninstallInstructions,
  INSTRUCTION_START,
  INSTRUCTION_END,
  type McpRegistration,
  type AgentTarget,
} from './setup.js';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const reg: McpRegistration = { command: 'npx', args: ['-y', '@timps-ai/timps-mcp'], env: {} };
const serverReg: McpRegistration = { command: 'npx', args: ['-y', '@timps-ai/timps-mcp'], env: { TIMPS_URL: 'http://localhost:4100' } };

function target(id: string) {
  const t = targets.find((x) => x.id === id);
  if (!t) throw new Error(`no target ${id}`);
  return t;
}

describe('upsertTomlSection', () => {
  it('appends a new section at the end of the file', () => {
    const out = upsertTomlSection('[foo]\nkey = 1\n', 'mcp_servers.timps', 'command = "npx"');
    expect(out).toContain('[mcp_servers.timps]');
    expect(out).toContain('command = "npx"');
    expect(out).toContain('[foo]');
  });

  it('replaces an existing section without clobbering siblings', () => {
    const input = [
      '[mcp_servers.node_repl]',
      'command = "npx"',
      'args = ["-y", "@replit/node-repl"]',
      '',
      '[mcp_servers.timps]',
      'command = "old"',
      '',
      '[other]',
      'x = 1',
    ].join('\n');
    const out = upsertTomlSection(input, 'mcp_servers.timps', 'command = "new"');
    expect(out).toContain('[mcp_servers.node_repl]');
    expect(out).toContain('[other]');
    const timpsBlock = out.match(/\[mcp_servers\.timps\]\ncommand = "new"/);
    expect(timpsBlock).toBeTruthy();
    expect(out).not.toContain('command = "old"');
  });

  it('appends to an empty file', () => {
    const out = upsertTomlSection('', 'mcp_servers.timps', 'command = "npx"');
    expect(out).toContain('[mcp_servers.timps]');
  });
});

describe('tomlString', () => {
  it('quotes and escapes values', () => {
    expect(tomlString('npx')).toBe('"npx"');
    expect(tomlString('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});

describe('buildRegistration', () => {
  it('defaults to npx -y @timps-ai/timps-mcp', () => {
    const r = buildRegistration({});
    expect(r).toEqual({ command: 'npx', args: ['-y', '@timps-ai/timps-mcp'], env: {} });
  });

  it('uses --binary as the command with no args', () => {
    const r = buildRegistration({ binary: '/usr/local/bin/timps-mcp' });
    expect(r).toEqual({ command: '/usr/local/bin/timps-mcp', args: [], env: {} });
  });

  it('sets TIMPS_URL env when --server is provided', () => {
    const r = buildRegistration({ server: 'http://localhost:4100' });
    expect(r.env.TIMPS_URL).toBe('http://localhost:4100');
  });
});

describe('JSON agent targets', () => {
  it('claude registers timps in mcpServers preserving existing servers', () => {
    const t = target('claude');
    const config: Record<string, unknown> = { mcpServers: { other: { command: 'x' } } };
    t.register(reg, config);
    expect((config.mcpServers as Record<string, unknown>).timps).toEqual({ command: 'npx', args: ['-y', '@timps-ai/timps-mcp'] });
    expect((config.mcpServers as Record<string, unknown>).other).toBeDefined();
    t.unregister(config);
    expect((config.mcpServers as Record<string, unknown>).timps).toBeUndefined();
    expect((config.mcpServers as Record<string, unknown>).other).toBeDefined();
  });

  it('claude adds env when server mode is used', () => {
    const t = target('claude');
    const config: Record<string, unknown> = {};
    t.register(serverReg, config);
    const entry = (config.mcpServers as Record<string, unknown>).timps as Record<string, unknown>;
    expect(entry.env).toEqual({ TIMPS_URL: 'http://localhost:4100' });
  });

  it('opencode registers with type local + command array + enabled', () => {
    const t = target('opencode');
    const config: Record<string, unknown> = { mcp: { other: { type: 'remote', url: 'http://x' } } };
    t.register(reg, config);
    const entry = (config.mcp as Record<string, unknown>).timps as Record<string, unknown>;
    expect(entry).toEqual({ type: 'local', command: ['npx', '-y', '@timps-ai/timps-mcp'], enabled: true });
    expect((config.mcp as Record<string, unknown>).other).toBeDefined();
    t.unregister(config);
    expect((config.mcp as Record<string, unknown>).timps).toBeUndefined();
  });

  it('gemini registers with type stdio', () => {
    const t = target('gemini');
    const config: Record<string, unknown> = {};
    t.register(reg, config);
    const entry = (config.mcpServers as Record<string, unknown>).timps as Record<string, unknown>;
    expect(entry.type).toBe('stdio');
    expect(entry.command).toEqual(['npx', '-y', '@timps-ai/timps-mcp']);
  });

  it('cursor and windsurf use mcpServers format', () => {
    for (const id of ['cursor', 'windsurf']) {
      const t = target(id);
      const config: Record<string, unknown> = {};
      t.register(reg, config);
      expect((config.mcpServers as Record<string, unknown>).timps).toEqual({ command: 'npx', args: ['-y', '@timps-ai/timps-mcp'] });
      t.unregister(config);
      expect((config.mcpServers as Record<string, unknown>).timps).toBeUndefined();
    }
  });
});

describe('codex target (TOML)', () => {
  it('registers via [mcp_servers.timps] and unregisters cleanly', () => {
    const t = target('codex');
    const config: Record<string, unknown> = { _raw: '[mcp_servers.node_repl]\ncommand = "npx"\n\n[other]\nx = 1\n' };
    t.register(reg, config);
    const raw = config._raw as string;
    expect(raw).toContain('[mcp_servers.timps]');
    expect(raw).toContain('command = "npx"');
    expect(raw).toContain('[mcp_servers.node_repl]');
    expect(raw).toContain('[other]');
    t.unregister(config);
    const after = config._raw as string;
    expect(after).not.toContain('mcp_servers.timps');
    expect(after).toContain('[mcp_servers.node_repl]');
    expect(after).toContain('[other]');
  });
});

describe('memory instructions (auto-capture)', () => {
  const dirs: string[] = [];
  function tmpAgent(mdc = false): AgentTarget {
    const dir = mkdtempSync(join(tmpdir(), 'timps-setup-instr-'));
    dirs.push(dir);
    const file = join(dir, mdc ? 'timps.mdc' : 'CLAUDE.md');
    return {
      id: 'test',
      name: 'Test Agent',
      detect: () => true,
      readConfig: () => undefined,
      writeConfig: () => {},
      register: () => {},
      unregister: () => {},
      instructionFile: file,
      instructionMdc: mdc,
    };
  }
  afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

  it('buildInstructionBlock is fenced by the markers and mentions the tools', () => {
    const block = buildInstructionBlock();
    expect(block.startsWith(INSTRUCTION_START)).toBe(true);
    expect(block.endsWith(INSTRUCTION_END)).toBe(true);
    expect(block).toContain('timps_get_memories');
    expect(block).toContain('timps_store_memory');
    expect(block).toContain('timps_check_contradiction');
  });

  it('installs into a plain markdown file, preserving existing content', () => {
    const t = tmpAgent();
    writeFileSync(t.instructionFile!, 'My existing notes\n');
    const status = installInstructions(t);
    expect(status).toBe('installed');
    const out = readFileSync(t.instructionFile!, 'utf8');
    expect(out).toContain('My existing notes');
    expect(out).toContain(INSTRUCTION_START);
    expect(out).toContain(INSTRUCTION_END);
  });

  it('is idempotent — second install returns unchanged', () => {
    const t = tmpAgent();
    expect(installInstructions(t)).toBe('installed');
    expect(installInstructions(t)).toBe('unchanged');
  });

  it('uninstall removes only the block, leaving surrounding content', () => {
    const t = tmpAgent();
    writeFileSync(t.instructionFile!, `Header\n\n${buildInstructionBlock()}\n\nFooter\n`);
    expect(uninstallInstructions(t)).toBe(true);
    const out = readFileSync(t.instructionFile!, 'utf8');
    expect(out).toContain('Header');
    expect(out).toContain('Footer');
    expect(out).not.toContain(INSTRUCTION_START);
    expect(out).not.toContain(INSTRUCTION_END);
  });

  it('uninstall returns false when the block is absent', () => {
    const t = tmpAgent();
    writeFileSync(t.instructionFile!, 'No timps here\n');
    expect(uninstallInstructions(t)).toBe(false);
  });

  it('cursor target writes an .mdc rule with alwaysApply frontmatter', () => {
    const t = tmpAgent(true);
    expect(installInstructions(t)).toBe('installed');
    const out = readFileSync(t.instructionFile!, 'utf8');
    expect(out).toMatch(/^---\n/m);
    expect(out).toContain('alwaysApply: true');
    expect(out).toContain(INSTRUCTION_START);
  });

  it('cursor target uninstall deletes the managed rule file when empty', () => {
    const t = tmpAgent(true);
    installInstructions(t);
    expect(uninstallInstructions(t)).toBe(true);
    expect(existsSync(t.instructionFile!)).toBe(false);
  });

  it('respects dryRun — no file written', () => {
    const t = tmpAgent();
    expect(installInstructions(t, true)).toBe('installed');
    expect(existsSync(t.instructionFile!)).toBe(false);
    expect(installInstructions(t)).toBe('installed');
    expect(uninstallInstructions(t, true)).toBe(true);
    expect(readFileSync(t.instructionFile!, 'utf8')).toContain(INSTRUCTION_START);
  });

  it('skips targets without an instruction file (windsurf)', () => {
    const t = target('windsurf');
    expect(installInstructions(t)).toBe('skipped');
    expect(uninstallInstructions(t)).toBe(false);
  });
});
