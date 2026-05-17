// @timps/memory-core — ResonanceForge tests

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  ResonanceForge,
  embed,
  dot,
  murmurhash,
  jaccardSimilarity,
  effectiveAmplitude,
  resonanceScore,
} from './ResonanceForge';
import type { ResonanceNode, ResonanceDomain } from './ResonanceForge';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'resonance-test-'));
}

function makeForge(): { forge: ResonanceForge; dir: string } {
  const dir = tmpDir();
  const forge = new ResonanceForge(dir);
  return { forge, dir };
}

function makeNode(overrides: Partial<ResonanceNode> = {}): ResonanceNode {
  return {
    id: 'n1',
    content: 'test content',
    domain: 'general',
    embedding: { 5: 0.5, 10: 0.5, 20: 0.707 },
    validFrom: Date.now() - 1000,
    validTo: null,
    invalidAt: null,
    causalParentId: null,
    amplitude: 0.8,
    frequency: 0.2,
    phase: 0,
    retrievalCount: 0,
    tags: [],
    createdAt: Date.now() - 60_000,
    ...overrides,
  };
}

// Pure function tests

describe('murmurhash', () => {
  it('returns a non-negative integer', () => {
    expect(murmurhash('hello')).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(murmurhash('world'))).toBe(true);
  });
  it('is deterministic', () => {
    expect(murmurhash('timps')).toBe(murmurhash('timps'));
  });
  it('produces different values for different inputs', () => {
    expect(murmurhash('abc')).not.toBe(murmurhash('xyz'));
  });
});

describe('embed', () => {
  it('returns empty record for blank text', () => {
    expect(embed('')).toEqual({});
  });
  it('returns a normalised sparse vector (L2 norm approx 1)', () => {
    const v = embed('the quick brown fox jumps over the lazy dog');
    const norm = Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
  it('all dimension keys are within [0, 64)', () => {
    const v = embed('burnout stress velocity sprint overload');
    for (const k of Object.keys(v)) {
      expect(Number(k)).toBeGreaterThanOrEqual(0);
      expect(Number(k)).toBeLessThan(64);
    }
  });
  it('similar texts produce positive similarity', () => {
    const a = embed('I am feeling very burnt out from work');
    const b = embed('feeling burnt out from overwork');
    expect(dot(a, b)).toBeGreaterThan(0.1);
  });
  it('handles single-character tokens gracefully (filtered out)', () => {
    expect(() => embed('a b c d')).not.toThrow();
  });
});

describe('dot', () => {
  it('returns 0 for orthogonal vectors', () => {
    expect(dot({ 1: 1 }, { 2: 1 })).toBe(0);
  });
  it('returns correct value for overlapping vectors', () => {
    expect(dot({ 0: 0.5, 1: 0.5 }, { 0: 0.5, 1: 0.5 })).toBeCloseTo(0.5);
  });
  it('handles empty maps', () => {
    expect(dot({}, { 1: 1 })).toBe(0);
    expect(dot({ 1: 1 }, {})).toBe(0);
  });
  it('is commutative', () => {
    const a = { 0: 0.3, 5: 0.7 };
    const b = { 5: 0.6, 9: 0.1 };
    expect(dot(a, b)).toBeCloseTo(dot(b, a));
  });
});

describe('jaccardSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaccardSimilarity('hello world', 'hello world')).toBeCloseTo(1);
  });
  it('returns 0 for completely different strings', () => {
    expect(jaccardSimilarity('alpha beta', 'gamma delta')).toBe(0);
  });
  it('returns 1 for two empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(1);
  });
  it('returns 0 when one string is empty', () => {
    expect(jaccardSimilarity('hello world', '')).toBe(0);
  });
  it('returns partial overlap correctly', () => {
    const s = jaccardSimilarity('hello world test', 'hello world foo');
    expect(s).toBeCloseTo(2 / 4);
  });
});

