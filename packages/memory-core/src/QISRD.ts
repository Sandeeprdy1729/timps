// ── @timps/memory-core — Quantum-Inspired Sheaf Resonance Dynamics (QISRD) ──
// Layer 15: Similarity-graph memory with a resonance score and drift tracking.
//
// Honest description (M58):
//   QISRD is an incremental memory layer for the L15 slot. The public API is
//   unchanged; the internals are replaced with plain, well-understood
//   machinery:
//
//     • Embeddings    → deterministic feature-hash vectors (forgeEmbedding)
//     • Entropy       → Shannon entropy of the embedding's energy distribution
//                       (how spread-out a memory is across the vector space)
//     • Resonance     → 0.3 baseline + 0.5 × max cosine to existing memories
//                       (how similar a memory is to what is already known)
//     • Contradictions→ content-based: same topic + opposing stance
//     • "Sheaf graph" → nearest-neighbor graph on the unit hypersphere; the
//                       per-edge restriction error is set when the two
//                       memories contradict; H¹ is approximated by near-zero
//                       Laplacian eigenvalues (a descriptive graph statistic)
//     • Drift         → blend of spectral-gap tightness and resonance decay
//     • Langevin step → deterministic spherical interpolation toward a target
//                       with renormalization (gradient step on the sphere)
//     • Prediction    → risk from domain coherence, not Fokker-Planck
//
//   No benchmark superiority is claimed. Big-O: weave O(N·d), query O(N·d).

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
  isContradictory,
} from './forgeEmbedding.js';

// ── Types ─────────────────────────────────────────────────────────────────

export type QISRDDomain =
  | "burnout" | "relationship" | "decision" | "code_pattern"
  | "contradiction" | "goal" | "general";

export type QISRDResolution = "coarse" | "fine";

export interface QISRDNode {
  id: string;
  content: string;
  domain: QISRDDomain;
  embedding: number[];
  resolution: QISRDResolution;
  entropy: number;
  resonanceScore: number;
  h1Contribution: number;
  validFrom: number;
  validTo: number | null;
  invalidAt: number | null;
  tags: string[];
  retrievalCount: number;
  createdAt: number;
}

export interface QISRDEdge {
  fromId: string;
  toId: string;
  weight: number;
  restrictionError: number;
  createdAt: number;
}

export interface QISRDStore {
  nodes: Record<string, QISRDNode>;
  edges: QISRDEdge[];
  driftScore: number;
  lastTopologySurgeryAt: number;
  cachedEigenvalues: number[];
  lastCohomologyAt: number;
}

export interface QISRDWeaveResult {
  nodeId: string;
  resolution: QISRDResolution;
  entropy: number;
  resonanceScore: number;
  contradictionFlag: boolean;
}

export interface QISRDContradictionResult {
  betti1: number;
  spectralGap: number;
  anomalyNodes: Array<{ nodeId: string; h1Contribution: number; domain: QISRDDomain }>;
  isConsistent: boolean;
  driftScore: number;
}

export interface QISRDPrediction {
  domain: QISRDDomain;
  riskScore: number;
  riskLevel: "high" | "medium" | "low";
  trajectory: number[];
  resonance: number;
  uncertainty: number;
  explanation: string;
}

export interface QISRDQueryResult {
  results: Array<{
    node: QISRDNode;
    relevance: number;
    resolution: QISRDResolution;
  }>;
  totalCount: number;
  latencyMs: number;
}

