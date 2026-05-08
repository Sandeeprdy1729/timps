import { PluginSettings } from './store';

export interface PluginStorageOptions {
  namespace?: string;
  maxSize?: number;
}

export class PluginStorage {
  private namespace: string;
  private maxSize: number;
  private cache: Map<string, unknown> = new Map();
  private changed: Set<string> = new Set();

  constructor(options: PluginStorageOptions = {}) {
    this.namespace = options.namespace || 'plugin-storage';
    this.maxSize = options.maxSize || 5 * 1024 * 1024;
    this.load();
  }

  private load(): void {
    try {
      const data = localStorage.getItem(this.namespace);
      if (data) {
        const parsed = JSON.parse(data);
        Object.entries(parsed).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
      }
    } catch (error) {
      console.error('Failed to load plugin storage:', error);
    }
  }

  private persist(): void {
    const data: Record<string, unknown> = {};
    this.cache.forEach((value, key) => {
      data[key] = value;
    });
    localStorage.setItem(this.namespace, JSON.stringify(data));
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.cache.get(key) as T ?? defaultValue;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, value);
    this.changed.add(key);
    this.persist();
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.changed.add(key);
    this.persist();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.changed.add('*');
    this.persist();
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  size(): number {
    return this.cache.size;
  }

  getChanged(): string[] {
    const changed = Array.from(this.changed);
    this.changed.clear();
    return changed;
  }

  export(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    this.cache.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }

  import(data: Record<string, unknown>): void {
    Object.entries(data).forEach(([key, value]) => {
      this.cache.set(key, value);
    });
    this.persist();
  }
}

export class PluginDatabase {
  private db: IDBDatabase | null = null;
  private name: string;
  private version: number;

  constructor(name = 'timps-plugins', version = 1) {
    this.name = name;
    this.version = version;
  }

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'id' });
        }
      };
    });
  }

  async get<T>(store: string, key: string): Promise<T | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value ?? undefined);
    });
  }

  async set<T>(store: string, key: string, value: T): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.put({ key, value });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(store: string, key: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(store: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async keys(store: string): Promise<string[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export interface PluginSettings {
  id: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  permissions?: string[];
  autoEnable?: boolean;
  installedAt?: number;
  updatedAt?: number;
}

export class PluginSettingsStore {
  private storage: PluginStorage;
  private settings: Map<string, PluginSettings> = new Map();
  private readonly KEY = 'plugin-settings';

  constructor(namespace = 'plugins') {
    this.storage = new PluginStorage({ namespace: `${namespace}-settings` });
    this.load();
  }

  private load(): void {
    const data = this.storage.get<Record<string, PluginSettings>>(this.KEY, {});
    if (data) {
      Object.entries(data).forEach(([id, settings]) => {
        this.settings.set(id, settings);
      });
    }
  }

  private persist(): void {
    const data: Record<string, PluginSettings> = {};
    this.settings.forEach((settings, id) => {
      data[id] = settings;
    });
    this.storage.set(this.KEY, data);
  }

  get(id: string): PluginSettings | undefined {
    return this.settings.get(id);
  }

  set(id: string, settings: Partial<PluginSettings>): void {
    const existing = this.settings.get(id) || { id, enabled: false };
    this.settings.set(id, { ...existing, ...settings });
    this.persist();
  }

  delete(id: string): void {
    this.settings.delete(id);
    this.persist();
  }

  has(id: string): boolean {
    return this.settings.has(id);
  }

  getEnabled(): PluginSettings[] {
    return Array.from(this.settings.values()).filter(s => s.enabled);
  }

  getAll(): PluginSettings[] {
    return Array.from(this.settings.values());
  }

  enable(id: string): void {
    this.set(id, { enabled: true, updatedAt: Date.now() });
  }

  disable(id: string): void {
    this.set(id, { enabled: false, updatedAt: Date.now() });
  }

  updateConfig(id: string, config: Record<string, unknown>): void {
    const existing = this.get(id);
    if (existing) {
      this.set(id, { config: { ...existing.config, ...config } });
    }
  }
}

export const pluginStorage = new PluginStorage();
export const pluginDatabase = new PluginDatabase();
export const settingsStore = new PluginSettingsStore();

export default { pluginStorage, pluginDatabase, settingsStore };