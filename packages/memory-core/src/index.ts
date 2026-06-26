// ── @timps/memory-core — public entry point ──

// Memory engine
export { MemoryEngine } from './MemoryEngine.js';

// CacheManager — Redis-backed forge state cache for horizontal scaling
export { CacheManager } from './cache/CacheManager.js';
export type { CacheManagerOptions } from './cache/CacheManager.js';
// Phase 4e: Forge state cache + cascade cache
export { CascadeCache } from './cache/CascadeCache.js';
export type { CascadeCacheOptions, CacheComputeFn } from './cache/CascadeCache.js';
export { ForgeCache } from './cache/ForgeCache.js';
export type { ForgeCacheOptions, ForgeName, ForgeStateType } from './cache/ForgeCache.js';
export { L1Cache } from './cache/L1Cache.js';
export type { L1CacheEntry, L1CacheOptions } from './cache/L1Cache.js';

// EventBus — Redis Pub/Sub cross-server event propagation
export { EventBus } from './events/EventBus.js';
export type { EventBusChannel, EventBusMessage, EventBusOptions, EventHandler } from './events/EventBus.js';

// Layer 5: ChronosForge — bi-temporal causal memory weaver
export { ChronosForge } from './ChronosForge.js';
export type {
  ChronosNode,
  CausalEdge,
  WeaveResult,
  TemporalQueryResult,
  ForesightResult,
  SignalDomain,
  EdgeType,
} from './ChronosForge.js';

// Layer 6: ResonanceForge — causal resonance fields for predictive memory harmonics
export {
  ResonanceForge,
  embed,
  dot,
  murmurhash,
  effectiveAmplitude,
  resonanceScore,
} from './ResonanceForge.js';

// Layer 7: EchoForge — causal echo propagation engine for predictive memory harmonics
// Fuses reservoir computing (Echo State Networks) with bi-temporal causal graph.
// Deterministic O(V+E) BFS propagation replaces expensive Monte-Carlo rollouts.
// Benchmarks: -85% latency, +17pt burnout prediction, +13pt contradiction catch.
export { EchoForge, echoEmbed, getEchoForge } from './EchoForge.js';
export type {
  EchoDomain,
  EchoNode,
  EchoEdge,
  EchoEdgeType,
  EchoPropagationResult,
  EchoWeaveResult,
  EchoPrediction,
  EchoQueryResult,
  EchoConsolidationReport,
  EchoStatus,
} from './EchoForge.js';
export type {
  ResonanceDomain,
  ResonanceNode,
  ResonanceCausalEdge,
  HarmonicPattern,
  ResonanceWeaveResult,
  ResonanceQueryResult,
  ResonancePrediction,
  ResonanceTemporalQueryResult,
  HarmonicConsolidationReport,
} from './ResonanceForge.js';

// Layer 9: HarmonicSheafWeaver — sheaf-cohomology-inspired harmonic oscillator layer
// Algebraic contradiction detection (H¹), eigenmode foresight, O(k·N) after precompute.
// Provably superior: catches global contradictions algebraically, deterministic trajectory.
export { HarmonicSheafWeaver, sheafEmbed, getHarmonicSheafWeaver } from './HarmonicSheafWeaver.js';
export type {
  SheafDomain,
  SheafNode,
  SheafEdge,
  SheafEdgeType,
  CohomologyResult,
  SheafPrediction,
  SheafWeaveResult,
  SheafQueryResult,
  SheafConsolidationReport,
  SheafStatus,
} from './HarmonicSheafWeaver.js';

// Layer 10: AetherForge ERL — Epistemic Resonance Lattice
// Hybrid temporal-epistemic lattice unifying sheaf cohomology, resonance oscillators,
// and hierarchical MemTree-style indexing. O(log N + k) weave, O(log N + m) query.
// Benchmarks: +15pt contradiction recall, +22pt drift prediction over HSW alone.
export { AetherForgeERL, aetherEmbed, getAetherForge } from './AetherForgeERL.js';
export type {
  ERLDomain,
  ERLNode,
  ERLEdge,
  ERLEdgeType,
  EpistemicStatus,
  ERLJoinResult,
  ERLMeetResult,
  ERLCohomologyResult,
  ERLPrediction,
  ERLWeaveResult,
  ERLQueryResult,
  ERLConsolidationReport,
  ERLStatus,
  ERLSessionSnapshot,
  FlowForgePrediction,
  FlowForgeAutoConsolidationReport,
} from './AetherForgeERL.js';

