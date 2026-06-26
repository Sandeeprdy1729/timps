// ── @timps/memory-core — Phase 4e: Cache Tests ──
// Tests for L1Cache, CascadeCache, and ForgeCache.

import { describe, it, expect, vi } from 'vitest';
import { L1Cache } from './L1Cache.js';
import { CascadeCache } from './CascadeCache.js';
import { ForgeCache } from './ForgeCache.js';
import { InMemoryBackend } from '../backends/InMemoryBackend.js';

// ═══════════════════════════════════════════
// L1Cache — In-Process LRU Cache
// ═══════════════════════════════════════════

describe('L1Cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    const cache = new L1Cache();
    cache.set('key1', { data: 'hello' });
    expect(cache.get('key1')).toEqual({ data: 'hello' });
  });

  it('returns undefined for unknown keys', () => {
    const cache = new L1Cache();
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    const cache = new L1Cache({ defaultTTL: 10, staleGrace: 0 });
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
    vi.advanceTimersByTime(20);
    expect(cache.get('key')).toBeUndefined();
  });

  it('serves stale entries within grace period', () => {
    const cache = new L1Cache({ defaultTTL: 10, staleGrace: 50 });
    cache.set('key', 'value');
    vi.advanceTimersByTime(15);
    // Past TTL but within grace period
    expect(cache.get('key')).toBe('value');
  });

  it('evicts LRU when maxSize exceeded', () => {
    const cache = new L1Cache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // should evict 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('bumps LRU on access', () => {
    const cache = new L1Cache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access 'a' — makes it most recently used
    cache.get('a');
    cache.set('d', 4); // should evict 'b' (LRU after 'a' was bumped)
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('d')).toBe(4);
  });

  it('invalidates single key', () => {
    const cache = new L1Cache();
    cache.set('key', 'value');
    cache.invalidate('key');
    expect(cache.get('key')).toBeUndefined();
  });

  it('invalidates pattern prefix', () => {
    const cache = new L1Cache();
    cache.set('foo:1', 'a');
    cache.set('foo:2', 'b');
    cache.set('bar:1', 'c');
    cache.invalidatePattern('foo:');
    expect(cache.get('foo:1')).toBeUndefined();
    expect(cache.get('foo:2')).toBeUndefined();
    expect(cache.get('bar:1')).toBe('c');
  });

  it('clears all entries', () => {
    const cache = new L1Cache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('generates scoped keys via makeKey', () => {
    const key1 = L1Cache.makeKey('test', { orgId: 'org1', projectId: 'proj1' });
    expect(key1).toContain('org1');
    expect(key1).toContain('proj1');
    expect(key1).toContain('test');

    const key2 = L1Cache.makeKey('hello', undefined, 'suffix');
    expect(key2).toContain('global');
    expect(key2).toContain('hello');
    expect(key2).toContain('suffix');
  });

  it('tracks hit/miss stats', () => {
    const cache = new L1Cache();
    cache.set('k', 'v');
    cache.get('k'); // hit
    cache.get('missing'); // miss
    const s = cache.stats;
    expect(s.hits).toBe(1);
    expect(s.misses).toBe(1);
    expect(s.size).toBe(1);
  });

  it('resets stats', () => {
    const cache = new L1Cache();
    cache.set('k', 'v');
    cache.get('k');
    cache.resetStats();
    expect(cache.stats.hits).toBe(0);
    expect(cache.stats.misses).toBe(0);
  });
});

// ═══════════════════════════════════════════
// CascadeCache — Three-Tier Cascade
// ═══════════════════════════════════════════

