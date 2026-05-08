import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class CronPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/cron',
    name: 'Cron Scheduler',
    version: '1.0.0',
    description: 'Cron job scheduling',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['cron', 'scheduler', 'jobs'],
  };

  public capabilities: PluginCapabilities = {
    api: { notifications: true },
  };

  private jobs: Map<string, {
    id: string;
    cron: string;
    action: () => void | Promise<void>;
    enabled: boolean;
    lastRun?: number;
    nextRun?: number;
    runCount: number;
  }> = new Map();

  registerJob(options: {
    id: string;
    cron: string;
    action: () => void | Promise<void>;
  }): void {
    this.jobs.set(options.id, {
      ...options,
      enabled: true,
      runCount: 0,
    });
  }

  async unregisterJob(id: string): Promise<void> {
    this.jobs.delete(id);
  }

  async enableJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      this.jobs.set(id, { ...job, enabled: true });
    }
  }

  async disableJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      this.jobs.set(id, { ...job, enabled: false });
    }
  }

  async getJobs(): Promise<Array<{ id: string; cron: string; enabled: boolean; runCount: number; nextRun?: number }>> {
    return Array.from(this.jobs.values()).map(j => ({
      id: j.id,
      cron: j.cron,
      enabled: j.enabled,
      runCount: j.runCount,
      nextRun: j.nextRun,
    }));
  }

  async getJob(id: string): Promise<{ cron: string; enabled: boolean; runCount: number } | null> {
    const job = this.jobs.get(id);
    if (!job) return null;
    return {
      cron: job.cron,
      enabled: job.enabled,
      runCount: job.runCount,
    };
  }

  async runNow(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (job?.enabled) {
      await job.action();
      job.runCount++;
      job.lastRun = Date.now();
    }
  }

  parseCron(cron: string): { next: Date | null; interval: number } {
    return { next: new Date(), interval: 60000 };
  }
}

export class QueuePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/queue',
    name: 'Task Queue',
    version: '1.0.0',
    description: 'Async task queue',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['queue', 'async', 'worker'],
  };

  public capabilities: PluginCapabilities = {};

  private queue: Array<{
    id: string;
    task: () => Promise<unknown>;
    priority: number;
    retries: number;
    maxRetries: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }> = [];

  private running = 0;
  private maxConcurrent = 3;

  async enqueue(task: () => Promise<unknown>, options?: {
    priority?: number;
    maxRetries?: number;
  }): Promise<string> {
    const id = `task-${Date.now()}`;
    this.queue.push({
      id,
      task,
      priority: options?.priority ?? 0,
      retries: 0,
      maxRetries: options?.maxRetries ?? 3,
      status: 'pending',
    });
    this.queue.sort((a, b) => b.priority - a.priority);
    return id;
  }

  async dequeue(): Promise<{
    id: string;
    task: () => Promise<unknown>;
  } | null> {
    if (this.running >= this.maxConcurrent) return null;
    const item = this.queue.find(t => t.status === 'pending');
    if (!item) return null;
    item.status = 'running';
    this.running++;
    return { id: item.id, task: item.task };
  }

  async complete(id: string, result?: unknown): Promise<void> {
    const item = this.queue.find(t => t.id === id);
    if (item) {
      item.status = 'completed';
      this.running--;
    }
  }

  async fail(id: string, error?: Error): Promise<void> {
    const item = this.queue.find(t => t.id === id);
    if (item) {
      item.retries++;
      if (item.retries < item.maxRetries) {
        item.status = 'pending';
      } else {
        item.status = 'failed';
      }
      this.running--;
    }
  }

  async getStatus(): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    return {
      pending: this.queue.filter(t => t.status === 'pending').length,
      running: this.running,
      completed: this.queue.filter(t => t.status === 'completed').length,
      failed: this.queue.filter(t => t.status === 'failed').length,
    };
  }

  async clear(): Promise<void> {
    this.queue = [];
    this.running = 0;
  }

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
  }
}

export class CachePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/cache',
    name: 'Cache Manager',
    version: '1.0.0',
    description: 'In-memory caching',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['cache', 'memory', 'performance'],
  };

  public capabilities: PluginCapabilities = {
    data: { cache: true },
  };

  private cache: Map<string, {
    value: unknown;
    expires: number;
    hits: number;
  }> = new Map();

  private maxSize = 100;
  private ttl = 300000;

  set(key: string, value: unknown, ttl?: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl || this.ttl),
      hits: 0,
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    item.hits++;
    return item.value as T;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): {
    size: number;
    hits: number;
    avgHitRate: number;
  } {
    let totalHits = 0;
    for (const item of this.cache.values()) {
      totalHits += item.hits;
    }
    return {
      size: this.cache.size,
      hits: totalHits,
      avgHitRate: totalHits / Math.max(1, this.cache.size),
    };
  }

  configure(options: { maxSize?: number; defaultTTL?: number }): void {
    if (options.maxSize) this.maxSize = options.maxSize;
    if (options.defaultTTL) this.ttl = options.defaultTTL;
  }
}

