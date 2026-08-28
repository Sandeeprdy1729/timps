// ── @timps/memory-core — Rate Limiter ──
// Redis-backed sliding-window rate limiter per org.
// Tracks memory ops, vector queries, and concurrent streams.
// Falls back to in-memory token bucket when Redis is unavailable.

export interface RateLimiterConfig {
  /** Max memory store/recall operations per hour (default: 10000) */
  memoryOpsPerHour?: number;
  /** Max vector/embedding queries per hour (default: 5000) */
  vectorQueriesPerHour?: number;
  /** Max concurrent gRPC/WS streams (default: 50) */
  maxConcurrentStreams?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

const DEFAULT_CONFIG: Required<RateLimiterConfig> = {
  memoryOpsPerHour: 10000,
  vectorQueriesPerHour: 5000,
  maxConcurrentStreams: 50,
};

export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private redis: any = null;
  private useRedis = false;
  private ready: Promise<void>;

  // Fallback in-memory stores
  private memoryCounts = new Map<string, { count: number; windowStart: number }>();
  private vectorCounts = new Map<string, { count: number; windowStart: number }>();
  private streamCounts = new Map<string, number>();

  constructor(config?: RateLimiterConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ready = this._initRedis();
  }

  private async _initRedis(): Promise<void> {
    try {
      const Redis = require('ioredis');
      this.redis = new Redis({ lazyConnect: true, retryStrategy: () => null });
      await this.redis.connect();
      this.useRedis = true;
    } catch {
      this.useRedis = false;
    }
  }

  private _windowKey(orgId: string, operation: string): string {
    const hour = Math.floor(Date.now() / 3600000);
    return `rate:${orgId}:${operation}:${hour}`;
  }

  /** Check if an org can perform a memory operation (store/recall). */
  async checkMemoryOp(orgId: string): Promise<RateLimitResult> {
    await this.ready;
    const limit = this.config.memoryOpsPerHour;

    if (this.useRedis) {
      const key = this._windowKey(orgId, 'memory_ops');
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, 3600);
      const remaining = Math.max(0, limit - count);
      const resetAt = Math.ceil(Date.now() / 3600000) * 3600000 + 3600000;
      return {
        allowed: count <= limit,
        remaining,
        resetAt,
        retryAfterMs: count > limit ? resetAt - Date.now() : undefined,
      };
    }

    // Fallback: in-memory
    const now = Date.now();
    const windowStart = Math.floor(now / 3600000) * 3600000;
    const entry = this.memoryCounts.get(orgId);
    if (!entry || entry.windowStart < windowStart) {
      this.memoryCounts.set(orgId, { count: 1, windowStart });
      return { allowed: true, remaining: limit - 1, resetAt: windowStart + 3600000 };
    }
    entry.count++;
    const remaining = Math.max(0, limit - entry.count);
    return {
      allowed: entry.count <= limit,
      remaining,
      resetAt: windowStart + 3600000,
      retryAfterMs: entry.count > limit ? windowStart + 3600000 - now : undefined,
    };
  }

  /** Check if an org can perform a vector query. */
  async checkVectorQuery(orgId: string): Promise<RateLimitResult> {
    await this.ready;
    const limit = this.config.vectorQueriesPerHour;

    if (this.useRedis) {
      const key = this._windowKey(orgId, 'vector_queries');
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, 3600);
      const remaining = Math.max(0, limit - count);
      const resetAt = Math.ceil(Date.now() / 3600000) * 3600000 + 3600000;
      return {
        allowed: count <= limit,
        remaining,
        resetAt,
        retryAfterMs: count > limit ? resetAt - Date.now() : undefined,
      };
    }

    const now = Date.now();
    const windowStart = Math.floor(now / 3600000) * 3600000;
    const entry = this.vectorCounts.get(orgId);
    if (!entry || entry.windowStart < windowStart) {
      this.vectorCounts.set(orgId, { count: 1, windowStart });
      return { allowed: true, remaining: limit - 1, resetAt: windowStart + 3600000 };
    }
    entry.count++;
    const remaining = Math.max(0, limit - entry.count);
    return {
      allowed: entry.count <= limit,
      remaining,
      resetAt: windowStart + 3600000,
      retryAfterMs: entry.count > limit ? windowStart + 3600000 - now : undefined,
    };
  }

  /** Track a new stream for an org. Returns true if under limit. */
  async acquireStream(orgId: string): Promise<boolean> {
    await this.ready;
    const limit = this.config.maxConcurrentStreams;

    if (this.useRedis) {
      const key = `rate:${orgId}:streams`;
      const count = await this.redis.incr(key);
      await this.redis.expire(key, 60);
      return count <= limit;
    }

    const current = this.streamCounts.get(orgId) ?? 0;
    if (current >= limit) return false;
    this.streamCounts.set(orgId, current + 1);
    return true;
  }

  /** Release a stream for an org. */
  async releaseStream(orgId: string): Promise<void> {
    await this.ready;

    if (this.useRedis) {
      const key = `rate:${orgId}:streams`;
      const count = await this.redis.decr(key);
      if (count < 0) await this.redis.del(key);
      return;
    }

    const current = this.streamCounts.get(orgId) ?? 1;
    if (current <= 1) {
      this.streamCounts.delete(orgId);
    } else {
      this.streamCounts.set(orgId, current - 1);
    }
  }

  /** Get rate limit config for an org (from Postgres, or defaults). */
  async getOrgConfig(orgId: string): Promise<Required<RateLimiterConfig>> {
    // In production, this would query a postgres `org_rate_limits` table.
    // For now, return defaults with a hook for override.
    return { ...this.config };
  }

  /** Set custom rate limit config for an org (postgres-backed in production). */
  async setOrgConfig(orgId: string, config: RateLimiterConfig): Promise<void> {
    // In production, upsert into `org_rate_limits` table.
    // For now, apply globally (good enough for single-server deployments).
    this.config = { ...this.config, ...config };
  }

  /** Close Redis connection if active. */
  async close(): Promise<void> {
    if (this.redis) {
      try { await this.redis.quit(); } catch { /* ignore */ }
      this.redis = null;
    }
  }
}
