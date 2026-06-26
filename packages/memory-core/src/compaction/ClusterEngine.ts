// ── @timps/memory-core — Phase 4c/4d: ClusterEngine ──
// Embedding-based k-means clustering for grouping related memories.
// Falls back to layer + first-tag grouping when embeddings are unavailable.
// Phase 4d: uses Rust native k-means when available (10-50× faster).

import { nativeKMeans } from '../native.js';
import type { ClassifiedMemory } from './types.js';

export interface MemoryCluster {
  id: string;
  centroid: number[];
  members: ClassifiedMemory[];
  label: string;
}

export interface ClusterOptions {
  minClusterSize: number;
  maxClusterSize: number;
  embedDim: number;
  clusterCount: number;
}

export class ClusterEngine {
  private options: ClusterOptions;

  constructor(options: ClusterOptions) {
    this.options = options;
  }

  /**
   * Cluster memories using k-means on embeddings.
   * Falls back to layer + tag grouping when embeddings are missing.
   */
  cluster(memories: ClassifiedMemory[]): MemoryCluster[] {
    const withEmbeddings = memories.filter(m => m.embedding && m.embedding.length > 0);
    if (withEmbeddings.length >= this.options.minClusterSize) {
      return this._kMeansCluster(withEmbeddings);
    }
    return this._fallbackCluster(memories);
  }

  /** k-means clustering on embedding vectors. Uses Rust native when available. */
  private _kMeansCluster(memories: ClassifiedMemory[]): MemoryCluster[] {
    const k = this.options.clusterCount > 0
      ? Math.min(this.options.clusterCount, memories.length)
      : Math.max(1, Math.round(Math.sqrt(memories.length / 2)));

    const dim = this.options.embedDim;
    let assignments: number[];

    // Phase 4d: Rust native fast-path
    const nativeResult = nativeKMeans(
      memories.flatMap(m => m.embedding!.slice(0, dim)),
      memories.length,
      dim,
      k,
      20,
    );
    if (nativeResult) {
      assignments = Array.from(nativeResult);
    } else {
      // TS fallback: k-means++ with deterministic golden-ratio seeding
      const maxIter = 20;
      const centroids: number[][] = [];

      const seed = (offset: number, i: number): number =>
        Math.sin((offset + 1) * (i + 1) * 0.618033988749895) * 2 - 1;

      // First centroid: perturb first vector
      const f0 = memories[0].embedding!.slice(0, dim);
      centroids.push(f0.map((v, j) => v + seed(0, j) * 0.01));

      // Remaining: distance-squared weighting
      for (let c = 1; c < k; c++) {
        const distSqs = memories.map((m, i) => {
          if (c <= i) return 0;
          const emb = m.embedding!.slice(0, dim);
          return Math.min(...centroids.map(cen => 1 - this._cosineDist(emb, cen)));
        });
        const total = distSqs.reduce((a, b) => a + b * b, 0);
        if (total === 0) {
          for (let r = c; r < k; r++) {
            const base = memories[r % memories.length].embedding!.slice(0, dim);
            centroids.push(base.map((v, j) => v + seed(r as number, j) * 0.01));
          }
          break;
        }
        let r = Math.abs(seed(c, 0)) / 2 + 0.5;
        r *= total;
        let cumulative = 0;
        let pick = memories.length - 1;
        for (let i = 0; i < distSqs.length; i++) {
          cumulative += distSqs[i] * distSqs[i];
          if (r <= cumulative) { pick = i; break; }
        }
        const v = memories[pick].embedding!.slice(0, dim);
        centroids.push(v.map((val, j) => val + seed(c + 1000, j) * 0.001));
      }

      assignments = new Array(memories.length).fill(0);
      for (let iter = 0; iter < maxIter; iter++) {
        let changed = false;
        for (let i = 0; i < memories.length; i++) {
          const emb = memories[i].embedding!.slice(0, dim);
          let bestDist = Infinity;
          let bestC = 0;
          for (let c = 0; c < centroids.length; c++) {
            const d = this._cosineDist(emb, centroids[c]);
            if (d < bestDist) { bestDist = d; bestC = c; }
          }
          if (assignments[i] !== bestC) changed = true;
          assignments[i] = bestC;
        }
        if (!changed) break;
        for (let c = 0; c < centroids.length; c++) {
          const members = memories.filter((_, i) => assignments[i] === c);
          if (members.length === 0) continue;
          const newCentroid = new Array(dim).fill(0);
          for (const m of members) {
            const emb = m.embedding!.slice(0, dim);
            for (let d = 0; d < dim; d++) newCentroid[d] += emb[d];
          }
          const len = Math.sqrt(newCentroid.reduce((s, v) => s + v * v, 0));
          if (len > 0) for (let d = 0; d < dim; d++) newCentroid[d] /= len;
          centroids[c] = newCentroid;
        }
      }
    }

    // Build clusters
    const clusterMap = new Map<number, ClassifiedMemory[]>();
    for (let i = 0; i < memories.length; i++) {
      const c = assignments[i];
      if (!clusterMap.has(c)) clusterMap.set(c, []);
      clusterMap.get(c)!.push(memories[i]);
    }

    return Array.from(clusterMap.entries())
      .filter(([_, members]) => members.length >= this.options.minClusterSize)
      .map(([cIdx, members]) => ({
        id: `cluster_${cIdx}`,
        centroid: [],
        members: members.slice(0, this.options.maxClusterSize),
        label: this._deriveLabel(members),
      }));
  }

  /** Fallback: group by layer + first tag. */
  private _fallbackCluster(memories: ClassifiedMemory[]): MemoryCluster[] {
    const groups = new Map<string, ClassifiedMemory[]>();
    for (const m of memories) {
      const key = `${m.layer}:${m.tags[0] ?? 'untagged'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }

    return Array.from(groups.entries())
      .filter(([_, members]) => members.length >= this.options.minClusterSize)
      .map(([key, members]) => ({
        id: `cluster_${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
        centroid: [],
        members: members.slice(0, this.options.maxClusterSize),
        label: key,
      }));
  }

  /** Cosine distance between two vectors. */
  private _cosineDist(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    if (denom === 0) return 1;
    return 1 - dot / denom;
  }

  /** Derive a human-readable label from cluster members. */
  private _deriveLabel(members: ClassifiedMemory[]): string {
    const tagCounts = new Map<string, number>();
    for (const m of members) {
      for (const t of m.tags) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
    const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const typeCounts = new Map<string, number>();
    for (const m of members) {
      typeCounts.set(m.type, (typeCounts.get(m.type) ?? 0) + 1);
    }
    const topType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return topTag ? `${topType ?? 'memory'} (${topTag})` : `${topType ?? 'memory'} cluster`;
  }
}
