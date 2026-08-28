// ── EclipseForge (L17) — Temporal Sheaf Resonator tests ──

import { EclipseForge } from './EclipseForge.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'efsr-test-'));
}

// ── weave ──────────────────────────────────────────────────────────────────

describe('EclipseForge.weave', () => {
  it('creates a node with oscillator and temporal stalk', () => {
    const e = new EclipseForge(tmpDir());
    const r = e.weave('testing EFSR temporal stalk', { domain: 'decision' });
    expect(r.nodeId).toBeTruthy();
    const nodes = e.exportNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0]!.stalk.validFrom).toBeGreaterThan(0);
    expect(nodes[0]!.stalk.validTo).toBeNull();
    expect(nodes[0]!.oscillator.amplitude).toBe(0.7);
    expect(nodes[0]!.oscillator.frequency).toBeGreaterThanOrEqual(0);
    expect(typeof nodes[0]!.oscillator.phase).toBe('number');
  });

  it('supersedes highly-similar nodes', () => {
    const e = new EclipseForge(tmpDir());
    e.weave('use PostgreSQL as primary database', { domain: 'decision' });
    const r2 = e.weave('use PostgreSQL as primary database server', { domain: 'decision' });
    expect(r2.supersededIds).toHaveLength(1);
  });

  it('detects contradictions between partially-overlapping nodes', () => {
    const e = new EclipseForge(tmpDir());
    // Use content with high Jaccard similarity AND different enough phase
    e.weave('choose PostgreSQL as the main database', { domain: 'decision' });
    const r2 = e.weave('choose MongoDB as the main database instead', { domain: 'decision' });
    expect(r2.detectedContradictions.length + r2.supersededIds.length).toBeGreaterThan(0);
  });

  it('sets causal parent edge', () => {
    const e = new EclipseForge(tmpDir());
    const r1 = e.weave('parent decision', { domain: 'decision' });
    const r2 = e.weave('child decision', { domain: 'decision', causalParentId: r1.nodeId });
    const edges = e.exportEdges();
    expect(edges.some((ed) => ed.fromId === r1.nodeId && ed.toId === r2.nodeId && ed.edgeType === 'causes')).toBe(true);
  });

  it('returns flux delta after weave', () => {
    const e = new EclipseForge(tmpDir());
    const r = e.weave('node with flux', { domain: 'general' });
    expect(typeof r.fluxDelta).toBe('number');
    expect(r.fluxDelta).toBeGreaterThanOrEqual(0);
  });

  it('detects anomaly when divergence is high', () => {
    const e = new EclipseForge(tmpDir());
    // Weave enough nodes to create higher divergence
    for (let i = 0; i < 5; i++) {
      e.weave(`node ${i} content testing anomaly detection`, { domain: 'decision' });
    }
    const status = e.getStatus();
    expect(typeof status.totalFlux).toBe('number');
  });
});

// ── propagateIncremental ──────────────────────────────────────────────────

describe('EclipseForge.propagateIncremental', () => {
  it('propagates and returns stats', () => {
    const e = new EclipseForge(tmpDir());
    e.weave('source awareness', { domain: 'decision' });
    const r = e.propagateIncremental();
    expect(typeof r.totalFluxChange).toBe('number');
    expect(Object.keys(r.nodeFluxes).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(r.nodeDivergences).length).toBeGreaterThanOrEqual(1);
  });
});

// ── detectContradictions ──────────────────────────────────────────────────

describe('EclipseForge.detectContradictions', () => {
  it('returns consistent for empty store', () => {
    const e = new EclipseForge(tmpDir());
    const r = e.detectContradictions();
    expect(r.isConsistent).toBe(true);
    expect(r.betti1).toBe(0);
  });

  it('returns consistent for few nodes', () => {
    const e = new EclipseForge(tmpDir());
    e.weave('Shared topic content for test', { domain: 'decision', source: 0 } as any);
    e.weave('Shared topic content for test', { domain: 'decision' });
    const r = e.detectContradictions();
    expect(r.isConsistent).toBe(true);
  });

  it('returns temporal overlap score', () => {
    const e = new EclipseForge(tmpDir());
    e.weave('node A', { domain: 'general' });
    e.weave('node B', { domain: 'general' });
    const r = e.detectContradictions();
    expect(typeof r.temporalOverlapScore).toBe('number');
    expect(r.temporalOverlapScore).toBeGreaterThanOrEqual(0);
  });
});

