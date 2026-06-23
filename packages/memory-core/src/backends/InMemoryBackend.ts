// ── @timps/memory-core — InMemoryBackend ──
// Pure Map-based storage for testing. No disk I/O, no WAL.
// All forge layers work identically with this backend — tests run 100x faster.

import type { StorageBackend, StorageQuery, StorageRecord, OrgScope } from './types.js';
import { buildKey, scopeListPrefix } from './types.js';

export class InMemoryBackend implements StorageBackend {
  private store = new Map<string, string>();
  private _activeScope: OrgScope | null = null;

  setScope(scope: OrgScope | null): void {
    this._activeScope = scope;
  }

  getScope(): OrgScope | null {
    return this._activeScope;
  }

  private _resolveScope(scope?: OrgScope): OrgScope | null {
    return scope ?? this._activeScope ?? null;
  }

  read(key: string, scope?: OrgScope): any {
    const effectiveScope = this._resolveScope(scope);
    const actualKey = effectiveScope ? buildKey('', key, effectiveScope) : key;
    const raw = this.store.get(actualKey);
    if (raw === undefined) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  write(key: string, value: any, scope?: OrgScope): void {
    const effectiveScope = this._resolveScope(scope);
    const actualKey = effectiveScope ? buildKey('', key, effectiveScope) : key;
    this.store.set(actualKey, typeof value === 'string' ? value : JSON.stringify(value));
  }

  delete(key: string, scope?: OrgScope): void {
    const effectiveScope = this._resolveScope(scope);
    const actualKey = effectiveScope ? buildKey('', key, effectiveScope) : key;
    this.store.delete(actualKey);
  }

  list(prefix?: string, scope?: OrgScope): string[] {
    const effectiveScope = this._resolveScope(scope);
    const listPrefix = effectiveScope ? scopeListPrefix(prefix ?? '', effectiveScope) : prefix;
    const keys = Array.from(this.store.keys());
    return listPrefix ? keys.filter(k => k.startsWith(listPrefix)) : keys;
  }

  query(filter: StorageQuery): StorageRecord[] {
    const keys = filter.prefix ? this.list(filter.prefix, filter.orgScope) : this.list(undefined, filter.orgScope);
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

  exists(key: string, scope?: OrgScope): boolean {
    const effectiveScope = this._resolveScope(scope);
    const actualKey = effectiveScope ? buildKey('', key, effectiveScope) : key;
    return this.store.has(actualKey);
  }

  append(key: string, line: string, scope?: OrgScope): void {
    const effectiveScope = this._resolveScope(scope);
    const actualKey = effectiveScope ? buildKey('', key, effectiveScope) : key;
    const existing = this.store.get(actualKey) ?? '';
    this.store.set(actualKey, existing + line + '\n');
  }

  /** Clear all data — useful between tests. */
  clear(): void {
    this.store.clear();
  }
}
