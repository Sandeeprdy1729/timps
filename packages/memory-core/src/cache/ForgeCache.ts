// ── @timps/memory-core — Forge State Caching (Phase 4e) ──
// Specialized caching for expensive forge-layer state:
// eigenmodes, decay scores, materialized views, contradiction pairs.
// Longer TTLs than recall cache — forge state changes less frequently.
//
// Forge state cache keys:
//   forge:{orgId}:{projectId}:{forgeName}:{stateType}
//   Example: forge:default:abc123:harmonic:eigenmodes

import type { CacheManager } from './CacheManager.js';
import { L1Cache } from './L1Cache.js';

export type ForgeName = 'echo' | 'chronos' | 'harmonic' | 'aether' | 'contradiction' | 'velocity' | 'drift';
export type ForgeStateType = 'reservoir' | 'eigenmodes' | 'decay_scores' | 'pairs' | 'trend' | 'spectral';

export interface ForgeCacheOptions {
  /** Org scope for key isolation. */
  orgScope?: { orgId?: string; projectId?: string };
  /** L1 default TTL ms (default: 10000 = 10s). */
  l1TTL?: number;
  /** L2 default TTL ms (default: 300000 = 5min). */
  l2TTL?: number;
}

/** Per-forge TTL overrides (milliseconds). */
const FORGE_TTL: Record<string, Record<string, number>> = {
  echo: { reservoir: 60_000, decay_scores: 30_000 },
  harmonic: { eigenmodes: 300_000, spectral: 120_000 },
  aether: { eigenmodes: 300_000 },
  contradiction: { pairs: 60_000 },
  velocity: { trend: 120_000 },
  drift: { trend: 120_000 },
};

export class ForgeCache {
  private l1: L1Cache;
  private l2?: CacheManager;
  private options: ForgeCacheOptions;

  constructor(l2?: CacheManager, options: ForgeCacheOptions = {}) {
    this.l2 = l2;
    this.options = options;
    this.l1 = new L1Cache({
      maxSize: 500,
      defaultTTL: options.l1TTL ?? 10_000,
      staleGrace: 30_000,
    });
  }

  private makeKey(forge: ForgeName, stateType: ForgeStateType): string {
    const scope = this.options.orgScope;
    const org = scope?.orgId ?? 'default';
    const proj = scope?.projectId ?? 'default';
    return `forge:${org}:${proj}:${forge}:${stateType}`;
  }

  private getTTL(forge: ForgeName, stateType: ForgeStateType, defaultTTL: number): number {
    return FORGE_TTL[forge]?.[stateType] ?? defaultTTL;
  }

  /** Get forge state from cache. Returns undefined on miss. */
  async get<T>(forge: ForgeName, stateType: ForgeStateType): Promise<T | undefined> {
    const key = this.makeKey(forge, stateType);
    // L1
    const l1 = this.l1.get(key) as T | undefined;
    if (l1 !== undefined) return l1;
    // L2
    if (this.l2) {
      try {
        const l2 = await this.l2.get<T>(key);
        if (l2 !== null) {
          this.l1.set(key, l2, this.getTTL(forge, stateType, this.options.l1TTL ?? 10_000));
          return l2;
        }
      } catch { /* best-effort */ }
    }
    return undefined;
  }

  /** Set forge state in both L1 and L2. */
  async set<T>(forge: ForgeName, stateType: ForgeStateType, value: T): Promise<void> {
    const key = this.makeKey(forge, stateType);
    const l2TTL = this.getTTL(forge, stateType, this.options.l2TTL ?? 300_000);
    const l1TTL = this.getTTL(forge, stateType, this.options.l1TTL ?? 10_000);
    this.l1.set(key, value, l1TTL);
    if (this.l2) {
      try {
        await this.l2.set(key, value, l2TTL);
      } catch { /* best-effort */ }
    }
  }

  /** Get-or-compute for forge state. */
  async getOrCompute<T>(
    forge: ForgeName,
    stateType: ForgeStateType,
    compute: () => T | Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(forge, stateType);
    if (cached !== undefined) return cached;
    const value = await compute();
    await this.set(forge, stateType, value);
    return value;
  }

  /** Invalidate forge state for a specific forge+type. */
  async invalidate(forge: ForgeName, stateType: ForgeStateType): Promise<void> {
    const key = this.makeKey(forge, stateType);
    this.l1.invalidate(key);
    if (this.l2) {
      try {
        await this.l2.invalidate(key);
      } catch { /* best-effort */ }
    }
  }

  /** Invalidate all forge state for a project. */
  async invalidateProject(): Promise<void> {
    const scope = this.options.orgScope;
    const org = scope?.orgId ?? 'default';
    this.l1.invalidatePattern(`forge:${org}:`);
    if (this.l2) {
      try {
        await this.l2.invalidatePattern(`forge:${org}:*`);
      } catch { /* best-effort */ }
    }
  }
}
