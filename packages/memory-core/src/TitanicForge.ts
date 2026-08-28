// ── @timps/memory-core — TitanicForge ──
// Layer 13: Multi-view memory store with a surprise-driven persistent scratchpad.
//
// Honest description (M58):
//   TitanicForge is an incremental memory layer for the L13 slot. The public
//   API is unchanged; the internals are replaced with plain, well-understood
//   machinery:
//
//     • Embeddings       → deterministic feature-hash vectors (forgeEmbedding)
//     • Surprise         → novelty (1 − max cosine to same-domain memories)
//                          blended with a content-contradiction intensity,
//                          damped by temporal decay. A descriptive salience
//                          score, not an information-theoretic quantity.
//     • Neural module    → a fixed-seed dim×dim weight matrix, nudged by a
//                          Hebbian-style rank-1 update on high-surprise
//                          memories and persisted as a scratchpad. It is a
//                          deterministic accumulator, not a trained network.
//     • Multi-view edges → semantic (high cosine), temporal (same day bucket),
//                          causal (explicit parent), entity (shared proper
//                          nouns) — four thin projections of the same graph.
//     • Policy router    → picks the view with the most informative signal for
//                          a query (a weighted heuristic, not RL).
//     • Prediction       → risk from recent domain coherence + mean surprise,
//                          not sinusoids.
//
//   No benchmark superiority is claimed. Big-O: weave O(N·d) for the
//   same-domain scan, query O(N·d).

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { StorageBackend } from './backends/types.js';
import {
  featureHashEmbed,
  cosineSim,
  domainCentroid,
  coherenceStats,
  isContradictory,
  fnv1a,
} from './forgeEmbedding.js';

// ── Types ─────────────────────────────────────────────────────────────────

export type TitanicDomain =
  | "burnout" | "relationship" | "decision" | "code_pattern"
  | "contradiction" | "goal" | "general";

export type TitanicViewType = "semantic" | "temporal" | "causal" | "entity";

export interface TitanicNode {
  id: string;
  content: string;
  domain: TitanicDomain;
  /** Dense 64-dim embedding */
  embedding: number[];
  /** Surprise score at weave time */
  surprise: number;
  /** Content-contradiction intensity at weave time */
  h1Contribution: number;
  /** Multi-view projections */
  semanticTags: string[];
  temporalBucket: number;
  causalParentId: string | null;
  entityMentions: string[];
  /** Bi-temporal validity */
  validFrom: number;
  validTo: number | null;
  invalidAt: number | null;
  tags: string[];
  retrievalCount: number;
  createdAt: number;
}

export interface TitanicEdge {
  fromId: string;
  toId: string;
  weight: number;
  viewType: TitanicViewType;
  createdAt: number;
}

export interface TitanicStore {
  nodes: Record<string, TitanicNode>;
  edges: TitanicEdge[];
  /** Neural weight matrix W (dim × dim) stored as flat array */
  neuralWeights: number[];
  /** Number of neural updates performed */
  neuralUpdateCount: number;
}

export interface TitanicWeaveResult {
  nodeId: string;
  content: string;
  domain: TitanicDomain;
  surprise: number;
  h1Contribution: number;
  neuralUpdated: boolean;
}

export interface TitanicSurpriseResult {
  nodeId: string;
  surprise: number;
  novelty: number;
  h1Factor: number;
  temporalDecay: number;
}

export interface TitanicQueryResult {
  results: Array<{
    node: TitanicNode;
    score: number;
    viewContributions: Partial<Record<TitanicViewType, number>>;
  }>;
  totalCount: number;
  policyDecision: TitanicViewType;
}

