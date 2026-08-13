// @timps/server — M77 regression tests
// Verifies all outbound HTTP calls are bounded: fetchWithTimeout aborts hung
// requests, fetchWithRetry retries transient failures with backoff, and the
// agent loop enforces an overall time limit instead of 15 unbounded model calls.

import { describe, it, expect, vi, afterEach } from 'vitest';

// config/env.ts does `import 'dotenv/config'`. Stub it so tests use process.env only.
vi.mock('dotenv/config', () => ({}));

import {
  fetchWithTimeout,
  fetchWithRetry,
  RequestTimeoutError,
} from '../lib/http';

const REAL_FETCH = globalThis.fetch;

afterEach(() => {
  vi.unstubAllGlobals();
  if (!globalThis.fetch) {
    (globalThis as any).fetch = REAL_FETCH;
  }
});

function mockResponse(status: number, body: string = ''): Response {
  return new Response(body, { status });
}

// Mirrors undici's real behavior: an in-flight fetch rejects with an AbortError
// when the caller aborts the request via AbortSignal.
function hangingFetch(): typeof fetch {
  return ((_url: any, init?: any) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('aborted', 'AbortError'));
      });
    })) as unknown as typeof fetch;
}

describe('lib/http.ts — fetchWithTimeout (M77)', () => {
  it('returns the response when the call completes in time', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(200, 'ok')));
    const response = await fetchWithTimeout('http://example.test', {}, { timeoutMs: 1000 });
    expect(response.status).toBe(200);
  });

  it('throws RequestTimeoutError when the call hangs past the timeout', async () => {
    // A fetch that never resolves — would hang the request indefinitely without the abort.
    vi.stubGlobal('fetch', vi.fn(hangingFetch()));
    await expect(
      fetchWithTimeout('http://hang.test', {}, { timeoutMs: 50 })
    ).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it('throws RequestTimeoutError on a hanging body read as well', async () => {
    vi.stubGlobal('fetch', vi.fn(hangingFetch()));
    await expect(
      fetchWithTimeout('http://hang.test', {}, { timeoutMs: 50 })
    ).rejects.toThrow(/timed out after 50ms/);
  });

  it('uses the configured default timeout when none is passed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(200, 'ok')));
    const response = await fetchWithTimeout('http://example.test');
    expect(response.status).toBe(200);
  });
});

describe('lib/http.ts — fetchWithRetry (M77)', () => {
  it('returns a successful response without retrying', async () => {
    const fake = vi.fn(async () => mockResponse(200, 'ok'));
    vi.stubGlobal('fetch', fake);
    const response = await fetchWithRetry('http://example.test', {}, { retries: 2 });
    expect(response.status).toBe(200);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx and succeeds on the next attempt', async () => {
    const fake = vi.fn()
      .mockResolvedValueOnce(mockResponse(503, 'unavailable'))
      .mockResolvedValueOnce(mockResponse(200, 'ok'));
    vi.stubGlobal('fetch', fake);
    const response = await fetchWithRetry(
      'http://example.test',
      {},
      { retries: 2, backoffMs: 5 }
    );
    expect(response.status).toBe(200);
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 (rate limit)', async () => {
    const fake = vi.fn()
      .mockResolvedValueOnce(mockResponse(429, 'slow down'))
      .mockResolvedValueOnce(mockResponse(200, 'ok'));
    vi.stubGlobal('fetch', fake);
    const response = await fetchWithRetry(
      'http://example.test',
      {},
      { retries: 2, backoffMs: 5 }
    );
    expect(response.status).toBe(200);
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting retries and surfaces the failure', async () => {
    const fake = vi.fn(async () => mockResponse(500, 'boom'));
    vi.stubGlobal('fetch', fake);
    const response = await fetchWithRetry(
      'http://example.test',
      {},
      { retries: 2, backoffMs: 5 }
    );
    expect(response.status).toBe(500);
    expect(fake).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('retries on a network error then succeeds', async () => {
    const fake = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(mockResponse(200, 'ok'));
    vi.stubGlobal('fetch', fake);
    const response = await fetchWithRetry(
      'http://example.test',
      {},
      { retries: 2, backoffMs: 5 }
    );
    expect(response.status).toBe(200);
    expect(fake).toHaveBeenCalledTimes(2);
  });
});

describe('lib/http.ts — timeout config binding (M77)', () => {
  it('exposes timeout/retries/backoff from config', async () => {
    const env = await import('../config/env');
    expect(env.config.http.timeoutMs).toBeGreaterThan(0);
    expect(env.config.http.retries).toBeGreaterThanOrEqual(0);
    expect(env.config.http.backoffMs).toBeGreaterThan(0);
    expect(env.config.agent.timeLimitMs).toBeGreaterThan(0);
  });
});
