// ── @timps/memory-core — MemoryBranchStore ──
// Git-style decision branches for team collaboration.
// Branches store ordered commit histories under `branches:{name}:` keys
// in the StorageBackend, separate from the semantic memory store.

import * as crypto from 'node:crypto';
import type { StorageBackend } from './backends/index.js';
import type { BranchCommit, BranchMetadata, CrdtStatus } from './types.js';
import { getBackend } from './storage.js';

export type MergeStrategy = 'last-writer-wins' | 'manual';

export interface MergeResult {
  success: boolean;
  conflict?: boolean;
  mergedCommit?: BranchCommit;
  message: string;
}

export type BranchMergeResult = MergeResult;

export class MemoryBranchStore {
  private _backend: StorageBackend;
  private dir: string;

  constructor(dir: string, backend?: StorageBackend) {
    this.dir = dir;
    this._backend = backend ?? getBackend(dir);
  }

  private branchMetaKey(name: string): string {
    return `branches:${name}:meta`;
  }

  private branchCommitsKey(name: string): string {
    return `branches:${name}:commits`;
  }

  private generateId(): string {
    return `br_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  }

  createBranch(name: string, description?: string, createdBy?: string): BranchMetadata {
    const existing = this.getBranchInfo(name);
    if (existing) {
      throw new Error(`Branch "${name}" already exists`);
    }
    const meta: BranchMetadata = {
      branchName: name,
      description,
      createdBy: createdBy ?? 'unknown',
      createdAt: Date.now(),
      headCommitId: null,
      commitCount: 0,
    };
    this._backend.write(this.branchMetaKey(name), meta);
    this._backend.write(this.branchCommitsKey(name), []);
    return meta;
  }

  commit(
    branchName: string,
    content: string,
    reason: string,
    author: string,
    platform?: string,
    channel?: string,
  ): BranchCommit {
    const meta = this.getBranchInfo(branchName);
    if (!meta) {
      throw new Error(`Branch "${branchName}" does not exist`);
    }

    const id = this.generateId();
    const timestamp = Date.now();
    const commits = this.loadCommits(branchName);
    const parentCommitId = meta.headCommitId;

    const commit: BranchCommit = {
      id,
      branchName,
      author,
      timestamp,
      content,
      reason,
      parentCommitId,
      tags: [],
      platform,
      channel,
    };

    commits.push(commit);
    meta.headCommitId = id;
    meta.commitCount = commits.length;

    // Conflict detection: check if new commit direction conflicts with head
    const headCommit = commits.find(c => c.id === parentCommitId);
    if (headCommit && parentCommitId) {
      const sentiment = this._detectSentimentDirection(content, headCommit.content);
      if (sentiment === 'conflicting') {
        meta.crdtStatus = 'conflict_pending';
        meta.conflicts = [...(meta.conflicts ?? []), id];
      }
    }

    this._backend.write(this.branchCommitsKey(branchName), commits);
    this._backend.write(this.branchMetaKey(branchName), meta);

    return commit;
  }

  getBranchInfo(name: string): BranchMetadata | null {
    const data = this._backend.read(this.branchMetaKey(name));
    return data as BranchMetadata | null;
  }

  getHistory(branchName: string): BranchCommit[] {
    return this.loadCommits(branchName).sort((a, b) => a.timestamp - b.timestamp);
  }

  listBranches(showConflicts = false): BranchMetadata[] {
    const prefix = 'branches:';
    const raw = this._backend.list(prefix);
    const keys = Array.isArray(raw) ? raw : [];
    const metaKeys = [...new Set(keys
      .filter((k: string) => k.endsWith(':meta'))
      .map((k: string) => k.slice(0, -5))
      .map((k: string) => `${k}:meta`),
    )];
    const branches: BranchMetadata[] = [];
    for (const k of metaKeys) {
      const meta = this._backend.read(k) as BranchMetadata | null;
      if (meta) {
        branches.push(meta);
      }
    }
    return branches.sort((a, b) => b.createdAt - a.createdAt);
  }

  merge(
    sourceBranch: string,
    targetBranch: string,
    strategy: MergeStrategy = 'last-writer-wins',
  ): MergeResult {
    const sourceMeta = this.getBranchInfo(sourceBranch);
    const targetMeta = this.getBranchInfo(targetBranch);
    if (!sourceMeta || !targetMeta) {
      return { success: false, message: 'Source or target branch does not exist' };
    }
    if (sourceBranch === targetBranch) {
      return { success: false, message: 'Cannot merge a branch into itself' };
    }

    const sourceCommits = this.loadCommits(sourceBranch);
    const targetCommits = this.loadCommits(targetBranch);
    const sourceHead = sourceCommits.find(c => c.id === sourceMeta.headCommitId);
    const targetHead = targetCommits.find(c => c.id === targetMeta.headCommitId);
    if (!sourceHead || !targetHead) {
      return { success: false, message: 'Cannot find head commits' };
    }

    if (strategy === 'last-writer-wins') {
      // Last-writer-wins: the most recent commit becomes the new head
      const [newer, older] = sourceHead.timestamp >= targetHead.timestamp
        ? [sourceHead, targetHead]
        : [targetHead, sourceHead];

      const mergeId = this.generateId();
      const mergeCommit: BranchCommit = {
        id: mergeId,
        branchName: targetBranch,
        author: 'merge',
        timestamp: Date.now(),
        content: newer.content,
        reason: `Merged from "${sourceBranch}" (LWW): ${newer.reason}`,
        parentCommitId: targetMeta.headCommitId,
        tags: [...new Set([...sourceHead.tags, ...targetHead.tags])],
      };

      targetCommits.push(mergeCommit);
      targetMeta.headCommitId = mergeId;
      targetMeta.commitCount = targetCommits.length;
      targetMeta.mergedFrom = [...(targetMeta.mergedFrom ?? []), sourceBranch];

      // Check for conflicting directions between merged branches
      const sentA = this._detectSentimentDirection(sourceHead.content, targetHead.content);
      if (sentA === 'conflicting') {
        mergeCommit.tags.push('merge-conflict');
        targetMeta.crdtStatus = 'conflict_pending';
      }

      this._backend.write(this.branchCommitsKey(targetBranch), targetCommits);
      this._backend.write(this.branchMetaKey(targetBranch), targetMeta);

      return {
        success: true,
        mergedCommit: mergeCommit,
        message: `Merged "${sourceBranch}" → "${targetBranch}" (${sourceMeta.headCommitId!.slice(0, 8)}... → ${mergeId.slice(0, 8)}...)`,
      };
    }

    return { success: false, message: `Unsupported merge strategy: ${strategy}` };
  }

  deleteBranch(name: string): boolean {
    const meta = this.getBranchInfo(name);
    if (!meta) return false;
    this._backend.delete(this.branchMetaKey(name));
    this._backend.delete(this.branchCommitsKey(name));
    return true;
  }

  private loadCommits(branchName: string): BranchCommit[] {
    const data = this._backend.read(this.branchCommitsKey(branchName));
    return (data as BranchCommit[]) ?? [];
  }

  /** Simple sentiment direction heuristic for conflict detection */
  private _detectSentimentDirection(a: string, b: string): 'same' | 'conflicting' | 'unknown' {
    const conflicts = ['instead', 'different', 'switch', 'change', 'migrate', 'replace', 'revert', 'not'];
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aWords = new Set(aLower.split(/\s+/));
    const bWords = new Set(bLower.split(/\s+/));

    // Check if both mention the same key domain words (using partial matching)
    const keyWords = ['database', 'databases', 'redis', 'postgres', 'postgresql', 'mongodb', 'cache', 'caching', 'cached', 'memcached', 'queue', 'auth', 'api', 'frontend', 'backend'];
    const sharedKeywords = keyWords.filter(w =>
      [...aWords].some(aw => aw.includes(w) || w.includes(aw) || aw.slice(0, 4) === w.slice(0, 4)) &&
      [...bWords].some(bw => bw.includes(w) || w.includes(bw) || bw.slice(0, 4) === w.slice(0, 4))
    );

    if (sharedKeywords.length === 0) return 'unknown';

    // If both use conflict words, they likely conflict
    const aConflict = conflicts.filter(w => aWords.has(w)).length;
    const bConflict = conflicts.filter(w => bWords.has(w)).length;
    if (aConflict > 0 && bConflict > 0) return 'conflicting';

    // If one switches direction and the other has different approach
    const aHasSwitch = ['switch', 'migrate', 'replace', 'revert'].some(w => aWords.has(w));
    const bHasSwitch = ['switch', 'migrate', 'replace', 'revert'].some(w => bWords.has(w));
    if (aHasSwitch !== bHasSwitch && sharedKeywords.length >= 1) return 'conflicting';

    return 'same';
  }
}
