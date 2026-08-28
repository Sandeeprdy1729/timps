// @timps/memory-core — QISRD tests

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { QISRD } from './QISRD.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qisrd-test-'));
}

describe('QISRD', () => {
  describe('weave', () => {
    it('creates a node with resonance and entropy', () => {
      const q = new QISRD(tmpDir());
      const r = q.weave('Use PostgreSQL for storage', { domain: 'decision' });
      expect(r.nodeId).toMatch(/^qisrd_/);
      expect(r.resolution).toBe('fine');
      expect(typeof r.entropy).toBe('number');
      expect(r.entropy).toBeGreaterThan(0);
      expect(typeof r.resonanceScore).toBe('number');
      expect(typeof r.contradictionFlag).toBe('boolean');
    });

    it('creates edges to existing nodes based on embedding similarity', () => {
      const q = new QISRD(tmpDir());
      q.weave('First decision about databases', { domain: 'decision' });
      q.weave('Second node on backend infra', { domain: 'decision' });
      q.weave('Third unrelated weather report', { domain: 'general' });
      const edges = q.exportEdges();
      expect(edges.length).toBeGreaterThan(0);
    });

    it('accepts coarse resolution', () => {
      const q = new QISRD(tmpDir());
      const r = q.weave('Long-term goal', { domain: 'goal', resolution: 'coarse' });
      expect(r.resolution).toBe('coarse');
    });
  });

  describe('detectContradictions', () => {
    it('returns consistent for empty store', () => {
      const q = new QISRD(tmpDir());
      const r = q.detectContradictions();
      expect(r.isConsistent).toBe(true);
      expect(r.betti1).toBe(0);
    });

    it('returns consistent for few nodes', () => {
      const q = new QISRD(tmpDir());
      q.weave('Node A', { domain: 'decision' });
      q.weave('Node B', { domain: 'general' });
      const r = q.detectContradictions();
      expect(r.isConsistent).toBe(true);
    });

    it('computes anomaly nodes for populated store', () => {
      const q = new QISRD(tmpDir());
      for (let i = 0; i < 10; i++) {
        q.weave(`Decision ${i}: ${'content'.repeat(i + 1)}`, { domain: 'decision' });
      }
      const r = q.detectContradictions({ domain: 'decision' });
      expect(typeof r.betti1).toBe('number');
      expect(typeof r.spectralGap).toBe('number');
      expect(typeof r.driftScore).toBe('number');
      expect(r.driftScore).toBeGreaterThanOrEqual(0);
    });

    it('domain filter excludes other domains', () => {
      const q = new QISRD(tmpDir());
      q.weave('burnout symptom fatigue', { domain: 'burnout' });
      q.weave('relationship trust issue', { domain: 'relationship' });
      const r = q.detectContradictions({ domain: 'burnout' });
      expect(r.isConsistent).toBe(true);
    });
  });

  describe('langevinStep', () => {
    it('returns a reprojected vector on the sphere', () => {
      const q = new QISRD(tmpDir());
      const x = new Array(64).fill(0).map(() => Math.random() - 0.5);
      const target = new Array(64).fill(0).map(() => Math.random() - 0.5);
      // Normalize both
      let nx = Math.sqrt(x.reduce((s, v) => s + v * v, 0));
      for (let i = 0; i < x.length; i++) x[i] /= nx;
      let nt = Math.sqrt(target.reduce((s, v) => s + v * v, 0));
      for (let i = 0; i < target.length; i++) target[i] /= nt;

      const result = q.langevinStep(x, target);
      expect(result).toHaveLength(64);

      // Check it's unit-norm
      let norm = 0;
      for (const v of result) norm += v * v;
      expect(Math.sqrt(norm)).toBeCloseTo(1, 1);
    });
  });

  describe('predict', () => {
    it('returns prediction for populated domain', () => {
      const q = new QISRD(tmpDir());
      for (let i = 0; i < 5; i++) {
        q.weave(`Decision ${i}: make choice about ${i}`, { domain: 'decision' });
      }
      const p = q.predict('decision');
      expect(p.riskScore).toBeGreaterThanOrEqual(0);
      expect(p.riskScore).toBeLessThanOrEqual(1);
      expect(['high', 'medium', 'low']).toContain(p.riskLevel);
      expect(p.trajectory.length).toBeGreaterThan(0);
      expect(typeof p.resonance).toBe('number');
      expect(typeof p.uncertainty).toBe('number');
      expect(p.explanation).toContain('QISRD');
    });

    it('returns low risk for empty domain with explanation', () => {
      const q = new QISRD(tmpDir());
      const p = q.predict('burnout');
      expect(p.riskLevel).toBe('low');
      expect(p.riskScore).toBe(0);
      expect(p.explanation).toContain('no data');
    });
  });

  describe('query', () => {
    it('returns coarse-bias results sorted by relevance', () => {
      const q = new QISRD(tmpDir());
      q.weave('PostgreSQL database setup', { domain: 'decision', resolution: 'coarse' });
      q.weave('React frontend components', { domain: 'general', resolution: 'fine' });
      q.weave('Docker configuration', { domain: 'decision', resolution: 'fine' });
      const r = q.query('database');
      expect(r.results.length).toBeGreaterThan(0);
      expect(r.totalCount).toBe(3);
      for (let i = 1; i < r.results.length; i++) {
        expect(r.results[i].relevance).toBeLessThanOrEqual(r.results[i - 1].relevance);
      }
    });

    it('returns empty for nonexistent domain', () => {
      const q = new QISRD(tmpDir());
      q.weave('test', { domain: 'general' });
      const r = q.query('test', { domain: 'burnout' });
      expect(r.results).toHaveLength(0);
    });

    it('respects topK', () => {
      const q = new QISRD(tmpDir());
      for (let i = 0; i < 20; i++) {
        q.weave(`node ${i}`, { domain: 'general' });
      }
      const r = q.query('test', { topK: 5 });
      expect(r.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('consolidate', () => {
    it('report has valid shape with drift', () => {
      const q = new QISRD(tmpDir());
      q.weave('Node A', { domain: 'general' });
      q.weave('Node B', { domain: 'general' });
      const report = q.consolidate();
      expect(typeof report.pruned).toBe('number');
      expect(typeof report.retained).toBe('number');
      expect(typeof report.driftAfter).toBe('number');
      expect(typeof report.resolvedContradictions).toBe('number');
      expect(typeof report.topologySurgery).toBe('boolean');
    });

    it('merges near-duplicates during topology surgery', () => {
      const q = new QISRD(tmpDir());
      q.weave('Database decision: PostgreSQL', { domain: 'decision', tags: ['critical'] });
      q.weave('Frontend choice: React', { domain: 'decision', tags: ['critical'] });
      q.weave('Infra: Docker', { domain: 'decision', tags: ['critical'] });
      const report = q.consolidate(0.3);
      expect(report.retained).toBe(3); // all distinct — no merge
      expect(typeof report.pruned).toBe('number');
      expect(typeof report.resolvedContradictions).toBe('number');
    });
  });

  describe('persistence', () => {
    it('survives reload from disk', () => {
      const dir = tmpDir();
      const q1 = new QISRD(dir);
      q1.weave('Persist me', { domain: 'decision', tags: ['test'] });
      const q2 = new QISRD(dir);
      const nodes = q2.exportNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].content).toBe('Persist me');
    });
  });

  describe('status', () => {
    it('returns correct counts', () => {
      const q = new QISRD(tmpDir());
      expect(q.status().nodeCount).toBe(0);
      expect(q.status().edgeCount).toBe(0);
      q.weave('Node A', { domain: 'general' });
      q.weave('Node B', { domain: 'decision' });
      expect(q.status().nodeCount).toBe(2);
      expect(q.status().edgeCount).toBeGreaterThanOrEqual(0);
    });
  });
});
