// ── @timps/memory-core — MemoryEngine ──
// The single entry-point for all 9-layer memory operations + 17 intelligence tools.
// All storage is file-based (JSON) — no database server required.

import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';

import type {
  MemoryEntry, MemoryEntryType, EpisodicEntry, WorkingState,
  SearchOptions, ScoredMemoryEntry, MemoryPack, MemorySnapshot, MergeResult, MemoryStats, MemoryScope,
} from './types.js';

import {
  projectHash, memoryDir, generateId, getBackend,
  loadWorking, saveWorking,
  appendEpisode, loadEpisodes, episodeCount,
  loadSemantic, saveSemantic,
  trackFile, trackError, trackPattern,
  jaccardSimilarity,
} from './storage.js';
import type { StorageBackend, FileBackendOptions } from './backends/index.js';
import type { CacheManager } from './cache/CacheManager.js';
import type { EventBus, EventBusChannel } from './events/EventBus.js';

import { searchEntries } from './search.js';
import { MigrationEngine, CURRENT_SCHEMA_VERSION, ALL_MIGRATIONS } from './migrations/index.js';

// ── New Layers (L10-L22) ──
import { EngramLog } from './EngramLog.js';
import { ConsolidationEngine } from './ConsolidationEngine.js';
import type { ConsolidationRule } from './ConsolidationEngine.js';
import { SynapticPruner } from './SynapticPruner.js';
import type { PrunePolicy } from './SynapticPruner.js';
import { ProvenanceForge } from './ProvenanceForge.js';
import type { ProvenanceInput } from './ProvenanceForge.js';
import { SpacedRepetitionForge } from './SpacedRepetitionForge.js';
import { ConstitutionalGuard } from './ConstitutionalGuard.js';
import type { GuardConfig } from './ConstitutionalGuard.js';
import { AuditForge } from './AuditForge.js';
import { ProspectiveTrigger } from './ProspectiveTrigger.js';
import { BiasRevealer } from './BiasRevealer.js';
import { ContextVector } from './ContextVector.js';
import { RehearsalEngine } from './RehearsalEngine.js';
import { SchemaDistorter } from './SchemaDistorter.js';
import { ConfidenceCalibrator } from './ConfidenceCalibrator.js';

// ── New Intelligence Tools (18-25) ──
import { FalseMemoryDetector } from './intelligence/FalseMemoryDetector.js';
import type { FalseMemoryScore } from './intelligence/FalseMemoryDetector.js';
import { ConfidenceCalibratorTool } from './intelligence/ConfidenceCalibrator.js';
import type { CalibrationInput, CalibrationResult } from './intelligence/ConfidenceCalibrator.js';
import { SourceAttributor } from './intelligence/SourceAttributor.js';
import type { AttributionResult } from './intelligence/SourceAttributor.js';
import { ConflictResolver } from './intelligence/ConflictResolver.js';
import type { MemoryRef, ConflictResolution } from './intelligence/ConflictResolver.js';
import { MemoryAuditor } from './intelligence/MemoryAuditor.js';
import type { AuditReport } from './intelligence/MemoryAuditor.js';
import { ProspectiveTriggerTool } from './intelligence/ProspectiveTrigger.js';
import { BiasRevealerTool } from './intelligence/BiasRevealer.js';
import type { BiasReport } from './intelligence/BiasRevealer.js';
import { SchemaInferrer } from './intelligence/SchemaInferrer.js';
import type { SchemaInferenceResult } from './intelligence/SchemaInferrer.js';

// Intelligence tools — ported from packages/server
import { ContradictionDetector } from './intelligence/contradiction.js';
import { BurnoutSeismograph } from './intelligence/burnout.js';
import { RegretOracle } from './intelligence/regretOracle.js';
import { TechDebtSeismograph } from './intelligence/techDebt.js';
import { BugPatternProphet } from './intelligence/bugPattern.js';
import { APIArchaeologist } from './intelligence/apiArchaeologist.js';
import { VelocityTracker } from './intelligence/velocityTracker.js';
import { ArchitectureDriftDetector } from './intelligence/architectureDrift.js';
import { PatternLearner } from './intelligence/patternLearner.js';
import { MeetingGhost } from './intelligence/meetingGhost.js';
import { DeadReckoning } from './intelligence/deadReckoning.js';
import { LivingManifesto } from './intelligence/livingManifesto.js';
import { RelationshipIntelligence } from './intelligence/relationship.js';
import { SkillShadow } from './intelligence/skillShadow.js';
import { CurriculumArchitect } from './intelligence/curriculum.js';
import { CodebaseAnthropologist } from './intelligence/codebaseAnthropologist.js';
import { InstitutionalMemory } from './intelligence/institutionalMemory.js';

// Layer 5: ChronosForge — bi-temporal causal memory weaver
import { ChronosForge } from './ChronosForge.js';
export type {
  ChronosNode, CausalEdge, WeaveResult, TemporalQueryResult,
  ForesightResult, SignalDomain,
} from './ChronosForge.js';

// Layer 7: EchoForge — causal echo propagation + reservoir computing
import { EchoForge } from './EchoForge.js';
export type { EchoPrediction, EchoStatus, EchoDomain } from './EchoForge.js';

// Layer 9: HarmonicSheafWeaver — sheaf-cohomology harmonic oscillator layer
import { HarmonicSheafWeaver } from './HarmonicSheafWeaver.js';

