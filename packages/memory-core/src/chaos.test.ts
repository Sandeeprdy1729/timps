// ── @timps/memory-core — Chaos/Resilience Tests ──
// Validates horizontal scaling assumptions: no data loss, no missed events,
// graceful degradation when backends fail, and stateless recovery.
//
// M46 — this suite ACTUALLY injects failures instead of calling an
// always-succeeding backend and asserting nothing:
//   - a FailingBackend that throws on reads/writes/appends for chosen keys
//   - store() atomicity (failing side-effect ⇒ NO partial semantic commit)
//   - fail-fast reads so a dead backend can't hang recall
//   - store → engram → provenance cross-layer consistency (no orphan facts)
//   - EngramLog truncation + hash-tamper detection
//   - concurrent (shared-backend) writes keep the engram chain valid
//   - semantic cap: oldest entries discarded, newest survive

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { MemoryEngine } from './MemoryEngine';
import { InMemoryBackend } from './backends/InMemoryBackend';
import type { MemoryEntry } from './types';

/**
 * Backend that throws for a configurable set of keys. All other keys delegate
 * to an in-memory store. Lets tests target one failure mode at a time.
 */
class FailingBackend extends InMemoryBackend {
  failReads: Set<string>;
  failWrites: Set<string>;
  failAppends: Set<string>;

  constructor(opts: { reads?: string[]; writes?: string[]; appends?: string[] } = {}) {
    super();
    this.failReads = new Set(opts.reads ?? []);
    this.failWrites = new Set(opts.writes ?? []);
    this.failAppends = new Set(opts.appends ?? []);
  }

  read(key: string): any {
    if (this.failReads.has(key)) throw new Error(`backend read failed for ${key}`);
    return super.read(key);
  }

  write(key: string, value: any): void {
    if (this.failWrites.has(key)) throw new Error(`backend write failed for ${key}`);
    super.write(key, value);
  }

  append(key: string, line: string): void {
    if (this.failAppends.has(key)) throw new Error(`backend append failed for ${key}`);
    super.append(key, line);
  }
}

/**
 * Distinct content strings that avoid the short-string Jaccard dedup trap.
 * Each index gets its own vocabulary so no two stored strings share enough
 * words to trip the >0.8 Jaccard guard (which would silently drop a store).
 */
const FUZZ = [
  ['crimson', 'jaguar', 'orbit', 'mesa', 'voyager'],
  ['azure', 'falcon', 'turbine', 'dune', 'heliograph'],
  ['golden', 'otter', 'arithmetic', 'glacier', 'timepiece'],
  ['onyx', 'puma', 'torus', 'atoll', 'sextant'],
  ['ivory', 'orca', 'traction', 'plateau', 'scaffold'],
  ['cerulean', 'lynx', 'torque', 'isthmus', 'pendulum'],
  ['amber', 'badger', 'spark', 'estuary', 'carillon'],
  ['teal', 'otterdown', 'vector', 'foothill', 'basilisk'],
  ['mauve', 'heron', 'caliper', 'tundra', 'whetstone'],
  ['sable', 'mantis', 'geodesic', 'savanna', 'kelp'],
  ['topaz', 'vulture', 'helix', 'moraine', 'telescope'],
  ['rufous', 'serpent', 'static', 'atoll', 'monsoon'],
  ['indigo', 'tapir', 'buoy', 'sierra', 'marmot'],
];

function distinct(i: number, tag: string) {
  const words = FUZZ[i % FUZZ.length];
  return {
    content: `chaos ${words[0]} ${words[1]} ${words[2]} ${words[3]} ${words[4]} ${tag} marker ${i}`,
    type: 'fact',
    tags: [tag],
  };
}

/**
 * Read the engram log's entries as an array of line strings, regardless of
 * whether the backend stored it as a JSON array or a raw JSONL blob.
 */
function engramLines(backend: InMemoryBackend): string[] {
  const raw = backend.read('engram/engram.log.jsonl');
  if (Array.isArray(raw)) return raw.map(e => JSON.stringify(e));
  if (typeof raw === 'string' && raw.trim()) return raw.trim().split('\n');
  if (raw && typeof raw === 'object') return [JSON.stringify(raw)];
  return [];
}

/**
 * Write an array of line strings back to the engram log.
 */
function writeEngramLines(backend: InMemoryBackend, lines: string[]): void {
  backend.write('engram/engram.log.jsonl', lines.map(l => JSON.parse(l)));
}

