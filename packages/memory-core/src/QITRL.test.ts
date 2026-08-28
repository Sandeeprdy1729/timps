// ── QITRL (L18) — Quantum-Inspired Temporal Resonance Lattice tests ──

import { QITRL } from './QITRL.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qitrl-test-'));
}

// ── weave ──────────────────────────────────────────────────────────────────

describe('QITRL.weave', () => {
  it('creates a site with lattice position and factors', () => {
    const q = new QITRL(tmpDir());
    const r = q.weave('testing QITRL lattice site', { domain: 'decision' });
    expect(r.siteId).toBeTruthy();
    const sites = q.exportSites();
    expect(sites.length).toBe(1);
    expect(typeof sites[0]!.latticeRow).toBe('number');
    expect(typeof sites[0]!.latticeCol).toBe('number');
    expect(sites[0]!.factors.length).toBe(8 * 16); // RANK × DIM
    expect(sites[0]!.entanglementEntropy).toBeGreaterThanOrEqual(0);
  });

  it('supersedes highly-similar sites', () => {
    const q = new QITRL(tmpDir());
    q.weave('use PostgreSQL as primary database', { domain: 'decision' });
    const r2 = q.weave('use PostgreSQL as primary database server', { domain: 'decision' });
    expect(r2.supersededIds).toHaveLength(1);
  });

  it('detects contradictions via entanglement entropy', () => {
    const q = new QITRL(tmpDir());
    q.weave('choose PostgreSQL as the main database', { domain: 'decision' });
    const r2 = q.weave('choose MongoDB as the main database instead', { domain: 'decision' });
    // At minimum, should detect something (contradiction or supersession)
    expect(r2.detectedContradictions.length + r2.supersededIds.length).toBeGreaterThan(0);
  });

  it('reports entanglement entropy and alert flag', () => {
    const q = new QITRL(tmpDir());
    const r = q.weave('test entropy computation', { domain: 'general' });
    expect(typeof r.entanglementEntropy).toBe('number');
    expect(r.entanglementEntropy).toBeGreaterThanOrEqual(0);
    expect(r.entanglementEntropy).toBeLessThanOrEqual(1);
    expect(typeof r.entropyAlert).toBe('boolean');
  });

  it('positions sites on lattice grid', () => {
    const q = new QITRL(tmpDir());
    const r1 = q.weave('alpha content', { domain: 'decision' });
    const r2 = q.weave('beta content different', { domain: 'decision' });
    const sites = q.exportSites();
    const s1 = sites.find((s) => s.id === r1.siteId)!;
    const s2 = sites.find((s) => s.id === r2.siteId)!;
    // Sites at different timestamps should have different or same rows (modulo wrapping)
    expect(typeof s1.latticeRow).toBe('number');
    expect(typeof s2.latticeRow).toBe('number');
    // Different content = likely different columns
    // We just verify both are valid positions
    expect(s1.latticeRow).toBeGreaterThanOrEqual(0);
    expect(s1.latticeCol).toBeGreaterThanOrEqual(0);
  });
});

// ── detectContradictions ──────────────────────────────────────────────────

describe('QITRL.detectContradictions', () => {
  it('returns consistent for empty store', () => {
    const q = new QITRL(tmpDir());
    const r = q.detectContradictions();
    expect(r.isConsistent).toBe(true);
    expect(r.betti1).toBe(0);
  });

  it('returns consistent for few sites', () => {
    const q = new QITRL(tmpDir());
    q.weave('node A test content', { domain: 'decision' });
    q.weave('node B test content', { domain: 'decision' });
    const r = q.detectContradictions();
    expect(r.isConsistent).toBe(true);
  });

  it('returns mean entanglement entropy', () => {
    const q = new QITRL(tmpDir());
    q.weave('site alpha', { domain: 'general' });
    q.weave('site beta', { domain: 'general' });
    const r = q.detectContradictions();
    expect(typeof r.meanEntanglementEntropy).toBe('number');
    expect(r.meanEntanglementEntropy).toBeGreaterThanOrEqual(0);
  });
});