export interface TitanicConsolidationReport {
  pruned: number;
  retained: number;
  meanSurprise: number;
  neuralUpdateCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const EMBEDDING_DIM = 64;
const SURPRISE_THRESHOLD = 0.3;
const NEURAL_LR = 0.01;
const QUENCH_THRESHOLD = 0.05;
const SIMILARITY_THRESHOLD = 0.7;
const TEMPORAL_BUCKET_MS = 86_400_000; // 1 day
const LOOKBACK_DAYS = 14;
const TRAJECTORY_STEPS = 12;

/** Words that are capitalized but are not real entities. */
const COMMON_CAPITALIZED = new Set([
  "The", "A", "An", "This", "That", "These", "Those", "And", "Or", "For",
  "With", "Without", "Use", "Using", "Used", "Is", "Are", "Was", "Were",
  "Be", "Been", "Being", "It", "Its", "I", "We", "You", "They", "He", "She",
  "In", "On", "At", "By", "From", "To", "Of", "Not", "But", "If", "As",
]);

// ── Deterministic helpers ─────────────────────────────────────────────────

/**
 * Deterministic small random initialization for the scratchpad matrix.
 * Fixed seed → reproducible across runs; this is not a trained prior.
 */
function initNeuralWeights(dim: number): Float64Array {
  const scale = Math.sqrt(2 / (dim + dim));
  const w = new Float64Array(dim * dim);
  for (let i = 0; i < dim * dim; i++) {
    w[i] = ((fnv1a(`neural:${i}`) / 0xffffffff) * 2 - 1) * scale;
  }
  return w;
}

// ── TitanicForge Class ────────────────────────────────────────────────────

export class TitanicForge {
  private dim: number;
  private dir: string;
  private storeFile: string;
  private store: TitanicStore;
  private _backend?: StorageBackend;
  /** Neural weight as flat array: W[row * dim + col] */
  private W: Float64Array;
  private adjOut: Map<string, TitanicEdge[]>;
  private adjIn: Map<string, TitanicEdge[]>;
  private embCache: Map<string, Float64Array>;