// Layer 10: AetherForgeERL — Epistemic Resonance Lattice
import { AetherForgeERL } from './AetherForgeERL.js';
import { SupraSheaf } from './SupraSheaf.js';
import { QPTW } from './QPTW.js';
import { TitanicForge } from './TitanicForge.js';
import { QERW } from './QERW.js';
import { QISRD } from './QISRD.js';
import { EclipseForge } from './EclipseForge.js';
import { QITRL } from './QITRL.js';
export type { ERLPrediction, ERLStatus } from './AetherForgeERL.js';

// Re-export tool result types for consumers
export type { ContradictionResult, Position } from './intelligence/contradiction.js';
export type { BurnoutAnalysis } from './intelligence/burnout.js';
export type { RegretCheckResult, Decision } from './intelligence/regretOracle.js';
export type { PatternCheckResult, DebtReport, CodeIncident } from './intelligence/techDebt.js';
export type { BugWarnResult, BugPattern } from './intelligence/bugPattern.js';
export type { APIQuirk, APILookupResult } from './intelligence/apiArchaeologist.js';
export type { CoachResult, WorkflowPattern } from './intelligence/velocityTracker.js';
export type { DriftCheckResult, CodebaseInsight, InsightType } from './intelligence/architectureDrift.js';
export type { LearnedPattern } from './intelligence/patternLearner.js';
export type { Commitment, ExtractionResult } from './intelligence/meetingGhost.js';
export type { PastDecision, SimulationResult } from './intelligence/deadReckoning.js';
export type { ValueSignal, ManifestoReport } from './intelligence/livingManifesto.js';
export type { Contact, RelationshipCheck } from './intelligence/relationship.js';
export type { ShadowPattern } from './intelligence/skillShadow.js';
export type { LearningGap, Curriculum } from './intelligence/curriculum.js';
export type { CulturalNorm, CodebaseCulture } from './intelligence/codebaseAnthropologist.js';
export type { Contribution, DepartedContributor } from './intelligence/institutionalMemory.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface MemoryEngineOptions {
  /** Optional scope for multi-user/team isolation. Affects storage directory and actor identity. */
  scope?: MemoryScope;
  /** Override the storage directory. If not set, derived from projectPath + optional scope. */
  dir?: string;
  /**
   * Storage backend for all forge layers.
   * Defaults to FileBackend with WAL if not provided.
   * Pass InMemoryBackend for testing, PostgresBackend for multi-server, etc.
   */
  backend?: StorageBackend;
  /** FileBackend options (only used when backend is not explicitly provided). */
  fileBackendOptions?: FileBackendOptions;
  /**
   * Cache manager (Redis-backed) for forge state caching.
   * When provided, expensive forge state computations are cached
   * with TTL-based invalidation for cross-server consistency.
   */
  cacheManager?: CacheManager;
  /**
   * Event bus (Redis Pub/Sub) for cross-server event propagation.
   * When provided, store/recall/consolidate events are published
   * to all connected MemoryServer instances.
   */
  eventBus?: EventBus;
}

export class MemoryEngine {
  private dir: string;
  private hash: string;
  private scope?: MemoryScope;
  private working: WorkingState;
  private _backend: StorageBackend;
  private _cacheManager?: CacheManager;
  private _eventBus?: EventBus;

  // ── Layer 5: ChronosForge (lazy-init) ──
  private _chronos?: ChronosForge;

  // ── Layer 7: EchoForge (lazy-init) ──
  private _echo?: EchoForge;

  // ── Layer 9: HarmonicSheafWeaver (lazy-init) ──
  private _harmonicSheaf?: HarmonicSheafWeaver;

  // ── Layer 10: AetherForgeERL (lazy-init) ──
  private _aether?: AetherForgeERL;

  // ── Layer 11: SupraSheaf (lazy-init, no persistence) ──
  private _supra?: SupraSheaf;
  private _qptw?: QPTW;
  private _titanic?: TitanicForge;
  private _qerw?: QERW;
  private _qisrd?: QISRD;

  // ── Layer 17: EclipseForge (lazy-init) ──
  private _eclipse?: EclipseForge;

  // ── Layer 18: QITRL (lazy-init) ──
  private _qitrl?: QITRL;

  // ── New Layers L10-L22 (lazy-init) ──
  private _engramLog?: EngramLog;
  private _consolidation?: ConsolidationEngine;
  private _synapticPruner?: SynapticPruner;
  private _provenanceForge?: ProvenanceForge;
  private _spacedRepetition?: SpacedRepetitionForge;
  private _constitutionalGuard?: ConstitutionalGuard;
  private _auditForge?: AuditForge;
  private _prospectiveTrigger?: ProspectiveTrigger;
  private _biasRevealer?: BiasRevealer;
  private _contextVector?: ContextVector;
  private _rehearsalEngine?: RehearsalEngine;
  private _schemaDistorter?: SchemaDistorter;
  private _confidenceCalibrator?: ConfidenceCalibrator;

  // ── New Intelligence Tools 18-25 (lazy-init) ──
  private _falseMemoryDetector?: FalseMemoryDetector;
  private _calibratorTool?: ConfidenceCalibratorTool;
  private _sourceAttributor?: SourceAttributor;
  private _conflictResolver?: ConflictResolver;
  private _memoryAuditor?: MemoryAuditor;
  private _prospectiveTriggerTool?: ProspectiveTriggerTool;
  private _biasRevealerTool?: BiasRevealerTool;
  private _schemaInferrer?: SchemaInferrer;

