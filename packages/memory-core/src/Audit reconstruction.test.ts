// ── @timps/memory-core — Paper 2: audit-log reconstruction ──
//
// SCOPE AND HONESTY NOTE (read before citing this file in the paper):
// This test does NOT establish that a human can correctly infer why a
// memory was pruned from the EngramLog alone. That is a human-comprehension
// claim and needs a real human study — protocol drafted separately in
// paper2-audit-reconstruction-protocol.md, not run here.
//
// What this test DOES establish, mechanically: that every archive/delete
// justification string is a *complete and internally consistent* record of
// the decision — it names the actual measured values, the actual policy
// thresholds in force at sweep time, and every value it states matches the
// ground-truth MemoryMeta that produced the verdict. That's a necessary
// precondition for a human to reconstruct the decision correctly; it is not
// sufficient on its own, since e.g. a human could still misread a
// well-formed string. Treat every metric below as "log completeness /
// parseability," not "human reconstruction accuracy" — the paper should use
// those exact words, not conflate them.

import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { MemoryEngine } from './MemoryEngine.js';
import type { PrunePolicy, MemoryMeta } from './SynapticPruner.js';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `timps-audit-${label}-`));
}

/** A justification string as SynapticPruner actually emits it:
 *  "cold {ageDays}d > {coldThresholdDays}d, importance {importance} < {minImportance}, confidence {confidence} < {minConfidence}"
 *  Parse it back into the three numeric comparisons it claims to state. */
function parseJustification(justification: string): {
  ageDays: number; coldThresholdDays: number;
  importance: number; minImportance: number;
  confidence: number; minConfidence: number;
} | null {
  const m = justification.match(
    /cold ([\d.]+)d > ([\d.]+)d, importance ([\d.]+) < ([\d.]+), confidence ([\d.]+) < ([\d.]+)/
  );
  if (!m) return null;
  const [, ageDays, coldThresholdDays, importance, minImportance, confidence, minConfidence] = m;
  return {
    ageDays: Number(ageDays), coldThresholdDays: Number(coldThresholdDays),
    importance: Number(importance), minImportance: Number(minImportance),
    confidence: Number(confidence), minConfidence: Number(minConfidence),
  };
}

/** A blinded view of an audit entry: only what a real auditor reading the
 *  EngramLog would see. No access to the live MemoryMeta or PrunePolicy
 *  objects that produced it. */
interface BlindedAuditEntry {
  op: string;
  entryId: string;
  timestamp: number;
  actorId: string;
  justification: string;
}

function blind(entry: { op: string; entryId: string; timestamp: number; actorId: string; justification: string }): BlindedAuditEntry {
  return { op: entry.op, entryId: entry.entryId, timestamp: entry.timestamp, actorId: entry.actorId, justification: entry.justification };
}

