// ── @timps/memory-core — QdrantBackend ──
// Vector store backend for embedding storage and semantic search.
// Requires `@qdrant/js-client-rest`: `npm install @qdrant/js-client-rest`
//
// StorageBackend methods store/recall raw JSON by key (for compatibility).
// Specialized methods `upsertVector()` and `searchVectors()` handle embeddings.
//
// Usage:
//   const backend = new QdrantBackend({ url: 'http://localhost:6333' });
//   await backend.upsertVector('mem_abc', [0.1, 0.2, ...], { content: 'hello' });
//   const results = await backend.searchVectors([0.1, 0.2, ...], { topK: 10 });

import type { StorageBackend, StorageQuery, StorageRecord, StorageTransaction } from './types.js';

export interface QdrantBackendOptions {
  url?: string;
  apiKey?: string;
  collectionName?: string;
  vectorSize?: number;
}

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
  score?: number;
}

export class QdrantBackend implements StorageBackend {
  private options: Required<QdrantBackendOptions>;
  private client: any = null;
  private ready: Promise<void>;
  private _initialized = false;

  constructor(options: QdrantBackendOptions = {}) {
    this.options = {
      url: 'http://localhost:6333',
      apiKey: '',
      collectionName: 'timps_memory',
      vectorSize: 384,
      ...options,
    };
    this.ready = this._connect();
  }

  private async _connect(): Promise<void> {
    try {
      const { QdrantClient } = require('@qdrant/js-client-rest');
      this.client = new QdrantClient({
        url: this.options.url,
        apiKey: this.options.apiKey || undefined,
      });
      await this._ensureCollection();
    } catch (e) {
      throw new Error(
        `QdrantBackend: failed to connect. Install @qdrant/js-client-rest:\n  npm install @qdrant/js-client-rest\n  ${(e as Error).message}`
      );
    }
  }

  private async _ensureCollection(): Promise<void> {
    if (this._initialized) return;
    const collections = await this.client.getCollections();
    const exists = collections.collections?.some(
      (c: any) => c.name === this.options.collectionName
    );
    if (!exists) {
      await this.client.createCollection(this.options.collectionName, {
        vectors: {
          size: this.options.vectorSize,
          distance: 'Cosine',
        },
      });
    }
    this._initialized = true;
  }

  private async _assertReady(): Promise<void> {
    await this.ready;
  }

  // ── StorageBackend interface ──
  // JSON values stored in Qdrant point payloads using a fixed vector of zeros.
  // This is NOT how you use Qdrant for vector search — use upsertVector/searchVectors for that.

  async read(key: string): Promise<any> {
    await this._assertReady();
    try {
      const result = await this.client.retrieve(this.options.collectionName, {
        ids: [key],
      });
      if (result.length === 0) return null;
      return result[0].payload?.__data ?? null;
    } catch {
      return null;
    }
  }

  async write(key: string, value: any): Promise<void> {
    await this._assertReady();
    await this.client.upsert(this.options.collectionName, {
      points: [{
        id: key,
        vector: new Array(this.options.vectorSize).fill(0),
        payload: { __data: value },
      }],
    });
  }

  async delete(key: string): Promise<void> {
    await this._assertReady();
    await this.client.delete(this.options.collectionName, {
      points: [key],
    });
  }

  async list(prefix?: string): Promise<string[]> {
    await this._assertReady();
    const result = await this.client.scroll(this.options.collectionName, {
      limit: 10000,
      with_payload: false,
    });
    const ids = result.points.map((p: any) => p.id as string);
    if (!prefix) return ids.sort();
    return ids.filter((id: string) => id.startsWith(prefix)).sort();
  }

  async query(filter: StorageQuery): Promise<StorageRecord[]> {
    await this._assertReady();
    const ids = filter.prefix ? await this.list(filter.prefix) : await this.list();
    const results: StorageRecord[] = [];
    for (const id of ids) {
      const value = await this.read(id);
      if (value === null) continue;
      results.push({ key: id, value });
    }
    return results;
  }

  async exists(key: string): Promise<boolean> {
    await this._assertReady();
    try {
      const result = await this.client.retrieve(this.options.collectionName, {
        ids: [key],
      });
      return result.length > 0;
    } catch {
      return false;
    }
  }

  async append(key: string, line: string): Promise<void> {
    const existing = (await this.read(key)) || '';
    await this.write(key, existing + line + '\n');
  }

  beginTxn(): QdrantTransaction {
    return new QdrantTransaction(this);
  }

  /** Upsert a vector with metadata for semantic search. */
  async upsertVector(
    id: string,
    vector: number[],
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    await this._assertReady();
    await this.client.upsert(this.options.collectionName, {
      points: [{
        id,
        vector,
        payload,
      }],
    });
  }

  /** Batch upsert multiple vectors. */
  async upsertVectors(
    points: Array<{ id: string; vector: number[]; payload?: Record<string, unknown> }>
  ): Promise<void> {
    await this._assertReady();
    await this.client.upsert(this.options.collectionName, {
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload ?? {},
      })),
    });
  }

  /** Search for nearest vectors by cosine similarity. */
  async searchVectors(
    vector: number[],
    options: { topK?: number; filter?: Record<string, unknown>; scoreThreshold?: number } = {}
  ): Promise<QdrantPoint[]> {
    await this._assertReady();
    const result = await this.client.search(this.options.collectionName, {
      vector,
      limit: options.topK ?? 10,
      score_threshold: options.scoreThreshold,
      filter: options.filter,
      with_payload: true,
    });
    return result.map((p: any) => ({
      id: p.id,
      vector: p.vector ?? [],
      payload: p.payload ?? {},
      score: p.score,
    }));
  }

  /** Delete all points in the collection. */
  async clear(): Promise<void> {
    await this._assertReady();
    await this.client.delete(this.options.collectionName, {
      filter: {},
    });
  }

  /** Get collection info. */
  async info(): Promise<{ pointsCount: number; vectorSize: number }> {
    await this._assertReady();
    const info = await this.client.getCollection(this.options.collectionName);
    return {
      pointsCount: info.points_count ?? 0,
      vectorSize: info.config?.params?.vectors?.size ?? this.options.vectorSize,
    };
  }

  /** Close the Qdrant connection. */
  async close(): Promise<void> {
    this.client = null;
  }
}

class QdrantTransaction implements StorageTransaction {
  private ops: Array<{ type: 'write' | 'delete'; key: string; value?: any }> = [];
  private committed = false;
  private rolledBack = false;

  constructor(private backend: QdrantBackend) {}

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
