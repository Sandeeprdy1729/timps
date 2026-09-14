import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempRoot = '';

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'timps-gmail-'));
  process.env.TIMPS_GMAIL_DIR = join(tempRoot, 'gmail');
  vi.resetModules();
});

afterEach(() => {
  delete process.env.TIMPS_GMAIL_DIR;
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
});

describe('decodeBase64Url', () => {
  it('decodes url-safe base64', async () => {
    const { decodeBase64Url } = await import('./client.js');
    const body = 'Hello Tïmps — email body';
    const encoded = Buffer.from(body, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeBase64Url(encoded)).toBe(body);
  });

  it('strips HTML tags but preserves breaks', async () => {
    const { decodeBase64Url } = await import('./client.js');
    const html = '<div><p>Deadline is <b>Friday</b>.</p><br/>Please respond.</div>';
    const encoded = Buffer.from(html, 'utf-8').toString('base64');
    const decoded = decodeBase64Url(encoded);
    const normalized = decoded.replace(/\s+/g, ' ').trim();
    expect(normalized).toContain('Friday');
    expect(normalized).toContain('Please respond.');
    expect(decoded).not.toContain('<');
  });
});

describe('decodePayloadBody', () => {
  it('collects text from nested parts', async () => {
    const { decodePayloadBody } = await import('./client.js');
    const enc = (s: string) => Buffer.from(s, 'utf-8').toString('base64');
    const payload = {
      body: {},
      parts: [
        { mimeType: 'text/plain', body: { data: enc('Part one.') } },
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: enc('Nested plain.') } },
            { mimeType: 'text/html', body: { data: enc('<p>Nested html.</p>') } },
          ],
        },
      ],
    };
    const out = decodePayloadBody(payload);
    expect(out).toContain('Part one.');
    expect(out).toContain('Nested plain.');
    expect(out).toContain('Nested html.');
  });
});

describe('extractEmail', () => {
  it('parses headers and body', async () => {
    const { extractEmail } = await import('./client.js');
    const enc = (s: string) => Buffer.from(s, 'utf-8').toString('base64');
    const message = {
      id: 'abc123',
      threadId: 'thread-1',
      labelIds: ['INBOX', 'IMPORTANT'],
      snippet: 'Quick update on the project',
      internalDate: '1720000000000',
      payload: {
        headers: [
          { name: 'From', value: 'Alice <alice@example.com>' },
          { name: 'Subject', value: 'Project update' },
          { name: 'Date', value: 'Tue, 1 Jan 2026' },
        ],
        body: { data: enc('The project ships on Friday.') },
      },
    };
    const email = extractEmail(message);
    expect(email.id).toBe('abc123');
    expect(email.from).toBe('Alice <alice@example.com>');
    expect(email.subject).toBe('Project update');
    expect(email.bodyText).toContain('The project ships on Friday.');
    expect(email.labels).toContain('INBOX');
  });
});

describe('buildInboxQuery', () => {
  it('uses the whole inbox on first run', async () => {
    const { buildInboxQuery } = await import('./sync.js');
    expect(buildInboxQuery({ lastRun: null, lastMessageId: null, messagesSynced: 0 }, 1)).toBe('in:inbox');
  });

  it('uses newer_than when an explicit lookback is given on the first run', async () => {
    const { buildInboxQuery } = await import('./sync.js');
    expect(buildInboxQuery({ lastRun: null, lastMessageId: null, messagesSynced: 0 }, 7)).toBe('in:inbox newer_than:7d');
  });

  it('uses after: epoch once a run is recorded', async () => {
    const { buildInboxQuery } = await import('./sync.js');
    const state = { lastRun: '2026-09-01T00:00:00.000Z', lastMessageId: null, messagesSynced: 5 };
    expect(buildInboxQuery(state, 1)).toBe(
      `in:inbox after:${Math.floor(new Date('2026-09-01T00:00:00.000Z').getTime() / 1000) - 6 * 3600}`,
    );
  });
});

describe('heuristicFacts', () => {
  it('produces facts from body sentences without an LLM', async () => {
    const { heuristicFacts } = await import('./summarize.js');
    const email = {
      from: 'Bob <bob@x.dev>',
      subject: 'Rate limit notice',
      bodyText: 'Our API hit the 1,000 req/min limit today at noon. We raised it to 5,000. Please update your retry policy.',
    };
    const facts = heuristicFacts(email);
    expect(facts[0]).toContain('Rate limit notice');
    expect(facts.some((f) => f.includes('1,000 req/min'))).toBe(true);
  });
});

describe('storage roundtrip (scoped dir)', () => {
  it('saves and reloads tokens and state', async () => {
    const mod = await import('./storage.js');
    mod.saveTokens({ accessToken: 'at', refreshToken: 'rt', expiresAt: 999 });
    const tokens = mod.loadTokens();
    expect(tokens?.accessToken).toBe('at');
    expect(tokens?.refreshToken).toBe('rt');

    mod.saveState({ lastRun: '2026-09-01T00:00:00.000Z', lastMessageId: 'x', messagesSynced: 3 });
    const state = mod.loadState();
    expect(state.messagesSynced).toBe(3);
    expect(state.lastMessageId).toBe('x');
  });

  it('creates the raw folder lazily', async () => {
    const mod = await import('./storage.js');
    mod.ensureGmailDirs();
    expect(existsSync(join(process.env.TIMPS_GMAIL_DIR!, 'raw'))).toBe(true);
  });

  it('persists client credentials from a Google downloads-style file', async () => {
    const mod = await import('./storage.js');
    const { persistClientCredsFromGoogleJson } = await import('./oauth.js');
    const fake = join(tempRoot, 'credentials.json');
    writeFileSync(
      fake,
      JSON.stringify({
        installed: { client_id: 'c-123', client_secret: 's-456', token_uri: 'https://oauth2.googleapis.com/token' },
      }),
    );
    persistClientCredsFromGoogleJson(fake);
    const saved = JSON.parse(readFileSync(mod.gmailClientFile(), 'utf-8'));
    expect(saved.client_id).toBe('c-123');
    expect(saved.client_secret).toBe('s-456');
  });
});