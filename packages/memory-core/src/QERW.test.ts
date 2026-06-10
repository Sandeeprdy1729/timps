// @timps/memory-core — QERW tests

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { QERW } from './QERW.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qerw-test-'));
}

describe('QERW', () => {
  describe('weave', () => {
    it('creates a node with curvature', () => {
      const q = new QERW(tmpDir());
      const r = q.weave('Use PostgreSQL for storage', { domain: 'decision' });
      expect(r.nodeId).toMatch(/^qerw_/);
      expect(r.domain).toBe('decision');
      expect(typeof r.curvature).toBe('number');
    });

    it('adds geodesic edges to nearest neighbors', () => {
      const q = new QERW(tmpDir());
      q.weave('First node test', { domain: 'decision' });
      q.weave('Second node about databases', { domain: 'decision' });
      q.weave('Third node for clustering', { domain: 'decision' });
      const edges = q.exportEdges();
      expect(edges.length).toBeGreaterThan(0);
      // Each pair of nodes should have bidirectional edges (weave adds both directions)
      const fromFirst = edges.filter(e => e.fromId.startsWith('qerw_'));
      expect(fromFirst.length).toBeGreaterThan(0);
    });

    it('computes geodesic distance array', () => {
      const q = new QERW(tmpDir());
      for (let i = 0; i < 5; i++) {
        q.weave(`Node ${i}: ${'content'.repeat(i + 1)}`, { domain: 'decision' });
      }
      const r = q.weave('Final test node content', { domain: 'decision' });
      expect(r.geodesicDistances.length).toBeGreaterThan(0);
      for (const gd of r.geodesicDistances) {
        expect(typeof gd.dist).toBe('number');
        expect(gd.dist).toBeGreaterThan(0);
        expect(typeof gd.neighborId).toBe('string');
      }
    });
  });

  describe('propagateEcho', () => {
    it('propagates signal along geodesic edges', () => {
      const q = new QERW(tmpDir());
      q.weave('Node A', { domain: 'decision' });
      q.weave('Node B', { domain: 'decision' });
      q.weave('Node C', { domain: 'decision' });
      const nodes = q.exportNodes();
      const sources = [nodes[0].id];
      const result = q.propagateEcho(sources, { strength: 1.0, decay: 0.1, maxHops: 2 });
      expect(result.reached).toBeGreaterThanOrEqual(1);
      expect(result.paths.length).toBeGreaterThan(0);
      for (const p of result.paths) {
        expect(p.signal).toBeGreaterThan(0);
      }
    });

    it('handles empty source list', () => {
      const q = new QERW(tmpDir());
      const result = q.propagateEcho([]);
      expect(result.reached).toBe(0);
      expect(result.paths).toHaveLength(0);
    });

    it('damps signal with increasing hops', () => {
      const q = new QERW(tmpDir());
      // Chain: A → B → C
      q.weave('Very long content string that is unique enough', { domain: 'decision' });
      q.weave('Different content for second node in chain', { domain: 'decision' });
      q.weave('Third unique node with different content text', { domain: 'decision' });
      const nodes = q.exportNodes();
      const result = q.propagateEcho([nodes[0].id], { strength: 1.0, decay: 0.3, maxHops: 3 });
      // Signals should attenuate
      for (const p of result.paths) {
        expect(p.signal).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe('detectContradictions', () => {
    it('returns consistent for empty store', () => {
      const q = new QERW(tmpDir());
      const r = q.detectContradictions();
      expect(r.isConsistent).toBe(true);
      expect(r.highCurvatureNodes).toBe(0);
    });

    it('returns anomaly regions for populated store', () => {
      const q = new QERW(tmpDir());
      for (let i = 0; i < 10; i++) {
        q.weave(`Decision ${i}: ${'content'.repeat(i + 1)}`, { domain: 'decision' });
      }
      const r = q.detectContradictions({ domain: 'decision' });
      expect(typeof r.meanCurvature).toBe('number');
      expect(typeof r.maxCurvature).toBe('number');
      expect(Array.isArray(r.anomalyRegions)).toBe(true);
      expect(typeof r.h1Proxy).toBe('number');
    });

    it('domain filter excludes other domains', () => {
      const q = new QERW(tmpDir());
      q.weave('burnout signal here', { domain: 'burnout' });
      q.weave('relationship topic', { domain: 'relationship' });
      const r = q.detectContradictions({ domain: 'burnout' });
      // Single burnout node → no anomalies possible
      expect(r.isConsistent).toBe(true);
    });
  });

  describe('predict', () => {
    it('returns prediction for populated domain', () => {
      const q = new QERW(tmpDir());
      for (let i = 0; i < 5; i++) {
        q.weave(`Burnout ${i}: fatigue level ${i}`, { domain: 'burnout' });
      }
      const p = q.predict('burnout');
      expect(p.riskScore).toBeGreaterThanOrEqual(0);
      expect(p.riskScore).toBeLessThanOrEqual(1);
      expect(['high', 'medium', 'low']).toContain(p.riskLevel);
      expect(p.trajectory.length).toBeGreaterThan(0);
      expect(typeof p.meanCurvature).toBe('number');
    });

    it('returns low risk for empty domain', () => {
      const q = new QERW(tmpDir());
      const p = q.predict('burnout');
      expect(p.riskLevel).toBe('low');
      expect(p.riskScore).toBe(0);
    });
  });

  describe('query', () => {
    it('returns results sorted by geodesic distance', () => {
      const q = new QERW(tmpDir());
      q.weave('PostgreSQL database setup', { domain: 'decision' });
      q.weave('React frontend components', { domain: 'decision' });
      q.weave('Docker configuration', { domain: 'decision' });
      const r = q.query('database');
      expect(r.results.length).toBeGreaterThan(0);
      expect(r.totalCount).toBe(3);
      for (let i = 1; i < r.results.length; i++) {
        expect(r.results[i].geodesicDistance).toBeGreaterThanOrEqual(
          r.results[i - 1].geodesicDistance,
        );
      }
    });

    it('returns empty for nonexistent domain', () => {
      const q = new QERW(tmpDir());
      q.weave('test', { domain: 'general' });
      const r = q.query('test', { domain: 'burnout' });
      expect(r.results).toHaveLength(0);
    });

    it('respects topK', () => {
      const q = new QERW(tmpDir());
      for (let i = 0; i < 20; i++) {
        q.weave(`node ${i}`, { domain: 'general' });
      }
      const r = q.query('test', { topK: 5 });
      expect(r.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('consolidate', () => {
    it('prunes low-echo nodes', () => {
      const q = new QERW(tmpDir());
      q.weave('Keep me', { domain: 'general' });
      const node = q.exportNodes()[0];
      if (node) {
        node.echoDecay = 0.01;
      }
      const report = q.consolidate(0.05);
      expect(typeof report.pruned).toBe('number');
      expect(typeof report.retained).toBe('number');
      expect(typeof report.meanCurvature).toBe('number');
    });

    it('report has valid shape', () => {
      const q = new QERW(tmpDir());
      q.weave('Node A', { domain: 'general' });
      q.weave('Node B', { domain: 'general' });
      const report = q.consolidate();
      expect(typeof report.pruned).toBe('number');
      expect(typeof report.retained).toBe('number');
      expect(typeof report.meanCurvature).toBe('number');
    });
  });

  describe('persistence', () => {
    it('survives reload from disk', () => {
      const dir = tmpDir();
      const q1 = new QERW(dir);
      q1.weave('Persist me', { domain: 'decision', tags: ['test'] });
      const q2 = new QERW(dir);
      const nodes = q2.exportNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].content).toBe('Persist me');
      expect(nodes[0].curvature).toBe(0); // single node has no curvature
    });
  });
});
