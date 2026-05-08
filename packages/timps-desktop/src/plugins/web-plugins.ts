import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class HttpClientPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/http-client',
    name: 'HTTP Client',
    version: '1.0.0',
    description: 'HTTP requests and responses',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['http', 'request', 'fetch', 'api'],
  };

  public capabilities: PluginCapabilities = {};

  async get(url: string, options?: RequestOptions): Promise<Response> {
    return this.request('GET', url, options);
  }

  async post(url: string, data?: unknown, options?: RequestOptions): Promise<Response> {
    return this.request('POST', url, { ...options, body: JSON.stringify(data) });
  }

  async put(url: string, data?: unknown, options?: RequestOptions): Promise<Response> {
    return this.request('PUT', url, { ...options, body: JSON.stringify(data) });
  }

  async patch(url: string, data?: unknown, options?: RequestOptions): Promise<Response> {
    return this.request('PATCH', url, { ...options, body: JSON.stringify(data) });
  }

  async delete(url: string, options?: RequestOptions): Promise<Response> {
    return this.request('DELETE', url, options);
  }

  async request(method: string, url: string, options?: RequestOptions): Promise<Response> {
    const defaultOptions: RequestOptions = {
      headers: { 'Content-Type': 'application/json' }
    };

    const merged = { ...defaultOptions, ...options };

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      url,
      headers: {},
      data: null,
      json: async () => null,
      text: async () => ''
    };
  }

  buildQueryString(params: Record<string, unknown>): string {
    return new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
  }

  parseHeaders(headers: HeadersInit): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      result[key] = value as string;
    }
    return result;
  }

  isSuccess(status: number): boolean {
    return status >= 200 && status < 300;
  }

  isRedirect(status: number): boolean {
    return status >= 300 && status < 400;
  }

  isClientError(status: number): boolean {
    return status >= 400 && status < 500;
  }

  isServerError(status: number): boolean {
    return status >= 500;
  }
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  credentials?: RequestCredentials;
}

export interface Response {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  data: unknown;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export class WebSocketPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/websocket',
    name: 'WebSocket',
    version: '1.0.0',
    description: 'WebSocket client',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['websocket', 'socket', 'realtime', 'api'],
  };

  public capabilities: PluginCapabilities = {};

  create(url: string, options?: WebSocketOptions): WebSocketConnection {
    return new WebSocketConnection(url, options);
  }

  parseUrl(url: string): { protocol: string; host: string; path: string } {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      host: parsed.host,
      path: parsed.pathname
    };
  }

  buildUrl(protocol: string, host: string, path: string): string {
    return `${protocol}//${host}${path}`;
  }
}

export class WebSocketConnection {
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(public url: string, public options?: WebSocketOptions) {}

  connect(): void {}

  send(data: unknown): void {
    this.emit('message', data);
  }

  close(): void {}

  on(event: string, handler: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(handler => handler(data));
  }
}

export interface WebSocketOptions {
  protocols?: string | string[];
  headers?: Record<string, string>;
}

export class StoragePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/storage',
    name: 'Storage',
    version: '1.0.0',
    description: 'Local storage utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['storage', 'localStorage', 'cache', 'key-value'],
  };

  public capabilities: PluginCapabilities = {};

  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue || null;
    } catch {
      return defaultValue || null;
    }
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.clear();
  }

  keys(): string[] {
    return Object.keys(localStorage);
  }

  has(key: string): boolean {
    return key in localStorage;
  }

  size(): number {
    return localStorage.length;
  }

  setObject(key: string, obj: Record<string, unknown>): void {
    this.set(key, obj);
  }

  getObject<T>(key: string): T | null {
    return this.get<T>(key);
  }

  merge(key: string, obj: Record<string, unknown>): void {
    const existing = this.get<Record<string, unknown>>(key) || {};
    this.set(key, { ...existing, ...obj });
  }
}

export class CachePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/cache',
    name: 'Cache',
    version: '1.0.0',
    description: 'In-memory cache',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['cache', 'memory', 'lru', 'store'],
  };

  public capabilities: PluginCapabilities = {};

  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  set(key: string, value: unknown, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expires: ttl ? Date.now() + ttl : undefined
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (entry.expires && entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  has(key: string): boolean {
    const value = this.get(key);
    return value !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  size(): number {
    return this.cache.size;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expires && entry.expires < now) {
        this.cache.delete(key);
      }
    }
  }

  getOrSet<T>(key: string, factory: () => T, ttl?: number): T {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const value = factory();
    this.set(key, value, ttl);
    return value;
  }
}

interface CacheEntry<T> {
  value: T;
  expires?: number;
}