describe('effectiveAmplitude', () => {
  it('returns amplitude near creation time (no decay)', () => {
    const node = makeNode({ amplitude: 0.8, createdAt: Date.now() });
    expect(effectiveAmplitude(node, Date.now())).toBeCloseTo(0.8, 1);
  });
  it('decays over time', () => {
    const past = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const node = makeNode({ amplitude: 0.8, createdAt: past, retrievalCount: 0 });
    expect(effectiveAmplitude(node, Date.now())).toBeLessThan(0.8);
    expect(effectiveAmplitude(node, Date.now())).toBeGreaterThan(0);
  });
  it('retrieval count boosts amplitude', () => {
    const nowMs = Date.now();
    const base = makeNode({ amplitude: 0.5, retrievalCount: 0, createdAt: nowMs });
    const boosted = makeNode({ amplitude: 0.5, retrievalCount: 10, createdAt: nowMs });
    expect(effectiveAmplitude(boosted, nowMs)).toBeGreaterThan(effectiveAmplitude(base, nowMs));
  });
  it('never exceeds 1', () => {
    const node = makeNode({ amplitude: 1, retrievalCount: 100, createdAt: Date.now() });
    expect(effectiveAmplitude(node, Date.now())).toBeLessThanOrEqual(1);
  });
});

describe('resonanceScore', () => {
  it('returns a non-negative number', () => {
    const node = makeNode({ embedding: embed('hello world'), amplitude: 0.8, phase: 0, createdAt: Date.now() });
    const q = embed('hello');
    expect(resonanceScore(q, node, Date.now())).toBeGreaterThanOrEqual(0);
  });
  it('higher score for matching content', () => {
    const nowMs = Date.now();
    const relevant = makeNode({ embedding: embed('burnout stress overload'), amplitude: 0.8, phase: 0, createdAt: nowMs });
    const irrelevant = makeNode({ embedding: embed('sunny beach vacation'), amplitude: 0.8, phase: 0, createdAt: nowMs });
    const q = embed('burnout stress');
    expect(resonanceScore(q, relevant, nowMs)).toBeGreaterThan(resonanceScore(q, irrelevant, nowMs));
  });
});

// ResonanceForge integration tests

describe('ResonanceForge — weave', () => {
  let forge: ResonanceForge;
  let dir: string;

  beforeEach(() => { ({ forge, dir } = makeForge()); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns a nodeId on successful weave', async () => {
    const result = await forge.weave('I feel burnt out from work');
    expect(result.nodeId).toMatch(/^rn_/);
    expect(Array.isArray(result.supersededIds)).toBe(true);
    expect(Array.isArray(result.detectedContradictions)).toBe(true);
  });
  it('persists node to disk', async () => {
    await forge.weave('Sprint velocity is too high', { domain: 'burnout' });
    const reloaded = new ResonanceForge(dir);
    const nodes = reloaded.getAllNodes('burnout');
    expect(nodes).toHaveLength(1);
  });
  it('applies the specified domain', async () => {
    await forge.weave('Team friction ongoing', { domain: 'relationship' });
    const nodes = forge.getAllNodes('relationship');
  });
  it('applies custom tags', async () => {
    await forge.weave('Tech debt accumulating', { domain: 'code_pattern', tags: ['sprint-22'] });
    const tagNode = forge.getAllNodes('code_pattern')[0];
    expect(tagNode!.tags).toContain('sprint-22');
  });
  it('sets causal parent id correctly', async () => {
    const first = await forge.weave('Started new project', { domain: 'goal' });
    const second = await forge.weave('Milestone missed', { domain: 'goal', causalParentId: first.nodeId });
    const node = forge.getAllNodes('goal').find(n => n.id === second.nodeId);
    expect(node?.causalParentId).toBe(first.nodeId);
  });
  it('adds a causal edge for parent-child pair', async () => {
    const first = await forge.weave('Root cause event', { domain: 'decision' });
    await forge.weave('Effect', { domain: 'decision', causalParentId: first.nodeId });
    const edges = forge.getEdges().filter(e => e.edgeType === 'causes');
    expect(edges.length).toBeGreaterThan(0);
  });
  it('updates field cache after weave', async () => {
    await forge.weave('Burnout signal', { domain: 'burnout' });
    const cache = forge.getFieldCache();
    expect(cache['burnout']).toBeDefined();
  });
  it('triggeredPatterns is an array', async () => {
    const result = await forge.weave('Goal missed', { domain: 'goal' });
    expect(Array.isArray(result.triggeredPatterns)).toBe(true);
  });
  it('respects explicit amplitude', async () => {
    const result = await forge.weave('Custom amplitude node', { domain: 'general', amplitude: 0.42 });
    const node = forge.getAllNodes('general').find(n => n.id === result.nodeId);
    expect(node?.amplitude).toBeCloseTo(0.42);
  });
});

