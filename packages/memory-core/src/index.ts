// ── @timps/memory-core — public entry point ──
// Memory engine
export { MemoryEngine } from './MemoryEngine.js';

// Types
export type {
  MemoryEntry, MemoryEntryType, EpisodicEntry, WorkingState,
  SearchOptions, MemoryPack, MemorySnapshot, MergeResult, MemoryStats,
} from './types.js';

// Storage utilities (advanced usage)
export { projectHash, memoryDir, generateId, jaccardSimilarity } from './storage.js';

// Native Rust addon status
export { isNativeAvailable } from './native.js';

// Intelligence tools — direct access if needed
export {
  ContradictionDetector,
  BurnoutSeismograph,
  RegretOracle,
  TechDebtSeismograph,
  BugPatternProphet,
  APIArchaeologist,
  VelocityTracker,
  ArchitectureDriftDetector,
  PatternLearner,
} from './intelligence/index.js';

export type {
  Position, ContradictionRecord,
  BurnoutSignal, BurnoutBaseline, BurnoutAnalysis,
  Decision, RegretCheckResult,
  CodeIncident, PatternCheckResult, DebtReport,
  BugPattern, BugWarnResult,
  APIQuirk, APILookupResult,
  WorkflowPattern, CoachResult,
  CodebaseInsight, InsightType, DriftCheckResult,
  LearnedPattern,
} from './intelligence/index.js';
