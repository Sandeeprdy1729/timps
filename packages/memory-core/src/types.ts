// ── @timps/memory-core — Types ──

export type MemoryEntryType = 'fact' | 'pattern' | 'preference' | 'error' | 'convention' | 'bug' | 'incident' | 'architecture';

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: MemoryEntryType;
  content: string;
  tags: string[];
  score?: number;
}

export interface EpisodicEntry {
  id: string;
  timestamp: number;
  summary: string;
  outcome: 'success' | 'failure' | 'partial' | 'unknown';
  durationMs?: number;
  errorCount?: number;
  tags?: string[];
}

export interface WorkingState {
  currentGoal?: string;
  activeFiles: string[];
  recentErrors: string[];
  discoveredPatterns: string[];
}

export interface SearchOptions {
  limit?: number;
  type?: MemoryEntryType;
  tags?: string[];
  since?: number; // timestamp ms
}

/** Portable memory snapshot — the "memory pack" format for export/import */
export interface MemoryPack {
  version: '1.0';
  projectHash: string;
  exportedAt: number;
  working: WorkingState;
  episodic: EpisodicEntry[];
  semantic: MemoryEntry[];
  /** SHA-256 hex of JSON.stringify({ working, episodic, semantic }) */
  signature: string;
}

export interface MemorySnapshot {
  branchName: string;
  createdAt: number;
  pack: MemoryPack;
}

export interface MergeResult {
  addedSemantic: number;
  addedEpisodic: number;
  skippedDuplicates: number;
}

export interface MemoryStats {
  semanticCount: number;
  episodeCount: number;
  workingFiles: number;
  workingPatterns: number;
}

// ── Intelligence result types ──

export interface ContradictionResult {
  hasContradiction: boolean;
  contradictingEntry?: MemoryEntry;
  similarity: number;
  explanation: string;
}

export interface BugPatternResult {
  hasBugPattern: boolean;
  matchedPattern?: MemoryEntry;
  confidence: number;
  warning: string;
}

export interface BurnoutResult {
  riskLevel: 'low' | 'medium' | 'high';
  indicators: string[];
  suggestion: string;
}

export interface TechDebtResult {
  hasDebt: boolean;
  matchedIncident?: MemoryEntry;
  severity: 'low' | 'medium' | 'high';
  warning: string;
}

export interface DriftResult {
  hasDrift: boolean;
  driftedAreas: string[];
  explanation: string;
}
