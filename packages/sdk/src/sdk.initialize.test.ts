import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const mem = vi.hoisted(() => ({
  memoryDirImpl: (p: string) => path.join('/canonical', path.basename(p) || 'root'),
  engineConstructs: [] as Array<{ projectPath: string; options: any }>,
  backends: [] as any[],
}));

vi.mock('@timps-ai/memory-core', () => {
  class MockFileBackend {
    options: any;
    constructor(options: any) {
      this.options = options;
      mem.backends.push(options);
    }
  }
  class MockMemoryEngine {
    constructor(projectPath: string, options: any) {
      mem.engineConstructs.push({ projectPath, options });
    }
  }
  return {
    MemoryEngine: MockMemoryEngine,
    FileBackend: MockFileBackend,
    memoryDir: (p: string) => mem.memoryDirImpl(p),
  };
});

describe('MemoryClient storage location', () => {
  beforeEach(() => {
    mem.engineConstructs.length = 0;
    mem.backends.length = 0;
  });

  it('defaults to the canonical memoryDir(projectPath) store', async () => {
    const { MemoryClient } = await import('./MemoryClient.js');
    const client = new MemoryClient({ projectPath: '/proj/alpha' });
    await client.initialize();

    expect(mem.backends).toHaveLength(1);
    expect(mem.backends[0]).toEqual({ baseDir: '/canonical/alpha' });
    expect(mem.engineConstructs).toHaveLength(1);
    const [construct] = mem.engineConstructs;
    expect(construct.projectPath).toBe('/proj/alpha');
    expect(construct.options.dir).toBe('/canonical/alpha');
    expect(construct.options.backend).toBeDefined();
  });

  it('honors an explicit dir option instead of the canonical store', async () => {
    const { MemoryClient } = await import('./MemoryClient.js');
    const client = new MemoryClient({ projectPath: '/proj/alpha', dir: '/custom/store' });
    await client.initialize();

    expect(mem.backends).toHaveLength(1);
    expect(mem.backends[0]).toEqual({ baseDir: '/custom/store' });
    const [construct] = mem.engineConstructs;
    expect(construct.options.dir).toBe('/custom/store');
  });

  it('defaults projectPath to "." when omitted', async () => {
    const { MemoryClient } = await import('./MemoryClient.js');
    const client = new MemoryClient({ projectPath: undefined as any });
    await client.initialize();

    const [construct] = mem.engineConstructs;
    expect(construct.projectPath).toBe('.');
  });
});

describe('legacy project-local store migration', () => {
  let projectRoot: string;
  let canonicalDir: string;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-migrate-'));
    canonicalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-canonical-'));
    mem.engineConstructs.length = 0;
    mem.backends.length = 0;
    mem.memoryDirImpl = () => canonicalDir;
  });

  it('copies legacy <project>/.timps/memory data into the canonical store', async () => {
    const legacyDir = path.join(projectRoot, '.timps', 'memory');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'semantic.json'), JSON.stringify([{ id: 'a', content: 'legacy fact' }]));
    fs.writeFileSync(path.join(legacyDir, '.init'), 'true');
    fs.writeFileSync(path.join(legacyDir, 'episodes.json.wal'), 'junk');

    const { MemoryClient } = await import('./MemoryClient.js');
    const client = new MemoryClient({ projectPath: projectRoot });
    await client.initialize();

    const migrated = JSON.parse(fs.readFileSync(path.join(canonicalDir, 'semantic.json'), 'utf-8'));
    expect(migrated).toEqual([{ id: 'a', content: 'legacy fact' }]);
    expect(fs.existsSync(path.join(canonicalDir, '.init'))).toBe(true);
    // WAL journal files are never migrated
    expect(fs.existsSync(path.join(canonicalDir, 'episodes.json.wal'))).toBe(false);
    // The canonical backend is used, not the legacy dir
    const [construct] = mem.engineConstructs;
    expect(construct.options.dir).toBe(canonicalDir);
  });

  it('does not clobber a canonical store that already has data', async () => {
    fs.writeFileSync(path.join(canonicalDir, 'semantic.json'), JSON.stringify([{ id: 'keep', content: 'existing' }]));
    const legacyDir = path.join(projectRoot, '.timps', 'memory');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'semantic.json'), JSON.stringify([{ id: 'overwrite', content: 'legacy' }]));

    const { MemoryClient } = await import('./MemoryClient.js');
    const client = new MemoryClient({ projectPath: projectRoot });
    await client.initialize();

    const canonical = JSON.parse(fs.readFileSync(path.join(canonicalDir, 'semantic.json'), 'utf-8'));
    expect(canonical).toEqual([{ id: 'keep', content: 'existing' }]);
  });

  it('is skipped when an explicit dir option is provided', async () => {
    const legacyDir = path.join(projectRoot, '.timps', 'memory');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'semantic.json'), JSON.stringify([{ id: 'a', content: 'legacy' }]));

    const { MemoryClient } = await import('./MemoryClient.js');
    const client = new MemoryClient({ projectPath: projectRoot, dir: '/custom/store' });
    await client.initialize();

    expect(fs.existsSync(path.join(canonicalDir, 'semantic.json'))).toBe(false);
    const [construct] = mem.engineConstructs;
    expect(construct.options.dir).toBe('/custom/store');
  });
});
