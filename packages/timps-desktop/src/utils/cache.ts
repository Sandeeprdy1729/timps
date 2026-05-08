/**
 * TIMPS Desktop - Cache
 * In-memory caching utility.
 */

interface CacheEntry<T> {
  value: T;
  expires: number;
}

export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 100, defaultTTL = 300000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set(key: string, value: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl || this.defaultTTL),
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
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
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new Cache<unknown>(50, 60000);
export const apiCache = new Cache<unknown>(100, 300000);