// ── @timps/memory-core — native.ts ──
// Try to load the pre-built @timps/memory-core-rs native addon.
// Returns null transparently when the addon is not available (e.g. CI, first-run).
// All callers must handle null and fall back to the TypeScript implementation.

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _req: (id: string) => any = typeof require !== 'undefined' ? require : (() => { throw new Error('require not available'); });

export interface NativeCore {
  projectHash(path: string): string;
  loadSemantic(dir: string): string;
  saveSemantic(dir: string, json: string): void;
  loadEpisodes(dir: string, count: number): string;
  appendEpisode(dir: string, json: string): void;
  loadWorking(dir: string): string;
  saveWorking(dir: string, json: string): void;
  jaccardSimilarity(a: string, b: string): number;
  searchEntries(entriesJson: string, query: string, limit: number): string;
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
