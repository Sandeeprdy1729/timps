import { describe, expect, it } from 'vitest';
import {
  buildRegistration,
  targets,
  tomlString,
  upsertTomlSection,
  type McpRegistration,
} from './setup.js';

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
