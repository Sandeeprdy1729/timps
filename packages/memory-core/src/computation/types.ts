import type { StorageBackend } from '../backends/types.js';
import type { MemoryEntry, ScoredMemoryEntry } from '../types.js';

export type ComputationTaskType =
  | 'eigenmode'
  | 'contradiction'
  | 'decay_scores'
  | 'materialized_view'
  | 'full_recompute';

export interface ComputationTask {
  id: string;
  type: ComputationTaskType;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface ComputationConfig {
  batchSize: number;
  queueIntervalMs: number;
}

export interface ComputationStatus {
  queueDepth: number;
  lastRun: number;
  tasksProcessed: number;
  lastError: string | null;
}

export interface MaterializedView<T = unknown> {
  name: string;
  updated: number;
  entries: T[];
  metadata: Record<string, unknown>;
  ttlMs: number;
}

export type ViewEntry = ContradictionViewEntry | WorkingMemoryViewEntry | VelocityViewEntry | DriftViewEntry;

export interface ContradictionViewEntry {
  pairId: string;
  contentA: string;
  contentB: string;
  score: number;
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface WorkingMemoryViewEntry {
  id: string;
  content: string;
  score: number;
  rank: number;
  timestamp: number;
}

export interface VelocityViewEntry {
  domain: string;
  value: number;
  trend: number;
  sampledAt: number;
}

export interface DriftViewEntry {
  signal: string;
  score: number;
  domain: string;
  detectedAt: number;
}

export type ComputationHandlers = Record<string, (task: ComputationTask) => Promise<void>>;
