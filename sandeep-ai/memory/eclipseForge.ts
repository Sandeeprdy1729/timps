/** eclipseForge.ts — Server-side EclipseForge (Layer 17) */
// Wraps @timps/memory-core EclipseForge with per-user/project scoping.

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { EclipseForge } from '@timps/memory-core';
import type {
  EclipseDomain, EclipseWeaveResult, EclipseCohomologyResult,
  EclipsePrediction, EclipseQueryResult, EclipseConsolidationReport,
} from '@timps/memory-core';

function eclipseBaseDir(userId: number, projectId: string): string {
  const hash = Buffer.from(`${userId}:${projectId}`)
    .toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12);
  const base = path.join(os.homedir(), '.timps', 'eclipse', hash);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

const _eclipseInstances = new Map<string, EclipseForge>();

export function getServerEclipseForge(userId: number, projectId: string): EclipseForge {
  const key = `${userId}:${projectId}`;
  let e = _eclipseInstances.get(key);
  if (!e) {
    e = new EclipseForge(eclipseBaseDir(userId, projectId));
    _eclipseInstances.set(key, e);
  }
  return e;
}

export async function eclipseWeave(
  userId: number, projectId: string,
  content: string,
  opts: { domain?: EclipseDomain; tags?: string[]; validFrom?: number; validTo?: number | null } = {},
): Promise<EclipseWeaveResult> {
  return getServerEclipseForge(userId, projectId).weave(content, opts);
}

export async function eclipseDetectContradictions(
  userId: number, projectId: string,
  domain?: EclipseDomain,
): Promise<EclipseCohomologyResult> {
  return getServerEclipseForge(userId, projectId).detectContradictions(domain ? { domain } : {});
}

export async function eclipsePredict(
  userId: number, projectId: string,
  domain: EclipseDomain,
): Promise<EclipsePrediction> {
  return getServerEclipseForge(userId, projectId).predict(domain);
}

export async function eclipseQuery(
  userId: number, projectId: string,
  queryText: string,
  opts?: { topK?: number; domain?: EclipseDomain },
): Promise<EclipseQueryResult> {
  return getServerEclipseForge(userId, projectId).query(queryText, opts);
}

export async function eclipseConsolidate(
  userId: number, projectId: string,
  threshold?: number,
): Promise<EclipseConsolidationReport> {
  return getServerEclipseForge(userId, projectId).consolidate(threshold);
}
