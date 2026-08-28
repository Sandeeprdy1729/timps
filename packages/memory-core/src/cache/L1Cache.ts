// ── @timps/memory-core — L1 In-Process LRU Cache (Phase 4e) ──
// Per-server in-memory cache with TTL and LRU eviction.
// Fastest tier: <1ms lookup, no I/O, no serialization.
// Evicts least-recently-used entries when maxSize is exceeded.

export interface L1CacheEntry<T> {
  value: T;
  expiry: number;
  staleExpiry: number;
}

export interface L1CacheOptions {
  /** Maximum number of entries (default: 1000). */
  maxSize?: number;
  /** Default TTL in ms (default: 5000 = 5 seconds). */
  defaultTTL?: number;
  /** Stale-while-revalidate grace period in ms (default: 15000 = 15s). */
  staleGrace?: number;
}

export class L1Cache<T = any> {
  private cache = new Map<string, L1CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private readonly staleGrace: number;
  private hitCount = 0;
  private missCount = 0;
  private staleHitCount = 0;

  constructor(options: L1CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTTL = options.defaultTTL ?? 5000;
    this.staleGrace = options.staleGrace ?? 15000;
  }

  /** Build a scoped cache key from query + optional scope. */
  static makeKey(
    query: string,
    scope?: { orgId?: string; projectId?: string },
    suffix?: string,
  ): string {
    const scopeStr = scope
      ? `${scope.orgId ?? 'default'}:${scope.projectId ?? 'default'}`
      : 'global';
    const norm = query.toLowerCase().trim();
    return suffix ? `${scopeStr}:${norm}:${suffix}` : `${scopeStr}:${norm}`;
  }

  /** Get a value from the cache. Returns undefined on miss or expiry. */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.missCount++;
      return undefined;
    }

    const now = Date.now();

    if (now <= entry.expiry) {
      // Fresh — move to end (LRU bump) and return
      this.cache.delete(key);
      this.cache.set(key, entry);
      this.hitCount++;
      return entry.value;
    }

    if (now <= entry.staleExpiry) {
      // Stale but within grace period — return stale, schedule refresh
      this.cache.delete(key);
      this.cache.set(key, entry);
      this.staleHitCount++;
      return entry.value;
    }

    // Fully expired
    this.cache.delete(key);
    this.missCount++;
    return undefined;
  }

  /** Store a value in the cache with optional TTL. */
  set(key: string, value: T, ttl?: number): void {
    // Evict LRU if at capacity
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) this.cache.delete(lruKey);
    }

    const t = ttl ?? this.defaultTTL;
    const now = Date.now();
    this.cache.set(key, {
      value,
      expiry: now + t,
      staleExpiry: now + t + this.staleGrace,
    });
  }

  /** Delete a single key. */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Delete all keys matching a prefix pattern. */
  invalidatePattern(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /** Clear the entire cache. */
  clear(): void {
    this.cache.clear();
  }

  /** Current number of entries. */
  get size(): number {
    return this.cache.size;
  }

  /** Cache hit/miss stats. */
  get stats(): { hits: number; misses: number; staleHits: number; size: number } {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      staleHits: this.staleHitCount,
      size: this.cache.size,
    };
  }

  /** Reset stats counters. */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.staleHitCount = 0;
  }
}
