// ── @timps/memory-core — CRDT Merge Logic ──
// LWW-Register-MV (Last-Writer-Wins Register with Multi-Value)
// Vector clocks for causal ordering, concurrent writes produce conflicts[]

import type { MemoryEntry } from '../types.js';
import type { VectorClock, CrdtStatus } from '../types.js';

/** Increment the clock for a given actor */
export function incrementClock(clock: VectorClock, actorId: string): VectorClock {
  return { ...clock, [actorId]: (clock[actorId] ?? 0) + 1 };
}

/** Element-wise max of two vector clocks */
export function mergeClocks(a: VectorClock, b: VectorClock): VectorClock {
  const result: VectorClock = { ...a };
  for (const [key, val] of Object.entries(b)) {
    result[key] = Math.max(result[key] ?? 0, val);
  }
  return result;
}

/** Compare two clocks. Returns 'before' if a is strictly less, 'after' if strictly greater, 'concurrent' if incomparable, 'equal' if same. */
export function compareClocks(
  a: VectorClock, b: VectorClock,
): 'before' | 'after' | 'concurrent' | 'equal' {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aLess = true, bLess = true;
  for (const key of allKeys) {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    if (va > vb) bLess = false;
    if (vb > va) aLess = false;
  }
  if (aLess && bLess) return 'equal';
  if (aLess) return 'before';
  if (bLess) return 'after';
  return 'concurrent';
}

/**
 * Merge two MemoryEntry objects using LWW-Register-MV semantics.
 * If one dominates (causal order), the winner is kept.
 * If concurrent, both are stored as conflicting entries.
 */
export function mergeEntries(
  existing: MemoryEntry,
  incoming: MemoryEntry,
): { merged: MemoryEntry; hasConflict: boolean } {
  const existingClock = existing.vectorClock ?? {};
  const incomingClock = incoming.vectorClock ?? {};
  const cmp = compareClocks(existingClock, incomingClock);

  if (cmp === 'before') {
    const mergedClock = mergeClocks(existingClock, incomingClock);
    return {
      merged: {
        ...incoming,
        vectorClock: mergedClock,
        crdtStatus: 'active' as CrdtStatus,
        mergedFrom: [...(incoming.mergedFrom ?? []), existing.id],
        conflicts: [],
      },
      hasConflict: false,
    };
  }

  if (cmp === 'after' || cmp === 'equal') {
    return { merged: existing, hasConflict: false };
  }

  // Concurrent writes — conflict!
  return {
    merged: {
      ...existing,
      crdtStatus: 'conflict_pending' as CrdtStatus,
      conflicts: [...(existing.conflicts ?? []), incoming.id],
    },
    hasConflict: true,
  };
}
