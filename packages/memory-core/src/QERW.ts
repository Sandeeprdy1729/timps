// ── @timps/memory-core — QuantumEcho Resonance Weaver (QERW) ──
// Layer 14: Echo propagation over a similarity graph with curvature estimates.
//
// Honest description (M58):
//   QERW is an incremental memory layer for the L14 slot. The public API is
//   unchanged; the internals are replaced with plain, well-understood
//   machinery:
//
//     • Embeddings     → deterministic feature-hash vectors (forgeEmbedding)
//     • Geodesic edges → k-nearest-neighbor graph by Fisher-Rao distance on
//                        the unit hypersphere
//     • Curvature      → triangle-inequality defect across a node's kNN
//                        triangles (a descriptive statistic, not a manifold
//                        theorem)
//     • Echo           → BFS signal propagation damped by edge weight
//     • Prediction     → trend over recent domain coherence, not sinusoids
//
//   No benchmark superiority is claimed. Big-O: weave O(N·d) for the kNN scan
//   (bounded by active node count), query O(N·d).

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { StorageBackend } from './backends/types.js';
import {
  featureHashEmbed,
  cosineSim,
  fisherRaoDist,
  domainCentroid,
  coherenceStats,
} from './forgeEmbedding.js';

// ── Types ─────────────────────────────────────────────────────────────────

export type QERWDomain =
  | "burnout" | "relationship" | "decision" | "code_pattern"
  | "contradiction" | "goal" | "general";

export interface QERWNode {
  id: string;
  content: string;
  domain: QERWDomain;
  /** Dense embedding on the manifold */
  embedding: number[];
  /** Sectional curvature at this node (triangle-inequality defect) */
  curvature: number;
  /** Accumulated echo decay along geodesic paths */
  echoDecay: number;
  /** Bi-temporal validity */
  validFrom: number;
  validTo: number | null;
  invalidAt: number | null;
  tags: string[];
  retrievalCount: number;
  createdAt: number;
}

export interface QERWEdge {
  fromId: string;
  toId: string;
  /** Fisher-Rao geodesic distance proxy */
  geodesicDist: number;
  weight: number;
  createdAt: number;
}

export interface QERWStore {
  nodes: Record<string, QERWNode>;
  edges: QERWEdge[];
}

export interface QERWWeaveResult {
  nodeId: string;
  content: string;
  domain: QERWDomain;
  curvature: number;
  geodesicDistances: Array<{ neighborId: string; dist: number }>;
}

export interface QERWContradictionResult {
  highCurvatureNodes: number;
  meanCurvature: number;
  maxCurvature: number;
  anomalyRegions: Array<{
    nodeId: string;
    curvature: number;
    domain: QERWDomain;
  }>;
  isConsistent: boolean;
  h1Proxy: number;
}

export interface QERWPrediction {
  domain: QERWDomain;
  riskScore: number;
  riskLevel: "high" | "medium" | "low";
  trajectory: number[];
  meanCurvature: number;
  explanation: string;
}

export interface QERWQueryResult {
  results: Array<{
    node: QERWNode;
    geodesicDistance: number;
    relevance: number;
  }>;
  totalCount: number;
}

export interface QERWConsolidationReport {
  pruned: number;
  retained: number;
  meanCurvature: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const EMBEDDING_DIM = 64;
const KNN = 10;                 // k nearest neighbors for geodesic graph
const CURVATURE_ANOMALY = 2.0;  // std-dev multiplier
const ECHO_DECAY = 0.05;
const QUENCH_THRESHOLD = 0.05;
const LOOKBACK_DAYS = 14;
const TRAJECTORY_STEPS = 12;

// ── Deterministic helpers ─────────────────────────────────────────────────

/**
 * Approximate sectional curvature from two consecutive geodesic steps:
 * triangle-inequality defect across a node's kNN neighborhood. In flat space
 * the sides of a geodesic triangle satisfy d3 ≈ d1 + d2; the fractional defect
 * is a descriptive statistic for how clustered a node's neighbors are.
 */
function approximateCurvature(prev: number[], curr: number[], next: number[]): number {
  const p = new Float64Array(prev);
  const c = new Float64Array(curr);
  const n = new Float64Array(next);
  const d1 = fisherRaoDist(p, c);
  const d2 = fisherRaoDist(c, n);
  const d3 = fisherRaoDist(p, n);

  if (d1 + d2 < 1e-10) return 0;
  const defect = (d1 + d2 - d3) / (d1 + d2);
  return Math.max(-1, Math.min(1, defect));
}

// ── QERW Class ────────────────────────────────────────────────────────────

export class QERW {
  private dir: string;
  private storeFile: string;
  private store: QERWStore;
  private _backend?: StorageBackend;
  private adjOut: Map<string, QERWEdge[]>;
  private adjIn: Map<string, QERWEdge[]>;
  /** Cache of embeddings for fast geodesic computation */
  private embCache: Map<string, Float64Array>;

