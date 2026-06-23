// ── @timps/memory-core — PostgresBackend ──
// Async StorageBackend backed by PostgreSQL with read/write splitting.
// Writes → primary, reads → replicas (round-robin).
// Requires `pg` package: `npm install pg @types/pg`
//
// Usage:
//   const backend = new PostgresBackend({
//     primary: 'postgresql://user:pass@primary:5432/memory',
//     replicas: ['postgresql://user:pass@replica1:5432/memory',
//                'postgresql://user:pass@replica2:5432/memory'],
//   });
//   const engine = new MemoryEngine('/tmp/mem', { backend });

import type { StorageBackend, StorageQuery, StorageRecord, StorageTransaction } from './types.js';

export interface PostgresBackendOptions {
  /** Primary connection string for writes (required). */
  primary: string;
  /** Replica connection strings for reads (optional). Round-robin if multiple. */
  replicas?: string[];
  schema?: string;
  tableName?: string;
}

export class PostgresBackend implements StorageBackend {
  private options: { primary: string; replicas: string[]; schema: string; tableName: string };
  private primaryPool: any = null;
  private replicaPools: any[] = [];
  private replicaIndex = 0;
  private ready: Promise<void>;

  constructor(options: PostgresBackendOptions) {
    this.options = {
      primary: options.primary,
      replicas: options.replicas ?? [],
      schema: options.schema ?? 'timps',
      tableName: options.tableName ?? 'memory_store',
    };
    this.ready = this._connect();
  }

  private async _connect(): Promise<void> {
    try {
      const { Pool } = await import('pg');
      this.primaryPool = new Pool({ connectionString: this.options.primary });
      for (const connStr of this.options.replicas) {
        this.replicaPools.push(new Pool({ connectionString: connStr }));
      }
      await this._ensureSchema();
    } catch (e) {
      throw new Error(
        `PostgresBackend: failed to connect. Install pg: npm install pg\n  ${(e as Error).message}`
      );
    }
  }

  private async _ensureSchema(): Promise<void> {
    const { schema, tableName } = this.options;
    await this.primaryPool.query(`
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

  /** Get the pool for read operations — round-robin across replicas, fallback to primary. */
  private _readPool(): any {
    if (this.replicaPools.length === 0) return this.primaryPool;
    const pool = this.replicaPools[this.replicaIndex % this.replicaPools.length];
    this.replicaIndex++;
    return pool;
  }

  async read(key: string): Promise<any> {
    await this._assertReady();
    const { schema, tableName } = this.options;
    const res = await this._readPool().query(
      `SELECT value FROM "${schema}"."${tableName}" WHERE key = $1`,
      [key]
    );
    return res.rows.length > 0 ? res.rows[0].value : null;
  }

  async write(key: string, value: any): Promise<void> {
    await this._assertReady();
    const { schema, tableName } = this.options;
    await this.primaryPool.query(
      `INSERT INTO "${schema}"."${tableName}" (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  }

  async delete(key: string): Promise<void> {
    await this._assertReady();
    const { schema, tableName } = this.options;
    await this.primaryPool.query(
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
    const res = await this._readPool().query(query, params);
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

    const res = await this._readPool().query(query, params);
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
    const res = await this._readPool().query(
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

  /** Close all connection pools. */
  async close(): Promise<void> {
    if (this.primaryPool) await this.primaryPool.end();
    for (const pool of this.replicaPools) {
      await pool.end();
    }
  }

  /** Health check — ping primary and one replica. */
  async health(): Promise<{ primary: boolean; replicas: boolean }> {
    try {
      await this.primaryPool.query('SELECT 1');
      let replicasOk = true;
      if (this.replicaPools.length > 0) {
        try {
          await this.replicaPools[0].query('SELECT 1');
        } catch {
          replicasOk = false;
        }
      }
      return { primary: true, replicas: replicasOk };
    } catch {
      return { primary: false, replicas: false };
    }
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