export class RateLimitPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/rate-limit',
    name: 'Rate Limit',
    version: '1.0.0',
    description: 'Rate limiting',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['rate', 'limit', 'throttle', 'debounce'],
  };

  public capabilities: PluginCapabilities = {};

  private limits: Map<string, RateLimitWindow> = new Map();

  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const window = this.limits.get(key);

    if (!window || window.reset < now) {
      this.limits.set(key, { count: 1, reset: now + windowMs });
      return true;
    }

    if (window.count >= limit) {
      return false;
    }

    window.count++;
    return true;
  }

  remaining(key: string, limit: number): number {
    const window = this.limits.get(key);
    if (!window) return limit;
    return Math.max(0, limit - window.count);
  }

  reset(key: string): void {
    this.limits.delete(key);
  }

  resetAll(): void {
    this.limits.clear();
  }

  window(key: string): number {
    const window = this.limits.get(key);
    return window ? window.reset : 0;
  }
}

interface RateLimitWindow {
  count: number;
  reset: number;
}

export class DebouncePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/debounce',
    name: 'Debounce',
    version: '1.0.0',
    description: 'Debounce and throttle',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['debounce', 'throttle', 'delay', 'performance'],
  };

  public capabilities: PluginCapabilities = {};

  debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
  ): DebouncedFunction<T> {
    let timeout: ReturnType<typeof setTimeout>;

    return function (this: unknown, ...args: Parameters<T>) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    } as DebouncedFunction<T>;
  }

  throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    limit: number
  ): ThrottledFunction<T> {
    let lastCall = 0;

    return function (this: unknown, ...args: Parameters<T>) {
      const now = Date.now();
      if (now - lastCall >= limit) {
        lastCall = now;
        return fn.apply(this, args);
      }
    } as ThrottledFunction<T>;
  }

  immediate<T extends (...args: unknown[]) => unknown>(
    fn: T
  ): ImmediateFunction<T> {
    let called = false;

    return function (this: unknown, ...args: Parameters<T>) {
      if (!called) {
        called = true;
        return fn.apply(this, args);
      }
    } as ImmediateFunction<T>;
  }
}

interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): void;
}

interface ThrottledFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): unknown;
}

interface ImmediateFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): unknown;
}

export class QueuePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/queue',
    name: 'Queue',
    version: '1.0.0',
    description: 'Task queue',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['queue', 'task', 'async', 'job'],
  };

  public capabilities: PluginCapabilities = {};

  private queue: QueueItem[] = [];
  private processing = false;
  private concurrency: number;
  private running = 0;

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }

  add<T>(task: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, priority, resolve, reject });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.running++;

    while (this.queue.length > 0 && this.running < this.concurrency) {
      const item = this.queue.shift()!;
      try {
        const result = await item.task();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      } finally {
        this.running--;
      }
    }

    this.processing = false;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  pause(): void {
    this.processing = false;
  }
}

interface QueueItem {
  task: () => Promise<unknown>;
  priority: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class EventBusPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/event-bus',
    name: 'Event Bus',
    version: '1.0.0',
    description: 'Event bus for pub/sub',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['event', 'pub', 'sub', 'emit'],
  };

  public capabilities: PluginCapabilities = {};

  private handlers: Map<string, Set<EventHandler>> = new Map();
  private onceHandlers: Map<string, Set<EventHandler>> = new Map();

  on(event: string, handler: EventHandler): void {
    this.getHandlers(event, false).add(handler);
  }

  once(event: string, handler: EventHandler): void {
    this.onceHandlers.get(event, new Set()).add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.getHandlers(event, false).delete(handler);
    this.onceHandlers.get(event)?.delete(handler);
  }

  emit(event: string, data?: unknown): void {
    for (const handler of this.getHandlers(event, false)) {
      handler(data);
    }

    for (const handler of this.onceHandlers.get(event) || []) {
      handler(data);
      this.onceHandlers.get(event)?.delete(handler);
    }
  }

  clear(event?: string): void {
    if (event) {
      this.handlers.delete(event);
      this.onceHandlers.delete(event);
    } else {
      this.handlers.clear();
      this.onceHandlers.clear();
    }
  }

  events(): string[] {
    return [...new Set([...this.handlers.keys(), ...this.onceHandlers.keys()])];
  }

  private getHandlers(event: string, once: boolean): Set<EventHandler> {
    const map = once ? this.onceHandlers : this.handlers;
    if (!map.has(event)) {
      map.set(event, new Set());
    }
    return map.get(event)!;
  }
}

type EventHandler = (data?: unknown) => void;

export class LruCachePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/lru-cache',
    name: 'LRU Cache',
    version: '1.0.0',
    description: 'Least recently used cache',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['lru', 'cache', 'memory', 'eviction'],
  };

  public capabilities: PluginCapabilities = {};

  private cache: Map<string, unknown> = new Map();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | undefined {
    if (!this.cache.has(key)) return undefined;

    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);

    return value as T;
  }

  set(key: string, value: unknown): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  values<T>(): T[] {
    return Array.from(this.cache.values()) as T[];
  }
}