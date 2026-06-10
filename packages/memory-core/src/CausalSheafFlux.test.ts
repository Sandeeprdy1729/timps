// @timps/memory-core — CausalSheafFlux tests

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { CausalSheafFlux } from './CausalSheafFlux.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'csf-test-'));
}

describe('CausalSheafFlux', () => {
  describe('weave', () => {
    it('creates a node with flux and divergence', () => {
      const c = new CausalSheafFlux(tmpDir());
      const r = c.weave('Use PostgreSQL for storage', { domain: 'decision' });
      expect(r.nodeId).toMatch(/^csf_/);
      expect(typeof r.flux).toBe('number');
      expect(typeof r.divergence).toBe('number');
      expect(typeof r.harmonic).toBe('number');
      expect(typeof r.contradictionFlag).toBe('boolean');
    });

    it('adds edges to similar existing nodes', () => {
      const c = new CausalSheafFlux(tmpDir());
      // Use identical content to guarantee cosine > 0.3
      c.weave('Use PostgreSQL database for storage', { domain: 'decision' });
      c.weave('Use PostgreSQL database for storage', { domain: 'decision' });
      const edges = c.exportEdges();
      expect(edges.length).toBeGreaterThan(0);
      expect(edges.some(e => e.flux !== 0)).toBe(true);
    });

    it('propagates flux through incremental PQ', () => {
      const c = new CausalSheafFlux(tmpDir());
      c.weave('Node content A', { domain: 'decision' });
      c.weave('Node content B', { domain: 'decision' });
      const result = c.weave('Node content C', { domain: 'decision' });
      expect(result.flux).toBeGreaterThanOrEqual(0);
    });
  });

  describe('propagateIncremental', () => {
    it('propagates and returns stats', () => {
      const c = new CausalSheafFlux(tmpDir());
      for (let i = 0; i < 3; i++) {
        c.weave(`Node content for testing ${i}`, { domain: 'decision' });
      }
      const r = c.propagateIncremental();
      expect(typeof r.updated).toBe('number');
      expect(typeof r.meanDelta).toBe('number');
      expect(typeof r.maxDelta).toBe('number');
      expect(typeof r.quenched).toBe('number');
      expect(typeof r.iterations).toBe('number');
    });
  });

  describe('detectContradictions', () => {
    it('returns consistent for empty store', () => {
      const c = new CausalSheafFlux(tmpDir());
      const r = c.detectContradictions();
      expect(r.isConsistent).toBe(true);
      expect(r.betti1).toBe(0);
    });

    it('returns consistent for few nodes', () => {
      const c = new CausalSheafFlux(tmpDir());
      // Identical content = edge created = connected Laplacian ≠ zero matrix
      c.weave('Shared topic decision content', { domain: 'decision', source: 0 });
      c.weave('Shared topic decision content', { domain: 'decision', source: 0 });
      const r = c.detectContradictions();
      expect(r.isConsistent).toBe(true);
      expect(r.betti1).toBe(0);
    });

    it('computes anomaly nodes from divergence', () => {
      const c = new CausalSheafFlux(tmpDir());
      for (let i = 0; i < 10; i++) {
        c.weave(`Decision ${i}: content ${i}`, { domain: 'decision' });
      }
      const r = c.detectContradictions({ domain: 'decision' });
      expect(typeof r.betti1).toBe('number');
      expect(typeof r.spectralGap).toBe('number');
      expect(typeof r.totalDivergence).toBe('number');
      expect(Array.isArray(r.anomalyNodes)).toBe(true);
    });
  });

  describe('predict', () => {
    it('returns prediction for populated domain', () => {
      const c = new CausalSheafFlux(tmpDir());
      for (let i = 0; i < 5; i++) {
        c.weave(`Decision ${i}: choice about ${i}`, { domain: 'decision' });
      }
      const p = c.predict('decision');
      expect(p.riskScore).toBeGreaterThanOrEqual(0);
      expect(p.riskScore).toBeLessThanOrEqual(1);
      expect(['high', 'medium', 'low']).toContain(p.riskLevel);
      expect(p.trajectory.length).toBeGreaterThan(0);
      expect(['short', 'medium', 'long']).toContain(p.horizon);
      expect(typeof p.fluxCoherence).toBe('number');
      expect(p.explanation).toContain('CSF');
    });

    it('returns low risk for empty domain', () => {
      const c = new CausalSheafFlux(tmpDir());
      const p = c.predict('burnout');
      expect(p.riskLevel).toBe('low');
      expect(p.riskScore).toBe(0);
      expect(p.explanation).toContain('no data');
    });

    it('supports intervention simulation', () => {
      const c = new CausalSheafFlux(tmpDir());
      const nodes: string[] = [];
      for (let i = 0; i < 5; i++) {
        const r = c.weave(`Node ${i}`, { domain: 'decision' });
        nodes.push(r.nodeId);
      }
      const p = c.predict('decision', {
        intervention: { nodeId: nodes[0], sourceDelta: 2.0 },
      });
      expect(p.trajectory.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('returns flux-weighted results sorted by relevance', () => {
      const c = new CausalSheafFlux(tmpDir());
      c.weave('PostgreSQL database setup', { domain: 'decision' });
      c.weave('React frontend components', { domain: 'general' });
      c.weave('Docker configuration', { domain: 'decision' });
      const r = c.query('database');
      expect(r.results.length).toBeGreaterThan(0);
      expect(r.totalCount).toBe(3);
      for (let i = 1; i < r.results.length; i++) {
        expect(r.results[i].relevance).toBeLessThanOrEqual(r.results[i - 1].relevance);
      }
    });

    it('returns empty for nonexistent domain', () => {
      const c = new CausalSheafFlux(tmpDir());
      c.weave('test', { domain: 'general' });
      const r = c.query('test', { domain: 'burnout' });
      expect(r.results).toHaveLength(0);
    });

    it('respects topK', () => {
      const c = new CausalSheafFlux(tmpDir());
      for (let i = 0; i < 20; i++) {
        c.weave(`node ${i}`, { domain: 'general' });
      }
      const r = c.query('test', { topK: 5 });
      expect(r.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('consolidate', () => {
    it('returns report with valid shape', () => {
      const c = new CausalSheafFlux(tmpDir());
      c.weave('PostgreSQL database', { domain: 'general', source: 0.1 });
      c.weave('React frontend', { domain: 'general', source: 0.1 });
      const r = c.consolidate();
      expect(typeof r.pruned).toBe('number');
      expect(typeof r.retained).toBe('number');
      expect(typeof r.resolvedContradictions).toBe('number');
      expect(typeof r.meanDivergenceAfter).toBe('number');
    });
  });

  describe('persistence', () => {
    it('survives reload from disk', () => {
      const dir = tmpDir();
      const c1 = new CausalSheafFlux(dir);
      c1.weave('Persist me', { domain: 'decision', tags: ['test'] });
      const c2 = new CausalSheafFlux(dir);
      const nodes = c2.exportNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].content).toBe('Persist me');
    });
  });

  describe('status', () => {
    it('returns correct counts after weaves', () => {
      const c = new CausalSheafFlux(tmpDir());
      expect(c.status().nodeCount).toBe(0);
      c.weave('Node A content for testing', { domain: 'general' });
      c.weave('Node B content for testing', { domain: 'decision' });
      const s = c.status();
      expect(s.nodeCount).toBe(2);
      expect(s.edgeCount).toBeGreaterThanOrEqual(0);
      expect(typeof s.totalFlux).toBe('number');
      expect(typeof s.totalDivergence).toBe('number');
    });
  });
});