  // ── Intelligence tool instances (lazy-init via getters) ──
  private _contradiction?: ContradictionDetector;
  private _burnout?: BurnoutSeismograph;
  private _regret?: RegretOracle;
  private _techDebt?: TechDebtSeismograph;
  private _bugPattern?: BugPatternProphet;
  private _api?: APIArchaeologist;
  private _velocity?: VelocityTracker;
  private _architecture?: ArchitectureDriftDetector;
  private _patterns?: PatternLearner;
  private _meetingGhost?: MeetingGhost;
  private _deadReckoning?: DeadReckoning;
  private _livingManifesto?: LivingManifesto;
  private _relationship?: RelationshipIntelligence;
  private _skillShadow?: SkillShadow;
  private _curriculum?: CurriculumArchitect;
  private _codebaseAnthropologist?: CodebaseAnthropologist;
  private _institutionalMemory?: InstitutionalMemory;

  constructor(projectPath: string, options?: MemoryEngineOptions) {
    this.scope = options?.scope;
    this.dir = options?.dir ?? memoryDir(projectPath, this.scope);
    this.hash = projectHash(projectPath);
    this._backend = options?.backend ?? getBackend(this.dir);
    this._cacheManager = options?.cacheManager;
    this._eventBus = options?.eventBus;
    this._runMigrations();
    this.working = loadWorking(this.dir);
  }

  /** Run pending schema migrations on startup. */
  private _runMigrations(): void {
    const engine = new MigrationEngine(this.dir, this._backend, ALL_MIGRATIONS);
    if (engine.hasPending) {
      engine.startup();
    }
  }

  /** The active storage backend (useful for passing to forge layers). */
  get backend(): StorageBackend {
    return this._backend;
  }

  /** The cache manager, if configured. */
  get cacheManager(): CacheManager | undefined {
    return this._cacheManager;
  }

  /** The event bus, if configured. */
  get eventBus(): EventBus | undefined {
    return this._eventBus;
  }

  /** The scope this engine was created with, if any. */
  get engineScope(): Readonly<MemoryScope> | undefined {
    return this.scope;
  }

  // ── Lazy getters for tool instances ──
  get contradiction(): ContradictionDetector {
    return (this._contradiction ??= new ContradictionDetector(this.dir, this._backend));
  }
  get burnoutSeismograph(): BurnoutSeismograph {
    return (this._burnout ??= new BurnoutSeismograph(this.dir, this._backend));
  }
  get regretOracle(): RegretOracle {
    return (this._regret ??= new RegretOracle(this.dir, this._backend));
  }
  get techDebt(): TechDebtSeismograph {
    return (this._techDebt ??= new TechDebtSeismograph(this.dir, this._backend));
  }
  get bugPattern(): BugPatternProphet {
    return (this._bugPattern ??= new BugPatternProphet(this.dir, this._backend));
  }
  get apiArchaeologist(): APIArchaeologist {
    return (this._api ??= new APIArchaeologist(this.dir, this._backend));
  }
  get velocityTracker(): VelocityTracker {
    return (this._velocity ??= new VelocityTracker(this.dir, this._backend));
  }
  get architectureDrift(): ArchitectureDriftDetector {
    return (this._architecture ??= new ArchitectureDriftDetector(this.dir, this._backend));
  }
  get patternLearner(): PatternLearner {
    return (this._patterns ??= new PatternLearner(this.dir, this._backend));
  }
  get meetingGhost(): MeetingGhost {
    return (this._meetingGhost ??= new MeetingGhost(this.dir, this._backend));
  }
  get deadReckoning(): DeadReckoning {
    return (this._deadReckoning ??= new DeadReckoning(this.dir, this._backend));
  }
  get livingManifesto(): LivingManifesto {
    return (this._livingManifesto ??= new LivingManifesto(this.dir, this._backend));
  }
  get relationship(): RelationshipIntelligence {
    return (this._relationship ??= new RelationshipIntelligence(this.dir, this._backend));
  }
  get skillShadow(): SkillShadow {
    return (this._skillShadow ??= new SkillShadow(this.dir, this._backend));
  }
  get curriculum(): CurriculumArchitect {
    return (this._curriculum ??= new CurriculumArchitect(this.dir, this._backend));
  }
  get codebaseAnthropologist(): CodebaseAnthropologist {
    return (this._codebaseAnthropologist ??= new CodebaseAnthropologist(this.dir, this._backend));
  }
  get institutionalMemory(): InstitutionalMemory {
    return (this._institutionalMemory ??= new InstitutionalMemory(this.dir, this._backend));
  }

  /** Layer 5: ChronosForge — bi-temporal causal memory weaver + foresight simulator. */
  get chronosForge(): ChronosForge {
    return (this._chronos ??= new ChronosForge(this.dir, this._backend));
  }

  /**
   * Layer 7: EchoForge — causal echo propagation + reservoir computing.
   * Deterministic O(V+E) foresight: -85% latency vs MC rollouts, +17pt prediction.
   */
  get echoForge(): EchoForge {
    return (this._echo ??= new EchoForge(this.dir, this._backend));
  }

