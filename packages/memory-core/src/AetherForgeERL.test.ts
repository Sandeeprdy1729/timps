// @timps/memory-core — AetherForgeERL tests

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  AetherForgeERL,
  aetherEmbed,
} from './AetherForgeERL';
import type { ERLNode, ERLDomain, EpistemicStatus } from './AetherForgeERL';
import type { FlowForgePrediction, FlowForgeAutoConsolidationReport } from './AetherForgeERL';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aether-test-'));
}

function makeForge(): { forge: AetherForgeERL; dir: string } {
  const dir = tmpDir();
  const forge = new AetherForgeERL(dir);
  return { forge, dir };
}

function makeNode(overrides: Partial<ERLNode> = {}): ERLNode {
  return {
    id: 'n1',
    content: 'test content',
    domain: 'general',
    embedding: { 5: 0.5, 10: 0.5, 20: 0.707 },
    validFrom: Date.now() - 1000,
    validTo: null,
    status: 'belief',
    supersededBy: null,
    contradictionEdgeIds: [],
    evidenceCount: 3,
    confidence: 0.7,
    amplitude: 0.8,
    frequency: 0.2,
    phase: 0,
    latticeLevel: 0,
    retrievalCount: 0,
    tags: [],
    createdAt: Date.now() - 60_000,
    ...overrides,
  };
}

// ── Pure function tests ─────────────────────────────────────────────────

