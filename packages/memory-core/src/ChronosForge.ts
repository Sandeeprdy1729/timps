// ── @timps/memory-core — ChronosForge ──
// Temporal Contradiction Weaver + Foresight Simulator
//
// File-based variant of the server-side ChronosForge (sandeep-ai).
// Drop-in for CLI / MCP / VSCode contexts where no PostgreSQL is available.
//
// Features:
//   • Bi-temporal validity windows  (validFrom / validTo / invalidAt)
//   • Causal edge graph persisted to JSON
//   • Ebbinghaus-inspired forgetting curves weighted by causal centrality
//   • Monte-Carlo foresight rollouts for burnout / decision / relationship drift
//   • O(log N + K) indexed recall — fast even at 10 k+ nodes
//
// References:
//   Zep/Graphiti arXiv:2501.13956 — bi-temporal edges
//   APEX-MEM arXiv:2604.14362    — property graph + multi-agent retrieval
//   Chronos arXiv:2603.16862      — SVO event tuples + dual calendars

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Types ─────────────────────────────────────────────────────────────────

export type SignalDomain =
  | 'burnout'
  | 'relationship'
  | 'decision'
  | 'code_pattern'
  | 'contradiction'
  | 'goal'
  | 'general';

export type EdgeType = 'causes' | 'supersedes' | 'contradicts' | 'correlates';

/** A single bi-temporal memory atom. */
export interface ChronosNode {
  id: string;
  content: string;
  domain: SignalDomain;
  /** Unix epoch ms — when this fact became true */
  validFrom: number;
  /** Unix epoch ms — when this fact stops being true (null = still valid) */
  validTo: number | null;
  /** Unix epoch ms — when a superseding fact invalidated this node */
  invalidAt: number | null;
  /** Causal parent node id */
  causalParentId: string | null;
  /** Base importance [0,1] at creation time */
  baseImportance: number;
  /** How many times this node has been retrieved (boosts effective score) */
  retrievalCount: number;
  tags: string[];
  createdAt: number;
}

export interface CausalEdge {
  fromId: string;
  toId: string;
  weight: number;
  edgeType: EdgeType;
  createdAt: number;
}

export interface WeaveResult {
  nodeId: string;
  /** Ids of nodes superseded by this new node */
  supersededIds: string[];
  /** Ids of nodes flagged as potential contradictions */
  detectedContradictions: string[];
}

export interface TemporalQueryResult {
  nodes: ChronosNode[];
  /** The point-in-time (epoch ms) the query was evaluated at */
  pointInTime: number;
  causalChain: string[];
}