describe('Audit-log reconstruction — completeness and consistency (not a human study)', () => {
  it('every archive justification correctly restates the true meta values and true policy thresholds', () => {
    const dir = tmpDir('completeness');
    const engine = new MemoryEngine(dir, { dir });

    const policy: Partial<PrunePolicy> = {
      coldThresholdDays: 30, minImportance: 0.3, minConfidence: 0.2, archiveInsteadOfDelete: true,
    };
    engine.synapticPruner.updatePolicy(policy);

    const now = Date.now();
    const metas: MemoryMeta[] = [
      { id: 'm1', lastAccess: now - 45 * 86400_000, accessCount: 1, importance: 0.10, confidence: 0.05 },
      { id: 'm2', lastAccess: now - 90 * 86400_000, accessCount: 1, importance: 0.29, confidence: 0.01 },
      { id: 'm3', lastAccess: now - 200 * 86400_000, accessCount: 1, importance: 0.02, confidence: 0.19 },
    ];
    fs.writeFileSync(path.join(dir, 'memory-meta.json'), JSON.stringify(metas));

    const result = engine.runPruneSweep();
    expect(result.archived).toBe(3);

    const rawEntries = engine.engramLog.query({ op: 'archive' });
    expect(rawEntries.length).toBe(3);

    for (const raw of rawEntries) {
      const blinded = blind(raw);
      const parsed = parseJustification(blinded.justification);
      expect(parsed).not.toBeNull();

      // The blinded entry alone must name the policy thresholds actually in
      // force at sweep time — not a default, not a stale value.
      expect(parsed!.coldThresholdDays).toBe(policy.coldThresholdDays);
      expect(parsed!.minImportance).toBe(policy.minImportance);
      expect(parsed!.minConfidence).toBe(policy.minConfidence);

      // The measured values it states must match the true source meta for
      // this entryId — this is the actual completeness check: an auditor
      // reading only the blinded string sees the real numbers, not
      // approximations or rounding that could mislead a margin judgment.
      const trueMeta = metas.find(m => m.id === blinded.entryId)!;
      const trueAgeDays = (now - trueMeta.lastAccess) / 86400_000;
      expect(parsed!.ageDays).toBeCloseTo(trueAgeDays, 1);
      expect(parsed!.importance).toBeCloseTo(trueMeta.importance, 2);
      expect(parsed!.confidence).toBeCloseTo(trueMeta.confidence, 2);

      // And the comparisons it states must actually be true — a
      // justification that claims a threshold was crossed when it wasn't
      // would be worse than useless for an auditor.
      expect(parsed!.ageDays).toBeGreaterThan(parsed!.coldThresholdDays);
      expect(parsed!.importance).toBeLessThan(parsed!.minImportance);
      expect(parsed!.confidence).toBeLessThan(parsed!.minConfidence);
    }
  });

  it('a pinned entry never appears in the archive log — the log-completeness invariant an auditor can rely on without re-deriving it', () => {
    const dir = tmpDir('pinned-invariant');
    const engine = new MemoryEngine(dir, { dir });

    const now = Date.now();
    const metas: MemoryMeta[] = [
      { id: 'pinned-1', lastAccess: now - 400 * 86400_000, accessCount: 1, importance: 0.01, confidence: 0.01, pinnedByUser: true },
    ];
    fs.writeFileSync(path.join(dir, 'memory-meta.json'), JSON.stringify(metas));

    const result = engine.runPruneSweep();
    expect(result.archived).toBe(0);
    expect(result.deleted).toBe(0);

    const rawEntries = engine.engramLog.query({ entryId: 'pinned-1' });
    expect(rawEntries.length).toBe(0);
  });

  it('margin-of-closest-threshold is recoverable from the blinded justification alone (proxy for reconstruction Q: "which condition nearly saved this entry?")', () => {
    const dir = tmpDir('margin');
    const engine = new MemoryEngine(dir, { dir });

    const now = Date.now();
    // Constructed so confidence is the tightest margin (0.19 vs 0.2 threshold).
    const meta: MemoryMeta = { id: 'margin-1', lastAccess: now - 31 * 86400_000, accessCount: 1, importance: 0.05, confidence: 0.19 };
    fs.writeFileSync(path.join(dir, 'memory-meta.json'), JSON.stringify([meta]));

    engine.runPruneSweep();
    const [raw] = engine.engramLog.query({ entryId: 'margin-1' });
    const parsed = parseJustification(raw!.justification)!;

    const margins = {
      cold: parsed.ageDays - parsed.coldThresholdDays,             // how far past the cold line (bigger = more clearly cold)
      importance: parsed.minImportance - parsed.importance,        // how far under the importance floor
      confidence: parsed.minConfidence - parsed.confidence,        // how far under the confidence floor
    };
    const tightest = Object.entries(margins).sort((a, b) => a[1] - b[1])[0]![0];
    // Ground truth: confidence margin (0.2 - 0.19 = 0.01) is by construction
    // the smallest — the condition that came closest to NOT triggering.
    expect(tightest).toBe('confidence');
  });
});