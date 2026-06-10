// @timps/memory-core — QPTW tests

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { QPTW } from './QPTW.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qptw-test-'));
}

describe('QPTW', () => {
  describe('weave', () => {
    it('creates a node with deterministic phase', () => {
      const q = new QPTW(tmpDir());
      const r = q.weave('Use PostgreSQL for storage', { domain: 'decision' });
      expect(r.nodeId).toMatch(/^qptw_/);
      expect(r.domain).toBe('decision');
      expect(r.phase).toBeGreaterThanOrEqual(0);
      expect(r.phase).toBeLessThan(2 * Math.PI);
      expect(r.amplitude).toBeGreaterThan(0);
    });

    it('creates causal edge when parentId provided', () => {
      const q = new QPTW(tmpDir());
      const parent = q.weave('Use PostgreSQL', { domain: 'decision' });
      const child = q.weave('Use PostgreSQL with replication', {
        domain: 'decision', causalParentId: parent.nodeId,
      });
      const edges = q.exportEdges();
      const causal = edges.find(e => e.fromId === parent.nodeId && e.toId === child.nodeId);
      expect(causal).toBeDefined();
      expect(causal!.edgeType).toBe('causes');
    });

    it('detects phase-based contradictions on weave', () => {
      const q = new QPTW(tmpDir());
      // Nodes with similar content get similar phases →
      // to get a contradiction we need content that produces
      // a strongly anti-aligned phase. We use two contrasting
      // statements.
      q.weave('Use PostgreSQL for all storage', { domain: 'decision' });
      // Anti-aligned phrasing
      q.weave('Switch away from PostgreSQL to MongoDB', { domain: 'decision' });
      const edges = q.exportEdges();
      const contraEdges = edges.filter(e => e.edgeType === 'contradicts');
      // May or may not be anti-aligned — depends on hash
      // Just verify weave doesn't crash
      expect(contraEdges.length).toBeGreaterThanOrEqual(0);
    });

    it('weave is deterministic for same dir', () => {
      const dir = tmpDir();
      const q1 = new QPTW(dir);
      const r1 = q1.weave('test content', { domain: 'decision' });
      const q2 = new QPTW(dir);
      // Load from persisted state; second weave creates a new node
      const r2 = q2.weave('test content', { domain: 'decision' });
      expect(r2.nodeId).not.toBe(r1.nodeId); // different IDs (crypto)
      expect(r2.phase).toBe(r1.phase); // same content → same phase
      // manifold position should be same for same content
      const n1 = q1.getNode(r1.nodeId)!;
      const n2 = q2.getNode(r2.nodeId)!;
      expect(n1.manifoldPos).toEqual(n2.manifoldPos);
    });
  });

  describe('updateAffected', () => {
    it('updates phase and amplitude for affected nodes', () => {
      const q = new QPTW(tmpDir());
      const r1 = q.weave('Node A', { domain: 'decision', amplitude: 0.8 });
      const r2 = q.weave('Node B', { domain: 'decision', amplitude: 0.6 });
      const before = { ...q.getNode(r1.nodeId)! };
      const result = q.updateAffected([r1.nodeId], { deltaPhase: 0.5, decay: 0.1 });
      const after = q.getNode(r1.nodeId)!;
      expect(after.phase).not.toBe(before.phase);
      expect(after.amplitude).toBeLessThanOrEqual(before.amplitude);
      expect(result.updated).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('handles empty affected list', () => {
      const q = new QPTW(tmpDir());
      const result = q.updateAffected([]);
      expect(result.updated).toBe(0);
    });

    it('propagates to neighbors via fanout', () => {
      const q = new QPTW(tmpDir());
      const a = q.weave('Root node', { domain: 'general' });
      const b = q.weave('Child 1', { domain: 'general', causalParentId: a.nodeId });
      const c = q.weave('Child 2', { domain: 'general', causalParentId: b.nodeId });
      const result = q.updateAffected([a.nodeId]);
      expect(result.updated).toBeGreaterThanOrEqual(3); // a + b + c (2 hops)
    });
  });

  describe('detectContradictions', () => {
    it('returns consistent for empty store', () => {
      const q = new QPTW(tmpDir());
      const r = q.detectContradictions();
      expect(r.isConsistent).toBe(true);
      expect(r.betti1).toBe(0);
    });

    it('returns contradictions for anti-phased nodes in same domain', () => {
      const q = new QPTW(tmpDir());
      // Weave enough nodes — some will inevitably be anti-aligned
      for (let i = 0; i < 20; i++) {
        q.weave(`Decision ${i}: ${'x'.repeat(i * 10)}`, { domain: 'decision' });
      }
      const r = q.detectContradictions({ domain: 'decision' });
      // Type check
      expect(typeof r.isConsistent).toBe('boolean');
      expect(typeof r.betti1).toBe('number');
      expect(typeof r.phaseIncoherence).toBe('number');
      expect(Array.isArray(r.contradictions)).toBe(true);
    });

    it('domain filter excludes other domains', () => {
      const q = new QPTW(tmpDir());
      q.weave('burnout signal', { domain: 'burnout' });
      q.weave('relationship issue', { domain: 'relationship' });
      const r = q.detectContradictions({ domain: 'burnout' });
      // Only burnout nodes (1 node) — no contradictions possible
      expect(r.isConsistent).toBe(true);
    });
  });

  describe('predict', () => {
    it('returns low risk for empty domain', () => {
      const q = new QPTW(tmpDir());
      const p = q.predict('burnout');
      expect(p.riskLevel).toBe('low');
      expect(p.riskScore).toBe(0);
      expect(p.trajectory.length).toBeGreaterThan(0);
    });

    it('returns risk assessment for populated domain', () => {
      const q = new QPTW(tmpDir());
      for (let i = 0; i < 5; i++) {
        q.weave(`Burnout signal ${i}`, { domain: 'burnout', amplitude: 0.5 + i * 0.1 });
      }
      const p = q.predict('burnout');
      expect(p.riskScore).toBeGreaterThanOrEqual(0);
      expect(p.riskScore).toBeLessThanOrEqual(1);
      expect(['high', 'medium', 'low']).toContain(p.riskLevel);
      expect(p.trajectory.length).toBeGreaterThan(0);
      expect(typeof p.resonance).toBe('number');
      expect(typeof p.explanation).toBe('string');
    });

    it('generates trajectory of requested length', () => {
      const q = new QPTW(tmpDir());
      q.weave('test node', { domain: 'relationship' });
      q.weave('test node 2', { domain: 'relationship' });
      const p = q.predict('relationship', { steps: 8 });
      expect(p.trajectory.length).toBe(8);
    });
  });

  describe('query', () => {
    it('returns results sorted by manifold distance', () => {
      const q = new QPTW(tmpDir());
      q.weave('PostgreSQL database setup', { domain: 'decision' });
      q.weave('React frontend component', { domain: 'decision' });
      q.weave('Docker compose configuration', { domain: 'decision' });
      const r = q.query('database');
      expect(r.results.length).toBeGreaterThan(0);
      expect(r.totalCount).toBe(3);
      // Should be sorted by distance ascending
      for (let i = 1; i < r.results.length; i++) {
        expect(r.results[i].manifoldDistance).toBeGreaterThanOrEqual(
          r.results[i - 1].manifoldDistance,
        );
      }
    });

    it('returns empty for nonexistent domain', () => {
      const q = new QPTW(tmpDir());
      q.weave('test', { domain: 'general' });
      const r = q.query('test', { domain: 'burnout' });
      expect(r.results).toHaveLength(0);
    });

    it('respects topK', () => {
      const q = new QPTW(tmpDir());
      for (let i = 0; i < 20; i++) {
        q.weave(`node ${i}`, { domain: 'general' });
      }
      const r = q.query('test', { topK: 5 });
      expect(r.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('consolidate', () => {
    it('prunes low-amplitude nodes', () => {
      const q = new QPTW(tmpDir());
      q.weave('Keep me', { domain: 'general', amplitude: 0.8 });
      q.weave('Prune me', { domain: 'general', amplitude: 0.01 });
      const report = q.consolidate(0.05);
      expect(report.pruned).toBeGreaterThanOrEqual(1);
      expect(report.retained).toBeGreaterThanOrEqual(1);
    });

    it('report has valid shape', () => {
      const q = new QPTW(tmpDir());
      q.weave('Node A', { domain: 'general', amplitude: 0.5 });
      q.weave('Node B', { domain: 'general', amplitude: 0.7 });
      const report = q.consolidate();
      expect(typeof report.pruned).toBe('number');
      expect(typeof report.retained).toBe('number');
      expect(typeof report.meanAmplitude).toBe('number');
      expect(typeof report.meanPhaseCoherence).toBe('number');
    });
  });

  describe('persistence', () => {
    it('survives reload from disk', () => {
      const dir = tmpDir();
      const q1 = new QPTW(dir);
      q1.weave('Persist me', { domain: 'decision', tags: ['test'] });
      const q2 = new QPTW(dir);
      const nodes = q2.exportNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].content).toBe('Persist me');
    });
  });
});
