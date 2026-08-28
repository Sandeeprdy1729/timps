// ── RedisBackend tests (M45) ──
// Verifies query() actually applies timestampMin/timestampMax/filter/limit filters,
// unlike the previous silent no-op (results.filter() without reassignment).
//
// RedisBackend._connect() lazy-requires 'ioredis'; a stub is provided under this
// package's node_modules (gitignored, test-only) so no real Redis server is needed.

import { describe, it, expect } from 'vitest';
import { RedisBackend } from './RedisBackend.js';
import type { StorageQuery } from './types.js';

describe('RedisBackend — M45 query filters', () => {
  let backend: RedisBackend;

  beforeEach(() => {
    backend = new RedisBackend({ keyPrefix: 'test:' });
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