  constructor(dir: string, backend?: StorageBackend, dim = EMBEDDING_DIM) {
    this.dim = dim;
    this.dir = dir;
    this._backend = backend;
    this.storeFile = path.join(dir, "titanic-store.json");
    this.store = this.loadStore();
    this.W = new Float64Array(this.store.neuralWeights);
    this.adjOut = new Map();
    this.adjIn = new Map();
    this.embCache = new Map();
    this.rebuildAdjacency();
    this.warmCache();
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private loadStore(): TitanicStore {
    if (this._backend) {
      const result = this._backend.read('titanic/titanic.json');
      if (result) return result as TitanicStore;
      const w = initNeuralWeights(this.dim);
      return { nodes: {}, edges: [], neuralWeights: Array.from(w), neuralUpdateCount: 0 };
    }
    try {
      if (!fs.existsSync(this.storeFile)) {
        const w = initNeuralWeights(this.dim);
        return { nodes: {}, edges: [], neuralWeights: Array.from(w), neuralUpdateCount: 0 };
      }
      return JSON.parse(fs.readFileSync(this.storeFile, "utf-8"));
    } catch {
      const w = initNeuralWeights(this.dim);
      return { nodes: {}, edges: [], neuralWeights: Array.from(w), neuralUpdateCount: 0 };
    }
  }

  private persist(): void {
    this.store.neuralWeights = Array.from(this.W);
    if (this._backend) {
      this._backend.write('titanic/titanic.json', this.store);
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

  private addEdge(edge: TitanicEdge): void {
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

  // ── Neural scratchpad (deterministic, persisted) ────────────────────────

  /**
   * Rank-1 Hebbian-style update: strengthen the directions a surprising
   * memory activates. Deterministic; only aggregate behavior is meaningful.
   */
  private neuralUpdate(x: Float64Array, surprise: number): void {
    if (this.store.neuralUpdateCount >= 1000) return;
    for (let i = 0; i < this.dim; i++) {
      for (let j = 0; j < this.dim; j++) {
        this.W[i * this.dim + j] += NEURAL_LR * surprise * x[i] * x[j];
      }
    }
    this.store.neuralUpdateCount++;
  }

  /** Scratchpad readout: how well the query's transformed embedding aligns. */
  private neuralReadout(queryEmb: Float64Array, nodeEmb: Float64Array): number {
    const out = new Float64Array(this.dim);
    for (let i = 0; i < this.dim; i++) {
      let sum = 0;
      for (let j = 0; j < this.dim; j++) {
        sum += this.W[i * this.dim + j] * queryEmb[j];
      }
      out[i] = sum;
    }
    return Math.max(0, cosineSim(out, nodeEmb)) * 0.3;
  }

  // ── Surprise computation ────────────────────────────────────────────────

  /**
   * Compute the surprise score for a new embedding:
   *
   *   surprise = (0.7 · novelty + 0.3 · h1Factor) · temporalDecay
   *
   * novelty      = 1 − max cosine to existing same-domain nodes (0.5 when none)
   * h1Factor     = content-contradiction intensity, 0..1 (2+ contradictions = 1)
   * temporalDecay = exp(−age_days / 30) of the newest same-domain node
   *
   * All components are clamped to [0, 1]; this is a salience heuristic, not a
   * probability.
   */
  computeSurprise(
    emb: Float64Array,
    domain: TitanicDomain,
    h1Approx: number,
  ): TitanicSurpriseResult {
    const nowMs = Date.now();

    const sameDomain = Object.values(this.store.nodes).filter(
      n => n.domain === domain && !n.invalidAt,
    );
    let maxSim = 0;
    for (const n of sameDomain) {
      const sim = cosineSim(emb, new Float64Array(n.embedding));
      if (sim > maxSim) maxSim = sim;
    }
    const novelty = sameDomain.length > 0 ? 1 - maxSim : 0.5;

    const h1Factor = Math.min(1, (h1Approx ?? 0) / 2);

    let maxAge = 0;
    for (const n of sameDomain) {
      const age = nowMs - n.createdAt;
      if (age > maxAge) maxAge = age;
    }
    const temporalDecay = maxAge > 0 ? Math.exp(-maxAge / (30 * 86_400_000)) : 1.0;

    const surprise = Math.max(0, Math.min(1,
      (0.7 * novelty + 0.3 * h1Factor) * temporalDecay,
    ));

    return {
      nodeId: "",
      surprise,
      novelty,
      h1Factor,
      temporalDecay,
    };
  }

  // ── Multi-view projections ──────────────────────────────────────────────

  /** Compute multi-view tags for a new node based on content and domain. */
  private projectViews(
    content: string,
    domain: TitanicDomain,
  ): {
    semanticTags: string[];
    temporalBucket: number;
    entityMentions: string[];
  } {
    const words = content.toLowerCase().split(/[^a-z0-9_]+/).filter(w => w.length > 2);
    const semanticTags = [...new Set(words)].slice(0, 10);

    const temporalBucket = Math.floor(Date.now() / TEMPORAL_BUCKET_MS);

    const entityMentions: string[] = [];
    const tokens = content.split(/[^a-zA-Z0-9_]+/);
    for (const t of tokens) {
      if (
        t.length >= 2 &&
        t[0] === t[0].toUpperCase() &&
        t[0] !== t[0].toLowerCase() &&
        !COMMON_CAPITALIZED.has(t)
      ) {
        entityMentions.push(t);
      }
    }

    return { semanticTags, temporalBucket, entityMentions: [...new Set(entityMentions)] };
  }

  // ── Policy router ───────────────────────────────────────────────────────

  /**
   * Score each view's relevance to a query embedding. Each view gets a
   * descriptive signal strength; the highest-scoring view is the policy
   * decision for this query.
   */
  private routeQuery(
    queryEmb: Float64Array,
    domain?: TitanicDomain,
  ): { bestView: TitanicViewType; scores: Record<TitanicViewType, number> } {
    const nowMs = Date.now();
    const active = Object.values(this.store.nodes).filter(n => {
      if (n.invalidAt) return false;
      if (n.validTo && n.validTo < nowMs) return false;
      if (domain && n.domain !== domain) return false;
      return true;
    });
    if (active.length === 0) {
      return { bestView: "semantic", scores: { semantic: 1, temporal: 0, causal: 0, entity: 0 } };
    }

    const scores: Record<TitanicViewType, number> = { semantic: 0, temporal: 0, causal: 0, entity: 0 };

    // Semantic: mean cosine similarity to all active nodes.
    let semScore = 0;
    for (const n of active) semScore += cosineSim(queryEmb, new Float64Array(n.embedding));
    scores.semantic = semScore / active.length;

    // Temporal: fraction of active nodes created within the last 7 days.
    const recentCount = active.filter(n => n.createdAt > nowMs - 7 * 86_400_000).length;
    scores.temporal = recentCount / active.length;

    // Causal: density of causal edges relative to node count.
    const causalEdges = this.store.edges.filter(e => e.viewType === "causal");
    scores.causal = Math.min(1, causalEdges.length / active.length);

    // Entity: entity mention density.
    const entityMentions = active.reduce((s, n) => s + n.entityMentions.length, 0);
    scores.entity = Math.min(1, entityMentions / (active.length * 2));

    const bestView = (Object.entries(scores) as [TitanicViewType, number][])
      .sort((a, b) => b[1] - a[1])[0][0];

    return { bestView, scores };
  }

  // ── Core API ─────────────────────────────────────────────────────────────

  /**
   * Weave a new memory node.
   *
   * 1. Compute dense embedding
   * 2. Compute content-contradiction intensity against existing memories
   * 3. Compute surprise = novelty × contradiction × temporal decay
   * 4. If surprise > threshold, nudge the neural scratchpad
   * 5. Add multi-view projections and edges
   */
  weave(
    content: string,
    opts: {
      domain?: TitanicDomain;
      causalParentId?: string | null;
      tags?: string[];
      validFrom?: number;
      validTo?: number | null;
    } = {},
  ): TitanicWeaveResult {
    const nowMs = Date.now();
    const domain: TitanicDomain = opts.domain ?? "general";
    const nodeId = `titanic_${nowMs.toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
    const emb = featureHashEmbed(content, EMBEDDING_DIM);
    this.embCache.set(nodeId, emb);

    // Content-contradiction intensity against existing active memories.
    const active = Object.values(this.store.nodes).filter(n => !n.invalidAt);
    let contradictionCount = 0;
    for (const n of active) {
      if (isContradictory(content, n.content)) contradictionCount++;
    }
    const h1Approx = contradictionCount;

    const sResult = this.computeSurprise(emb, domain, h1Approx);

    // Neural scratchpad update on high surprise.
    let neuralUpdated = false;
    if (sResult.surprise > SURPRISE_THRESHOLD) {
      this.neuralUpdate(emb, sResult.surprise);
      neuralUpdated = true;
    }

    const views = this.projectViews(content, domain);

    const node: TitanicNode = {
      id: nodeId,
      content,
      domain,
      embedding: Array.from(emb),
      surprise: sResult.surprise,
      h1Contribution: h1Approx,
      semanticTags: views.semanticTags,
      temporalBucket: views.temporalBucket,
      causalParentId: opts.causalParentId ?? null,
      entityMentions: views.entityMentions,
      validFrom: opts.validFrom ?? nowMs,
      validTo: opts.validTo ?? null,
      invalidAt: null,
      tags: opts.tags ?? [],
      retrievalCount: 0,
      createdAt: nowMs,
    };
    this.store.nodes[nodeId] = node;

    // Causal edge from the explicit parent, if any.
    if (opts.causalParentId && this.store.nodes[opts.causalParentId]) {
      this.addEdge({
        fromId: opts.causalParentId,
        toId: nodeId,
        weight: 1.0,
        viewType: "causal",
        createdAt: nowMs,
      });
    }

    // Semantic edges to highly similar same-domain nodes.
    const candidates = Object.values(this.store.nodes).filter(
      n => n.id !== nodeId && !n.invalidAt && n.domain === domain,
    );
    for (const c of candidates) {
      const sim = cosineSim(emb, new Float64Array(c.embedding));
      if (sim > SIMILARITY_THRESHOLD) {
        this.addEdge({
          fromId: nodeId,
          toId: c.id,
          weight: sim,
          viewType: "semantic",
          createdAt: nowMs,
        });
      }
    }

    // Temporal edges to nodes in the same day bucket.
    const sameBucket = Object.values(this.store.nodes).filter(
      n => n.id !== nodeId && !n.invalidAt && n.temporalBucket === views.temporalBucket,
    );
    for (const c of sameBucket.slice(0, 20)) {
      this.addEdge({
        fromId: nodeId,
        toId: c.id,
        weight: 0.5,
        viewType: "temporal",
        createdAt: nowMs,
      });
    }

    // Entity edges where proper-noun mentions overlap.
    if (views.entityMentions.length > 0) {
      for (const c of candidates) {
        const shared = c.entityMentions.filter(e => views.entityMentions.includes(e));
        if (shared.length > 0) {
          this.addEdge({
            fromId: nodeId,
            toId: c.id,
            weight: shared.length / Math.max(views.entityMentions.length, 1),
            viewType: "entity",
            createdAt: nowMs,
          });
        }
      }
    }

    this.persist();
    return {
      nodeId, content, domain,
      surprise: sResult.surprise,
      h1Contribution: h1Approx,
      neuralUpdated,
    };
  }

  /**
   * Query with hybrid scoring: cosine + scratchpad readout + per-view boosts.
   *
   * 1. Policy router selects the best view for this query
   * 2. Score nodes by cosine similarity
   * 3. Add a small scratchpad readout term
   * 4. Add per-view contribution terms
   * 5. Return top-K
   */
  query(
    queryText: string,
    opts: { topK?: number; domain?: TitanicDomain } = {},
  ): TitanicQueryResult {
    const topK = opts.topK ?? 10;
    const queryEmb = featureHashEmbed(queryText, EMBEDDING_DIM);

    const policy = this.routeQuery(queryEmb, opts.domain);

    const nowMs = Date.now();
    const active = Object.values(this.store.nodes).filter(n => {
      if (n.invalidAt) return false;
      if (n.validTo && n.validTo < nowMs) return false;
      if (opts.domain && n.domain !== opts.domain) return false;
      return true;
    });

    const scored = active.map(n => {
      const nEmb = this.embCache.get(n.id) ?? new Float64Array(n.embedding);
      const cosScore = cosineSim(queryEmb, nEmb);
      const neuralBoost = this.neuralReadout(queryEmb, nEmb);
      const viewContributions: Partial<Record<TitanicViewType, number>> = {
        semantic: Math.max(0, cosScore * 0.2),
        temporal: n.createdAt > nowMs - 7 * 86_400_000 ? 0.2 : 0,
        causal: (this.adjOut.get(n.id) ?? []).length > 0 ? 0.15 : 0,
        entity: n.entityMentions.length > 0 ? 0.15 : 0,
      };
      const score =
        cosScore + neuralBoost +
        (viewContributions.semantic ?? 0) +
        (viewContributions.temporal ?? 0) +
        (viewContributions.causal ?? 0) +
        (viewContributions.entity ?? 0);
      return { node: n, score, viewContributions };
    });

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, topK);

    return {
      results,
      totalCount: active.length,
      policyDecision: policy.bestView,
    };
  }

  /**
   * Predict risk for a domain from the coherence of its recent memories and
   * their mean surprise. Trajectory projects current risk forward with the
   * observed coherence trend.
   */
  predict(
    domain: TitanicDomain,
    opts: { lookbackDays?: number; steps?: number } = {},
  ): {
    domain: TitanicDomain;
    riskScore: number;
    riskLevel: "high" | "medium" | "low";
    trajectory: number[];
    meanSurprise: number;
    explanation: string;
  } {
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
        trajectory: Array(steps).fill(0), meanSurprise: 0,
        explanation: `No ${domain} signals in TitanicForge.`,
      };
    }

    const meanSurprise = domainNodes.reduce((s, n) => s + n.surprise, 0) / domainNodes.length;

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
      0.3 * instability +
      0.2 * meanSurprise,
    ));

    const trajectory: number[] = [];
    const riskDrift = -trend * 0.1;
    for (let t = 0; t < steps; t++) {
      trajectory.push(Math.max(0, Math.min(1, riskScore + riskDrift * (t + 1))));
    }

    const riskLevel: "high" | "medium" | "low" =
      riskScore > 0.6 ? "high" : riskScore > 0.3 ? "medium" : "low";

    return {
      domain, riskScore, riskLevel, trajectory, meanSurprise,
      explanation: `${domain}: ${domainNodes.length} nodes, mean surprise ${meanSurprise.toFixed(3)}, risk ${riskLevel}.`,
    };
  }

  /**
   * Consolidate: prune low-surprise (quenched) nodes.
   * O(N).
   */
  consolidate(quenchThreshold = QUENCH_THRESHOLD): TitanicConsolidationReport {
    const nowMs = Date.now();
    let pruned = 0;
    let retained = 0;
    let totalSurprise = 0;

    for (const node of Object.values(this.store.nodes)) {
      if (node.invalidAt) continue;
      if (node.validTo && node.validTo < nowMs) {
        node.invalidAt = nowMs;
        pruned++;
        continue;
      }
      if (node.surprise < quenchThreshold) {
        node.invalidAt = nowMs;
        pruned++;
      } else {
        retained++;
        totalSurprise += node.surprise;
      }
    }

    this.persist();
    return {
      pruned,
      retained,
      meanSurprise: retained > 0 ? totalSurprise / retained : 0,
      neuralUpdateCount: this.store.neuralUpdateCount,
    };
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  exportNodes(): TitanicNode[] {
    return Object.values(this.store.nodes);
  }

  exportEdges(): TitanicEdge[] {
    return [...this.store.edges];
  }

  getNode(id: string): TitanicNode | undefined {
    return this.store.nodes[id];
  }

  getNeuralWeight(i: number, j: number): number {
    return this.W[i * this.dim + j];
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────

let _instance: TitanicForge | null = null;

export function getTitanicForge(dirOrPath: string): TitanicForge {
  if (!_instance || (_instance as any)['dir'] !== dirOrPath) {
    _instance = new TitanicForge(dirOrPath);
  }
  return _instance;
}
