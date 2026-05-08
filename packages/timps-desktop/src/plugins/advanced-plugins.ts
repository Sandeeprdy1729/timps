import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class PWAPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/pwa',
    name: 'PWA Support',
    version: '1.0.0',
    description: 'Progressive Web App features',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['pwa', 'service-worker', 'offline'],
  };

  public capabilities: PluginCapabilities = {
    api: { notifications: true },
  };

  private registration: ServiceWorkerRegistration | null = null;

  async register(): Promise<ServiceWorkerRegistration> {
    if ('serviceWorker' in navigator) {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      return this.registration;
    }
    throw new Error('Service workers not supported');
  }

  async unregister(): Promise<void> {
    if (this.registration) {
      await this.registration.unregister();
      this.registration = null;
    }
  }

  async update(): Promise<void> {
    if (this.registration) {
      await this.registration.update();
    }
  }

  async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    return this.registration;
  }

  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (this.registration) {
      await this.registration.showNotification(title, options);
    }
  }

  async claim(): Promise<void> {
    if (this.registration) {
      await navigator.serviceWorker.ready;
    }
  }
}

export class OfflinePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/offline',
    name: 'Offline Support',
    version: '1.0.0',
    description: 'Offline functionality',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['offline', 'pwa', 'cache'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
  };

  private online = true;

  async isOnline(): Promise<boolean> {
    return navigator.onLine;
  }

  async whenOnline(action: () => void | Promise<void>): Promise<void> {
    if (navigator.onLine) {
      await action();
    } else {
      const listener = () => {
        if (navigator.onLine) {
          action();
          window.removeEventListener('online', listener);
        }
      };
      window.addEventListener('online', listener);
    }
  }

  getStatus(): string {
    return navigator.onLine ? 'online' : 'offline';
  }
}

export class InstallPromptPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/install-prompt',
    name: 'Install Prompt',
    version: '1.0.0',
    description: 'PWA install prompt handling',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['install', 'pwa', 'app'],
  };

  public capabilities: PluginCapabilities = {};

  private promptEvent: BeforeInstallPromptEvent | null = null;

  async check(): Promise<boolean> {
    if ('BeforeInstallPromptEvent' in window) {
      const handler = (e: Event) => {
        e.preventDefault();
        this.promptEvent = e as BeforeInstallPromptEvent;
      };
      window.addEventListener('beforeinstallprompt', handler);
      return !!this.promptEvent;
    }
    return false;
  }

  async prompt(): Promise<'accepted' | 'dismissed'> {
    if (!this.promptEvent) return 'dismissed';

    const result = await this.promptEvent.prompt();
    return result.outcome === 'accepted' ? 'accepted' : 'dismissed';
  }

  async getPlatformInfo(): Promise<string> {
    return 'web';
  }
}

export class ManifestPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/manifest',
    name: 'Web App Manifest',
    version: '1.0.0',
    description: 'Web app manifest management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['manifest', 'pwa', 'app'],
  };

  public capabilities: PluginCapabilities = {};

  private manifest: Partial<Manifest> | null = null;

  async load(): Promise<Partial<Manifest> {
    if (this.manifest) return this.manifest;

    const link = document.querySelector('link[rel="manifest"]');
    if (!link) throw new Error('Manifest link not found');

    const response = await fetch(link.getAttribute('href')!);
    this.manifest = await response.json();
    return this.manifest;
  }

  async get(): Promise<Partial<Manifest> {
    return this.manifest || this.load();
  }

  async getIcons(): Promise<Array<{ src: string; sizes: string }>> {
    return (await this.get()).icons || [];
  }

  async getScreenshots(): Promise<Array<{ src: string }>> {
    return (await this.get()).screenshots || [];
  }

  getName(): string {
    return this.manifest?.name || 'TIMPS';
  }

  getShortName(): string {
    return this.manifest?.short_name || 'TIMPS';
  }
}

export class LocalStoragePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/local-storage',
    name: 'Local Storage',
    version: '1.0.0',
    description: 'Local storage wrapper',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['storage', 'local', 'persistence'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  setItem(key: string, value: unknown): void {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  }

  getItem<T>(key: string, defaultValue?: T): T | null {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue !== undefined ? defaultValue : null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue as T;
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.clear();
  }

  key(index: number): string | null {
    return localStorage.key(index);
  }

  get size(): number {
    return localStorage.length;
  }

  has(key: string): boolean {
    return key in localStorage;
  }

  keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  }
}

