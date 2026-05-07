// ── @timps/memory-core — BM25 Search via MiniSearch ──
// Wraps MiniSearch to provide keyword-based recall over MemoryEntry[]
// Uses native Rust fast-path when @timps/memory-core-rs addon is available.

import MiniSearch from 'minisearch';
import type { MemoryEntry, SearchOptions } from './types.js';
import { getNative } from './native.js';

export function buildIndex(entries: MemoryEntry[]): MiniSearch<MemoryEntry> {
  const index = new MiniSearch<MemoryEntry>({
    fields: ['content', 'type', 'tags'],
    storeFields: ['id', 'timestamp', 'type', 'content', 'tags'],
    tokenize: text => text.toLowerCase().split(/[\s\-_.,;:!?()[\]{}'"]+/).filter(t => t.length > 1),
    processTerm: term => term.length > 30 ? null : term,
  });
  index.addAll(entries);
  return index;
}

export function searchEntries(entries: MemoryEntry[], query: string, options: SearchOptions = {}): MemoryEntry[] {
  const { limit = 10, type, tags, since } = options;

  // Pre-filter (TS-side — native handles the scoring only)
  let pool = entries;
  if (type) pool = pool.filter(e => e.type === type);
  if (since) pool = pool.filter(e => e.timestamp >= since);
  if (tags && tags.length > 0) pool = pool.filter(e => tags.some(t => e.tags.includes(t)));

  if (!query.trim()) {
    return pool.slice(-limit).reverse();
  }

  // Native fast-path: Rust scores and ranks the filtered pool.
  // Only beneficial for larger pools (>50 entries) where scoring speedup
  // outweighs the JSON marshal/unmarshal overhead of the NAPI boundary.
  const n = getNative();
  if (n && pool.length > 50) {
    return JSON.parse(n.searchEntries(JSON.stringify(pool), query, limit)) as MemoryEntry[];
  }

  // TypeScript fallback via MiniSearch
  const index = buildIndex(pool);
  const results = index.search(query, { boost: { content: 2 }, fuzzy: 0.2, prefix: true });

  return results.slice(0, limit).map(r => {
    const entry = pool.find(e => e.id === r.id)!;
    return { ...entry, score: r.score };
  });
}

/** Simple keyword scoring without building a full index (for small sets) */
export function keywordScore(content: string, query: string): number {
  if (!query.trim()) return 0;
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return 0;
  const lower = content.toLowerCase();
  const hits = words.filter(w => lower.includes(w)).length;
  return hits / words.length;
}
