export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export class RetryableError extends Error {
  readonly attempt: number;
  readonly originalError: Error;

  constructor(message: string, attempt: number, originalError: Error) {
    super(message);
    this.name = 'RetryableError';
    this.attempt = attempt;
    this.originalError = originalError;
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
    onRetry = defaultOnRetry,
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      onRetry(attempt, error);
      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

function defaultShouldRetry(error: any): boolean {
  if (error instanceof RetryableError) return true;
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') return true;
  if (error?.statusCode === 429 || error?.statusCode >= 500) return true;
  const message = error?.message?.toLowerCase() || '';
  if (message.includes('timeout') || message.includes('rate limit')) return true;
  return false;
}

function defaultOnRetry(attempt: number, error: any): void {
  console.log(`Retry attempt ${attempt} after error: ${error.message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): () => Promise<T> {
  return () => retry(fn, options);
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
}

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
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

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = 'CLOSED';
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
  }
}

export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
}

export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: RateLimitOptions = {}) {
    this.maxRequests = options.maxRequests || 60;
    this.windowMs = options.windowMs || 60000;
  }

  async acquire(): Promise<boolean> {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  async waitForSlot(): Promise<void> {
    while (!(await this.acquire())) {
      await sleep(100);
    }
  }

  getRemaining(): number {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  getResetTime(): number {
    if (this.requests.length === 0) return 0;
    const oldest = Math.min(...this.requests);
    return oldest + this.windowMs;
  }

  reset(): void {
    this.requests = [];
  }
}

export class MultiLimiter {
  private limiters: Map<string, RateLimiter> = new Map();

  limiter(key: string, options?: RateLimitOptions): RateLimiter {
    if (!this.limiters.has(key)) {
      this.limiters.set(key, new RateLimiter(options));
    }
    return this.limiters.get(key)!;
  }

  async acquire(key: string, options?: RateLimitOptions): Promise<boolean> {
    return this.limiter(key, options).acquire();
  }

  reset(key?: string): void {
    if (key) {
      this.limiters.get(key)?.reset();
    } else {
      for (const limiter of this.limiters.values()) {
        limiter.reset();
      }
    }
  }
}

export class Queue<T> {
  private items: T[] = [];
  private processing = false;
  private readonly concurrency: number;

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }

  async enqueue(item: T): Promise<void> {
    this.items.push(item);
    if (!this.processing) {
      this.process();
    }
  }

  async enqueueBulk(items: T[]): Promise<void> {
    this.items.push(...items);
    if (!this.processing) {
      this.process();
    }
  }

  private async process(): Promise<void> {
    this.processing = true;

    while (this.items.length > 0) {
      const batch = this.items.splice(0, this.concurrency);
      await Promise.all(batch.map(item => this.processItem(item)));
    }

    this.processing = false;
  }

  private async processItem(item: T): Promise<void> {
    // Override in subclass
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }
}

export class Debouncer {
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly wait: number;

  constructor(wait: number) {
    this.wait = wait;
  }

  debounce<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      this.timeoutId = setTimeout(() => fn(...args), this.wait);
    }) as T;
  }

  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export class Throttler {
  private lastRun = 0;
  private readonly delay: number;

  constructor(delay: number) {
    this.delay = delay;
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T | undefined> {
    const now = Date.now();
    const timeSinceLastRun = now - this.lastRun;

    if (timeSinceLastRun < this.delay) {
      await sleep(this.delay - timeSinceLastRun);
    }

    this.lastRun = Date.now();
    return fn();
  }

  canRun(): boolean {
    return Date.now() - this.lastRun >= this.delay;
  }
}

export class LRU<K, V> {
  private cache: Map<K, V> = new Map();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  values(): V[] {
    return Array.from(this.cache.values());
  }
}