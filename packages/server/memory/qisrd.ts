/** qisrd.ts — Server-side QISRD (Layer 15) */
// Wraps @timps/memory-core QISRD with per-user/project scoping.

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { QISRD } from '@timps/memory-core';
import type {
  QISRDDomain, QISRDWeaveResult, QISRDContradictionResult,
  QISRDPrediction, QISRDQueryResult, QISRDConsolidationReport,
} from '@timps/memory-core';

function qisrdBaseDir(userId: number, projectId: string): string {
  const hash = Buffer.from(`${userId}:${projectId}`)
    .toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12);
  const base = path.join(os.homedir(), '.timps', 'qisrd', hash);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

const _qisrdInstances = new Map<string, QISRD>();

export function getServerQISRD(userId: number, projectId: string): QISRD {
  const key = `${userId}:${projectId}`;
  let q = _qisrdInstances.get(key);
  if (!q) {
    q = new QISRD(qisrdBaseDir(userId, projectId));
    _qisrdInstances.set(key, q);
  }
  return q;
}

export async function qisrdWeave(
  userId: number, projectId: string,
  content: string,
  opts: { domain?: QISRDDomain; tags?: string[]; resolution?: 'coarse' | 'fine' } = {},
): Promise<QISRDWeaveResult> {
  return getServerQISRD(userId, projectId).weave(content, opts);
}

export async function qisrdDetectContradictions(
  userId: number, projectId: string,
  domain?: QISRDDomain,
): Promise<QISRDContradictionResult> {
  return getServerQISRD(userId, projectId).detectContradictions(domain ? { domain } : {});
}

export async function qisrdPredict(
  userId: number, projectId: string,
  domain: QISRDDomain,
): Promise<QISRDPrediction> {
  return getServerQISRD(userId, projectId).predict(domain);
}

export async function qisrdQuery(
  userId: number, projectId: string,
  queryText: string,
  opts?: { topK?: number; domain?: QISRDDomain },
): Promise<QISRDQueryResult> {
  return getServerQISRD(userId, projectId).query(queryText, opts);
}

export async function qisrdConsolidate(
  userId: number, projectId: string,
  threshold?: number,
): Promise<QISRDConsolidationReport> {
  return getServerQISRD(userId, projectId).consolidate(threshold);
}
