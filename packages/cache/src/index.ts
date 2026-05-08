export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  staleWhileRevalidate?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  expiry: number;
  stale?: boolean;
}

export class MemoryCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly defaultTtl: number;
  private readonly maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.defaultTtl = options.ttl || 60000;
    this.maxSize = options.maxSize || 1000;
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now > entry.expiry && !entry.stale) {
      this.cache.delete(key);
      return undefined;
    }

    if (now > entry.expiry && entry.stale) {
      return undefined;
    }

    return entry.value;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expiry = Date.now() + (ttl || this.defaultTtl);
    this.cache.set(key, { value, expiry });
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() <= entry.expiry;
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async values(): Promise<T[]> {
    return Array.from(this.cache.values()).map(e => e.value);
  }

  async mget(keys: string[]): Promise<(T | undefined)[]> {
    return Promise.all(keys.map(key => this.get(key)));
  }

  async mset(entries: [string, T][], ttl?: number): Promise<void> {
    await Promise.all(entries.map(([key, value]) => this.set(key, value, ttl)));
  }
}

export class DiskCache<T = any> {
  private cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
  }

  async get(key: string): Promise<T | undefined> {
    return undefined;
  }

  async set(key: string, value: T): Promise<void> {
    // Implement with fs
  }

  async delete(key: string): Promise<boolean> {
    return false;
  }

  async clear(): Promise<void> {}
}

export class MultiCache<T = any> {
  private memory: MemoryCache<T>;
  private disk?: DiskCache<T>;

  constructor(options: CacheOptions = {}) {
    this.memory = new MemoryCache(options);

    if (options['diskPath']) {
      this.disk = new DiskCache(options['diskPath'] as string);
    }
  }

  async get(key: string): Promise<T | undefined> {
    const value = await this.memory.get(key);
    if (value !== undefined) return value;

    if (this.disk) {
      return this.disk.get(key);
    }

    return undefined;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    await this.memory.set(key, value, ttl);

    if (this.disk) {
      await this.disk.set(key, value);
    }
  }

  async delete(key: string): Promise<boolean> {
    await this.memory.delete(key);

    if (this.disk) {
      return this.disk.delete(key);
    }

    return true;
  }

  async clear(): Promise<void> {
    await this.memory.clear();

    if (this.disk) {
      await this.disk.clear();
    }
  }
}

export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: CacheOptions = {}
): T & { clear: () => void } {
  const cache = new MemoryCache({ maxSize: options.maxSize || 100 });

  const memoized = ((...args: any[]) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T & { clear: () => void };

  memoized.clear = () => cache.clear();

  return memoized;
}

export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CacheOptions = {}
): T & { clear: () => void } {
  const cache = new MemoryCache({ maxSize: options.maxSize || 100 });

  const memoized = (async (...args: any[]) => {
    const key = JSON.stringify(args);
    const cached = await cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = await fn(...args);
    await cache.set(key, result);
    return result;
  }) as T & { clear: () => void };

  memoized.clear = () => cache.clear();

  return memoized;
}

export function cacheWithTTL<T>(ttl: number): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const original = descriptor.get;
    const cache = new Map<any, { value: any; expiry: number }>();

    descriptor.get = function () {
      const cached = cache.get(this);
      if (cached && Date.now() < cached.expiry) {
        return cached.value;
      }

      const value = original!.call(this);
      cache.set(this, { value, expiry: Date.now() + ttl });
      return value;
    };

    return descriptor;
  };
  };
}

export class CacheMiddleware {
  private cache: MemoryCache;

  constructor(options: CacheOptions = {}) {
    this.cache = new MemoryCache(options);
  }

  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fn();
    await this.cache.set(key, value, ttl);
    return value;
  }

  async invalidate(key: string): Promise<void> {
    await this.cache.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.cache.keys();
    const regex = new RegExp(pattern);

    for (const key of keys) {
      if (regex.test(key)) {
        await this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    await this.cache.clear();
  }
}