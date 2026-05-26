/** harmonicSheafWeaver.ts — Server-side HarmonicSheafWeaver (Layer 9) */
// Wraps the @timps/memory-core HarmonicSheafWeaver with server-side scoping.
// Mirrors the ServerEchoForge pattern: userId + projectId isolation,
// per-user base directories, and an instance cache for multi-user concurrency.
//
// Key additions over packages/memory-core/HarmonicSheafWeaver:
//   • userId / projectId scoping on all operations
//   • Separate ~/.timps/sheaf/<hash>/ base directories per user+project
//   • Multi-user instance cache (Map keyed by userId:projectId)
//   • Async wrappers for Express route compatibility

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { HarmonicSheafWeaver } from '@timps/memory-core';
import type {
  SheafWeaveResult,
  SheafQueryResult,
  SheafPrediction,
  SheafConsolidationReport,
  SheafStatus,
  CohomologyResult,
  SheafDomain,
} from '@timps/memory-core';

export type {
  SheafDomain,
  SheafPrediction,
  SheafStatus,
  SheafWeaveResult,
  SheafQueryResult,
  CohomologyResult,
  SheafConsolidationReport,
};

// ── Per-user/project sheaf store directories ──────────────────────────────

function sheafBaseDir(userId: number, projectId: string): string {
  // Mirror the project-hash scoping used by ChronosForge / EchoForge
  const hash = Buffer.from(`${userId}:${projectId}`)
    .toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12);
  const base = path.join(os.homedir(), '.timps', 'sheaf', hash);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

// ── Instance cache ─────────────────────────────────────────────────────────

const _sheafInstances = new Map<string, HarmonicSheafWeaver>();

function getInstanceKey(userId: number, projectId: string): string {
  return `${userId}:${projectId}`;
}

function getInstance(userId: number, projectId: string): HarmonicSheafWeaver {
  const key = getInstanceKey(userId, projectId);
  if (!_sheafInstances.has(key)) {
    const baseDir = sheafBaseDir(userId, projectId);
    _sheafInstances.set(key, new HarmonicSheafWeaver(baseDir));
  }
  return _sheafInstances.get(key)!;
}

// ── Server HarmonicSheafWeaver facade ────────────────────────────────────

export class ServerHarmonicSheafWeaver {
  private userId: number;
  private projectId: string;
  private weaver: HarmonicSheafWeaver;

  constructor(userId: number, projectId: string) {
    this.userId = userId;
    this.projectId = projectId;
    this.weaver = getInstance(userId, projectId);
  }

  // ── Weave ─────────────────────────────────────────────────────────────

  async weave(
    content: string,
    opts: {
      domain?: SheafDomain;
      causalParentId?: string | null;
      tags?: string[];
      amplitude?: number;
      validFrom?: number;
      validTo?: number | null;
    } = {}
  ): Promise<SheafWeaveResult> {
    return this.weaver.weave(content, opts);
  }

  // ── Algebraic contradiction detection ─────────────────────────────────

  async detectContradictions(opts: { domain?: SheafDomain } = {}): Promise<CohomologyResult> {
    return this.weaver.detectContradictions(opts);
  }

  // ── Eigenmode foresight ────────────────────────────────────────────────

  async predict(
    domain: SheafDomain,
    opts: { lookbackDays?: number; steps?: number } = {}
  ): Promise<SheafPrediction> {
    return this.weaver.predict(domain, opts);
  }

  async predictAll(opts: { lookbackDays?: number } = {}): Promise<Record<SheafDomain, SheafPrediction>> {
    return this.weaver.predictAll(opts);
  }

  // ── Query ─────────────────────────────────────────────────────────────

  async query(
    queryText: string,
    opts: {
      topK?: number;
      domain?: SheafDomain;
      predict?: boolean;
      cohomology?: boolean;
    } = {}
  ): Promise<SheafQueryResult> {
    return this.weaver.query(queryText, opts);
  }

  // ── Consolidate ───────────────────────────────────────────────────────

  async consolidate(quenchThreshold?: number): Promise<SheafConsolidationReport> {
    return this.weaver.consolidate(quenchThreshold);
  }

  // ── Status ────────────────────────────────────────────────────────────

  async getStatus(): Promise<SheafStatus> {
    return this.weaver.getStatus();
  }

  // ── Context string (for prompt injection) ─────────────────────────────

  getContextString(domain: SheafDomain, limit?: number): string {
    return this.weaver.getContextString(domain, limit);
  }
}

// ── Convenience singleton for default user/project ────────────────────────

let _defaultInstance: ServerHarmonicSheafWeaver | null = null;

export function getServerSheafWeaver(userId = 1, projectId = 'default'): ServerHarmonicSheafWeaver {
  if (!_defaultInstance) {
    _defaultInstance = new ServerHarmonicSheafWeaver(userId, projectId);
  }
  return _defaultInstance;
}

// Alias for backwards-compatible import
export const sheafWeaver = getServerSheafWeaver();