export class CacheInvalidationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/cache-invalidator',
    name: 'Cache Invalidation',
    version: '1.0.0',
    description: 'Smart cache invalidation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['cache', 'invalidation', 'smart'],
  };

  public capabilities: PluginCapabilities = {
    data: { cache: true },
  };

  private patterns: Map<string, RegExp> = new Map();
  private taggedKeys: Map<string, Set<string>> = new Map();

  registerPattern(pattern: string, regex: RegExp): void {
    this.patterns.set(pattern, regex);
  }

  invalidateByPattern(pattern: string): string[] {
    const regex = this.patterns.get(pattern);
    if (!regex) return [];

    const invalidated: string[] = [];
    for (const key of regex.keys()) {
      invalidated.push(key);
    }
    return invalidated;
  }

  tag(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.taggedKeys.has(tag)) {
        this.taggedKeys.set(tag, new Set());
      }
      this.taggedKeys.get(tag)!.add(key);
    }
  }

  invalidateByTag(tag: string): string[] {
    const keys = this.taggedKeys.get(tag);
    if (!keys) return [];
    return Array.from(keys);
  }

  invalidateAll(): number {
    const count = this.taggedKeys.size;
    this.taggedKeys.clear();
    return count;
  }
}

export class LRUCachePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/lru-cache',
    name: 'LRU Cache',
    version: '1.0.0',
    description: 'Least Recently Used cache',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['lru', 'cache', 'performance'],
  };

  public capabilities: PluginCapabilities = {
    data: { cache: true },
  };

  private cache: Map<string, unknown> = new Map();
  private accessOrder: string[] = [];
  private maxSize = 100;

  set(key: string, value: unknown): void {
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    } else if (this.cache.size >= this.maxSize) {
      const lru = this.accessOrder.shift();
      if (lru) this.cache.delete(lru);
    }
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  get<T>(key: string): T | null {
    if (!this.cache.has(key)) return null;
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
    return this.cache.get(key) as T;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  getSize(): number {
    return this.cache.size;
  }

  setMaxSize(size: number): void {
    this.maxSize = size;
  }
}

export class TTLPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/ttl-cache',
    name: 'TTL Cache',
    version: '1.0.0',
    description: 'Time-to-live cache',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['ttl', 'cache', 'expiration'],
  };

  public capabilities: PluginCapabilities = {
    data: { cache: true },
  };

  private cache: Map<string, {
    value: unknown;
    expires: number;
  }> = new Map();

  set(key: string, value: unknown, ttl: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.value as T;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  getTTL(key: string): number {
    const item = this.cache.get(key);
    if (!item) return 0;
    return Math.max(0, item.expires - Date.now());
  }

  refresh(key: string, ttl: number): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    item.expires = Date.now() + ttl;
    return true;
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, item] of this.cache.entries()) {
      if (item.expires <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

export class MemoPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/memo',
    name: 'Memoization',
    version: '1.0.0',
    description: 'Function memoization',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['memo', 'cache', 'optimization'],
  };

  public capabilities: PluginCapabilities = {
    data: { cache: true },
  };

  memoize<T extends (...args: unknown[]) => unknown>(
    fn: T,
    options?: {
      ttl?: number;
      maxSize?: number;
    }
  ): T {
    const cache = new Map<string, { result: unknown; expires: number }>();

    return ((...args: unknown[]) => {
      const key = JSON.stringify(args);
      const cached = cache.get(key);

      if (cached && cached.expires > Date.now()) {
        return cached.result;
      }

      const result = fn(...args);
      cache.set(key, {
        result,
        expires: Date.now() + (options?.ttl || 60000),
      });

      if (options?.maxSize && cache.size > options.maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      return result;
    }) as T;
  }

  async memoizeAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    options?: { ttl?: number }
  ): Promise<T> {
    return this.memoize(fn, options) as T;
  }
}

export class ThrottlePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/throttle',
    name: 'Throttler',
    version: '1.0.0',
    description: 'Function throttling',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['throttle', 'rate-limit', 'performance'],
  };

  public capabilities: PluginCapabilities = {};

  throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;

    return (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastCall >= delay) {
        fn(...args);
        lastCall = now;
      } else {
        lastArgs = args;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (lastArgs) {
            fn(...lastArgs);
            lastCall = Date.now();
          }
        }, delay - (now - lastCall));
      }
    };
  }

  debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }
}

