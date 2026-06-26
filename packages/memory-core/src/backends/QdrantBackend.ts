// ── @timps/memory-core — QdrantBackend ──
// Vector store backend with multi-tenant payload filtering.

import type { StorageBackend, StorageQuery, StorageRecord, StorageTransaction, OrgScope } from './types.js';

export interface QdrantBackendOptions {
  url?: string;
  apiKey?: string;
  collectionName?: string;
  vectorSize?: number;
  /** HNSW max connections per node (default 32 for 1M+ scale, 16 for smaller). */
  hnswM?: number;
  /** HNSW index build quality (default 128 for 1M+ scale, 100 for smaller). */
  hnswEfConstruct?: number;
  /** Start building HNSW index after this many points (default 50000). */
  indexingThreshold?: number;
  /** Enable on-disk vectors for memory efficiency at scale (default false). */
  onDisk?: boolean;
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
  private _sparseReady = false;
  private _activeScope: OrgScope | null = null;

  constructor(options: QdrantBackendOptions = {}) {
    this.options = {
      url: 'http://localhost:6333',
      apiKey: '',
      collectionName: 'timps_memory',
      vectorSize: 384,
      hnswM: 32,
      hnswEfConstruct: 128,
      indexingThreshold: 50000,
      onDisk: false,
      ...options,
    };
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

  /** Build Qdrant filter for org isolation */
  private _scopeFilter(scope: OrgScope | null): Record<string, unknown> | undefined {
    if (!scope) return undefined;
    const must: Record<string, unknown>[] = [
      { key: 'org_id', match: { value: scope.orgId } },
      { key: 'project_id', match: { value: scope.projectId } },
    ];
    if (scope.teamId) {
      must.push({ key: 'team_id', match: { value: scope.teamId } });
    }
    return { must };
  }

  /** Add scope fields to payload */
  private _enrichPayload(payload: Record<string, unknown>, scope: OrgScope | null): Record<string, unknown> {
    if (!scope) return payload;
    return {
      ...payload,
      org_id: scope.orgId,
      team_id: scope.teamId ?? '',
      project_id: scope.projectId,
    };
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
          on_disk: this.options.onDisk,
        },
        sparse_vectors: {
          bm25: {
            index: {
              full_scan_threshold: 10000,
            },
          },
        },
        optimizers_config: {
          indexing_threshold: this.options.indexingThreshold,
        },
        hnsw_config: {
          m: this.options.hnswM,
          ef_construct: this.options.hnswEfConstruct,
          full_scan_threshold: 10000,
          on_disk: this.options.onDisk,
        },
      });
    } else {
      await this._updateCollectionConfig();
    }
    this._initialized = true;
    this._sparseReady = true;
  }

  private async _updateCollectionConfig(): Promise<void> {
    try {
      const info = await this.client.getCollection(this.options.collectionName);
      const config = info.config as any;
      const hasSparse = config?.params?.sparse_vectors?.bm25 !== undefined;
      if (!hasSparse) {
        // Qdrant doesn't support adding sparse vectors to existing collections via API yet
        // Users must recreate the collection for sparse support
      }
    } catch {
      // Best-effort
    }
  }

  private async _assertReady(): Promise<void> {
    await this.ready;
  }

  // ── StorageBackend interface ──

  async read(key: string, scope?: OrgScope): Promise<any> {
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

  async write(key: string, value: any, scope?: OrgScope): Promise<void> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const payload = this._enrichPayload({ __data: value }, effectiveScope);
    await this.client.upsert(this.options.collectionName, {
      points: [{
        id: key,
        vector: new Array(this.options.vectorSize).fill(0),
        payload,
      }],
    });
  }

  async delete(key: string, _scope?: OrgScope): Promise<void> {
    await this._assertReady();
    await this.client.delete(this.options.collectionName, {
      points: [key],
    });
  }

  async list(prefix?: string, _scope?: OrgScope): Promise<string[]> {
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

  async exists(key: string, _scope?: OrgScope): Promise<boolean> {
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

  async append(key: string, line: string, scope?: OrgScope): Promise<void> {
    const existing = (await this.read(key, scope)) || '';
    await this.write(key, existing + line + '\n', scope);
  }

  beginTxn(): QdrantTransaction {
    return new QdrantTransaction(this);
  }

  // ── Vector-specific methods ──

  async upsertVector(
    id: string,
    vector: number[],
    payload: Record<string, unknown> = {},
    scope?: OrgScope,
  ): Promise<void> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const enrichedPayload = this._enrichPayload(payload, effectiveScope);
    await this.client.upsert(this.options.collectionName, {
      points: [{ id, vector, payload: enrichedPayload }],
    });
  }

  async upsertVectors(
    points: Array<{ id: string; vector: number[]; payload?: Record<string, unknown> }>,
    scope?: OrgScope,
  ): Promise<void> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    await this.client.upsert(this.options.collectionName, {
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: this._enrichPayload(p.payload ?? {}, effectiveScope),
      })),
    });
  }

  async searchVectors(
    vector: number[],
    options: { topK?: number; filter?: Record<string, unknown>; scoreThreshold?: number; scope?: OrgScope } = {}
  ): Promise<QdrantPoint[]> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(options.scope);
    const scopeFilter = this._scopeFilter(effectiveScope);

    const combinedFilter = scopeFilter && options.filter
      ? { must: [...(scopeFilter as any).must, options.filter] }
      : scopeFilter ?? options.filter;

    const result = await this.client.search(this.options.collectionName, {
      vector,
      limit: options.topK ?? 10,
      score_threshold: options.scoreThreshold,
      filter: combinedFilter,
      with_payload: true,
    });
    return result.map((p: any) => ({
      id: p.id,
      vector: p.vector ?? [],
      payload: p.payload ?? {},
      score: p.score,
    }));
  }

  /**
   * Hybrid search combining dense vector + sparse BM25 vectors.
   * Qdrant natively scores both and returns fused results.
   */
  async hybridSearch(
    queryText: string,
    options: { topK?: number; filter?: Record<string, unknown>; scoreThreshold?: number; scope?: OrgScope; denseVector?: number[] } = {},
  ): Promise<QdrantPoint[]> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(options.scope);
    const scopeFilter = this._scopeFilter(effectiveScope);

    const combinedFilter = scopeFilter && options.filter
      ? { must: [...(scopeFilter as any).must, options.filter] }
      : scopeFilter ?? options.filter;

    const sparseVector = this.textToSparseVector(queryText);
    const denseVector = options.denseVector ?? new Array(this.options.vectorSize).fill(0);

    const searchParams: Record<string, unknown> = {
      vector: denseVector,
      limit: options.topK ?? 10,
      score_threshold: options.scoreThreshold,
      filter: combinedFilter,
      with_payload: true,
    };

    if (this._sparseReady) {
      searchParams.sparse_vector = sparseVector;
    }

    const result = await this.client.search(this.options.collectionName, searchParams);
    return result.map((p: any) => ({
      id: p.id,
      vector: p.vector ?? [],
      payload: p.payload ?? {},
      score: p.score,
    }));
  }

  /**
   * Upsert a point with both dense vector and optional sparse vector.
   */
  async upsertWithSparseVector(
    id: string,
    vector: number[],
    text: string,
    payload: Record<string, unknown> = {},
    scope?: OrgScope,
  ): Promise<void> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const enrichedPayload = this._enrichPayload(payload, effectiveScope);
    const sparseVector = this.textToSparseVector(text);

    const point: Record<string, unknown> = { id, vector, payload: enrichedPayload };
    if (this._sparseReady) {
      point.sparse_vector = sparseVector;
    }
    await this.client.upsert(this.options.collectionName, {
      points: [point],
    });
  }

  /**
   * Batch upsert with sparse vectors.
   */
  async upsertVectorsWithSparse(
    points: Array<{ id: string; vector: number[]; text: string; payload?: Record<string, unknown> }>,
    scope?: OrgScope,
  ): Promise<void> {
    await this._assertReady();
    const effectiveScope = this._resolveScope(scope);
    const qdrantPoints = points.map(p => {
      const point: Record<string, unknown> = {
        id: p.id,
        vector: p.vector,
        payload: this._enrichPayload(p.payload ?? {}, effectiveScope),
      };
      if (this._sparseReady) {
        point.sparse_vector = this.textToSparseVector(p.text);
      }
      return point;
    });
    await this.client.upsert(this.options.collectionName, { points: qdrantPoints });
  }

  /**
   * Convert text to a sparse vector for BM25-style search.
   * Uses simple TF-based term extraction with stopword filtering.
   */
  textToSparseVector(text: string): { indices: number[]; values: number[] } {
    const stopwords = new Set([
      'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and',
      'or', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'shall', 'can', 'need',
      'this', 'that', 'these', 'those', 'i', 'it', 'its', 'we',
      'you', 'they', 'he', 'she', 'not', 'no', 'but', 'so', 'if',
      'as', 'with', 'by', 'from', 'into', 'about', 'like', 'just',
    ]);

    const words = text.toLowerCase().split(/[\s\-_.,;:!?()[\]{}'"]+/).filter(w => w.length > 1 && !stopwords.has(w));
    const freq = new Map<number, number>();
    // Simple hash to indices (0-65535 range for Qdrant sparse vectors)
    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
      }
      const idx = Math.abs(hash) % 65536;
      freq.set(idx, (freq.get(idx) ?? 0) + 1);
    }

    const indices: number[] = [];
    const values: number[] = [];
    for (const [idx, count] of freq) {
      indices.push(idx);
      // Log-normalized TF
      values.push(1 + Math.log2(count));
    }

    return { indices, values };
  }

  async clear(): Promise<void> {
    await this._assertReady();
    await this.client.delete(this.options.collectionName, { filter: {} });
  }

  /**
   * Add a single embedding vector to the index.
   */
  async addEmbedding(
    id: string,
    vector: number[],
    text: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    return this.upsertWithSparseVector(id, vector, text, payload);
  }

  /**
   * Add multiple embedding vectors in batch.
   */
  async addEmbeddings(
    items: Array<{ id: string; vector: number[]; text: string; payload?: Record<string, unknown> }>,
  ): Promise<void> {
    return this.upsertVectorsWithSparse(items);
  }

  async info(): Promise<{ pointsCount: number; vectorSize: number }> {
    await this._assertReady();
    const info = await this.client.getCollection(this.options.collectionName);
    return {
      pointsCount: info.points_count ?? 0,
      vectorSize: info.config?.params?.vectors?.size ?? this.options.vectorSize,
    };
  }

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
