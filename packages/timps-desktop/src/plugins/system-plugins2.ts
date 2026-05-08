import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class LoggerPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/logger',
    name: 'Logger',
    version: '1.0.0',
    description: 'Logging utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['log', 'logger', 'debug', 'console'],
  };

  public capabilities: PluginCapabilities = {};

  private loggers: Map<string, Logger> = new Map();

  getLogger(name: string, level: LogLevel = 'info'): Logger {
    if (!this.loggers.has(name)) {
      this.loggers.set(name, new Logger(name, level));
    }
    return this.loggers.get(name)!;
  }

  setGlobalLevel(level: LogLevel): void {
    this.loggers.forEach(logger => logger.setLevel(level));
  }

  enable(enabled: boolean): void {
    this.loggers.forEach(logger => logger.enabled = enabled);
  }

  getLogLevels(): LogLevel[] {
    return ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  }
}

export class Logger {
  public enabled = true;
  private level: LogLevel;

  constructor(private name: string, level: LogLevel) {
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  trace(...args: unknown[]): void {
    this.log('trace', args);
  }

  debug(...args: unknown[]): void {
    this.log('debug', args);
  }

  info(...args: unknown[]): void {
    this.log('info', args);
  }

  warn(...args: unknown[]): void {
    this.log('warn', args);
  }

  error(...args: unknown[]): void {
    this.log('error', args);
  }

  fatal(...args: unknown[]): void {
    this.log('fatal', args);
  }

  private log(level: LogLevel, args: unknown[]): void {
    if (!this.enabled) return;
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [${this.name}]`, ...args);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export class DebugPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/debug',
    name: 'Debug',
    version: '1.0.0',
    description: 'Debug utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['debug', 'inspect', 'util', 'dev'],
  };

  public capabilities: PluginCapabilities = {};

  inspect(obj: unknown, depth = 2): string {
    return JSON.stringify(obj, null, depth);
  }

  format(obj: unknown): string {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'string') return `"${obj}"`;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (Array.isArray(obj)) return `[${obj.map(this.format).join(', ')}]`;
    if (typeof obj === 'object') {
      const entries = Object.entries(obj as Record<string, unknown>);
      return `{${entries.map(([k, v]) => `${k}: ${this.format(v)}`).join(', ')}}`;
    }
    return String(obj);
  }

  table(data: unknown[]): void {
    console.table(data);
  }

  time(label: string): void {
    console.time(label);
  }

  timeEnd(label: string): void {
    console.timeEnd(label);
  }

  assert(condition: boolean, message: string): void {
    console.assert(condition, message);
  }

  count(label = 'default'): void {
    console.count(label);
  }

  countReset(label = 'default'): void {
    console.countReset(label);
  }

  trace(message?: string): void {
    console.trace(message);
  }

  profile(label: string): void {
    console.profile(label);
  }

  profileEnd(label: string): void {
    console.profileEnd(label);
  }
}

export class EnvPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/env',
    name: 'Environment',
    version: '1.0.0',
    description: 'Environment variables',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['env', 'environment', 'config', 'variable'],
  };

  public capabilities: PluginCapabilities = {};

  get(key: string, defaultValue?: string): string | undefined {
    return process.env[key] || defaultValue;
  }

  getInt(key: string, defaultValue?: number): number | undefined {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  getBool(key: string, defaultValue = false): boolean {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value === 'true' || value === '1';
  }

  set(key: string, value: string): void {
    process.env[key] = value;
  }

  has(key: string): boolean {
    return key in process.env;
  }

  delete(key: string): void {
    delete process.env[key];
  }

  keys(): string[] {
    return Object.keys(process.env);
  }

  all(): Record<string, string> {
    return { ...process.env };
  }

  require(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required env var: ${key}`);
    return value;
  }

  requireInt(key: string): number {
    const value = this.require(key);
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) throw new Error(`Invalid integer env var: ${key}`);
    return parsed;
  }

  requireBool(key: string): boolean {
    const value = this.require(key);
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`Invalid boolean env var: ${key}`);
  }

  isDev(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  isProd(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }
}

