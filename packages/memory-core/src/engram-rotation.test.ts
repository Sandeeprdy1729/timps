// ── @timps/memory-core — EngramLog rotation & concurrency (M50) ──
// Regression tests for the M50 defect:
//   * O(N²) append — every store rewrote the ENTIRE log because backends'
//     append() is read-modify-write of a single key.
//   * No rotation/cap — the log key grew without bound.
//   * Stale-instance fork — when two EngramLog instances share one backend,
//     the second instance's append chain is broken forever after the first
//     writes again (in-memory lastHash/index freeze at construction).

import { describe, it, expect } from 'vitest';
import { EngramLog } from './EngramLog.js';
import { InMemoryBackend } from './backends/InMemoryBackend.js';
import type { EngramEntry } from './EngramLog.js';

const ts = () => Date.now();

function entry(id: string, extra: Partial<EngramEntry> = {}): { op: 'store'; layerId: string; entryId: string; actorId: string; timestamp: number; payload: unknown; justification: string } {
  return {
    op: 'store',
    layerId: 'L3',
    entryId: id,
    actorId: 'agent',
    timestamp: ts(),
    payload: { content: id },
    justification: id,
    ...extra,
  };
}

describe('EngramLog — M50: bounded rotation', () => {
  it('append does not grow the active segment past the cap (rotation happens)', () => {
    const backend = new InMemoryBackend();
    const log = new EngramLog('/tmp/engram-rotation', backend);
    const count = 1500;

    for (let i = 0; i < count; i++) {
      log.append(entry(`e${i}`, { timestamp: 1_700_000_000_000 + i }));
    }

    // Active segment (single key) is bounded — not O(N²) linear growth.
    const active = backend.read('engram/engram.log.jsonl') as unknown[];
    expect(Array.isArray(active)).toBe(true);
    expect(active.length).toBeLessThan(count);
    expect(active.length).toBeLessThanOrEqual(512);

    // Archive segments were written and are discoverable.
    const keys = backend.list('engram/') as string[];
    const archived = keys.filter((k) => k.includes('engram.archive.'));
    expect(archived.length).toBeGreaterThanOrEqual(2);

    // The chain must still verify end-to-end across all segments.
    expect(log.verifyChain()).toEqual({ valid: true });
  });

  it('verifyChain covers archived segments (tampering an old segment is detected)', () => {
    const backend = new InMemoryBackend();
    const log = new EngramLog('/tmp/engram-rot-tamper', backend);

    for (let i = 0; i < 600; i++) {
      log.append(entry(`t${i}`, { timestamp: 1_700_000_000_000 + i }));
    }
    expect(log.verifyChain().valid).toBe(true);

    // Corrupt the FIRST archived segment (oldest entries).
    const keys = (backend.list('engram/') as string[]).filter((k) => k.includes('engram.archive.'));
    const firstArchived = keys[0];
    const seg = backend.read(firstArchived) as any[];
    const bad = { ...seg[0], payload: { content: 'tampered' } };
    bad.hash = '0'.repeat(64);
    seg[0] = bad;
    backend.write(firstArchived, seg);

    const verdict = log.verifyChain();
    expect(verdict.valid).toBe(false);
  });

  it('query and entryCount work across a rotated log', () => {
    const backend = new InMemoryBackend();
    const log = new EngramLog('/tmp/engram-rot-query', backend);
    const total = 1100;
    for (let i = 0; i < total; i++) {
      log.append(entry(i % 2 === 0 ? `even${i}` : `odd${i}`));
    }
    expect(log.entryCount()).toBe(total);
    expect(log.query({ op: 'store' }, 5).length).toBe(5);
    expect(log.query({ entryId: 'even10' }).length).toBeGreaterThanOrEqual(1);
  });
});

describe('EngramLog — M50: shared-backend concurrency', () => {
  it('interleaved writers on one backend keep the chain valid (fresh-state derivation)', () => {
    const backend = new InMemoryBackend();
    const a = new EngramLog('/tmp/engram-rot-a', backend);
    const b = new EngramLog('/tmp/engram-rot-b', backend);

    // Interleave multiple writes through BOTH instances, not just one each.
    const seq: Array<[EngramLog, string]> = [
      [a, 'a1'], [b, 'b1'], [a, 'a2'], [b, 'b2'], [a, 'a3'], [b, 'b3'],
    ];
    for (const [log, id] of seq) log.append(entry(id));

    // The M50 regression: previously the stale instance froze its lastHash/
    // index, so a second write from the FIRST writer broke the chain.
    expect(a.verifyChain().valid, 'chain valid after interleaved writers').toBe(true);
    expect(b.verifyChain().valid).toBe(true);

    // Every write is represented exactly once.
    expect(a.entryCount()).toBe(seq.length);
  });

  it('two engines writing repeatedly keep a linear hash chain', () => {
    const backend = new InMemoryBackend();
    const a = new EngramLog('/tmp/engram-conc-a', backend);
    const b = new EngramLog('/tmp/engram-conc-b', backend);
    for (let i = 0; i < 40; i++) {
      a.append(entry(`A${i}`));
      b.append(entry(`B${i}`));
    }
    expect(a.verifyChain().valid).toBe(true);
    expect(b.verifyChain().valid).toBe(true);
    expect(a.entryCount()).toBe(80);
  });
});