export class PoolPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/pool',
    name: 'Connection Pool',
    version: '1.0.0',
    description: 'Resource connection pooling',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['pool', 'connection', 'resources'],
  };

  public capabilities: PluginCapabilities = {};

  private pool: unknown[] = [];
  private inUse: Set<unknown> = new Set();
  private maxSize = 10;

  async acquire(): Promise<unknown> {
    if (this.pool.length > 0) {
      const resource = this.pool.pop()!;
      this.inUse.add(resource);
      return resource;
    }
    if (this.inUse.size < this.maxSize) {
      const resource = {};
      this.inUse.add(resource);
      return resource;
    }
    throw new Error('Pool exhausted');
  }

  async release(resource: unknown): Promise<void> {
    if (this.inUse.has(resource)) {
      this.inUse.delete(resource);
      this.pool.push(resource);
    }
  }

  async drain(): Promise<void> {
    this.pool = [];
    this.inUse.clear();
  }

  getStats(): {
    available: number;
    inUse: number;
    maxSize: number;
  } {
    return {
      available: this.pool.length,
      inUse: this.inUse.size,
      maxSize: this.maxSize,
    };
  }

  setMaxSize(size: number): void {
    this.maxSize = size;
  }
}

export class BatchPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/batch',
    name: 'Batch Processor',
    version: '1.0.0',
    description: 'Batch processing',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['batch', 'processing', 'bulk'],
  };

  public capabilities: PluginCapabilities = {};

  async batch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: {
      batchSize?: number;
      concurrency?: number;
    }
  ): Promise<R[]> {
    const batchSize = options?.batchSize || 10;
    const concurrency = options?.concurrency || 3;
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const promises = batch.slice(0, concurrency).map(item => processor(item));
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  async batchParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item).then(r => results.push(r));
      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => {
            p.then(() => true).catch(() => true);
            return true;
          }),
          1
        );
      }
    }

    await Promise.all(executing);
    return results;
  }
}

export class RetryPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/retry',
    name: 'Retry Handler',
    version: '1.0.0',
    description: 'Automatic retry with backoff',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['retry', 'backoff', 'resilience'],
  };

  public capabilities: PluginCapabilities = {};

  async retry<T>(
    fn: () => Promise<T>,
    options?: {
      maxAttempts?: number;
      delay?: number;
      backoff?: 'linear' | 'exponential';
      onRetry?: (attempt: number, error: Error) => void;
    }
  ): Promise<T> {
    const maxAttempts = options?.maxAttempts || 3;
    const delay = options?.delay || 1000;
    const backoff = options?.backoff || 'exponential';

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts) {
          const waitTime = backoff === 'exponential'
            ? delay * Math.pow(2, attempt - 1)
            : delay * attempt;

          options?.onRetry?.(attempt, lastError);
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
    }

    throw lastError;
  }
}

export class CircuitBreakerPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/circuit-breaker',
    name: 'Circuit Breaker',
    version: '1.0.0',
    description: 'Circuit breaker pattern',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['circuit-breaker', 'resilience', 'fault-tolerance'],
  };

  public capabilities: PluginCapabilities = {};

  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;

  private threshold = 5;
  private timeout = 30000;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        this.successes = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successes++;

    if (this.state === 'half-open' && this.successes >= 2) {
      this.state = 'closed';
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
  }

  configure(options: { threshold?: number; timeout?: number }): void {
    if (options.threshold) this.threshold = options.threshold;
    if (options.timeout) this.timeout = options.timeout;
  }
}

export class RateLimiterPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/rate-limiter',
    name: 'Rate Limiter',
    version: '1.0.0',
    description: 'Token bucket rate limiting',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['rate-limiter', 'token-bucket', 'throttling'],
  };

  public capabilities: PluginCapabilities = {};

  private tokens = new Map<string, {
    tokens: number;
    lastRefill: number;
  }>();

  private refillRate = 10;
  private capacity = 10;

  async tryConsume(key: string, cost = 1): Promise<boolean> {
    const now = Date.now();
    const bucket = this.tokens.get(key);

    if (!bucket) {
      this.tokens.set(key, {
        tokens: this.capacity - cost,
        lastRefill: now,
      });
      return true;
    }

    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / 1000) * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }

    return false;
  }

  async refill(key: string): Promise<void> {
    const bucket = this.tokens.get(key);
    if (bucket) {
      bucket.tokens = this.capacity;
      bucket.lastRefill = Date.now();
    }
  }

  async reset(key: string): Promise<void> {
    this.tokens.delete(key);
  }

  getTokens(key: string): number {
    return this.tokens.get(key)?.tokens || this.capacity;
  }

  configure(options: { refillRate?: number; capacity?: number }): void {
    if (options.refillRate) this.refillRate = options.refillRate;
    if (options.capacity) this.capacity = options.capacity;
  }
}

