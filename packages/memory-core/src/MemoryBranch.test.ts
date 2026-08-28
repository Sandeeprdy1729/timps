// ── @timps/memory-core — MemoryBranchStore Tests ──
// Phase 5e: International Team Features — Git-style decision branches

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryBackend } from './backends/InMemoryBackend.js';
import { MemoryBranchStore } from './MemoryBranch.js';
import type { BranchCommit, BranchMetadata } from './types.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('MemoryBranchStore', () => {
  let store: MemoryBranchStore;
  let backend: InMemoryBackend;

  beforeEach(() => {
    backend = new InMemoryBackend();
    store = new MemoryBranchStore('/tmp/test-branches', backend);
  });

  describe('createBranch', () => {
    it('creates a new branch with metadata', () => {
      const meta = store.createBranch('feature-auth', 'Add OAuth support', 'alice');
      expect(meta.branchName).toBe('feature-auth');
      expect(meta.description).toBe('Add OAuth support');
      expect(meta.createdBy).toBe('alice');
      expect(meta.createdAt).toBeGreaterThan(0);
      expect(meta.headCommitId).toBeNull();
      expect(meta.commitCount).toBe(0);
    });

    it('throws when creating a duplicate branch', () => {
      store.createBranch('feature-auth');
      expect(() => store.createBranch('feature-auth')).toThrow('already exists');
    });

    it('defaults createdBy to unknown', () => {
      const meta = store.createBranch('anon-branch');
      expect(meta.createdBy).toBe('unknown');
    });
  });

  describe('commit', () => {
    it('stores a commit on a branch', () => {
      store.createBranch('db-choice', 'Database selection', 'bob');
      const commit = store.commit('db-choice', 'Use PostgreSQL', 'Best for relational data', 'bob');
      expect(commit.branchName).toBe('db-choice');
      expect(commit.author).toBe('bob');
      expect(commit.content).toBe('Use PostgreSQL');
      expect(commit.reason).toBe('Best for relational data');
      expect(commit.parentCommitId).toBeNull();
      expect(commit.id).toBeTruthy();
      expect(commit.timestamp).toBeGreaterThan(0);
    });

    it('links commits via parentCommitId', () => {
      store.createBranch('api-design');
      const c1 = store.commit('api-design', 'Use REST', 'Standard approach', 'alice');
      const c2 = store.commit('api-design', 'Switch to GraphQL', 'Better for complex queries', 'alice');
      expect(c2.parentCommitId).toBe(c1.id);
    });

    it('stores platform and channel metadata on commit', () => {
      store.createBranch('mobile-ui');
      const commit = store.commit('mobile-ui', 'Use React Native', 'Cross-platform', 'charlie', 'slack', 'team-mobile');
      expect(commit.platform).toBe('slack');
      expect(commit.channel).toBe('team-mobile');
    });

    it('throws when committing to a non-existent branch', () => {
      expect(() => store.commit('ghost', 'content', 'reason', 'alice')).toThrow('does not exist');
    });
  });

  describe('getHistory', () => {
    it('returns commits oldest first', () => {
      store.createBranch('history-test');
      store.commit('history-test', 'First', 'initial', 'alice');
      store.commit('history-test', 'Second', 'update', 'bob');
      store.commit('history-test', 'Third', 'final', 'charlie');
      const history = store.getHistory('history-test');
      expect(history).toHaveLength(3);
      expect(history[0].content).toBe('First');
      expect(history[1].content).toBe('Second');
      expect(history[2].content).toBe('Third');
    });

    it('returns empty array for a branch with no commits', () => {
      store.createBranch('empty');
      expect(store.getHistory('empty')).toEqual([]);
    });

    it('returns empty array for a non-existent branch', () => {
      expect(store.getHistory('ghost')).toEqual([]);
    });
  });

  describe('getBranchInfo', () => {
    it('returns null for non-existent branch', () => {
      expect(store.getBranchInfo('ghost')).toBeNull();
    });

    it('returns branch metadata after creation', () => {
      store.createBranch('test-branch', 'desc', 'alice');
      const info = store.getBranchInfo('test-branch');
      expect(info).not.toBeNull();
      expect(info!.branchName).toBe('test-branch');
    });
  });

  describe('listBranches', () => {
    it('lists all branches newest first', async () => {
      store.createBranch('alpha');
      await sleep(2);
      store.createBranch('beta');
      await sleep(2);
      store.createBranch('gamma');
      const branches = store.listBranches();
      expect(branches).toHaveLength(3);
      expect(branches[0].branchName).toBe('gamma');
      expect(branches[1].branchName).toBe('beta');
      expect(branches[2].branchName).toBe('alpha');
    });

    it('returns empty array when no branches exist', () => {
      expect(store.listBranches()).toEqual([]);
    });
  });

  describe('merge', () => {
    it('merges source into target with LWW', async () => {
      store.createBranch('old-design');
      store.commit('old-design', 'Use MySQL', 'Stable', 'alice');
      await sleep(2);
      store.createBranch('new-design');
      store.commit('new-design', 'Use PostgreSQL', 'Modern', 'bob');

      const result = store.merge('old-design', 'new-design');
      expect(result.success).toBe(true);
      expect(result.mergedCommit).toBeTruthy();
      expect(result.mergedCommit!.author).toBe('merge');
      expect(result.mergedCommit!.content).toBe('Use PostgreSQL'); // LWW: newer wins
    });

    it('rejects same-branch merge', () => {
      store.createBranch('self');
      const result = store.merge('self', 'self');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot merge');
    });

    it('rejects non-existent source branch', () => {
      store.createBranch('target');
      const result = store.merge('ghost', 'target');
      expect(result.success).toBe(false);
    });

    it('rejects non-existent target branch', () => {
      store.createBranch('source');
      const result = store.merge('source', 'ghost');
      expect(result.success).toBe(false);
    });

    it('detects conflicting directions on merge', () => {
      store.createBranch('approach-a');
      store.commit('approach-a', 'Use Redis for caching', 'Fast', 'alice');
      store.createBranch('approach-b');
      store.commit('approach-b', 'Switch to Memcached for caching', 'Different', 'bob');

      const result = store.merge('approach-a', 'approach-b');
      expect(result.success).toBe(true);

      const targetMeta = store.getBranchInfo('approach-b');
      expect(targetMeta!.crdtStatus).toBe('conflict_pending');
    });

    it('tags merge commit with merge-conflict when directions conflict', () => {
      store.createBranch('plan-a');
      store.commit('plan-a', 'Migrate database to PostgreSQL', 'Scale', 'alice');
      store.createBranch('plan-b');
      store.commit('plan-b', 'Move database to MongoDB', 'Flexibility', 'bob');

      const result = store.merge('plan-a', 'plan-b');
      expect(result.success).toBe(true);
      expect(result.mergedCommit!.tags).toContain('merge-conflict');
    });

    it('records mergedFrom in target branch metadata', () => {
      store.createBranch('source');
      store.commit('source', 'content', 'reason', 'alice');
      store.createBranch('target');
      store.commit('target', 'other', 'reason', 'bob');

      store.merge('source', 'target');
      const meta = store.getBranchInfo('target');
      expect(meta!.mergedFrom).toContain('source');
    });
  });

  describe('deleteBranch', () => {
    it('deletes a branch and its commits', () => {
      store.createBranch('delete-me');
      store.commit('delete-me', 'content', 'reason', 'alice');
      expect(store.deleteBranch('delete-me')).toBe(true);
      expect(store.getBranchInfo('delete-me')).toBeNull();
      expect(store.getHistory('delete-me')).toEqual([]);
    });

    it('returns false for non-existent branch', () => {
      expect(store.deleteBranch('ghost')).toBe(false);
    });
  });

  describe('conflict detection', () => {
    it('sets conflict_pending when commits have conflicting directions', () => {
      store.createBranch('arch-decision');
      const c1 = store.commit('arch-decision', 'Use Redis for caching', 'Performance', 'alice');
      const c2 = store.commit('arch-decision', 'Switch to Memcached instead', 'Better', 'bob');

      const meta = store.getBranchInfo('arch-decision');
      expect(meta!.crdtStatus).toBe('conflict_pending');
      expect(meta!.conflicts).toContain(c2.id);
    });

    it('does not set conflict for same-direction commits', () => {
      store.createBranch('same-direction');
      store.commit('same-direction', 'Use React for frontend', 'Standard', 'alice');
      store.commit('same-direction', 'Add TypeScript support', 'Type safety', 'bob');

      const meta = store.getBranchInfo('same-direction');
      expect(meta!.crdtStatus).toBeUndefined();
    });

    it('does not detect conflict when no shared keywords', () => {
      store.createBranch('unrelated');
      store.commit('unrelated', 'Use Redis for caching', 'Performance', 'alice');
      store.commit('unrelated', 'Deploy to Kubernetes', 'Orchestration', 'bob');

      const meta = store.getBranchInfo('unrelated');
      expect(meta!.crdtStatus).toBeUndefined();
    });
  });
});