describe('Chaos — stateless recovery', () => {
  let backend: InMemoryBackend;

  beforeAll(() => {
    backend = new InMemoryBackend();
  });

  afterAll(() => {
    backend.clear();
  });

  it('survives engine re-creation: stored memory persists via backend', async () => {
    const engine = new MemoryEngine('/tmp/chaos-persist', { backend, dir: '/tmp/chaos-persist-mem' });
    engine.store(distinct(1, 'persist'));
    const statsBefore = engine.getStats();
    expect(statsBefore.semanticCount).toBeGreaterThanOrEqual(1);

    // Simulate process restart: new engine, same backend
    const engine2 = new MemoryEngine('/tmp/chaos-persist', { backend, dir: '/tmp/chaos-persist-mem' });
    expect(engine2.getStats().semanticCount).toBe(statsBefore.semanticCount);

    const results = await engine2.recall('persist');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].content).toContain('persist');
  });

  it('survives multiple engine instances sharing the same backend', async () => {
    const engineA = new MemoryEngine('/tmp/chaos-cross', { backend, dir: '/tmp/chaos-cross-mem' });
    const engineB = new MemoryEngine('/tmp/chaos-cross', { backend, dir: '/tmp/chaos-cross-mem' });

    engineA.store(distinct(2, 'cross-instance'));

    const results = await engineB.recall('cross-instance');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].content).toContain('cross-instance');
  });
});

describe('Chaos — backend failure graceful degradation', () => {
  it('engine still works after InMemoryBackend.clear() (resets data)', async () => {
    const localBackend = new InMemoryBackend();
    const eng = new MemoryEngine('/tmp/chaos-degrade', { backend: localBackend, dir: '/tmp/chaos-degrade-mem' });

    eng.store(distinct(3, 'pre-clear'));
    expect((await eng.recall('pre-clear')).length).toBeGreaterThan(0);

    // Simulate backend wipe (like a database reset)
    localBackend.clear();

    await expect(eng.recall('pre-clear')).resolves.toBeDefined();
    eng.store(distinct(4, 'post-clear'));
    eng.getStats();
    eng.consolidate();
    expect(eng.getStats().semanticCount).toBeGreaterThanOrEqual(1);
  });

  it('store() is atomic: a failing engram write leaves NO partial semantic commit', () => {
    const failing = new FailingBackend({ writes: ['engram/engram.log.jsonl'] });
    const eng = new MemoryEngine('/tmp/chaos-atomic-engram', { backend: failing, dir: '/tmp/chaos-atomic-mem' });

    expect(() => eng.store(distinct(5, 'atomic'))).toThrow(/write failed/);
    // Semantic commit happens AFTER the engram append — so when the engram
    // write fails, the semantic store must stay empty (no orphan fact).
    expect(eng.getStats().semanticCount).toBe(0);
  });

  it('store() aborts cleanly when the semantic write itself fails', () => {
    const failing = new FailingBackend({ writes: ['semantic.json'] });
    const eng = new MemoryEngine('/tmp/chaos-atomic-sem', { backend: failing, dir: '/tmp/chaos-atomic-sem-mem' });

    expect(() => eng.store(distinct(6, 'atomic-sem'))).toThrow(/write failed/);
    expect(eng.getStats().semanticCount).toBe(0);
  });

  it('a read failure on the semantic store surfaces (no hang, no silent empty)', async () => {
    const failing = new FailingBackend({ reads: ['semantic.json'] });
    const eng = new MemoryEngine('/tmp/chaos-read-fail', { backend: failing, dir: '/tmp/chaos-read-mem' });

    await expect(eng.recall('anything')).rejects.toThrow(/read failed/);
  });
});

describe('Chaos — store → recall cross-enrichment (no orphan facts)', () => {
  it('stored facts come back with provenance + engram coverage, not bare content', async () => {
    const backend = new InMemoryBackend();
    const eng = new MemoryEngine('/tmp/chaos-cxt', { backend, dir: '/tmp/chaos-cxt-mem' });
    eng.store(distinct(7, 'enrich'));

    const recall = await eng.recall('enrich');
    expect(recall.length).toBeGreaterThanOrEqual(1);

    // Every semantic entry that survived recall must ALSO have a Provenance
    // record and an EngramLog 'store' entry — the whole store() pipeline
    // committed, not just the semantic store.
    const entryId = eng.getSemanticEntries()[0]?.id!;
    const prov = eng.explainProvenance(entryId);
    expect(prov).not.toBeNull();

    const engEntries = eng.engramLog.query({ entryId }, 10);
    expect(engEntries.length).toBeGreaterThanOrEqual(1);
    expect(engEntries[0].op).toBe('store');

    // Cross-layer consistency: the immutable chain is still valid.
    expect(eng.verifyEngramChain().valid).toBe(true);
  });
});

