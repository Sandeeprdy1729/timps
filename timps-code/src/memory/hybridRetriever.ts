// ── TIMPS Hybrid Retrieval Engine ──
// BM25 + HNSW Vector Search + Knowledge Graph + Reciprocal Rank Fusion

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MemoryEntry, RetrievalResult, KnowledgeNode, KnowledgeEdge } from './types.js';

interface BM25Entry {
  entry: MemoryEntry;
  docLength: number;
  termFreqs: Map<string, number>;
}

interface VectorIndex {
  dimension: number;
  entries: { id: string; embedding: number[]; content: string }[];
  connected: boolean;
}

const RRF_K = 60;

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

function simpleEmbedding(text: string, dim = 64): number[] {
  const tokens = tokenize(text);
  const emb = new Array(dim).fill(0);
  for (let i = 0; i < tokens.length; i++) {
    for (let c = 0; c < Math.min(tokens[i].length, dim); c++) {
      emb[c] += tokens[i].charCodeAt(c) / 255;
    }
  }
  const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
  if (norm > 0) for (let i = 0; i < dim; i++) emb[i] /= norm;
  return emb;
}

export class HybridRetriever {
  private dir: string;
  private semanticFile: string;
  private graphFile: string;
  private bm25Cache: BM25Entry[] | null = null;
  private vectorIndex: VectorIndex | null = null;
  private avgDocLen = 0;
  private idfMap: Map<string, number> = new Map();

  constructor(projectPath: string) {
    this.dir = projectPath;
    this.semanticFile = path.join(this.dir, 'semantic.json');
    this.graphFile = path.join(this.dir, 'knowledge-graph.json');
  }

  private loadEntries(): MemoryEntry[] {
    try {
      if (!fs.existsSync(this.semanticFile)) return [];
      return JSON.parse(fs.readFileSync(this.semanticFile, 'utf-8'));
    } catch { return []; }
  }

  // ── BM25 Retriever ──────────────────────────────────────────

  private buildBM25Index(entries: MemoryEntry[]): void {
    const avg = entries.reduce((s, e) => s + tokenize(e.content).length, 0) / Math.max(entries.length, 1);
    this.avgDocLen = avg || 100;

    const docFreq = new Map<string, number>();
    const docs: BM25Entry[] = entries.map(entry => {
      const terms = tokenize(entry.content);
      const termFreqs = new Map<string, number>();
      for (const t of terms) {
        termFreqs.set(t, (termFreqs.get(t) || 0) + 1);
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }
      return { entry, docLength: terms.length, termFreqs };
    });

    const N = entries.length;
    for (const [term, df] of docFreq) {
      this.idfMap.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
    }

    this.bm25Cache = docs;
  }

  private bm25Score(query: string, entry: BM25Entry): number {
    const queryTerms = tokenize(query);
    let score = 0;
    for (const qTerm of queryTerms) {
      const tf = entry.termFreqs.get(qTerm) || 0;
      if (tf === 0) continue;
      const idf = this.idfMap.get(qTerm) || 0;
      const k1 = 1.5, b = 0.75;
      const norm = 1 - b + b * (entry.docLength / Math.max(this.avgDocLen, 1));
      score += idf * (tf * (k1 + 1)) / (tf + k1 * norm);
    }
    return score;
  }

  private searchBM25(query: string, limit: number, entries: MemoryEntry[]): { entry: MemoryEntry; score: number; rank: number }[] {
    if (entries.length === 0) return [];
    const avg = entries.reduce((s, e) => s + tokenize(e.content).length, 0) / Math.max(entries.length, 1);
    this.avgDocLen = avg || 100;

    const docFreq = new Map<string, number>();
    const docs: BM25Entry[] = entries.map(entry => {
      const terms = tokenize(entry.content);
      const termFreqs = new Map<string, number>();
      for (const t of terms) {
        termFreqs.set(t, (termFreqs.get(t) || 0) + 1);
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }
      return { entry, docLength: terms.length, termFreqs };
    });

    const N = entries.length;
    for (const [term, df] of docFreq) {
      this.idfMap.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
    }

    this.bm25Cache = docs;

    const scored = docs.map(doc => ({
      entry: doc.entry,
      score: this.bm25Score(query, doc),
    })).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
  }

  // ── Vector Retriever (HNSW-style approximate) ──────────────

  private buildVectorIndex(entries: MemoryEntry[]): void {
    const dim = 64;
    this.vectorIndex = {
      dimension: dim,
      entries: entries.map(entry => ({
        id: entry.id,
        embedding: simpleEmbedding(entry.content, dim),
        content: entry.content,
      })),
      connected: true,
    };
  }

