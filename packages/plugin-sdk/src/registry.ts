import type { Plugin, PluginManifest, ToolSpec } from './types.js';

/** In-memory registry of loaded plugins. One instance per agent session. */
export class PluginRegistry {
  private readonly _plugins = new Map<string, Plugin>();

  /**
   * Register a plugin. Throws if a plugin with the same name is already loaded.
   */
  register(plugin: Plugin): void {
    const { name } = plugin.manifest;
    if (this._plugins.has(name)) {
      throw new Error(`Plugin "${name}" is already registered`);
    }
    this._plugins.set(name, plugin);
  }

  /**
   * Remove a plugin by name.
   * @returns `true` if it existed and was removed, `false` if it was not found.
   */
  unregister(name: string): boolean {
    return this._plugins.delete(name);
  }

  /** Retrieve a plugin by name, or `undefined` if not registered. */
  get(name: string): Plugin | undefined {
    return this._plugins.get(name);
  }

  /** Returns `true` if the plugin is registered. */
  has(name: string): boolean {
    return this._plugins.has(name);
  }

  /** Number of registered plugins. */
  size(): number {
    return this._plugins.size;
  }

  /** Array of all registered plugin manifests. */
  list(): PluginManifest[] {
    return [...this._plugins.values()].map((p) => p.manifest);
  }

  /**
   * Resolve all handlers registered for a slash command.
   * Multiple plugins may register the same command name — all are returned.
   */
  resolveCommand(
    command: string,
  ): Array<{ plugin: Plugin; handler: NonNullable<Plugin['commands']>[string] }> {
    const results: Array<{
      plugin: Plugin;
      handler: NonNullable<Plugin['commands']>[string];
    }> = [];
    for (const plugin of this._plugins.values()) {
      const handler = plugin.commands?.[command];
      if (handler) {
        results.push({ plugin, handler });
      }
    }
    return results;
  }

  /**
   * Collect every tool spec + handler registered across all plugins.
   * Used by the agent's tool router to build the available-tools list.
   */
  allTools(): Array<{
    pluginName: string;
    spec: ToolSpec;
    handler: NonNullable<Plugin['tools']>[string];
  }> {
    const results: Array<{
      pluginName: string;
      spec: ToolSpec;
      handler: NonNullable<Plugin['tools']>[string];
    }> = [];
    for (const plugin of this._plugins.values()) {
      if (!plugin.tools || !plugin.manifest.tools) continue;
      for (const spec of plugin.manifest.tools) {
        const handler = plugin.tools[spec.name];
        if (typeof handler === 'function') {
          results.push({ pluginName: plugin.manifest.name, spec, handler });
        }
      }
    }
    return results;
  }

  /**
   * Collect every hook handler registered across all plugins for a given event.
   */
  resolveHooks(
    event: NonNullable<Plugin['hooks']> extends Partial<infer R> ? keyof R : never,
  ): Array<{ plugin: Plugin; handler: NonNullable<Plugin['hooks']>[typeof event] }> {
    const results: Array<{
      plugin: Plugin;
      handler: NonNullable<Plugin['hooks']>[typeof event];
    }> = [];
    for (const plugin of this._plugins.values()) {
      const handler = plugin.hooks?.[event as keyof NonNullable<Plugin['hooks']>];
      if (handler) {
        results.push({ plugin, handler: handler as NonNullable<Plugin['hooks']>[typeof event] });
      }
    }
    return results;
  }
}
