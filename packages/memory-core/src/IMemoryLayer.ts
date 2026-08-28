// ── @timps/memory-core — IMemoryLayer ──
// Unified interface for all memory implementations to fix the 3-implementation drift problem.
// memory-core is canonical; timps-code/src/memory/ and packages/server/memory/ become thin adapters.

import type { Provenance } from './ProvenanceForge.js';

export type LayerId =
  | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9'
  | 'L10' | 'L11' | 'L12' | 'L13' | 'L14' | 'L15' | 'L16' | 'L17'
  | 'L18' | 'L19' | 'L20' | 'L21' | 'L22';

export interface MemoryEntry {
  id: string;
  layerId: LayerId;
  timestamp: number;
  content: string;
  tags: string[];
  confidence: number;
  evidenceCount: number;
  sourceDiversity: number;
}

export interface MemoryQuery {
  text: string;
  layerIds?: LayerId[];
  limit?: number;
  minConfidence?: number;
  tags?: string[];
}

export interface MemoryRetrievalResult {
  entry: MemoryEntry;
  score: number;
  provenance: Provenance | null;
}

export interface VerificationEvidence {
  verifierId: string;
  verifiedAt: number;
  outcome: 'confirmed' | 'contradicted' | 'uncertain';
  detail: string;
}

export interface AuditReport {
  totalEntries: number;
  weak: number;
  contradicted: number;
  outdated: number;
  unsourced: number;
  layerBreakdown: Record<string, number>;
  timestamp: number;
}

export interface IMemoryLayer {
  store(layer: LayerId, entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<string>;
  retrieve(layer: LayerId, query: MemoryQuery): Promise<MemoryRetrievalResult[]>;
  verify(entryId: string, evidence: VerificationEvidence): Promise<void>;
  contradict(entryId: string, counterEntryId: string): Promise<void>;
  archive(entryId: string, reason: string): Promise<void>;
  getProvenance(entryId: string): Promise<Provenance | null>;
  explain(entryId: string): Promise<string>;
  audit(): Promise<AuditReport>;
  decay(): Promise<number>;
}