export class SessionStoragePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/session-storage',
    name: 'Session Storage',
    version: '1.0.0',
    description: 'Session storage wrapper',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['storage', 'session', 'persistence'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  setItem(key: string, value: unknown): void {
    const serialized = JSON.stringify(value);
    sessionStorage.setItem(key, serialized);
  }

  getItem<T>(key: string, defaultValue?: T): T | null {
    const value = sessionStorage.getItem(key);
    if (value === null) return defaultValue !== undefined ? defaultValue : null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue as T;
    }
  }

  removeItem(key: string): void {
    sessionStorage.removeItem(key);
  }

  clear(): void {
    sessionStorage.clear();
  }

  get size(): number {
    return sessionStorage.length;
  }

  has(key: string): boolean {
    return key in sessionStorage;
  }
}

export class IndexedDBPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/indexeddb',
    name: 'IndexedDB',
    version: '1.0.0',
    description: 'IndexedDB wrapper',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['database', 'indexeddb', 'storage'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true, database: true },
  };

  private db: IDBDatabase | null = null;
  private dbName: string;
  private version: number;

  constructor() {
    this.dbName = 'timps-db';
    this.version = 1;
  }

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

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
      };
    });
  }

  async get<T>(store: string, key: string): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const objectStore = transaction.objectStore(store);
      const request = objectStore.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value ?? null);
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

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export class WebSocketPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/websocket',
    name: 'WebSocket',
    version: '1.0.0',
    description: 'WebSocket connections',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['websocket', 'realtime', 'connection'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
  };

  private socket: WebSocket | null = null;
  private url: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  async connect(url: string, protocols?: string | string[]): Promise<WebSocket> {
    this.url = url;
    this.socket = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
    this.reconnectAttempts = 0;

    return new Promise((resolve, reject) => {
      this.socket!.onopen = () => resolve(this.socket!);
      this.socket!.onerror = (error) => reject(error);
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(data: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  onMessage(handler: (data: unknown) => void): void {
    this.socket!.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handler(data);
      } catch {
        handler(event.data);
      }
    };
  }

  onClose(handler: (code: number, reason: string) => void): void {
    this.socket!.onclose = (event) => {
      handler(event.code, event.reason);
      this.attemptReconnect();
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(this.url), this.reconnectDelay * this.reconnectAttempts);
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export class SSEPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/sse',
    name: 'Server-Sent Events',
    version: '1.0.0',
    description: 'Server-Sent Events client',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['sse', 'events', 'realtime'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
  };

  private eventSource: EventSource | null = null;

  async connect(url: string): Promise<EventSource> {
    this.eventSource = new EventSource(url);
    return this.eventSource;
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  onEvent(type: string, handler: (data: string) => void): void {
    this.eventSource!.addEventListener(type, (event) => {
      handler(event.data);
    });
  }

  onMessage(handler: (data: string) => void): void {
    this.eventSource!.onmessage = (event) => {
      handler(event.data);
    };
  }

  onError(handler: (error: Event) => void): void {
    this.eventSource!.onerror = handler;
  }

  isConnected(): boolean {
    return this.eventSource !== null;
  }
}

export class SSEClientPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/sse-client',
    name: 'SSE Client',
    version: '1.0.0',
    description: 'SSE client utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['sse', 'client', 'realtime'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
  };

  private clients: Map<string, EventSource> = new Map();

  async subscribe(url: string): Promise<string> {
    const eventSource = new EventSource(url);
    this.clients.set(url, eventSource);
    return url;
  }

  unsubscribe(url: string): void {
    const client = this.clients.get(url);
    if (client) {
      client.close();
      this.clients.delete(url);
    }
  }

  getClient(url: string): EventSource | undefined {
    return this.clients.get(url);
  }

  getSubscribedUrls(): string[] {
    return Array.from(this.clients.keys());
  }

  isSubscribed(url: string): boolean {
    return this.clients.has(url);
  }
}

export class EventEmitterPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/event-emitter',
    name: 'Event Emitter',
    version: '1.0.0',
    description: 'Event emitter pattern',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['events', 'emitter', 'pattern'],
  };

  public capabilities: PluginCapabilities = {};

  private events: Map<string, Array<(...args: unknown[]) => void>> = new Map();

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
  }

  off(event: string, handler?: (...args: unknown[]) => void): void {
    if (!handler) {
      this.events.delete(event);
    } else {
      const handlers = this.events.get(event)?.filter(h => h !== handler);
      if (handlers) {
        this.events.set(event, handlers);
      }
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  once(event: string, handler: (...args: unknown[]) => void): void {
    const wrapper = (...args: unknown[]) => {
      handler(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.length || 0;
  }

  eventNames(): string[] {
    return Array.from(this.events.keys());
  }
}

export class BusPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/bus',
    name: 'Message Bus',
    version: '1.0.0',
    description: 'Message bus for inter-plugin communication',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['bus', 'messages', 'ipc'],
  };

  public capabilities: PluginCapabilities = {
    api: { ipc: true },
  };

  private bus: Map<string, Array<{ channel: string; handler: (data: unknown) => void }>> = new Map();

  subscribe(channel: string, handler: (data: unknown) => void): () => void {
    if (!this.bus.has(channel)) {
      this.bus.set(channel, []);
    }
    const subscription = { channel, handler };
    this.bus.get(channel)!.push(subscription);

    return () => {
      const handlers = this.bus.get(channel)?.filter(h => h.handler !== handler);
      if (handlers) {
        this.bus.set(channel, handlers);
      }
    };
  }

  publish(channel: string, data?: unknown): void {
    const handlers = this.bus.get(channel);
    if (handlers) {
      handlers.forEach(({ handler }) => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in bus handler:', error);
        }
      });
    }
  }

  hasSubscribers(channel: string): boolean {
    return (this.bus.get(channel)?.length || 0) > 0;
  }

  getChannels(): string[] {
    return Array.from(this.bus.keys()).filter(channel => this.hasSubscribers(channel));
  }
}

