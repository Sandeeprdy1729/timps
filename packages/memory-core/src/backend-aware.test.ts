// ── @timps/memory-core — M49: storage backends must be honored ──
// The five L1 storage layers (ConsolidationEngine, SynapticPruner,
// ProvenanceForge, AuditForge, BiasRevealer) each accept a `StorageBackend`
// but historically ignored it, doing raw `fs` reads/writes on `${dir}` paths.
// That broke every backend-aware deployment:
//   - with InMemoryBackend, runs silently returned empty results (data lives
//     in the backend map, not on disk)
//   - ProvenanceForge unconditionally wrote provenance JSON into the home dir
//     even when a backend was configured
//
// These tests prove each layer routes all reads/writes through the backend
// when one is configured, and still works via raw fs when none is (legacy).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { InMemoryBackend } from './backends/InMemoryBackend.js';
import { ConsolidationEngine, type ConsolidationRule } from './ConsolidationEngine.js';
import { SynapticPruner, type MemoryMeta } from './SynapticPruner.js';
import { ProvenanceForge } from './ProvenanceForge.js';
import { AuditForge } from './AuditForge.js';
import { BiasRevealer } from './BiasRevealer.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm49-'));
}

const matchAll: ConsolidationRule = {
  name: 'promote-all',
  match: () => true,
  transform: (e: any) => ({ content: e.summary, tags: e.tags, type: e.outcome }),
  promote: true,
};

describe('ConsolidationEngine — M49: reads episodes.json via backend', () => {
  it('promotes episodes written to a backend (no fs file exists)', () => {
    const dir = tmpDir();
    const backend = new InMemoryBackend();
    backend.write('episodes.json', [
      { summary: 'backend episode', tags: ['bg'], outcome: 'success', timestamp: Date.now() },
    ]);
    const engine = new ConsolidationEngine(dir, [matchAll], backend);
    const result = engine.run({ dryRun: false });
    expect(result.promoted).toBe(1);
    expect(backend.read('semantic.json')).toHaveLength(1);
    expect(backend.read('semantic.json')[0].content).toBe('backend episode');
    expect(fs.existsSync(path.join(dir, 'semantic.json'))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns zero when backend has no episodes', () => {
    const dir = tmpDir();
    const backend = new InMemoryBackend();
    const engine = new ConsolidationEngine(dir, [matchAll], backend);
    expect(engine.run().promoted).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('SynapticPruner — M49: sweep routes memory-meta through backend', () => {
  let dir: string;
  let backend: InMemoryBackend;

  beforeEach(() => {
    dir = tmpDir();
    backend = new InMemoryBackend();
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('keeps and archives via backend when no disk files exist', () => {
    const now = Date.now();
    const keep: MemoryMeta = { id: 'k1', lastAccess: now, accessCount: 50, importance: 0.9, confidence: 0.9 };
    const archive: MemoryMeta = { id: 'a1', lastAccess: now - 400 * 24 * 60 * 60 * 1000, accessCount: 1, importance: 0.1, confidence: 0.1 };
    backend.write('memory-meta.json', [keep, archive]);
    const pruner = new SynapticPruner(dir, undefined, backend);
    const result = pruner.sweep();
    expect(result.kept).toBe(1);
    expect(result.archived).toBe(1);
    expect((backend.read('memory-meta.json') as MemoryMeta[]).map(m => m.id)).toEqual(['k1']);
    expect((backend.read('archived-meta.json') as MemoryMeta[]).map(m => m.id)).toEqual(['a1']);
  });
});

describe('ProvenanceForge — M49: no fs leakage under backend', () => {
  let dir: string;
  let backend: InMemoryBackend;

  beforeEach(() => {
    dir = tmpDir();
    backend = new InMemoryBackend();
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('does NOT create a provenance dir on disk when a backend is configured', () => {
    new ProvenanceForge(dir, backend);
    expect(fs.existsSync(path.join(dir, 'provenance'))).toBe(false);
  });

  it('record/explain/addCustodyStep/delete/listBySource round-trip via backend', () => {
    const forge = new ProvenanceForge(dir, backend);
    const p = forge.record({
      sourceKind: 'user_direct',
      sourceDetail: 'typed',
      actorId: 'u1',
      actor: 'u1',
      observedAt: Date.now(),
      evidenceCount: 2,
      confidence: 0.9,
      parentIds: [],
    });
    expect(backend.read(`provenance/${p.id}.json`)).not.toBeNull();
    expect(fs.existsSync(path.join(dir, 'provenance'))).toBe(false);

    const loaded = forge.explain(p.id);
    expect(loaded!.sourceKind).toBe('user_direct');

    forge.addCustodyStep(p.id, 'bot', 'verify');
    expect(forge.explain(p.id)!.chainOfCustody).toHaveLength(2);

    expect(forge.listBySource('user_direct')).toHaveLength(1);
    expect(forge.delete(p.id)).toBe(true);
    expect(backend.read(`provenance/${p.id}.json`)).toBeNull();
  });
});

describe('AuditForge — M49: reads all layers via backend', () => {
  it('audits working + episodic + semantic + provenance from backend', () => {
    const dir = tmpDir();
    const backend = new InMemoryBackend();
    const old = Date.now() - 60 * 24 * 60 * 60 * 1000;
    backend.write('working.json', { currentGoal: '', activeFiles: [] });
    backend.write('episodes.json', [{ summary: 'e', timestamp: old }]);
    backend.write('semantic.json', [
      { id: 'sa1', content: 'fact', timestamp: old },
      { id: 'sa2', content: 'fact2', timestamp: Date.now() },
    ]);
    // provide provenance for sa2 (via forge) so only sa1 is unsourced
    const forge = new ProvenanceForge(dir, backend);
    forge.record({
      sourceKind: 'doc_reference',
      sourceDetail: 'doc',
      actor: 'u',
      actorId: 'u',
      observedAt: Date.now(),
      evidenceCount: 1,
      confidence: 0.8,
      parentIds: [],
    }, 'sa2');

    const audit = new AuditForge(dir, backend);
    const report = audit.run();
    expect(report.working.weak).toBeGreaterThan(0);
    expect(report.episodic.outdated).toBe(1);
    expect(report.semantic.outdated).toBe(1);
    expect(report.semantic.unsourced).toBe(1);
    expect(report.totalEntries).toBeGreaterThan(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('BiasRevealer — M49: reads semantic + provenance via backend', () => {
  it('reveal uses backend semantic + provenance (no disk files)', () => {
    const dir = tmpDir();
    const backend = new InMemoryBackend();
    const entries = [];
    for (let i = 0; i < 8; i++) {
      entries.push({ id: `s${i}`, content: 'functional programming is great', tags: ['fp'], type: 'preference', timestamp: Date.now() });
    }
    backend.write('semantic.json', entries);
    const forge = new ProvenanceForge(dir, backend);
    for (let i = 0; i < 3; i++) {
      forge.record({
        sourceKind: 'user_direct' as const,
        sourceDetail: 'd', actor: 'u', actorId: 'u',
        observedAt: Date.now(), evidenceCount: 1, confidence: 0.9, parentIds: [],
      }, `src-${i}`);
    }
    const revealer = new BiasRevealer(dir, backend);
    const report = revealer.reveal();
    expect(report.overrepresented.length).toBeGreaterThanOrEqual(1);
    expect(report.overrepresented.find(o => o.category === 'functional')).toBeDefined();
    // provenance accounts for 3 of 3 sources → user_direct dominates
    const user = report.sourceBias.find(s => s.sourceKind === 'user_direct');
    expect(user?.percentage).toBe(100);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});