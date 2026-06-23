// ── @timps/memory-core — Migration tests ──
// Tests run against temp directories with FileBackend, never ~/.timps

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { FileBackend } from '../backends/FileBackend.js';
import { InMemoryBackend } from '../backends/InMemoryBackend.js';
import { MigrationEngine } from './MigrationEngine.js';
import { CURRENT_SCHEMA_VERSION } from './types.js';
import { ALL_MIGRATIONS } from './index.js';
import { MemoryEngine } from '../MemoryEngine.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
}

// ── MigrationEngine unit tests ──

describe('MigrationEngine', () => {
  it('starts at version 0 on fresh directory', () => {
    const dir = tmpDir();
    const backend = new FileBackend({ baseDir: dir });
    const engine = new MigrationEngine(dir, backend, ALL_MIGRATIONS);
    expect(engine.currentVersion()).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs all pending migrations from version 0', () => {
    const dir = tmpDir();
    const backend = new FileBackend({ baseDir: dir });
    const engine = new MigrationEngine(dir, backend, ALL_MIGRATIONS);
    expect(engine.hasPending).toBe(true);
    engine.startup();
    expect(engine.currentVersion()).toBe(CURRENT_SCHEMA_VERSION);
    expect(engine.hasPending).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips migrations when already at latest version', () => {
    const dir = tmpDir();
    const backend = new FileBackend({ baseDir: dir });
    // Write current version
    backend.write('schema-version.json', { version: CURRENT_SCHEMA_VERSION, migratedAt: new Date().toISOString() });
    const engine = new MigrationEngine(dir, backend, ALL_MIGRATIONS);
    expect(engine.hasPending).toBe(false);
    expect(engine.currentVersion()).toBe(CURRENT_SCHEMA_VERSION);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs only pending migrations (partial upgrade)', () => {
    const dir = tmpDir();
    const backend = new FileBackend({ baseDir: dir });
    // Start at version 1
    backend.write('schema-version.json', { version: 1, migratedAt: new Date().toISOString() });
    const engine = new MigrationEngine(dir, backend, ALL_MIGRATIONS);
    expect(engine.hasPending).toBe(true);
    engine.startup();
    // Should have run v1→v2 and v2→v3
    expect(engine.currentVersion()).toBe(CURRENT_SCHEMA_VERSION);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ── v1_to_v2 migration integration tests ──

describe('v1_to_v2 migration (JSONL → JSON)', () => {
  it('converts episodes.jsonl to episodes.json', () => {
    const dir = tmpDir();
    // Create old-format episodes.jsonl
    const lines = [
      JSON.stringify({ id: 'ep1', summary: 'session 1', timestamp: 1000 }),
      JSON.stringify({ id: 'ep2', summary: 'session 2', timestamp: 2000 }),
    ];
    fs.writeFileSync(path.join(dir, 'episodes.jsonl'), lines.join('\n') + '\n', 'utf-8');

    const backend = new FileBackend({ baseDir: dir });
    const engine = new MigrationEngine(dir, backend, ALL_MIGRATIONS);
    engine.startup();

    // episodes.json should exist with array content
    expect(fs.existsSync(path.join(dir, 'episodes.json'))).toBe(true);
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'episodes.json'), 'utf-8'));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0].id).toBe('ep1');
    expect(data[1].id).toBe('ep2');

    // Old JSONL should be deleted
    expect(fs.existsSync(path.join(dir, 'episodes.jsonl'))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('handles empty episodes.jsonl gracefully', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'episodes.jsonl'), '', 'utf-8');

    const backend = new FileBackend({ baseDir: dir });
    const engine = new MigrationEngine(dir, backend, ALL_MIGRATIONS);
    engine.startup();

    expect(fs.existsSync(path.join(dir, 'episodes.json'))).toBe(true);
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'episodes.json'), 'utf-8'));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('merges with existing episodes.json', () => {
    const dir = tmpDir();
    // Existing JSON array
    fs.writeFileSync(path.join(dir, 'episodes.json'), JSON.stringify([
      { id: 'ep_old', summary: 'old session', timestamp: 500 },
    ]), 'utf-8');
    // Old JSONL
    fs.writeFileSync(path.join(dir, 'episodes.jsonl'),
      JSON.stringify({ id: 'ep_new', summary: 'new session', timestamp: 3000 }) + '\n', 'utf-8');

    const backend = new FileBackend({ baseDir: dir });
    const engine = new MigrationEngine(dir, backend, ALL_MIGRATIONS);
    engine.startup();

    const data = JSON.parse(fs.readFileSync(path.join(dir, 'episodes.json'), 'utf-8'));
    expect(data.length).toBe(2); // merged
    expect(data[0].id).toBe('ep_old');
    expect(data[1].id).toBe('ep_new');
    expect(fs.existsSync(path.join(dir, 'episodes.jsonl'))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('cleans up stale .wal files', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'stale.wal'), 'garbage', 'utf-8');

    const backend = new FileBackend({ baseDir: dir });
    const engine = new MigrationEngine(dir, backend, ALL_MIGRATIONS);
    engine.startup();

    expect(fs.existsSync(path.join(dir, 'stale.wal'))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ── v2_to_v3 migration integration tests ──

describe('v2_to_v3 migration (_meta block)', () => {
  it('adds _meta to forge state files', () => {
    const dir = tmpDir();
    const backend = new FileBackend({ baseDir: dir });

    // Pre-seed pre-migration data — version 1 files without _meta
    backend.write('schema-version.json', { version: 2, migratedAt: new Date().toISOString() });
    backend.write('echo/echoforge.json', { version: '2.0', nodes: {}, edges: [] });
    backend.write('chronos/graph.json', { nodes: [], edges: [] });
    backend.write('semantic.json', { entries: [] });

    const engine = new MigrationEngine(dir, backend, [ALL_MIGRATIONS[1]]); // only v2→v3
    engine.startup();

    // Forge files should now have _meta
    const echo = backend.read('echo/echoforge.json') as any;
    expect(echo._meta).toBeDefined();
    expect(echo._meta.schemaVersion).toBe(3);
    expect(echo._meta.layerName).toBe('echo');
    expect(echo.version).toBe('2.0'); // original data preserved

    const chronos = backend.read('chronos/graph.json') as any;
    expect(chronos._meta).toBeDefined();
    expect(chronos._meta.layerName).toBe('chronos');

    // semantic.json should NOT get _meta (it's in SKIP_KEYS)
    const semantic = backend.read('semantic.json') as any;
    expect(semantic._meta).toBeUndefined();

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not double-add _meta if already present', () => {
    const dir = tmpDir();
    const backend = new FileBackend({ baseDir: dir });

    backend.write('schema-version.json', { version: 2, migratedAt: new Date().toISOString() });
    backend.write('echo/echoforge.json', {
      _meta: { schemaVersion: 3, layerName: 'echo', createdAt: '2025-01-01', migratedAt: '2025-01-01' },
      version: '2.0',
      nodes: {},
    });

    const engine = new MigrationEngine(dir, backend, [ALL_MIGRATIONS[1]]);
    engine.startup();

    const echo = backend.read('echo/echoforge.json') as any;
    expect(echo._meta.migratedAt).toBe('2025-01-01'); // unchanged
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ── MemoryEngine integration: migration runs on construction ──

describe('MemoryEngine runs migrations on construction', () => {
  it('migrates old-format episodes.jsonl on MemoryEngine creation', () => {
    const dir = tmpDir();

    // Create old-format data BEFORE MemoryEngine
    fs.writeFileSync(path.join(dir, 'episodes.jsonl'),
      JSON.stringify({ id: 'ep1', summary: 'legacy session', timestamp: Date.now() }) + '\n', 'utf-8');

    // This should trigger v1→v2 migration
    const engine = new MemoryEngine('/tmp/testbot-migration', { dir, backend: new FileBackend({ baseDir: dir }) });

    // episodes should now be readable via the backend
    const stats = engine.getStats();
    expect(stats.episodeCount).toBe(1);

    // Old JSONL should be gone
    expect(fs.existsSync(path.join(dir, 'episodes.jsonl'))).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not re-migrate if already at latest version', () => {
    const dir = tmpDir();
    const backend = new FileBackend({ baseDir: dir });

    // Seed at version 3 with some data
    backend.write('schema-version.json', { version: CURRENT_SCHEMA_VERSION, migratedAt: new Date().toISOString() });
    backend.write('episodes.json', [{ id: 'ep1', summary: 'session', timestamp: Date.now() }]);

    const engine = new MemoryEngine('/tmp/testbot-migration', { dir });

    const stats = engine.getStats();
    expect(stats.episodeCount).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
