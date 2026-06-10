/** aetherForgeERL.ts — Server-side AetherForgeERL (Layer 10) */
// Wraps the @timps/memory-core AetherForgeERL with server-side scoping.
// Mirrors the ServerHarmonicSheafWeaver pattern: userId + projectId isolation,
// per-user base directories, and an instance cache for multi-user concurrency.

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { AetherForgeERL } from '@timps/memory-core';
import type {
  ERLWeaveResult,
  ERLQueryResult,
  ERLPrediction,
  ERLCohomologyResult,
  ERLConsolidationReport,
  ERLStatus,
  ERLDomain,
  FlowForgePrediction,
  FlowForgeAutoConsolidationReport,
} from '@timps/memory-core';

export type {
  ERLDomain,
  ERLPrediction,
  ERLStatus,
  ERLWeaveResult,
  ERLQueryResult,
  ERLCohomologyResult,
  ERLConsolidationReport,
  FlowForgePrediction,
  FlowForgeAutoConsolidationReport,
};

// ── Per-user/project aether store directories ──

function aetherBaseDir(userId: number, projectId: string): string {
  const hash = Buffer.from(`${userId}:${projectId}`)
    .toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12);
  const base = path.join(os.homedir(), '.timps', 'aether', hash);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

// ── Instance cache ──

const _aetherInstances = new Map<string, AetherForgeERL>();

function getInstanceKey(userId: number, projectId: string): string {
  return `${userId}:${projectId}`;
}

function getInstance(userId: number, projectId: string): AetherForgeERL {
  const key = getInstanceKey(userId, projectId);
  if (!_aetherInstances.has(key)) {
    const baseDir = aetherBaseDir(userId, projectId);
    _aetherInstances.set(key, new AetherForgeERL(baseDir));
  }
  return _aetherInstances.get(key)!;
}

// ── Server-side AetherForgeERL (singleton) ──

class ServerAetherForgeERL {
  private userId: number;
  private projectId: string;

  constructor(userId: number, projectId: string) {
    this.userId = userId;
    this.projectId = projectId;
  }

  private get forge(): AetherForgeERL {
    return getInstance(this.userId, this.projectId);
  }

  /** Weave a new observation into the epistemic lattice. */
  async weave(
    content: string,
    opts?: { domain?: ERLDomain; causalParentId?: string; tags?: string[]; evidenceCount?: number }
  ): Promise<ERLWeaveResult> {
    return this.forge.weave(content, opts);
  }

  /** Query the lattice for epistemic resonance signals. */
  async query(
    queryText: string,
    opts: { topK?: number; domain?: ERLDomain; predict?: boolean; cohomology?: boolean; status?: import('@timps/memory-core').EpistemicStatus } = {}
  ): Promise<ERLQueryResult> {
    return this.forge.query(queryText, opts);
  }

  /** Predict epistemic drift for a domain. */
  async predict(
    domain: ERLDomain,
    opts?: { lookbackDays?: number; horizonDays?: number }
  ): Promise<ERLPrediction> {
    return this.forge.predict(domain, opts);
  }

  /** Predict all monitored domains. */
  async predictAll(opts?: { lookbackDays?: number; horizonDays?: number }): Promise<Record<string, ERLPrediction>> {
    return this.forge.predictAll(opts);
  }

  /** Detect epistemic contradictions (H¹ cocycles). */
  async detectContradictions(): Promise<ERLCohomologyResult> {
    return this.forge.detectContradictions();
  }

  /** Consolidate the lattice (quench faded nodes, crystallise stable ones). */
  async consolidate(): Promise<ERLConsolidationReport> {
    return this.forge.consolidate();
  }

  /** Get a context string for prompt injection. */
  async getContextString(domain: ERLDomain, limit?: number): Promise<string> {
    return this.forge.getContextString(domain, limit);
  }

  /** Get lattice status. */
  async getStatus(): Promise<ERLStatus> {
    return this.forge.getStatus();
  }

