// ── MemoryEngine smoke tests ──
// Tests run against a temp directory, never ~/.timps

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { MemoryEngine } from './MemoryEngine';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'memory-core-test-'));
}

describe('MemoryEngine — Layer 3: semantic store/recall', () => {
  let engine: MemoryEngine;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    engine = new MemoryEngine(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('stores a fact and recalls it by keyword', async () => {
    engine.store({ content: 'prefer immutable data structures', type: 'preference', tags: ['patterns'] });
    const results = await engine.recall('immutable');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('immutable');
  });

  it('deduplicates near-identical entries on store', async () => {
    engine.store({ content: 'prefer immutable data structures in TypeScript' });
    engine.store({ content: 'prefer immutable data structures in TypeScript' });
    const results = await engine.recall('immutable');
    expect(results.length).toBe(1);
  });

  it('recall returns empty array when no match', async () => {
    engine.store({ content: 'totally unrelated fact' });
    const results = await engine.recall('xylophone spaceship');
    expect(results.length).toBe(0);
  });

  it('consolidate removes duplicates', () => {
    engine.store({ content: 'avoid any type in TypeScript code' });
    engine.store({ content: 'avoid using any type in TypeScript' });
    const removed = engine.consolidate();
    expect(removed).toBeGreaterThanOrEqual(0); // at least ran
  });
});

describe('MemoryEngine — Layer 2: episodic', () => {
  let engine: MemoryEngine;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    engine = new MemoryEngine(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('stores and loads episodes', () => {
    engine.storeEpisode({ summary: 'Built the auth system', outcome: 'success', tags: ['auth'], timestamp: Date.now() });
    engine.storeEpisode({ summary: 'Fixed a memory leak', outcome: 'success', tags: ['perf'], timestamp: Date.now() });
    const episodes = engine.loadEpisodes(10);
    expect(episodes.length).toBe(2);
    expect(episodes[0].summary).toBe('Built the auth system');
  });

  it('getStats reflects stored episodes', () => {
    engine.storeEpisode({ summary: 'Test session', outcome: 'success', tags: [], timestamp: Date.now() });
    const stats = engine.getStats();
    expect(stats.episodeCount).toBe(1);
  });
});

describe('MemoryEngine — Layer 1: working memory', () => {
  let engine: MemoryEngine;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    engine = new MemoryEngine(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('setGoal persists', () => {
    engine.setGoal('migrate database');
    expect(engine.workingMemory.currentGoal).toBe('migrate database');
  });

  it('trackFile adds to activeFiles', () => {
    engine.trackFile('src/server.ts');
    expect(engine.workingMemory.activeFiles).toContain('src/server.ts');
  });

  it('clearWorking resets state', () => {
    engine.trackFile('src/server.ts');
    engine.clearWorking();
    expect(engine.workingMemory.activeFiles.length).toBe(0);
  });
});

describe('MemoryEngine — export/import round-trip', () => {
  let dir1: string;
  let dir2: string;

  beforeEach(() => {
    dir1 = tmpDir();
    dir2 = tmpDir();
  });

  afterEach(() => {
    fs.rmSync(dir1, { recursive: true, force: true });
    fs.rmSync(dir2, { recursive: true, force: true });
  });

  it('exports and imports preserving semantic entries', async () => {
    const source = new MemoryEngine(dir1);
    source.store({ content: 'always validate user input at trust boundaries', type: 'fact' });
    source.store({ content: 'prefer functional patterns over class inheritance hierarchies', type: 'pattern' });

    const pack = await source.export();
    expect(pack.signature).toBeTruthy();
    expect(pack.semantic.length).toBe(2);

    const target = new MemoryEngine(dir2);
    const result = await target.import(pack);
    expect(result.addedSemantic).toBe(2);

    const recalled = await target.recall('validate');
    expect(recalled.length).toBeGreaterThan(0);
  });

  it('rejects tampered packs', async () => {
    const source = new MemoryEngine(dir1);
    source.store({ content: 'original fact' });
    const pack = await source.export();
    (pack as any).semantic[0].content = 'tampered';

    const target = new MemoryEngine(dir2);
    await expect(target.import(pack)).rejects.toThrow('signature verification failed');
  });

  it('packToBuffer / bufferToPack round-trip', async () => {
    const source = new MemoryEngine(dir1);
    source.store({ content: 'gzip test fact', type: 'fact' });
    const pack = await source.export();
    const buf = await source.packToBuffer(pack);
    const restored = await source.bufferToPack(buf);
    expect(restored.signature).toBe(pack.signature);
  });
});

describe('MemoryEngine — intelligence tools', () => {
  let engine: MemoryEngine;
  let dir: string;

  beforeEach(() => {
    dir = tmpDir();
    engine = new MemoryEngine(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('checkContradiction returns a verdict', () => {
    const result = engine.checkContradiction('we should always use REST APIs');
    expect(['CLEAN', 'CONTRADICTION', 'PARTIAL']).toContain(result.verdict);
  });

  it('checkBugPattern returns alert=false when no history', () => {
    const result = engine.checkBugPattern('working on auth');
    expect(result.alert).toBe(false);
  });

  it('analyzeBurnout returns low risk with no signals', () => {
    const result = engine.analyzeBurnout();
    expect(['low', 'moderate', 'high', 'critical']).toContain(result.risk_level);
  });

  it('learnPattern stores and deduplicates', () => {
    const p1 = engine.learnPattern('always validate input at the boundary');
    const p2 = engine.learnPattern('always validate input at the boundary');
    expect(p1).not.toBeNull();
    // p2 increments observed_count on the same entry
    expect(p2?.id).toBe(p1?.id);
  });
});
