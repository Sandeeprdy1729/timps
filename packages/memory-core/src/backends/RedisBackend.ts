// ── @timps/memory-core — RedisBackend ──
// Async StorageBackend backed by Redis.
// Requires `ioredis`: `npm install ioredis`
//
// Usage:
//   const backend = new RedisBackend({ url: 'redis://localhost:6379' });
//   const engine = new MemoryEngine('/tmp/mem', { backend });

import type { StorageBackend, StorageQuery, StorageRecord, StorageTransaction } from './types.js';

export interface RedisBackendOptions {
  url?: string;
  keyPrefix?: string;
}

/**
 * Redis-backed storage.
 * Stores all values as JSON strings under prefixed keys.
 * Uses a SET for key listing and individual STRING keys for values.
 */
export class RedisBackend implements StorageBackend {
  private options: RedisBackendOptions;
  private client: any = null;
  private ready: Promise<void>;

  constructor(options: RedisBackendOptions = {}) {
    this.options = { keyPrefix: 'timps:', ...options };
    this.ready = this._connect();
  }

  private async _connect(): Promise<void> {
    try {
      // Dynamic require so ioredis isn't needed at module load time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis: any = require('ioredis');
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

  async read(key: string): Promise<any> {
    await this._assertReady();
    const raw = await this.client.get(this._prefixed(key));
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  async write(key: string, value: any): Promise<void> {
    await this._assertReady();
    const pkey = this._prefixed(key);
    const multi = this.client.multi();
    multi.set(pkey, JSON.stringify(value));
    multi.sadd(`${this.options.keyPrefix}_keys`, pkey);
    await multi.exec();
  }

  async delete(key: string): Promise<void> {
    await this._assertReady();
    const pkey = this._prefixed(key);
    const multi = this.client.multi();
    multi.del(pkey);
    multi.srem(`${this.options.keyPrefix}_keys`, pkey);
    await multi.exec();
  }

  async list(prefix?: string): Promise<string[]> {
    await this._assertReady();
    const allKeys: string[] = await this.client.smembers(`${this.options.keyPrefix}_keys`);
    const results: string[] = [];
    for (const pkey of allKeys) {
      const raw = pkey.slice(this.options.keyPrefix!.length);
      if (!prefix || raw.startsWith(prefix)) {
        results.push(raw);
      }
    }
    return results.sort();
  }

  async query(filter: StorageQuery): Promise<StorageRecord[]> {
    await this._assertReady();
    const keys = filter.prefix ? await this.list(filter.prefix) : await this.list();
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

  async exists(key: string): Promise<boolean> {
    await this._assertReady();
    const exists = await this.client.exists(this._prefixed(key));
    return exists === 1;
  }

  async append(key: string, line: string): Promise<void> {
    const existing = (await this.read(key)) || '';
    await this.write(key, existing + line + '\n');
  }

  beginTxn(): RedisTransaction {
    return new RedisTransaction(this);
  }

  /** Close the Redis connection. */
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
