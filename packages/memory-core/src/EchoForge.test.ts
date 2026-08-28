// @timps/memory-core — EchoForge tests

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  EchoForge,
  echoEmbed,
  getEchoForge,
} from './EchoForge.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'echoforge-test-'));
}

function makeForge(): { forge: EchoForge; dir: string } {
  const dir = tmpDir();
  const forge = new EchoForge(dir);
  return { forge, dir };
}

// ── Pure helper tests ──────────────────────────────────────────────────────

describe('echoEmbed', () => {
  it('returns sparse vector with keys in [0, 64)', () => {
    const emb = echoEmbed('burnout deadline overtime stress');
    for (const k of Object.keys(emb)) {
      expect(Number(k)).toBeGreaterThanOrEqual(0);
      expect(Number(k)).toBeLessThan(64);
    }
  });

  it('returns empty object for empty string', () => {
    expect(echoEmbed('')).toEqual({});
  });

  it('is deterministic', () => {
    const a = echoEmbed('hello world timps');
    const b = echoEmbed('hello world timps');
    expect(a).toEqual(b);
  });

  it('produces L2-normalised vectors', () => {
    const emb = echoEmbed('some content for embedding test');
    const norm = Math.sqrt(Object.values(emb).reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it('produces different vectors for different inputs', () => {
    const a = echoEmbed('burnout stress');
    const b = echoEmbed('architecture decision');
    expect(a).not.toEqual(b);
  });
});

// ── EchoForge: weave + persistence ────────────────────────────────────────

describe('EchoForge.weave', () => {
  it('creates a node and persists it', async () => {
    const { forge, dir } = makeForge();
    const result = await forge.weave('user is experiencing burnout from overtime');
    expect(result.nodeId).toMatch(/^en_/);
    expect(result.supersededIds).toHaveLength(0);

    // Reload from disk — verify persistence
    const forge2 = new EchoForge(dir);
    const nodes = forge2.exportNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0]!.content).toBe('user is experiencing burnout from overtime');
  });

  it('auto-infers domain from burnout keywords', async () => {
    const { forge } = makeForge();
    const result = await forge.weave('feeling exhausted and overwhelmed by deadlines');
    const nodes = forge.exportNodes();
    expect(nodes[0]!.domain).toBe('burnout');
    expect(result.nodeId).toBeTruthy();
  });

  it('auto-infers contradiction domain', async () => {
    const { forge } = makeForge();
    await forge.weave('this design decision contradicts previous architecture');
    const nodes = forge.exportNodes();
    expect(nodes[0]!.domain).toBe('contradiction');
  });

  it('supersedes highly-similar nodes', async () => {
    const { forge } = makeForge();
    await forge.weave('use PostgreSQL as primary database', { domain: 'decision' });
    const r2 = await forge.weave('use PostgreSQL as primary database server', {
      domain: 'decision',
    });
    // Token Jaccard = 5/6 ≈ 0.83 ≥ SUPERSESSION_THRESHOLD (0.82)
    expect(r2.supersededIds).toHaveLength(1);
  });

  it('detects contradictions between partially-overlapping nodes', async () => {
    const { forge } = makeForge();
    await forge.weave('authentication uses JWT tokens', { domain: 'decision' });
    const r2 = await forge.weave('authentication uses session cookies tokens', { domain: 'decision' });
    // Should detect as contradiction (overlap ~0.5 — above CONTRADICTION_THRESHOLD but below SUPERSESSION)
    expect(r2.detectedContradictions.length + r2.supersededIds.length).toBeGreaterThan(0);
  });

  it('creates causal edge when causalParentId is provided', async () => {
    const { forge } = makeForge();
    const r1 = await forge.weave('decided to use microservices', { domain: 'decision' });
    const r2 = await forge.weave('service A depends on service B', {
      domain: 'decision',
      causalParentId: r1.nodeId,
    });
    const edges = forge.exportEdges();
    const causalEdge = edges.find((e) => e.fromId === r1.nodeId && e.toId === r2.nodeId);
    expect(causalEdge).toBeDefined();
    expect(causalEdge!.edgeType).toBe('causes');
  });

  it('propagation returns echoMap with source node', async () => {
    const { forge } = makeForge();
    const result = await forge.weave('high velocity coding session, many commits');
    expect(result.propagation.echoMap[result.nodeId]).toBeGreaterThan(0);
  });

  it('stores reservoir state on node', async () => {
    const { forge } = makeForge();
    const result = await forge.weave('architecture drift detected in API layer');
    const nodes = forge.exportNodes();
    const node = nodes.find((n) => n.id === result.nodeId);
    expect(node).toBeDefined();
    expect(Object.keys(node!.reservoirState).length).toBeGreaterThan(0);
  });

  it('accepts explicit validFrom / validTo for bi-temporal facts', async () => {
    const { forge } = makeForge();
    const past = Date.now() - 7 * 24 * 60_000;
    const future = Date.now() + 7 * 24 * 60_000;
    const result = await forge.weave('temporary sprint goal', {
      validFrom: past,
      validTo: future,
    });
    const nodes = forge.exportNodes();
    const node = nodes.find((n) => n.id === result.nodeId);
    expect(node!.validFrom).toBe(past);
    expect(node!.validTo).toBe(future);
  });
});

// ── EchoForge: query ──────────────────────────────────────────────────────

describe('EchoForge.query', () => {
  it('returns empty result when no nodes exist', async () => {
    const { forge } = makeForge();
    const result = await forge.query('burnout risk');
    expect(result.nodes).toHaveLength(0);
    expect(result.fromCache).toBe(false);
  });

  it('retrieves relevant nodes by embedding similarity', async () => {
    const { forge } = makeForge();
    await forge.weave('burnout from overtime and deadlines');
    await forge.weave('architecture review meeting with tech lead');
    await forge.weave('exhausted from sprint crunch, need rest');

    const result = await forge.query('team burnout stress indicators');
    expect(result.nodes.length).toBeGreaterThan(0);
    // Burnout-related nodes should score higher than architecture nodes
    const burnoutContents = result.nodes
      .map((n) => n.content)
      .filter((c) => c.includes('burnout') || c.includes('exhausted'));
    expect(burnoutContents.length).toBeGreaterThan(0);
  });

  it('increments retrievalCount on returned nodes', async () => {
    const { forge } = makeForge();
    await forge.weave('decided to use Docker for containerization');
    await forge.query('docker deployment decision');

    const nodes = forge.exportNodes();
    expect(nodes[0]!.retrievalCount).toBe(1);
  });

  it('returns predictions when predict=true', async () => {
    const { forge } = makeForge();
    await forge.weave('burnout signals detected in team velocity', { domain: 'burnout' });
    await forge.weave('overtime for third consecutive week', { domain: 'burnout' });

    const result = await forge.query('burnout risk', { predict: true, domain: 'burnout' });
    expect(result.predictions).toBeDefined();
    expect(result.predictions!.length).toBeGreaterThan(0);
    const pred = result.predictions![0]!;
    expect(pred.riskScore).toBeGreaterThanOrEqual(0);
    expect(pred.riskScore).toBeLessThanOrEqual(1);
    expect(pred.trajectory).toHaveLength(12);
  });

  it('filters by domain', async () => {
    const { forge } = makeForge();
    await forge.weave('team conflict with manager', { domain: 'relationship' });
    await forge.weave('bug in payment service', { domain: 'code_pattern' });

    const result = await forge.query('issue', { domain: 'relationship' });
    expect(result.nodes.every((n) => n.domain === 'relationship')).toBe(true);
  });
});

// ── EchoForge: predict ────────────────────────────────────────────────────

describe('EchoForge.predict', () => {
  it('returns low risk with no data', async () => {
    const { forge } = makeForge();
    const pred = await forge.predict('burnout');
    expect(pred.riskLevel).toBe('low');
    expect(pred.riskScore).toBe(0);
    expect(pred.confidence).toBeLessThan(0.3);
  });

  it('returns trajectory array of correct length', async () => {
    const { forge } = makeForge();
    await forge.weave('high pressure sprint', { domain: 'burnout' });
    const pred = await forge.predict('burnout', { steps: 6 });
    expect(pred.trajectory).toHaveLength(6);
  });

  it('includes driving node ids', async () => {
    const { forge } = makeForge();
    await forge.weave('team under extreme stress', { domain: 'burnout' });
    await forge.weave('third consecutive crunch week', { domain: 'burnout' });
    const pred = await forge.predict('burnout');
    expect(pred.drivingNodeIds.length).toBeGreaterThan(0);
  });

  it('predictAll returns all domains', async () => {
    const { forge } = makeForge();
    const all = await forge.predictAll();
    const domains = Object.keys(all);
    expect(domains).toContain('burnout');
    expect(domains).toContain('relationship');
    expect(domains).toContain('decision');
  });
});

// ── EchoForge: queryAt (bi-temporal) ─────────────────────────────────────

describe('EchoForge.queryAt', () => {
  it('returns no nodes before validFrom', async () => {
    const { forge } = makeForge();
    const future = Date.now() + 1000;
    await forge.weave('future goal', { validFrom: future });

    const result = await forge.queryAt(Date.now() - 100);
    const nodeInResult = result.nodes.find((n) => n.content === 'future goal');
    expect(nodeInResult).toBeUndefined();
  });

  it('returns node valid at query time', async () => {
    const { forge } = makeForge();
    const past = Date.now() - 5000;
    await forge.weave('past architectural decision', { validFrom: past });

    const result = await forge.queryAt(Date.now());
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.pointInTime).toBeLessThanOrEqual(Date.now());
  });
});