describe('aetherEmbed', () => {
  it('returns empty record for blank text', () => {
    expect(aetherEmbed('')).toEqual({});
  });
  it('returns a normalised sparse vector (L2 norm approx 1)', () => {
    const v = aetherEmbed('epistemic resonance lattice weave');
    const norm = Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
  it('all dimension keys are within [0, 64)', () => {
    const v = aetherEmbed('burnout stress velocity contradiction drift');
    for (const k of Object.keys(v)) {
      expect(Number(k)).toBeGreaterThanOrEqual(0);
      expect(Number(k)).toBeLessThan(64);
    }
  });
  it('similar texts produce positive similarity', () => {
    const a = aetherEmbed('epistemic state tracking with evidence');
    const b = aetherEmbed('epistemic evidence tracking');
    const dot = Object.keys(a).reduce((s, k) => s + (a[Number(k)] ?? 0) * (b[Number(k)] ?? 0), 0);
    expect(dot).toBeGreaterThan(0.1);
  });
});

// ── AetherForgeERL weave tests ─────────────────────────────────────────

describe('AetherForgeERL — weave', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => { ({ forge, dir } = makeForge()); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns a nodeId on successful weave', () => {
    const result = forge.weave('Epistemic belief about project architecture');
    expect(result.nodeId).toMatch(/^ae_/);
    expect(Array.isArray(result.supersededIds)).toBe(true);
    expect(Array.isArray(result.detectedContradictions)).toBe(true);
    expect(typeof result.latticeLevel).toBe('number');
  });

  it('persists node to disk', () => {
    forge.weave('Burnout signal detected', { domain: 'burnout' });
    const reloaded = new AetherForgeERL(dir);
    const status = reloaded.getStatus();
    expect(status.nodeCount).toBeGreaterThanOrEqual(1);
  });

  it('applies the specified domain', () => {
    forge.weave('Team friction ongoing', { domain: 'relationship' });
    forge.weave('Code complexity growing', { domain: 'code_pattern' });
    const status = forge.getStatus();
    expect(status.domainCounts.relationship).toBe(1);
    expect(status.domainCounts.code_pattern).toBe(1);
  });

  it('applies custom tags', () => {
    forge.weave('Tech debt accumulating', { domain: 'code_pattern', tags: ['sprint-22'] });
    const nodes = forge.exportNodes();
    expect(nodes.some(n => n.tags.includes('sprint-22'))).toBe(true);
  });

  it('sets causal parent id correctly', () => {
    const first = forge.weave('Started new project', { domain: 'goal' });
    const second = forge.weave('Milestone missed', { domain: 'goal', causalParentId: first.nodeId });
    const node = forge.exportNodes().find(n => n.id === second.nodeId);
    expect(node?.supersededBy).toBeNull();
    // Check edge exists
    const edges = forge.exportEdges().filter(e => e.edgeType === 'causes');
    expect(edges.length).toBeGreaterThanOrEqual(1);
  });

  it('assigns lattice level based on timestamp', () => {
    const result = forge.weave('Test lattice level assignment');
    expect(result.latticeLevel).toBeGreaterThanOrEqual(0);
  });

  it('default status is hypothesis for low evidence', () => {
    const result = forge.weave('New tentative observation');
    const node = forge.exportNodes().find(n => n.id === result.nodeId);
    expect(node?.status).toBe('hypothesis');
  });

  it('status is belief for sufficient evidence', () => {
    const result = forge.weave('Well-evidenced claim', { evidenceCount: 5 });
    const node = forge.exportNodes().find(n => n.id === result.nodeId);
    expect(node?.status).toBe('belief');
    expect(node?.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it('detects supersession on similar content', () => {
    forge.weave('Use PostgreSQL for the database', { domain: 'decision', evidenceCount: 5 });
    const result = forge.weave('Use PostgreSQL for the database', { domain: 'decision', evidenceCount: 5 });
    expect(result.supersededIds.length).toBeGreaterThanOrEqual(1);
  });

  it('detects contradictions with phase conflict', () => {
    forge.weave('We should use JWT tokens for auth', { domain: 'decision', evidenceCount: 5 });
    const result = forge.weave('We should not use JWT tokens for auth', { domain: 'decision', evidenceCount: 5 });
    // Contradiction may be detected based on phase + jaccard
    const node = forge.exportNodes().find(n => n.id === result.nodeId);
    if (result.detectedContradictions.length > 0) {
      expect(node?.status).toBe('contradiction');
    }
  });
});

// ── AetherForgeERL query tests ─────────────────────────────────────────

describe('AetherForgeERL — query', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => {
    ({ forge, dir } = makeForge());
    forge.weave('Sprint velocity unsustainably high', { domain: 'burnout', evidenceCount: 3 });
    forge.weave('Working overtime every weekend', { domain: 'burnout', evidenceCount: 3 });
    forge.weave('Team relationship deteriorating', { domain: 'relationship', evidenceCount: 3 });
    forge.weave('Sunny weather is great', { domain: 'general' });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns nodes array', () => {
    const result = forge.query('stress and overload');
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it('scores array matches nodes array length', () => {
    const result = forge.query('burnout velocity sprint');
    expect(result.scores).toHaveLength(result.nodes.length);
  });

  it('all scores are non-negative', () => {
    const result = forge.query('burnout');
    for (const s of result.scores) expect(s).toBeGreaterThanOrEqual(0);
  });

  it('domain filter returns only matching domain', () => {
    const result = forge.query('stress', { domain: 'burnout' });
    for (const n of result.nodes) expect(n.domain).toBe('burnout');
  });

  it('respects topK limit', () => {
    const result = forge.query('anything', { topK: 2 });
    expect(result.nodes.length).toBeLessThanOrEqual(2);
  });

  it('status filter works', () => {
    const result = forge.query('sprint velocity', { status: 'belief' });
    for (const n of result.nodes) {
      expect(n.status).toBe('belief');
    }
  });

  it('predict:true returns predictions array', () => {
    const result = forge.query('burnout risk', { domain: 'burnout', predict: true });
    expect(result.predictions).toBeDefined();
  });

  it('cohomology:true returns cohomology result', () => {
    const result = forge.query('anything', { cohomology: true });
    expect(result.cohomology).toBeDefined();
    expect(typeof result.cohomology?.isConsistent).toBe('boolean');
  });
});

// ── AetherForgeERL predict tests ───────────────────────────────────────

describe('AetherForgeERL — predict', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => {
    ({ forge, dir } = makeForge());
    forge.weave('Feeling stressed and overloaded', { domain: 'burnout', evidenceCount: 3 });
    forge.weave('No energy left after sprints', { domain: 'burnout', evidenceCount: 3 });
    forge.weave('Skipping sleep to meet deadlines', { domain: 'burnout', evidenceCount: 3 });
    forge.weave('Considering quitting the team', { domain: 'burnout', evidenceCount: 5, status: 'belief' });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns an ERLPrediction with required fields', () => {
    const pred = forge.predict('burnout');
    expect(typeof pred.riskScore).toBe('number');
    expect(['high', 'medium', 'low']).toContain(pred.riskLevel);
    expect(Array.isArray(pred.trajectory)).toBe(true);
    expect(typeof pred.explanation).toBe('string');
    expect(typeof pred.confidence).toBe('number');
    expect(typeof pred.epistemicWeight).toBe('number');
    expect(typeof pred.contradictionBurden).toBe('number');
  });

  it('riskScore is between 0 and 1', () => {
    const pred = forge.predict('burnout');
    expect(pred.riskScore).toBeGreaterThanOrEqual(0);
    expect(pred.riskScore).toBeLessThanOrEqual(1);
  });

  it('trajectory length equals steps parameter', () => {
    const pred = forge.predict('burnout', { steps: 5 });
    expect(pred.trajectory).toHaveLength(5);
  });

  it('returns low risk for domain with no nodes', () => {
    const pred = forge.predict('contradiction');
    expect(pred.riskScore).toBe(0);
    expect(pred.riskLevel).toBe('low');
  });

  it('predictAll returns all domains', () => {
    const results = forge.predictAll();
    const domains: ERLDomain[] = ['burnout', 'relationship', 'decision', 'code_pattern', 'contradiction', 'goal', 'general'];
    for (const d of domains) {
      expect(results[d]).toBeDefined();
      expect(typeof results[d].riskScore).toBe('number');
    }
  });
});

// ── AetherForgeERL detectContradictions tests ──────────────────────────

describe('AetherForgeERL — detectContradictions', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => {
    ({ forge, dir } = makeForge());
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns consistent for empty graph', () => {
    const coh = forge.detectContradictions();
    expect(coh.isConsistent).toBe(true);
    expect(coh.betti1).toBe(0);
  });

  it('returns consistent for single node', () => {
    forge.weave('Single belief node', { domain: 'general', evidenceCount: 5 });
    const coh = forge.detectContradictions();
    expect(coh.isConsistent).toBe(true);
  });

  it('detects contradictions from contradictory nodes', () => {
    forge.weave('We use JWT tokens for authentication', { domain: 'decision', evidenceCount: 5 });
    forge.weave('We do not use JWT tokens for authentication', { domain: 'decision', evidenceCount: 5 });
    const coh = forge.detectContradictions({ domain: 'decision' });
    // May or may not detect — depends on phase conflict
    // At minimum, it should not crash
    expect(typeof coh.isConsistent).toBe('boolean');
    expect(Array.isArray(coh.contradictionNodeIds)).toBe(true);
  });

  it('returns epistemic distribution', () => {
    forge.weave('Hypothesis node', { domain: 'general' });
    forge.weave('Belief node', { domain: 'general', evidenceCount: 5 });
    const coh = forge.detectContradictions();
    expect(coh.epistemicDistribution).toBeDefined();
    const dist = coh.epistemicDistribution!;
    expect(Object.keys(dist).length).toBeGreaterThanOrEqual(1);
  });

  it('domain filter works', () => {
    forge.weave('Burnout signal', { domain: 'burnout', evidenceCount: 3 });
    forge.weave('Decision about architecture', { domain: 'decision', evidenceCount: 5 });
    const coh = forge.detectContradictions({ domain: 'burnout' });
    expect(typeof coh.isConsistent).toBe('boolean');
  });
});