  constructor(dir: string, backend?: StorageBackend) {
    this.dir = dir;
    this._backend = backend;
    this.storeFile = path.join(dir, "qerw-store.json");
    this.store = this.loadStore();
    this.adjOut = new Map();
    this.adjIn = new Map();
    this.embCache = new Map();
    this.rebuildAdjacency();
    this.warmCache();
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private loadStore(): QERWStore {
    if (this._backend) {
      const result = this._backend.read('qerw/qerw.json');
      if (result) return result as QERWStore;
      return { nodes: {}, edges: [] };
    }
    try {
      if (!fs.existsSync(this.storeFile)) return { nodes: {}, edges: [] };
      return JSON.parse(fs.readFileSync(this.storeFile, "utf-8"));
    } catch {
      return { nodes: {}, edges: [] };
    }
  }

  private persist(): void {
    if (this._backend) {
      this._backend.write('qerw/qerw.json', this.store);
      return;
    }
    try {
      fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
      fs.writeFileSync(this.storeFile, JSON.stringify(this.store, null, 2), "utf-8");
    } catch { /* silent */ }
  }

  private rebuildAdjacency(): void {
    this.adjOut.clear();
    this.adjIn.clear();
    for (const edge of this.store.edges) {
      if (!this.adjOut.has(edge.fromId)) this.adjOut.set(edge.fromId, []);
      this.adjOut.get(edge.fromId)!.push(edge);
      if (!this.adjIn.has(edge.toId)) this.adjIn.set(edge.toId, []);
      this.adjIn.get(edge.toId)!.push(edge);
    }
  }

  private addEdge(edge: QERWEdge): void {
    this.store.edges.push(edge);
    if (!this.adjOut.has(edge.fromId)) this.adjOut.set(edge.fromId, []);
    this.adjOut.get(edge.fromId)!.push(edge);
    if (!this.adjIn.has(edge.toId)) this.adjIn.set(edge.toId, []);
    this.adjIn.get(edge.toId)!.push(edge);
  }

  private warmCache(): void {
    for (const [id, node] of Object.entries(this.store.nodes)) {
      this.embCache.set(id, new Float64Array(node.embedding));
    }
  }

  // ── Geodesic helpers ────────────────────────────────────────────────────

  /**
   * Find k nearest neighbors by Fisher-Rao distance.
   * O(N * d) — but bounded by active node count.
   */
  private knn(emb: Float64Array, domain?: QERWDomain, k = KNN): Array<{ id: string; dist: number }> {
    const nowMs = Date.now();
    const candidates = Object.values(this.store.nodes).filter(n => {
      if (n.invalidAt) return false;
      if (n.validTo && n.validTo < nowMs) return false;
      if (domain && n.domain !== domain) return false;
      return true;
    });

    const scored = candidates.map(n => {
      const nEmb = this.embCache.get(n.id) ?? new Float64Array(n.embedding);
      return { id: n.id, dist: fisherRaoDist(emb, nEmb) };
    });
    scored.sort((a, b) => a.dist - b.dist);
    return scored.slice(0, Math.min(k, scored.length));
  }

  /**
   * Compute the curvature statistic at a node from its kNN graph neighbors.
   * Mean triangle-inequality defect across neighbor pairs.
   */
  private computeNodeCurvature(nodeId: string): number {
    const node = this.store.nodes[nodeId];
    if (!node) return 0;
    const nEmb = this.embCache.get(nodeId);
    if (!nEmb) return 0;

    const neighbors = this.knn(nEmb, node.domain, 5).filter(n => n.id !== nodeId);
    if (neighbors.length < 2) return 0;

    let totalDefect = 0;
    let pairs = 0;
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const ni = this.embCache.get(neighbors[i].id);
        const nj = this.embCache.get(neighbors[j].id);
        if (!ni || !nj) continue;
        const d_ij = fisherRaoDist(ni, nj);
        const d_ki = neighbors[i].dist;
        const d_kj = neighbors[j].dist;
        const sum = d_ki + d_kj;
        if (sum < 1e-10) continue;
        totalDefect += (d_ki + d_kj - d_ij) / sum;
        pairs++;
      }
    }
    return pairs > 0 ? totalDefect / pairs : 0;
  }