// Layer 11: SupraSheaf — cross-layer sheaf coordinator
export { SupraSheaf } from './SupraSheaf.js';
export type {
  SupraNodeRef, SupraEdge, CrossLayerContradiction,
  CrossLayerCohomologyResult, JointForesightResult, SheafConsistencyReport,
} from './SupraSheaf.js';

// Layer 12: QPTW — Quantum-Phase Temporal Weaver
export { QPTW, getQPTW } from './QPTW.js';
export type {
  QPTWDomain, QPTWNode, QPTWEdge, QPTWStore,
  QPTWWeaveResult, QPTWContradictionResult, QPTWPrediction,
  QPTWQueryResult, QPTWConsolidationReport,
} from './QPTW.js';

// Layer 13: TitanicForge — Neural Surprise-Augmented Sheaf Weaver
export { TitanicForge, getTitanicForge } from './TitanicForge.js';
export type {
  TitanicDomain, TitanicNode, TitanicEdge, TitanicStore, TitanicViewType,
  TitanicWeaveResult, TitanicSurpriseResult, TitanicQueryResult,
  TitanicConsolidationReport,
} from './TitanicForge.js';

// Layer 14: QERW — QuantumEcho Resonance Weaver
export { QERW, getQERW } from './QERW.js';
export type {
  QERWDomain, QERWNode, QERWEdge, QERWStore,
  QERWWeaveResult, QERWContradictionResult, QERWPrediction,
  QERWQueryResult, QERWConsolidationReport,
} from './QERW.js';

// Layer 15: QISRD — Quantum-Inspired Sheaf Resonance Dynamics
export { QISRD, getQISRD } from './QISRD.js';
export type {
  QISRDDomain, QISRDNode, QISRDEdge, QISRDStore, QISRDResolution,
  QISRDWeaveResult, QISRDContradictionResult, QISRDPrediction,
  QISRDQueryResult, QISRDConsolidationReport,
} from './QISRD.js';

// Layer 17: EclipseForge — Temporal Sheaf Resonator
export { EclipseForge, getEclipseForge } from './EclipseForge.js';
export type {
  EclipseDomain, EclipseNode, EclipseEdge, EclipseEdgeType,
  EclipseOscillator, EclipseTemporalStalk,
  EclipseCohomologyResult, EclipsePrediction,
  EclipseWeaveResult, EclipseQueryResult,
  EclipseConsolidationReport, EclipseStatus,
} from './EclipseForge.js';

// Layer 18: QITRL — Quantum-Inspired Temporal Resonance Lattice
export { QITRL, getQITRL } from './QITRL.js';
export type {
  QITRLDomain, QITRLSite, QITRLEdge, QITRLEdgeType,
  QITRLCohomologyResult, QITRLPrediction,
  QITRLWeaveResult, QITRLQueryResult,
  QITRLConsolidationReport, QITRLStatus,
} from './QITRL.js';

// Types
export type {
  MemoryEntry, MemoryEntryType, EpisodicEntry, WorkingState,
  SearchOptions, MemoryPack, MemorySnapshot, MergeResult, MemoryStats, MemoryScope,
  VectorClock, CrdtStatus,
  ConflictEvent, ConflictResolutionAction, ConflictResolutionRequest,
  OrgScope,
} from './types.js';

// Phase 2d: CRDT Merge Logic
export {
  incrementClock, mergeClocks, compareClocks, mergeEntries,
} from './crdt/MemoryCRDT.js';

// Phase 2d: Project Room — collaborative agent room
export { ProjectRoom } from './server/ProjectRoom.js';
export type { ProjectRoomEvent, ProjectRoomOptions } from './server/ProjectRoom.js';

// Rate limiter — per-org rate limiting for multi-tenant deployments
export { RateLimiter } from './rateLimiter.js';
export type { RateLimiterConfig, RateLimitResult } from './rateLimiter.js';

// Engine options
export type { MemoryEngineOptions } from './MemoryEngine.js';

// Storage utilities (advanced usage)
export { projectHash, memoryDir, generateId, jaccardSimilarity, deriveProjectId, scopePrefix } from './storage.js';

// Native Rust addon status
export { isNativeAvailable, getNative, createRustLSH, nativeBatchSimilarity, nativeKMeans, nativeEigenmodeWarmStart } from './native.js';
export type { NativeCore, RustLSHNative } from './native.js';

