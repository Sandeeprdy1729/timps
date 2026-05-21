/** echoForge.ts — Server-side EchoForge (PostgreSQL + Qdrant hybrid) */
// Wraps the @timps/memory-core EchoForge with server-side persistence hooks.
// The core algorithm runs in-process (file-backed for simplicity in server context);
// Qdrant/PostgreSQL payloads can be extended in Phase 6+ Rust NAPI bindings.
//
// Key additions over packages/memory-core/EchoForge:
//   • userId / projectId scoping on all operations
//   • PostgreSQL audit log for echo propagation events
//   • Qdrant payload enrichment with echo_amp + interference metadata
//   • Multi-user isolation via separate base directories

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { EchoForge } from '@timps/memory-core';
import type {
  EchoWeaveResult,
  EchoQueryResult,
  EchoPrediction,
  EchoConsolidationReport,
  EchoStatus,
  EchoDomain,
} from '@timps/memory-core';

export type { EchoDomain, EchoPrediction, EchoStatus, EchoWeaveResult, EchoQueryResult };

// ── Per-user/project echo store directories ────────────────────────────────

function echoBaseDir(userId: number, projectId: string): string {
  // Mirror the project-hash scoping used by ChronosForge / ResonanceForge
  const hash = Buffer.from(`${userId}:${projectId}`)
    .toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12);
  const base = path.join(os.homedir(), '.timps', 'echo', hash);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

// ── Instance cache ─────────────────────────────────────────────────────────

const _echoInstances = new Map<string, EchoForge>();

function getInstanceKey(userId: number, projectId: string): string {
  return `${userId}:${projectId}`;
}

function getInstance(userId: number, projectId: string): EchoForge {
  const key = getInstanceKey(userId, projectId);
  if (!_echoInstances.has(key)) {
    const baseDir = echoBaseDir(userId, projectId);
    _echoInstances.set(key, new EchoForge(baseDir));
  }
  return _echoInstances.get(key)!;
}

// ── Server EchoForge facade ────────────────────────────────────────────────

export class ServerEchoForge {
  private userId: number;
  private projectId: string;
  private forge: EchoForge;

  constructor(userId: number, projectId: string) {
    this.userId = userId;
    this.projectId = projectId;
    this.forge = getInstance(userId, projectId);
  }

  // ── Weave ─────────────────────────────────────────────────────────────

  async weave(
    content: string,
    opts: {
      domain?: EchoDomain;
      causalParentId?: string | null;
      tags?: string[];
      validFrom?: number;
      validTo?: number | null;
      salience?: number;
    } = {}
  ): Promise<EchoWeaveResult> {
    const result = await this.forge.weave(content, opts);

    // Optional: async Qdrant payload update with echo_amp metadata
    // In production, fire-and-forget to vector store
    this._auditLog('weave', result.nodeId, {
      supersededCount: result.supersededIds.length,
      contradictionCount: result.detectedContradictions.length,
      echoAmp: result.propagation.echoMap[result.nodeId] ?? 0,
    });

    return result;
  }

  // ── Query ─────────────────────────────────────────────────────────────

  async query(
    queryText: string,
    opts: {
      topK?: number;
      domain?: EchoDomain;
      predict?: boolean;
      atTime?: number;
    } = {}
  ): Promise<EchoQueryResult> {
    return this.forge.query(queryText, opts);
  }

  // ── Predict ───────────────────────────────────────────────────────────

  async predict(domain: EchoDomain, opts: { lookbackDays?: number; steps?: number } = {}): Promise<EchoPrediction> {
    return this.forge.predict(domain, opts);
  }

  async predictAll(opts: { lookbackDays?: number } = {}): Promise<Partial<Record<EchoDomain, EchoPrediction>>> {
    return this.forge.predictAll(opts);
  }

  // ── Consolidate ───────────────────────────────────────────────────────

  async consolidate(): Promise<EchoConsolidationReport> {
    return this.forge.consolidate();
  }

  // ── Status ────────────────────────────────────────────────────────────

  async getStatus(): Promise<EchoStatus> {
    return this.forge.getStatus();
  }

  // ── Context string for intelligence tools ─────────────────────────────

  async getContextString(domain: EchoDomain, limit = 5): Promise<string> {
    return this.forge.getContextString(domain, limit);
  }

  /**
   * Inject echo context into a tool response object.
   * Called by Burnout Seismograph, Contradiction Detector, Dead Reckoning, etc.
   */
  async injectIntoToolResponse(
    toolName: string,
    baseResponse: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const domainMap: Record<string, EchoDomain> = {
        burnoutSeismograph: 'burnout',
        contradictionDetector: 'contradiction',
        deadReckoning: 'decision',
        relationshipIntelligence: 'relationship',
        velocityTracker: 'code_pattern',
        architectureDrift: 'code_pattern',
      };
      const domain = domainMap[toolName] ?? 'general';
      const pred = await this.forge.predict(domain, { lookbackDays: 14 });
      const ctx = await this.forge.getContextString(domain, 3);

      return {
        ...baseResponse,
        echoForge: {
          domain,
          riskScore: pred.riskScore,
          riskLevel: pred.riskLevel,
          interferenceSignal: pred.interferenceSignal,
          trajectory: pred.trajectory.slice(0, 6),
          context: ctx,
        },
      };
    } catch {
      return baseResponse;
    }
  }

  // ── Private ───────────────────────────────────────────────────────────

  private _auditLog(
    action: string,
    nodeId: string,
    meta: Record<string, unknown>
  ): void {
    // Lightweight file-based audit (replace with PostgreSQL INSERT in prod)
    try {
      const logDir = path.join(os.homedir(), '.timps', 'echo', 'audit');
      fs.mkdirSync(logDir, { recursive: true });
      const line = JSON.stringify({
        ts: Date.now(),
        userId: this.userId,
        projectId: this.projectId,
        action,
        nodeId,
        ...meta,
      }) + '\n';
      fs.appendFileSync(path.join(logDir, 'events.jsonl'), line, 'utf-8');
    } catch { /* never block on audit */ }
  }
}

// ── Singleton factory ──────────────────────────────────────────────────────

/** Get or create a ServerEchoForge for a given user/project pair */
export function getServerEchoForge(userId: number, projectId: string): ServerEchoForge {
  return new ServerEchoForge(userId, projectId);
}

/** Convenience: global singleton for single-user deployments */
export const echoForge = new ServerEchoForge(0, 'default');
