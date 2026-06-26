// ── @timps/memory-core — Types ──

export type MemoryEntryType = 'fact' | 'pattern' | 'preference' | 'error' | 'convention' | 'bug' | 'incident' | 'architecture';

export type VectorClock = Record<string, number>;

export type CrdtStatus = 'active' | 'conflict_pending' | 'auto_merged' | 'user_resolved';

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: MemoryEntryType;
  content: string;
  tags: string[];
  score?: number;
  actorId?: string;
  vectorClock?: VectorClock;
  crdtStatus?: CrdtStatus;
  conflicts?: string[];
  mergedFrom?: string[];
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
  since?: number;
  minConfidence?: number;
  maxFalseMemoryRisk?: number;
  useIntelligence?: boolean;
  context?: { domain: string; activeFiles?: string[]; tags?: string[] };
  /** Use full hybrid search (Qdrant + BM25 + KG fusion). Default true when Qdrant is configured. */
  useHybrid?: boolean;
  /** Force MiniSearch-only mode. */
  useMiniSearch?: boolean;
}

export interface ScoredMemoryEntry extends MemoryEntry {
  calibratedConfidence: number;
  falseMemoryRisk: number;
  sourceReliability: number;
  sourceKind: string;
  contextBoost: number;
  rehearsalBoost: number;
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

/** A conflict detected between two concurrent writes */
export interface ConflictEvent {
  conflictId: string;
  projectId: string;
  agentAId: string;
  agentBId: string;
  entryA: MemoryEntry;
  entryB: MemoryEntry;
  similarity: number;
  detectedAt: number;
  suggestedResolution?: string;
  status: 'pending' | 'auto_merged' | 'user_resolved';
}

/** Resolution action for a conflict */
export type ConflictResolutionAction = 'keep_a' | 'keep_b' | 'merge' | 'overwrite';

/** Request payload to resolve a conflict */
export interface ConflictResolutionRequest {
  conflictId: string;
  action: ConflictResolutionAction;
  mergedContent?: string;
  resolvedBy: string;
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

// ── New architecture types (Layer 10-22, Tools 18-25) ──

export interface EngramEntry {
  index: number;
  timestamp: number;
  op: 'store' | 'retrieve' | 'update' | 'delete' | 'contradict' | 'verify' | 'supersede' | 'archive';
  layerId: string;
  entryId: string;
  actorId: string;
  prevHash: string;
  payload: unknown;
  justification: string;
  hash: string;
}

export interface Provenance {
  id: string;
  sourceKind: 'user_direct' | 'user_implied' | 'agent_inference' | 'agent_pattern' | 'tool_output' | 'web_search' | 'doc_reference' | 'git_history' | 'cross_project';
  sourceDetail: string;
  actorId: string;
  observedAt: number;
  validFrom?: number;
  validUntil?: number;
  evidenceCount: number;
  confidence: number;
  chainOfCustody: { actor: string; op: string; at: number }[];
  parentIds: string[];
}

export interface ConsolidationRule {
  name: string;
  match: (entry: any) => boolean;
  transform: (entry: any) => any;
  promote: boolean;
}

export interface PrunePolicy {
  coldThresholdDays: number;
  minImportance: number;
  minConfidence: number;
  archiveInsteadOfDelete: boolean;
}

export interface RepetitionCard {
  id: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;
  lastReview: number;
  retrievability: number;
}

export interface GuardConfig {
  minConfidenceForStore: number;
  minEvidenceCount: number;
  requireProvenance: boolean;
  maxContradictionsBeforeBlock: number;
}

export interface GuardVerdict {
  allowed: boolean;
  reason: string;
  confidenceThreshold: number;
  actualConfidence: number;
}

export interface MemoryHealthReport {
  timestamp: number;
  totalEntries: number;
  weak: number;
  contradicted: number;
  outdated: number;
  unsourced: number;
  healthScore: number;
  suggestions: string[];
}

export interface CalibrationInput {
  similarity: number;
  reliability: number;
  evidence: number;
  freshness: number;
}

export interface CalibrationResult {
  score: number;
  level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  breakdown: {
    similarityContribution: number;
    reliabilityContribution: number;
    evidenceContribution: number;
    freshnessContribution: number;
  };
}

/** Optional scope for multi-user/team isolation */
export interface MemoryScope {
  userId?: string;
  teamId?: string;
}

/**
 * Three-level isolation scope for multi-tenant deployments.
 * Replaces the flat project hash with orgId → teamId → projectId hierarchy.
 * All storage keys and queries are automatically scoped.
 */
export interface OrgScope {
  /** Organization (tenant) — the top-level security boundary. Required. */
  orgId: string;
  /** Team (sub-tenant) — optional, for orgs with multiple teams. */
  teamId?: string;
  /** Project (repo) — derived from git remote URL, not local path. */
  projectId: string;
}

export interface LayerIdString {
  layerId: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9'
    | 'L10' | 'L11' | 'L12' | 'L13' | 'L14' | 'L15' | 'L16' | 'L17'
    | 'L18' | 'L19' | 'L20' | 'L21' | 'L22';
}