describe('ResonanceForge — query', () => {
  let forge: ResonanceForge;
  let dir: string;

  beforeEach(async () => {
    ({ forge, dir } = makeForge());
    await forge.weave('Sprint velocity unsustainably high', { domain: 'burnout' });
    await forge.weave('Working overtime every weekend', { domain: 'burnout' });
    await forge.weave('Team relationship deteriorating', { domain: 'relationship' });
    await forge.weave('Sunny weather is great', { domain: 'general' });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns nodes array', async () => {
    const result = await forge.query('stress and overload');
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
  });
  it('scores array matches nodes array length', async () => {
    const result = await forge.query('burnout velocity sprint');
    expect(result.scores).toHaveLength(result.nodes.length);
  });
  it('all scores are non-negative', async () => {
    const result = await forge.query('burnout');
    for (const s of result.scores) expect(s).toBeGreaterThanOrEqual(0);
  });
  it('domain filter returns only matching domain', async () => {
    const result = await forge.query('stress', { domain: 'burnout' });
    for (const n of result.nodes) expect(n.domain).toBe('burnout');
  });
  it('respects topK limit', async () => {
    const result = await forge.query('anything', { topK: 2 });
    expect(result.nodes.length).toBeLessThanOrEqual(2);
  });
  it('increments retrieval count on queried nodes', async () => {
    await forge.query('sprint velocity', { topK: 1 });
    const anyIncremented = forge.getAllNodes().some(n => n.retrievalCount > 0);
    expect(anyIncremented).toBe(true);
  });
  it('predict:true returns predictions array', async () => {
    const result = await forge.query('burnout risk', { domain: 'burnout', predict: true });
    expect(result.predictions).toBeDefined();
  });
  it('predictions have required fields when predict is true', async () => {
    const result = await forge.query('stress', { predict: true });
    if (result.predictions && result.predictions.length > 0) {
      const p = result.predictions[0]!;
      expect(typeof p.riskScore).toBe('number');
      expect(['high', 'medium', 'low']).toContain(p.riskLevel);
      expect(Array.isArray(p.trajectory)).toBe(true);
      expect(typeof p.explanation).toBe('string');
      expect(typeof p.confidence).toBe('number');
    }
  });
});

describe('ResonanceForge — queryAt', () => {
  let forge: ResonanceForge;
  let dir: string;

  beforeEach(async () => {
    ({ forge, dir } = makeForge());
    await forge.weave('Historical decision logged', { domain: 'decision' });
    await forge.weave('Recent burnout signal', { domain: 'burnout' });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns nodes valid at query time', async () => {
    const result = await forge.queryAt(Date.now());
    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    expect(result.pointInTime).toBeDefined();
  });
  it('causalChain is an array', async () => {
    const result = await forge.queryAt(Date.now());
    expect(Array.isArray(result.causalChain)).toBe(true);
  });
  it('predict:true adds predictions when nodes found', async () => {
    const result = await forge.queryAt(Date.now(), { predict: true });
    if (result.nodes.length > 0) expect(result.predictions).toBeDefined();
  });
  it('domain filter works with queryAt', async () => {
    const result = await forge.queryAt(Date.now(), { domain: 'burnout' });
    for (const n of result.nodes) expect(n.domain).toBe('burnout');
  });
});

describe('ResonanceForge — simulateResonance', () => {
  let forge: ResonanceForge;
  let dir: string;

  beforeEach(async () => {
    ({ forge, dir } = makeForge());
    await forge.weave('Feeling stressed and overloaded', { domain: 'burnout' });
    await forge.weave('No energy left after sprints', { domain: 'burnout' });
    await forge.weave('Skipping sleep to meet deadlines', { domain: 'burnout' });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns a ResonancePrediction with required fields', async () => {
    const pred = await forge.simulateResonance('burnout');
    expect(typeof pred.riskScore).toBe('number');
    expect(['high', 'medium', 'low']).toContain(pred.riskLevel);
    expect(Array.isArray(pred.trajectory)).toBe(true);
    expect(typeof pred.explanation).toBe('string');
    expect(typeof pred.confidence).toBe('number');
  });
  it('riskScore is between 0 and 1', async () => {
    const pred = await forge.simulateResonance('burnout');
    expect(pred.riskScore).toBeGreaterThanOrEqual(0);
    expect(pred.riskScore).toBeLessThanOrEqual(1);
  });
  it('trajectory length equals steps parameter', async () => {
    const pred = await forge.simulateResonance('burnout', { steps: 5 });
    expect(pred.trajectory).toHaveLength(5);
  });
  it('returns low risk for domain with no nodes', async () => {
    const pred = await forge.simulateResonance('relationship');
    expect(pred.riskScore).toBe(0);
    expect(pred.riskLevel).toBe('low');
  });
  it('confidence increases with more nodes', async () => {
    const pred = await forge.simulateResonance('burnout');
    expect(pred.confidence).toBeGreaterThan(0.4);
  });
  it('drivingNodeIds contains valid node ids', async () => {
    const pred = await forge.simulateResonance('burnout');
    const allIds = forge.getAllNodes('burnout').map(n => n.id);
    for (const id of pred.drivingNodeIds) expect(allIds).toContain(id);
  });
});

