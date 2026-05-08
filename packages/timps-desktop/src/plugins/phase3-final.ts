import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class FinalPhase3Plugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/final-phase3',
    name: 'Phase 3 Final Utils',
    version: '1.0.0',
    description: 'Final utilities to complete Phase 3',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['final', 'phase3', 'completion'],
  };

  public capabilities: PluginCapabilities = {};

  identity<T>(value: T): T {
    return value;
  }

  tap<T>(value: T, fn: (val: T) => void): T {
    fn(value);
    return value;
  }

  useWith<T>(fn: (...args: unknown[]) => T, transformer: (fn: (...args: unknown[]) => unknown): T): (...args: unknown[]) => T {
    return (...args: unknown[]) => transformer(fn)(...args);
  }

  attempt<T>(fn: () => T): { success: boolean; value?: T; error?: Error } {
    try {
      return { success: true, value: fn() };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  retry<T>(fn: () => T, attempts: number): T {
    let lastError: Error;
    for (let i = 0; i < attempts; i++) {
      try {
        return fn();
      } catch (e) {
        lastError = e as Error;
      }
    }
    throw lastError;
  }

  until<T>(fn: () => T, condition: (val: T) => boolean): T {
    let value: T;
    do {
      value = fn();
    } while (!condition(value));
    return value;
  }

  allSettled<T>(promises: Promise<T>[]): Promise<Array<{ status: 'fulfilled' | 'rejected'; value?: T; reason?: Error }>> {
    return Promise.allSettled(promises);
  }

  wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  waitFor<T>(promise: Promise<T>): Promise<[T | undefined, Error | undefined]> {
    return promise
      .then(value => [value, undefined] as [T, undefined])
      .catch(error => [undefined, error as Error]);
  }

  debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T {
    let timeout: ReturnType<typeof setTimeout>;
    return ((...args: unknown[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    }) as T;
  }

  throttle<T extends (...args: unknown[]) => unknown>(fn: T, limit: number): T {
    let lastCall = 0;
    return ((...args: unknown[]) => {
      const now = Date.now();
      if (now - lastCall >= limit) {
        lastCall = now;
        return fn(...args);
      }
    }) as T;
  }
}