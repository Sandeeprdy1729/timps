/** titanicForge.ts — Server-side TitanicForge (Layer 13) */
// Wraps @timps/memory-core TitanicForge with per-user/project scoping.

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { TitanicForge } from '@timps/memory-core';
import type {
  TitanicDomain, TitanicWeaveResult, TitanicQueryResult,
  TitanicConsolidationReport,
} from '@timps/memory-core';

// ── Per-user/project store directories ──

function titanicBaseDir(userId: number, projectId: string): string {
  const hash = Buffer.from(`${userId}:${projectId}`)
    .toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12);
  const base = path.join(os.homedir(), '.timps', 'titanic', hash);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

// ── Instance cache ──

const _titanicInstances = new Map<string, TitanicForge>();

export function getServerTitanicForge(userId: number, projectId: string): TitanicForge {
  const key = `${userId}:${projectId}`;
  let t = _titanicInstances.get(key);
  if (!t) {
    t = new TitanicForge(titanicBaseDir(userId, projectId));
    _titanicInstances.set(key, t);
  }
  return t;
}

// ── Server-facing API ──

export async function titanicWeave(
  userId: number,
  projectId: string,
  content: string,
  opts: { domain?: TitanicDomain; causalParentId?: string | null; tags?: string[] } = {},
): Promise<TitanicWeaveResult> {
  return getServerTitanicForge(userId, projectId).weave(content, opts);
}

export async function titanicPredict(
  userId: number,
  projectId: string,
  domain: TitanicDomain,
  opts?: { lookbackDays?: number; steps?: number },
) {
  return getServerTitanicForge(userId, projectId).predict(domain, opts);
}

export async function titanicQuery(
  userId: number,
  projectId: string,
  queryText: string,
  opts?: { topK?: number; domain?: TitanicDomain },
): Promise<TitanicQueryResult> {
  return getServerTitanicForge(userId, projectId).query(queryText, opts);
}

export async function titanicConsolidate(
  userId: number,
  projectId: string,
  threshold?: number,
): Promise<TitanicConsolidationReport> {
  return getServerTitanicForge(userId, projectId).consolidate(threshold);
}
