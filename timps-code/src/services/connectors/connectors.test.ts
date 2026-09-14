import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempRoot = '';

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'timps-connectors-'));
  vi.resetModules();
  vi.unstubAllGlobals();
});

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
});

function vaultDir(id: string): string {
  return join(tempRoot, id);
}

describe('registry', () => {
  it('has the 7 non-gmail connector definitions', async () => {
    const { CONNECTORS } = await import('./registry.js');
    const ids = CONNECTORS.map((c) => c.id).sort();
    expect(ids).toEqual(['calendar', 'drive', 'github', 'linear', 'ms365', 'notion', 'slack']);
    expect(CONNECTORS.every((c) => c.tokenUri && c.maxItems > 0)).toBe(true);
  });

  it('looks up a connector by id', async () => {
    const { connectorDef } = await import('./registry.js');
    expect(connectorDef('github')?.refreshable).toBe(true);
    expect(connectorDef('notion')?.refreshable).toBe(false);
    expect(connectorDef('nope')).toBeNull();
  });
});

describe('token storage', () => {
  it('round-trips tokens, state and client json under a scoped dir', async () => {
    process.env[`TIMPS_${'github'.toUpperCase()}_DIR`] = vaultDir('github');
    const tok = await import('./tokens.js');
    tok.saveTokens('github', { accessToken: 'at1', refreshToken: 'rt1', expiresAt: Date.now() + 1000 });
    expect(tok.loadTokens('github')?.accessToken).toBe('at1');
    tok.saveState('github', { lastRun: '2026-09-01T00:00:00.000Z', syncedCount: 3 });
    expect(tok.loadState('github').syncedCount).toBe(3);

    const fsys = await import('node:fs');
    fsys.writeFileSync(tok.clientFile('github'), JSON.stringify({ installed: { client_id: 'c', client_secret: 's' } }));
    expect(tok.loadClient('github')).toEqual({ client_id: 'c', client_secret: 's' });
    expect(existsSync(join(vaultDir('github'), 'raw'))).toBe(true);
  });

  it('disconnect removes tokens/state and reports whether it had any', async () => {
    process.env.TIMPS_SLACK_DIR = vaultDir('slack');
    const { saveTokens, disconnectConnector } = await import('./tokens.js');
    saveTokens('slack', { accessToken: 'a', expiresAt: 1 });
    expect(disconnectConnector('slack')).toBe(true);
    expect(disconnectConnector('slack')).toBe(false);
  });

  it('ensureAccessToken returns a fresh token without contacting the network', async () => {
    process.env.TIMPS_MS365_DIR = vaultDir('ms365');
    const { saveTokens, ensureAccessToken } = await import('./tokens.js');
    saveTokens('ms365', { accessToken: 'fresh-token', expiresAt: Date.now() + 3600_000 });
    expect(await ensureAccessToken('ms365')).toBe('fresh-token');
  });

  it('ensureAccessToken throws a friendly error when not connected', async () => {
    process.env.TIMPS_CALENDAR_DIR = vaultDir('calendar');
    const { ensureAccessToken } = await import('./tokens.js');
    await expect(ensureAccessToken('calendar')).rejects.toThrow(/not connected/i);
  });
});

describe('itemFact distilled shapes', () => {
  it('builds github PR/issue facts with repo + number tags', async () => {
    const { itemFact } = await import('./sync.js');
    const { fact, tags } = itemFact('github', {
      id: 'gh-1',
      title: 'Fix flaky test',
      body: '',
      when: null,
      who: 'alice',
      url: null,
      meta: { kind: 'pull_request', state: 'open', number: '42', repo: 'acme/tool' },
    });
    expect(fact).toBe('acme/tool PR #42 [open]: Fix flaky test');
    expect(tags).toEqual(expect.arrayContaining(['github', 'connector', 'repo:acme/tool']));
  });

  it('builds calendar + slack facts', async () => {
    const { itemFact } = await import('./sync.js');
    const cal = itemFact('calendar', {
      id: 'e1',
      title: 'Design review',
      body: '',
      when: '2026-09-10T10:00:00.000Z',
      who: 'a@x.com, b@x.com',
      url: null,
      meta: {},
    });
    expect(cal.fact).toContain('Design review');
    expect(cal.tags).toContain('calendar');
    expect(cal.fact).toContain('a@x.com');

    const slack = itemFact('slack', {
      id: 'm1',
      title: 'Ship it Friday',
      body: 'Ship it Friday',
      when: null,
      who: 'u1',
      url: null,
      meta: { channel: 'team-build' },
    });
    expect(slack.fact).toBe('Slack (team-build): Ship it Friday');
  });
});

describe('runConnectorSync end-to-end (mocked fetch)', () => {
  it('stores raw items + summaries + state and skips duplicates on re-run', async () => {
    process.env.TIMPS_GITHUB_DIR = vaultDir('github');

    const { saveTokens } = await import('./tokens.js');
    saveTokens('github', { accessToken: 'gh-token', expiresAt: Date.now() + 3600_000 });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).startsWith('https://api.github.com/user/issues')) {
          return new Response(
            JSON.stringify([
              {
                id: 101,
                number: 42,
                title: 'Fix the flaky connector test',
                state: 'open',
                user: { login: 'alice' },
                html_url: 'https://github.com/acme/tool/issues/42',
                updated_at: '2026-09-10T00:00:00Z',
                repository_url: 'https://api.github.com/repos/acme/tool',
              },
            ]),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    // storeMemory:false keeps the canonical ~/.timps store untouched in tests.
    const { runConnectorSync } = await import('./sync.js');
    const result = await runConnectorSync('github', { storeMemory: false });
    expect(result.fetched).toBe(1);
    expect(result.stored).toBe(1);
    expect(result.skippedExisting).toBe(0);
    expect(result.factsStored).toBe(0);

    const { summariesFile, loadState } = await import('./tokens.js');
    const summaries = readFileSync(summariesFile('github'), 'utf-8');
    expect(summaries).toContain('Fix the flaky connector test');
    expect(summaries).toContain('acme/tool');
    expect(loadState('github').syncedCount).toBe(1);
    expect(loadState('github').lastRun).toBeTruthy();

    const second = await runConnectorSync('github', { storeMemory: false });
    expect(second.stored).toBe(0);
    expect(second.skippedExisting).toBe(1);
  });
});