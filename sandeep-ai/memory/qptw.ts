/** qptw.ts — Server-side QPTW (Layer 12) */
// Wraps @timps/memory-core QPTW with per-user/project scoping.

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { QPTW } from '@timps/memory-core';
import type {
  QPTWDomain, QPTWWeaveResult, QPTWContradictionResult,
  QPTWPrediction, QPTWQueryResult, QPTWConsolidationReport,
} from '@timps/memory-core';

// ── Per-user/project store directories ──

function qptwBaseDir(userId: number, projectId: string): string {
  const hash = Buffer.from(`${userId}:${projectId}`)
    .toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12);
  const base = path.join(os.homedir(), '.timps', 'qptw', hash);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

// ── Instance cache ──

const _qptwInstances = new Map<string, QPTW>();

function getInstanceKey(userId: number, projectId: string): string {
  return `${userId}:${projectId}`;
}

export function getServerQPTW(userId: number, projectId: string): QPTW {
  const key = getInstanceKey(userId, projectId);
  let q = _qptwInstances.get(key);
  if (!q) {
    const baseDir = qptwBaseDir(userId, projectId);
    q = new QPTW(baseDir);
    _qptwInstances.set(key, q);
  }
  return q;
}

// ── Server-facing API ──

export async function qptwWeave(
  userId: number,
  projectId: string,
  content: string,
  opts: { domain?: QPTWDomain; causalParentId?: string | null; tags?: string[]; amplitude?: number } = {},
): Promise<QPTWWeaveResult> {
  const q = getServerQPTW(userId, projectId);
  return q.weave(content, opts);
}

export async function qptwUpdateAffected(
  userId: number,
  projectId: string,
  affectedNodeIds: string[],
  signal?: { deltaPhase?: number; decay?: number; surpriseBoost?: number },
): Promise<{ updated: number; meanSurprise: number; latencyMs: number }> {
  const q = getServerQPTW(userId, projectId);
  return q.updateAffected(affectedNodeIds, signal);
}

export async function qptwDetectContradictions(
  userId: number,
  projectId: string,
  domain?: QPTWDomain,
): Promise<QPTWContradictionResult> {
  const q = getServerQPTW(userId, projectId);
  return q.detectContradictions(domain ? { domain } : {});
}

export async function qptwPredict(
  userId: number,
  projectId: string,
  domain: QPTWDomain,
  opts?: { lookbackDays?: number; steps?: number },
): Promise<QPTWPrediction> {
  const q = getServerQPTW(userId, projectId);
  return q.predict(domain, opts);
}

export async function qptwQuery(
  userId: number,
  projectId: string,
  queryText: string,
  opts?: { topK?: number; domain?: QPTWDomain },
): Promise<QPTWQueryResult> {
  const q = getServerQPTW(userId, projectId);
  return q.query(queryText, opts);
}

export async function qptwConsolidate(
  userId: number,
  projectId: string,
  threshold?: number,
): Promise<QPTWConsolidationReport> {
  const q = getServerQPTW(userId, projectId);
  return q.consolidate(threshold);
}