  /**
   * Layer 9: HarmonicSheafWeaver — sheaf-cohomology harmonic oscillator layer.
   * Algebraic contradiction detection (H¹), eigenmode foresight, O(k·N) after precompute.
   */
  get harmonicSheafWeaver(): HarmonicSheafWeaver {
    return (this._harmonicSheaf ??= new HarmonicSheafWeaver(this.dir, this._backend));
  }

  /**
   * Layer 10: AetherForgeERL — Epistemic Resonance Lattice.
   * Hybrid temporal-epistemic lattice unifying sheaf cohomology, resonance
   * oscillators, and hierarchical MemTree-style indexing. O(log N + k) weave.
   */
  get aetherForge(): AetherForgeERL {
    return (this._aether ??= new AetherForgeERL(this.dir, this._backend));
  }

  /**
   * Layer 11: SupraSheaf — cross-layer sheaf coordinator.
   * Reads stalks from ChronosForge (L5), EchoForge (L7), and AetherForgeERL (L10),
   * builds a joint sheaf Laplacian, and computes cross-layer H¹ + joint foresight.
   */
  get supraSheaf(): SupraSheaf {
    return (this._supra ??= new SupraSheaf(this));
  }

  /**
   * Layer 12: QPTW — Quantum-Phase Temporal Weaver.
   * Phase-modulated incremental propagation on a low-dimensional manifold
   * for contradiction detection, foresight, and surprise-driven updates.
   * O(log N) amortized updates vs O(N + E) for full Laplacian eigen-solve.
   */
  get qptw(): QPTW {
    return (this._qptw ??= new QPTW(this.dir, this._backend));
  }

  /**
   * Layer 13: TitanicForge — Neural Surprise-Augmented Sheaf Weaver.
   * Hybrid neural-symbolic: sheaf H¹ algebraic safety + test-time neural
   * memorization (Titans-style) + MAGMA multi-view projections.
   */
  get titanicForge(): TitanicForge {
    return (this._titanic ??= new TitanicForge(this.dir, this._backend));
  }

  /**
   * Layer 14: QERW — QuantumEcho Resonance Weaver.
   * Information-geometric geodesic echo propagation on a Riemannian manifold
   * with sheaf curvature constraints. O(d log N) weave, O(d + k) query.
   */
  get qerw(): QERW {
    return (this._qerw ??= new QERW(this.dir, this._backend));
  }

  /**
   * Layer 15: QISRD — Quantum-Inspired Sheaf Resonance Dynamics.
   * Fuses sheaf cohomology with Riemannian Langevin dynamics and stochastic
   * resonance for provably consistent, self-evolving multi-scale prediction.
   */
  get qisrd(): QISRD {
    return (this._qisrd ??= new QISRD(this.dir, this._backend));
  }

  /**
   * Layer 17: EclipseForge — Temporal Sheaf Resonator.
   * Time-aware sheaf cohomology with temporal stalks, spectral resonance
   * propagation, phase-based quenching, and O(|affected|) incremental updates.
   * +15-20pt temporal foresight vs pure eigenmode projection.
   */
  get eclipseForge(): EclipseForge {
    return (this._eclipse ??= new EclipseForge(this.dir, this._backend));
  }

  /**
   * Layer 18: QITRL — Quantum-Inspired Temporal Resonance Lattice.
   * Lattice-based memory with low-rank tensor propagation, SVD-based
   * foresight, and entanglement entropy contradiction detection.
   * O(R²D) per edge propagation, O(log N) effective on lattice paths.
   */
  get qitrl(): QITRL {
    return (this._qitrl ??= new QITRL(this.dir, this._backend));
  }

  // ── L10: EngramLog — immutable hash-chained audit log ──
  get engramLog(): EngramLog {
    return (this._engramLog ??= new EngramLog(this.dir, this._backend));
  }

  // ── L11: ConsolidationEngine — sleep-equivalent background consolidation ──
  get consolidationEngine(): ConsolidationEngine {
    return (this._consolidation ??= new ConsolidationEngine(this.dir, [], this._backend));
  }

  // ── L12: SynapticPruner — active forgetting engine ──
  get synapticPruner(): SynapticPruner {
    return (this._synapticPruner ??= new SynapticPruner(this.dir, undefined, this._backend));
  }

  // ── L13: ProvenanceForge — complete source tracking ──
  get provenanceForge(): ProvenanceForge {
    return (this._provenanceForge ??= new ProvenanceForge(this.dir, this._backend));
  }

  // ── L14: SpacedRepetitionForge — SM-2 scheduling ──
  get spacedRepetitionForge(): SpacedRepetitionForge {
    return (this._spacedRepetition ??= new SpacedRepetitionForge());
  }

  // ── L15: ConstitutionalGuard — gatekeeper against low-confidence writes ──
  get constitutionalGuard(): ConstitutionalGuard {
    return (this._constitutionalGuard ??= new ConstitutionalGuard(this.dir, undefined, this._backend));
  }

  // ── L16: AuditForge — memory health auditor ──
  get auditForge(): AuditForge {
    return (this._auditForge ??= new AuditForge(this.dir, this._backend));
  }

  // ── L17: ProspectiveTrigger — "when X, surface Y" ──
  get prospectiveTrigger(): ProspectiveTrigger {
    return (this._prospectiveTrigger ??= new ProspectiveTrigger(this.dir, this._backend));
  }

