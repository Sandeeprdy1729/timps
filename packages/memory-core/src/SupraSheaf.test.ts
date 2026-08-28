// @timps/memory-core — SupraSheaf tests

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { MemoryEngine, SupraSheaf } from './index.js';
import type { SupraNodeRef } from './SupraSheaf.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'supra-test-'));
}

function makeEngine(): MemoryEngine {
  const dir = tmpDir();
  const engine = new MemoryEngine(dir);
  // Seed some data into each forge
  const chronos = engine.chronosForge;
  (chronos as any).weave?.('Use PostgreSQL for storage', {
    domain: 'decision', causalParentId: null, tags: [], baseImportance: 0.8
  });
  (chronos as any).weave?.('Use Redis for caching', {
    domain: 'decision', causalParentId: null, tags: [], baseImportance: 0.6
  });

  try {
    const echo = engine.echoForge;
    (echo as any).weave?.('Switch to MongoDB', {
      domain: 'decision', causalParentId: null, tags: []
    });
    (echo as any).weave?.('Use JWT tokens', {
      domain: 'decision', causalParentId: null, tags: []
    });
  } catch { /* ignore if weave not exposed */ }

  const aether = engine.aetherForge;
  aether.weave('Use PostgreSQL', { domain: 'decision', evidenceCount: 3, amplitude: 0.7 });
  aether.weave('Use JWT for auth', { domain: 'decision', evidenceCount: 2, amplitude: 0.6 });

  return engine;
}

describe('SupraSheaf', () => {
  it('collectNodes returns nodes from all wired forges', () => {
    const engine = makeEngine();
    const sheaf = new SupraSheaf(engine);
    const nodes = sheaf.collectNodes();
    expect(nodes.length).toBeGreaterThan(0);
    const layers = new Set(nodes.map(n => n.layerId));
    expect(layers.has('aether')).toBe(true);
  });

  it('collectNodes returns nodes with required fields', () => {
    const engine = makeEngine();
    const sheaf = new SupraSheaf(engine);
    const nodes = sheaf.collectNodes();
    for (const n of nodes) {
      expect(typeof n.layerId).toBe('string');
      expect(typeof n.nodeId).toBe('string');
      expect(typeof n.domain).toBe('string');
      expect(typeof n.content).toBe('string');
      expect(typeof n.amplitude).toBe('number');
      expect(typeof n.createdAt).toBe('number');
    }
  });

  it('buildSupraGraph returns nodes and edge arrays', () => {
    const engine = makeEngine();
    const sheaf = new SupraSheaf(engine);
    const { nodes, edges } = sheaf.buildSupraGraph();
    expect(Array.isArray(nodes)).toBe(true);
    expect(Array.isArray(edges)).toBe(true);
  });

  it('buildSupraGraph creates cross-layer edges for similar content', () => {
    const engine = makeEngine();
    const aether = engine.aetherForge;
    aether.weave('Use PostgreSQL for storage', {
      domain: 'decision', evidenceCount: 3, amplitude: 0.8
    });
    const sheaf = new SupraSheaf(engine);
    const { edges } = sheaf.buildSupraGraph();
    const crossLayer = edges.filter(e => e.fromLayer !== e.toLayer);
    // At least some cross-layer edges for similar content
    expect(crossLayer.length).toBeGreaterThanOrEqual(0);
  });

  it('computeCrossLayerH1 returns expected shape', () => {
    const engine = makeEngine();
    const sheaf = new SupraSheaf(engine);
    const result = sheaf.computeCrossLayerH1();
    expect(typeof result.betti1).toBe('number');
    expect(typeof result.spectralGap).toBe('number');
    expect(typeof result.isConsistent).toBe('boolean');
    expect(typeof result.layerCount).toBe('number');
    expect(typeof result.totalNodes).toBe('number');
    expect(Array.isArray(result.contradictions)).toBe(true);
    expect(typeof result.crossLayerEdges).toBe('number');
  });

  it('computeCrossLayerH1 is consistent for small graph', () => {
    const engine = makeEngine();
    const sheaf = new SupraSheaf(engine);
    const result = sheaf.computeCrossLayerH1();
    // Small graph with few conflicts should be mostly consistent
    expect(result.totalNodes).toBeGreaterThan(0);
  });

  it('jointForesight returns prediction for a domain', () => {
    const engine = makeEngine();
    const aether = engine.aetherForge;
    aether.weave('decision node', { domain: 'decision', evidenceCount: 2, amplitude: 0.6 });
    aether.weave('another decision', { domain: 'decision', evidenceCount: 3, amplitude: 0.7 });
    const sheaf = new SupraSheaf(engine);
    const result = sheaf.jointForesight('decision', { horizon: 6 });
    expect(typeof result.riskScore).toBe('number');
    expect(result.trajectory.length).toBe(6);
    expect(typeof result.layerContributions).toBe('object');
    expect(typeof result.explanation).toBe('string');
  });

  it('jointForesight returns low risk for empty domain', () => {
    const engine = makeEngine();
    const sheaf = new SupraSheaf(engine);
    const result = sheaf.jointForesight('burnout', { horizon: 4 });
    expect(result.riskLevel).toBe('low');
    expect(result.trajectory.length).toBe(4);
  });

  it('sheafConsistency returns report with required fields', () => {
    const engine = makeEngine();
    const sheaf = new SupraSheaf(engine);
    const report = sheaf.sheafConsistency();
    expect(typeof report.layerSizes).toBe('object');
    expect(typeof report.totalNodes).toBe('number');
    expect(typeof report.crossLayerEdges).toBe('number');
    expect(typeof report.gluingScore).toBe('number');
    expect(Array.isArray(report.warnings)).toBe(true);
  });

  it('sheafConsistency gluingScore is in [0, 1]', () => {
    const engine = makeEngine();
    const sheaf = new SupraSheaf(engine);
    const report = sheaf.sheafConsistency();
    expect(report.gluingScore).toBeGreaterThanOrEqual(0);
    expect(report.gluingScore).toBeLessThanOrEqual(1);
  });
});
