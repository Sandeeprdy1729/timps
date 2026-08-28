// ── @timps/memory-core — M52: honest H¹ + semantic contradiction detection ──
// Regression tests for the audit findings in HarmonicSheafWeaver + AetherForgeERL:
//
//   1. betti1 was derived from near-zero graph-Laplacian eigenvalues, which count
//      CONNECTED COMPONENTS, not obstructions. Two unrelated-but-consistent
//      memories in one domain were therefore reported as a contradiction
//      (isConsistent=false, betti1≥1). betti1 is now the cyclomatic number
//      (E − V + C) of the 'contradicts'-edge subgraph — the count of irreducible
//      contradiction cycles.
//
//   2. Contradiction classification used pairwise phase interference derived from
//      a content hash, which carries no semantic meaning and was therefore
//      non-deterministic across similar-but-different phrasings. It is now a
//      deterministic lexical polarity/repudiation scorer.
//
// Every assertion is deterministic (zero `Math.random()`).

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryBackend } from './backends/InMemoryBackend.js';
import { HarmonicSheafWeaver, semanticContradictionScore } from './HarmonicSheafWeaver.js';
import { AetherForgeERL, semanticContradictionScore as erlScore } from './AetherForgeERL.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm48-sheaf-'));
}

const DISTINCT = [
  'crimson jaguar orbit mesa voyager',
  'azure falcon turbine dune heliograph',
  'golden otter arithmetic glacier timepiece',
];

describe('semanticContradictionScore (shared classifier)', () => {
  it('opposite polarity on a shared subject is a strong contradiction', () => {
    expect(semanticContradictionScore('Use Redis for caching', 'Never use Redis for caching')).toBe(0.92);
    expect(erlScore('Use Redis for caching', 'Never use Redis for caching')).toBe(0.92);
    expect(semanticContradictionScore('Do not use JWT', 'Use JWT for auth')).toBe(0.92);
  });

  it('repudiation (switch away) is a contradiction', () => {
    expect(semanticContradictionScore('Switch away from PostgreSQL to MongoDB', 'Use PostgreSQL for all storage')).toBe(0.75);
    expect(erlScore('Switch away from the legacy API', 'Use the legacy API')).toBe(0.75);
  });

  it('deprecate / ban / reject flip polarity strongly', () => {
    expect(erlScore('Deprecate the legacy API', 'Use the legacy API')).toBe(0.92);
    expect(semanticContradictionScore('Ban Redis caching', 'Use Redis caching')).toBe(0.92);
  });

  it('similar but compatible statements are NOT contradictions', () => {
    expect(semanticContradictionScore('Redis caching is fast', 'Redis caching is secure')).toBe(0.1);
    expect(erlScore('PostgreSQL is our database', 'PostgreSQL scales well')).toBe(0.1);
  });

  it('two negative statements are aligned scepticism, not a contradiction', () => {
    expect(semanticContradictionScore('Never use Redis caching', 'Avoid Redis caching')).toBe(0.2);
  });
});