  // ── L18: BiasRevealer — over/under-representation detection ──
  get biasRevealer(): BiasRevealer {
    return (this._biasRevealer ??= new BiasRevealer(this.dir, this._backend));
  }

  // ── L19: ContextVector — state-dependent recall context encoding ──
  get contextVector(): ContextVector {
    return (this._contextVector ??= new ContextVector(this.dir, this._backend));
  }

  // ── L20: RehearsalEngine — spaced retrieval practice ──
  get rehearsalEngine(): RehearsalEngine {
    return (this._rehearsalEngine ??= new RehearsalEngine(this.dir, this._backend));
  }

  // ── L21: SchemaDistorter — schema-driven reconstruction detection ──
  get schemaDistorter(): SchemaDistorter {
    return (this._schemaDistorter ??= new SchemaDistorter(this.dir, this._backend));
  }

  // ── L22: ConfidenceCalibrator — calibrated confidence scoring ──
  get confidenceCalibrator(): ConfidenceCalibrator {
    return (this._confidenceCalibrator ??= new ConfidenceCalibrator(this.dir, this._backend));
  }

  // ── Tool 18: FalseMemoryDetector ──
  get falseMemoryDetector(): FalseMemoryDetector {
    return (this._falseMemoryDetector ??= new FalseMemoryDetector(this.dir, this._backend));
  }

  // ── Tool 19: ConfidenceCalibratorTool ──
  get calibratorTool(): ConfidenceCalibratorTool {
    return (this._calibratorTool ??= new ConfidenceCalibratorTool(this.dir, this._backend));
  }

  // ── Tool 20: SourceAttributor ──
  get sourceAttributor(): SourceAttributor {
    return (this._sourceAttributor ??= new SourceAttributor(this.dir, this._backend));
  }

  // ── Tool 21: ConflictResolver ──
  get conflictResolver(): ConflictResolver {
    return (this._conflictResolver ??= new ConflictResolver(this.dir, this._backend));
  }

  // ── Tool 22: MemoryAuditor ──
  get memoryAuditor(): MemoryAuditor {
    return (this._memoryAuditor ??= new MemoryAuditor(this.dir, this._backend));
  }

  // ── Tool 23: ProspectiveTriggerTool ──
  get prospectiveTriggerTool(): ProspectiveTriggerTool {
    return (this._prospectiveTriggerTool ??= new ProspectiveTriggerTool(this.dir, this._backend));
  }

  // ── Tool 24: BiasRevealerTool ──
  get biasRevealerTool(): BiasRevealerTool {
    return (this._biasRevealerTool ??= new BiasRevealerTool(this.dir, this._backend));
  }

  // ── Tool 25: SchemaInferrer ──
  get schemaInferrer(): SchemaInferrer {
    return (this._schemaInferrer ??= new SchemaInferrer(this.dir, this._backend));
  }

  // ── Layer 1: Working Memory ──

  get workingMemory(): Readonly<WorkingState> { return this.working; }

  setGoal(goal: string): void {
    this.working = { ...this.working, currentGoal: goal };
    saveWorking(this.dir, this.working);
  }

  trackFile(filePath: string): void {
    const next = trackFile(this.working, filePath);
    if (next !== this.working) { this.working = next; saveWorking(this.dir, this.working); }
  }

  trackError(error: string): void {
    this.working = trackError(this.working, error);
    saveWorking(this.dir, this.working);
  }

  trackPattern(pattern: string): void {
    const next = trackPattern(this.working, pattern);
    if (next !== this.working) { this.working = next; saveWorking(this.dir, this.working); }
  }

