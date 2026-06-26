import type { StorageBackend } from '../backends/types.js';
import type {
  MaterializedView,
  ContradictionViewEntry,
  WorkingMemoryViewEntry,
  VelocityViewEntry,
  DriftViewEntry,
} from './types.js';
import type { MemoryEntry } from '../types.js';

const VIEW_PREFIX = 'views:';

export const CONTRADICTION_VIEW = 'contradictions';
export const WORKING_MEMORY_VIEW = 'working_memory';
export const VELOCITY_VIEW = 'velocity';
export const DRIFT_VIEW = 'drift';

const DEFAULT_TTL: Record<string, number> = {
  [CONTRADICTION_VIEW]: 60_000,
  [WORKING_MEMORY_VIEW]: 30_000,
  [VELOCITY_VIEW]: 120_000,
  [DRIFT_VIEW]: 120_000,
};

export class MaterializedViews {
  private backend: StorageBackend;

  constructor(backend: StorageBackend) {
    this.backend = backend;
  }

  private key(name: string): string {
    return `${VIEW_PREFIX}${name}`;
  }

  async get<T>(name: string): Promise<MaterializedView<T> | null> {
    try {
      const raw = await this.backend.read(this.key(name));
      if (!raw) return null;
      return raw as MaterializedView<T>;
    } catch {
      return null;
    }
  }

  async set<T>(view: MaterializedView<T>): Promise<void> {
    try {
      await this.backend.write(this.key(view.name), view);
    } catch { /* best-effort */ }
  }

  async isStale(name: string, ttlMs?: number): Promise<boolean> {
    const view = await this.get(name);
    if (!view) return true;
    const ttl = ttlMs ?? DEFAULT_TTL[name] ?? 60_000;
    return Date.now() - view.updated > ttl;
  }

  async refresh(name: string, computeFn: () => Promise<unknown[]>, ttlMs?: number): Promise<void> {
    const entries = await computeFn();
    const view: MaterializedView = {
      name,
      updated: Date.now(),
      entries,
      metadata: { count: entries.length },
      ttlMs: ttlMs ?? DEFAULT_TTL[name] ?? 60_000,
    };
    await this.set(view);
  }

  async delete(name: string): Promise<void> {
    try {
      await this.backend.delete(this.key(name));
    } catch { /* best-effort */ }
  }

  async listNames(): Promise<string[]> {
    try {
      const keys = await this.backend.list(VIEW_PREFIX);
      return keys.map(k => k.slice(VIEW_PREFIX.length));
    } catch {
      return [];
    }
  }

  async getContradictions(): Promise<MaterializedView<ContradictionViewEntry> | null> {
    return this.get<ContradictionViewEntry>(CONTRADICTION_VIEW);
  }

  async getWorkingMemory(): Promise<MaterializedView<WorkingMemoryViewEntry> | null> {
    return this.get<WorkingMemoryViewEntry>(WORKING_MEMORY_VIEW);
  }

  async getVelocity(): Promise<MaterializedView<VelocityViewEntry> | null> {
    return this.get<VelocityViewEntry>(VELOCITY_VIEW);
  }

  async getDrift(): Promise<MaterializedView<DriftViewEntry> | null> {
    return this.get<DriftViewEntry>(DRIFT_VIEW);
  }

  async refreshContradictions(
    computeFn: () => Promise<ContradictionViewEntry[]>,
  ): Promise<void> {
    return this.refresh(CONTRADICTION_VIEW, computeFn);
  }

  async refreshWorkingMemory(
    computeFn: () => Promise<WorkingMemoryViewEntry[]>,
  ): Promise<void> {
    return this.refresh(WORKING_MEMORY_VIEW, computeFn);
  }

  async refreshVelocity(
    computeFn: () => Promise<VelocityViewEntry[]>,
  ): Promise<void> {
    return this.refresh(VELOCITY_VIEW, computeFn);
  }

  async refreshDrift(
    computeFn: () => Promise<DriftViewEntry[]>,
  ): Promise<void> {
    return this.refresh(DRIFT_VIEW, computeFn);
  }
}