// ── predict ───────────────────────────────────────────────────────────────

describe('QITRL.predict', () => {
  it('returns prediction for populated domain', () => {
    const q = new QITRL(tmpDir());
    q.weave('starting a new project this week', { domain: 'goal' });
    q.weave('need to focus on key deliverables', { domain: 'goal' });
    q.weave('team alignment meeting scheduled', { domain: 'goal' });
    const pred = q.predict('goal');
    expect(pred.domain).toBe('goal');
    expect(pred.trajectory.length).toBe(12);
    expect(pred.riskScore).toBeGreaterThanOrEqual(0);
    expect(pred.riskScore).toBeLessThanOrEqual(1);
  });

  it('returns low risk for empty domain', () => {
    const q = new QITRL(tmpDir());
    const pred = q.predict('burnout');
    expect(pred.riskLevel).toBe('low');
    expect(pred.riskScore).toBe(0);
  });

  it('returns singular values', () => {
    const q = new QITRL(tmpDir());
    q.weave('alpha', { domain: 'decision' });
    q.weave('beta', { domain: 'decision' });
    q.weave('gamma', { domain: 'decision' });
    const pred = q.predict('decision');
    expect(Array.isArray(pred.singularValues)).toBe(true);
    expect(pred.singularValues.length).toBeGreaterThan(0);
  });
});

// ── query ─────────────────────────────────────────────────────────────────

describe('QITRL.query', () => {
  it('returns empty when no sites exist', () => {
    const q = new QITRL(tmpDir());
    const res = q.query('anything');
    expect(res.sites).toHaveLength(0);
  });

  it('retrieves by embedding similarity', () => {
    const q = new QITRL(tmpDir());
    q.weave('PostgreSQL database schema design', { domain: 'code_pattern' });
    q.weave('React frontend component architecture', { domain: 'code_pattern' });
    const res = q.query('database schema');
    expect(res.sites.length).toBeGreaterThan(0);
    expect(res.scores[0]).toBeGreaterThan(0);
  });

  it('filters by domain', () => {
    const q = new QITRL(tmpDir());
    q.weave('database query optimization', { domain: 'code_pattern' });
    q.weave('team standup meeting notes', { domain: 'general' });
    const res = q.query('meeting', { domain: 'general' });
    expect(res.sites.length).toBe(1);
    expect(res.sites[0]!.domain).toBe('general');
  });
});

// ── consolidate ───────────────────────────────────────────────────────────

describe('QITRL.consolidate', () => {
  it('returns consolidation counts', () => {
    const q = new QITRL(tmpDir());
    q.weave('ephemeral thought', { domain: 'general' });
    q.weave('important persistent memory', { domain: 'decision' });
    const r = q.consolidate(0.5);
    expect(typeof r.truncated).toBe('number');
    expect(typeof r.retained).toBe('number');
    expect(typeof r.contradictionsResolved).toBe('number');
    expect(typeof r.meanEntropy).toBe('number');
  });
});

// ── persistence ───────────────────────────────────────────────────────────

describe('QITRL persistence', () => {
  it('survives reload from disk', () => {
    const dir = tmpDir();
    const q1 = new QITRL(dir);
    q1.weave('persistent lattice test', { domain: 'general' });
    expect(q1.exportSites().length).toBe(1);

    const q2 = new QITRL(dir);
    expect(q2.exportSites().length).toBe(1);
    expect(q2.exportSites()[0]!.content).toBe('persistent lattice test');
  });
});

// ── status ────────────────────────────────────────────────────────────────

describe('QITRL.status', () => {
  it('returns correct counts', () => {
    const q = new QITRL(tmpDir());
    expect(q.getStatus().siteCount).toBe(0);
    q.weave('test site one', { domain: 'general' });
    q.weave('test site two', { domain: 'decision' });
    const s = q.getStatus();
    expect(s.siteCount).toBe(2);
    expect(s.activeSiteCount).toBe(2);
    expect(typeof s.meanEntropy).toBe('number');
    expect(typeof s.meanRank).toBe('number');
  });
});
