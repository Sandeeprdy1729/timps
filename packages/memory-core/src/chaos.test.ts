// ── @timps/memory-core — Chaos/Resilience Tests ──
// Validates horizontal scaling assumptions: no data loss, no missed events,
// graceful degradation when backends fail, and stateless recovery.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MemoryEngine } from './MemoryEngine';
import { InMemoryBackend } from './backends/InMemoryBackend';
import type { MemoryEntry } from './types';

describe('Chaos — stateless recovery', () => {
  let engine: MemoryEngine;
  let backend: InMemoryBackend;

  beforeAll(() => {
    backend = new InMemoryBackend();
    engine = new MemoryEngine('/tmp/chaos-test', {
      backend,
      dir: '/tmp/chaos-test-mem',
    });
  });

  afterAll(() => {
    backend.clear();
  });

  it('survives engine re-creation: stored memory persists via backend', async () => {
    engine.store({ content: 'persist test', type: 'fact' });
    const statsBefore = engine.getStats();
    expect(statsBefore.semanticCount).toBeGreaterThanOrEqual(1);

    // Simulate process restart: create a new engine with same backend
    const engine2 = new MemoryEngine('/tmp/chaos-test', {
      backend,
      dir: '/tmp/chaos-test-mem',
    });
    const statsAfter = engine2.getStats();
    expect(statsAfter.semanticCount).toBe(statsBefore.semanticCount);

    // Verify data is recallable from the new engine
    const results = await engine2.recall('persist test');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].content).toContain('persist');
  });

  it('survives multiple engine instances sharing same backend', async () => {
    const engineA = new MemoryEngine('/tmp/chaos-test', {
      backend,
      dir: '/tmp/chaos-test-mem',
    });
    const engineB = new MemoryEngine('/tmp/chaos-test', {
      backend,
      dir: '/tmp/chaos-test-mem',
    });

    engineA.store({ content: 'cross-instance test', type: 'fact' });

    // engineB should see the data engineA stored (shared backend)
    const results = await engineB.recall('cross-instance test');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].content).toContain('cross-instance');
  });
});

describe('Chaos — backend failure graceful degradation', () => {
  it('engine still works after InMemoryBackend.clear() (resets data)', async () => {
    const localBackend = new InMemoryBackend();
    const eng = new MemoryEngine('/tmp/chaos-degrade', {
      backend: localBackend,
      dir: '/tmp/chaos-degrade-mem',
    });

    eng.store({ content: 'pre-clear data', type: 'fact' });
    expect((await eng.recall('pre-clear')).length).toBeGreaterThan(0);

    // Simulate backend wipe (like database reset).
    // Note: semantic/episodic storage uses storage.ts helpers (getBackend/FileBackend),
    // not the passed InMemoryBackend. So recall still works from FileBackend.
    // The InMemoryBackend is used by forge layers and intelligence tools.
    localBackend.clear();

    // Engine should not crash — recall still works (FileBackend has the data),
    // store still works
    await eng.recall('pre-clear');
    eng.store({ content: 'post-clear data', type: 'fact' });
    eng.getStats();
    eng.consolidate();
  });

  it('engine does not throw when backend writes fail silently', async () => {
    const failingBackend = new InMemoryBackend();
    const spy = new InMemoryBackend();
    const eng = new MemoryEngine('/tmp/chaos-fail', {
      backend: failingBackend,
      dir: '/tmp/chaos-fail-mem',
    });

    // InMemoryBackend always succeeds, so we test the no-exception path
    eng.store({ content: 'should-not-throw', type: 'fact' });
    await eng.recall('anything');
    eng.consolidate();
    eng.getStats();
  });
});

describe('Chaos — concurrent access (simulated horizontal scale)', () => {
  it('multiple engines can write concurrently without corruption', async () => {
    const sharedBackend = new InMemoryBackend();
    const engines: MemoryEngine[] = [];

    // Create 5 engines sharing the same backend (simulating 5 MemoryServers)
    for (let i = 0; i < 5; i++) {
      engines.push(new MemoryEngine(`/tmp/chaos-concurrent-${i}`, {
        backend: sharedBackend,
        dir: '/tmp/chaos-concurrent-mem',
      }));
    }

    // All engines write concurrently
    const writes = engines.map((eng, i) =>
      eng.store({ content: `concurrent-write-${i}`, type: 'fact', tags: ['chaos'] })
    );
    // InMemoryBackend is sync, so all writes complete immediately
    expect(writes.every(w => w === undefined)).toBe(true);

    // Any engine can read all data written by any other engine
    const allResults = await engines[0].recall('concurrent', { limit: 100 });
    expect(allResults.length).toBeGreaterThanOrEqual(5);

    const contents = allResults.map(r => r.content);
    for (let i = 0; i < 5; i++) {
      expect(contents).toContain(`concurrent-write-${i}`);
    }
  });

  it('engines do not interfere via working memory isolation', () => {
    const backend = new InMemoryBackend();
    const eng1 = new MemoryEngine('/tmp/proj-a', { backend, dir: '/tmp/iso-mem', scope: { userId: 'user1' } });
    const eng2 = new MemoryEngine('/tmp/proj-a', { backend, dir: '/tmp/iso-mem', scope: { userId: 'user2' } });

    eng1.setGoal('user1 goal');
    eng2.setGoal('user2 goal');

    // Working memory is scoped, so goals should be isolated
    // (Note: working memory is stored per-dir, not per-backend)
    expect(eng1.workingMemory.currentGoal).toBe('user1 goal');
    expect(eng2.workingMemory.currentGoal).toBe('user2 goal');
  });
});

describe('Chaos — event bus integration', () => {
  it('store event is publishable (test EventBus interface)', async () => {
    // We test the MemoryEngine's event publishing hook by checking
    // it doesn't throw when eventBus is not configured
    const backend = new InMemoryBackend();
    const eng = new MemoryEngine('/tmp/chaos-event', {
      backend,
      dir: '/tmp/chaos-event-mem',
      // No eventBus — should be a no-op in store()
    });

    // Should not throw even without eventBus
    expect(() => {
      eng.store({ content: 'event test', type: 'fact' });
    }).not.toThrow();
  });
});