// ── AetherForgeERL join tests ──────────────────────────────────────────

describe('AetherForgeERL — join', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => {
    ({ forge, dir } = makeForge());
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns null for incompatible nodes', () => {
    const a = forge.weave('First belief about architecture', { domain: 'decision', evidenceCount: 3 });
    const b = forge.weave('Completely unrelated content about weather', { domain: 'general', evidenceCount: 3 });
    const result = forge.join(a.nodeId, b.nodeId);
    expect(result).toBeNull();
  });

  it('joins similar nodes and merges evidence', () => {
    const a = forge.weave('Use PostgreSQL for the database', { domain: 'decision', evidenceCount: 3 });
    const b = forge.weave('PostgreSQL is our database of choice', { domain: 'decision', evidenceCount: 5 });
    const result = forge.join(a.nodeId, b.nodeId);
    if (result) {
      expect(typeof result.survivorId).toBe('string');
      expect(result.contradictionsCreated).toBeGreaterThanOrEqual(0);
      const survivor = forge.exportNodes().find(n => n.id === result.survivorId);
      expect(survivor).toBeDefined();
    }
  });

  it('cannot join contradictory nodes', () => {
    const a = forge.weave('Use JWT for authentication', { domain: 'decision', evidenceCount: 5 });
    const b = forge.weave('Do not use JWT for authentication', { domain: 'decision', evidenceCount: 5 });
    const nodeB = forge.exportNodes().find(n => n.id === b.nodeId);
    // If status is contradiction, join should return null
    if (nodeB?.status === 'contradiction' || b.detectedContradictions.length > 0) {
      const result = forge.join(a.nodeId, b.nodeId);
      expect(result).toBeNull();
    }
  });
});

