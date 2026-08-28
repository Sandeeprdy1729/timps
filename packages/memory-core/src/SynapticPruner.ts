// ── @timps/memory-core — L12: SynapticPruner ──
// Active forgetting engine. Evaluates memory entries against a policy
// and archives or deletes those that are cold, low-importance, and low-confidence.
// Never destroys data by default — archives instead.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from './backends/types.js';

export interface MemoryMeta {
  id: string;
  lastAccess: number;
  accessCount: number;
  importance: number;
  confidence: number;
  pinnedByUser?: boolean;
}

export interface PrunePolicy {
  coldThresholdDays: number;
  minImportance: number;
  minConfidence: number;
  archiveInsteadOfDelete: boolean;
}

const DEFAULT_POLICY: PrunePolicy = {
  coldThresholdDays: 30,
  minImportance: 0.3,
  minConfidence: 0.2,
  archiveInsteadOfDelete: true,
};

export class SynapticPruner {
  private _backend?: StorageBackend;
  private policy: PrunePolicy;

  constructor(private dir: string, policy?: Partial<PrunePolicy>, backend?: StorageBackend) {
    this._backend = backend;
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  evaluate(meta: MemoryMeta): 'keep' | 'archive' | 'delete' {
    if (meta.pinnedByUser) return 'keep';
    const ageDays = (Date.now() - meta.lastAccess) / (24 * 60 * 60 * 1000);
    if (
      ageDays > this.policy.coldThresholdDays &&
      meta.importance < this.policy.minImportance &&
      meta.confidence < this.policy.minConfidence
    ) {
      return this.policy.archiveInsteadOfDelete ? 'archive' : 'delete';
    }
    return 'keep';
  }

  sweep(): { kept: number; archived: number; deleted: number } {
    const all: MemoryMeta[] = this._readJSON('memory-meta.json', []);
    if (!Array.isArray(all) || all.length === 0) return { kept: 0, archived: 0, deleted: 0 };

    const kept: MemoryMeta[] = [];
    const archived: MemoryMeta[] = [];
    const deleted: string[] = [];

    for (const m of all) {
      const verdict = this.evaluate(m);
      if (verdict === 'keep') kept.push(m);
      else if (verdict === 'archive') archived.push(m);
      else deleted.push(m.id);
    }

    this._writeJSON('memory-meta.json', kept);
    if (archived.length) {
      const existing = this._readJSON('archived-meta.json', []);
      this._writeJSON('archived-meta.json', [...existing, ...archived]);
    }

    return { kept: kept.length, archived: archived.length, deleted: deleted.length };
  }

  /** Read a JSON value via the backend when configured, else raw fs. */
  private _readJSON(key: string, fallback: any): any {
    if (this._backend) {
      const v = this._backend.read(key);
      return v === null || v === undefined ? fallback : v;
    }
    const file = path.join(this.dir, key);
    if (!fs.existsSync(file)) return fallback;
    try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
  }

  /** Write a JSON value via the backend when configured, else raw fs. */
  private _writeJSON(key: string, value: any): void {
    if (this._backend) { this._backend.write(key, value); return; }
    fs.writeFileSync(path.join(this.dir, key), JSON.stringify(value, null, 2), 'utf-8');
  }

  updatePolicy(policy: Partial<PrunePolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  getPolicy(): PrunePolicy {
    return { ...this.policy };
  }
}