  // ── Core API ─────────────────────────────────────────────────────────────

  /**
   * Weave a new memory node onto the manifold.
   *
   * 1. Compute dense embedding (unit sphere)
   * 2. Find kNN by Fisher-Rao distance
   * 3. Add bidirectional geodesic edges to kNN
   * 4. Compute the curvature statistic from neighbor triangles
   * 5. Initialize echo decay
   * 6. Update curvatures of affected neighbors
   */
  weave(
    content: string,
    opts: {
      domain?: QERWDomain;
      tags?: string[];
      validFrom?: number;
      validTo?: number | null;
    } = {},
  ): QERWWeaveResult {
    const nowMs = Date.now();
    const domain: QERWDomain = opts.domain ?? "general";
    const nodeId = `qerw_${nowMs.toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
    const emb = featureHashEmbed(content, EMBEDDING_DIM);
    this.embCache.set(nodeId, emb);

    // Find kNN by Fisher-Rao distance
    const nearest = this.knn(emb, domain, KNN);

    // Add bidirectional geodesic edges to kNN
    const geodesicDistances: QERWWeaveResult['geodesicDistances'] = [];
    for (const n of nearest) {
      const w = Math.max(0.01, 1 - n.dist / Math.PI); // weight decays with distance
      const edge: QERWEdge = {
        fromId: nodeId,
        toId: n.id,
        geodesicDist: n.dist,
        weight: w,
        createdAt: nowMs,
      };
      this.addEdge(edge);
      // Add reverse edge for undirected graph
      const reverse: QERWEdge = {
        fromId: n.id,
        toId: nodeId,
        geodesicDist: n.dist,
        weight: w,
        createdAt: nowMs,
      };
      this.addEdge(reverse);
      geodesicDistances.push({ neighborId: n.id, dist: n.dist });
    }

    // Compute curvature statistic
    const curvature = nearest.length >= 2 ? this.computeNodeCurvature(nodeId) : 0;

    // Initialize echo decay
    const echoDecay = 1.0;

    const node: QERWNode = {
      id: nodeId,
      content,
      domain,
      embedding: Array.from(emb),
      curvature,
      echoDecay,
      validFrom: opts.validFrom ?? nowMs,
      validTo: opts.validTo ?? null,
      invalidAt: null,
      tags: opts.tags ?? [],
      retrievalCount: 0,
      createdAt: nowMs,
    };
    this.store.nodes[nodeId] = node;

    // Update curvatures of affected neighbors
    for (const n of nearest) {
      if (this.store.nodes[n.id]) {
        this.store.nodes[n.id].curvature = this.computeNodeCurvature(n.id);
      }
    }

    this.persist();
    return { nodeId, content, domain, curvature, geodesicDistances };
  }

  /**
   * Propagate an echo signal along geodesic edges.
   *
   * BFS from a set of source nodes, each hop attenuated by
   * (1 - decay) × edge.weight; weak signals are pruned. Signal magnitude is
   * purely a graph-propagation quantity, not a physical quantity.
   */
  propagateEcho(
    sourceIds: string[],
    signal: {
      strength?: number;
      decay?: number;
      maxHops?: number;
    } = {},
  ): { reached: number; paths: Array<{ fromId: string; toId: string; signal: number }> } {
    const strength = signal.strength ?? 0.5;
    const decay = signal.decay ?? ECHO_DECAY;
    const maxHops = signal.maxHops ?? 3;

    const paths: Array<{ fromId: string; toId: string; signal: number }> = [];
    const reached = new Set<string>();

    // BFS with geodesic damping
    const queue: Array<{ id: string; hops: number; currentSignal: number }> = [];
    for (const id of sourceIds) {
      if (this.store.nodes[id] && !reached.has(id)) {
        reached.add(id);
        queue.push({ id, hops: 0, currentSignal: strength });
      }
    }

    for (let qi = 0; qi < queue.length; qi++) {
      const { id, hops, currentSignal } = queue[qi];
      if (hops >= maxHops) continue;

      for (const edge of this.adjOut.get(id) ?? []) {
        if (reached.has(edge.toId)) continue;
        const attenuated = currentSignal * (1 - decay) * edge.weight;
        if (attenuated < 0.01) continue; // prune weak signals

        paths.push({ fromId: id, toId: edge.toId, signal: attenuated });
        reached.add(edge.toId);

        // Update echo decay on target node
        const target = this.store.nodes[edge.toId];
        if (target) {
          target.echoDecay = Math.max(0, target.echoDecay - decay * edge.weight);
          target.retrievalCount++;
        }

        queue.push({ id: edge.toId, hops: hops + 1, currentSignal: attenuated });
      }
    }

    return { reached: reached.size, paths };
  }

  /**
   * Detect anomalies via curvature statistics.
   *
   * Nodes whose curvature deviates from the mean by more than
   * CURVATURE_ANOMALY standard deviations are flagged. This is a descriptive
   * outlier test on the similarity graph, not a cohomology computation.
   *
   * O(N + E) — scans all active nodes.
   */
  detectContradictions(
    opts: { domain?: QERWDomain } = {},
  ): QERWContradictionResult {
    const nowMs = Date.now();
    const active = Object.values(this.store.nodes).filter(n => {
      if (n.invalidAt) return false;
      if (n.validTo && n.validTo < nowMs) return false;
      if (opts.domain && n.domain !== opts.domain) return false;
      return true;
    });

    if (active.length < 3) {
      return {
        highCurvatureNodes: 0, meanCurvature: 0, maxCurvature: 0,
        anomalyRegions: [], isConsistent: true, h1Proxy: 0,
      };
    }

    const curvatures = active.map(n => n.curvature);
    const meanC = curvatures.reduce((s, c) => s + c, 0) / curvatures.length;
    const maxC = Math.max(...curvatures);
    const stdC = Math.sqrt(
      curvatures.reduce((s, c) => s + (c - meanC) ** 2, 0) / curvatures.length,
    );
    const threshold = meanC + CURVATURE_ANOMALY * stdC;

    const anomalies = active
      .filter(n => Math.abs(n.curvature) > threshold)
      .map(n => ({ nodeId: n.id, curvature: n.curvature, domain: n.domain }));

    // h1Proxy: fraction of active nodes flagged as curvature anomalies
    const h1Proxy = anomalies.length / Math.max(1, active.length);

    return {
      highCurvatureNodes: anomalies.length,
      meanCurvature: meanC,
      maxCurvature: maxC,
      anomalyRegions: anomalies.slice(0, 20),
      isConsistent: anomalies.length === 0,
      h1Proxy,
    };
  }

  /**
   * Forecast risk for a domain from the coherence of its recent memories,
   * penalized by mean curvature (scattered/irregular neighborhoods add risk).
   * Trajectory projects current risk forward with the observed coherence trend.
   */
  predict(
    domain: QERWDomain,
    opts: { lookbackDays?: number; steps?: number } = {},
  ): QERWPrediction {
    const nowMs = Date.now();
    const lookback = (opts.lookbackDays ?? LOOKBACK_DAYS) * 86_400_000;
    const steps = Math.min(opts.steps ?? TRAJECTORY_STEPS, TRAJECTORY_STEPS);

    const domainNodes = Object.values(this.store.nodes).filter(n => {
      if (n.invalidAt) return false;
      if (n.validTo && n.validTo < nowMs) return false;
      if (n.domain !== domain) return false;
      return n.createdAt > nowMs - lookback;
    });

    if (domainNodes.length === 0) {
      return {
        domain, riskScore: 0, riskLevel: "low",
        trajectory: Array(steps).fill(0), meanCurvature: 0,
        explanation: `No ${domain} signals in QERW manifold.`,
      };
    }

    const meanCurvature = domainNodes.reduce((s, n) => s + n.curvature, 0) / domainNodes.length;

    const embCache = new Map<string, Float64Array>();
    for (const n of domainNodes) {
      embCache.set(n.id, new Float64Array(n.embedding));
    }
    const centroid = domainCentroid(Array.from(embCache.values()), EMBEDDING_DIM);

    const ordered = [...domainNodes].sort((a, b) => a.createdAt - b.createdAt);
    const coherences = ordered.map(n => {
      const emb = embCache.get(n.id)!;
      return Math.max(0, cosineSim(emb, centroid));
    });

    const { coherence, instability } = coherenceStats(coherences);
    const window = Math.min(8, coherences.length);
    const recent = coherences.slice(-window);
    const trend = recent.length > 1
      ? (recent[recent.length - 1] - recent[0]) / (recent.length - 1)
      : 0;

    const riskScore = Math.max(0, Math.min(1,
      0.5 * (1 - coherence) +
      0.3 * Math.abs(meanCurvature) +
      0.2 * instability,
    ));

    const trajectory: number[] = [];
    const riskDrift = -trend * 0.1;
    for (let t = 0; t < steps; t++) {
      trajectory.push(Math.max(0, Math.min(1, riskScore + riskDrift * (t + 1))));
    }

    const riskLevel: QERWPrediction['riskLevel'] =
      riskScore > 0.6 ? "high" : riskScore > 0.3 ? "medium" : "low";

    return {
      domain, riskScore, riskLevel, trajectory, meanCurvature,
      explanation: `${domain}: ${domainNodes.length} nodes, coherence ${coherence.toFixed(2)}, mean curvature ${meanCurvature.toFixed(3)}, risk ${riskLevel}.`,
    };
  }

  /**
   * Query by Fisher-Rao geodesic distance.
   *
   * O(N) — linear scan with arccos distance.
   */
  query(
    queryText: string,
    opts: { topK?: number; domain?: QERWDomain } = {},
  ): QERWQueryResult {
    const nowMs = Date.now();
    const topK = opts.topK ?? 10;
    const queryEmb = featureHashEmbed(queryText, EMBEDDING_DIM);

    const active = Object.values(this.store.nodes).filter(n => {
      if (n.invalidAt) return false;
      if (n.validTo && n.validTo < nowMs) return false;
      if (opts.domain && n.domain !== opts.domain) return false;
      return true;
    });

    const scored = active.map(n => {
      const nEmb = this.embCache.get(n.id) ?? new Float64Array(n.embedding);
      return { node: n, geodesicDistance: fisherRaoDist(queryEmb, nEmb) };
    });
    scored.sort((a, b) => a.geodesicDistance - b.geodesicDistance);

    const results = scored.slice(0, topK).map(s => ({
      node: s.node,
      geodesicDistance: s.geodesicDistance,
      relevance: Math.max(0, 1 - s.geodesicDistance / Math.PI),
    }));

    return { results, totalCount: active.length };
  }

  /**
   * Consolidate: prune low-echo nodes (quenched signals).
   * O(N).
   */
  consolidate(quenchThreshold = QUENCH_THRESHOLD): QERWConsolidationReport {
    const nowMs = Date.now();
    let pruned = 0;
    let retained = 0;
    let totalCurv = 0;

    for (const node of Object.values(this.store.nodes)) {
      if (node.invalidAt) continue;
      if (node.validTo && node.validTo < nowMs) {
        node.invalidAt = nowMs;
        pruned++;
        continue;
      }
      if (node.echoDecay < quenchThreshold) {
        node.invalidAt = nowMs;
        pruned++;
      } else {
        retained++;
        totalCurv += node.curvature;
      }
    }

    this.persist();
    return {
      pruned,
      retained,
      meanCurvature: retained > 0 ? totalCurv / retained : 0,
    };
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  exportNodes(): QERWNode[] {
    return Object.values(this.store.nodes);
  }

  exportEdges(): QERWEdge[] {
    return [...this.store.edges];
  }

  getNode(id: string): QERWNode | undefined {
    return this.store.nodes[id];
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────

let _instance: QERW | null = null;

export function getQERW(dirOrPath: string): QERW {
  if (!_instance || (_instance as any)['dir'] !== dirOrPath) {
    _instance = new QERW(dirOrPath);
  }
  return _instance;
}
