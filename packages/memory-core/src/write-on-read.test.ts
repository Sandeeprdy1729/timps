// ── @timps/memory-core — M47: reads must never write (write-on-read) ──
// Regression tests for the earlier bug where every query()/queryAt() bumped
// retrieval counts and rewrote the ENTIRE forge store to disk:
//   - each read triggered a full-store rewrite (O(N) write per query)
//   - two engines sharing one StorageBackend: engine A invalidates a node,
//     engine B's query then rewrites the store from B's stale in-memory copy,
//     silently resurrecting the invalidated node (the M47 resurrection bug).
//
// After the fix, query paths mutate retrievalCount/amplitude in-memory only;
// the NEXT real write (weave/verify/contradict/archive) flushes them.

import { describe, it, expect } from 'vitest';
import { InMemoryBackend } from './backends/InMemoryBackend.js';
import { EchoForge } from './EchoForge.js';
import { ChronosForge } from './ChronosForge.js';
import { HarmonicSheafWeaver } from './HarmonicSheafWeaver.js';
import { AetherForgeERL } from './AetherForgeERL.js';

/**
 * Backend that counts writes per key. Lets tests assert a query issued zero
 * disk writes.
 */
class WriteCountBackend extends InMemoryBackend {
  writeCounts = new Map<string, number>();
  write(key: string, value: unknown): void {
    this.writeCounts.set(key, (this.writeCounts.get(key) ?? 0) + 1);
    super.write(key, value);
  }
}

function writesFor(backend: WriteCountBackend, key: string): number {
  return backend.writeCounts.get(key) ?? 0;
}

const DISTINCT = [
  'crimson jaguar orbit mesa voyager',
  'azure falcon turbine dune heliograph',
  'golden otter arithmetic glacier timepiece',
  'saffron kestrel pendulum boulder hessian',
];

describe('Forge query — read paths never write', () => {
  it('EchoForge.query does not rewrite the store', async () => {
    const backend = new WriteCountBackend();
    const forge = new EchoForge('queryao', backend);
    await forge.weave(DISTINCT[0]);
    const before = writesFor(backend, 'echo/echoforge.json');
    await forge.query('docker');
    await forge.query('docker');
    await forge.query('docker');
    expect(writesFor(backend, 'echo/echoforge.json')).toBe(before);
  });

  it('HarmonicSheafWeaver.query does not rewrite the store', async () => {
    const backend = new WriteCountBackend();
    const forge = new HarmonicSheafWeaver('qao_hsw', backend);
    forge.weave(DISTINCT[1], { domain: 'general' });
    const before = writesFor(backend, 'harmonic/sheaf.json');
    forge.query('elastic');
    forge.query('elastic');
    expect(writesFor(backend, 'harmonic/sheaf.json')).toBe(before);
  });

  it('AetherForgeERL.query does not rewrite the store', async () => {
    const backend = new WriteCountBackend();
    const forge = new AetherForgeERL('qao_aet', backend);
    forge.meet(DISTINCT[2], { domain: 'general' });
    const before = writesFor(backend, 'aether/aether.json');
    forge.query('vortex');
    forge.query('vortex');
    expect(writesFor(backend, 'aether/aether.json')).toBe(before);
  });

  it('ChronosForge.queryAt does not rewrite the store', async () => {
    const backend = new WriteCountBackend();
    const forge = new ChronosForge('qao_chrono', backend);
    forge.weave(DISTINCT[3], {});
    const before = writesFor(backend, 'chronos/nodes.json');
    forge.queryNow({});
    forge.queryNow({});
    expect(writesFor(backend, 'chronos/nodes.json')).toBe(before);
  });
});

describe('Forge query — no resurrection of invalidated nodes (M47)', () => {
  it('a query by a stale-second EchoForge engine does not resurrect an archived node', async () => {
    const backend = new InMemoryBackend();

    // Engine B loads the store first — its in-memory copy is "pre-archive".
    const forgeB = new EchoForge('qao_res', backend);
    const bBefore = await forgeB.weave(DISTINCT[0]);

    // Engine A loads a (now) stale copy too, then archives the node. Its own
    // in-memory store is a snapshot taken before the archive? No — A must
    // reflect the fresh state, so re-use the archive through a fresh handle
    // that shares the same backend and sees the latest persisted state.
    const forgeA = new EchoForge('qao_res', backend);
    await forgeA.archive(bBefore.nodeId, 'superseded');
    const archivedInvalidAt = backend.read('echo/echoforge.json')?.nodes?.[bBefore.nodeId]?.invalidAt;
    expect(archivedInvalidAt).not.toBeNull();

    // B (whose in-memory store still has the node valid) now queries. The M47
    // defeat: this read used to call _save() and rewrite B's stale copy — the
    // node's invalidAt got clobbered back to null (resurrection). After the
    // fix, query does not write, so the disk still shows the archive.
    await forgeB.query('crimson');

    const afterInvalid = backend.read('echo/echoforge.json')?.nodes?.[bBefore.nodeId]?.invalidAt;
    expect(afterInvalid).not.toBeNull();
  });
});