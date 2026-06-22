// ── @timps/memory-core — PostgresBackend ──
// Async StorageBackend backed by PostgreSQL.
// Requires `pg` package: `npm install pg @types/pg`
//
// Usage:
//   const backend = new PostgresBackend({ connectionString: 'postgresql://...' });
//   const engine = new MemoryEngine('/tmp/mem', { backend });

import type { StorageBackend, StorageQuery, StorageRecord, StorageTransaction } from './types.js';

export interface PostgresBackendOptions {
  connectionString: string;
  schema?: string;
  tableName?: string;
}

/**
 * Postgres-backed storage.
 * Stores all values as JSONB in a single key/value table.
 * Uses SERIALIZABLE transactions for atomic multi-key writes.
 */
export class PostgresBackend implements StorageBackend {
  private options: PostgresBackendOptions;
  private pool: any = null;
  private ready: Promise<void>;

  constructor(options: PostgresBackendOptions) {
    this.options = {
      schema: 'timps',
      tableName: 'memory_store',
      ...options,
    };
    this.ready = this._connect();
  }

  private async _connect(): Promise<void> {
    try {
      const { Pool } = await import('pg');
      this.pool = new Pool({ connectionString: this.options.connectionString });
      await this._ensureSchema();
    } catch (e) {
      throw new Error(
        `PostgresBackend: failed to connect. Install pg: npm install pg\n  ${(e as Error).message}`
      );
    }
  }

  private async _ensureSchema(): Promise<void> {
    const { schema, tableName } = this.options;
    await this.pool.query(`
      CREATE SCHEMA IF NOT EXISTS "${schema}";
      CREATE TABLE IF NOT EXISTS "${schema}"."${tableName}" (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  }

  private async _assertReady(): Promise<void> {
    await this.ready;
  }

  async read(key: string): Promise<any> {
    await this._assertReady();
    const { schema, tableName } = this.options;
    const res = await this.pool.query(
      `SELECT value FROM "${schema}"."${tableName}" WHERE key = $1`,
      [key]
    );
    return res.rows.length > 0 ? res.rows[0].value : null;
  }

  async write(key: string, value: any): Promise<void> {
    await this._assertReady();
    const { schema, tableName } = this.options;
    await this.pool.query(
      `INSERT INTO "${schema}"."${tableName}" (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  }

  async delete(key: string): Promise<void> {
    await this._assertReady();
    const { schema, tableName } = this.options;
    await this.pool.query(
      `DELETE FROM "${schema}"."${tableName}" WHERE key = $1`,
      [key]
    );
  }

  async list(prefix?: string): Promise<string[]> {
    await this._assertReady();
    const { schema, tableName } = this.options;
    let query = `SELECT key FROM "${schema}"."${tableName}"`;
    const params: string[] = [];
    if (prefix) {
      query += ` WHERE key LIKE $1 || '%'`;
      params.push(prefix);
    }
    query += ` ORDER BY key`;
    const res = await this.pool.query(query, params);
    return res.rows.map((r: any) => r.key);
  }

  async query(filter: StorageQuery): Promise<StorageRecord[]> {
    await this._assertReady();
    const { schema, tableName } = this.options;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter.prefix) {
      conditions.push(`key LIKE $${idx} || '%'`);
      params.push(filter.prefix);
      idx++;
    }

    let query = `SELECT key, value FROM "${schema}"."${tableName}"`;
    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY key`;

    const res = await this.pool.query(query, params);
    let results: StorageRecord[] = res.rows.map((r: any) => ({ key: r.key, value: r.value }));

    if (filter.timestampMin !== undefined) {
      results = results.filter(r => r.value?.timestamp !== undefined && r.value.timestamp >= filter.timestampMin!);
    }
    if (filter.timestampMax !== undefined) {
      results = results.filter(r => r.value?.timestamp !== undefined && r.value.timestamp <= filter.timestampMax!);
    }
    if (filter.filter) {
      results = results.filter(r => filter.filter!(r.value));
    }
    if (filter.limit !== undefined) {
      results = results.slice(0, filter.limit);
    }
    return results;
  }

  async exists(key: string): Promise<boolean> {
    await this._assertReady();
    const { schema, tableName } = this.options;
    const res = await this.pool.query(
      `SELECT 1 FROM "${schema}"."${tableName}" WHERE key = $1 LIMIT 1`,
      [key]
    );
    return res.rows.length > 0;
  }

  async append(key: string, line: string): Promise<void> {
    const existing = (await this.read(key)) || '';
    await this.write(key, existing + line + '\n');
  }

  beginTxn(): PostgresTransaction {
    return new PostgresTransaction(this);
  }

  /** Close the connection pool. */
  async close(): Promise<void> {
    if (this.pool) await this.pool.end();
  }
}

class PostgresTransaction implements StorageTransaction {
  private ops: Array<{ type: 'write' | 'delete'; key: string; value?: any }> = [];
  private committed = false;
  private rolledBack = false;

  constructor(private backend: PostgresBackend) {}

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