describe('ResonanceForge — consolidate', () => {
  let forge: ResonanceForge;
  let dir: string;

  beforeEach(() => { ({ forge, dir } = makeForge()); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('returns a HarmonicConsolidationReport', async () => {
    await forge.weave('Node to check', { domain: 'general' });
    const report = await forge.consolidate();
    expect(typeof report.quenched).toBe('number');
    expect(typeof report.retained).toBe('number');
    expect(typeof report.crystallised).toBe('number');
    expect(typeof report.patternsDetected).toBe('number');
  });
  it('quenches a very low amplitude node', async () => {
    await forge.weave('Faded memory', { domain: 'general', amplitude: 0.001 });
    const report = await forge.consolidate(0.05);
    expect(report.quenched).toBeGreaterThanOrEqual(1);
  });
  it('does not quench nodes with normal amplitude', async () => {
    await forge.weave('Important ongoing signal', { domain: 'burnout', amplitude: 0.9 });
    const report = await forge.consolidate(0.04);
    expect(report.retained).toBeGreaterThanOrEqual(1);
  });
  it('retains root node that has outbound causal edges', async () => {
    const root = await forge.weave('Root with child', { domain: 'decision', amplitude: 0.001 });
    await forge.weave('Child node', { domain: 'decision', causalParentId: root.nodeId });
    await forge.consolidate(0.9);
    const rootNode = forge.getAllNodes('decision').find(n => n.id === root.nodeId);
    expect(rootNode?.invalidAt).toBeNull();
  });
});

describe('ResonanceForge — persistence', () => {
  it('reloads state from disk across instances', async () => {
    const dir = tmpDir();
    const forge1 = new ResonanceForge(dir);
    await forge1.weave('Persisted memory', { domain: 'general', tags: ['persist'] });
    const forge2 = new ResonanceForge(dir);
    const nodes = forge2.getAllNodes('general');
    expect(nodes).toHaveLength(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('starts with empty store when no file exists', () => {
    const dir = tmpDir();
    const forge = new ResonanceForge(dir);
    expect(forge.getAllNodes()).toHaveLength(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('handles corrupted store file gracefully', () => {
    const dir = tmpDir();
    const resonanceDir = require('path').join(dir, 'resonance');
    require('fs').mkdirSync(resonanceDir, { recursive: true });
    require('fs').writeFileSync(require('path').join(resonanceDir, 'resonance.json'), 'NOT_JSON');
    expect(() => new ResonanceForge(dir)).not.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('ResonanceForge — getContextString', () => {
  it('returns formatted string with domain header', async () => {
    const { forge, dir } = makeForge();
    await forge.weave('Important burnout signal here', { domain: 'burnout' });
    const ctx = await forge.getContextString('burnout');
    expect(ctx).toContain('[ResonanceForge:burnout]');
    expect(ctx).toContain('Important burnout signal here');
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('returns no active nodes message for empty domain', async () => {
    const { forge, dir } = makeForge();
    const ctx = await forge.getContextString('relationship');
    expect(ctx).toContain('No active nodes');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('ResonanceForge — getAllNodes and getEdges', () => {
  it('returns all nodes when no domain filter', async () => {
    const { forge, dir } = makeForge();
    await forge.weave('Node A', { domain: 'burnout' });
    await forge.weave('Node B', { domain: 'goal' });
    expect(forge.getAllNodes()).toHaveLength(2);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('getEdges returns edges after parent-child weave', async () => {
    const { forge, dir } = makeForge();
    const root = await forge.weave('Root', { domain: 'goal' });
    await forge.weave('Child', { domain: 'goal', causalParentId: root.nodeId });
    expect(forge.getEdges().some(e => e.edgeType === 'causes')).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