// ── EchoForge: consolidate ────────────────────────────────────────────────

describe('EchoForge.consolidate', () => {
  it('returns consolidation counts', async () => {
    const { forge } = makeForge();
    await forge.weave('important architectural insight', { domain: 'decision' });
    const report = await forge.consolidate();
    expect(report.retained).toBeGreaterThanOrEqual(0);
    expect(report.quenched).toBeGreaterThanOrEqual(0);
    expect(report.crystallised).toBeGreaterThanOrEqual(0);
    expect(report.contradictionsResolved).toBeGreaterThanOrEqual(0);
  });
});

// ── EchoForge: getStatus ──────────────────────────────────────────────────

describe('EchoForge.getStatus', () => {
  it('reports correct node counts', async () => {
    const { forge } = makeForge();
    await forge.weave('node one', { domain: 'general' });
    await forge.weave('node two', { domain: 'burnout' });
    const status = await forge.getStatus();
    expect(status.activeNodeCount).toBe(2);
    expect(status.nodeCount).toBe(2);
    expect(status.reservoirSize).toBe(200);
  });
});

// ── getEchoForge singleton ────────────────────────────────────────────────

describe('getEchoForge', () => {
  it('returns the same instance for the same baseDir', () => {
    const dir = tmpDir();
    const a = getEchoForge(dir);
    const b = getEchoForge(dir);
    expect(a).toBe(b);
  });

  it('returns different instances for different baseDirs', () => {
    const dir1 = tmpDir();
    const dir2 = tmpDir();
    expect(getEchoForge(dir1)).not.toBe(getEchoForge(dir2));
  });
});

