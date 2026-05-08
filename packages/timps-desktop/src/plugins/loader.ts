import { Plugin, PluginMetadata, PluginConfig, PluginError, PluginCapabilities, PLUGIN_EVENTS } from './types';

export interface PluginLoaderOptions {
  basePath?: string;
  autoEnable?: boolean;
}

export class PluginLoader {
  private loadedPlugins: Map<string, Plugin> = new Map();
  private options: PluginLoaderOptions;

  constructor(options: PluginLoaderOptions = {}) {
    this.options = options;
  }

  async load(source: string | Plugin, options?: { enabled?: boolean }): Promise<Plugin> {
    try {
      const plugin = typeof source === 'string' ? await this.loadFromSource(source) : source;
      this.loadedPlugins.set(plugin.manifest.id, plugin);
      return plugin;
    } catch (error) {
      throw new PluginError(
        `Failed to load plugin: ${error instanceof Error ? error.message : 'Unknown error'}`,
        typeof source === 'string' ? source : source?.manifest?.id
      );
    }
  }

  async loadFromSource(source: string): Promise<Plugin> {
    console.log(`Loading plugin from: ${source}`);
    const manifest: PluginManifest = {
      id: source,
      name: source,
      version: '1.0.0',
      main: 'index.js',
    };
    return {
      manifest,
      capabilities: {},
      hooks: {
        onInit: async () => console.log(`Plugin ${source} initialized`),
      },
    } as Plugin;
  }

  async unload(id: string): Promise<void> {
    const plugin = this.loadedPlugins.get(id);
    if (!plugin) {
      throw new PluginError(`Plugin not found: ${id}`, id);
    }
    await plugin.hooks?.onDisable?.();
    this.loadedPlugins.delete(id);
  }

  async reload(id: string): Promise<Plugin> {
    const plugin = this.loadedPlugins.get(id);
    if (!plugin) {
      throw new PluginError(`Plugin not found: ${id}`, id);
    }
    await this.unload(id);
    return this.load(id);
  }

  get(id: string): Plugin | undefined {
    return this.loadedPlugins.get(id);
  }

  getAll(): Plugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  getEnabled(): Plugin[] {
    return this.getAll().filter(p => true);
  }

  has(id: string): boolean {
    return this.loadedPlugins.has(id);
  }

  async loadMany(sources: (string | Plugin)[]): Promise<Plugin[]> {
    return Promise.all(sources.map(source => this.load(source)));
  }

  async unloadMany(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => this.unload(id)));
  }

  async reloadAll(): Promise<void> {
    const ids = Array.from(this.loadedPlugins.keys());
    await Promise.all(ids.map(id => this.reload(id)));
  }
}

export const globalPluginLoader = new PluginLoader();

export class PluginRegistry {
  private plugins: Map<string, PluginMetadata> = new Map();
  private configs: Map<string, PluginConfig> = new Map();

  register(plugin: PluginMetadata, config?: PluginConfig): void {
    this.plugins.set(plugin.id, plugin);
    this.configs.set(plugin.id, {
      enabled: plugin.enabled,
      autoEnable: config?.autoEnable ?? true,
      config: config?.config ?? {},
      permissions: config?.permissions ?? [],
    });
  }

  unregister(id: string): void {
    this.plugins.delete(id);
    this.configs.delete(id);
  }

  get(id: string): PluginMetadata | undefined {
    return this.plugins.get(id);
  }

  getConfig(id: string): PluginConfig | undefined {
    return this.configs.get(id);
  }

  getAll(): PluginMetadata[] {
    return Array.from(this.plugins.values());
  }

  getEnabled(): PluginMetadata[] {
    return this.getAll().filter(p => p.enabled);
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  updateConfig(id: string, config: Partial<PluginConfig>): void {
    const existing = this.configs.get(id);
    if (existing) {
      this.configs.set(id, { ...existing, ...config });
    }
  }

  findByKeyword(keyword: string): PluginMetadata[] {
    return this.getAll().filter(p => 
      p.keywords?.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
    );
  }

  search(query: string): PluginMetadata[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(p => 
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description?.toLowerCase().includes(lowerQuery) ||
      p.id.toLowerCase().includes(lowerQuery)
    );
  }

  getBySource(source: PluginMetadata['source']): PluginMetadata[] {
    return this.getAll().filter(p => p.source === source);
  }
}

export const globalPluginRegistry = new PluginRegistry();

export class PluginManager {
  private loader: PluginLoader;
  private registry: PluginRegistry;

  constructor(loader?: PluginLoader, registry?: PluginRegistry) {
    this.loader = loader ?? new PluginLoader();
    this.registry = registry ?? new PluginRegistry();
  }

  async install(source: string | Plugin): Promise<Plugin> {
    const plugin = await this.loader.load(source);
    const metadata: PluginMetadata = {
      ...plugin.manifest,
      installedAt: Date.now(),
      enabled: true,
      loaded: true,
      source: 'local',
    };
    this.registry.register(metadata);
    await plugin.hooks?.onEnable?.();
    return plugin;
  }

  async uninstall(id: string): Promise<void> {
    const plugin = this.loader.get(id);
    if (plugin) {
      await plugin.hooks?.onUninstall?.();
      await this.loader.unload(id);
      this.registry.unregister(id);
    }
  }

  async enable(id: string): Promise<void> {
    const plugin = await this.loader.load(id);
    this.registry.updateConfig(id, { enabled: true });
    await plugin.hooks?.onEnable?.();
  }

  async disable(id: string): Promise<void> {
    const plugin = this.loader.get(id);
    if (plugin) {
      await plugin.hooks?.onDisable?.();
    }
    this.registry.updateConfig(id, { enabled: false });
  }

  getPlugin(id: string): Plugin | undefined {
    return this.loader.get(id);
  }

  getInstalled(): PluginMetadata[] {
    return this.registry.getAll();
  }

  getEnabledPlugins(): PluginMetadata[] {
    return this.registry.getEnabled();
  }

  async reloadPlugin(id: string): Promise<Plugin> {
    return this.loader.reload(id);
  }
}

export const globalPluginManager = new PluginManager();

export function createPluginLoader(options?: PluginLoaderOptions): PluginLoader {
  return new PluginLoader(options);
}

export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry();
}

export function createPluginManager(
  loader?: PluginLoader,
  registry?: PluginRegistry
): PluginManager {
  return new PluginManager(loader, registry);
}