export class SignalPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/signal',
    name: 'Signals',
    version: '1.0.0',
    description: 'Reactive signal pattern',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['signal', 'reactive', 'state'],
  };

  public capabilities: PluginCapabilities = {};

  createSignal<T>(initialValue: T): {
    get: () => T;
    set: (value: T | ((prev: T) => T)) => void;
    subscribe: (callback: (value: T) => void) => () => void;
  } {
    let value = initialValue;
    const subscribers: Set<(value: T) => void> = new Set();

    return {
      get: () => value,
      set: (newValue: T | ((prev: T) => T)) => {
        value = typeof newValue === 'function'
          ? (newValue as (prev: T) => T)(value)
          : newValue;
        subscribers.forEach(callback => callback(value));
      },
      subscribe: (callback: (value: T) => void) => {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      },
    };
  }

  createDerived<T, U>(
    signal: { get: () => T },
    compute: (value: T) => U
  ): { get: () => U } {
    let derivedValue: U = compute(signal.get());
    signal.subscribe(value => {
      derivedValue = compute(value);
    });
    return { get: () => derivedValue };
  }

  createComputed<T>(
    compute: () => T
  ): { get: () => T } {
    let computedValue = compute();
    return { get: () => computedValue };
  }
}

export class ReactivePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/reactive',
    name: 'Reactive',
    version: '1.0.0',
    description: 'Reactive state management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['reactive', 'state', 'observable'],
  };

  public capabilities: PluginCapabilities = {};

  createStore<T extends Record<string, unknown>>(initial: T): {
    get: () => T;
    set: (partial: Partial<T>) => void;
    subscribe: (callback: (state: T) => void) => () => void;
  } {
    let state: T = { ...initial };
    const subscribers: Set<(state: T) => void> = new Set();

    return {
      get: () => state,
      set: (partial: Partial<T>) => {
        state = { ...state, ...partial };
        subscribers.forEach(callback => callback(state));
      },
      subscribe: (callback: (state: T) => void) => {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      },
    };
  }

  createAction<T extends unknown[], R>(
    action: (...args: T) => R,
    store: { set: (partial: unknown) => void }
  ): (...args: T) => R {
    return (...args: T) => {
      const result = action(...args);
      return result;
    };
  }

  createSelector<T>(
    selector: (state: T) => unknown
  ): (state: T) => unknown {
    return selector;
  }
}

export const pwaPlugin = new PWAPlugin();
export const offlinePlugin = new OfflinePlugin();
export const installPromptPlugin = new InstallPromptPlugin();
export const manifestPlugin = new ManifestPlugin();
export const localStoragePlugin = new LocalStoragePlugin();
export const sessionStoragePlugin = new SessionStoragePlugin();
export const indexedDBPlugin = new IndexedDBPlugin();
export const webSocketPlugin = new WebSocketPlugin();
export const ssePlugin = new SSEPlugin();
export const sseClientPlugin = new SSEClientPlugin();
export const eventEmitterPlugin = new EventEmitterPlugin();
export const busPlugin = new BusPlugin();
export const signalPlugin = new SignalPlugin();
export const reactivePlugin = new ReactivePlugin();

export function registerAdvancedPlugins(): Plugin[] {
  return [
    pwaPlugin,
    offlinePlugin,
    installPromptPlugin,
    manifestPlugin,
    localStoragePlugin,
    sessionStoragePlugin,
    indexedDBPlugin,
    webSocketPlugin,
    ssePlugin,
    sseClientPlugin,
    eventEmitterPlugin,
    busPlugin,
    signalPlugin,
    reactivePlugin,
  ];
}