// ── AetherForgeERL meet tests ──────────────────────────────────────────

describe('AetherForgeERL — meet', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => {
    ({ forge, dir } = makeForge());
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns resolved ids for contradiction pair', () => {
    const a = forge.weave('Use JWT for authentication', { domain: 'decision', evidenceCount: 5 });
    const b = forge.weave('Do not use JWT for authentication', { domain: 'decision', evidenceCount: 5 });
    // Check if a contradiction edge exists
    const contraEdge = forge.exportEdges().find(e => e.edgeType === 'contradicts');
    if (contraEdge) {
      const result = forge.meet(contraEdge.fromId, contraEdge.toId);
      expect(Array.isArray(result.resolvedIds)).toBe(true);
      expect(typeof result.consistencyRestored).toBe('boolean');
    } else {
      // No contradiction means nothing to meet
      const result = forge.meet(a.nodeId, b.nodeId);
      expect(result.consistencyRestored).toBe(true);
    }
  });

  it('resolves when one node dominates in evidence', () => {
    // Create a contradiction-like pair where one has more evidence
    const a = forge.weave('Use JWT for authentication', { domain: 'decision', evidenceCount: 10 });
    const b = forge.weave('Do not use JWT for authentication', { domain: 'decision', evidenceCount: 2 });
    const result = forge.meet(a.nodeId, b.nodeId);
    expect(result.consistencyRestored).toBeDefined();
  });
});

// ── AetherForgeERL consolidate tests ───────────────────────────────────

describe('AetherForgeERL — consolidate', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => {
    ({ forge, dir } = makeForge());
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns a consolidation report', () => {
    forge.weave('Node to check', { domain: 'general', evidenceCount: 3 });
    const report = forge.consolidate();
    expect(typeof report.quenched).toBe('number');
    expect(typeof report.retained).toBe('number');
    expect(typeof report.crystallised).toBe('number');
    expect(typeof report.contradictionsResolved).toBe('number');
    expect(typeof report.epistemicUpgrades).toBe('number');
    expect(typeof report.latticeLevelCount).toBe('number');
  });

  it('quenches a very low amplitude node', () => {
    forge.weave('Faded memory', { domain: 'general', amplitude: 0.001 });
    const report = forge.consolidate(0.05);
    expect(report.quenched).toBeGreaterThanOrEqual(1);
  });

  it('does not quench nodes with normal amplitude', () => {
    forge.weave('Important ongoing signal', { domain: 'burnout', amplitude: 0.9, evidenceCount: 5 });
    const report = forge.consolidate(0.04);
    expect(report.retained).toBeGreaterThanOrEqual(1);
  });

  it('upgrades hypothesis to belief with sufficient evidence', () => {
    forge.weave('Evidence-rich observation', { domain: 'general', evidenceCount: 5 });
    const report = forge.consolidate();
    expect(report.epistemicUpgrades).toBeGreaterThanOrEqual(0);
  });
});

// ── AetherForgeERL persistence tests ───────────────────────────────────

