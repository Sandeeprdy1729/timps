import type { MemoryEntry, SearchOptions } from '../types.js';
import { searchEntries } from '../search.js';
import type { QdrantBackend, QdrantPoint } from '../backends/QdrantBackend.js';
import { rrfFuseWithNames } from './rrf.js';

export interface HybridSearchOptions extends SearchOptions {
  useQdrant?: boolean;
  useKnowledgeGraph?: boolean;
  denseWeight?: number;
}

export interface QdrantAvailability {
  available: boolean;
  pointsCount: number;
}

export function shouldUseMiniSearch(entryCount: number): boolean {
  return entryCount < 1000;
}

export async function hybridRecall(
  entries: MemoryEntry[],
  query: string,
  options: HybridSearchOptions,
  qdrantBackend?: QdrantBackend,
): Promise<MemoryEntry[]> {
  const limit = options.limit ?? 10;
  const useMini = shouldUseMiniSearch(entries.length);
  const useQdrant = options.useQdrant !== false && !!qdrantBackend && !useMini;
  const useKG = options.useKnowledgeGraph !== false;

  const lists: Array<{ name: string; entries: MemoryEntry[] }> = [];

  // Stage 1a: BM25 via MiniSearch (always available)
  const bm25Results = searchEntries(entries, query, { ...options, limit: 50 });
  lists.push({ name: 'bm25', entries: bm25Results });

  // Stage 1b: Qdrant hybrid search (dense + sparse) when available
  if (useQdrant && qdrantBackend) {
    try {
      const qdrantResults = await qdrantBackend.hybridSearch(query, {
        topK: limit * 2,
        scoreThreshold: 0.5,
      }) as any as QdrantPoint[];
      const qdrantEntries: MemoryEntry[] = [];
      for (const p of qdrantResults) {
        const payload = p.payload as Record<string, unknown>;
        const entry = entries.find(e => e.id === payload.__id);
        if (entry) {
          qdrantEntries.push({ ...entry, score: p.score ?? 0.5 });
        }
      }
      if (qdrantEntries.length > 0) {
        lists.push({ name: 'qdrant', entries: qdrantEntries });
      }
    } catch {
      // Qdrant unavailable — degrade gracefully
    }
  }

  // Stage 1c: Knowledge graph expansion via shared tags
  if (useKG && bm25Results.length > 0) {
    const connectedIds = new Set<string>();
    const topIds = new Set(bm25Results.slice(0, 10).map(e => e.id));
    for (const entry of entries) {
      if (topIds.has(entry.id)) {
        for (const other of entries) {
          if (other.id === entry.id) continue;
          if (connectedIds.has(other.id)) continue;
          const sharedTags = entry.tags.filter(t => other.tags.includes(t));
          if (sharedTags.length >= 2) {
            connectedIds.add(other.id);
          }
        }
      }
    }
    if (connectedIds.size > 0) {
      const kgEntries: MemoryEntry[] = [];
      for (const e of entries) {
        if (connectedIds.has(e.id)) {
          kgEntries.push({ ...e, score: 0.4 });
        }
      }
      lists.push({ name: 'knowledge_graph', entries: kgEntries });
    }
  }

  // Stage 1d: RRF fusion
  const fused = rrfFuseWithNames(lists);
  const scored: MemoryEntry[] = [];
  for (const f of fused.slice(0, limit)) {
    const entry = entries.find(e => e.id === f.id);
    if (entry) scored.push({ ...entry, score: f.score });
  }

  if (scored.length > 0) return scored;

  // Fallback to BM25
  return bm25Results.slice(0, limit);
}