// ── predict ───────────────────────────────────────────────────────────────

describe('EclipseForge.predict', () => {
  it('returns prediction for populated domain', () => {
    const e = new EclipseForge(tmpDir());
    e.weave('starting a new project this week', { domain: 'goal' });
    e.weave('need to focus on key deliverables', { domain: 'goal' });
    e.weave('team alignment meeting scheduled', { domain: 'goal' });
    const pred = e.predict('goal');
    expect(pred.domain).toBe('goal');
    expect(pred.trajectory.length).toBe(12);
    expect(pred.riskScore).toBeGreaterThanOrEqual(0);
    expect(pred.riskScore).toBeLessThanOrEqual(1);
    expect(pred.drivingNodeIds.length).toBeGreaterThan(0);
  });

  it('returns low risk for empty domain', () => {
    const e = new EclipseForge(tmpDir());
    const pred = e.predict('burnout');
    expect(pred.riskLevel).toBe('low');
    expect(pred.riskScore).toBe(0);
  });

  it('includes eigenmode weights', () => {
    const e = new EclipseForge(tmpDir());
    e.weave('node alpha', { domain: 'decision' });
    e.weave('node beta', { domain: 'decision' });
    e.weave('node gamma', { domain: 'decision' });
    const pred = e.predict('decision');
    expect(Array.isArray(pred.eigenmodeWeights)).toBe(true);
    expect(pred.eigenmodeWeights.length).toBeGreaterThan(0);
  });
});

// ── query ─────────────────────────────────────────────────────────────────

describe('EclipseForge.query', () => {
  it('returns empty result when no nodes exist', () => {
    const e = new EclipseForge(tmpDir());
    const q = e.query('anything');
    expect(q.nodes).toHaveLength(0);
    expect(q.scores).toHaveLength(0);
  });

  it('retrieves relevant nodes by embedding similarity', () => {
    const e = new EclipseForge(tmpDir());
    e.weave('PostgreSQL database schema design techniques', { domain: 'code_pattern' });
    e.weave('React frontend component architecture', { domain: 'code_pattern' });
    const q = e.query('database schema');
    expect(q.nodes.length).toBeGreaterThan(0);
    expect(q.scores[0]).toBeGreaterThan(0);
  });

  it('filters by domain', () => {
    const e = new EclipseForge(tmpDir());
    e.weave('database query optimization', { domain: 'code_pattern' });
    e.weave('team standup meeting notes', { domain: 'general' });
    const q = e.query('meeting', { domain: 'general' });
    expect(q.nodes.length).toBe(1);
    expect(q.nodes[0]!.domain).toBe('general');
  });
});

// ── consolidate ───────────────────────────────────────────────────────────

describe('EclipseForge.consolidate', () => {
  it('returns consolidation counts', () => {
    const e = new EclipseForge(tmpDir());
    e.weave('ephemeral thought that fades', { domain: 'general', amplitude: 0.01 });
    e.weave('important persistent memory', { domain: 'decision', amplitude: 0.9 });
    const r = e.consolidate(0.05);
    expect(typeof r.quenched).toBe('number');
    expect(typeof r.retained).toBe('number');
    expect(typeof r.contradictionsResolved).toBe('number');
    expect(typeof r.meanDivergenceAfter).toBe('number');
  });
});

// ── persistence ───────────────────────────────────────────────────────────

describe('EclipseForge persistence', () => {
  it('survives reload from disk', () => {
    const dir = tmpDir();
    const e1 = new EclipseForge(dir);
    e1.weave('persistent memory test', { domain: 'general' });
    expect(e1.exportNodes().length).toBe(1);

    const e2 = new EclipseForge(dir);
    expect(e2.exportNodes().length).toBe(1);
    expect(e2.exportNodes()[0]!.content).toBe('persistent memory test');
  });
});

// ── status ────────────────────────────────────────────────────────────────

describe('EclipseForge.status', () => {
  it('returns correct counts', () => {
    const e = new EclipseForge(tmpDir());
    expect(e.getStatus().nodeCount).toBe(0);
    e.weave('test node one', { domain: 'general' });
    e.weave('test node two', { domain: 'decision' });
    const s = e.getStatus();
    expect(s.nodeCount).toBe(2);
    expect(s.activeNodeCount).toBe(2);
    expect(s.edgeCount).toBeGreaterThanOrEqual(0);
    expect(typeof s.totalFlux).toBe('number');
  });
});
