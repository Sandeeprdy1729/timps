// ── @timps/memory-core — Quantum-Phase Temporal Weaver (QPTW) ──
// Layer 12: Phase-modulated incremental propagation over a low-dimensional
//   manifold for contradiction detection and trend forecasting.
//
// Honest description (M58):
//   QPTW is an incremental memory layer for the L12 slot. It keeps the
//   previously-existing public API (weave / updateAffected / detectContradictions
//   / predict / query / consolidate) but replaces the pseudo-scientific
//   internals with plain, well-understood machinery:
//
//     • Embeddings     → deterministic feature-hash vectors (forgeEmbedding)
//     • "Phase"        → the polar angle of a node's embedding in the plane
//                        (a content encoding, NOT a physical phase)
//     • Manifold pos   → first 3 embedding components (a 3-D projection)
//     • Contradictions → content-based: shared vocabulary + opposing stance
//     • Prediction     → trend over recent domain coherence, not resonance math
//
//   No benchmark superiority is claimed anywhere in this file. Complexity:
//   weave O(N) in same-domain nodes (bounded neighbor scan), update O(k) for the
//   affected neighborhood, detectContradictions O(N²) pairwise content checks.

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { StorageBackend } from './backends/types.js';
import {
  featureHashEmbed,
  cosineSim,
  isContradictory,
  domainCentroid,
  coherenceStats,
} from './forgeEmbedding.js';

// ── Types ─────────────────────────────────────────────────────────────────

export type QPTWDomain =
  | "burnout" | "relationship" | "decision" | "code_pattern"
  | "contradiction" | "goal" | "general";

export type QPTWEdgeType =
  | "causes" | "supersedes" | "contradicts" | "correlates" | "reinforces";

export interface QPTWNode {
  id: string;
  content: string;
  domain: QPTWDomain;
  /** Low-dimensional manifold coordinates (first 3 embedding components) */
  manifoldPos: [number, number, number];
  /** Phase angle in [0, 2π) — polar angle of the content embedding */
  phase: number;
  /** Oscillation frequency — how often this node is updated */
  frequency: number;
  /** Salience/importance in [0, 1] */
  amplitude: number;
  /** Surprise score from last update — novelty vs. same-domain neighbors */
  surprise: number;
  /** Bi-temporal validity */
  validFrom: number;
  validTo: number | null;
  invalidAt: number | null;
  tags: string[];
  retrievalCount: number;
  createdAt: number;
}

export interface QPTWEdge {
  fromId: string;
  toId: string;
  /** Phase alignment in [-1, 1] — cos(Δphase), informational */
  phaseAlignment: number;
  weight: number;
  edgeType: QPTWEdgeType;
  createdAt: number;
}

export interface QPTWStore {
  nodes: Record<string, QPTWNode>;
  edges: QPTWEdge[];
}

export interface QPTWWeaveResult {
  nodeId: string;
  content: string;
  domain: QPTWDomain;
  phase: number;
  amplitude: number;
  surprise: number;
}

export interface QPTWContradictionResult {
  betti1: number;
  phaseIncoherence: number;
  contradictions: Array<{
    nodeA: string;
    nodeB: string;
    phaseDiff: number;
    interference: number;
  }>;
  isConsistent: boolean;
}

export interface QPTWPrediction {
  domain: QPTWDomain;
  riskScore: number;
  riskLevel: "high" | "medium" | "low";
  trajectory: number[];
  resonance: number;
  explanation: string;
}

export interface QPTWQueryResult {
  results: Array<{
    node: QPTWNode;
    manifoldDistance: number;
    relevance: number;
  }>;
  totalCount: number;
}

