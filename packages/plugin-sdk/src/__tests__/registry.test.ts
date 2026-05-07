import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../registry.js';
import type { Plugin } from '../types.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makePlugin(name: string): Plugin {
  return {
    manifest: { name, version: '0.1.0', description: `Test plugin: ${name}` },
  };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it('starts empty', () => {
    expect(registry.size()).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it('registers a plugin', () => {
    registry.register(makePlugin('plugin-a'));
    expect(registry.size()).toBe(1);
    expect(registry.has('plugin-a')).toBe(true);
  });

  it('throws on duplicate registration', () => {
    registry.register(makePlugin('dup'));
    expect(() => registry.register(makePlugin('dup'))).toThrow('already registered');
  });

  it('unregisters a plugin and returns true', () => {
    registry.register(makePlugin('plugin-b'));
    expect(registry.unregister('plugin-b')).toBe(true);
    expect(registry.has('plugin-b')).toBe(false);
  });

  it('returns false when unregistering an unknown plugin', () => {
    expect(registry.unregister('ghost')).toBe(false);
  });

  it('gets a plugin by name', () => {
    const p = makePlugin('plugin-c');
    registry.register(p);
    expect(registry.get('plugin-c')).toBe(p);
  });

  it('returns undefined for an unknown plugin', () => {
    expect(registry.get('missing')).toBeUndefined();
  });

  it('lists all plugin manifests', () => {
    registry.register(makePlugin('x'));
    registry.register(makePlugin('y'));
    const names = registry.list().map((m) => m.name);
    expect(names).toContain('x');
    expect(names).toContain('y');
    expect(names).toHaveLength(2);
  });

  it('resolves a command handler', async () => {
    const p: Plugin = {
      manifest: {
        name: 'cmd-plugin',
        version: '0.1.0',
        description: 'plugin with command',
        commands: [{ name: 'greet', description: 'greet', usage: '/greet <name>' }],
      },
      commands: {
        async greet(args, _ctx) {
          return `Hello, ${args[0]}`;
        },
      },
    };
    registry.register(p);

    const resolved = registry.resolveCommand('greet');
    expect(resolved).toHaveLength(1);
    const result = await resolved[0].handler(['world'], {} as never);
    expect(result).toBe('Hello, world');
  });

  it('returns empty array for an unregistered command', () => {
    expect(registry.resolveCommand('nonexistent')).toHaveLength(0);
  });

  it('collects tool specs across all plugins', () => {
    const p: Plugin = {
      manifest: {
        name: 'tool-plugin',
        version: '0.1.0',
        description: 'plugin with tools',
        tools: [
          { name: 'search', description: 'search memory', parameters: {} },
          { name: 'summarize', description: 'summarize episodes', parameters: {} },
        ],
      },
      tools: {
        async search(_params, _ctx) { return { output: 'results' }; },
        async summarize(_params, _ctx) { return { output: 'summary' }; },
      },
    };
    registry.register(p);

    const tools = registry.allTools();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.spec.name)).toContain('search');
    expect(tools.map((t) => t.spec.name)).toContain('summarize');
    expect(tools[0].pluginName).toBe('tool-plugin');
  });

  it('multiple plugins can register different commands', async () => {
    const pluginA: Plugin = {
      manifest: {
        name: 'plugin-aa',
        version: '0.1.0',
        description: 'a',
        commands: [{ name: 'hello', description: 'say hello', usage: '/hello' }],
      },
      commands: { async hello(_args, _ctx) { return 'hello from A'; } },
    };
    const pluginB: Plugin = {
      manifest: {
        name: 'plugin-bb',
        version: '0.1.0',
        description: 'b',
        commands: [{ name: 'bye', description: 'say bye', usage: '/bye' }],
      },
      commands: { async bye(_args, _ctx) { return 'bye from B'; } },
    };
    registry.register(pluginA);
    registry.register(pluginB);

    expect(registry.resolveCommand('hello')).toHaveLength(1);
    expect(registry.resolveCommand('bye')).toHaveLength(1);
    expect(registry.size()).toBe(2);
  });
});
