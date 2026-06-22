// ── @timps/memory-core — InMemoryBackend ──
// Pure Map-based storage for testing. No disk I/O, no WAL.
// All forge layers work identically with this backend — tests run 100x faster.

import type { StorageBackend, StorageQuery, StorageRecord } from './types.js';

export class InMemoryBackend implements StorageBackend {
  private store = new Map<string, string>();

  read(key: string): any {
    const raw = this.store.get(key);
    if (raw === undefined) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  write(key: string, value: any): void {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  list(prefix?: string): string[] {
    const keys = Array.from(this.store.keys());
    return prefix ? keys.filter(k => k.startsWith(prefix)) : keys;
  }

  query(filter: StorageQuery): StorageRecord[] {
    const keys = filter.prefix ? this.list(filter.prefix) : this.list();
    let results = keys.map(key => ({ key, value: this.read(key) }));

    if (filter.timestampMin !== undefined) {
      const min = filter.timestampMin;
      results = results.filter(r => r.value?.timestamp !== undefined && r.value.timestamp >= min);
    }
    if (filter.timestampMax !== undefined) {
      const max = filter.timestampMax;
      results = results.filter(r => r.value?.timestamp !== undefined && r.value.timestamp <= max);
    }
    if (filter.filter) {
      results = results.filter(r => filter.filter!(r.value));
    }
    if (filter.limit !== undefined) {
      results = results.slice(0, filter.limit);
    }
    return results;
  }

  exists(key: string): boolean {
    return this.store.has(key);
  }

  append(key: string, line: string): void {
    const existing = this.store.get(key) ?? '';
    this.store.set(key, existing + line + '\n');
  }

  /** Clear all data — useful between tests. */
  clear(): void {
    this.store.clear();
  }
}
