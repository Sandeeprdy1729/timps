/** qitrl.ts — Server-side QITRL (Layer 18) */
// Wraps @timps/memory-core QITRL with per-user/project scoping.

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { QITRL } from '@timps/memory-core';
import type {
  QITRLDomain, QITRLWeaveResult, QITRLCohomologyResult,
  QITRLPrediction, QITRLQueryResult, QITRLConsolidationReport,
} from '@timps/memory-core';

function qitrlBaseDir(userId: number, projectId: string): string {
  const hash = Buffer.from(`${userId}:${projectId}`)
    .toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12);
  const base = path.join(os.homedir(), '.timps', 'qitrl', hash);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

const _qitrlInstances = new Map<string, QITRL>();

export function getServerQITRL(userId: number, projectId: string): QITRL {
  const key = `${userId}:${projectId}`;
  let q = _qitrlInstances.get(key);
  if (!q) {
    q = new QITRL(qitrlBaseDir(userId, projectId));
    _qitrlInstances.set(key, q);
  }
  return q;
}

export async function qitrlWeave(
  userId: number, projectId: string,
  content: string,
  opts: { domain?: QITRLDomain; tags?: string[] } = {},
): Promise<QITRLWeaveResult> {
  return getServerQITRL(userId, projectId).weave(content, opts);
}

export async function qitrlDetectContradictions(
  userId: number, projectId: string,
  domain?: QITRLDomain,
): Promise<QITRLCohomologyResult> {
  return getServerQITRL(userId, projectId).detectContradictions(domain ? { domain } : {});
}

export async function qitrlPredict(
  userId: number, projectId: string,
  domain: QITRLDomain,
): Promise<QITRLPrediction> {
  return getServerQITRL(userId, projectId).predict(domain);
}

export async function qitrlQuery(
  userId: number, projectId: string,
  queryText: string,
  opts?: { topK?: number; domain?: QITRLDomain },
): Promise<QITRLQueryResult> {
  return getServerQITRL(userId, projectId).query(queryText, opts);
}

export async function qitrlConsolidate(
  userId: number, projectId: string,
  threshold?: number,
): Promise<QITRLConsolidationReport> {
  return getServerQITRL(userId, projectId).consolidate(threshold);
}
