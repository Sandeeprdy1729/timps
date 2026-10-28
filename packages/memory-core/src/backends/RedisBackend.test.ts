// ── RedisBackend tests (M45) ──
// Verifies query() actually applies timestampMin/timestampMax/filter/limit filters,
// unlike the previous silent no-op (results.filter() without reassignment).
//
// An in-memory fake client is injected so no real Redis server (or ioredis
// connection) is needed.

import { describe, it, expect, beforeEach } from 'vitest';
import { RedisBackend } from './RedisBackend.js';
import type { StorageQuery } from './types.js';

/** Minimal in-memory stand-in for the ioredis calls RedisBackend makes. */
function fakeRedis() {
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const setOf = (k: string) => {
    if (!sets.has(k)) sets.set(k, new Set());
    return sets.get(k)!;
  };
  const ops = {
    set: (k: string, v: string) => { strings.set(k, v); },
    del: (k: string) => { strings.delete(k); },
    sadd: (k: string, m: string) => { setOf(k).add(m); },
    srem: (k: string, m: string) => { setOf(k).delete(m); },
  };
  return {
    get: async (k: string) => strings.get(k) ?? null,
    exists: async (k: string) => (strings.has(k) ? 1 : 0),
    smembers: async (k: string) => [...setOf(k)],
    quit: async () => 'OK',
    multi() {
      const queued: Array<() => void> = [];
      const tx: any = {};
      for (const [name, fn] of Object.entries(ops)) {
        tx[name] = (...args: [string, string]) => { queued.push(() => fn(...args)); return tx; };
      }
      tx.exec = async () => queued.map(run => [null, run()]);
      return tx;
    },
  };
}

describe('RedisBackend — M45 query filters', () => {
  let backend: RedisBackend;

  beforeEach(() => {
    backend = new RedisBackend({ keyPrefix: 'test:', client: fakeRedis() });
  });

  it('query limit caps result count', async () => {
    for (let i = 0; i < 5; i++) await backend.write(`r:${i}`, { timestamp: 100 + i });

    const query: StorageQuery = { prefix: 'r:', limit: 2 };
    const results = await backend.query(query);
    expect(results.length).toBe(2);
  });

  it('query timestampMin/Max filters', async () => {
    await backend.write('a', { timestamp: 100 });
    await backend.write('b', { timestamp: 500 });
    await backend.write('c', { timestamp: 900 });

    const resMin = await backend.query({ prefix: '', timestampMin: 400 });
    expect(resMin.map(r => r.key)).toEqual(['b', 'c']);

    const resMax = await backend.query({ prefix: '', timestampMax: 400 });
    expect(resMax.map(r => r.key)).toEqual(['a']);

    const resBoth = await backend.query({ prefix: '', timestampMin: 200, timestampMax: 800 });
    expect(resBoth.map(r => r.key)).toEqual(['b']);
  });

  it('query filter() predicate applies', async () => {
    await backend.write('x', { timestamp: 100, type: 'fact' });
    await backend.write('y', { timestamp: 200, type: 'goal' });

    const results = await backend.query({ prefix: '', filter: (v: any) => v?.type === 'goal' });
    expect(results.map(r => r.key)).toEqual(['y']);
  });

  it('query applies all filters in combination (limit + window + predicate)', async () => {
    for (let i = 0; i < 5; i++) {
      await backend.write(`m:${i}`, { timestamp: 100 + i * 100, confidence: i % 2 === 0 ? 0.9 : 0.1 });
    }

    const results = await backend.query({
      prefix: 'm:',
      timestampMin: 150,
      timestampMax: 350,
      filter: (v: any) => v.confidence >= 0.5,
      limit: 1,
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.value.timestamp).toBeGreaterThanOrEqual(150);
    expect(r.value.timestamp).toBeLessThanOrEqual(350);
    expect(r.value.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('query without filters returns everything matching prefix', async () => {
    await backend.write('a', { timestamp: 1 });
    await backend.write('b', { timestamp: 2 });
    const results = await backend.query({ prefix: '' });
    expect(results.length).toBe(2);
  });
});