describe('HarmonicSheafWeaver — betti1 counts irreducible contradiction cycles', () => {
  it('three unrelated consistent memories report isConsistent=true, betti1=0', () => {
    const dir = tmpDir();
    const forge = new HarmonicSheafWeaver(dir, new InMemoryBackend());
    for (const c of DISTINCT) forge.weave(c, { domain: 'general' });
    const coh = forge.detectContradictions();
    expect(coh.isConsistent).toBe(true);
    expect(coh.betti1).toBe(0);
    expect(coh.contradictionNodeIds).toHaveLength(0);
    const status = forge.getStatus();
    expect(status.betti1).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('detects a polarity-flip contradiction deterministically', () => {
    const dir = tmpDir();
    const forge = new HarmonicSheafWeaver(dir, new InMemoryBackend());
    const a = forge.weave('Use Redis for caching', { domain: 'general' });
    const b = forge.weave('Never use Redis for caching', { domain: 'general' });
    expect(b.detectedContradictions).toEqual([a.nodeId]);
    const coh = forge.detectContradictions();
    expect(coh.isConsistent).toBe(false);
    expect(coh.contradictionNodeIds).toContain(a.nodeId);
    expect(coh.betti1).toBe(0); // a single contradiction pair is a tree, not a cycle
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('compatible high-overlap statements get a correlates edge, not a contradiction', () => {
    const dir = tmpDir();
    const forge = new HarmonicSheafWeaver(dir, new InMemoryBackend());
    const a = forge.weave('Redis caching is fast', { domain: 'general' });
    const b = forge.weave('Redis caching is secure', { domain: 'general' });
    expect(b.detectedContradictions).toHaveLength(0);
    expect(b.detectedContradictions).toEqual([]);
    const edges = (forge as any).storeData.edges.filter(
      (e: { fromId: string; toId: string }) => e.fromId === b.nodeId || e.toId === b.nodeId
    );
    expect(edges.some((e: { edgeType: string }) => e.edgeType === 'contradicts')).toBe(false);
    expect(edges.some((e: { edgeType: string }) => e.edgeType === 'correlates')).toBe(true);
    expect(forge.detectContradictions().isConsistent).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports a 4-node contradiction cycle as betti1=1 (one irreducible cycle)', () => {
    // A(pos)-B(neg)-C(pos) forms a contradiction loop; D(neg) contradicts A and C
    // but shares B, so its edges do not add an independent cycle.
    // Contradiction edges: A-B, B-C, D-A, D-C → V=4, E=4, C=1 → betti1 = 1.
    const dir = tmpDir();
    const forge = new HarmonicSheafWeaver(dir, new InMemoryBackend());
    forge.weave('Use Redis caching', { domain: 'general' });      // A (pos)
    forge.weave('Never Redis caching', { domain: 'general' });     // B (neg)
    forge.weave('Adopt Redis caching', { domain: 'general' });     // C (pos)
    forge.weave('Reject Redis caching', { domain: 'general' });    // D (neg)
    const coh = forge.detectContradictions();
    expect(coh.betti1).toBe(1);
    expect(coh.isConsistent).toBe(false);
    expect(coh.contradictionNodeIds).toHaveLength(4);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('same contradiction pair is classified identically across fresh forges', () => {
    const run = () => {
      const dir = tmpDir();
      const forge = new HarmonicSheafWeaver(dir, new InMemoryBackend());
      const a = forge.weave('Use Redis for caching', { domain: 'general' });
      const b = forge.weave('Never use Redis for caching', { domain: 'general' });
      const edges = (forge as any).storeData.edges;
      fs.rmSync(dir, { recursive: true, force: true });
      return {
        contra: b.detectedContradictions.length,
        edgeType: edges.find((e: any) => e.fromId === b.nodeId && e.toId === a.nodeId)?.edgeType,
      };
    };
    const first = run();
    const second = run();
    expect(second).toEqual(first);
    expect(first.contra).toBe(1);
    expect(first.edgeType).toBe('contradicts');
  });
});

describe('AetherForgeERL — betti1 counts irreducible contradiction cycles', () => {
  it('three unrelated consistent memories report isConsistent=true, betti1=0', () => {
    const dir = tmpDir();
    const forge = new AetherForgeERL(dir, new InMemoryBackend());
    for (const c of DISTINCT) forge.weave(c, { domain: 'general' });
    const coh = forge.detectContradictions();
    expect(coh.isConsistent).toBe(true);
    expect(coh.betti1).toBe(0);
    expect(coh.contradictionNodeIds).toHaveLength(0);
    expect(forge.getStatus().betti1).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('detects a polarity-flip contradiction and upgrades epistemic status', () => {
    const dir = tmpDir();
    const forge = new AetherForgeERL(dir, new InMemoryBackend());
    const a = forge.weave('Use Redis for caching', { domain: 'general' });
    const b = forge.weave('Never use Redis for caching', { domain: 'general' });
    expect(b.detectedContradictions).toEqual([a.nodeId]);
    const coh = forge.detectContradictions();
    expect(coh.isConsistent).toBe(false);
    expect(coh.betti1).toBe(0);
    expect((forge as any).storeData.nodes[a.nodeId].status).toBe('contradiction');
    expect((forge as any).storeData.nodes[b.nodeId].status).toBe('contradiction');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('compatible high-overlap statements get a correlates edge, not a contradiction', () => {
    const dir = tmpDir();
    const forge = new AetherForgeERL(dir, new InMemoryBackend());
    const a = forge.weave('Redis caching is fast', { domain: 'general' });
    const b = forge.weave('Redis caching is secure', { domain: 'general' });
    expect(b.detectedContradictions).toHaveLength(0);
    const edges = (forge as any).storeData.edges.filter(
      (e: { fromId: string; toId: string }) => e.fromId === b.nodeId || e.toId === b.nodeId
    );
    expect(edges.some((e: { edgeType: string }) => e.edgeType === 'contradicts')).toBe(false);
    expect(forge.detectContradictions().isConsistent).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('same contradiction pair is classified identically across fresh forges', () => {
    const run = () => {
      const dir = tmpDir();
      const forge = new AetherForgeERL(dir, new InMemoryBackend());
      const a = forge.weave('Use Redis for caching', { domain: 'general' });
      const b = forge.weave('Never use Redis for caching', { domain: 'general' });
      const edges = (forge as any).storeData.edges;
      fs.rmSync(dir, { recursive: true, force: true });
      return {
        contra: b.detectedContradictions.length,
        edgeType: edges.find((e: any) => e.fromId === b.nodeId && e.toId === a.nodeId)?.edgeType,
      };
    };
    expect(run()).toEqual(run());
  });
});