export interface QISRDConsolidationReport {
  pruned: number;
  retained: number;
  resolvedContradictions: number;
  topologySurgery: boolean;
  driftAfter: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const EMBEDDING_DIM = 64;
const H1_GAP_THRESHOLD = 0.15;
const DRIFT_THRESHOLD = 0.25;
const LANGEVIN_DT = 0.01;
const RESONANCE_EXPONENT = 1.5;
const LOOKBACK_DAYS = 14;
const TRAJECTORY_STEPS = 12;
const SURGERY_COOLDOWN_MS = 3600_000; // 1 hour
const POWER_ITER_EIGENS = 8;
const POWER_ITER_MAX = 30;
const SIMILARITY_EDGE_THRESHOLD = 0.3; // minimum edge weight to link neighbors
const MERGE_COSINE = 0.9;              // near-duplicate threshold for merging
const RESTRICTION_NEUTRAL = 0.01;      // restriction error on a normal edge
const RESTRICTION_CONTRADICT = 0.5;    // restriction error on a contradiction

// ── Topology surgery (prune + merge) ─────────────────────────────────────

interface SurgeryResult {
  pruned: number;
  merged: number;
  newEdges: number;
}

/**
 * Prune stale or quenched nodes and merge near-duplicate clusters
 * (cosine > MERGE_COSINE, same domain). Rewires the merged node's edges onto
 * the survivor.
 */
function topologySurgery(
  nodes: Record<string, QISRDNode>,
  edges: QISRDEdge[],
  nowMs: number,
): SurgeryResult {
  let pruned = 0;
  let merged = 0;
  const toRemove = new Set<string>();
  const toAdd: QISRDEdge[] = [];

  // Prune: invalidated for 7+ days, or quenched (low resonance, rarely used).
  for (const [id, n] of Object.entries(nodes)) {
    if (n.invalidAt && (nowMs - n.invalidAt) > 7 * 86400_000) {
      toRemove.add(id);
      pruned++;
    } else if (n.resonanceScore < 0.05 && n.retrievalCount < 2) {
      toRemove.add(id);
      pruned++;
    }
  }

  // Merge: near-duplicate clusters.
  const active = Object.values(nodes).filter(n => !toRemove.has(n.id));
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (toRemove.has(active[i].id) || toRemove.has(active[j].id)) continue;
      const sim = cosineSim(active[i].embedding, active[j].embedding);
      if (sim > MERGE_COSINE && active[i].domain === active[j].domain) {
        toRemove.add(active[j].id);
        merged++;
        pruned++;
        for (const e of edges) {
          if (e.fromId === active[j].id && !toRemove.has(e.toId)) {
            toAdd.push({
              fromId: active[i].id,
              toId: e.toId,
              weight: e.weight,
              restrictionError: e.restrictionError,
              createdAt: nowMs,
            });
          }
          if (e.toId === active[j].id && !toRemove.has(e.fromId)) {
            toAdd.push({
              fromId: e.fromId,
              toId: active[i].id,
              weight: e.weight,
              restrictionError: e.restrictionError,
              createdAt: nowMs,
            });
          }
        }
      }
    }
  }

  // Remove pruned nodes and their edges.
  for (const id of toRemove) delete nodes[id];
  for (let i = edges.length - 1; i >= 0; i--) {
    if (toRemove.has(edges[i].fromId) || toRemove.has(edges[i].toId)) {
      edges.splice(i, 1);
    }
  }

  edges.push(...toAdd);

  return { pruned, merged, newEdges: toAdd.length };
}

// ── Graph Laplacian eigenvalues (power iteration with shift) ──────────────

/**
 * Smallest eigenvalues of the graph Laplacian of a set of nodes, via power
 * iteration on the shifted matrix (sigma·I − L). Deterministic init and
 * Gram-Schmidt deflation.
 */
function smallestLaplacianEigenvalues(
  n: number,
  diag: Float64Array,
  offDiag: Array<{ i: number; j: number; val: number }>,
  k: number,
  maxIter = POWER_ITER_MAX,
): number[] {
  const effectiveK = Math.min(k, n);
  if (n === 0) return [];
  let sigma = 1;
  for (let i = 0; i < n; i++) sigma = Math.max(sigma, diag[i] + 1);

  const values: number[] = [];
  const vectors: Float64Array[] = [];

  for (let idx = 0; idx < effectiveK; idx++) {
    let v = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      v[i] = Math.sin((idx + 1) * (i + 1) * 0.618033988749895);
    }
    for (const p of vectors) {
      let dot = 0, pn = 0;
      for (let i = 0; i < n; i++) { dot += v[i] * p[i]; pn += p[i] * p[i]; }
      if (pn > 0) {
        const scale = dot / pn;
        for (let i = 0; i < n; i++) v[i] -= scale * p[i];
      }
    }
    let nrm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    if (nrm > 0) for (let i = 0; i < n; i++) v[i] /= nrm;

    for (let iter = 0; iter < maxIter; iter++) {
      const w = new Float64Array(n);
      for (let i = 0; i < n; i++) w[i] = sigma * v[i] - diag[i] * v[i];
      for (const { i, j, val } of offDiag) {
        w[i] += val * v[j];
        w[j] += val * v[i];
      }
      for (const p of vectors) {
        let dot = 0;
        for (let i = 0; i < n; i++) dot += w[i] * p[i];
        for (let i = 0; i < n; i++) w[i] -= dot * p[i];
      }
      nrm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
      if (nrm < 1e-12) break;
      for (let i = 0; i < n; i++) v[i] = w[i] / nrm;
    }

    // Rayleigh quotient for the Laplacian (v^T L v), ascending by construction.
    let eig = 0;
    for (let i = 0; i < n; i++) eig += diag[i] * v[i] * v[i];
    for (const { i, j, val } of offDiag) eig -= 2 * val * v[i] * v[j];
    values.push(eig);
    vectors.push(v);
  }

  return values;
}

