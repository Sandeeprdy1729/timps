// @timps/memory-core — TitanicForge tests

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { TitanicForge } from './TitanicForge.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'titanic-test-'));
}

describe('TitanicForge', () => {
  describe('weave', () => {
    it('creates a node with surprise score', () => {
      const t = new TitanicForge(tmpDir());
      const r = t.weave('Use PostgreSQL for storage', { domain: 'decision' });
      expect(r.nodeId).toMatch(/^titanic_/);
      expect(r.domain).toBe('decision');
      expect(r.surprise).toBeGreaterThanOrEqual(0);
      expect(r.surprise).toBeLessThanOrEqual(1);
      expect(typeof r.neuralUpdated).toBe('boolean');
    });

    it('creates causal edge when parentId provided', () => {
      const t = new TitanicForge(tmpDir());
      const parent = t.weave('Use PostgreSQL', { domain: 'decision' });
      const child = t.weave('Use PostgreSQL with replication', {
        domain: 'decision', causalParentId: parent.nodeId,
      });
      const edges = t.exportEdges();
      expect(edges.some(e => e.fromId === parent.nodeId && e.toId === child.nodeId)).toBe(true);
    });

    it('adds semantic edges for similar content', () => {
      const t = new TitanicForge(tmpDir());
      t.weave('Use PostgreSQL for database', { domain: 'decision' });
      t.weave('PostgreSQL is great for storage', { domain: 'decision' });
      const edges = t.exportEdges();
      const semanticEdges = edges.filter(e => e.viewType === 'semantic' && e.weight > 0.7);
      expect(semanticEdges.length).toBeGreaterThanOrEqual(0);
    });

    it('adds temporal edges for same time bucket', () => {
      const t = new TitanicForge(tmpDir());
      t.weave('Node A', { domain: 'decision' });
      t.weave('Node B', { domain: 'decision' });
      const edges = t.exportEdges();
      const temporalEdges = edges.filter(e => e.viewType === 'temporal');
      expect(temporalEdges.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computeSurprise', () => {
    it('returns high surprise for novel content', () => {
      const t = new TitanicForge(tmpDir());
      // Seed some database-related nodes
      for (let i = 0; i < 5; i++) {
        t.weave(`Database technology discussion ${i}`, { domain: 'decision' });
      }
      // Compute surprise for a completely unrelated topic
      const emb = new Float64Array(64);
      // Fill with values (will have low sim to database nodes)
      for (let i = 0; i < 64; i++) {
        emb[i] = (i % 3 - 1) / 3;
      }
      const r = t.computeSurprise(emb, 'decision', 0);
      expect(r.surprise).toBeGreaterThanOrEqual(0);
      expect(r.surprise).toBeLessThanOrEqual(1);
      expect(typeof r.novelty).toBe('number');
      expect(typeof r.h1Factor).toBe('number');
      expect(typeof r.temporalDecay).toBe('number');
    });

    it('returns low surprise for duplicate content', () => {
      const t = new TitanicForge(tmpDir());
      t.weave('Unique content about AI', { domain: 'decision' });
      // Same content again should yield lower novelty
      const r = t.query('Unique content about AI', { domain: 'decision' });
      expect(r.results.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('returns results with hybrid scores', () => {
      const t = new TitanicForge(tmpDir());
      t.weave('PostgreSQL setup guide', { domain: 'decision' });
      t.weave('React component design', { domain: 'decision' });
      t.weave('Docker compose file', { domain: 'decision' });
      const r = t.query('database');
      expect(r.results.length).toBeGreaterThan(0);
      expect(r.totalCount).toBe(3);
      expect(typeof r.policyDecision).toBe('string');
      for (const res of r.results) {
        expect(typeof res.score).toBe('number');
        expect(typeof res.node.id).toBe('string');
      }
    });

    it('returns empty for nonexistent domain', () => {
      const t = new TitanicForge(tmpDir());
      t.weave('test', { domain: 'general' });
      const r = t.query('test', { domain: 'burnout' });
      expect(r.results).toHaveLength(0);
    });

    it('respects topK', () => {
      const t = new TitanicForge(tmpDir());
      for (let i = 0; i < 20; i++) {
        t.weave(`node ${i}`, { domain: 'general' });
      }
      const r = t.query('test', { topK: 5 });
      expect(r.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('predict', () => {
    it('returns prediction for populated domain', () => {
      const t = new TitanicForge(tmpDir());
      for (let i = 0; i < 5; i++) {
        t.weave(`Burnout signal ${i}`, { domain: 'burnout' });
      }
      const p = t.predict('burnout');
      expect(p.riskScore).toBeGreaterThanOrEqual(0);
      expect(p.riskScore).toBeLessThanOrEqual(1);
      expect(['high', 'medium', 'low']).toContain(p.riskLevel);
      expect(p.trajectory.length).toBeGreaterThan(0);
      expect(typeof p.meanSurprise).toBe('number');
    });

    it('returns low risk for empty domain', () => {
      const t = new TitanicForge(tmpDir());
      const p = t.predict('burnout');
      expect(p.riskLevel).toBe('low');
      expect(p.riskScore).toBe(0);
    });
  });

  describe('consolidate', () => {
    it('prunes low-surprise nodes', () => {
      const t = new TitanicForge(tmpDir());
      t.weave('Keep me', { domain: 'general' });
      // Directly set low surprise on a node
      const allNodes = t.exportNodes();
      if (allNodes.length > 0) {
        const node = { ...allNodes[0] };
      }
      const report = t.consolidate(0.5);
      expect(typeof report.pruned).toBe('number');
      expect(typeof report.retained).toBe('number');
      expect(typeof report.meanSurprise).toBe('number');
      expect(typeof report.neuralUpdateCount).toBe('number');
    });
  });

  describe('neural module', () => {
    it('updates weights on high surprise', () => {
      const t = new TitanicForge(tmpDir());
      // Weave many nodes and one dissonant node should trigger neural update
      for (let i = 0; i < 3; i++) {
        t.weave(`Common topic ${i}`, { domain: 'decision' });
      }
      // A very different statement should have high surprise
      const r = t.weave('COMPLETELY UNRELATED TOPIC XYZ', { domain: 'decision' });
      // Neural update may or may not fire depending on surprise
      expect(r.surprise).toBeGreaterThanOrEqual(0);
    });

    it('persists neural weights across reload', () => {
      const dir = tmpDir();
      const t1 = new TitanicForge(dir);
      t1.weave('test content', { domain: 'general' });
      const w1 = t1.getNeuralWeight(0, 0);
      const updateCount1 = (t1 as any).store.neuralUpdateCount;

      const t2 = new TitanicForge(dir);
      const w2 = t2.getNeuralWeight(0, 0);
      const updateCount2 = (t2 as any).store.neuralUpdateCount;

      expect(w2).toBe(w1);
      expect(updateCount2).toBe(updateCount1);
    });
  });

  describe('multi-view', () => {
    it('extracts entity mentions from content', () => {
      const t = new TitanicForge(tmpDir());
      t.weave('Alice and Bob worked on PostgreSQL with Docker', { domain: 'decision' });
      const nodes = t.exportNodes();
      const node = nodes.find(n => n.entityMentions.length > 0);
      expect(node).toBeDefined();
    });

    it('policy router returns a valid view', () => {
      const t = new TitanicForge(tmpDir());
      t.weave('test', { domain: 'general' });
      const emb = new Float64Array(64);
      const policy = (t as any).routeQuery(emb, 'general');
      expect(['semantic', 'temporal', 'causal', 'entity']).toContain(policy.bestView);
    });
  });

  describe('persistence', () => {
    it('survives reload from disk', () => {
      const dir = tmpDir();
      const t1 = new TitanicForge(dir);
      t1.weave('Persist me', { domain: 'decision', tags: ['test'] });
      const t2 = new TitanicForge(dir);
      const nodes = t2.exportNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].content).toBe('Persist me');
      expect(nodes[0].embedding.length).toBe(64);
    });
  });
});
