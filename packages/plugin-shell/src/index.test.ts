// @timps-plugin/shell — M69 security + portability tests
// Proves shell_which is a pure-Node PATH lookup (no `which` binary, no shell),
// so crafted command strings are never executed and the tool works on Windows.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { exec, execSync } from 'child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { scanForPermissions, assertDeclaredPermissions } from '@timps-ai/plugin-sdk';
import plugin from './index.js';

vi.mock('child_process', () => {
  return {
    exec: vi.fn((cmd: unknown, opts: unknown, cb?: unknown) => {
      const done = typeof opts === 'function' ? (opts as (e: null, r: { stdout: string; stderr: string }) => void) : (cb as (e: null, r: { stdout: string; stderr: string }) => void);
      done?.(null, { stdout: 'mocked-out', stderr: '' });
      return {} as never;
    }),
    execSync: vi.fn(() => 'mocked-which'),
  };
});

const execMock = vi.mocked(exec);
const execSyncMock = vi.mocked(execSync);

afterEach(() => {
  execMock.mockClear();
  execSyncMock.mockClear();
});

async function call(tool: string, params: Record<string, unknown>) {
  const handler = plugin.tools?.[tool];
  if (!handler) throw new Error(`no such tool: ${tool}`);
  return handler(params, {} as never);
}

function makeExecutable(): string {
  const dir = mkdtempSync(join(tmpdir(), 'timps-which-test-'));
  const file = join(dir, 'timps_probe');
  writeFileSync(file, '#!/bin/sh\necho probe\n');
  chmodSync(file, 0o755);
  return { dir, file } as never;
}

describe('M69 — shell_which is a pure-Node PATH lookup', () => {
  it('finds an executable on PATH without shelling out', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'timps-which-test-'));
    const file = join(dir, 'timps_probe');
    writeFileSync(file, '#!/bin/sh\necho probe\n');
    chmodSync(file, 0o755);
    const oldPath = process.env.PATH;
    process.env.PATH = `${dir}${delimiter}${oldPath ?? ''}`;
    try {
      const res = await call('shell_which', { command: 'timps_probe' });
      expect(res.error).toBeUndefined();
      expect(res.output).toContain('found at');
      expect(res.output).toContain(file);
      expect(execMock).not.toHaveBeenCalled();
      expect(execSyncMock).not.toHaveBeenCalled();
    } finally {
      process.env.PATH = oldPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('treats crafted injection strings as literal filenames (never executes)', async () => {
    const marker = join(tmpdir(), `timps-pwn-${Date.now()}`);
    const res = await call('shell_which', { command: `x; touch ${marker}` });
    expect(res.error).toContain('not found in PATH');
    // The crafted command must NOT have been executed by a shell.
    const { existsSync } = await import('node:fs');
    expect(existsSync(marker)).toBe(false);
    expect(execMock).not.toHaveBeenCalled();
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it('returns not-found for an unknown command', async () => {
    const res = await call('shell_which', { command: 'no_such_timps_binary_xyz' });
    expect(res.error).toContain('not found in PATH');
  });

  it('rejects empty command names', async () => {
    const res = await call('shell_which', { command: '' });
    expect(res.error).toContain('Invalid command name');
  });

  it('rejects whitespace-only command names', async () => {
    const res = await call('shell_which', { command: '   ' });
    expect(res.error).toContain('Invalid command name');
  });
});

describe('M69 — manifest no longer overstates capability', () => {
  it('does not advertise pipe output / background jobs', () => {
    const desc = `${plugin.manifest.description}`.toLowerCase();
    expect(desc).not.toContain('pipe');
    expect(desc).not.toContain('background');
  });

  it('advertises only the tools that exist', () => {
    const names = plugin.manifest.tools?.map((t) => t.name).sort();
    expect(names).toEqual(['shell_env', 'shell_run', 'shell_which']);
  });
});

describe('M69 — declared permissions match actual source usage', () => {
  it('passes the M68 fail-closed permission scanner', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf-8');
    const scan = scanForPermissions(source);
    expect(scan.unverifiable).toBe(false);
    expect([...scan.required].sort()).toEqual(['env:read', 'fs:read', 'process:spawn']);
    const declared = plugin.manifest.timps?.permissions ?? [];
    for (const p of scan.required) expect(declared).toContain(p);
  });

  it('is loadable by the SDK loader (assertDeclaredPermissions does not throw)', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf-8');
    expect(() => assertDeclaredPermissions(plugin, source)).not.toThrow();
  });
});

describe('M69 — shell_run / shell_env still work', () => {
  it('shell_env filters by prefix and redacts secrets', async () => {
    process.env.TIMPS_TEST_VAR = 'hello';
    process.env.TIMPS_TEST_API_KEY = 'shh';
    try {
      const res = await call('shell_env', { prefix: 'TIMPS' });
      expect(res.output).toContain('TIMPS_TEST_VAR=hello');
      expect(res.output).not.toContain('TIMPS_TEST_API_KEY');
    } finally {
      delete process.env.TIMPS_TEST_VAR;
      delete process.env.TIMPS_TEST_API_KEY;
    }
  });

  it('shell_run routes through child_process exec (by design)', async () => {
    const res = await call('shell_run', { command: 'echo hi', timeout_ms: 5000 });
    expect(execMock).toHaveBeenCalled();
    expect(res.output).toBe('mocked-out');
  });
});