// ── Main Class ────────────────────────────────────────────────────────────

export class QISRD {
  private dir: string;
  private storeFile: string;
  private store: QISRDStore;
  private _backend?: StorageBackend;

  constructor(dirOrPath: string, backend?: StorageBackend) {
    this.dir = dirOrPath;
    this._backend = backend;
    this.storeFile = path.join(this.dir, "qisrd-store.json");
    this.store = this.loadStore();
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  private loadStore(): QISRDStore {
    if (this._backend) {
      const result = this._backend.read('qisrd/qisrd.json');
      if (result) return result as QISRDStore;
      return {
        nodes: {},
        edges: [],
        driftScore: 0,
        lastTopologySurgeryAt: 0,
        cachedEigenvalues: [],
        lastCohomologyAt: 0,
      };
    }
    try {
      if (fs.existsSync(this.storeFile)) {
        return JSON.parse(fs.readFileSync(this.storeFile, "utf-8"));
      }
    } catch { /* corrupt — start fresh */ }
    return {
      nodes: {},
      edges: [],
      driftScore: 0,
      lastTopologySurgeryAt: 0,
      cachedEigenvalues: [],
      lastCohomologyAt: 0,
    };
  }

  private save(): void {
    if (this._backend) {
      this._backend.write('qisrd/qisrd.json', this.store);
      return;
    }
    try {
      fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
      fs.writeFileSync(this.storeFile, JSON.stringify(this.store, null, 2), "utf-8");
    } catch { /* best-effort */ }
  }

  // ── Core: weave ─────────────────────────────────────────────────────────

  weave(
    content: string,
    opts: {
      domain?: QISRDDomain;
      tags?: string[];
      resolution?: QISRDResolution;
      causalParentId?: string | null;
    } = {},
  ): QISRDWeaveResult {
    const nowMs = Date.now();
    const id = `qisrd_${crypto.randomBytes(3).toString("hex")}`;
    const domain = opts.domain ?? "general";
    const resolution = opts.resolution ?? "fine";
    const emb = featureHashEmbed(content, EMBEDDING_DIM);
    const embedding = Array.from(emb);

    // Shannon entropy of the embedding's energy distribution.
    let energy = 0;
    for (let i = 0; i < embedding.length; i++) energy += embedding[i] * embedding[i];
    const p = embedding.map(v => (v * v) / (energy || 1));
    let entropy = 0;
    for (let i = 0; i < p.length; i++) {
      if (p[i] > 1e-12) entropy -= p[i] * Math.log(p[i]);
    }

    // Resonance: baseline + how similar the memory is to what is already known.
    const active = Object.values(this.store.nodes).filter(n => !n.invalidAt);
    let resonanceScore = 0.3;
    let maxSim = 0;
    for (const n of active) {
      const sim = cosineSim(emb, n.embedding);
      if (sim > maxSim) maxSim = sim;
    }
    if (active.length > 0) resonanceScore = 0.3 + maxSim * 0.5;

    const node: QISRDNode = {
      id,
      content,
      domain,
      embedding,
      resolution,
      entropy,
      resonanceScore,
      h1Contribution: 0,
      validFrom: nowMs,
      validTo: null,
      invalidAt: null,
      tags: opts.tags ?? [],
      retrievalCount: 0,
      createdAt: nowMs,
    };

    // Link to similar neighbors; flag content-based contradictions.
    let contradictionFlag = false;
    let h1Contribution = 0;
    for (const n of active) {
      const dist = fisherRaoDist(emb, n.embedding);
      const weight = 1 / (1 + dist);
      if (weight > SIMILARITY_EDGE_THRESHOLD) {
        const contradictory = isContradictory(content, n.content);
        const restrictionError = contradictory ? RESTRICTION_CONTRADICT : RESTRICTION_NEUTRAL;
        this.store.edges.push({
          fromId: id,
          toId: n.id,
          weight,
          restrictionError,
          createdAt: nowMs,
        });
        if (contradictory) {
          contradictionFlag = true;
          h1Contribution += restrictionError;
        }
      }
    }
    node.h1Contribution = Math.round(h1Contribution * 1000) / 1000;
    this.store.nodes[id] = node;

    // Invalidate eigenvalue cache.
    this.store.cachedEigenvalues = [];
    this.store.lastCohomologyAt = 0;

    this.save();

    return {
      nodeId: id,
      resolution,
      entropy: Math.round(entropy * 1000) / 1000,
      resonanceScore: Math.round(resonanceScore * 1000) / 1000,
      contradictionFlag,
    };
  }

  // ── Graph Laplacian + H¹ approximation ─────────────────────────────────

  private computeH1(domain?: QISRDDomain): {
    betti1: number;
    spectralGap: number;
    eigenvalues: number[];
  } {
    const nowMs = Date.now();
    if (
      this.store.cachedEigenvalues.length > 0 &&
      (nowMs - this.store.lastCohomologyAt) < 30_000
    ) {
      const ev = this.store.cachedEigenvalues;
      let betti1 = 0;
      let spectralGap = 1;
      for (let i = 1; i < ev.length; i++) {
        if (ev[i] < H1_GAP_THRESHOLD) betti1++;
        else { spectralGap = ev[i]; break; }
      }
      return { betti1, spectralGap, eigenvalues: ev };
    }

    const active = Object.values(this.store.nodes).filter(n => !n.invalidAt);
    if (active.length < 3) {
      return { betti1: 0, spectralGap: 1, eigenvalues: [0] };
    }

    const filtered = domain
      ? active.filter(n => n.domain === domain)
      : active;
    if (filtered.length < 2) {
      return { betti1: 0, spectralGap: 1, eigenvalues: [0] };
    }

    const idToIdx = new Map<string, number>();
    filtered.forEach((n, i) => idToIdx.set(n.id, i));

    // Undirected graph Laplacian: diag = sum of incident edge weights,
    // off-diagonal = −weight for each edge between two filtered nodes.
    const n = filtered.length;
    const diag = new Float64Array(n);
    const offDiag: Array<{ i: number; j: number; val: number }> = [];
    for (const e of this.store.edges) {
      const fi = idToIdx.get(e.fromId);
      const ti = idToIdx.get(e.toId);
      if (fi === undefined || ti === undefined) continue;
      diag[fi] += e.weight;
      diag[ti] += e.weight;
      offDiag.push({ i: fi, j: ti, val: e.weight });
    }

    const eigenvalues = smallestLaplacianEigenvalues(
      n, diag, offDiag, Math.min(POWER_ITER_EIGENS, n),
    );

    this.store.cachedEigenvalues = eigenvalues;
    this.store.lastCohomologyAt = nowMs;
    this.save();

    let betti1 = 0;
    let spectralGap = 1;
    for (let i = 1; i < eigenvalues.length; i++) {
      if (eigenvalues[i] < H1_GAP_THRESHOLD) betti1++;
      else { spectralGap = eigenvalues[i]; break; }
    }

    return { betti1, spectralGap, eigenvalues };
  }

  // ── Contradiction detection ─────────────────────────────────────────────

  detectContradictions(
    opts: { domain?: QISRDDomain } = {},
  ): QISRDContradictionResult {
    const { betti1, spectralGap } = this.computeH1(opts.domain);

    const active = Object.values(this.store.nodes).filter(n => !n.invalidAt);
    const filtered = opts.domain
      ? active.filter(n => n.domain === opts.domain)
      : active;

    // Per-node H¹ contribution from high-restriction (contradiction) edges.
    const contribMap = new Map<string, number>();
    for (const e of this.store.edges) {
      if (e.restrictionError > 0.4) {
        contribMap.set(e.fromId, (contribMap.get(e.fromId) ?? 0) + e.restrictionError);
        contribMap.set(e.toId, (contribMap.get(e.toId) ?? 0) + e.restrictionError);
      }
    }

    const anomalyNodes = filtered
      .filter(n => (contribMap.get(n.id) ?? 0) > 0.5)
      .map(n => ({
        nodeId: n.id,
        h1Contribution: Math.round((contribMap.get(n.id) ?? 0) * 1000) / 1000,
        domain: n.domain,
      }))
      .sort((a, b) => b.h1Contribution - a.h1Contribution);

    // Drift: spectral gap tightness blended with resonance decay.
    const meanResonance = active.length > 0
      ? active.reduce((s, n) => s + n.resonanceScore, 0) / active.length
      : 0;
    const driftScore = Math.min(1, Math.max(0,
      0.5 * (1 - spectralGap) + 0.5 * (1 - meanResonance),
    ));
    this.store.driftScore = Math.round(driftScore * 1000) / 1000;

    this.save();

    return {
      betti1,
      spectralGap: Math.round(spectralGap * 1000) / 1000,
      anomalyNodes,
      isConsistent: betti1 === 0 && anomalyNodes.length === 0,
      driftScore: this.store.driftScore,
    };
  }

  // ── Langevin step ───────────────────────────────────────────────────────

  /**
   * Deterministic spherical step: move along the great circle from `x` toward
   * `target` by LANGEVIN_DT, then renormalize to unit norm. No noise — this is
   * a gradient step on the sphere, kept deterministic for reproducibility.
   */
  langevinStep(x: number[], target: number[]): number[] {
    const cosAngle = Math.max(-1, Math.min(1, cosineSim(x, target)));
    const result = new Float64Array(x.length);
    for (let i = 0; i < x.length; i++) {
      result[i] = x[i] + LANGEVIN_DT * (target[i] - cosAngle * x[i]);
    }
    let norm = 0;
    for (let i = 0; i < result.length; i++) norm += result[i] * result[i];
    norm = Math.sqrt(norm) || 1;
    const out: number[] = [];
    for (let i = 0; i < result.length; i++) out.push(result[i] / norm);
    return out;
  }

  // ── Resonance scoring ───────────────────────────────────────────────────

  /**
   * Coherence-based resonance: mean pairwise cosine of consecutive trajectory
   * steps, raised to RESONANCE_EXPONENT to amplify weak coherent signals.
   */
  private resonanceOfTrajectory(traj: number[][]): number {
    if (traj.length < 2) return 0;
    let coherence = 0;
    for (let t = 1; t < traj.length; t++) {
      coherence += cosineSim(new Float64Array(traj[t - 1]), new Float64Array(traj[t]));
    }
    coherence /= (traj.length - 1);
    return Math.pow(Math.max(0, coherence), RESONANCE_EXPONENT);
  }

  // ── Predict ─────────────────────────────────────────────────────────────

  predict(
    domain: QISRDDomain,
    opts: { lookbackDays?: number; steps?: number } = {},
  ): QISRDPrediction {
    const nowMs = Date.now();
    const lookback = (opts.lookbackDays ?? LOOKBACK_DAYS) * 86400_000;
    const steps = Math.min(opts.steps ?? TRAJECTORY_STEPS, TRAJECTORY_STEPS);

    const domainNodes = Object.values(this.store.nodes)
      .filter(n => n.domain === domain && !n.invalidAt && n.createdAt > nowMs - lookback);

    if (domainNodes.length === 0) {
      return {
        domain,
        riskScore: 0,
        riskLevel: "low",
        trajectory: [],
        resonance: 0,
        uncertainty: 0,
        explanation: `QISRD: no data for domain "${domain}"`,
      };
    }

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

    const resonance = Math.pow(Math.max(0, coherence), RESONANCE_EXPONENT);
    const { betti1 } = this.computeH1(domain);
    const h1Risk = Math.min(0.4, betti1 * 0.1);

    const rawRisk = Math.min(1, Math.max(0,
      0.5 * (1 - coherence) +
      0.3 * instability +
      h1Risk,
    ));

    let riskLevel: "high" | "medium" | "low";
    if (rawRisk > 0.6) riskLevel = "high";
    else if (rawRisk > 0.3) riskLevel = "medium";
    else riskLevel = "low";

    // Uncertainty: instability of recent coherence (scatter of the domain).
    const uncertainty = Math.min(1, instability);

    // Trajectory: forward projection of current risk with the coherence trend.
    const trajectory: number[] = [];
    const riskDrift = -trend * 0.1;
    for (let t = 0; t < steps; t++) {
      trajectory.push(Math.round(
        Math.max(0, Math.min(1, rawRisk + riskDrift * (t + 1))) * 1000,
      ) / 1000);
    }

    return {
      domain,
      riskScore: Math.round(rawRisk * 1000) / 1000,
      riskLevel,
      trajectory,
      resonance: Math.round(resonance * 1000) / 1000,
      uncertainty: Math.round(uncertainty * 1000) / 1000,
      explanation: `QISRD (${domain}): ${riskLevel.toUpperCase()} risk=${(rawRisk * 100).toFixed(0)}%, resonance=${resonance.toFixed(2)}, uncertainty=${uncertainty.toFixed(2)}`,
    };
  }

  // ── Query ───────────────────────────────────────────────────────────────

  query(
    queryText: string,
    opts: { topK?: number; domain?: QISRDDomain; resolution?: QISRDResolution } = {},
  ): QISRDQueryResult {
    const t0 = Date.now();
    const topK = opts.topK ?? 10;
    const qEmb = featureHashEmbed(queryText, EMBEDDING_DIM);
    const active = Object.values(this.store.nodes).filter(n => !n.invalidAt);

    let candidates = active;
    if (opts.resolution) candidates = candidates.filter(n => n.resolution === opts.resolution);
    if (opts.domain) candidates = candidates.filter(n => n.domain === opts.domain);

    const scored = candidates.map(n => ({
      node: n,
      relevance: cosineSim(qEmb, n.embedding),
    }));
    scored.sort((a, b) => b.relevance - a.relevance);

    const results = scored.slice(0, topK).map(s => ({
      node: s.node,
      relevance: Math.round(s.relevance * 1000) / 1000,
      resolution: s.node.resolution,
    }));

    return { results, totalCount: active.length, latencyMs: Date.now() - t0 };
  }

  // ── Consolidate (topology surgery) ──────────────────────────────────────

  consolidate(threshold?: number): QISRDConsolidationReport {
    const nowMs = Date.now();
    const prevCount = Object.keys(this.store.nodes).length;

    const { betti1 } = this.computeH1();
    const drift = this.store.driftScore;
    const thresh = threshold ?? DRIFT_THRESHOLD;

    // Topology surgery if drift exceeds threshold, H¹ is non-trivial, or the
    // cooldown has elapsed.
    let surgery = false;
    if (
      drift > thresh || betti1 > 0 ||
      (nowMs - this.store.lastTopologySurgeryAt) > SURGERY_COOLDOWN_MS * 6
    ) {
      const result = topologySurgery(this.store.nodes, this.store.edges, nowMs);
      if (result.pruned > 0 || result.newEdges > 0) {
        surgery = true;
        this.store.lastTopologySurgeryAt = nowMs;
        this.store.cachedEigenvalues = []; // invalidate
      }
    }

    const retained = Object.keys(this.store.nodes).length;
    const pruned = prevCount - retained;

    // Recompute drift after surgery.
    const { betti1: betti1After } = this.computeH1();
    const newDrift = Math.min(1, Math.max(0,
      0.5 * betti1After * 0.1 + 0.5 * (1 - (
        Object.values(this.store.nodes).reduce((s, n) => s + n.resonanceScore, 0)
        / Math.max(1, retained)
      ))
    ));
    this.store.driftScore = Math.round(newDrift * 1000) / 1000;
    this.save();

    return {
      pruned,
      retained,
      resolvedContradictions: Math.max(0, betti1 - betti1After),
      topologySurgery: surgery,
      driftAfter: this.store.driftScore,
    };
  }

  // ── Status ──────────────────────────────────────────────────────────────

  status(): {
    nodeCount: number;
    edgeCount: number;
    driftScore: number;
    cachedEigenvalues: number[];
    lastTopologySurgeryAt: number;
  } {
    return {
      nodeCount: Object.keys(this.store.nodes).length,
      edgeCount: this.store.edges.length,
      driftScore: this.store.driftScore,
      cachedEigenvalues: this.store.cachedEigenvalues,
      lastTopologySurgeryAt: this.store.lastTopologySurgeryAt,
    };
  }

  // ── Raw data access ─────────────────────────────────────────────────────

  exportNodes(): QISRDNode[] {
    return Object.values(this.store.nodes);
  }

  exportEdges(): QISRDEdge[] {
    return [...this.store.edges];
  }
}

// ── Singleton factory (matching QERW/TitanicForge pattern) ──

let _qisrdInstance: QISRD | undefined;

export function getQISRD(dirOrPath: string): QISRD {
  if (!_qisrdInstance || (_qisrdInstance as any)['dir'] !== dirOrPath) {
    _qisrdInstance = new QISRD(dirOrPath);
  }
  return _qisrdInstance;
}
