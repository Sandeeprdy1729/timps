import { Plugin, PluginManifest, PERMISSIONS } from './types';

export class PluginLifecycleManager {
  private plugins: Map<string, Plugin> = new Map();
  private initializationOrder: string[] = [];
  private initializationPromise: Promise<void> | null = null;

  async register(plugin: Plugin): Promise<void> {
    this.plugins.set(plugin.manifest.id, plugin);
    this.initializationOrder.push(plugin.manifest.id);
  }

  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await plugin.hooks?.onUninstall?.();
      this.plugins.delete(pluginId);
      this.initializationOrder = this.initializationOrder.filter(id => id !== pluginId);
    }
  }

  async initializeAll(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeInOrder();
    await this.initializationPromise;
    this.initializationPromise = null;
  }

  private async initializeInOrder(): Promise<void> {
    for (const pluginId of this.initializationOrder) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        try {
          await plugin.hooks?.onInit?.();
          console.log(`Initialized plugin: ${pluginId}`);
        } catch (error) {
          console.error(`Failed to initialize plugin ${pluginId}:`, error);
        }
      }
    }
  }

  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await plugin.hooks?.onEnable?.();
    }
  }

  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await plugin.hooks?.onDisable?.();
    }
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getInitializationOrder(): string[] {
    return [...this.initializationOrder];
  }
}

export class PluginDependencyResolver {
  private dependencyGraph: Map<string, string[]> = new Map();

  addPlugin(pluginId: string, dependencies: string[] = []): void {
    this.dependencyGraph.set(pluginId, dependencies);
  }

  removePlugin(pluginId: string): void {
    this.dependencyGraph.delete(pluginId);
  }

  resolve(pluginId: string): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];
    const result: string[] = [];

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const deps = this.dependencyGraph.get(id) || [];
      for (const dep of deps) {
        traverse(dep);
      }
      result.push(id);
    };

    traverse(pluginId);
    return result;
  }

  resolveAll(): string[][] {
    const allResolved: string[][] = [];
    for (const pluginId of this.dependencyGraph.keys()) {
      allResolved.push(this.resolve(pluginId));
    }
    return allResolved;
  }

  detectCycles(): string[] | null {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (id: string, path: string[]): string[] | null => {
      if (stack.has(id)) {
        return [...path, id];
      }
      if (visited.has(id)) {
        return null;
      }

      visited.add(id);
      stack.add(id);

      const deps = this.dependencyGraph.get(id) || [];
      for (const dep of deps) {
        const cycle = dfs(dep, [...path, id]);
        if (cycle) {
          return cycle;
        }
      }

      stack.delete(id);
      return null;
    };

    for (const pluginId of this.dependencyGraph.keys()) {
      const cycle = dfs(pluginId, []);
      if (cycle) {
        return cycle;
      }
    }

    return null;
  }

  getMissingDependencies(pluginId: string): string[] {
    const declared = this.dependencyGraph.get(pluginId) || [];
    const missing: string[] = [];

    for (const dep of declared) {
      if (!this.dependencyGraph.has(dep)) {
        missing.push(dep);
      }
    }

    return missing;
  }
}

export class PluginAutoLoader {
  private basePath = '/plugins';
  private loaded: Set<string> = new Set();

  constructor(basePath?: string) {
    if (basePath) {
      this.basePath = basePath;
    }
  }

  setBasePath(path: string): void {
    this.basePath = path;
  }

  async discover(): Promise<string[]> {
    const plugins: string[] = [];
    try {
      const response = await fetch(`${this.basePath}/plugins.json`);
      if (response.ok) {
        const data = await response.json();
        plugins.push(...data.plugins);
      }
    } catch (error) {
      console.error('Failed to discover plugins:', error);
    }
    return plugins;
  }

  async load(pluginId: string): Promise<Plugin | null> {
    if (this.loaded.has(pluginId)) {
      return null;
    }

    try {
      const response = await fetch(`${this.basePath}/${pluginId}/plugin.js`);
      if (response.ok) {
        const text = await response.text();
        const fn = new Function('exports', text);
        const module: { default?: Plugin } = {};
        fn(module);
        this.loaded.add(pluginId);
        return module.default || null;
      }
    } catch (error) {
      console.error(`Failed to load plugin ${pluginId}:`, error);
    }

    return null;
  }

  async loadAll(pluginIds: string[]): Promise<Plugin[]> {
    const plugins: Plugin[] = [];
    for (const id of pluginIds) {
      const plugin = await this.load(id);
      if (plugin) {
        plugins.push(plugin);
      }
    }
    return plugins;
  }

  isLoaded(pluginId: string): boolean {
    return this.loaded.has(pluginId);
  }

  getLoaded(): string[] {
    return Array.from(this.loaded);
  }

  unload(pluginId: string): void {
    this.loaded.delete(pluginId);
  }
}

export const lifecycleManager = new PluginLifecycleManager();
export const dependencyResolver = new PluginDependencyResolver();
export const autoLoader = new PluginAutoLoader();

export default { lifecycleManager, dependencyResolver, autoLoader };