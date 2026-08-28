// ── @timps/memory-core — SQLiteBackend ──
// Sync StorageBackend backed by SQLite.
// Requires `better-sqlite3`: `npm install better-sqlite3 @types/better-sqlite3`
//
// Usage:
//   const backend = new SQLiteBackend({ dbPath: '/tmp/memory.db' });
//   const engine = new MemoryEngine('/tmp/mem', { backend });

import type { StorageBackend, StorageQuery, StorageRecord, StorageTransaction } from './types.js';

export interface SQLiteBackendOptions {
  dbPath: string;
  wal?: boolean;
  tableName?: string;
}

/**
 * SQLite-backed storage using better-sqlite3 (synchronous).
 * Stores all values as JSON TEXT in a key/value table.
 * Uses WAL mode by default for concurrent-read performance.
 */
export class SQLiteBackend implements StorageBackend {
  private db: any = null;
  private tableName: string;

  constructor(options: SQLiteBackendOptions) {
    this.tableName = options.tableName ?? 'memory_store';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require('better-sqlite3');
      this.db = new Database(options.dbPath);
      if (options.wal !== false) {
        this.db.pragma('journal_mode = WAL');
      }
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS "${this.tableName}" (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
        )
      `);
    } catch (e) {
      throw new Error(
        `SQLiteBackend: failed to open database. Install better-sqlite3:\n  npm install better-sqlite3\n  ${(e as Error).message}`
      );
    }
  }

  read(key: string): any {
    const row = this.db.prepare(
      `SELECT value FROM "${this.tableName}" WHERE key = ?`
    ).get(key);
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return row.value; }
  }

  write(key: string, value: any): void {
    this.db.prepare(
      `INSERT INTO "${this.tableName}" (key, value, updated_at)
       VALUES (?, ?, strftime('%s','now') * 1000)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(key, JSON.stringify(value));
  }

  delete(key: string): void {
    this.db.prepare(
      `DELETE FROM "${this.tableName}" WHERE key = ?`
    ).run(key);
  }

  list(prefix?: string): string[] {
    let query = `SELECT key FROM "${this.tableName}"`;
    const params: any[] = [];
    if (prefix) {
      query += ` WHERE key LIKE ? || '%'`;
      params.push(prefix);
    }
    query += ` ORDER BY key`;
    const rows = this.db.prepare(query).all(...params);
    return rows.map((r: any) => r.key);
  }

  query(filter: StorageQuery): StorageRecord[] {
    const keys = filter.prefix ? this.list(filter.prefix) : this.list();
    let results = keys.map(key => ({ key, value: this.read(key) }));

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

  exists(key: string): boolean {
    const row = this.db.prepare(
      `SELECT 1 FROM "${this.tableName}" WHERE key = ? LIMIT 1`
    ).get(key);
    return !!row;
  }

  append(key: string, line: string): void {
    const existing = this.read(key) ?? '';
    this.write(key, existing + line + '\n');
  }

  beginTxn(): SQLiteTransaction {
    return new SQLiteTransaction(this.db, this.write.bind(this), this.delete.bind(this));
  }

  /** Close the database connection. */
  close(): void {
    if (this.db) this.db.close();
  }
}

class SQLiteTransaction implements StorageTransaction {
  private ops: Array<{ type: 'write' | 'delete'; key: string; value?: any }> = [];
  private committed = false;
  private rolledBack = false;

  constructor(
    private db: any,
    private writeFn: (key: string, value: any) => void,
    private deleteFn: (key: string) => void,
  ) {}

  write(key: string, value: any): void {
    this._checkActive();
    this.ops.push({ type: 'write', key, value });
  }

  delete(key: string): void {
    this._checkActive();
    this.ops.push({ type: 'delete', key });
  }

  commit(): void {
    this._checkActive();
    const txn = this.db.transaction(() => {
      for (const op of this.ops) {
        if (op.type === 'write') {
          this.writeFn(op.key, op.value!);
        } else {
          this.deleteFn(op.key);
        }
      }
    });
    txn();
    this.committed = true;
  }

  rollback(): void {
    this.rolledBack = true;
  }

  private _checkActive(): void {
    if (this.committed) throw new Error('Transaction already committed');
    if (this.rolledBack) throw new Error('Transaction already rolled back');
  }
}
