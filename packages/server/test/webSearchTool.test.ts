// @timps/server — M80 regression tests
// Verifies web_search is no longer bound to a single hardcoded proxy:
// providers are configurable via WEB_SEARCH_PROVIDERS, they fall back through
// the chain when one is down, and every-provider-failure surfaces a clear
// error instead of a silent empty result.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// config/env.ts does `import 'dotenv/config'`. Stub it so tests use process.env only.
vi.mock('dotenv/config', () => ({}));

// Re-evaluate the tool module per test so env changes take effect.
vi.resetModules();

async function freshTool() {
  const mod = await import('../tools/webSearchTool');
  return new mod.WebSearchTool();
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
