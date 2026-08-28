// ── @timps/memory-core — PostgresBackend ──
// Async StorageBackend backed by PostgreSQL with read/write splitting.
// Supports multi-tenant isolation via OrgScope + Row-Level Security.
//
// Usage:
//   const backend = new PostgresBackend({
//     primary: 'postgresql://user:pass@primary:5432/memory',
//     replicas: ['postgresql://user:pass@replica1:5432/memory'],
//   });
//   const engine = new MemoryEngine('/tmp/mem', { backend });

import type { StorageBackend, StorageQuery, StorageRecord, StorageTransaction, OrgScope } from './types.js';
import { buildKey, scopeListPrefix } from './types.js';

export interface PostgresBackendOptions {
  primary: string;
  replicas?: string[];
  schema?: string;
  tableName?: string;
  /** If true, enables Row-Level Security policies on the table (default: true). */
  enableRLS?: boolean;
}

export class PostgresBackend implements StorageBackend {
  private options: Required<PostgresBackendOptions>;
  private primaryPool: any = null;
  private replicaPools: any[] = [];
  private replicaIndex = 0;
  private ready: Promise<void>;
  private _activeScope: OrgScope | null = null;

  constructor(options: PostgresBackendOptions) {
    this.options = {
      primary: options.primary,
      replicas: options.replicas ?? [],
      schema: options.schema ?? 'timps',
      tableName: options.tableName ?? 'memory_store',
      enableRLS: options.enableRLS ?? true,
    };
    this.ready = this._connect();
  }

  setScope(scope: OrgScope | null): void {
    this._activeScope = scope;
  }

  getScope(): OrgScope | null {
    return this._activeScope;
  }

  /** Resolve effective scope: explicit arg > active scope > null */
  private _resolveScope(scope?: OrgScope): OrgScope | null {
    return scope ?? this._activeScope ?? null;
  }