export class ConfigPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/config',
    name: 'Configuration',
    version: '1.0.0',
    description: 'Configuration management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['config', 'settings', 'preferences', 'options'],
  };

  public capabilities: PluginCapabilities = {};

  private config: Record<string, unknown> = {};

  load(config: Record<string, unknown>): void {
    this.config = config;
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    const keys = key.split('.');
    let value: unknown = this.config;

    for (const k of keys) {
      if (value === null || value === undefined) return defaultValue;
      value = (value as Record<string, unknown>)[k];
    }

    return (value as T) ?? defaultValue;
  }

  set(key: string, value: unknown): void {
    const keys = key.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    const keys = key.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (current === null || current === undefined) return;
      current = current[keys[i]] as Record<string, unknown>;
    }

    delete current[keys[keys.length - 1]];
  }

  all(): Record<string, unknown> {
    return { ...this.config };
  }

  merge(config: Record<string, unknown>): void {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    this.config = {};
  }

  validate(schema: ConfigSchema): ValidationResult {
    const errors: string[] = [];

    for (const [key, rules] of Object.entries(schema)) {
      const value = this.get(key);

      if (rules.required && value === undefined) {
        errors.push(`Missing required key: ${key}`);
        continue;
      }

      if (value !== undefined) {
        if (rules.type === 'number' && typeof value !== 'number') {
          errors.push(`Key ${key} must be a number`);
        }
        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push(`Key ${key} must be a string`);
        }
        if (rules.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Key ${key} must be a boolean`);
        }
        if (rules.type === 'object' && typeof value !== 'object') {
          errors.push(`Key ${key} must be an object`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object';
    required?: boolean;
    default?: unknown;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class EnvConfigPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/env-config',
    name: 'Env Config',
    version: '1.0.0',
    description: 'Load config from environment',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['config', 'env', 'environment', 'settings'],
  };

  public capabilities: PluginCapabilities = {};

  load(prefix = 'APP_'): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length).toLowerCase();
        config[configKey] = this.parseValue(value || '');
      }
    }

    return config;
  }

  private parseValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;

    const num = parseFloat(value);
    if (!isNaN(num) && value === String(num)) return num;

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      const content = value.slice(1, -1);
      if (!content.trim()) return [];
      return content.split(',').map((s: string) => this.parseValue(s.trim()));
    }

    if (value.startsWith('{') && value.endsWith('}')) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }
}

export class FileWatcherPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/file-watcher',
    name: 'File Watcher',
    version: '1.0.0',
    description: 'Watch files for changes',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['watch', 'file', 'fs', 'chokidar'],
  };

  public capabilities: PluginCapabilities = {};

  private watchers: Map<string, FileWatcher> = new Map();

  watch(path: string, callback: (event: FileEvent) => void, options?: WatchOptions): void {
    this.watchers.set(path, { callback, options: options || {} });
  }

  unwatch(path: string): void {
    this.watchers.delete(path);
  }

  unwatchAll(): void {
    this.watchers.clear();
  }

  getWatched(): string[] {
    return Array.from(this.watchers.keys());
  }

  isWatching(path: string): boolean {
    return this.watchers.has(path);
  }

  trigger(event: FileEvent): void {
    for (const watcher of this.watchers.values()) {
      watcher.callback(event);
    }
  }
}

export interface FileWatcher {
  callback: (event: FileEvent) => void;
  options: WatchOptions;
}

export interface FileEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  timestamp: number;
}

export interface WatchOptions {
  persistent?: boolean;
  ignoreInitial?: boolean;
  followSymlinks?: boolean;
  cwd?: string;
  disableGlobbing?: boolean;
  ignored?: string | string[];
  persistent?: boolean;
}

export class ThrottlePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/throttle',
    name: 'Throttle',
    version: '1.0.0',
    description: 'Throttle multiple watchers',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['throttle', 'batch', 'debounce', 'rate'],
  };

  public capabilities: PluginCapabilities = {};

  create(): Throttle {
    return new Throttle();
  }
}

export class Throttle {
  private queue: Array<() => void> = [];
  private running = false;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  add(fn: () => void): void {
    this.queue.push(fn);
    if (!this.running) {
      this.run();
    }
  }

  private run(): void {
    this.running = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      try {
        fn();
      } catch (e) {
        console.error('Throttle error:', e);
      }
    }

    this.running = false;
  }

  clear(): void {
    this.queue = [];
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  size(): number {
    return this.queue.length;
  }
}

export class BatchPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/batch',
    name: 'Batch',
    version: '1.0.0',
    description: 'Batch operations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['batch', 'bulk', 'group', 'aggregate'],
  };

  public capabilities: PluginCapabilities = {};

  create<T>(processor: (items: T[]) => void, options?: BatchOptions): BatchProcessor<T> {
    return new BatchProcessor(processor, options);
  }
}

export class BatchProcessor<T> {
  private buffer: T[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private processor: (items: T[]) => void,
    private options: BatchOptions = {}
  ) {}

  add(item: T): void {
    this.buffer.push(item);

    if (this.buffer.length >= (this.options.batchSize || 100)) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.options.flushInterval || 1000);
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length > 0) {
      const items = [...this.buffer];
      this.buffer = [];
      this.processor(items);
    }
  }

  size(): number {
    return this.buffer.length;
  }
}

export interface BatchOptions {
  batchSize?: number;
  flushInterval?: number;
}

export class RetryPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/retry',
    name: 'Retry',
    version: '1.0.0',
    description: 'Retry failed operations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['retry', 'attempt', 'error', 'handler'],
  };

  public capabilities: PluginCapabilities = {};

  async retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      attempts = 3,
      delay = 1000,
      backoff = 2,
      onRetry
    } = options;

    let lastError: Error | undefined;

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e as Error;

        if (i < attempts - 1) {
          const waitTime = delay * Math.pow(backoff, i);
          if (onRetry) onRetry(i + 1, lastError, waitTime);
          await this.sleep(waitTime);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  exponential(attempt: number, base = 1000): number {
    return base * Math.pow(2, attempt - 1);
  }

  linear(attempt: number, base = 1000): number {
    return base * attempt;
  }

  constant(attempt: number, delay = 1000): number {
    return delay;
  }
}

export interface RetryOptions {
  attempts?: number;
  delay?: number;
  backoff?: number;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

export class CircuitBreakerPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/circuit-breaker',
    name: 'Circuit Breaker',
    version: '1.0.0',
    description: 'Circuit breaker pattern',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['circuit', 'breaker', 'fallback', 'resilience'],
  };

  public capabilities: PluginCapabilities = {};

  create(fn: () => Promise<unknown>, options?: CircuitOptions): CircuitBreaker {
    return new CircuitBreaker(fn, options);
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureTime = 0;

  constructor(
    private fn: () => Promise<unknown>,
    private options: CircuitOptions = {}
  ) {}

  async execute(): Promise<unknown> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= (this.options.resetTimeout || 30000)) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await this.fn();
      this.onSuccess();
      return result;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= (this.options.failureThreshold || 5)) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}

export interface CircuitOptions {
  failureThreshold?: number;
  resetTimeout?: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class FallbackPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/fallback',
    name: 'Fallback',
    version: '1.0.0',
    description: 'Fallback values',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['fallback', 'default', 'value', 'optional'],
  };

  public capabilities: PluginCapabilities = {};

  value<T>(value: T | null | undefined, fallback: T): T {
    return value ?? fallback;
  }

  async promise<T>(
    fn: () => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  object<T extends Record<string, unknown>>(
    obj: T,
    defaults: Partial<T>
  ): T {
    return { ...defaults, ...obj };
  }

  array<T>(arr: T[], fallback: T[]): T[] {
    return arr.length > 0 ? arr : fallback;
  }

  string(str: string, fallback: string): string {
    return str || fallback;
  }

  number(num: number | null | undefined, fallback: number): number {
    return num ?? fallback;
  }
}