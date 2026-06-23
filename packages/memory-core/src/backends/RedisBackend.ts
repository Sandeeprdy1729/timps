// ── @timps/memory-core — RedisBackend ──
// Async StorageBackend backed by Redis with multi-tenant key scoping.

import type { StorageBackend, StorageQuery, StorageRecord, StorageTransaction, OrgScope } from './types.js';
import { buildKey, scopeListPrefix } from './types.js';

export interface RedisBackendOptions {
  url?: string;
  keyPrefix?: string;
}

export class RedisBackend implements StorageBackend {
  private options: RedisBackendOptions;
  private client: any = null;
  private ready: Promise<void>;
  private _activeScope: OrgScope | null = null;

  constructor(options: RedisBackendOptions = {}) {
    this.options = { keyPrefix: 'timps:', ...options };
    this.ready = this._connect();
  }

  setScope(scope: OrgScope | null): void {
    this._activeScope = scope;
  }

  getScope(): OrgScope | null {
    return this._activeScope;
  }

  private _resolveScope(scope?: OrgScope): OrgScope | null {
    return scope ?? this._activeScope ?? null;
  }

  private async _connect(): Promise<void> {
    try {
      const Redis = require('ioredis');
      this.client = this.options.url ? new Redis(this.options.url) : new Redis();
    } catch (e) {
      throw new Error(
        `RedisBackend: failed to connect. Install ioredis:\n  npm install ioredis\n  ${(e as Error).message}`
      );
    }
  }

  private _prefixed(key: string): string {
    return `${this.options.keyPrefix}${key}`;
  }

  private async _assertReady(): Promise<void> {
    await this.ready;
  }

  async read(key: string, scope?: OrgScope): Promise<any> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const actualKey = effectiveScope ? buildKey('', key, effectiveScope) : key;
    const raw = await this.client.get(this._prefixed(actualKey));
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  async write(key: string, value: any, scope?: OrgScope): Promise<void> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const actualKey = effectiveScope ? buildKey('', key, effectiveScope) : key;
    const pkey = this._prefixed(actualKey);
    const multi = this.client.multi();
    multi.set(pkey, JSON.stringify(value));
    multi.sadd(`${this.options.keyPrefix}_keys`, pkey);
    await multi.exec();
  }

  async delete(key: string, scope?: OrgScope): Promise<void> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const actualKey = effectiveScope ? buildKey('', key, effectiveScope) : key;
    const pkey = this._prefixed(actualKey);
    const multi = this.client.multi();
    multi.del(pkey);
    multi.srem(`${this.options.keyPrefix}_keys`, pkey);
    await multi.exec();
  }

  async list(prefix?: string, scope?: OrgScope): Promise<string[]> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const listPrefix = effectiveScope ? scopeListPrefix(prefix ?? '', effectiveScope) : prefix;

    const allKeys: string[] = await this.client.smembers(`${this.options.keyPrefix}_keys`);
    const results: string[] = [];
    for (const pkey of allKeys) {
      const raw = pkey.slice(this.options.keyPrefix!.length);
      if (!listPrefix || raw.startsWith(listPrefix)) {
        results.push(raw);
      }
    }
    return results.sort();
  }

  async query(filter: StorageQuery): Promise<StorageRecord[]> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(filter.orgScope);
    const keys = effectiveScope
      ? await this.list(filter.prefix, effectiveScope)
      : filter.prefix ? await this.list(filter.prefix) : await this.list();

    const results: StorageRecord[] = [];
    for (const key of keys) {
      const value = await this.read(key);
      if (value === null) continue;
      results.push({ key, value });
    }

    if (filter.timestampMin !== undefined) {
      const min = filter.timestampMin;
      results.filter(r => r.value?.timestamp !== undefined && r.value.timestamp >= min);
    }
    if (filter.timestampMax !== undefined) {
      const max = filter.timestampMax;
      results.filter(r => r.value?.timestamp !== undefined && r.value.timestamp <= max);
    }
    if (filter.filter) {
      results.filter(r => filter.filter!(r.value));
    }
    if (filter.limit !== undefined) {
      results.slice(0, filter.limit);
    }
    return results;
  }

  async exists(key: string, scope?: OrgScope): Promise<boolean> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const actualKey = effectiveScope ? buildKey('', key, effectiveScope) : key;
    const exists = await this.client.exists(this._prefixed(actualKey));
    return exists === 1;
  }

  async append(key: string, line: string, scope?: OrgScope): Promise<void> {
    const existing = (await this.read(key, scope)) || '';
    await this.write(key, existing + line + '\n', scope);
  }

  beginTxn(): RedisTransaction {
    return new RedisTransaction(this);
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}

class RedisTransaction implements StorageTransaction {
  private ops: Array<{ type: 'write' | 'delete'; key: string; value?: any }> = [];
  private committed = false;
  private rolledBack = false;

  constructor(private backend: RedisBackend) {}

  write(key: string, value: any): void {
    this._checkActive();
    this.ops.push({ type: 'write', key, value });
  }

  delete(key: string): void {
    this._checkActive();
    this.ops.push({ type: 'delete', key });
  }

  async commit(): Promise<void> {
    this._checkActive();
    for (const op of this.ops) {
      if (op.type === 'write') {
        await this.backend.write(op.key, op.value!);
      } else {
        await this.backend.delete(op.key);
      }
    }
    this.committed = true;
  }

  async rollback(): Promise<void> {
    this.rolledBack = true;
  }

  private _checkActive(): void {
    if (this.committed) throw new Error('Transaction already committed');
    if (this.rolledBack) throw new Error('Transaction already rolled back');
  }
}