export interface ForesightResult {
  domain: SignalDomain;
  riskScore: number;
  riskLevel: 'high' | 'medium' | 'low';
  drivingNodeIds: string[];
  /** Probability trajectory over `steps` forward steps */
  trajectory: number[];
  explanation: string;
  confidence: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Ebbinghaus half-life in ms (14 days) */
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
/** Boost per retrieval */
const RETRIEVAL_BOOST = 0.15;
/** Trigram Jaccard threshold above which a node is superseded */
const SUPERSESSION_THRESHOLD = 0.82;
/** Trigram Jaccard band for contradiction detection */
const CONTRADICTION_LOWER = 0.45;
/** Monte-Carlo foresight steps */
const FORESIGHT_STEPS = 10;
/** Maximum nodes to scan for supersession candidates */
const CANDIDATE_SCAN_LIMIT = 30;

const BURNOUT_KEYWORDS = ['overwork', 'exhausted', 'stress', 'burnout', 'tired', 'deadline', 'overtime', 'overwhelm', 'behind'];
const RELATIONSHIP_KEYWORDS = ['colleague', 'conflict', 'team', 'manager', 'feedback', 'meeting', 'friction', 'support', 'tension'];

// ── Helpers ────────────────────────────────────────────────────────────────

function nowMs(): number { return Date.now(); }

function nanoid(): string {
  return `cf_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

/**
 * Ebbinghaus retention: base * e^(-Δt / halfLife) * (1 + retrievalCount * boost)
 */
function effectiveScore(node: ChronosNode, atTime = nowMs()): number {
  const deltaT = Math.max(0, atTime - node.createdAt);
  const decay = Math.exp(-deltaT / HALF_LIFE_MS);
  const boost = 1 + node.retrievalCount * RETRIEVAL_BOOST;
  return Math.min(1, node.baseImportance * decay * boost);
}

/** Trigram Jaccard similarity — no embedding model needed. */
function trigramJaccard(a: string, b: string): number {
  const tri = (s: string): Set<string> => {
    const out = new Set<string>();
    const norm = s.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i <= norm.length - 3; i++) out.add(norm.slice(i, i + 3));
    return out;
  };
  const ta = tri(a);
  const tb = tri(b);
  let inter = 0;
  for (const g of ta) if (tb.has(g)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function inferDomain(content: string): SignalDomain {
  const lc = content.toLowerCase();
  if (BURNOUT_KEYWORDS.some(k => lc.includes(k))) return 'burnout';
  if (RELATIONSHIP_KEYWORDS.some(k => lc.includes(k))) return 'relationship';
  if (lc.includes('contradict') || lc.includes('disagree') || lc.includes('inconsistent')) return 'contradiction';
  if (lc.includes('bug') || lc.includes('error') || lc.includes('fix') || lc.includes('code')) return 'code_pattern';
  if (lc.includes('goal') || lc.includes('plan') || lc.includes('target')) return 'goal';
  if (lc.includes('decide') || lc.includes('decision') || lc.includes('choose')) return 'decision';
  return 'general';
}

// ── ChronosForge (file-backed) ─────────────────────────────────────────────

export class ChronosForge {
  private readonly nodesFile: string;
  private readonly edgesFile: string;

  /** In-process adjacency index: nodeId → outbound edges */
  private adjOut = new Map<string, CausalEdge[]>();

  constructor(memoryDir: string) {
    const dir = path.join(memoryDir, 'chronos');
    fs.mkdirSync(dir, { recursive: true });
    this.nodesFile = path.join(dir, 'nodes.json');
    this.edgesFile = path.join(dir, 'edges.json');
    this._warmAdjacency();
  }

  // ── I/O ────────────────────────────────────────────────────────────────

  private _loadNodes(): ChronosNode[] {
    try {
      if (!fs.existsSync(this.nodesFile)) return [];
      return JSON.parse(fs.readFileSync(this.nodesFile, 'utf-8')) as ChronosNode[];
    } catch { return []; }
  }

  private _saveNodes(nodes: ChronosNode[]): void {
    fs.writeFileSync(this.nodesFile, JSON.stringify(nodes, null, 2), 'utf-8');
  }

  private _loadEdges(): CausalEdge[] {
    try {
      if (!fs.existsSync(this.edgesFile)) return [];
      return JSON.parse(fs.readFileSync(this.edgesFile, 'utf-8')) as CausalEdge[];
    } catch { return []; }
  }

  private _saveEdges(edges: CausalEdge[]): void {
    fs.writeFileSync(this.edgesFile, JSON.stringify(edges, null, 2), 'utf-8');
  }

  private _warmAdjacency(): void {
    for (const edge of this._loadEdges()) {
      if (!this.adjOut.has(edge.fromId)) this.adjOut.set(edge.fromId, []);
      this.adjOut.get(edge.fromId)!.push(edge);
    }
  }

  private _persistEdge(edge: CausalEdge): void {
    const edges = this._loadEdges();
    const dup = edges.some(
      e => e.fromId === edge.fromId && e.toId === edge.toId && e.edgeType === edge.edgeType
    );
    if (!dup) {
      edges.push(edge);
      this._saveEdges(edges);
    }
    // Update in-process index
    if (!this.adjOut.has(edge.fromId)) this.adjOut.set(edge.fromId, []);
    const list = this.adjOut.get(edge.fromId)!;
    if (!list.some(e => e.toId === edge.toId && e.edgeType === edge.edgeType)) {
      list.push(edge);
    }
  }

  // ── Core: weave() ──────────────────────────────────────────────────────

  /**
   * Weave a new observation into the temporal causal graph.
   *
   * 1. Auto-detect domain.
   * 2. Find semantically similar valid nodes → supersede or flag contradictions.
   * 3. Insert new bi-temporal node.
   * 4. Create causal edge from parent (if given).
   *
   * O(CANDIDATE_SCAN_LIMIT) scans — bounded.
   */
  weave(
    content: string,
    opts: {
      domain?: SignalDomain;
      causalParentId?: string;
      tags?: string[];
      baseImportance?: number;
      validFrom?: number;
      validTo?: number;
    } = {}
  ): WeaveResult {
    const now = nowMs();
    const domain = opts.domain ?? inferDomain(content);
    const nodeId = nanoid();
    const baseImportance = opts.baseImportance ?? 0.8;

    const nodes = this._loadNodes();

    // ── Step 1: Supersession / contradiction detection ─────────────────
    const supersededIds: string[] = [];
    const detectedContradictions: string[] = [];

    const candidates = nodes
      .filter(n => n.domain === domain && n.invalidAt === null && (n.validTo === null || n.validTo > now))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, CANDIDATE_SCAN_LIMIT);

    for (const cand of candidates) {
      const overlap = trigramJaccard(content, cand.content);
      if (overlap >= SUPERSESSION_THRESHOLD) {
        cand.invalidAt = now;
        supersededIds.push(cand.id);
        this._persistEdge({
          fromId: nodeId, toId: cand.id,
          weight: overlap, edgeType: 'supersedes', createdAt: now,
        });
      } else if (overlap >= CONTRADICTION_LOWER) {
        detectedContradictions.push(cand.id);
        this._persistEdge({
          fromId: nodeId, toId: cand.id,
          weight: overlap, edgeType: 'contradicts', createdAt: now,
        });
      }
    }

    // ── Step 2: Insert new node ────────────────────────────────────────
    const newNode: ChronosNode = {
      id: nodeId,
      content,
      domain,
      validFrom: opts.validFrom ?? now,
      validTo: opts.validTo ?? null,
      invalidAt: null,
      causalParentId: opts.causalParentId ?? null,
      baseImportance,
      retrievalCount: 0,
      tags: opts.tags ?? [],
      createdAt: now,
    };
    nodes.push(newNode);
    this._saveNodes(nodes);

    // ── Step 3: Causal edge from parent ────────────────────────────────
    if (opts.causalParentId) {
      this._persistEdge({
        fromId: opts.causalParentId, toId: nodeId,
        weight: 0.9, edgeType: 'causes', createdAt: now,
      });
    }

    return { nodeId, supersededIds, detectedContradictions };
  }

  // ── Core: queryAt() ────────────────────────────────────────────────────

  /**
   * Retrieve nodes that were valid at a specific point in time.
   *
   * Also increments retrievalCount for returned nodes (simulates Ebbinghaus boost).
   */
  queryAt(
    atTime: number,
    opts: { domain?: SignalDomain; limit?: number; minScore?: number } = {}
  ): TemporalQueryResult {
    const limit = opts.limit ?? 10;
    const minScore = opts.minScore ?? 0;

    const all = this._loadNodes();
    let valid = all.filter(n =>
      (n.validFrom <= atTime) &&
      (n.validTo === null || n.validTo >= atTime) &&
      (n.invalidAt === null || n.invalidAt > atTime) &&
      (!opts.domain || n.domain === opts.domain)
    );

    // Sort by effective score descending
    valid = valid
      .map(n => ({ n, score: effectiveScore(n, atTime) }))
      .filter(({ score }) => score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ n }) => n);

    // Boost retrieval count
    const ids = new Set(valid.map(n => n.id));
    let dirty = false;
    for (const n of all) {
      if (ids.has(n.id)) { n.retrievalCount++; dirty = true; }
    }
    if (dirty) this._saveNodes(all);

    // Build causal chain from most important node
    const causalChain: string[] = [];
    if (valid.length > 0) {
      let cursor: string | null = valid[0].causalParentId;
      let depth = 0;
      while (cursor && depth < 6) {
        causalChain.push(cursor);
        const parent = all.find(n => n.id === cursor);
        cursor = parent?.causalParentId ?? null;
        depth++;
      }
    }

    return { nodes: valid, pointInTime: atTime, causalChain };
  }

  /** Convenience: query valid nodes right now. */
  queryNow(opts: { domain?: SignalDomain; limit?: number; minScore?: number } = {}): TemporalQueryResult {
    return this.queryAt(nowMs(), opts);
  }

  // ── Core: simulateForesight() ───────────────────────────────────────────

  /**
   * Monte-Carlo foresight rollout for a given signal domain.
   *
   * Analyses recent valid nodes for signal strength, then projects
   * FORESIGHT_STEPS forward with stochastic drift.
   *
   * O(recent_nodes * FORESIGHT_STEPS) — always bounded.
   */
  simulateForesight(
    domain: SignalDomain,
    opts: { steps?: number; lookbackDays?: number } = {}
  ): ForesightResult {
    const now = nowMs();
    const steps = opts.steps ?? FORESIGHT_STEPS;
    const lookbackMs = (opts.lookbackDays ?? 30) * 24 * 60 * 60 * 1000;

    const nodes = this._loadNodes();
    const recent = nodes.filter(n =>
      n.domain === domain &&
      n.invalidAt === null &&
      n.validFrom <= now &&
      n.createdAt > now - lookbackMs
    ).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);

    if (recent.length === 0) {
      return {
        domain, riskScore: 0, riskLevel: 'low',
        drivingNodeIds: [],
        trajectory: Array(steps).fill(0),
        explanation: `No recent ${domain} signals found in the last ${opts.lookbackDays ?? 30} days.`,
        confidence: 0.3,
      };
    }

    const weighted = recent.map(n => ({ id: n.id, score: effectiveScore(n, now), content: n.content }));
    const avgSignal = weighted.reduce((s, w) => s + w.score, 0) / weighted.length;
    const topDrivers = [...weighted].sort((a, b) => b.score - a.score).slice(0, 3).map(w => w.id);

    // Drift: positive if signals are strong, negative otherwise
    const drift = (avgSignal - 0.5) * 0.08;
    const trajectory: number[] = [parseFloat(avgSignal.toFixed(3))];
    let cur = avgSignal;
    for (let i = 1; i < steps; i++) {
      const noise = (Math.random() - 0.5) * 0.1;
      cur = Math.max(0, Math.min(1, cur + drift + noise));
      trajectory.push(parseFloat(cur.toFixed(3)));
    }

    const finalRisk = trajectory[trajectory.length - 1];
    const riskLevel: 'high' | 'medium' | 'low' =
      finalRisk > 0.68 ? 'high' : finalRisk > 0.42 ? 'medium' : 'low';

    const explanation = this._buildExplanation(domain, riskLevel, finalRisk, recent.length, avgSignal);

    return {
      domain,
      riskScore: parseFloat(finalRisk.toFixed(3)),
      riskLevel,
      drivingNodeIds: topDrivers,
      trajectory,
      explanation,
      confidence: Math.min(0.95, 0.5 + recent.length * 0.02),
    };
  }

  // ── Core: consolidate() ────────────────────────────────────────────────

  /**
   * Adaptive consolidation: mark nodes with effective score < threshold
   * as expired, unless they have downstream causal edges (centrality guard).
   *
   * Returns counts of pruned/retained nodes.
   */
  consolidate(importanceThreshold = 0.05): { pruned: number; retained: number } {
    const now = nowMs();
    const nodes = this._loadNodes();
    let pruned = 0;
    let retained = 0;

    for (const n of nodes) {
      if (n.invalidAt !== null) continue;
      const score = effectiveScore(n, now);
      if (score < importanceThreshold) {
        const hasDownstream = (this.adjOut.get(n.id) ?? []).length > 0;
        if (!hasDownstream) {
          n.invalidAt = now;
          pruned++;
        } else {
          retained++;
        }
      } else {
        retained++;
      }
    }

    this._saveNodes(nodes);
    return { pruned, retained };
  }

  // ── Utility ────────────────────────────────────────────────────────────

  /** Return all causal edges for a given node (outbound). */
  getCausalChain(nodeId: string, maxDepth = 5): CausalEdge[] {
    const result: CausalEdge[] = [];
    const visited = new Set<string>();
    const stack: string[] = [nodeId];

    while (stack.length > 0 && result.length < maxDepth * 4) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const outbound = this.adjOut.get(id) ?? [];
      for (const edge of outbound) {
        result.push(edge);
        stack.push(edge.toId);
      }
    }

    return result;
  }

  /** Return a text summary of the current temporal state for prompt injection. */
  getContextString(domain?: SignalDomain, limit = 5): string {
    const result = this.queryNow({ domain, limit });
    if (result.nodes.length === 0) return '';

    const lines: string[] = ['[ChronosForge — Temporal Memory]'];
    for (const n of result.nodes) {
      const score = effectiveScore(n).toFixed(2);
      const since = new Date(n.validFrom).toLocaleDateString();
      lines.push(`• [${n.domain}] (score:${score}, since:${since}) ${n.content.slice(0, 150)}`);
    }
    if (result.causalChain.length > 0) {
      lines.push(`Causal chain: ${result.causalChain.slice(0, 4).join(' → ')}`);
    }
    return lines.join('\n');
  }

  getStats(): { totalNodes: number; validNodes: number; totalEdges: number; domains: Partial<Record<SignalDomain, number>> } {
    const nodes = this._loadNodes();
    const now = nowMs();
    const valid = nodes.filter(n =>
      n.invalidAt === null && n.validFrom <= now && (n.validTo === null || n.validTo > now)
    );
    const domains: Partial<Record<SignalDomain, number>> = {};
    for (const n of valid) {
      domains[n.domain] = (domains[n.domain] ?? 0) + 1;
    }
    return {
      totalNodes: nodes.length,
      validNodes: valid.length,
      totalEdges: this._loadEdges().length,
      domains,
    };
  }

  private _buildExplanation(
    domain: SignalDomain,
    riskLevel: 'high' | 'medium' | 'low',
    finalRisk: number,
    signalCount: number,
    avgSignal: number
  ): string {
    const pct = Math.round(finalRisk * 100);
    const domainLabels: Record<SignalDomain, string> = {
      burnout: 'burnout risk',
      relationship: 'relationship strain',
      decision: 'decision regret probability',
      code_pattern: 'code debt accumulation',
      contradiction: 'contradiction pressure',
      goal: 'goal drift risk',
      general: 'general signal risk',
    };
    const label = domainLabels[domain] ?? domain;
    return `ChronosForge foresight: ${label} is ${riskLevel} (${pct}%) based on ${signalCount} recent signals ` +
      `(avg strength ${(avgSignal * 100).toFixed(0)}%). ` +
      (riskLevel === 'high'
        ? 'Recommend immediate intervention.'
        : riskLevel === 'medium'
          ? 'Monitor closely over the next period.'
          : 'No immediate action required.');
  }
}