describe('CascadeCache', () => {
  it('computes and caches on miss', async () => {
    const cc = new CascadeCache();
    let callCount = 0;
    const compute = vi.fn(async () => { callCount++; return 'computed'; });
    const r1 = await cc.getOrCompute('key', compute);
    expect(r1).toBe('computed');
    expect(callCount).toBe(1);
    // Second call should hit L1
    const r2 = await cc.getOrCompute('key', compute);
    expect(r2).toBe('computed');
    expect(callCount).toBe(1);
  });

  it('returns cached results from L1 on second call', async () => {
    const cc = new CascadeCache();
    const compute = vi.fn(async () => 'expensive');
    await cc.getOrCompute('q', compute);
    await cc.getOrCompute('q', compute);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('invalidates project scope', async () => {
    const cc = new CascadeCache(undefined, { orgScope: { orgId: 'o', projectId: 'p' } });
    const compute = vi.fn(async () => 'v');
    await cc.getOrCompute('q', compute);
    expect(compute).toHaveBeenCalledTimes(1);
    await cc.getOrCompute('q', compute);
    expect(compute).toHaveBeenCalledTimes(1); // still cached
    await cc.invalidateProject();
    await cc.getOrCompute('q', compute);
    expect(compute).toHaveBeenCalledTimes(2); // recomputed after invalidation
  });

  it('populates L2 when available', async () => {
    const memBackend = new InMemoryBackend();
    const mockL2 = {
      async get<T>(key: string): Promise<T | null> { return null; },
      async set(key: string, value: any): Promise<void> { memBackend.write(`cache:${key}`, value); },
      async invalidate(key: string): Promise<void> { memBackend.delete(`cache:${key}`); },
      async invalidatePattern(pattern: string): Promise<void> { /* noop in test */ },
    };
    const cc = new CascadeCache(mockL2 as any);
    await cc.getOrCompute('test-key', async () => ({ result: 42 }));
    const stored = memBackend.read('cache:global:test-key');
    expect(stored).toEqual({ result: 42 });
  });

  it('warmup pre-populates L1 and L2', async () => {
    const memBackend = new InMemoryBackend();
    const mockL2 = {
      async get<T>(key: string): Promise<T | null> { return null; },
      async set(key: string, value: any, _ttl?: number): Promise<void> { memBackend.write(`cache:${key}`, value); },
      async invalidate(key: string): Promise<void> { memBackend.delete(`cache:${key}`); },
      async invalidatePattern(pattern: string): Promise<void> { /* noop */ },
    };
    const cc = new CascadeCache(mockL2 as any);
    await cc.warmup([{ key: 'warm', value: { data: 'hot' }, ttl: 60000 }]);
    const l2Result = memBackend.read('cache:global:warm');
    expect(l2Result).toEqual({ data: 'hot' });
    // L1 should serve directly
    const compute = vi.fn(async () => 'should not call');
    const r = await cc.getOrCompute('warm', compute);
    expect(r).toEqual({ data: 'hot' });
    expect(compute).not.toHaveBeenCalled();
  });

  it('returns stats', () => {
    const cc = new CascadeCache();
    const stats = cc.getStats();
    expect(stats).toHaveProperty('l1Hit');
    expect(stats).toHaveProperty('l1Stale');
    expect(stats).toHaveProperty('l2Hit');
    expect(stats).toHaveProperty('miss');
    expect(stats).toHaveProperty('l1Size');
  });

  it('clears all caches', async () => {
    const cc = new CascadeCache();
    const compute = vi.fn(async () => 'v');
    await cc.getOrCompute('k', compute);
    expect(compute).toHaveBeenCalledTimes(1);
    cc.clear();
    await cc.getOrCompute('k', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('resets stats counters', () => {
    const cc = new CascadeCache();
    cc.getStats();
    cc.resetStats();
    const stats = cc.getStats();
    expect(stats.l1Hit).toBe(0);
    expect(stats.l1Stale).toBe(0);
    expect(stats.l2Hit).toBe(0);
    expect(stats.miss).toBe(0);
  });

  it('handles null compute result gracefully', async () => {
    const cc = new CascadeCache();
    const r = await cc.getOrCompute('k', async () => null);
    expect(r).toBeNull();
  });
});

// ═══════════════════════════════════════════
// ForgeCache — Forge State Caching
// ═══════════════════════════════════════════

describe('ForgeCache', () => {
  it('stores and retrieves forge state', async () => {
    const fc = new ForgeCache();
    await fc.set('echo', 'reservoir', [1, 2, 3]);
    const result = await fc.get<number[]>('echo', 'reservoir');
    expect(result).toEqual([1, 2, 3]);
  });

  it('returns undefined on miss', async () => {
    const fc = new ForgeCache();
    expect(await fc.get('harmonic', 'eigenmodes')).toBeUndefined();
  });

  it('getOrCompute computes on miss', async () => {
    const fc = new ForgeCache();
    const compute = vi.fn(async () => ({ values: [1, 2], vectors: [3, 4] }));
    const r1 = await fc.getOrCompute('harmonic', 'eigenmodes', compute);
    expect(r1).toEqual({ values: [1, 2], vectors: [3, 4] });
    expect(compute).toHaveBeenCalledTimes(1);
    // Second call returns cached
    const r2 = await fc.getOrCompute('harmonic', 'eigenmodes', compute);
    expect(r2).toEqual({ values: [1, 2], vectors: [3, 4] });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('getOrCompute returns cached if present', async () => {
    const fc = new ForgeCache();
    await fc.set('echo', 'decay_scores', { a: 0.5 });
    const compute = vi.fn(async () => { throw new Error('should not call'); });
    const r = await fc.getOrCompute('echo', 'decay_scores', compute);
    expect(r).toEqual({ a: 0.5 });
  });

  it('invalidates specific forge state', async () => {
    const fc = new ForgeCache();
    await fc.set('aether', 'eigenmodes', [1]);
    expect(await fc.get('aether', 'eigenmodes')).toEqual([1]);
    await fc.invalidate('aether', 'eigenmodes');
    expect(await fc.get('aether', 'eigenmodes')).toBeUndefined();
  });

  it('invalidates all forge state for project', async () => {
    const fc = new ForgeCache({ orgScope: { orgId: 'testorg', projectId: 'testproj' } });
    await fc.set('echo', 'reservoir', 'data1');
    await fc.set('harmonic', 'eigenmodes', 'data2');
    await fc.invalidateProject();
    expect(await fc.get('echo', 'reservoir')).toBeUndefined();
    expect(await fc.get('harmonic', 'eigenmodes')).toBeUndefined();
  });

  it('uses per-forge TTL overrides', async () => {
    const fc = new ForgeCache();
    // Should accept and store with correct TTL
    await fc.set('harmonic', 'eigenmodes', 'long-lived');
    const result = await fc.get('harmonic', 'eigenmodes');
    expect(result).toBe('long-lived');
  });

  it('integrates with L2 backend', async () => {
    const memBackend = new InMemoryBackend();
    const mockL2 = {
      async get<T>(key: string): Promise<T | null> {
        const raw = memBackend.read(`forge:${key}`);
        return raw as T ?? null;
      },
      async set(key: string, value: any): Promise<void> { memBackend.write(`forge:${key}`, value); },
      async invalidate(key: string): Promise<void> { memBackend.delete(`forge:${key}`); },
      async invalidatePattern(pattern: string): Promise<void> { /* noop */ },
    };
    const fc = new ForgeCache(mockL2 as any);
    await fc.set('contradiction', 'pairs', ['p1', 'p2']);
    const l2Result = memBackend.read('forge:forge:default:default:contradiction:pairs');
    expect(l2Result).toEqual(['p1', 'p2']);
  });
});
