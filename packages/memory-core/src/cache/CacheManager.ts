// ── @timps/memory-core — CacheManager ──
// Redis-backed cache layer for forge state, with TTL-based eviction
// and invalidation. All horizontal servers share the same Redis,
// so cache is consistent across all MemoryServer instances.

export interface CacheManagerOptions {
  url?: string;
  keyPrefix?: string;
  defaultTTL?: number; // ms, default 300000 (5 min)
}

export class CacheManager {
  private client: any = null;
  private options: CacheManagerOptions & { keyPrefix: string; defaultTTL: number };
  private ready: Promise<void>;

  constructor(options: CacheManagerOptions = {}) {
    this.options = {
      url: options.url,
      keyPrefix: options.keyPrefix ?? 'timps:cache:',
      defaultTTL: options.defaultTTL ?? 300_000,
    };
    this.ready = this._connect();
  }

  private async _connect(): Promise<void> {
    try {
      const Redis: any = require('ioredis');
      this.client = this.options.url ? new Redis(this.options.url) : new Redis();
    } catch (e) {
      throw new Error(
        `CacheManager: failed to connect. Install ioredis:\n  npm install ioredis\n  ${(e as Error).message}`
      );
    }
  }

  private async _assertReady(): Promise<void> {
    await this.ready;
  }

  private _prefixed(key: string): string {
    return `${this.options.keyPrefix}${key}`;
  }

  /** Get a value from cache. Returns null on miss. */
  async get<T = any>(key: string): Promise<T | null> {
    await this._assertReady();
    const raw = await this.client.get(this._prefixed(key));
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  /** Set a value in cache with TTL. */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this._assertReady();
    const pkey = this._prefixed(key);
    const serialized = JSON.stringify(value);
    const t = ttl ?? this.options.defaultTTL;
    if (t > 0) {
      await this.client.setex(pkey, Math.ceil(t / 1000), serialized);
    } else {
      await this.client.set(pkey, serialized);
    }
  }

  /** Delete a key from cache. */
  async invalidate(key: string): Promise<void> {
    await this._assertReady();
    await this.client.del(this._prefixed(key));
  }

  /** Invalidate all keys matching a pattern. */
  async invalidatePattern(pattern: string): Promise<void> {
    await this._assertReady();
    const fullPattern = `${this.options.keyPrefix}${pattern}*`;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== '0');
  }

  /**
   * Get-or-compute: returns cached value if present, otherwise
   * calls `fn()` to compute, stores result in cache, and returns.
   */
  async wrap<T = any>(key: string, fn: () => Promise<T> | T, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fn();
    await this.set(key, value, ttl);
    return value;
  }

  /** Check if a key exists in cache. */
  async exists(key: string): Promise<boolean> {
    await this._assertReady();
    const result = await this.client.exists(this._prefixed(key));
    return result === 1;
  }

  /** Clear all cached entries for this prefix. */
  async clear(): Promise<void> {
    await this._assertReady();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', `${this.options.keyPrefix}*`, 'COUNT', 200);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== '0');
  }

  /** Close Redis connection. */
  async close(): Promise<void> {
    if (this.client) await this.client.quit();
  }
}
