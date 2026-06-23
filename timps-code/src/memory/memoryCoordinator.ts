// ── TIMPS Multi-Agent Memory Coordination ──
// Phase 2d: delegates to memory-core ProjectRoom + CRDT conflict resolution.
// SSE server removed — use gRPC AgentStream + WebSocket for real-time events.

import type { MemoryLease, ConflictEntry } from './types.js';

/**
 * @deprecated Phase 2d: Use memory-core's ProjectRoom + ConflictResolver.
 * MemoryCoordinator is kept for backward compat but delegates to
 * the memory-core gRPC/CRDT infrastructure where available.
 *
 * Legacy SSE pub/sub (port 18437) is removed.
 * Use the MemoryServer WebSocket (port 4100) + gRPC (port 4101) instead.
 */
export class MemoryCoordinator {
  private dir: string;

  constructor(projectPath: string, _port = 18437) {
    this.dir = projectPath;
  }

  // ── Memory Leases (Phase 2d: agents tracked via ProjectRoom) ──

  acquireLease(agentId: string, filePath: string, ttlMs = 300000): { success: boolean; expiresAt: number } {
    // Phase 2d: leases are implicit via ProjectRoom presence.
    // File-level locking is replaced by CRDT merge semantics.
    // Return success by default since conflict resolution handles collisions.
    return { success: true, expiresAt: Date.now() + ttlMs };
  }

  releaseLease(_agentId: string, _filePath: string): void {
    // No-op: leases are ephemeral in Phase 2d
  }

  getHotFiles(_agentId: string): string[] {
    // Phase 2d: use MemoryServer room presence
    return [];
  }

  // ── Conflict Resolution Queue (Phase 2d: CRDT + ResolveConflict API) ──

  enqueueConflict(fact1: string, fact2: string, agentId: string): void {
    // Phase 2d: conflicts are detected synchronously at write time
    // via ContradictionDetector.checkBeforeStore() + CRDT merge.
    // Use the /memory/resolve-conflict REST endpoint or
    // ResolveConflict gRPC RPC instead.
  }

  getPendingConflicts(): ConflictEntry[] {
    // Phase 2d: use GET /memory/conflicts
    return [];
  }

  resolveConflict(_index: number, _resolution: string): void {
    // Phase 2d: use POST /memory/resolve-conflict
  }

  // ── Pub/Sub — REMOVED (Phase 2d) ──
  // Use MemoryServer WebSocket (/ws) + gRPC AgentStream instead.

  startPubSub(): void {
    // No-op: SSE server removed in Phase 2d.
    // Connect via WebSocket (ws://host:4100/ws) or gRPC (host:4101).
  }

  stopPubSub(): void {
    // No-op
  }

  publish(_type: string, _data: unknown): void {
    // No-op: use EventBus or gRPC stream for publishing
  }

  // ── Utility ────────────────────────────────────────────────

  getStats(): { activeLeases: number; pendingConflicts: number; subscriberCount: number } {
    return { activeLeases: 0, pendingConflicts: 0, subscriberCount: 0 };
  }
}