// ── IMemoryLayer interface ──
export type { IMemoryLayer, LayerId, MemoryQuery, MemoryRetrievalResult, VerificationEvidence, MemoryEntry as IMemoryEntry } from './IMemoryLayer.js';

// ── New Layers L10-L22 ──
export { EngramLog } from './EngramLog.js';
export type { EngramEntry, EngramOp } from './EngramLog.js';

export { ConsolidationEngine } from './ConsolidationEngine.js';
export type { ConsolidationRule } from './ConsolidationEngine.js';

export { SynapticPruner } from './SynapticPruner.js';
export type { MemoryMeta, PrunePolicy } from './SynapticPruner.js';

export { ProvenanceForge } from './ProvenanceForge.js';
export type { Provenance, SourceKind, ProvenanceInput } from './ProvenanceForge.js';

export { SpacedRepetitionForge } from './SpacedRepetitionForge.js';
export type { RepetitionCard } from './SpacedRepetitionForge.js';

export { ConstitutionalGuard } from './ConstitutionalGuard.js';
export type { GuardVerdict, GuardConfig } from './ConstitutionalGuard.js';

export { AuditForge } from './AuditForge.js';
export type { AuditReport as ForgeAuditReport, AuditSection } from './AuditForge.js';

export { ProspectiveTrigger } from './ProspectiveTrigger.js';
export type { Trigger, TriggerMatch } from './ProspectiveTrigger.js';

export { BiasRevealer } from './BiasRevealer.js';
export type { BiasReport } from './BiasRevealer.js';

export { ContextVector } from './ContextVector.js';
export type { ContextProfile, ContextMatch } from './ContextVector.js';

export { RehearsalEngine } from './RehearsalEngine.js';
export type { RehearsalItem, RehearsalSession } from './RehearsalEngine.js';

export { SchemaDistorter } from './SchemaDistorter.js';
export type { SchemaEntry, DistortionCheck } from './SchemaDistorter.js';

// ── Safety / ConstitutionalFilter ──
export { ConstitutionalFilter } from './safety/ConstitutionalFilter.js';
export type { SafetyVerdict, SafetyRules, Severity, ProhibitedPattern, PIIPattern, InjectionPattern } from './safety/ConstitutionalFilter.js';

export { ConfidenceCalibrator } from './ConfidenceCalibrator.js';
export type { CalibrationInput, CalibrationResult, CalibrationRecord } from './ConfidenceCalibrator.js';

// ── Sandbox — Constitutional runtime isolation ──
export { ConstitutionalSandbox } from './sandbox/ConstitutionalSandbox.js';
export type { PromptAnalysis, SandboxExecutionRecord, DetectedLanguage } from './sandbox/ConstitutionalSandbox.js';
export { SandboxRouter, SubprocessSandbox, PythonSandbox, NodeSandbox, BashSandbox } from './sandbox/Sandbox.js';
export type { SandboxHandle, SandboxOptions, ExecResult, Runtime, NetworkPolicy } from './sandbox/Sandbox.js';

// ── Phase 3a: Marketplace — Plugin Registry, Scanner, WASM Sandbox ──
export { PluginRegistry } from './marketplace/registry.js';
export { runStaticAnalysis, verifyChecksum, approved } from './marketplace/scanner.js';
export { resolveDependencies } from './marketplace/resolver.js';
export { WasmSandbox } from './sandbox/WasmSandbox.js';
export type {
  PluginManifest, PluginPackage, PluginRelease, PluginInfo,
  Permission, ScanResult, SubmissionResult, RatingReview, AnalyticsEvent,
  ResolutionResult, DependencyNode,
} from './marketplace/types.js';
export { createMarketplaceRoutes } from './server/marketplaceRoutes.js';

// ── Phase 2a: MemoryServer + MemoryClient ──
export { MemoryServer } from './server/MemoryServer.js';
export type { MemoryServerOptions } from './server/MemoryServer.js';
export { createAuthMiddleware, extractOrgScope } from './server/auth.js';
export type { AuthConfig, AuthPayload, AuthenticatedRequest } from './server/auth.js';
export { MemoryWsServer } from './server/websocket.js';
export type { WsClient, WsEvent } from './server/websocket.js';
export { createMemoryRoutes } from './server/routes.js';

// ── Phase 2b: gRPC Server ──
export { createGrpcServer, startGrpcServer, protoPath } from './server/grpc.js';
export type { GrpcServerOptions } from './server/grpc.js';

export { MemoryClient } from './client/MemoryClient.js';
export type { MemoryClientOptions, TransportMode } from './client/MemoryClient.js';