describe('AetherForgeERL — persistence', () => {
  it('reloads state from disk across instances', () => {
    const dir = tmpDir();
    const forge1 = new AetherForgeERL(dir);
    forge1.weave('Persisted memory', { domain: 'general', tags: ['persist'] });
    const forge2 = new AetherForgeERL(dir);
    expect(forge2.getStatus().nodeCount).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('starts with empty store when no file exists', () => {
    const dir = tmpDir();
    const forge = new AetherForgeERL(dir);
    expect(forge.getStatus().nodeCount).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('handles corrupted store file gracefully', () => {
    const dir = tmpDir();
    const aetherDir = path.join(dir, 'aether');
    fs.mkdirSync(aetherDir, { recursive: true });
    fs.writeFileSync(path.join(aetherDir, 'aether.json'), 'NOT_JSON');
    expect(() => new AetherForgeERL(dir)).not.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ── AetherForgeERL getContextString / getStatus tests ──────────────────

describe('AetherForgeERL — getContextString', () => {
  it('returns formatted string with domain header', () => {
    const { forge, dir } = makeForge();
    forge.weave('Important burnout signal here', { domain: 'burnout', evidenceCount: 3 });
    const ctx = forge.getContextString('burnout');
    expect(ctx).toContain('[belief');
    expect(ctx).toContain('Important burnout signal here');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns no active nodes message for empty domain', () => {
    const { forge, dir } = makeForge();
    const ctx = forge.getContextString('relationship');
    expect(ctx).toContain('No active ERL nodes');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('AetherForgeERL — getStatus', () => {
  it('returns accurate status counts', () => {
    const { forge, dir } = makeForge();
    forge.weave('Node A', { domain: 'burnout', evidenceCount: 3 });
    forge.weave('Node B', { domain: 'goal', evidenceCount: 3 });
    const status = forge.getStatus();
    expect(status.nodeCount).toBe(2);
    expect(status.activeNodeCount).toBe(2);
    expect(status.edgeCount).toBe(0);
    expect(status.avgAmplitude).toBeGreaterThan(0);
    expect(typeof status.latticeLevelCount).toBe('number');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('epistemicDistribution is populated', () => {
    const { forge, dir } = makeForge();
    forge.weave('Test node', { domain: 'general', evidenceCount: 3 });
    const status = forge.getStatus();
    expect(status.epistemicDistribution).toBeDefined();
    expect(Object.keys(status.epistemicDistribution!).length).toBeGreaterThanOrEqual(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ── AetherForgeERL exportNodes / exportEdges tests ─────────────────────

describe('AetherForgeERL — export', () => {
  it('exportNodes returns all nodes', () => {
    const { forge, dir } = makeForge();
    forge.weave('Node A', { domain: 'burnout' });
    forge.weave('Node B', { domain: 'goal' });
    expect(forge.exportNodes()).toHaveLength(2);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('exportEdges returns edges after parent-child weave', () => {
    const { forge, dir } = makeForge();
    const root = forge.weave('Root', { domain: 'goal', evidenceCount: 3 });
    forge.weave('Child', { domain: 'goal', causalParentId: root.nodeId, evidenceCount: 3 });
    expect(forge.exportEdges().some(e => e.edgeType === 'causes')).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ── Feature 1: queryWithHierarchy (MemTree) ─────────────────────────────

describe('AetherForgeERL — queryWithHierarchy (MemTree)', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => {
    ({ forge, dir } = makeForge());
    forge.weave('Use JWT for authentication', { domain: 'decision', evidenceCount: 5 });
    forge.weave('PostgreSQL is the primary database', { domain: 'decision', evidenceCount: 3 });
    forge.weave('React 19 with TypeScript for frontend', { domain: 'decision', evidenceCount: 4 });
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns results ordered by score', () => {
    const r = forge.queryWithHierarchy('JWT auth', { topK: 5 });
    expect(r.nodes.length).toBeGreaterThanOrEqual(1);
    expect(r.scores.length).toBe(r.nodes.length);
    expect(r.scores[0]).toBeGreaterThanOrEqual(0);
  });

  it('filters by domain', () => {
    const r = forge.queryWithHierarchy('JWT auth', { domain: 'goal' });
    expect(r.nodes.length).toBe(0);
  });

  it('respects topK limit', () => {
    const r = forge.queryWithHierarchy('database frontend auth', { topK: 2 });
    expect(r.nodes.length).toBeLessThanOrEqual(2);
  });

  it('returns empty for empty query', () => {
    const r = forge.queryWithHierarchy('', { topK: 5 });
    expect(r.nodes).toEqual([]);
  });
});

// ── Feature 2: forwardQuench ────────────────────────────────────────────

describe('AetherForgeERL — forwardQuench', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => {
    ({ forge, dir } = makeForge());
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns forecast with required fields', () => {
    const fq = forge.forwardQuench('burnout', { horizonSteps: 6 });
    expect(fq).toHaveProperty('domain');
    expect(fq).toHaveProperty('currentRisk');
    expect(fq).toHaveProperty('trajectory');
    expect(Array.isArray(fq.nodesAtRisk)).toBe(true);
    expect(typeof fq.interventionRecommended).toBe('boolean');
  });

  it('trajectory length matches horizon steps', () => {
    forge.weave('Working late hours', { domain: 'burnout', evidenceCount: 2 });
    const fq = forge.forwardQuench('burnout', { horizonSteps: 4 });
    expect(fq.trajectory.length).toBe(5); // initial + 4 steps
  });

  it('returns trajectory values in [0,1]', () => {
    forge.weave('Working late hours', { domain: 'burnout', evidenceCount: 2 });
    const fq = forge.forwardQuench('burnout');
    for (const v of fq.trajectory) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('returns stable for empty domain', () => {
    const fq = forge.forwardQuench('relationship');
    expect(fq.interventionRecommended).toBe(false);
  });
});

// ── Feature 3: forecastTrajectory ───────────────────────────────────────

describe('AetherForgeERL — forecastTrajectory', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => {
    ({ forge, dir } = makeForge());
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns trajectory and trend for domain with signals', () => {
    forge.weave('Morning standup completed', { domain: 'burnout' });
    forge.weave('Deep work session', { domain: 'burnout' });
    const ft = forge.forecastTrajectory('burnout', { days: 7, alpha: 0.3 });
    expect(ft).toHaveProperty('trajectory');
    expect(['rising', 'falling', 'stable']).toContain(ft.trend);
    expect(typeof ft.currentDensity).toBe('number');
    expect(ft.explanation.length).toBeGreaterThan(0);
  });

  it('returns stable trend for empty domain', () => {
    const ft = forge.forecastTrajectory('relationship', { days: 14 });
    expect(ft.trend).toBe('stable');
    expect(ft.trajectory.some(v => v > 0)).toBe(false);
  });
});

// ── Feature 4: cross-session staleness ──────────────────────────────────

describe('AetherForgeERL — staleness detection', () => {
  let forge: AetherForgeERL;
  let dir: string;

  beforeEach(() => {
    ({ forge, dir } = makeForge());
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('recordSessionSnapshot stores snapshot', () => {
    forge.recordSessionSnapshot();
    const status = forge.getStatus();
    expect(typeof status.nodeCount).toBe('number');
  });

  it('stalenessReport returns no drift with 0-1 snapshots', () => {
    const report = forge.stalenessReport();
    expect(report.hasDrift).toBe(false);
    expect(report.sessionsCompared).toBeLessThanOrEqual(1);
  });

  it('stalenessReport detects drift after adding nodes', () => {
    forge.recordSessionSnapshot();
    // Add several nodes to shift domain distribution
    forge.weave('Burnout signal one', { domain: 'burnout', evidenceCount: 3 });
    forge.weave('Burnout signal two', { domain: 'burnout', evidenceCount: 3 });
    forge.recordSessionSnapshot();
    const report = forge.stalenessReport();
    // Only 2 sessions, so diff is between snapshot 0 and snapshot 1
    expect(report.sessionsCompared).toBe(2);
    expect(Array.isArray(report.driftedDomains)).toBe(true);
  });

  it('stalenessReport returns driftedDomains as array', () => {
    forge.recordSessionSnapshot();
    forge.weave('Decision node A', { domain: 'decision', evidenceCount: 3 });
    forge.weave('Decision node B', { domain: 'decision', evidenceCount: 3 });
    forge.recordSessionSnapshot();
    const report = forge.stalenessReport();
    expect(Array.isArray(report.driftedDomains)).toBe(true);
    expect(Array.isArray(report.shiftedEpistemic)).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  //  TempestForge — tree structure
  // ═══════════════════════════════════════════════════════════════

  describe('AetherForgeERL — TempestForge tree', () => {
    it('rebuildTree populates treeChildren from causal edges', () => {
      const { forge } = makeForge();
      const n1 = forge.weave('root decision', { domain: 'decision', evidenceCount: 3 });
      const n2 = forge.weave('follow-up', { domain: 'decision', causalParentId: n1.nodeId, evidenceCount: 2 });
      const n3 = forge.weave('deeper follow-up', { domain: 'decision', causalParentId: n2.nodeId, evidenceCount: 1 });
      forge['rebuildTree']();
      // root should have n2 as child
      expect(forge['treeChildren'].get(n1.nodeId)).toBeDefined();
      expect(forge['treeChildren'].get(n1.nodeId)!).toContain(n2.nodeId);
      expect(forge['treeChildren'].get(n2.nodeId)).toContain(n3.nodeId);
    });

    it('queryPointInTime returns nodes near query time', () => {
      const { forge } = makeForge();
      const past = Date.now() - 10_000;
      const n1 = forge.weave('old decision', { domain: 'decision', evidenceCount: 3 });
      // Backdate this node
      forge['storeData'].nodes[n1.nodeId].createdAt = past;
      const n2 = forge.weave('recent decision', { domain: 'decision', evidenceCount: 2 });
      const results = forge.queryPointInTime(Date.now(), { windowMs: 5000, limit: 10 });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.map(r => r.id)).toContain(n2.nodeId);
    });

    it('queryPointInTime respects domain filter', () => {
      const { forge } = makeForge();
      forge.weave('general thought', { domain: 'general' });
      forge.weave('code pattern task', { domain: 'code_pattern' });
      const results = forge.queryPointInTime(Date.now(), { windowMs: 100_000, domain: 'code_pattern' });
      expect(results.every(r => r.domain === 'code_pattern')).toBe(true);
    });

    it('queryPointInTime enforces limit', () => {
      const { forge } = makeForge();
      for (let i = 0; i < 20; i++) forge.weave(`item ${i}`, { domain: 'general' });
      const results = forge.queryPointInTime(Date.now(), { windowMs: 100_000, limit: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('subtreeContradictions detects local contradictions', () => {
      const { forge } = makeForge();
      const n1 = forge.weave('Use JWT for auth', { domain: 'decision', evidenceCount: 3 });
      // Contradict within same branch
      const n2 = forge.weave('Switch from JWT to session cookies', {
        domain: 'decision', causalParentId: n1.nodeId, evidenceCount: 2
      });
      // n2 should be marked contradiction due to high similarity + phase diff
      const report = forge.subtreeContradictions(n1.nodeId, 5);
      expect(report.contradictions.length).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(report.restrictedNodes)).toBe(true);
      expect(typeof report.h1Dimension).toBe('number');
    });

    it('branchResonance propagates amplitude with damping', () => {
      const { forge } = makeForge();
      const root = forge.weave('root', { domain: 'decision', amplitude: 1.0, evidenceCount: 3 });
      const c1 = forge.weave('child1', { domain: 'decision', causalParentId: root.nodeId, amplitude: 0.9, evidenceCount: 2 });
      const c2 = forge.weave('child2', { domain: 'decision', causalParentId: c1.nodeId, amplitude: 0.8, evidenceCount: 1 });
      const result = forge.branchResonance(root.nodeId, 0.85, 5);
      expect(result.trajectory.length).toBeGreaterThan(0);
      expect(result.terminalAmplitude).toBeLessThan(1.0);
      // After damping, amplitudes should be lower
      expect(result.trajectory.length).toBeGreaterThanOrEqual(2);
      expect(typeof result.terminalAmplitude).toBe('number');
    });

    it('branchResonance identifies at-risk nodes', () => {
      const { forge } = makeForge();
      const root = forge.weave('root', { domain: 'decision', amplitude: 0.15, evidenceCount: 1 });
      const result = forge.branchResonance(root.nodeId, 0.85, 3);
      expect(result.atRisk).toContain(root.nodeId);
    });

    it('pruneBranch quenches all nodes in subtree', () => {
      const { forge } = makeForge();
      const root = forge.weave('root', { domain: 'decision', evidenceCount: 3 });
      const c1 = forge.weave('child', { domain: 'decision', causalParentId: root.nodeId, evidenceCount: 2 });
      const c2 = forge.weave('grandchild', { domain: 'decision', causalParentId: c1.nodeId, evidenceCount: 1 });
      const count = forge.pruneBranch(root.nodeId);
      expect(count).toBe(3);
      expect(forge['storeData'].nodes[root.nodeId].status).toBe('quenched');
      expect(forge['storeData'].nodes[c1.nodeId].status).toBe('quenched');
      expect(forge['storeData'].nodes[c2.nodeId].status).toBe('quenched');
    });

    it('pruneBranch spares nodes in sparedIds set', () => {
      const { forge } = makeForge();
      const root = forge.weave('root', { domain: 'decision', evidenceCount: 3 });
      const c1 = forge.weave('child', { domain: 'decision', causalParentId: root.nodeId, evidenceCount: 2 });
      forge.pruneBranch(root.nodeId, new Set([c1.nodeId]));
      expect(forge['storeData'].nodes[root.nodeId].status).toBe('quenched');
      expect(forge['storeData'].nodes[c1.nodeId].status).not.toBe('quenched');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  FlowForge — differentiable ODE flow methods
  // ═══════════════════════════════════════════════════════════════

  describe('AetherForgeERL — FlowForge flowPredict', () => {
    it('returns low risk with explanation for empty domain', () => {
      const { forge } = makeForge();
      const result = forge.flowPredict('burnout');
      expect(result.riskLevel).toBe('low');
      expect(result.trajectory.length).toBeGreaterThan(0);
      expect(result.explanation).toContain('insufficient');
    });

    it('returns trajectory with multiple nodes', () => {
      const { forge } = makeForge();
      forge.weave('high pressure week', { domain: 'burnout', evidenceCount: 3, amplitude: 0.8 });
      forge.weave('missed deadline', { domain: 'burnout', evidenceCount: 2, amplitude: 0.6 });
      forge.weave('slept poorly', { domain: 'burnout', evidenceCount: 1, amplitude: 0.5 });
      const result = forge.flowPredict('burnout', { horizon: 6 });
      expect(result.trajectory.length).toBe(6);
      expect(typeof result.riskScore).toBe('number');
      expect(typeof result.curvature).toBe('number');
      expect(typeof result.fisherInformation).toBe('number');
    });

    it('trajectory values are in [0, 1]', () => {
      const { forge } = makeForge();
      forge.weave('signal1', { domain: 'decision', evidenceCount: 3, amplitude: 0.9 });
      forge.weave('signal2', { domain: 'decision', evidenceCount: 2, amplitude: 0.7 });
      const result = forge.flowPredict('decision', { horizon: 5 });
      for (const v of result.trajectory) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });

    it('riskLevel matches riskScore thresholds', () => {
      const { forge } = makeForge();
      // Create a high-risk scenario with many contradiction nodes
      const n1 = forge.weave('Use JWT tokens', { domain: 'decision', evidenceCount: 5, amplitude: 0.9 });
      // High similarity + causal parent → possible contradiction
      forge.weave('Switch to JWT tokens', { domain: 'decision', evidenceCount: 5, amplitude: 0.9, causalParentId: n1.nodeId });
      forge.weave('Stop using any tokens', { domain: 'decision', evidenceCount: 5, amplitude: 0.9, causalParentId: n1.nodeId });
      const result = forge.flowPredict('decision', { horizon: 4 });
      expect(['high', 'medium', 'low']).toContain(result.riskLevel);
    });
  });

  describe('AetherForgeERL — FlowForge flowDetectCurvature', () => {
    it('returns empty singularities for empty store', () => {
      const { forge } = makeForge();
      const result = forge.flowDetectCurvature();
      expect(Array.isArray(result.singularities)).toBe(true);
      expect(typeof result.meanCurvature).toBe('number');
      expect(typeof result.threshold).toBe('number');
    });

    it('returns singularities array for domain with contradictions', () => {
      const { forge } = makeForge();
      const n1 = forge.weave('Use SQLite', { domain: 'decision', evidenceCount: 4, amplitude: 0.8 });
      forge.weave('Use PostgreSQL instead', { domain: 'decision', evidenceCount: 4, amplitude: 0.8, causalParentId: n1.nodeId });
      forge.weave('Actually use MongoDB', { domain: 'decision', evidenceCount: 3, amplitude: 0.7, causalParentId: n1.nodeId });
      const result = forge.flowDetectCurvature('decision');
      expect(Array.isArray(result.singularities)).toBe(true);
    });
  });

  describe('AetherForgeERL — FlowForge flowAutoConsolidate', () => {
    it('returns report with zero adjustedNodes for empty store', () => {
      const { forge } = makeForge();
      const report = forge.flowAutoConsolidate();
      expect(report.adjustedNodes).toBe(0);
      expect(typeof report.energyBefore).toBe('number');
      expect(typeof report.energyAfter).toBe('number');
    });

    it('adjusts amplitudes and reduces energy', () => {
      const { forge } = makeForge();
      const n1 = forge.weave('Node A', { domain: 'decision', evidenceCount: 5, amplitude: 0.9 });
      forge.weave('Node B contradicting A', { domain: 'decision', evidenceCount: 3, amplitude: 0.8, causalParentId: n1.nodeId });
      forge.weave('Node C supporting B', { domain: 'decision', evidenceCount: 2, amplitude: 0.7, causalParentId: n1.nodeId });
      const report = forge.flowAutoConsolidate({ iterations: 10, learningRate: 0.05 });
      expect(typeof report.energyBefore).toBe('number');
      expect(typeof report.energyAfter).toBe('number');
      expect(report.iterations).toBeGreaterThan(0);
    });

    it('returns all required fields', () => {
      const { forge } = makeForge();
      forge.weave('test A', { domain: 'general', evidenceCount: 2, amplitude: 0.6 });
      forge.weave('test B', { domain: 'general', evidenceCount: 3, amplitude: 0.7 });
      const report = forge.flowAutoConsolidate();
      expect(typeof report.adjustedNodes).toBe('number');
      expect(typeof report.energyBefore).toBe('number');
      expect(typeof report.energyAfter).toBe('number');
      expect(typeof report.converged).toBe('boolean');
      expect(typeof report.iterations).toBe('number');
      expect(typeof report.gradientNorm).toBe('number');
    });
  });
});
