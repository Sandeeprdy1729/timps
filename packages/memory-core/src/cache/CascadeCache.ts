// ── @timps/memory-core — Cascade Cache (Phase 4e) ──
// Three-tier cache cascade: L1 (in-process LRU) → L2 (Redis) → L3 (compute).
// Populates upper tiers on each miss. Supports stale-while-revalidate,
// pattern invalidation, hit/miss metrics, and warm-up seeding.
//
// Architecture:
//   Request → L1 (<1ms) → HIT → return
//            → L2 (<5ms) → HIT → populate L1 → return
//            → L3 (compute, <50ms) → populate L2 + L1 → return

import type { CacheManager } from './CacheManager.js';
import { L1Cache } from './L1Cache.js';

export interface CascadeCacheOptions {
  /** L1 cache max entries (default: 1000). */
  l1MaxSize?: number;
  /** L1 default TTL in ms (default: 5000 = 5s). */
  l1TTL?: number;
  /** L2 default TTL in ms (default: 300000 = 5min). Forge state lives longer. */
  l2TTL?: number;
  /** L2 TTL for recall result entries (default: 60000 = 1min). */
  recallTTL?: number;
  /** Stale-while-revalidate grace period in ms (default: 15000 = 15s). */
  staleGrace?: number;
  /** Org scope for cache key isolation. */
  orgScope?: { orgId?: string; projectId?: string };
}

export type CacheComputeFn<T> = () => T | Promise<T>;

/**
 * Three-tier cache with staleness awareness.
 *
 * L1 (in-process): fast LRU with TTL, no serialization.
 * L2 (Redis): cross-server shared cache via CacheManager.
 * L3: the actual computation, only called on complete miss.
 */
export class CascadeCache {
  private l1: L1Cache;
  private l2?: CacheManager;
  private options: CascadeCacheOptions & { l2TTL: number; recallTTL: number };

  /** Cache hit/miss counters per tier. */
  private stats = { l1Hit: 0, l1Stale: 0, l2Hit: 0, miss: 0 };

  constructor(l2?: CacheManager, options: CascadeCacheOptions = {}) {
    this.l2 = l2;
    this.options = {
      l1MaxSize: options.l1MaxSize ?? 1000,
      l1TTL: options.l1TTL ?? 5000,
      l2TTL: options.l2TTL ?? 300000,
      recallTTL: options.recallTTL ?? 60000,
      staleGrace: options.staleGrace ?? 15000,
      orgScope: options.orgScope,
    };
    this.l1 = new L1Cache({
      maxSize: this.options.l1MaxSize,
      defaultTTL: this.options.l1TTL,
      staleGrace: this.options.staleGrace,
    });
  }

  /** Build a cache key with optional scope isolation. */
  private makeKey(query: string, suffix?: string): string {
    return L1Cache.makeKey(query, this.options.orgScope, suffix);
  }

  /**
   * Get-or-compute through the cascade.
   *
   * @param key - Logical cache key (query string).
   * @param compute - Fallback function called on complete miss.
   * @param l2TTL - Optional L2 TTL override (ms).
   * @returns The cached or computed value.
   */
  async getOrCompute<T>(
    key: string,
    compute: CacheComputeFn<T>,
    l2TTL?: number,
  ): Promise<T> {
    const cacheKey = this.makeKey(key);

    // L1: in-process LRU
    const l1Result = this.l1.get(cacheKey) as T | undefined;
    if (l1Result !== undefined) {
      this.stats.l1Hit++;
      return l1Result;
    }

    // L2: Redis (cross-server)
    if (this.l2) {
      try {
        const l2Result = await this.l2.get<T>(cacheKey);
        if (l2Result !== null) {
          this.stats.l2Hit++;
          // Populate L1 (shorter TTL — L1 is a hot cache)
          this.l1.set(cacheKey, l2Result, this.options.l1TTL);
          return l2Result;
        }
      } catch {
        // L2 failure is non-critical — fall through to L3
      }
    }

    // L3: compute from scratch
    this.stats.miss++;
    const result = await compute();
    if (result !== undefined && result !== null) {
      // Populate L2 (longer TTL)
      const ttl = l2TTL ?? this.options.recallTTL;
      if (this.l2) {
        try {
          await this.l2.set(cacheKey, result, ttl);
        } catch {
          // Non-critical
        }
      }
      // Populate L1 (short TTL)
      this.l1.set(cacheKey, result, this.options.l1TTL);
    }
    return result;
  }

  /** Build a scope prefix for bulk invalidation (trailing `:`). */
  private makeScopePrefix(): string {
    const scope = this.options.orgScope;
    if (!scope) return 'global:';
    return `${scope.orgId ?? 'default'}:${scope.projectId ?? 'default'}:`;
  }

  /**
   * Invalidate cache entries for a scope/project.
   * Called when a new memory is stored that may affect cached recall results.
   */
  async invalidateProject(_projectId?: string): Promise<void> {
    const prefix = this.makeScopePrefix();
    // L1: delete matches from in-process LRU
    this.l1.invalidatePattern(prefix);
    // L2: SCAN + DEL pattern (CacheManager prepends its own keyPrefix)
    if (this.l2) {
      try {
        await this.l2.invalidatePattern(prefix);
      } catch {
        // Non-critical
      }
    }
  }

  /**
   * Invalidate a specific cache key.
   */
  async invalidateKey(key: string): Promise<void> {
    const cacheKey = this.makeKey(key);
    this.l1.invalidate(cacheKey);
    if (this.l2) {
      try {
        await this.l2.invalidate(cacheKey);
      } catch {
        // Non-critical
      }
    }
  }

  /**
   * Warm up the cache with pre-computed values.
   * Used on startup to avoid cold-start latency.
   */
  async warmup(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    for (const { key, value, ttl } of entries) {
      const cacheKey = this.makeKey(key);
      this.l1.set(cacheKey, value, ttl ?? this.options.l1TTL);
      if (this.l2) {
        try {
          await this.l2.set(cacheKey, value, ttl ?? this.options.l2TTL);
        } catch {
          // Non-critical
        }
      }
    }
  }

  /** Cascade hit/miss stats for telemetry export. */
  getStats(): { l1Hit: number; l1Stale: number; l2Hit: number; miss: number; l1Size: number } {
    return {
      ...this.stats,
      l1Stale: this.l1.stats.staleHits,
      l1Size: this.l1.size,
    };
  }

  /** Reset stats counters. */
  resetStats(): void {
    this.stats = { l1Hit: 0, l1Stale: 0, l2Hit: 0, miss: 0 };
    this.l1.resetStats();
  }

  /** Clear all caches. */
  clear(): void {
    this.l1.clear();
  }
}