  private async _connect(): Promise<void> {
    try {
      const { Pool } = await import('pg');
      this.primaryPool = new Pool({ connectionString: this.options.primary });
      for (const connStr of this.options.replicas) {
        this.replicaPools.push(new Pool({ connectionString: connStr }));
      }
      await this._ensureSchema();
      if (this.options.enableRLS) {
        await this._setupRLS();
      }
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
        org_id TEXT NOT NULL DEFAULT '',
        team_id TEXT NOT NULL DEFAULT '',
        project_id TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS "${tableName}_org_idx" ON "${schema}"."${tableName}" (org_id);
      CREATE INDEX IF NOT EXISTS "${tableName}_org_project_idx" ON "${schema}"."${tableName}" (org_id, project_id);
    `);
  }

  private async _setupRLS(): Promise<void> {
    const { schema, tableName } = this.options;
    // Enable RLS on the table
    await this.primaryPool.query(`
      ALTER TABLE "${schema}"."${tableName}" ENABLE ROW LEVEL SECURITY;
    `).catch(() => { /* already enabled */ });

    // Tenant isolation policy: users can only see rows matching their org_id
    await this.primaryPool.query(`
      DROP POLICY IF EXISTS tenant_isolation ON "${schema}"."${tableName}";
    `).catch(() => {});
    await this.primaryPool.query(`
      CREATE POLICY tenant_isolation ON "${schema}"."${tableName}"
        FOR ALL
        USING (org_id = current_setting('app.org_id', true) OR org_id = '')
        WITH CHECK (org_id = current_setting('app.org_id', true) OR org_id = '');
    `).catch(() => {});
  }

  /** Set the Postgres session variable for RLS. */
  async setSessionOrg(orgId: string): Promise<void> {
    await this._assertReady();
    await this.primaryPool.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
  }

  private async _assertReady(): Promise<void> {
    await this.ready;
  }

  private _readPool(): any {
    if (this.replicaPools.length === 0) return this.primaryPool;
    const pool = this.replicaPools[this.replicaIndex % this.replicaPools.length];
    this.replicaIndex++;
    return pool;
  }

  private _scopeConditions(scope: OrgScope | null): { whereClause: string; params: any[]; paramIdx: number } {
    if (!scope) return { whereClause: '', params: [], paramIdx: 1 };
    const { schema, tableName } = this.options;
    const conditions = [`org_id = $1`, `project_id = $2`];
    const params: any[] = [scope.orgId, scope.projectId];
    if (scope.teamId) {
      conditions.push(`team_id = $3`);
      params.push(scope.teamId);
    }
    return { whereClause: ` AND ${conditions.join(' AND ')}`, params, paramIdx: params.length + 1 };
  }

  async read(key: string, scope?: OrgScope): Promise<any> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const { schema, tableName } = this.options;

    if (effectiveScope) {
      const sk = buildKey('', key, effectiveScope);
      const res = await this._readPool().query(
        `SELECT value FROM "${schema}"."${tableName}" WHERE key = $1 AND org_id = $2 AND project_id = $3`,
        [sk, effectiveScope.orgId, effectiveScope.projectId]
      );
      return res.rows.length > 0 ? res.rows[0].value : null;
    }

    const res = await this._readPool().query(
      `SELECT value FROM "${schema}"."${tableName}" WHERE key = $1`,
      [key]
    );
    return res.rows.length > 0 ? res.rows[0].value : null;
  }

  async write(key: string, value: any, scope?: OrgScope): Promise<void> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const { schema, tableName } = this.options;

    if (effectiveScope) {
      const sk = buildKey('', key, effectiveScope);
      await this.primaryPool.query(
        `INSERT INTO "${schema}"."${tableName}" (key, value, org_id, team_id, project_id, updated_at)
         VALUES ($1, $2::jsonb, $3, $4, $5, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, org_id = $3, team_id = $4, project_id = $5, updated_at = NOW()`,
        [sk, JSON.stringify(value), effectiveScope.orgId, effectiveScope.teamId ?? '', effectiveScope.projectId]
      );
      return;
    }

    await this.primaryPool.query(
      `INSERT INTO "${schema}"."${tableName}" (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  }

  async delete(key: string, scope?: OrgScope): Promise<void> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const { schema, tableName } = this.options;

    if (effectiveScope) {
      const sk = buildKey('', key, effectiveScope);
      await this.primaryPool.query(
        `DELETE FROM "${schema}"."${tableName}" WHERE key = $1 AND org_id = $2 AND project_id = $3`,
        [sk, effectiveScope.orgId, effectiveScope.projectId]
      );
      return;
    }

    await this.primaryPool.query(
      `DELETE FROM "${schema}"."${tableName}" WHERE key = $1`,
      [key]
    );
  }

  async list(prefix?: string, scope?: OrgScope): Promise<string[]> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const { schema, tableName } = this.options;

    if (effectiveScope) {
      const sp = scopeListPrefix(prefix ?? '', effectiveScope);
      const res = await this._readPool().query(
        `SELECT key FROM "${schema}"."${tableName}"
         WHERE key LIKE $1 || '%' AND org_id = $2 AND project_id = $3
         ORDER BY key`,
        [sp, effectiveScope.orgId, effectiveScope.projectId]
      );
      return res.rows.map((r: any) => r.key);
    }

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
    const effectiveScope = this._resolveScope(filter.orgScope);
    const { schema, tableName } = this.options;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (effectiveScope) {
      const sp = scopeListPrefix(filter.prefix ?? '', effectiveScope);
      conditions.push(`key LIKE $${idx} || '%'`);
      params.push(sp);
      idx++;
      conditions.push(`org_id = $${idx}`);
      params.push(effectiveScope.orgId);
      idx++;
      conditions.push(`project_id = $${idx}`);
      params.push(effectiveScope.projectId);
      idx++;
    } else if (filter.prefix) {
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

  async exists(key: string, scope?: OrgScope): Promise<boolean> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const { schema, tableName } = this.options;

    if (effectiveScope) {
      const sk = buildKey('', key, effectiveScope);
      const res = await this._readPool().query(
        `SELECT 1 FROM "${schema}"."${tableName}" WHERE key = $1 AND org_id = $2 AND project_id = $3 LIMIT 1`,
        [sk, effectiveScope.orgId, effectiveScope.projectId]
      );
      return res.rows.length > 0;
    }

    const res = await this._readPool().query(
      `SELECT 1 FROM "${schema}"."${tableName}" WHERE key = $1 LIMIT 1`,
      [key]
    );
    return res.rows.length > 0;
  }

  async append(key: string, line: string, scope?: OrgScope): Promise<void> {
    const existing = (await this.read(key, scope)) || '';
    await this.write(key, existing + line + '\n', scope);
  }

  beginTxn(): PostgresTransaction {
    return new PostgresTransaction(this);
  }

  async close(): Promise<void> {
    if (this.primaryPool) await this.primaryPool.end();
    for (const pool of this.replicaPools) {
      await pool.end();
    }
  }

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
  private ops: Array<{ type: 'write' | 'delete'; key: string; value?: any; scope?: OrgScope }> = [];
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
        await this.backend.write(op.key, op.value!, op.scope);
      } else {
        await this.backend.delete(op.key, op.scope);
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
