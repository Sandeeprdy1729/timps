// ── @timps/memory-core — native.ts ──
// Try to load the pre-built @timps/memory-core-rs native addon.
// Returns null transparently when the addon is not available (e.g. CI, first-run).
// All callers must handle null and fall back to the TypeScript implementation.
// Phase 4d: extended with batch similarity, LSH, k-means, eigenmode compute.

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _req: (id: string) => any = typeof require !== 'undefined' ? require : (() => { throw new Error('require not available'); });

export interface NativeCore {
  // Existing functions (Phase 2c-4a)
  projectHash(path: string): string;
  loadSemantic(dir: string): string;
  saveSemantic(dir: string, json: string): void;
  loadEpisodes(dir: string, count: number): string;
  appendEpisode(dir: string, json: string): void;
  loadWorking(dir: string): string;
  saveWorking(dir: string, json: string): void;
  jaccardSimilarity(a: string, b: string): number;
  searchEntries(entriesJson: string, query: string, limit: number): string;

  // Phase 4d: batch cosine similarity (accepts JS Array<number>, returns Float64Array)
  computeBatchSimilarity(vectors: number[], query: number[], count: number, dims: number): Float64Array;

  // Phase 4d: k-means clustering (accepts JS Array<number>, returns Int32Array)
  kmeansClusterFlat(embeddings: number[], count: number, dims: number, k: number, max_iter?: number): Int32Array;

  // Phase 4d: eigenmode warm-start power iteration
  // Returns JSON string with { values: number[], vectors: number[] }
  eigenmodeWarmStart(
    n: number, iIndices: number[], jIndices: number[], values: number[],
    k: number, cachedValues?: number[], cachedVectors?: number[],
    cachedN?: number, maxIter?: number,
  ): string;

  // Phase 4d: RustLSH class constructor
  RustLsh: new () => RustLSHNative;
}

export interface RustLSHNative {
  insert(id: string, content: string): void;
  query(content: string, maxResults?: number): string[];
  delete(id: string): void;
  size(): number;
  clear(): void;
  getAll(): string[];
}

// Singleton — resolved once on first call
let _native: NativeCore | null | undefined;

/**
 * Returns the compiled Rust native addon, or null if not available.
 * Safe to call many times — result is cached after first resolution.
 */
export function getNative(): NativeCore | null {
  if (_native !== undefined) return _native;
  try {
    _native = _req('@timps/memory-core-rs') as NativeCore;
  } catch {
    _native = null;
  }
  return _native;
}

/** True when the Rust native addon is loaded and ready. */
export function isNativeAvailable(): boolean {
  return getNative() !== null;
}

// ── Phase 4d: RustLSH factory ──

/**
 * Creates a Rust-native LSH instance, or null if the addon is unavailable.
 * Consumers should fall back to the TypeScript LSHIndex from computation/LSHIndex.ts.
 */
export function createRustLSH(): RustLSHNative | null {
  const n = getNative();
  if (n && typeof n.RustLsh === 'function') {
    return new n.RustLsh();
  }
  return null;
}

// ── Phase 4d: Wrapper helpers ──

/**
 * Batch cosine similarity with Rust native fast-path.
 * When native addon is not available, returns null (caller must handle fallback).
 */
export function nativeBatchSimilarity(
  vectors: Float64Array | number[],
  query: Float64Array | number[],
  count: number,
  dims: number,
): Float64Array | null {
  const n = getNative();
  if (!n || !n.computeBatchSimilarity) return null;
  // NAPI-RS Vec<f64> accepts JS Array<number>
  const vArr: number[] = vectors instanceof Float64Array ? Array.from(vectors) : vectors;
  const qArr: number[] = query instanceof Float64Array ? Array.from(query) : query;
  return n.computeBatchSimilarity(vArr, qArr, count, dims);
}

/**
 * K-means clustering with Rust native fast-path.
 * Returns null when native addon is unavailable.
 */
export function nativeKMeans(
  embeddings: Float64Array | number[],
  count: number,
  dims: number,
  k: number,
  maxIter?: number,
): Int32Array | null {
  const n = getNative();
  if (!n || !n.kmeansClusterFlat) return null;
  // NAPI-RS Vec<f64> accepts JS Array<number>, not Float64Array
  const flatArray: number[] = embeddings instanceof Float64Array
    ? Array.from(embeddings)
    : embeddings;
  return n.kmeansClusterFlat(flatArray, count, dims, k, maxIter);
}

/**
 * Eigenmode warm-start with Rust native fast-path.
 * Returns JSON string `{values:[], vectors:[]}` or null.
 */
export function nativeEigenmodeWarmStart(
  n: number,
  iIndices: number[],
  jIndices: number[],
  values: number[],
  k: number,
  cachedValues?: number[],
  cachedVectors?: number[],
  cachedN?: number,
  maxIter?: number,
): string | null {
  const native = getNative();
  if (!native || !native.eigenmodeWarmStart) return null;
  return native.eigenmodeWarmStart(n, iIndices, jIndices, values, k, cachedValues, cachedVectors, cachedN, maxIter);
}