export class BulkheadPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/bulkhead',
    name: 'Bulkhead',
    version: '1.0.0',
    description: 'Bulkhead isolation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['bulkhead', 'isolation', 'fault-tolerance'],
  };

  public capabilities: PluginCapabilities = {};

  private running = 0;
  private queue: Array<() => void> = [];
  private maxConcurrent = 10;
  private maxQueue = 20;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      try {
        return await fn();
      } finally {
        this.running--;
        this.processQueue();
      }
    }

    if (this.queue.length < this.maxQueue) {
      return new Promise((resolve, reject) => {
        this.queue.push(async () => {
          try {
            resolve(await fn());
          } catch (error) {
            reject(error);
          } finally {
            this.running--;
            this.processQueue();
          }
        });
      });
    }

    throw new Error('Bulkhead rejection');
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) {
        this.running++;
        next();
      }
    }
  }

  getStats(): {
    running: number;
    queued: number;
    available: number;
  } {
    return {
      running: this.running,
      queued: this.queue.length,
      available: this.maxConcurrent - this.running,
    };
  }

  configure(options: { maxConcurrent?: number; maxQueue?: number }): void {
    if (options.maxConcurrent) this.maxConcurrent = options.maxConcurrent;
    if (options.maxQueue) this.maxQueue = options.maxQueue;
  }
}

export class TimeoutPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/timeout',
    name: 'Timeout Handler',
    version: '1.0.0',
    description: 'Function timeout handling',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['timeout', 'async', 'cancellation'],
  };

  public capabilities: PluginCapabilities = {};

  async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  async withCancellation<T>(
    fn: () => Promise<T>,
    signal: AbortSignal
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Cancelled')));

      fn()
        .then(resolve)
        .catch(reject);
    });
  }
}

export class DeadLetterQueuePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/dead-letter',
    name: 'Dead Letter Queue',
    version: '1.0.0',
    description: 'Failed message handling',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['dlq', 'dead-letter', 'failed-messages'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  private dlq: Array<{
    id: string;
    payload: unknown;
    error: string;
    attempts: number;
    timestamp: number;
  }> = [];

  async add(message: unknown, error: Error): Promise<string> {
    const id = `dlq-${Date.now()}`;
    this.dlq.push({
      id,
      payload: message,
      error: error.message,
      attempts: 1,
      timestamp: Date.now(),
    });
    return id;
  }

  async retry(id: string, processor: (payload: unknown) => Promise<void>): Promise<void> {
    const item = this.dlq.find(d => d.id === id);
    if (!item) return;

    try {
      await processor(item.payload);
      this.dlq = this.dlq.filter(d => d.id !== id);
    } catch (error) {
      item.attempts++;
      item.error = (error as Error).message;
    }
  }

  async getAll(): Promise<Array<{
    id: string;
    error: string;
    attempts: number;
    timestamp: number;
  }>> {
    return this.dlq.map(d => ({
      id: d.id,
      error: d.error,
      attempts: d.attempts,
      timestamp: d.timestamp,
    }));
  }

  async clear(): Promise<void> {
    this.dlq = [];
  }
}

export const cronPlugin = new CronPlugin();
export const queuePlugin = new QueuePlugin();
export const cachePlugin = new CachePlugin();
export const cacheInvalidationPlugin = new CacheInvalidationPlugin();
export const lruCachePlugin = new LRUCachePlugin();
export const ttlPlugin = new TTLPlugin();
export const memoPlugin = new MemoPlugin();
export const throttlePlugin = new ThrottlePlugin();
export const poolPlugin = new PoolPlugin();
export const batchPlugin = new BatchPlugin();
export const retryPlugin = new RetryPlugin();
export const circuitBreakerPlugin = new CircuitBreakerPlugin();
export const rateLimiterPlugin = new RateLimiterPlugin();
export const bulkheadPlugin = new BulkheadPlugin();
export const timeoutPlugin = new TimeoutPlugin();
export const deadLetterQueuePlugin = new DeadLetterQueuePlugin();

export function registerResiliencePlugins(): Plugin[] {
  return [
    cronPlugin,
    queuePlugin,
    cachePlugin,
    cacheInvalidationPlugin,
    lruCachePlugin,
    ttlPlugin,
    memoPlugin,
    throttlePlugin,
    poolPlugin,
    batchPlugin,
    retryPlugin,
    circuitBreakerPlugin,
    rateLimiterPlugin,
    bulkheadPlugin,
    timeoutPlugin,
    deadLetterQueuePlugin,
  ];
}