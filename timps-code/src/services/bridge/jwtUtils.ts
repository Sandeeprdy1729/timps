// TIMPS Code — JWT Utilities
// JWT token handling and refresh scheduling for bridge sessions

import * as crypto from 'node:crypto';

export interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function decodeJwtExpiry(token: string): number | null {
  const payload = decodeJwtPayload(token);
  return payload?.exp ?? null;
}

export function isJwtExpired(token: string, bufferMs: number = 300000): boolean {
  const expiry = decodeJwtExpiry(token);
  if (!expiry) return false;
  return Date.now() > (expiry * 1000) - bufferMs;
}

export interface TokenRefreshScheduler {
  schedule: (sessionId: string, token: string) => void;
  scheduleFromExpiresIn: (sessionId: string, expiresInSeconds: number) => void;
  cancel: (sessionId: string) => void;
  cancelAll: () => void;
}

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const FALLBACK_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export function createTokenRefreshScheduler({
  getAccessToken,
  onRefresh,
  label,
  refreshBufferMs = TOKEN_REFRESH_BUFFER_MS,
}: {
  getAccessToken: () => string | undefined | Promise<string | undefined>;
  onRefresh: (sessionId: string, oauthToken: string) => void;
  label: string;
  refreshBufferMs?: number;
}): TokenRefreshScheduler {
  const timers = new Map<string, NodeJS.Timeout>();
  const generations = new Map<string, number>();

  function nextGeneration(sessionId: string): number {
    const gen = (generations.get(sessionId) ?? 0) + 1;
    generations.set(sessionId, gen);
    return gen;
  }

  function formatDuration(ms: number): string {
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  function schedule(sessionId: string, token: string): void {
    const expiry = decodeJwtExpiry(token);
    if (!expiry) return;

    const existing = timers.get(sessionId);
    if (existing) clearTimeout(existing);

    const gen = nextGeneration(sessionId);
    const expiryDate = new Date(expiry * 1000).toISOString();
    const delayMs = expiry * 1000 - Date.now() - refreshBufferMs;

    if (delayMs <= 0) {
      void doRefresh(sessionId, gen);
      return;
    }

    console.log(`[${label}:token] Scheduled token refresh for sessionId=${sessionId} in ${formatDuration(delayMs)}`);
    const timer = setTimeout(doRefresh, delayMs, sessionId, gen);
    timers.set(sessionId, timer);
  }

  function scheduleFromExpiresIn(sessionId: string, expiresInSeconds: number): void {
    const existing = timers.get(sessionId);
    if (existing) clearTimeout(existing);
    const gen = nextGeneration(sessionId);
    const delayMs = Math.max(expiresInSeconds * 1000 - refreshBufferMs, 30_000);
    const timer = setTimeout(doRefresh, delayMs, sessionId, gen);
    timers.set(sessionId, timer);
  }

  async function doRefresh(sessionId: string, gen: number): Promise<void> {
    try {
      const oauthToken = await getAccessToken();
      if (!oauthToken) return;

      if (generations.get(sessionId) !== gen) return;

      console.log(`[${label}:token] Refreshing token for sessionId=${sessionId}`);
      onRefresh(sessionId, oauthToken);

      const timer = setTimeout(doRefresh, FALLBACK_REFRESH_INTERVAL_MS, sessionId, gen);
      timers.set(sessionId, timer);
    } catch (err) {
      console.error(`[${label}:token] Refresh failed:`, err);
    }
  }

  function cancel(sessionId: string): void {
    nextGeneration(sessionId);
    const timer = timers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(sessionId);
    }
  }

  function cancelAll(): void {
    for (const sessionId of generations.keys()) {
      nextGeneration(sessionId);
    }
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    generations.clear();
  }

  return { schedule, scheduleFromExpiresIn, cancel, cancelAll };
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function parseWorkSecret(secret: string): WorkSecret | null {
  try {
    const decoded = Buffer.from(secret, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

interface WorkSecret {
  version: number;
  session_ingress_token: string;
  api_base_url: string;
  sources: Array<{ type: string; git_info?: { type: string; repo: string; ref?: string; token?: string } }>;
  auth: Array<{ type: string; token: string }>;
}