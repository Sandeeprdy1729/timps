import { config } from '../config/env';

export interface FetchOptions {
  timeoutMs?: number;
}

export interface RetryOptions extends FetchOptions {
  retries?: number;
  backoffMs?: number;
}

export class RequestTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms: ${url}`);
    this.name = 'RequestTimeoutError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export function resolveTimeoutMs(timeoutMs?: number): number {
  return timeoutMs ?? config.http.timeoutMs;
}

export function resolveRetries(retries?: number): number {
  return retries ?? config.http.retries;
}

export function resolveBackoffMs(backoffMs?: number): number {
  return backoffMs ?? config.http.backoffMs;
}

/**
 * fetch with an AbortController timeout. Aborts the underlying request and
 * throws RequestTimeoutError when the provider/Qdrant/web target hangs.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  options?: FetchOptions
): Promise<Response> {
  const timeoutMs = resolveTimeoutMs(options?.timeoutMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    if (controller.signal.aborted) {
      throw new RequestTimeoutError(url, timeoutMs);
    }
    return response;
  } catch (error: any) {
    if (controller.signal.aborted) {
      throw new RequestTimeoutError(url, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * fetchWithTimeout with retry/backoff on transient failures (network errors,
 * 408/429, 5xx). Bounded by config.http.retries with exponential backoff.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options?: RetryOptions
): Promise<Response> {
  const retries = resolveRetries(options?.retries);
  const backoffMs = resolveBackoffMs(options?.backoffMs);

  let attempt = 0;
  while (true) {
    try {
      const response = await fetchWithTimeout(url, init, options);
      if (!isRetryableStatus(response.status) || attempt >= retries) {
        return response;
      }
      // Consume the body so the connection is reusable before retrying.
      try { await response.text(); } catch { /* ignore */ }
    } catch (error: any) {
      if (error instanceof RequestTimeoutError || attempt >= retries) {
        throw error;
      }
    }

    attempt++;
    await sleep(backoffMs * Math.pow(2, attempt - 1));
  }
}
