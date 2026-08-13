// @timps/server — M80 regression tests
// Verifies web_search is no longer bound to a single hardcoded proxy:
// providers are configurable via WEB_SEARCH_PROVIDERS, they fall back through
// the chain when one is down, and every-provider-failure surfaces a clear
// error instead of a silent empty result.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dns from 'node:dns/promises';

// config/env.ts does `import 'dotenv/config'`. Stub it so tests use process.env only.
vi.mock('dotenv/config', () => ({}));

// SSRF guard resolves hostnames via DNS — control resolution deterministically.
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

// Re-evaluate the tool module per test so env changes take effect.
vi.resetModules();

async function freshTool() {
  const mod = await import('../tools/webSearchTool');
  return new mod.WebSearchTool();
}

async function freshFetchTool() {
  const mod = await import('../tools/webSearchTool');
  return new mod.WebFetchTool();
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function okHtml(body: string): Response {
  return new Response(body, { status: 200 });
}

describe('web_search provider chain (M80)', () => {
  const originalProviders = process.env.WEB_SEARCH_PROVIDERS;
  const originalRetries = process.env.HTTP_RETRIES;

  beforeEach(() => {
    // One attempt per provider so mocked fetch queues behave deterministically.
    process.env.HTTP_RETRIES = '0';
    process.env.HTTP_BACKOFF_MS = '1';
  });

  afterEach(() => {
    delete process.env.WEB_SEARCH_PROVIDERS;
    delete process.env.WEB_SEARCH_URL;
    delete process.env.WEB_SEARCH_API_KEY;
    delete process.env.HTTP_RETRIES;
    delete process.env.HTTP_BACKOFF_MS;
    vi.unstubAllGlobals();
    if (originalProviders !== undefined) {
      process.env.WEB_SEARCH_PROVIDERS = originalProviders;
    }
    if (originalRetries !== undefined) {
      process.env.HTTP_RETRIES = originalRetries;
    }
  });

  it('returns ddg-api results by default when the proxy is healthy', async () => {
    const fake = vi.fn(async () =>
      okJson([{ title: 'Result One', url: 'https://example.com/1', snippet: 'first' }])
    );
    vi.stubGlobal('fetch', fake);
    const tool = await freshTool();
    const out = await tool.execute({ query: 'test query', num_results: '5' });
    const results = JSON.parse(out);
    expect(results[0].title).toBe('Result One');
    expect(fake.mock.calls[0][0]).toContain('ddg-api.vercel.app/search');
  });

  it('falls back to the official DuckDuckGo API when ddg-api is down', async () => {
    // First call (ddg-api) fails hard; second (duckduckgo) succeeds.
    const fake = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        okJson({
          RelatedTopics: [
            { Text: 'Sample topic - detail', FirstURL: 'https://duckduckgo.com/?q=1' },
          ],
        })
      );
    vi.stubGlobal('fetch', fake);
    const tool = await freshTool();
    const out = await tool.execute({ query: 'fallback query' });
    const results = JSON.parse(out);
    expect(results[0].url).toContain('duckduckgo.com');
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it('falls through when the first provider returns a 5xx', async () => {
    const fake = vi.fn()
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(
        okJson({ RelatedTopics: [{ Text: 'Recovered - ok', FirstURL: 'https://example.com' }] })
      );
    vi.stubGlobal('fetch', fake);
    const tool = await freshTool();
    const out = await tool.execute({ query: 'rate limited' });
    const results = JSON.parse(out);
    expect(results[0].title).toBe('Recovered');
  });

  it('surfaces a clear error when every provider fails (no silent empty)', async () => {
    const fake = vi.fn(async () => new Response('down', { status: 500 }));
    vi.stubGlobal('fetch', fake);
    const tool = await freshTool();
    const out = await tool.execute({ query: 'total outage' });
    expect(out).toContain('Search error: all search providers failed');
    expect(out).toContain('ddg-api');
    expect(out).toContain('duckduckgo');
  });

  it('uses a configured custom provider', async () => {
    process.env.WEB_SEARCH_PROVIDERS = 'custom';
    process.env.WEB_SEARCH_URL = 'https://search.example.test/query';
    process.env.WEB_SEARCH_API_KEY = 'secret-key';
    const fake = vi.fn(async () =>
      okJson({ results: [{ title: 'Custom hit', url: 'https://custom.example', snippet: 's' }] })
    );
    vi.stubGlobal('fetch', fake);
    const tool = await freshTool();
    const out = await tool.execute({ query: 'custom search' });
    const results = JSON.parse(out);
    expect(results[0].title).toBe('Custom hit');
    // Authorization header is sent with the custom endpoint.
    expect(fake.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-key');
  });

  it('reports an invalid provider configuration instead of crashing', async () => {
    process.env.WEB_SEARCH_PROVIDERS = 'not-a-real-provider';
    const tool = await freshTool();
    const out = await tool.execute({ query: 'anything' });
    expect(out).toContain('no valid providers');
    expect(out).toContain('Valid options:');
  });

  it('flattens nested DuckDuckGo category topics', async () => {
    process.env.WEB_SEARCH_PROVIDERS = 'duckduckgo';
    const fake = vi.fn(async () =>
      okJson({
        RelatedTopics: [
          {
            Topics: [
              { Text: 'Nested one - a', FirstURL: 'https://example.com/n1' },
              { Text: 'Nested two - b', FirstURL: 'https://example.com/n2' },
            ],
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fake);
    const tool = await freshTool();
    const out = await tool.execute({ query: 'nested' });
    const results = JSON.parse(out);
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://example.com/n1');
  });
});

describe('web_fetch SSRF guard (M81)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // resetAllMocks (not clearAllMocks) so mockResolvedValue/Once queues from
    // prior tests never leak into the next test.
    vi.resetAllMocks();
  });

  const publicIpv4 = [{ address: '93.184.216.34', family: 4 as const }];

  it('blocks a decimal IP literal resolving to loopback', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    const tool = await freshFetchTool();
    const out = await tool.execute({ url: 'http://2130706433/latest/meta-data/' });
    expect(out).toContain('Access denied');
    expect(fake).not.toHaveBeenCalled();
  });

  it('blocks an IPv6 loopback literal', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '::1', family: 6 }]);
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    const tool = await freshFetchTool();
    const out = await tool.execute({ url: 'http://[::1]/admin' });
    expect(out).toContain('Access denied');
    expect(fake).not.toHaveBeenCalled();
  });

  it('blocks an attacker-controlled domain resolving to a metadata IP', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    const tool = await freshFetchTool();
    const out = await tool.execute({ url: 'http://evil.example/latest/meta-data/' });
    expect(out).toContain('Access denied');
    expect(fake).not.toHaveBeenCalled();
  });

  it('blocks a private RFC1918 address', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    const tool = await freshFetchTool();
    const out = await tool.execute({ url: 'http://internal.example/' });
    expect(out).toContain('Access denied');
  });

  it('blocks a hardcoded metadata hostname before any DNS call', async () => {
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    const tool = await freshFetchTool();
    const out = await tool.execute({ url: 'http://169.254.169.254/latest/meta-data/' });
    expect(out).toContain('Access denied');
    expect(dns.lookup).not.toHaveBeenCalled();
  });

  it('allows a public site and returns its content', async () => {
    vi.mocked(dns.lookup).mockResolvedValue(publicIpv4);
    const fake = vi.fn(async () => new Response('<html>Hello world</html>', { status: 200 }));
    vi.stubGlobal('fetch', fake);
    const tool = await freshFetchTool();
    const out = await tool.execute({ url: 'http://example.com/' });
    expect(out).toContain('Hello world');
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it('blocks a redirect from a public site to a loopback address', async () => {
    vi.mocked(dns.lookup)
      .mockResolvedValueOnce([{ address: '1.2.3.4', family: 4 }])   // attacker.com (public)
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]); // redirect target
    const fake = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } })
    );
    vi.stubGlobal('fetch', fake);
    const tool = await freshFetchTool();
    const out = await tool.execute({ url: 'http://attacker.com/start' });
    expect(out).toContain('Access denied');
    // The external hop happened, the internal one must not.
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it('follows an external-to-external redirect and returns the final content', async () => {
    vi.mocked(dns.lookup).mockResolvedValue(publicIpv4);
    const fake = vi.fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: 'http://example.com/page' } })
      )
      .mockResolvedValueOnce(new Response('Landed on page', { status: 200 }));
    vi.stubGlobal('fetch', fake);
    const tool = await freshFetchTool();
    const out = await tool.execute({ url: 'http://example.com/start' });
    expect(out).toContain('Landed on page');
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it('rejects non-http(s) schemes', async () => {
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    const tool = await freshFetchTool();
    const out = await tool.execute({ url: 'file:///etc/passwd' });
    expect(out).toContain('Access denied');
    expect(fake).not.toHaveBeenCalled();
  });

  it('denies an unresolvable hostname (fail-closed)', async () => {
    vi.mocked(dns.lookup).mockRejectedValue(new Error('ENOTFOUND'));
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    const tool = await freshFetchTool();
    const out = await tool.execute({ url: 'http://does-not-exist.invalid/' });
    expect(out).toContain('Access denied');
    expect(fake).not.toHaveBeenCalled();
  });
});