export interface QPTWConsolidationReport {
  pruned: number;
  retained: number;
  meanAmplitude: number;
  meanPhaseCoherence: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const MANIFOLD_DIMS = 3;
const EMBEDDING_DIM = 64;
const MAX_MANIFOLD_DIST = Math.sqrt(MANIFOLD_DIMS);
const DEFAULT_AMPLITUDE = 0.5;
const DEFAULT_FREQUENCY = 0.1;
const SURPRISE_BOOST = 0.2;
const QUENCH_THRESHOLD = 0.05;
const MAX_CONTRADICTION_EDGES = 3;
const TRAJECTORY_STEPS = 12;
const LOOKBACK_DAYS = 14;
const AFFECTED_FANOUT = 2;

// ── Helpers ───────────────────────────────────────────────────────────────

/** Deterministic phase from the content embedding's polar angle, mapped to [0, 2π). */
function phaseFromEmbedding(emb: Float64Array): number {
  return Math.atan2(emb[1], emb[0]) + Math.PI;
}

/** Cosine alignment between two phase angles. */
function phaseAlignment(a: number, b: number): number {
  return Math.cos(a - b);
}

/** Euclidean distance in manifold space. */
function manifoldDist(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Novelty vs. existing same-domain neighbors (0 = identical, 1 = maximally novel). */
function computeSurprise(node: QPTWNode, neighbors: QPTWNode[]): number {
  if (neighbors.length === 0) return 0.5;
  let totalDist = 0;
  for (const nb of neighbors) {
    const phaseDiff = Math.abs(node.phase - nb.phase);
    const ampDiff = Math.abs(node.amplitude - nb.amplitude);
    totalDist += Math.sqrt(phaseDiff * phaseDiff + ampDiff * ampDiff);
  }
  return Math.min(1, totalDist / neighbors.length);
}

// ── QPTW Class ────────────────────────────────────────────────────────────

export class QPTW {
  private dir: string;
  private storeFile: string;
  private store: QPTWStore;
  private _backend?: StorageBackend;
  private adjOut: Map<string, QPTWEdge[]>;
  private adjIn: Map<string, QPTWEdge[]>;

  constructor(dir: string, backend?: StorageBackend) {
    this.dir = dir;
    this._backend = backend;
    this.storeFile = path.join(dir, "qptw-store.json");
    this.store = this.loadStore();
    this.adjOut = new Map();
    this.adjIn = new Map();
    this.rebuildAdjacency();
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private loadStore(): QPTWStore {
    if (this._backend) {
      const result = this._backend.read('qptw/qptw.json');
      if (result) return result as QPTWStore;
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
      this._backend.write('qptw/qptw.json', this.store);
      return;
    }
    try {
      fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
      fs.writeFileSync(this.storeFile, JSON.stringify(this.store, null, 2), "utf-8");
    } catch {
      // Silently fail — memory-only operation is acceptable
    }
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

  private addEdge(edge: QPTWEdge): void {
    this.store.edges.push(edge);
    if (!this.adjOut.has(edge.fromId)) this.adjOut.set(edge.fromId, []);
    this.adjOut.get(edge.fromId)!.push(edge);
    if (!this.adjIn.has(edge.toId)) this.adjIn.set(edge.toId, []);
    this.adjIn.get(edge.toId)!.push(edge);
  }

  // ── Core API ─────────────────────────────────────────────────────────────

  /**
   * Weave a new memory node into the manifold.
   *
   * Embeds the content, derives phase + manifold position from the embedding,
   * bootstraps surprise from novelty vs. the nearest same-domain nodes, links a
   * causal edge to the parent if given, and adds "contradicts" edges to
   * same-domain nodes whose content genuinely contradicts the new node.
   */
  weave(
    content: string,
    opts: {
      domain?: QPTWDomain;
      causalParentId?: string | null;
      tags?: string[];
      amplitude?: number;
      frequency?: number;
      validFrom?: number;
      validTo?: number | null;
    } = {},
  ): QPTWWeaveResult {
    const nowMs = Date.now();
    const domain: QPTWDomain = opts.domain ?? "general";
    const nodeId = `qptw_${nowMs.toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
    const emb = featureHashEmbed(content, EMBEDDING_DIM);
    const manifoldPos: [number, number, number] = [emb[0], emb[1], emb[2]];
    const phase = phaseFromEmbedding(emb);
    const amplitude = opts.amplitude ?? DEFAULT_AMPLITUDE;
    const frequency = opts.frequency ?? DEFAULT_FREQUENCY;

    // Bootstrap surprise from nearest existing nodes
    const pool = domain !== "general"
      ? Object.values(this.store.nodes).filter(n => n.domain === domain)
      : Object.values(this.store.nodes);
    const nearest = pool
      .map(n => ({ node: n, dist: manifoldDist(manifoldPos, n.manifoldPos) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);
    const surprise = nearest.length > 0
      ? Math.min(1, nearest.reduce((s, x) => s + (1 - x.dist / MAX_MANIFOLD_DIST), 0) / nearest.length)
      : 0.5;

    const node: QPTWNode = {
      id: nodeId, content, domain, manifoldPos, phase,
      frequency, amplitude, surprise,
      validFrom: opts.validFrom ?? nowMs,
      validTo: opts.validTo ?? null,
      invalidAt: null,
      tags: opts.tags ?? [],
      retrievalCount: 0,
      createdAt: nowMs,
    };
    this.store.nodes[nodeId] = node;

    // If parent provided, add causal edge
    if (opts.causalParentId && this.store.nodes[opts.causalParentId]) {
      this.addEdge({
        fromId: opts.causalParentId,
        toId: nodeId,
        phaseAlignment: phaseAlignment(this.store.nodes[opts.causalParentId].phase, phase),
        weight: 1.0,
        edgeType: "causes",
        createdAt: nowMs,
      });
    }

    // Content-based contradiction check against same-domain nodes
    const contradicting = pool.filter(n => {
      if (n.id === nodeId || n.invalidAt) return false;
      return isContradictory(n.content, content);
    });
    for (const c of contradicting.slice(0, MAX_CONTRADICTION_EDGES)) {
      const align = phaseAlignment(phase, c.phase);
      this.addEdge({
        fromId: nodeId,
        toId: c.id,
        phaseAlignment: align,
        weight: Math.abs(align),
        edgeType: "contradicts",
        createdAt: nowMs,
      });
    }

    this.persist();
    return { nodeId, content, domain, phase, amplitude, surprise };
  }

  /**
   * Incrementally update the manifold after a set of affected nodes change.
   *
   * Propagates phase adjustments through the affected neighborhood (BFS up to
   * AFFECTED_FANOUT hops), weighting shifts by edge weight × neighbor amplitude,
   * and decays amplitude toward zero for non-surprising nodes.
   */
  updateAffected(
    affectedNodeIds: string[],
    signal: {
      deltaPhase?: number;
      decay?: number;
      surpriseBoost?: number;
    } = {},
  ): { updated: number; meanSurprise: number; latencyMs: number } {
    const t0 = Date.now();
    const deltaPhase = signal.deltaPhase ?? 0.1;
    const decay = signal.decay ?? 0.05;
    const surpriseBoost = signal.surpriseBoost ?? SURPRISE_BOOST;
    let updated = 0;
    let totalSurprise = 0;

    // Collect neighborhood (BFS up to AFFECTED_FANOUT hops)
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];
    for (const id of affectedNodeIds) {
      if (this.store.nodes[id] && !visited.has(id)) {
        visited.add(id);
        queue.push({ id, depth: 0 });
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const { id, depth } = queue[i];
      if (depth < AFFECTED_FANOUT) {
        for (const e of this.adjOut.get(id) ?? []) {
          if (!visited.has(e.toId) && this.store.nodes[e.toId]) {
            visited.add(e.toId);
            queue.push({ id: e.toId, depth: depth + 1 });
          }
        }
        for (const e of this.adjIn.get(id) ?? []) {
          if (!visited.has(e.fromId) && this.store.nodes[e.fromId]) {
            visited.add(e.fromId);
            queue.push({ id: e.fromId, depth: depth + 1 });
          }
        }
      }
    }

    // Phase propagation: neighbor-weighted phase shift
    for (const { id } of queue) {
      const node = this.store.nodes[id];
      if (!node) continue;

      const outNeighbors = this.adjOut.get(id) ?? [];
      const inNeighbors = this.adjIn.get(id) ?? [];
      const allEdges = [...outNeighbors, ...inNeighbors];
      if (allEdges.length === 0) {
        // Isolated node — apply direct signal with decay
        node.phase = (node.phase + deltaPhase) % (2 * Math.PI);
        node.amplitude = Math.max(0, node.amplitude - decay);
        node.surprise = Math.min(1, node.surprise + surpriseBoost);
        updated++;
        totalSurprise += node.surprise;
        continue;
      }

      // Weighted phase alignment from neighbors
      let weightedPhaseShift = 0;
      let totalWeight = 0;
      for (const edge of allEdges) {
        const neighborId = edge.fromId === id ? edge.toId : edge.fromId;
        const neighbor = this.store.nodes[neighborId];
        if (!neighbor) continue;
        const w = edge.weight * neighbor.amplitude;
        const phaseDiff = neighbor.phase - node.phase;
        weightedPhaseShift += w * (phaseDiff % (2 * Math.PI));
        totalWeight += w;
      }

      if (totalWeight > 0) {
        const geodesicShift = (weightedPhaseShift / totalWeight) * 0.3;
        node.phase = (node.phase + geodesicShift + deltaPhase * node.surprise) % (2 * Math.PI);
      } else {
        node.phase = (node.phase + deltaPhase) % (2 * Math.PI);
      }

      node.amplitude = Math.max(0, Math.min(1, node.amplitude - decay * (1 - node.surprise)));
      node.surprise = Math.min(1, node.surprise + surpriseBoost * (1 - node.surprise));
      updated++;
      totalSurprise += node.surprise;
    }

    // Recompute edge phase alignments for affected edges
    for (const { id } of queue) {
      for (const edge of this.adjOut.get(id) ?? []) {
        const from = this.store.nodes[edge.fromId];
        const to = this.store.nodes[edge.toId];
        if (from && to) {
          edge.phaseAlignment = phaseAlignment(from.phase, to.phase);
        }
      }
    }

    this.persist();
    return {
      updated,
      meanSurprise: updated > 0 ? totalSurprise / updated : 0,
      latencyMs: Date.now() - t0,
    };
  }

  /**
   * Detect contradictions by content: pairs of active same-domain nodes that
   * share vocabulary but take opposing stances. `betti1` counts the connected
   * components of the contradiction subgraph minus one (an informational
   * summary, not a cohomology result).
   */
  detectContradictions(
    opts: { domain?: QPTWDomain } = {},
  ): QPTWContradictionResult {
    const nowMs = Date.now();
    const activeNodes = Object.values(this.store.nodes).filter(n => {
      if (n.invalidAt) return false;
      if (n.validTo && n.validTo < nowMs) return false;
      if (opts.domain && n.domain !== opts.domain) return false;
      return true;
    });
    if (activeNodes.length < 2) {
      return {
        betti1: 0, phaseIncoherence: 0,
        contradictions: [], isConsistent: true,
      };
    }
    const activeIds = new Set(activeNodes.map(n => n.id));

    const contradictions: QPTWContradictionResult['contradictions'] = [];
    const contraAdj = new Map<string, string[]>();

    // Explicit "contradicts" edges (created at weave time from content checks)
    for (const edge of this.store.edges) {
      if (!activeIds.has(edge.fromId) || !activeIds.has(edge.toId)) continue;
      if (edge.edgeType !== "contradicts") continue;
      const from = this.store.nodes[edge.fromId];
      const to = this.store.nodes[edge.toId];
      if (!from || !to) continue;
      if (!contradictions.some(c => (c.nodeA === from.id && c.nodeB === to.id) || (c.nodeA === to.id && c.nodeB === from.id))) {
        contradictions.push({
          nodeA: edge.fromId,
          nodeB: edge.toId,
          phaseDiff: Math.abs(from.phase - to.phase),
          interference: edge.phaseAlignment,
        });
        if (!contraAdj.has(edge.fromId)) contraAdj.set(edge.fromId, []);
        if (!contraAdj.has(edge.toId)) contraAdj.set(edge.toId, []);
        contraAdj.get(edge.fromId)!.push(edge.toId);
        contraAdj.get(edge.toId)!.push(edge.fromId);
      }
    }

    // Content-based pairwise scan across active same-domain nodes
    for (let i = 0; i < activeNodes.length; i++) {
      for (let j = i + 1; j < activeNodes.length; j++) {
        const a = activeNodes[i];
        const b = activeNodes[j];
        if (a.domain !== b.domain) continue;
        if (!isContradictory(a.content, b.content)) continue;
        const exists = this.store.edges.some(
          e => (e.fromId === a.id && e.toId === b.id) || (e.fromId === b.id && e.toId === a.id),
        ) || contradictions.some(
          c => (c.nodeA === a.id && c.nodeB === b.id) || (c.nodeA === b.id && c.nodeB === a.id),
        );
        if (exists) continue;
        contradictions.push({
          nodeA: a.id, nodeB: b.id,
          phaseDiff: Math.abs(a.phase - b.phase),
          interference: phaseAlignment(a.phase, b.phase),
        });
        if (!contraAdj.has(a.id)) contraAdj.set(a.id, []);
        if (!contraAdj.has(b.id)) contraAdj.set(b.id, []);
        contraAdj.get(a.id)!.push(b.id);
        contraAdj.get(b.id)!.push(a.id);
      }
    }

    // Compute betti1 = number of connected components in contradiction subgraph - 1
    const visited = new Set<string>();
    let components = 0;
    for (const nid of contraAdj.keys()) {
      if (visited.has(nid)) continue;
      components++;
      const q = [nid];
      visited.add(nid);
      for (let qi = 0; qi < q.length; qi++) {
        for (const nb of contraAdj.get(q[qi]) ?? []) {
          if (!visited.has(nb)) {
            visited.add(nb);
            q.push(nb);
          }
        }
      }
    }
    const betti1 = contradictions.length > 0
      ? Math.max(0, contradictions.length - components)
      : 0;

    // Phase incoherence = mean(1 - |phaseAlignment|) across all active node pairs
    let totalAlign = 0;
    let pairs = 0;
    for (let i = 0; i < activeNodes.length; i++) {
      for (let j = i + 1; j < activeNodes.length; j++) {
        totalAlign += Math.abs(phaseAlignment(activeNodes[i].phase, activeNodes[j].phase));
        pairs++;
      }
    }
    const phaseIncoherence = pairs > 0 ? 1 - totalAlign / pairs : 0;

    return {
      betti1,
      phaseIncoherence,
      contradictions,
      isConsistent: contradictions.length === 0,
    };
  }

  /**
   * Forecast risk for a domain from the coherence of its recent memories:
   * how tightly the domain's content clusters around its centroid over time.
   * High scatter (low coherence) or high instability → higher risk score.
   * The trajectory projects the current risk forward with the observed trend.
   */
  predict(
    domain: QPTWDomain,
    opts: { lookbackDays?: number; steps?: number } = {},
  ): QPTWPrediction {
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
        trajectory: Array(steps).fill(0), resonance: 0,
        explanation: `No recent ${domain} signals in QPTW manifold.`,
      };
    }
    if (domainNodes.length === 1) {
      return {
        domain, riskScore: 0.3, riskLevel: "low",
        trajectory: Array(steps).fill(domainNodes[0].amplitude * 0.3),
        resonance: 0, explanation: `Single ${domain} node — insufficient for forecasting.`,
      };
    }

    const embCache = new Map<string, Float64Array>();
    for (const n of domainNodes) {
      embCache.set(n.id, featureHashEmbed(n.content, EMBEDDING_DIM));
    }
    const centroid = domainCentroid(Array.from(embCache.values()), EMBEDDING_DIM);

    // Coherence per node vs. the domain centroid, in recency order
    const ordered = [...domainNodes].sort((a, b) => a.createdAt - b.createdAt);
    const coherences = ordered.map(n => {
      const emb = embCache.get(n.id)!;
      return Math.max(0, cosineSim(emb, centroid));
    });

    const { coherence, instability } = coherenceStats(coherences);

    // Trend over the recent window (rising coherence → falling risk)
    const window = Math.min(8, coherences.length);
    const recent = coherences.slice(-window);
    const trend = recent.length > 1
      ? (recent[recent.length - 1] - recent[0]) / (recent.length - 1)
      : 0;

    const riskScore = Math.max(0, Math.min(1, 0.7 * (1 - coherence) + 0.3 * instability));

    // Project risk forward with the observed trend (coherence up → risk down)
    const trajectory: number[] = [];
    const riskDrift = -trend * 0.1;
    for (let t = 0; t < steps; t++) {
      trajectory.push(Math.max(0, Math.min(1, riskScore + riskDrift * (t + 1))));
    }

    const resonance = coherence;
    const riskLevel: QPTWPrediction['riskLevel'] =
      riskScore > 0.6 ? "high" : riskScore > 0.3 ? "medium" : "low";

    const explanation = riskLevel === "high"
      ? `High risk in ${domain}: low domain coherence (${coherence.toFixed(2)}) with instability ${instability.toFixed(2)} across ${domainNodes.length} signals.`
      : riskLevel === "medium"
      ? `Moderate risk in ${domain}: mixed coherence (${coherence.toFixed(2)}). ${domainNodes.length} active signals monitoring.`
      : `${domain} domain stable: coherence=${coherence.toFixed(2)}, instability=${instability.toFixed(2)}.`;

    return { domain, riskScore, riskLevel, trajectory, resonance, explanation };
  }

  /**
   * Query nodes by manifold proximity + domain filter.
   *
   * O(N) — linear scan over active nodes, sorted by manifold distance.
   */
  query(
    queryText: string,
    opts: { topK?: number; domain?: QPTWDomain } = {},
  ): QPTWQueryResult {
    const nowMs = Date.now();
    const topK = opts.topK ?? 10;
    const queryEmb = featureHashEmbed(queryText, EMBEDDING_DIM);
    const queryPos: [number, number, number] = [queryEmb[0], queryEmb[1], queryEmb[2]];

    const active = Object.values(this.store.nodes).filter(n => {
      if (n.invalidAt) return false;
      if (n.validTo && n.validTo < nowMs) return false;
      if (opts.domain && n.domain !== opts.domain) return false;
      return true;
    });

    const scored = active.map(n => ({
      node: n,
      manifoldDistance: manifoldDist(queryPos, n.manifoldPos),
    }));
    scored.sort((a, b) => a.manifoldDistance - b.manifoldDistance);

    const results = scored.slice(0, topK).map(s => ({
      node: s.node,
      manifoldDistance: s.manifoldDistance,
      relevance: Math.max(0, 1 - s.manifoldDistance / MAX_MANIFOLD_DIST),
    }));

    return { results, totalCount: active.length };
  }

  /**
   * Consolidate the manifold: prune low-amplitude nodes.
   *
   * O(N) — scans all nodes, marks those below threshold as invalid.
   */
  consolidate(quenchThreshold = QUENCH_THRESHOLD): QPTWConsolidationReport {
    const nowMs = Date.now();
    let pruned = 0;
    let retained = 0;
    let totalAmp = 0;
    let totalAlign = 0;

    for (const node of Object.values(this.store.nodes)) {
      if (node.invalidAt) continue;
      if (node.validTo && node.validTo < nowMs) {
        node.invalidAt = nowMs;
        pruned++;
        continue;
      }
      if (node.amplitude < quenchThreshold) {
        node.invalidAt = nowMs;
        pruned++;
      } else {
        retained++;
        totalAmp += node.amplitude;
      }
    }

    // Phase coherence across active nodes
    const active = Object.values(this.store.nodes).filter(n => !n.invalidAt);
    if (active.length > 1) {
      let pairs = 0;
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          totalAlign += Math.abs(phaseAlignment(active[i].phase, active[j].phase));
          pairs++;
        }
      }
      totalAlign = pairs > 0 ? totalAlign / pairs : 0;
    }

    this.persist();
    return {
      pruned,
      retained,
      meanAmplitude: retained > 0 ? totalAmp / retained : 0,
      meanPhaseCoherence: totalAlign,
    };
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  exportNodes(): QPTWNode[] {
    return Object.values(this.store.nodes);
  }

  exportEdges(): QPTWEdge[] {
    return [...this.store.edges];
  }

  getNode(id: string): QPTWNode | undefined {
    return this.store.nodes[id];
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────

let _instance: QPTW | null = null;

export function getQPTW(dirOrPath: string): QPTW {
  if (!_instance || (_instance as any)['dir'] !== dirOrPath) {
    _instance = new QPTW(dirOrPath);
  }
  return _instance;
}