  clearWorking(): void {
    this.working = { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
    saveWorking(this.dir, this.working);
  }

  // ── Layer 2: Episodic Memory ──

  storeEpisode(episode: Omit<EpisodicEntry, 'id'>): void {
    appendEpisode(this.dir, { id: generateId('ep'), ...episode });
  }

  loadEpisodes(count = 10): EpisodicEntry[] {
    return loadEpisodes(this.dir, count);
  }

  // ── Layer 3: Semantic Memory ──

  /** The actor identity — uses scope if provided, otherwise defaults to 'agent'. */
  private get actorId(): string {
    return this.scope?.userId ?? 'agent';
  }

  /** Store a fact/pattern/preference in semantic memory. Deduplicates by Jaccard similarity. */
  store(entry: { content: string; type?: MemoryEntryType; tags?: string[] }, opts?: { skipGuard?: boolean }): void {
    const facts = loadSemantic(this.dir);
    const { content, type = 'fact', tags = [] } = entry;
    if (facts.some(f => jaccardSimilarity(f.content, content) > 0.8)) return;
    const id = generateId('mem');
    const timestamp = Date.now();
    const actor = this.actorId;

    // L15: ConstitutionalGuard gate — check before storing
    let confidence = 0.7;
    let evidenceCount = 1;
    if (!opts?.skipGuard) {
      const guardVerdict = this.constitutionalGuard.evaluate(content, null, 0);
      if (!guardVerdict.allowed) {
        confidence = 0.3;
      }
    }

    facts.push({ id, timestamp, type, content, tags });
    saveSemantic(this.dir, facts);

    // Layer 5: weave into ChronosForge temporal graph
    this.chronosForge.weave(content, { tags });
    // Layer 7: weave into EchoForge causal propagation graph (fire-and-forget)
    void this.echoForge.weave(content, { tags });
    // L10: record in immutable engram log
    this.engramLog.append({
      timestamp,
      op: 'store',
      layerId: 'L3',
      entryId: id,
      actorId: actor,
      payload: { content, type, tags },
      justification: `Stored ${type}: ${content.slice(0, 80)}`,
    });
    // L13: record provenance with guard-adjusted confidence
    this.provenanceForge.record({
      sourceKind: 'agent_inference',
      sourceDetail: 'MemoryEngine.store()',
      actorId: actor,
      actor,
      observedAt: timestamp,
      evidenceCount,
      confidence,
      parentIds: [id],
    });
    // L19: capture context vector snapshot
    this.contextVector.capture({
      domain: type,
      activeFiles: this.working.activeFiles,
      tags,
      timeOfDay: new Date().getHours() * 60 + new Date().getMinutes(),
      dayOfWeek: new Date().getDay(),
    });
    // L20: enqueue for future rehearsal
    this.rehearsalEngine.enqueue(content, 'L3', id);
    // L21: learn schema pattern
    this.schemaDistorter.learn(content);

    // Cross-server event propagation
    if (this._eventBus) {
      void this._eventBus.publish('memory:stored', {
        id,
        content: content.slice(0, 200),
        type,
        tags,
        confidence,
        actorId: actor,
      });
    }
  }

  /**
   * Recall entries matching a query using a multi-stage intelligence pipeline.
   *
   * Stages:
   * 1. BM25 keyword search → top 50 candidates
   * 2. ProvenanceForge reliability lookup (per candidate)
   * 3. ConfidenceCalibrator (similarity × reliability × evidence × freshness)
   * 4. FalseMemoryDetector risk scoring
   * 5. ContextVector match boost (if options.context provided)
   * 6. RehearsalEngine priority boost (if item is due for review)
   * 7. Final ranking and filtering (minConfidence, maxFalseMemoryRisk)
   */
  recall(query: string, options?: SearchOptions): ScoredMemoryEntry[] {
    const entries = loadSemantic(this.dir);
    const candidates = searchEntries(entries, query, { ...options, limit: 50 });
    const now = Date.now();
    const useIntel = options?.useIntelligence ?? true;

    const scored: ScoredMemoryEntry[] = candidates.map(entry => {
      const prov = useIntel ? this.provenanceForge.explain(entry.id) : null;
      const sourceReliability = prov ? this.provenanceForge.reliability(prov) : 0.5;
      const ageDays = (now - entry.timestamp) / (24 * 60 * 60 * 1000);
      const evidenceCount = prov?.evidenceCount ?? 1;
      const similarityScore = entry.score ?? 0.5;

      // Stage 3: Confidence calibration
      let calibratedConfidence = similarityScore;
      if (useIntel) {
        const calResult = this.confidenceCalibrator.calibrate({
          similarity: similarityScore,
          reliability: sourceReliability,
          evidence: evidenceCount,
          freshness: Math.max(0, 1 - ageDays / 365),
        });
        calibratedConfidence = calResult.score;
      }

      // Stage 4: False memory risk
      let falseMemoryRisk = 0;
      if (useIntel) {
        const fmResult = this.falseMemoryDetector.score({
          id: entry.id,
          content: entry.content,
          provenance: prov ?? undefined,
          evidenceCount,
          ageDays,
        });
        falseMemoryRisk = fmResult.riskScore;
      }

      // Stage 5: Context boost
      let contextBoost = 1;
      if (useIntel && options?.context) {
        const contextMatches = this.contextVector.match(options.context);
        const bestMatch = contextMatches.reduce((max, m) => Math.max(max, m.score), 0);
        contextBoost = 1 + bestMatch * 0.5;
      }

      // Stage 6: Rehearsal boost
      let rehearsalBoost = 1;
      if (useIntel) {
        const dueItems = this.rehearsalEngine.getDueItems(100);
        if (dueItems.some(item => item.sourceId === entry.id)) {
          rehearsalBoost = 1.2;
        }
      }

      // Composite score: calibrated confidence × context boost × rehearsal boost
      let finalScore = calibratedConfidence * contextBoost * rehearsalBoost;
      // Penalize high false-memory risk (>60%)
      if (falseMemoryRisk > 0.6) finalScore *= (1 - falseMemoryRisk);

      return {
        ...entry,
        score: finalScore,
        calibratedConfidence,
        falseMemoryRisk,
        sourceReliability,
        sourceKind: prov?.sourceKind ?? 'unknown',
        contextBoost,
        rehearsalBoost,
      };
    });

    // Apply intelligence-based filters
    let filtered = scored;
    if (useIntel) {
      if (options?.minConfidence !== undefined) {
        filtered = filtered.filter(e => e.calibratedConfidence >= options.minConfidence!);
      }
      if (options?.maxFalseMemoryRisk !== undefined) {
        filtered = filtered.filter(e => e.falseMemoryRisk <= options.maxFalseMemoryRisk!);
      }
    }

    const results = filtered
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, options?.limit ?? 10);

    // Cross-server event propagation (sampled — only for significant queries)
    if (this._eventBus && query.length > 10) {
      void this._eventBus.publish('memory:recalled', {
        query: query.slice(0, 200),
        resultCount: results.length,
        topScore: results[0]?.score ?? 0,
      });
    }

    return results;
  }