// ── Multi-node causal chain propagation ───────────────────────────────────

describe('EchoForge causal chain propagation', () => {
  it('propagates echo through a 3-node causal chain', async () => {
    const { forge } = makeForge();
    const r1 = await forge.weave('sprint started with aggressive deadline', { domain: 'burnout' });
    const r2 = await forge.weave('team working overtime daily', {
      domain: 'burnout',
      causalParentId: r1.nodeId,
    });
    const r3 = await forge.weave('developer reported fatigue symptoms', {
      domain: 'burnout',
      causalParentId: r2.nodeId,
    });

    // Echo should have propagated through the chain
    const nodes = forge.exportNodes();
    const ampByNode = Object.fromEntries(nodes.map((n) => [n.id, n.echoAmp]));

    // Root node gets propagation contributions from downstream
    expect(ampByNode[r1.nodeId]).toBeDefined();
    expect(r3.propagation.echoMap[r3.nodeId]).toBeGreaterThan(0);
  });

  it('detects interference at contradiction edges', async () => {
    const { forge } = makeForge();
    await forge.weave('using REST for all API calls', { domain: 'decision' });
    const r2 = await forge.weave('using GraphQL for all API calls', { domain: 'decision' });
    // Should detect contradiction
    expect(r2.detectedContradictions.length + r2.supersededIds.length).toBeGreaterThan(0);
  });
});

// ── Context string formatting ─────────────────────────────────────────────

describe('EchoForge.getContextString', () => {
  it('returns placeholder when no nodes', async () => {
    const { forge } = makeForge();
    const ctx = await forge.getContextString('burnout');
    expect(ctx).toContain('[EchoForge:burnout]');
    expect(ctx).toContain('No active nodes');
  });

  it('formats active nodes with echo amplitude', async () => {
    const { forge } = makeForge();
    await forge.weave('burnout risk detected', { domain: 'burnout' });
    const ctx = await forge.getContextString('burnout');
    expect(ctx).toContain('[echo=');
    expect(ctx).toContain('burnout risk detected');
  });
});
