/**
 * Locality-Sensitive Hashing for fast approximate similarity search.
 *
 * Uses random projection LSH: each content string is hashed into a sparse
 * embedding vector (TF-IDF style), then projected onto k random hyperplanes
 * to produce a k-bit signature. Items with the same signature (or Hamming-closer
 * signatures) are likely similar, enabling O(1) bucket lookup instead of O(N) scan.
 *
 * Deterministic: seeded random projections, no Math.random() at runtime.
 */

const EMBED_DIM = 64;
const NUM_HASH_TABLES = 4;
const NUM_BITS = 8;

function murmurhash(str: string): number {
  let h = 0xdeadbeef;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x9e3779b9);
    h ^= h >>> 16;
  }
  return Math.abs(h);
}

function embed(text: string): Record<number, number> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
  if (tokens.length === 0) return {};
  const tf: Record<number, number> = {};
  for (const tok of tokens) {
    const d = murmurhash(tok) % EMBED_DIM;
    tf[d] = (tf[d] ?? 0) + 1;
  }
  for (const k of Object.keys(tf)) tf[Number(k)] /= tokens.length;
  const norm = Math.sqrt(Object.values(tf).reduce((s, v) => s + v * v, 0));
  if (norm > 0) for (const k of Object.keys(tf)) tf[Number(k)] /= norm;
  return tf;
}

/**
 * LSH index for fast approximate nearest-neighbor lookup.
 * Non-generic — stores string IDs keyed by content.
 */
export class LSHIndex {
  private numTables: number;
  private numBits: number;
  /** Random projection vectors: tables × bits × dim */
  private projections: number[][][];
  /** table_index → bucket_key → item_ids[] */
  private buckets: Map<number, Map<string, string[]>> = new Map();
  /** item_id → content text (for re-indexing) */
  private items: Map<string, string> = new Map();

  constructor(numTables = NUM_HASH_TABLES, numBits = NUM_BITS) {
    this.numTables = numTables;
    this.numBits = numBits;
    this.projections = this._initProjections();
    for (let t = 0; t < numTables; t++) {
      this.buckets.set(t, new Map());
    }
  }

  private _initProjections(): number[][][] {
    const tables: number[][][] = [];
    for (let t = 0; t < this.numTables; t++) {
      const bits: number[][] = [];
      for (let b = 0; b < this.numBits; b++) {
        const vec: number[] = [];
        const seed = t * this.numBits + b + 1;
        for (let d = 0; d < EMBED_DIM; d++) {
          vec.push(Math.sin(seed * (d + 1) * 0.618033988749895) * 2 - 1);
        }
        bits.push(vec);
      }
      tables.push(bits);
    }
    return tables;
  }

  private _signature(embedding: Record<number, number>): number[] {
    const sigs: number[] = [];
    for (const bits of this.projections) {
      let sig = 0;
      for (let b = 0; b < bits.length; b++) {
        let dot = 0;
        for (const [dimStr, val] of Object.entries(embedding)) {
          const dim = Number(dimStr);
          dot += (bits[b][dim] ?? 0) * val;
        }
        if (dot > 0) sig |= (1 << b);
      }
      sigs.push(sig);
    }
    return sigs;
  }

  insert(id: string, content: string): void {
    this.items.set(id, content);
    const embedding = embed(content);
    const sigs = this._signature(embedding);
    for (let t = 0; t < sigs.length; t++) {
      const bucket = this.buckets.get(t)!;
      const key = String(sigs[t]);
      if (!bucket.has(key)) bucket.set(key, []);
      const ids = bucket.get(key)!;
      if (!ids.includes(id)) ids.push(id);
    }
  }

  delete(id: string): void {
    this.items.delete(id);
    for (const bucket of this.buckets.values()) {
      for (const [key, ids] of bucket) {
        const idx = ids.indexOf(id);
        if (idx >= 0) {
          ids.splice(idx, 1);
          if (ids.length === 0) bucket.delete(key);
        }
      }
    }
  }

  query(content: string, maxResults?: number): string[] {
    const embedding = embed(content);
    const sigs = this._signature(embedding);
    const seen = new Set<string>();
    const results: string[] = [];
    for (let t = 0; t < sigs.length; t++) {
      const bucket = this.buckets.get(t);
      if (!bucket) continue;
      const ids = bucket.get(String(sigs[t]));
      if (!ids) continue;
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        results.push(id);
        if (maxResults && results.length >= maxResults) break;
      }
      if (maxResults && results.length >= maxResults) break;
    }
    return results;
  }

  size(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
    for (const bucket of this.buckets.values()) {
      bucket.clear();
    }
  }

  getAll(): string[] {
    return Array.from(this.items.keys());
  }
}
