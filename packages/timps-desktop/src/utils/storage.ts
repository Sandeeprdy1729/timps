/**
 * TIMPS Desktop Storage
 * Local storage wrapper with type safety and error handling.
 */

import { isTauri } from '../utils/index';

interface StorageOptions {
  prefix?: string;
  compress?: boolean;
}

export class Storage {
  private prefix: string;

  constructor(options: StorageOptions = {}) {
    this.prefix = options.prefix || 'timps';
  }

  private key(key: string): string {
    return `${this.prefix}:${key}`;
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    try {
      const item = localStorage.getItem(this.key(key));
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.key(key), JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  }

  remove(key: string): void {
    localStorage.removeItem(this.key(key));
  }

  clear(): void {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(this.prefix + ':')) {
        localStorage.removeItem(key);
      }
    }
  }

  keys(): string[] {
    const prefix = this.prefix + ':';
    return Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
  }

  has(key: string): boolean {
    return localStorage.getItem(this.key(key)) !== null;
  }

  size(): number {
    let size = 0;
    for (const key of this.keys()) {
      const item = localStorage.getItem(this.key(key));
      if (item) size += item.length;
    }
    return size;
  }
}

export const storage = new Storage();

// Convenience accessors
export const lastProject = {
  get: () => storage.get<string>('lastProject'),
  set: (value: string) => storage.set('lastProject', value),
};

export const provider = {
  get: () => storage.get<string>('provider', 'ollama'),
  set: (value: string) => storage.set('provider', value),
};

export const theme = {
  get: () => storage.get<string>('theme', 'dark'),
  set: (value: string) => storage.set('theme', value),
};