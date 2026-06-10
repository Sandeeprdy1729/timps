/** supraSheaf.ts — Server-side SupraSheaf (Layer 11) */
// Wraps the @timps/memory-core SupraSheaf with server-side scoping.
// Per-user/project base directories, instance cache for multi-user concurrency.

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { SupraSheaf, MemoryEngine } from '@timps/memory-core';
import type {
  CrossLayerCohomologyResult,
  SheafConsistencyReport,
} from '@timps/memory-core';

// ── Per-user/project store directories ──

function supraBaseDir(userId: number, projectId: string): string {
  const hash = Buffer.from(`${userId}:${projectId}`)
    .toString('base64')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12);
  const base = path.join(os.homedir(), '.timps', 'supra', hash);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

// ── Instance cache ──

const _supraInstances = new Map<string, SupraSheaf>();

function getInstanceKey(userId: number, projectId: string): string {
  return `${userId}:${projectId}`;
}

export function getSupraSheaf(userId: number, projectId: string): SupraSheaf {
  const key = getInstanceKey(userId, projectId);
  let sheaf = _supraInstances.get(key);
  if (!sheaf) {
    const baseDir = supraBaseDir(userId, projectId);
    const engine = new MemoryEngine(baseDir);
    sheaf = new SupraSheaf(engine);
    _supraInstances.set(key, sheaf);
  }
  return sheaf;
}

// ── Server-facing API ──

export type SupraCollectNodesResult = ReturnType<SupraSheaf['collectNodes']>;
export type SupraCrossLayerH1Result = CrossLayerCohomologyResult;
export type SupraJointForesightResult = import('@timps/memory-core').JointForesightResult;
export type SupraConsistencyResult = SheafConsistencyReport;

export async function collectNodes(userId: number, projectId: string): Promise<SupraCollectNodesResult> {
  const sheaf = getSupraSheaf(userId, projectId);
  return sheaf.collectNodes();
}

export async function computeCrossLayerH1(userId: number, projectId: string): Promise<SupraCrossLayerH1Result> {
  const sheaf = getSupraSheaf(userId, projectId);
  return sheaf.computeCrossLayerH1();
}

export async function jointForesight(
  userId: number,
  projectId: string,
  domain: string,
  horizon?: number,
): Promise<SupraJointForesightResult> {
  const sheaf = getSupraSheaf(userId, projectId);
  return sheaf.jointForesight(domain, { horizon });
}

export async function sheafConsistency(userId: number, projectId: string): Promise<SupraConsistencyResult> {
  const sheaf = getSupraSheaf(userId, projectId);
  return sheaf.sheafConsistency();
}
