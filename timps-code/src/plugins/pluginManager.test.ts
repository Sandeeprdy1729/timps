import { PluginManager } from './pluginManager';
import type { Plugin } from '@timps/plugin-sdk';

function makeMockMemory() {
  const semanticEntries: any[] = [];
  const episodes: any[] = [];

  return {
    loadSemanticEntries: vi.fn(() => [...semanticEntries]),
    importMemory: vi.fn(),
    loadEpisodes: vi.fn(() => [...episodes]),
    storeEpisode: vi.fn(),
  } as any;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEchoPlugin(): Plugin {
  return {
    manifest: {
      name: '@timps/plugin-echo',
      version: '0.1.0',
      description: 'Echo command',
      commands: [{ name: 'echo', description: 'echo args', usage: '/echo <msg>' }],
    },
    commands: {
      async echo(args: string[]) { return args.join(' '); },
    },
  };
}

function makeToolPlugin(): Plugin {
  return {
    manifest: {
      name: '@timps/plugin-tools',
      version: '0.1.0',
      description: 'Plugin with tools',
      tools: [
        { name: 'greet', description: 'Return a greeting', parameters: { properties: { name: { type: 'string', description: 'Name to greet' } }, required: ['name'] } },
      ],
    },
    tools: {
      async greet(params: Record<string, unknown>) {
        return { output: `Hello, ${String(params.name)}!` };
      },
    },
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PluginManager', () => {
  let pm: PluginManager;
  let memory: ReturnType<typeof makeMockMemory>;

  beforeEach(() => {
    memory = makeMockMemory();
    pm = new PluginManager(memory, '/proj', vi.fn());
  });

  // ── registerDirect / listPlugins ──────────────────────────────────────────

  it('starts empty', () => {
    expect(pm.listPlugins()).toHaveLength(0);
    expect(pm.hasPlugins()).toBe(false);
  });

  it('registers a plugin directly', () => {
    pm.registerDirect(makeEchoPlugin());
    expect(pm.listPlugins()).toHaveLength(1);
    expect(pm.hasPlugins()).toBe(true);
    expect(pm.listPlugins()[0].name).toBe('@timps/plugin-echo');
  });

  it('throws on duplicate registration', () => {
    pm.registerDirect(makeEchoPlugin());
    expect(() => pm.registerDirect(makeEchoPlugin())).toThrow('already registered');
  });

  // ── runCommand ────────────────────────────────────────────────────────────

  it('runs a registered command', async () => {
    pm.registerDirect(makeEchoPlugin());
    const result = await pm.runCommand('echo', ['hello', 'world']);
    expect(result).toBe('hello world');
  });

  it('returns null for an unknown command', async () => {
    const result = await pm.runCommand('noop', []);
    expect(result).toBeNull();
  });

  // ── getPluginToolDefs ─────────────────────────────────────────────────────

  it('returns empty tool defs when no plugins loaded', () => {
    expect(pm.getPluginToolDefs()).toHaveLength(0);
  });

  it('returns tool definitions for loaded plugins', () => {
    pm.registerDirect(makeToolPlugin());
    const defs = pm.getPluginToolDefs();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe('greet');
    expect(defs[0].description).toBe('Return a greeting');
    expect(defs[0].inputSchema.type).toBe('object');
  });

  // ── getPluginTool ─────────────────────────────────────────────────────────

  it('returns undefined for an unregistered tool', () => {
    expect(pm.getPluginTool('ghost')).toBeUndefined();
  });

  it('returns a RegisteredTool adapter for a plugin tool', async () => {
    pm.registerDirect(makeToolPlugin());
    const registered = pm.getPluginTool('greet');
    expect(registered).toBeDefined();
    expect(registered!.risk).toBe('low');
    const result = await registered!.execute({ name: 'TIMPS' }, '/proj');
    expect(result.content).toBe('Hello, TIMPS!');
    expect(result.isError).toBe(false);
  });

  it('wraps plugin tool errors in ToolExecResult.isError', async () => {
    const errorPlugin: Plugin = {
      manifest: {
        name: 'err-plugin',
        version: '0.1.0',
        description: 'always errors',
        tools: [{ name: 'fail', description: 'fail', parameters: {} }],
      },
      tools: {
        async fail() { return { output: '', error: 'boom' }; },
      },
    };
    pm.registerDirect(errorPlugin);
    const registered = pm.getPluginTool('fail')!;
    const result = await registered.execute({}, '/proj');
    expect(result.isError).toBe(true);
    expect(result.content).toContain('boom');
  });

  // ── lifecycle (setup / teardown) ──────────────────────────────────────────

  it('calls setup when loading a plugin via registerDirect (skipped — setup called by load())', () => {
    // setup is only called by load(), not registerDirect()
    const setup = vi.fn();
    const plugin: Plugin = {
      manifest: { name: 'lifecycle-plugin', version: '0.1.0', description: 'test' },
      setup: async () => { setup(); },
    };
    pm.registerDirect(plugin);
    expect(setup).not.toHaveBeenCalled(); // setup is NOT called by registerDirect
  });

  it('calls teardown when unloading a plugin', async () => {
    const teardown = vi.fn();
    const plugin: Plugin = {
      manifest: { name: 'teardown-plugin', version: '0.1.0', description: 'test' },
      teardown: async () => { teardown(); },
    };
    pm.registerDirect(plugin);
    const removed = await pm.unload('teardown-plugin');
    expect(removed).toBe(true);
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(pm.listPlugins()).toHaveLength(0);
  });

  it('returns false when unloading a plugin that is not registered', async () => {
    const removed = await pm.unload('ghost');
    expect(removed).toBe(false);
  });

  // ── MemoryAPI bridge ──────────────────────────────────────────────────────

  it('loadSemantic maps MemoryEntry to SemanticEntry shape', async () => {
    memory.loadSemanticEntries.mockReturnValueOnce([
      { id: 'abc', timestamp: 1000, type: 'fact', content: 'hello', tags: ['t1'], confidence: 0.9 },
    ]);
    pm.registerDirect({
      manifest: { name: 'mem-plugin', version: '0.1.0', description: 'mem' },
      commands: {
        async read(_args: string[], ctx: import('@timps/plugin-sdk').PluginContext) {
          const entries = await ctx.memory.loadSemantic(ctx.projectPath);
          return JSON.stringify(entries[0]);
        },
      },
    });
    const result = await pm.runCommand('read', []);
    const entry = JSON.parse(result!);
    expect(entry.key).toBe('abc');
    expect(entry.value).toBe('hello');
    expect(entry.type).toBe('fact');
    expect(entry.importance).toBe(0.9);
  });

  it('appendEpisode delegates to memory.storeEpisode', async () => {
    pm.registerDirect({
      manifest: { name: 'ep-plugin', version: '0.1.0', description: 'ep' },
      commands: {
        async store(_args: string[], ctx: import('@timps/plugin-sdk').PluginContext) {
          await ctx.memory.appendEpisode(ctx.projectPath, {
            ts: new Date(9000).toISOString(),
            summary: 'did stuff',
            outcome: 'success',
            tags: [],
            toolsUsed: ['bash'],
            filesChanged: ['a.ts'],
            durationMs: 500,
          });
          return 'ok';
        },
      },
    });
    await pm.runCommand('store', []);
    expect(memory.storeEpisode).toHaveBeenCalledTimes(1);
    const stored = memory.storeEpisode.mock.calls[0][0];
    expect(stored.summary).toBe('did stuff');
    expect(stored.outcome).toBe('success');
  });
});
