/** qerw.ts — Server-side QERW (Layer 14) */
// Wraps @timps/memory-core QERW with per-user/project scoping.

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { QERW } from '@timps/memory-core';
import type {
  QERWDomain, QERWWeaveResult, QERWContradictionResult,
  QERWPrediction, QERWQueryResult, QERWConsolidationReport,
} from '@timps/memory-core';

function qerwBaseDir(userId: number, projectId: string): string {
  const hash = Buffer.from(`${userId}:${projectId}`)
    .toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12);
  const base = path.join(os.homedir(), '.timps', 'qerw', hash);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

const _qerwInstances = new Map<string, QERW>();

export function getServerQERW(userId: number, projectId: string): QERW {
  const key = `${userId}:${projectId}`;
  let q = _qerwInstances.get(key);
  if (!q) {
    q = new QERW(qerwBaseDir(userId, projectId));
    _qerwInstances.set(key, q);
  }
  return q;
}

export async function qerwWeave(
  userId: number, projectId: string,
  content: string,
  opts: { domain?: QERWDomain; tags?: string[] } = {},
): Promise<QERWWeaveResult> {
  return getServerQERW(userId, projectId).weave(content, opts);
}

export async function qerwPropagateEcho(
  userId: number, projectId: string,
  sourceIds: string[],
  opts?: { strength?: number; decay?: number; maxHops?: number },
): Promise<{ reached: number; paths: Array<{ fromId: string; toId: string; signal: number }> }> {
  return getServerQERW(userId, projectId).propagateEcho(sourceIds, opts);
}

export async function qerwDetectContradictions(
  userId: number, projectId: string,
  domain?: QERWDomain,
): Promise<QERWContradictionResult> {
  return getServerQERW(userId, projectId).detectContradictions(domain ? { domain } : {});
}

export async function qerwPredict(
  userId: number, projectId: string,
  domain: QERWDomain,
): Promise<QERWPrediction> {
  return getServerQERW(userId, projectId).predict(domain);
}

export async function qerwQuery(
  userId: number, projectId: string,
  queryText: string,
  opts?: { topK?: number; domain?: QERWDomain },
): Promise<QERWQueryResult> {
  return getServerQERW(userId, projectId).query(queryText, opts);
}

export async function qerwConsolidate(
  userId: number, projectId: string,
  threshold?: number,
): Promise<QERWConsolidationReport> {
  return getServerQERW(userId, projectId).consolidate(threshold);
}
