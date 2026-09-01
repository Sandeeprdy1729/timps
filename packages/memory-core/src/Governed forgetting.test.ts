// ── @timps/memory-core — Paper 2 precondition: governed, auditable forgetting ──
// Two things this proves that were previously false:
//   1. ChronosForge supersession is wired into recall — a superseded entry
//      is excluded by default and recoverable only via includeSuperseded.
//   2. SynapticPruner.sweep(), driven through MemoryEngine.runPruneSweep(),
//      writes a verifiable EngramLog entry per archived/deleted memory —
//      forgetting has an audit trail, not just an effect.

import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { MemoryEngine } from './MemoryEngine.js';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `timps-gf-${label}-`));
}

describe('Governed, auditable forgetting — recall-time supersession', () => {
  it('excludes a superseded entry from recall by default, and includes it when asked', async () => {
    const dir = tmpDir('recall');
    const engine = new MemoryEngine(dir, { dir });

    // NOTE: at default confidence (0.7 incoming vs 0.8 existing node
    // importance), ConstitutionalGuard's checkConflict() — Paper 1's
    // write-time gate — rejects this pair outright before ChronosForge's
    // own weave()-time supersession ever runs: its CONTRADICTION_LOWER
    // (0.45) is far more permissive than weave()'s SUPERSESSION_THRESHOLD
    // (0.82), so it fires first. skipGuard isolates the mechanism this test
    // is actually checking (recall-time filtering) from that gate, which is
    // Paper 1's concern, not Paper 2's. Worth measuring in Paper 2's eval:
    // how often the write-time gate suppresses a legitimate supersession
    // versus a genuine bad duplicate.
    engine.store(
      { content: 'The deploy pipeline uses Jenkins for automation.', type: 'fact' },
      { skipGuard: true }
    );
    engine.store(
      { content: 'The deploy pipeline uses Jenkins for automation now.', type: 'fact' },
      { skipGuard: true }
    );

    const defaultResults = await engine.recall('deploy pipeline');
    const supersededStillVisible = defaultResults.some(r => r.chronosStatus === 'superseded');
    expect(supersededStillVisible).toBe(false);

    const auditResults = await engine.recall('deploy pipeline', { includeSuperseded: true });
    const supersededVisibleInAudit = auditResults.some(r => r.chronosStatus === 'superseded');
    expect(supersededVisibleInAudit).toBe(true);
  });
});

describe('Governed, auditable forgetting — bi-temporal supersession respects validFrom', () => {
  it('a content-similar write about an EARLIER period does not supersede a later fact, even with higher confidence', async () => {
    const dir = tmpDir('bitemporal');
    const engine = new MemoryEngine(dir, { dir });
    const now = Date.now();

    // Write the "current" fact first.
    const r1 = engine.chronosForge.weave(
      'The deploy pipeline uses Jenkins for automation.',
      { domain: 'general' as never, baseImportance: 0.7, validFrom: now }
    );
    expect(r1.supersededIds).toHaveLength(0);

    // A near-identical write arrives later (in write order) but describes an
    // EARLIER validity window (a backfilled fact) with higher confidence.
    // Content overlap alone would trigger supersession — but backdating it
    // must not let a stale-period fact erase the current one.
    const r2 = engine.chronosForge.weave(
      'The deploy pipeline uses Jenkins for automation.',
      { domain: 'general' as never, baseImportance: 0.85, validFrom: now - 60 * 86400_000 }
    );
    expect(r2.supersededIds).toHaveLength(0);
    expect(r2.detectedContradictions).toContain(r1.nodeId);
  });

  it('a content-similar write about a LATER-or-equal period does supersede, as before', async () => {
    const dir = tmpDir('bitemporal-forward');
    const engine = new MemoryEngine(dir, { dir });
    const now = Date.now();

    const r1 = engine.chronosForge.weave(
      'The deploy pipeline uses Jenkins for automation.',
      { domain: 'general' as never, baseImportance: 0.6, validFrom: now - 60 * 86400_000 }
    );
    const r2 = engine.chronosForge.weave(
      'The deploy pipeline uses Jenkins for automation.',
      { domain: 'general' as never, baseImportance: 0.85, validFrom: now }
    );
    expect(r2.supersededIds).toContain(r1.nodeId);
  });
});

describe('Governed, auditable forgetting — prune sweep audit trail', () => {
  it('writes an EngramLog archive entry with justification for each pruned memory', async () => {
    const dir = tmpDir('prune');
    const engine = new MemoryEngine(dir, { dir });

    engine.store({ content: 'Stale low-confidence note.', type: 'fact' });
    const [entry] = engine.getSemanticEntries();
    const id = entry!.id;

    // Force the entry to look cold/low-importance/low-confidence so the
    // default policy archives it on sweep.
    const metaPath = path.join(dir, 'memory-meta.json');
    const staleTs = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
    fs.writeFileSync(
      metaPath,
      JSON.stringify([
        { id, lastAccess: staleTs, accessCount: 1, importance: 0.1, confidence: 0.1 },
      ])
    );

    const result = engine.runPruneSweep();
    expect(result.archived).toBeGreaterThan(0);

    const verify = engine.engramLog.verifyChain();
    expect(verify.valid).toBe(true);

    const entries = engine.engramLog.query({ op: 'archive' });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]!.justification).toMatch(/cold .*importance .*confidence/);
  });
});