describe('Chaos — semantic cap truncates oldest, keeps newest', () => {
  it('saveSemantic keeps only the newest MAX_SEMANTIC entries (default 100000, overridable)', async () => {
    // MAX_SEMANTIC is read at module import; re-import the storage helper with
    // a tiny cap so the trimming rule is exercised cheaply.
    const prev = process.env.TIMPS_MAX_SEMANTIC;
    process.env.TIMPS_MAX_SEMANTIC = '5';
    vi.resetModules();
    const { saveSemantic, loadSemantic } = await import('./storage.js');
    const backend = new InMemoryBackend();
    const entries: MemoryEntry[] = [];
    for (let i = 0; i < 8; i++) {
      entries.push({ id: `cap-${i}`, timestamp: 1_700_000_000_000 + i, type: 'fact', content: `cap entry ${i}`, tags: [] });
    }
    saveSemantic('/tmp/chaos-cap', entries, backend);
    const loaded = loadSemantic('/tmp/chaos-cap', backend) as MemoryEntry[];
    expect(loaded).toHaveLength(5);
    expect(loaded[0].id).toBe('cap-3'); // oldest 0..2 discarded
    expect(loaded[4].id).toBe('cap-7'); // newest survive

    if (prev === undefined) delete process.env.TIMPS_MAX_SEMANTIC;
    else process.env.TIMPS_MAX_SEMANTIC = prev;
    vi.resetModules();
  });
});

describe('Chaos — EngramLog tamper resistance', () => {
  it('truncating the log tail is detected (no silent acceptance)', async () => {
    const backend = new InMemoryBackend();
    const eng = new MemoryEngine('/tmp/chaos-engram', { backend, dir: '/tmp/chaos-engram-mem' });
    eng.store(distinct(8, 'engram'));
    eng.store(distinct(9, 'engram'));
    expect(eng.verifyEngramChain().valid).toBe(true);

    // Simulate a torn write / truncation: drop the last line of the log.
    const lines = engramLines(backend).slice(0, -1);
    writeEngramLines(backend, lines);

    const verdict = eng.verifyEngramChain();
    expect(verdict.valid).toBe(false);
  });

  it('corrupting an entry payload breaks the hash chain at that index', async () => {
    const backend = new InMemoryBackend();
    const eng = new MemoryEngine('/tmp/chaos-tamper', { backend, dir: '/tmp/chaos-tamper-mem' });
    eng.store(distinct(10, 'tamper'));
    eng.store(distinct(11, 'tamper'));
    expect(eng.verifyEngramChain().valid).toBe(true);

    const lines = engramLines(backend);
    const entry = JSON.parse(lines[0]);
    entry.content = 'tampered payload';
    entry.hash = '0'.repeat(64);
    lines[0] = JSON.stringify(entry);
    writeEngramLines(backend, lines);

    const verdict = eng.verifyEngramChain();
    expect(verdict.valid).toBe(false);
    expect(verdict.brokenAt).toBe(0);
  });
});

describe('Chaos — concurrent access (simulated horizontal scale)', () => {
  it('multiple engines can write distinct content concurrently without loss or chain damage', async () => {
    const sharedBackend = new InMemoryBackend();
    const engines: MemoryEngine[] = [];

    // 5 engines sharing the same backend (simulating 5 MemoryServers)
    for (let i = 0; i < 5; i++) {
      engines.push(new MemoryEngine(`/tmp/chaos-concurrent-${i}`, {
        backend: sharedBackend,
        dir: '/tmp/chaos-concurrent-mem',
      }));
    }

    // Distinct content writes from all engines
    const writes = engines.map((eng, i) => eng.store(distinct(i, `conc-${i}`)));
    expect(writes.every(w => w === undefined)).toBe(true);

    const allResults = await engines[0].recall('conc', { limit: 100 });
    expect(allResults.length).toBeGreaterThanOrEqual(5);

    const contents = allResults.map(r => r.content);
    for (let i = 0; i < 5; i++) {
      expect(contents.some(c => c.includes(`conc-${i}`))).toBe(true);
    }

    // Interleaved writers must not corrupt the shared engram chain.
    expect(engines[0].verifyEngramChain().valid).toBe(true);
  });

  it('engines do not interfere via working memory isolation', () => {
    const backend = new InMemoryBackend();
    const eng1 = new MemoryEngine('/tmp/proj-a', { backend, dir: '/tmp/iso-mem', scope: { userId: 'user1' } });
    const eng2 = new MemoryEngine('/tmp/proj-a', { backend, dir: '/tmp/iso-mem', scope: { userId: 'user2' } });

    eng1.setGoal('user1 goal');
    eng2.setGoal('user2 goal');

    expect(eng1.workingMemory.currentGoal).toBe('user1 goal');
    expect(eng2.workingMemory.currentGoal).toBe('user2 goal');
  });
});

describe('Chaos — event bus integration', () => {
  it('store is a no-op when eventBus is not configured', async () => {
    const backend = new InMemoryBackend();
    const eng = new MemoryEngine('/tmp/chaos-event', {
      backend,
      dir: '/tmp/chaos-event-mem',
    });

    expect(() => {
      eng.store(distinct(12, 'event'));
    }).not.toThrow();
  });
});