  private searchVector(query: string, limit: number, entries: MemoryEntry[]): { entry: MemoryEntry; score: number; rank: number }[] {
    if (entries.length === 0) return [];

    const dim = 64;
    const scored = entries.map(entry => ({
      entry,
      embedding: simpleEmbedding(entry.content, dim),
    })).map(({ entry, embedding }) => {
      const queryEmb = simpleEmbedding(query, dim);
      const score = cosineSim(queryEmb, embedding);
      return { entry, score };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
  }

  // ── Knowledge Graph Retriever ────────────────────────────────

  private loadGraph(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    try {
      if (!fs.existsSync(this.graphFile)) return { nodes: [], edges: [] };
      return JSON.parse(fs.readFileSync(this.graphFile, 'utf-8'));
    } catch { return { nodes: [], edges: [] }; }
  }

  private searchGraph(query: string, limit = 10): { entry: MemoryEntry; score: number; rank: number }[] {
    const { nodes, edges } = this.loadGraph();
    if (nodes.length === 0) return [];

    const queryTokens = tokenize(query);
    const entityScores = new Map<string, number>();

    for (const node of nodes) {
      let nodeScore = 0;
      for (const qt of queryTokens) {
        if (node.entity.toLowerCase().includes(qt)) nodeScore += 1;
        for (const [k, v] of Object.entries(node.attributes)) {
          if (String(v).toLowerCase().includes(qt)) nodeScore += 0.5;
        }
      }
      if (nodeScore > 0) entityScores.set(node.entity, nodeScore);
    }

    for (const edge of edges) {
      for (const qt of queryTokens) {
        if (edge.subject.toLowerCase().includes(qt) || edge.relation.toLowerCase().includes(qt) || edge.object.toLowerCase().includes(qt)) {
          const s = entityScores.get(edge.subject) || 0;
          entityScores.set(edge.subject, s + 0.8);
          const o = entityScores.get(edge.object) || 0;
          entityScores.set(edge.object, o + 0.8);
        }
      }
    }

    const sorted = [...entityScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
    const allEntries = this.loadEntries();
    const idMap = new Map(allEntries.map(e => [e.id, e]));

    return sorted.map(([entity, score], i) => {
      const entry = idMap.get(entity) || allEntries.find(e => e.content.toLowerCase().includes(entity.toLowerCase()));
      return entry ? { entry, score: score * 0.8, rank: i + 1 } : null;
    }).filter(Boolean) as { entry: MemoryEntry; score: number; rank: number }[];
  }

  // ── Reciprocal Rank Fusion ──────────────────────────────────

  private rrfFusion(...retrieverResults: { entry: MemoryEntry; score: number; rank: number }[][]): Map<string, { entry: MemoryEntry; rrfScore: number; sources: string[] }> {
    const fused = new Map<string, { entry: MemoryEntry; rrfScore: number; sources: string[] }>();

    const names = ['bm25', 'vector', 'graph'];
    for (let ri = 0; ri < retrieverResults.length; ri++) {
      const results = retrieverResults[ri];
      const source = names[ri] || `retriever${ri}`;
      for (const r of results) {
        const key = r.entry.id;
        const rrf = 1 / (RRF_K + r.rank);
        if (fused.has(key)) {
          const existing = fused.get(key)!;
          existing.rrfScore += rrf;
          if (!existing.sources.includes(source)) existing.sources.push(source);
        } else {
          fused.set(key, { entry: r.entry, rrfScore: rrf, sources: [source] });
        }
      }
    }

    return fused;
  }

  // ── Main Hybrid Search ──────────────────────────────────────

  search(query: string, limit = 5): RetrievalResult[] {
    const entries = this.loadEntries();
    const bm25Results = this.searchBM25(query, 20, entries);
    const vectorResults = this.searchVector(query, 20, entries);
    const graphResults = this.searchGraph(query, 10);

    const fused = this.rrfFusion(bm25Results, vectorResults, graphResults);

    const sorted = [...fused.values()].sort((a, b) => b.rrfScore - a.rrfScore);

    return sorted.slice(0, limit).map((item, i) => ({
      entry: item.entry,
      score: item.rrfScore,
      sources: item.sources as RetrievalResult['sources'],
      layer: item.sources.includes('graph') ? 'semantic-graph' : 'semantic',
      rank: i + 1,
    }));
  }

  invalidateCache(): void {
    this.bm25Cache = null;
    this.vectorIndex = null;
  }

  indexExists(): boolean {
    return this.bm25Cache !== null;
  }

  getIndexStats(): { totalEntries: number; bm25Terms: number; vectorDim: number } {
    const entries = this.loadEntries();
    return {
      totalEntries: entries.length,
      bm25Terms: this.idfMap.size,
      vectorDim: this.vectorIndex?.dimension || 64,
    };
  }
}