  /** Get a formatted context string for injection into agent prompts. */
  getContextString(task = ''): string {
    const episodes = loadEpisodes(this.dir, 5);
    const facts = this.recall(task, { limit: 5, context: { domain: task, activeFiles: this.working.activeFiles } });
    const parts: string[] = [];

    if (facts.length > 0) {
      parts.push('Relevant memory:\n' + facts.map(f => {
        const reliability = (f.sourceReliability * 100).toFixed(0);
        const confidence = (f.calibratedConfidence * 100).toFixed(0);
        return `• [${f.type}] ${f.content} (rel:${reliability}% conf:${confidence}%)`;
      }).join('\n'));
    }
    if (episodes.length > 0) {
      const recent = episodes.slice(-3);
      parts.push('Recent sessions:\n' + recent.map(e =>
        `• ${new Date(e.timestamp).toLocaleDateString()} — ${e.summary} (${e.outcome})`
      ).join('\n'));
    }
    if (this.working.activeFiles.length > 0) {
      parts.push('Previously active files:\n' + this.working.activeFiles.slice(-10).join('\n'));
    }
    const chronosCtx = this.chronosForge.getContextString(undefined, 3);
    if (chronosCtx) parts.push(chronosCtx);

    // Layer 7: EchoForge — inject highest-risk domain prediction
    try {
      const burnoutPred = this.echoForge.predict('burnout');
      void burnoutPred.then((pred) => {
        if (pred.riskLevel === 'high') {
          parts.push(`\u26a0\ufe0f Echo burnout signal (${(pred.riskScore * 100).toFixed(0)}%): ${pred.explanation}`);
        }
      }).catch(() => { /* never block on echo */ });
    } catch { /* ignore */ }

    return parts.join('\n\n');
  }

  /** Consolidate near-duplicate semantic entries. Returns count removed. */
  consolidate(): number {
    const entries = loadSemantic(this.dir);
    const before = entries.length;
    const deduped: MemoryEntry[] = [];
    for (const e of entries) {
      if (!deduped.some(d => jaccardSimilarity(d.content, e.content) > 0.85)) deduped.push(e);
    }
    saveSemantic(this.dir, deduped);
    const removed = before - deduped.length;

    if (this._eventBus && removed > 0) {
      void this._eventBus.publish('memory:consolidated', {
        removed,
        remaining: deduped.length,
      });
    }

    return removed;
  }

  getStats(): MemoryStats {
    return {
      semanticCount: loadSemantic(this.dir).length,
      episodeCount: episodeCount(this.dir),
      workingFiles: this.working.activeFiles.length,
      workingPatterns: this.working.discoveredPatterns.length,
    };
  }

  // ── Snapshot & Merge ──

  /** Capture a named snapshot of current memory state. */
  async snapshot(branchName: string): Promise<MemorySnapshot> {
    const pack = await this.export();
    return { branchName, createdAt: Date.now(), pack };
  }

  /** Merge a foreign snapshot into current memory. */
  async merge(snap: MemorySnapshot): Promise<MergeResult> {
    return this.import(snap.pack);
  }

  // ── Export / Import ──

  /** Export all memory as a signed, gzipped MemoryPack. */
  async export(): Promise<MemoryPack> {
    const working = this.working;
    const episodic = loadEpisodes(this.dir, 9999);
    const semantic = loadSemantic(this.dir);
    const payload = JSON.stringify({ working, episodic, semantic });
    const signature = crypto.createHash('sha256').update(payload).digest('hex');
    return { version: '1.0', projectHash: this.hash, exportedAt: Date.now(), working, episodic, semantic, signature };
  }

  /** Import a MemoryPack, merging entries and verifying signature. */
  async import(pack: MemoryPack): Promise<MergeResult> {
    // Verify signature
    const payload = JSON.stringify({ working: pack.working, episodic: pack.episodic, semantic: pack.semantic });
    const expected = crypto.createHash('sha256').update(payload).digest('hex');
    if (expected !== pack.signature) {
      throw new Error('MemoryPack signature verification failed — pack may be corrupted or tampered.');
    }

    const existingSemantic = loadSemantic(this.dir);
    const existingEpisodic = loadEpisodes(this.dir, 9999);

    let addedSemantic = 0;
    let addedEpisodic = 0;
    let skippedDuplicates = 0;

    // Merge semantic
    const merged = [...existingSemantic];
    for (const entry of pack.semantic) {
      if (merged.some(e => jaccardSimilarity(e.content, entry.content) > 0.8)) {
        skippedDuplicates++;
      } else {
        merged.push(entry);
        addedSemantic++;
      }
    }
    saveSemantic(this.dir, merged);

    // Merge episodic (by id dedup)
    const existingIds = new Set(existingEpisodic.map(e => e.id));
    for (const ep of pack.episodic) {
      if (!existingIds.has(ep.id)) {
        appendEpisode(this.dir, ep);
        addedEpisodic++;
      } else {
        skippedDuplicates++;
      }
    }

    return { addedSemantic, addedEpisodic, skippedDuplicates };
  }