  /** Perform a meet (greatest lower bound) of two epistemic states. */
  async meet(nodeIdA: string, nodeIdB: string): Promise<import('@timps/memory-core').ERLMeetResult> {
    return this.forge.meet(nodeIdA, nodeIdB);
  }

  /** Perform a join (least upper bound) of two epistemic states. */
  async join(nodeIdA: string, nodeIdB: string): Promise<import('@timps/memory-core').ERLJoinResult | null> {
    return this.forge.join(nodeIdA, nodeIdB);
  }

  // ── TempestForge tree methods ──

  /** Point-in-time tree-walking query. */
  async queryTree(
    queryTime: number = Date.now(),
    opts?: { windowMs?: number; limit?: number; domain?: import('@timps/memory-core').ERLDomain; minAmplitude?: number }
  ): Promise<Array<{ id: string; content: string; domain: string; amplitude: number; status: string; createdAt: number }>> {
    return this.forge.queryPointInTime(queryTime, opts as any).map(n => ({
      id: n.id, content: n.content, domain: n.domain,
      amplitude: n.amplitude, status: n.status, createdAt: n.createdAt,
    }));
  }

  /** Detect contradictions within a subtree. */
  async subtreeContradictions(
    nodeId: string,
    maxDepth?: number
  ): Promise<{ contradictionCount: number; h1Dimension: number; nodeCount: number }> {
    const sc = this.forge.subtreeContradictions(nodeId, maxDepth);
    return { contradictionCount: sc.contradictions.length, h1Dimension: sc.h1Dimension, nodeCount: sc.restrictedNodes.length };
  }

  /** Per-branch resonance trajectory. */
  async branchResonance(
    rootId: string,
    damping?: number,
    maxDepth?: number
  ): Promise<{ trajectoryLength: number; terminalAmplitude: number; atRiskCount: number }> {
    const br = this.forge.branchResonance(rootId, damping, maxDepth);
    return { trajectoryLength: br.trajectory.length, terminalAmplitude: br.terminalAmplitude, atRiskCount: br.atRisk.length };
  }

  /** Prune a low-utility branch. */
  async pruneBranch(rootId: string, sparedIds?: string[]): Promise<number> {
    return this.forge.pruneBranch(rootId, new Set(sparedIds ?? []));
  }

  // ── FlowForge differentiable ODE methods ──

  /** Flow-based prediction with continuous ODE dynamics. */
  async flowPredict(
    domain: import('@timps/memory-core').ERLDomain,
    opts?: { lookbackDays?: number; horizon?: number; dt?: number }
  ): Promise<import('@timps/memory-core').FlowForgePrediction> {
    return this.forge.flowPredict(domain, opts);
  }

  /** Detect curvature singularities via Fisher-Rao metric. */
  async flowDetectCurvature(
    domain?: import('@timps/memory-core').ERLDomain
  ): Promise<{ singularities: Array<{ nodeId: string; curvature: number; domain: string }>; meanCurvature: number; threshold: number }> {
    return this.forge.flowDetectCurvature(domain);
  }

  /** Auto-consolidate via energy minimization with finite-difference gradients. */
  async flowAutoConsolidate(
    opts?: { learningRate?: number; iterations?: number; epsilon?: number; l1?: number; l2?: number }
  ): Promise<import('@timps/memory-core').FlowForgeAutoConsolidationReport> {
    return this.forge.flowAutoConsolidate(opts);
  }
}

export { ServerAetherForgeERL };

/** Convenience factory: return a ServerAetherForgeERL for a userId+projectId. */
export function getServerAetherForgeERL(userId: number, projectId: string): ServerAetherForgeERL {
  return new ServerAetherForgeERL(userId, projectId);
}

/** Singleton convenience for the default user (userId=0, projectId='default'). */
export const aetherForge = getServerAetherForgeERL(0, 'default');
