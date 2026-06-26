// ── TIMPS Code — Plugin Manager ──
// Bridges @timps/plugin-sdk into the timps-code agent loop.
// Plugins can add new tools, slash commands, and lifecycle hooks
// that are automatically available in every agent session.

import { PluginRegistry, loadPlugin } from '@timps/plugin-sdk';
import type {
  Plugin,
  PluginContext,
  PluginManifest,
  MemoryAPI,
  SemanticEntry,
  EpisodicEntry,
} from '@timps/plugin-sdk';
import type { RegisteredTool, ToolExecResult } from '../tools/tools.js';
import type { ToolDefinition } from '../config/types.js';
import type { Memory } from '../memory/memory.js';

// ─── Memory bridge ────────────────────────────────────────────────────────────

/**
 * Build a `MemoryAPI` that delegates to the current `Memory` instance.
 * The `projectPath` argument from the plugin is ignored — the Memory
 * instance is already scoped to the active project.
 */
function buildMemoryAPI(memory: Memory): MemoryAPI {
  return {
    async loadSemantic(_projectPath: string): Promise<SemanticEntry[]> {
      return (await memory.loadSemanticEntries()).map((e) => ({
        key: e.id,
        value: e.content,
        type: e.type,
        tags: e.tags,
        importance: e.confidence ?? 0.5,
        lastAccessed: new Date(e.timestamp).toISOString(),
      }));
    },

    async saveSemantic(_projectPath: string, entries: SemanticEntry[]): Promise<void> {
      // Replace semantic store with the provided entries.
      // Delegate to Memory.importMemory which writes the semantic file.
      const mapped = entries.map((e) => ({
        id: e.key,
        timestamp: new Date(e.lastAccessed).getTime() || Date.now(),
        type: (e.type as 'fact') || 'fact',
        content: e.value,
        tags: e.tags,
      }));
      memory.importMemory(JSON.stringify({ semantic: mapped }));
    },

    async loadEpisodes(_projectPath: string, count = 10): Promise<any[]> {
      return memory.loadEpisodes(count).map((ep: any) => ({
        ts: new Date(ep.timestamp).toISOString(),
        summary: ep.summary,
        outcome: ep.outcome === 'failed' ? 'failure' : ep.outcome,
        tags: [],
        toolsUsed: ep.toolsUsed ?? [],
        filesChanged: ep.filesChanged ?? [],
        durationMs: ep.durationMs ?? 0,
      }));
    },

    async appendEpisode(_projectPath: string, entry: EpisodicEntry): Promise<void> {
      memory.storeEpisode({
        timestamp: new Date(entry.ts).getTime() || Date.now(),
        summary: entry.summary,
        outcome: entry.outcome === 'failure' ? 'failed' : entry.outcome,
        toolsUsed: entry.toolsUsed,
        filesChanged: entry.filesChanged,
      });
    },
  };
}

// ─── PluginManager ────────────────────────────────────────────────────────────

export class PluginManager {
  private readonly registry = new PluginRegistry();
  private memory: Memory;
  private cwd: string;
  private log: (msg: string) => void;

  constructor(memory: Memory, cwd: string, log: (msg: string) => void = () => {}) {
    this.memory = memory;
    this.cwd = cwd;
    this.log = log;
  }

  // ─── Context factory ──────────────────────────────────────────────────────

  private makeContext(): PluginContext {
    return {
      projectPath: this.cwd,
      memory: buildMemoryAPI(this.memory),
      log: this.log,
    };
  }

  // ─── Load & lifecycle ─────────────────────────────────────────────────────

  /**
   * Load a plugin by npm package name or file path, run its setup hook,
   * and register it in the registry.
   */
  async load(specifier: string): Promise<void> {
    const plugin = await loadPlugin(specifier);
    this.registry.register(plugin);
    if (plugin.setup) {
      await plugin.setup(this.makeContext());
    }
    this.log(`[plugin] loaded: ${plugin.manifest.name} v${plugin.manifest.version}`);
  }

  /**
   * Run the teardown hook for a plugin and remove it from the registry.
   */
  async unload(name: string): Promise<boolean> {
    const plugin = this.registry.get(name);
    if (!plugin) return false;
    if (plugin.teardown) {
      await plugin.teardown(this.makeContext());
    }
    this.registry.unregister(name);
    this.log(`[plugin] unloaded: ${name}`);
    return true;
  }

  /** Register a plugin object directly (e.g. for testing or built-in plugins). */
  registerDirect(plugin: Plugin): void {
    this.registry.register(plugin);
  }

  // ─── Tool integration ─────────────────────────────────────────────────────

  /**
   * Returns `ToolDefinition[]` for all plugin-provided tools, ready to be
   * appended to the agent's tool list sent to the LLM.
   */
  getPluginToolDefs(): ToolDefinition[] {
    return this.registry.allTools().map(({ spec }) => ({
      name: spec.name,
      description: spec.description,
      inputSchema: {
        type: 'object' as const,
        properties: (spec.parameters as {
          properties?: Record<string, { type: string; description: string }>;
        }).properties ?? {},
        required: (spec.parameters as { required?: string[] }).required,
      },
    }));
  }

  /**
   * Returns a `RegisteredTool`-compatible adapter for a plugin tool,
   * or `undefined` if no plugin has registered a tool with that name.
   */
  getPluginTool(name: string): RegisteredTool | undefined {
    const found = this.registry.allTools().find((t) => t.spec.name === name);
    if (!found) return undefined;

    const ctx = this.makeContext();
    return {
      definition: {
        name: found.spec.name,
        description: found.spec.description,
        inputSchema: {
          type: 'object' as const,
          properties: (found.spec.parameters as {
            properties?: Record<string, { type: string; description: string }>;
          }).properties ?? {},
        },
      },
      risk: 'low' as const,
      execute: async (args: Record<string, unknown>, _cwd: string): Promise<ToolExecResult> => {
        const result = await found.handler(args, ctx);
        return {
          content: result.error ? `Error: ${result.error}\n${result.output}` : result.output,
          isError: !!result.error,
        };
      },
    };
  }

  // ─── Command integration ──────────────────────────────────────────────────

  /**
   * Run a plugin slash command. Returns the output string, or `null` if
   * no plugin handles that command.
   */
  async runCommand(name: string, args: string[]): Promise<string | null> {
    const handlers = this.registry.resolveCommand(name);
    if (handlers.length === 0) return null;
    // First-registered plugin wins
    return handlers[0].handler(args, this.makeContext());
  }

  // ─── Introspection ────────────────────────────────────────────────────────

  /** Returns the list of all loaded plugin manifests. */
  listPlugins(): PluginManifest[] {
    return this.registry.list();
  }

  /** Returns true if any plugin is loaded. */
  hasPlugins(): boolean {
    return this.registry.size() > 0;
  }
}