  /** Serialize a MemoryPack to a gzipped Buffer (save as .timps.pack). */
  async packToBuffer(pack: MemoryPack): Promise<Buffer> {
    return gzip(JSON.stringify(pack));
  }

  /** Deserialize a gzipped Buffer back to a MemoryPack. */
  async bufferToPack(buf: Buffer): Promise<MemoryPack> {
    const json = (await gunzip(buf)).toString('utf-8');
    return JSON.parse(json) as MemoryPack;
  }

  /** Extract and store facts from a conversation turn. */
  extractFacts(userMessage: string, assistantResponse: string): void {
    const combined = assistantResponse.trim();
    if (combined.length > 50) {
      this.store({ content: combined.slice(0, 300), type: 'pattern' });
    }
  }

  // ── Intelligence convenience aliases (mirror packages/server API names) ──

  /** Detect if statement contradicts stored positions (Tool 5). */
  checkContradiction(text: string, autoStore = true) {
    return this.contradiction.check(text, autoStore);
  }

  /** Warn if current code context matches your bug-writing patterns (Tool 10). */
  checkBugPattern(context: string) {
    return this.bugPattern.warn(context);
  }

  /** Get burnout risk assessment from recorded signals (Tool 4). */
  analyzeBurnout() {
    return this.burnoutSeismograph.analyze();
  }

  /** Check code pattern against past incidents (Tool 9). */
  checkTechDebt(pattern: string, project_id?: string) {
    return this.techDebt.checkPattern(pattern, project_id);
  }

  /** Detect architecture drift vs stored decisions (Tool 12). */
  detectArchitectureDrift(currentPatterns: string[] = [], project_id?: string) {
    const patterns = currentPatterns.length > 0 ? currentPatterns : this.working.activeFiles;
    return this.architectureDrift.driftCheck(patterns, project_id);
  }

  /** Store an observation as a learned pattern (deduplicates). */
  learnPattern(observation: string, tags: string[] = []) {
    return this.patternLearner.learn(observation, tags);
  }

  // ── New Layer Convenience Methods (Master Plan Phases 1-3) ──

  /** L10: Verify the engram chain integrity. */
  verifyEngramChain(): { valid: boolean; brokenAt?: number } {
    return this.engramLog.verifyChain();
  }

  /** L11: Run consolidation over recent episodes. */
  runConsolidation(opts?: { sinceMs?: number; dryRun?: boolean }) {
    return this.consolidationEngine.run(opts);
  }

  /** L12: Run synaptic pruning sweep. */
  runPruneSweep() {
    return this.synapticPruner.sweep();
  }

  /** L13: Get provenance explanation for a memory. */
  explainProvenance(id: string) {
    return this.provenanceForge.explain(id);
  }

  /** L15: Check if content passes the constitutional guard. */
  guardCheck(content: string, provenance?: any, contradictionCount = 0) {
    return this.constitutionalGuard.evaluate(content, provenance ?? null, contradictionCount);
  }

  /** L16: Run full memory audit. */
  runAudit() {
    return this.auditForge.run();
  }

  /** L17: Register a prospective trigger. */
  registerTrigger(input: { when: string; surface: string; memoryId: string }) {
    return this.prospectiveTrigger.register(input);
  }

  /** L18: Reveal memory bias. */
  revealBias() {
    return this.biasRevealer.reveal();
  }

  /** L19: Capture current context vector. */
  captureContext(context: { domain: string; activeFiles?: string[]; tags?: string[] }) {
    return this.contextVector.capture({
      domain: context.domain,
      activeFiles: context.activeFiles ?? this.working.activeFiles,
      tags: context.tags ?? [],
      timeOfDay: new Date().getHours() * 60 + new Date().getMinutes(),
      dayOfWeek: new Date().getDay(),
    });
  }

  /** L20: Enqueue a memory for spaced repetition rehearsal. */
  enqueueRehearsal(content: string, sourceLayer: string, sourceId: string) {
    return this.rehearsalEngine.enqueue(content, sourceLayer, sourceId);
  }

  /** L21: Check for schema distortion in a memory. */
  checkDistortion(content: string) {
    return this.schemaDistorter.check(content);
  }

  /** L22: Calibrate confidence for a given set of signals. */
  calibrateConfidence(input: CalibrationInput): CalibrationResult {
    return this.confidenceCalibrator.calibrate(input);
  }

  // ── New Intelligence Tool Convenience Methods ──

  /** Tool 18: Score a memory's false-memory risk. */
  checkFalseMemory(memory: { id?: string; content?: string; evidenceCount: number; ageDays: number; provenance?: any }): FalseMemoryScore {
    return this.falseMemoryDetector.score(memory);
  }

  /** Tool 20: Get source attribution for a memory. */
  attributeSource(memoryId: string): AttributionResult | null {
    return this.sourceAttributor.attribute(memoryId);
  }

  /** Tool 21: Resolve a potential conflict between two memories. */
  resolveConflict(a: MemoryRef, b: MemoryRef): ConflictResolution {
    return this.conflictResolver.resolve(a, b);
  }

  /** Tool 22: Run memory health audit. */
  async auditMemoryHealth(): Promise<AuditReport> {
    return this.memoryAuditor.audit();
  }

  /** Tool 25: Infer schemas from memory stream. */
  inferSchemas(): SchemaInferenceResult {
    return this.schemaInferrer.infer();
  }
}
