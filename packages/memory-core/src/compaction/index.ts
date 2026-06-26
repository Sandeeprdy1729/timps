// ── @timps/memory-core — Phase 4c: Compaction — public exports ──

export { CompactionPipeline } from './CompactionPipeline.js';
export type { PipelineOptions } from './CompactionPipeline.js';

export { MemoryClassifier } from './MemoryClassifier.js';
export type { ClassifierOptions } from './MemoryClassifier.js';

export { ClusterEngine } from './ClusterEngine.js';
export type { MemoryCluster, ClusterOptions } from './ClusterEngine.js';

export { LLMConsolidationEngine } from './LLMConsolidationEngine.js';

export { ConstitutionalGuardrails } from './ConstitutionalGuardrails.js';
export type { GuardrailOptions } from './ConstitutionalGuardrails.js';

export { ContentCompressor } from './ContentCompressor.js';

export { ArchiveBackend } from './ArchiveBackend.js';

export {
  DEFAULT_COMPACTION_CONFIG,
} from './types.js';
export type {
  CompactionTier, ConsolidationConfidence,
  ClassifiedMemory, CompactionConfig,
  ConsolidatedFact, CompressionResult,
  ArchiveManifest, ArchiveEntry,
  CompactionReport,
  LLMConsolidationRequest, LLMConsolidationResponse,
  GuardrailCheckResult,
} from './types.js';
