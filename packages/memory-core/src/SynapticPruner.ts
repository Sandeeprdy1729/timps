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
    const metaFile = path.join(this.dir, 'memory-meta.json');
    if (!fs.existsSync(metaFile)) return { kept: 0, archived: 0, deleted: 0 };
    const all: MemoryMeta[] = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));

    const kept: MemoryMeta[] = [];
    const archived: MemoryMeta[] = [];
    const deleted: string[] = [];

    for (const m of all) {
      const verdict = this.evaluate(m);
      if (verdict === 'keep') kept.push(m);
      else if (verdict === 'archive') archived.push(m);
      else deleted.push(m.id);
    }

    fs.writeFileSync(metaFile, JSON.stringify(kept, null, 2), 'utf-8');
    if (archived.length) {
      const archFile = path.join(this.dir, 'archived-meta.json');
      const existing = fs.existsSync(archFile)
        ? JSON.parse(fs.readFileSync(archFile, 'utf-8'))
        : [];
      fs.writeFileSync(
        archFile,
        JSON.stringify([...existing, ...archived], null, 2),
        'utf-8'
      );
    }

    return { kept: kept.length, archived: archived.length, deleted: deleted.length };
  }

  updatePolicy(policy: Partial<PrunePolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  getPolicy(): PrunePolicy {
    return { ...this.policy };
  }
}