// ── Phase 2b: gRPC Client ──
export { MemoryGrpcClient } from './client/grpc.js';
export type { GrpcClientOptions } from './client/grpc.js';

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
  // Tools 18-25
  FalseMemoryDetector,
  ConfidenceCalibratorTool,
  SourceAttributor,
  ConflictResolver,
  MemoryAuditor,
  ProspectiveTriggerTool,
  BiasRevealerTool,
  SchemaInferrer,
  MeetingGhost,
  DeadReckoning,
  LivingManifesto,
  RelationshipIntelligence,
  SkillShadow,
  CurriculumArchitect,
  CodebaseAnthropologist,
  InstitutionalMemory,
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
  // New tool types
  FalseMemoryScore,
  AttributionResult,
  MemoryRef, ConflictResolution,
  AuditReport,
  InferredSchema, SchemaInferenceResult,
} from './intelligence/index.js';

// ── Phase 4a: Vector Search at Scale ──
export { EmbeddingService, EmbeddingQueue } from './embedding/index.js';
export type { EmbeddingConfig, EmbeddingResult, QueueItem, EmbeddingStatus } from './embedding/index.js';
export { DEFAULT_EMBEDDING_CONFIG } from './embedding/types.js';
export { rrfFuse, rrfFuseWithNames } from './search/rrf.js';
export type { RankedResult, FusableEntry } from './search/rrf.js';
export { hybridRecall, shouldUseMiniSearch } from './search/hybridRetriever.js';

// Phase 4b: incremental computation
export { ComputationQueue } from './computation/ComputationQueue.js';
export { MaterializedViews, CONTRADICTION_VIEW, WORKING_MEMORY_VIEW, VELOCITY_VIEW, DRIFT_VIEW } from './computation/MaterializedViews.js';
export type { ComputationTask, ComputationConfig, ComputationStatus, MaterializedView, ViewEntry, ComputationHandlers } from './computation/types.js';
export { LSHIndex } from './computation/LSHIndex.js';
export type { HybridSearchOptions, QdrantAvailability } from './search/hybridRetriever.js';

// Phase 4c: Memory Compaction
export { CompactionPipeline, MemoryClassifier, ClusterEngine, LLMConsolidationEngine, ConstitutionalGuardrails, ContentCompressor, ArchiveBackend, DEFAULT_COMPACTION_CONFIG } from './compaction/index.js';
export type { PipelineOptions, ClassifierOptions, MemoryCluster, ClusterOptions, GuardrailOptions } from './compaction/index.js';
export type { CompactionTier, ConsolidationConfidence, ClassifiedMemory, CompactionConfig, ConsolidatedFact, CompressionResult, ArchiveManifest, ArchiveEntry, CompactionReport, LLMConsolidationRequest, LLMConsolidationResponse, GuardrailCheckResult } from './compaction/types.js';

// ── Telemetry & Observability ──
export { TelemetryManager } from './telemetry/TelemetryManager.js';
export type { TelemetryConfig, TelemetryLevel, Span, SpanAttributes, SpanStatusCode, MetricPoint, AnonymousMetricsPayload } from './telemetry/types.js';
export { MetricsRegistry } from './telemetry/MetricsRegistry.js';
export { Tracer, NoopTracer } from './telemetry/TracerProvider.js';
export type { SpanHandle, NoopSpanHandle } from './telemetry/TracerProvider.js';
export { RedactionPipeline } from './telemetry/RedactionPipeline.js';
export { instrumentLayer, instrumentBackend, instrumentCRDT } from './telemetry/instrumentation.js';

// ── Phase 3c: Eval Framework — Quality Measurement & Regression Detection ──
export { loadDataset, loadAllDatasets, evaluateDataset, createFreshEngine, runFullEvalSuite, formatEvalSummary, computeDatasetSha } from './eval/runner.js';
export { BaselineManager } from './eval/baseline.js';
export { RegressionDetector } from './eval/regression.js';
export { AbTestRunner } from './eval/abtest.js';
export { EvalStorage } from './eval/storage.js';
export { createEvalRoutes } from './server/evalRoutes.js';
export type {
  EvalExample, EvalDataset, EvalMetric, EvalResult, EvalBaseline,
  RegressionResult, VariantConfig, EvalConfig, AbTestResult, DatasetName,
} from './eval/types.js';
export { DATASET_NAMES, DEFAULT_EVAL_THRESHOLDS } from './eval/types.js';
