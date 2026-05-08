import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class FinalPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/final',
    name: 'Final Utils',
    version: '1.0.0',
    description: 'Final utility plugins for Phase 2 completion',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['final', 'utils', 'helpers', 'misc'],
  };

  public capabilities: PluginCapabilities = {};

  identity<T>(value: T): T {
    return value;
  }

  constant<T>(value: T): () => T {
    return () => value;
  }

  noop(): void {}

  always<T>(value: T): () => T {
    return () => value;
  }

  equals<T>(a: T, b: T): boolean {
    return a === b;
  }

  concat<T>(a: T[], b: T[]): T[] {
    return [...a, ...b];
  }

  once<T extends (...args: unknown[]) => unknown>(fn: T): T {
    let called = false;
    let result: unknown;
    return ((...args: unknown[]) => {
      if (!called) {
        result = fn(...args);
        called = true;
      }
      return result;
    }) as T;
  }

  memoize<T extends (...args: unknown[]) => unknown>(fn: T): T {
    const cache = new Map();
    return ((...args: unknown[]) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }

  curry<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return fn;
  }

  partial<T extends (...args: unknown[]) => unknown>(fn: T, ...args: unknown[]): T {
    return fn;
  }

  flip<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return fn;
  }

  compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
    return (arg: T) => fns.reduceRight((acc, fn) => fn(acc), arg);
  }

  pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
    return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
  }

  converge<T>(after: (...args: unknown[]) => T, fns: Array<(...args: unknown[]) => unknown>): (...args: unknown[]) => T {
    return (...args: unknown[]) => after(...fns.map(fn => fn(...args)));
  }

  juxt<T>(...fns: Array<(arg: unknown) => T>): (arg: unknown) => T[] {
    return (arg: unknown) => fns.map(fn => fn(arg));
  }

  complement<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return ((...args: unknown[]) => !fn(...args)) as T;
  }

  anyPass<T extends (...args: unknown[]) => boolean>(fns: T[]): T {
    return ((...args: unknown[]) => fns.some(fn => fn(...args))) as T;
  }

  allPass<T extends (...args: unknown[]) => boolean>(fns: T[]): T {
    return ((...args: unknown[]) => fns.every(fn => fn(...args))) as T;
  }

  cond<T extends (...args: unknown[]) => unknown>(pairs: Array<[(...args: unknown[]) => boolean, T]>): T {
    return ((...args: unknown[]) => {
      for (const [pred, fn] of pairs) {
        if (pred(...args)) return fn(...args);
      }
      return undefined;
    }) as T;
  }

  ifElse<T extends (...args: unknown[]) => unknown>(pred: (...args: unknown[]) => boolean, onTrue: T, onFalse: T): T {
    return ((...args: unknown[]) => pred(...args) ? onTrue(...args) : onFalse(...args)) as T;
  }

  when<T extends (...args: unknown[]) => unknown>(pred: (...args: unknown[]) => boolean, fn: T): T {
    return ((...args: unknown[]) => {
      if (pred(...args)) return fn(...args);
      return undefined;
    }) as T;
  }

  unless<T extends (...args: unknown[]) => unknown>(pred: (...args: unknown[]) => boolean, fn: T): T {
    return ((...args: unknown[]) => {
      if (!pred(...args)) return fn(...args);
      return undefined;
    }) as T;
  }
}

export class TypeUtilsPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/type-utils',
    name: 'Type Utils',
    version: '1.0.0',
    description: 'Type checking utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['type', 'check', 'is', 'typeof'],
  };

  public capabilities: PluginCapabilities = {};

  isFunction(value: unknown): value is Function {
    return typeof value === 'function';
  }

  isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
  }

  isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  }

  isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  isNull(value: unknown): value is null {
    return value === null;
  }

  isUndefined(value: unknown): value is undefined {
    return value === undefined;
  }

  isNil(value: unknown): value is null | undefined {
    return value === null || value === undefined;
  }

  isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value as object).length === 0;
    return false;
  }

  isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => this.isEqual(val, b[i]));
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a as object);
      const keysB = Object.keys(b as object);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => this.isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
    }
    return false;
  }
}