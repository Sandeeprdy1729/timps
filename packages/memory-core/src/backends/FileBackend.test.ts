// ── @timps/memory-core — FileBackend tests ──
// Tests run against temp directories, never ~/.timps

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { FileBackend } from './FileBackend.js';
import { MemoryEngine } from '../MemoryEngine.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'filebackend-test-'));
}

describe('FileBackend WAL writes', () => {
  // On Windows, a descriptor left open on the .wal file blocked the next
  // rename onto the same key with EPERM, so only the first write per key
  // per process succeeded.
  it('overwrites the same key repeatedly in one process', () => {
    const backend = new FileBackend({ baseDir: tmpDir() });
    for (let i = 0; i < 5; i++) {
      backend.write('state.json', { n: i });
    }
    expect(backend.read('state.json')).toEqual({ n: 4 });
  });

  it('appends to the same key repeatedly in one process', () => {
    const backend = new FileBackend({ baseDir: tmpDir() });
    backend.append('log.jsonl', 'a');
    backend.append('log.jsonl', 'b');
    backend.append('log.jsonl', 'c');
    const dir = (backend as any).baseDir as string;
    expect(fs.readFileSync(path.join(dir, 'log.jsonl'), 'utf-8')).toBe('a\nb\nc\n');
  });

  it('leaves no .wal files behind', () => {
    const backend = new FileBackend({ baseDir: tmpDir() });
    backend.write('k.json', { v: 1 });
    backend.write('k.json', { v: 2 });
    const dir = (backend as any).baseDir as string;
    expect(fs.readdirSync(dir).filter(f => f.endsWith('.wal'))).toEqual([]);
  });
});

describe('MemoryEngine on a fresh FileBackend directory', () => {
  it('runs all migrations and stores multiple memories in one process', async () => {
    const dir = tmpDir();
    const engine = new MemoryEngine(dir, { backend: new FileBackend({ baseDir: dir }) });
    engine.store({ content: 'The billing service is written in Go and deployed on Fly', type: 'fact', tags: [] });
    engine.store({ content: 'Frontend uses Svelte with Vite for bundling and Playwright tests', type: 'fact', tags: [] });
    const all = await engine.recall('', { limit: 10 });
    expect(all.length).toBeGreaterThanOrEqual(2);
    engine.dispose?.();
  });
});
