// ── @timps/memory-core — Phase 4c: Compaction Types ──

export type CompactionTier = 'hot' | 'warm' | 'cold' | 'deleted';

export type ConsolidationConfidence = 'high' | 'medium' | 'low';

export interface ClassifiedMemory {
  id: string;
  content: string;
  type: string;
  tags: string[];
  timestamp: number;
  layer: string;
  importance: number;
  recallCount: number;
  lastAccess: number;
  embedding?: number[];
  inContradiction: boolean;
  partOfConsolidated: boolean;
  pinnedByUser: boolean;
  tier: CompactionTier;
}

export interface CompactionConfig {
  /** Minimum age (days) before a memory can be archived */
  archiveAfterDays: number;
  /** Importance threshold below which warm memories become candidates */
  warmImportanceThreshold: number;
  /** Importance threshold below which cold memories become candidates */
  coldImportanceThreshold: number;
  /** Recall count threshold for warm tier (memories recalled less than this) */
  warmRecallThreshold: number;
  /** Minimum cluster size for LLM consolidation */
  clusterMinSize: number;
  /** Maximum cluster size for LLM consolidation */
  clusterMaxSize: number;
  /** Days after consolidation before originals are deleted */
  deleteAfterConsolidationDays: number;
  /** LLM provider for consolidation summarization */
  llmProvider?: string;
  /** LLM model for consolidation summarization */
  llmModel?: string;
  /** LLM API key for consolidation summarization */
  llmApiKey?: string;
  /** LLM API endpoint (for Ollama) */
  llmEndpoint?: string;
  /** Number of dimensions for clustering embeddings (default 64) */
  clusterEmbedDim: number;
  /** Number of k-means clusters (default sqrt(N/2)) */
  clusterCount: number;
  /** Enable constitutional guardrails */
  constitutionalGuardrails: boolean;
}

export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  archiveAfterDays: 90,
  warmImportanceThreshold: 0.4,
  coldImportanceThreshold: 0.2,
  warmRecallThreshold: 3,
  clusterMinSize: 50,
  clusterMaxSize: 200,
  deleteAfterConsolidationDays: 30,
  clusterEmbedDim: 64,
  clusterCount: 0,
  constitutionalGuardrails: true,
};

export interface ConsolidatedFact {
  id: string;
  type: 'consolidated';
  sourceCount: number;
  dateRange: [number, number];
  layer: string;
  importance: 'high' | 'medium' | 'low';
  summary: string;
  keyPatterns: string[];
  originalIds: string[];
  timestamp: number;
  tags: string[];
  confidence: ConsolidationConfidence;
}

export interface CompressionResult {
  originalContent: string;
  compressedContent: string;
  compressionRatio: number;
  embeddingKept: boolean;
}

export interface ArchiveManifest {
  version: number;
  archivedAt: number;
  totalArchived: number;
  totalSize: number;
  compressedSize: number;
  entries: ArchiveEntry[];
}

export interface ArchiveEntry {
  id: string;
  content: string;
  type: string;
  tags: string[];
  timestamp: number;
  layer: string;
  importance: number;
  originalSize: number;
}

export interface CompactionReport {
  timestamp: number;
  durationMs: number;
  steps: {
    classified: number;
    hot: number;
    warm: number;
    cold: number;
    deleted: number;
    clustersFormed: number;
    consolidated: number;
    compressed: number;
    archived: number;
    purgeDeleted: number;
  };
  storageSavings: {
    before: { entries: number; sizeEstimate: number };
    after: { entries: number; sizeEstimate: number };
    savingsPercent: number;
  };
  errors: string[];
}

export interface LLMConsolidationRequest {
  clusterId: string;
  entries: Array<{ id: string; content: string; type: string; timestamp: number; tags: string[] }>;
}

export interface LLMConsolidationResponse {
  summary: string;
  keyPatterns: string[];
  importance: 'high' | 'medium' | 'low';
  confidence: ConsolidationConfidence;
  contradictions: string[];
}

export interface GuardrailCheckResult {
  passed: boolean;
  fabricationRisk: number;
  instructionLeakageDetected: boolean;
  contradictionsPreserved: number;
  confidence: ConsolidationConfidence;
  warnings: string[];
}
