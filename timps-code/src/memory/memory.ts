// ── TIMPS Code — 3-Layer Memory System (v2) ──
// Layer 1: Working memory (current session, in-process)
// Layer 2: Episodic memory (conversation summaries)
// Layer 3: Semantic memory (facts, patterns, conventions — persistent)
// Layer 4 (NEW): Procedural memory (auto-extracted workflows)

// Also adds: hybrid retrieval, decay, knowledge graph, versioning, benchmark

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getMemoryDir } from '../config/config.js';
import type { MemoryEntry, EpisodicMemory, WorkingMemory } from './types.js';
import { generateId } from '../utils/utils.js';

// Intelligence tools from @timps/memory-core
import {
  ContradictionDetector,
  BurnoutSeismograph,
  RegretOracle,
  TechDebtSeismograph,
  BugPatternProphet,
  APIArchaeologist,
  VelocityTracker,
  ArchitectureDriftDetector,
  PatternLearner,
  FalseMemoryDetector,
  SourceAttributor,
  ConflictResolver,
  MemoryAuditor,
  SchemaInferrer,
  MeetingGhost,
  DeadReckoning,
  LivingManifesto,
  RelationshipIntelligence,
  SkillShadow,
  CurriculumArchitect,
  CodebaseAnthropologist,
  InstitutionalMemory,
} from '@timps/memory-core';

// ── NEW: Extended memory components ──
import { HybridRetriever } from './hybridRetriever.js';
import { KnowledgeGraphStore } from './knowledgeGraph.js';
import { ContextCompressor } from './contextCompressor.js';
import { DecayEngine, ImportanceScorer } from './decayEngine.js';
import { ProceduralMemory } from './proceduralMemory.js';
import { SelfReflector } from './selfReflector.js';
import { TemporalVersioning } from './temporalVersioning.js';
import { PredictivePrefetcher } from './predictivePrefetcher.js';
import { AffectiveMemory } from './affectiveMemory.js';
import { MemoryCoordinator } from './memoryCoordinator.js';
import { MemoryBenchmark } from './benchmark.js';
import { ChronosVeil } from './chronosVeil.js';
import type { ChronosDomain } from './chronosVeil.js';
import { EchoForge } from '@timps/memory-core';
import { HarmonicSheafWeaver } from '@timps/memory-core';
import { AetherForgeERL, SupraSheaf, QPTW, TitanicForge, QERW, QISRD, EclipseForge, QITRL } from '@timps/memory-core';
import {
  EngramLog, ConsolidationEngine, SynapticPruner, ProvenanceForge,
  SpacedRepetitionForge, ConstitutionalGuard, AuditForge,
  ProspectiveTrigger, BiasRevealer, ContextVector, RehearsalEngine,
  SchemaDistorter, ConfidenceCalibrator,
} from '@timps/memory-core';
import { SynapseQuench } from './synapseQuench.js';

export class Memory {
  private dir: string;
  private semanticFile: string;
  private episodicFile: string;
  private workingFile: string;
  private working: WorkingMemory;

  // ── Intelligence tool instances (lazy-init) ──
  private _contradiction?: ContradictionDetector;
  private _burnout?: BurnoutSeismograph;
  private _regret?: RegretOracle;
  private _techDebt?: TechDebtSeismograph;
  private _bugPattern?: BugPatternProphet;
  private _api?: APIArchaeologist;
  private _velocity?: VelocityTracker;
  private _architecture?: ArchitectureDriftDetector;
  private _patterns?: PatternLearner;
  private _falseMemory?: FalseMemoryDetector;
  private _sourceAttributor?: SourceAttributor;
  private _conflictResolver?: ConflictResolver;
  private _memoryAuditor?: MemoryAuditor;
  private _schemaInferrer?: SchemaInferrer;
  private _meetingGhost?: MeetingGhost;
  private _deadReckoning?: DeadReckoning;
  private _livingManifesto?: LivingManifesto;
  private _relationship?: RelationshipIntelligence;
  private _skillShadow?: SkillShadow;
  private _curriculum?: CurriculumArchitect;
  private _codebaseAnthropologist?: CodebaseAnthropologist;
  private _institutionalMemory?: InstitutionalMemory;

  // ── NEW: Extended memory components ──
  private _retriever?: HybridRetriever;
  private _graph?: KnowledgeGraphStore;
  private _compressor?: ContextCompressor;
  private _decay?: DecayEngine;
  private _procedural?: ProceduralMemory;
  private _reflector?: SelfReflector;
  private _versioning?: TemporalVersioning;
  private _prefetcher?: PredictivePrefetcher;
  private _affective?: AffectiveMemory;
  private _coordinator?: MemoryCoordinator;
  private _benchmark?: MemoryBenchmark;

  // ── Layer 5: ChronosVeil (temporal causal weaver) ──
  private _chronos?: ChronosVeil;

  // ── Layer 7: EchoForge (causal echo propagation + reservoir computing) ──
  private _echoForge?: EchoForge;

  // ── Layer 8: SynapseQuench (deterministic spectral propagation + phase quenching) ──
  private _synapseQuench?: SynapseQuench;

  // ── Layer 9: HarmonicSheafWeaver (sheaf cohomology + eigenmode foresight) ──
  private _sheafWeaver?: HarmonicSheafWeaver;

  // ── Layer 10: AetherForgeERL (epistemic resonance lattice) ──
  private _aether?: AetherForgeERL;
  private _supra?: SupraSheaf;
  private _qptw?: QPTW;
  private _titanic?: TitanicForge;
  private _qerw?: QERW;
  private _qisrd?: QISRD;

  // ── Layer 17: EclipseForge (temporal sheaf resonator) ──
  private _eclipse?: EclipseForge;

  // ── Layer 18: QITRL (quantum-inspired temporal resonance lattice) ──
  private _qitrl?: QITRL;

  // ── Operational layers (L10-L22) ──
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

  // Turn counter for self-reflection
  private _turnCount = 0;

  constructor(projectPath: string) {
    this.dir = getMemoryDir(projectPath);
    this.semanticFile = path.join(this.dir, 'semantic.json');
    this.episodicFile = path.join(this.dir, 'episodes.jsonl');
    this.workingFile = path.join(this.dir, 'working.json');
    this.working = this.loadWorking();
  }

  // ── Lazy-init all extended components ──

  get retriever(): HybridRetriever {
    return (this._retriever ??= new HybridRetriever(this.dir));
  }

  get graph(): KnowledgeGraphStore {
    return (this._graph ??= new KnowledgeGraphStore(this.dir));
  }

  get compressor(): ContextCompressor {
    return (this._compressor ??= new ContextCompressor());
  }

  get decay(): DecayEngine {
    return (this._decay ??= new DecayEngine(this.dir));
  }

  get procedural(): ProceduralMemory {
    return (this._procedural ??= new ProceduralMemory(this.dir));
  }

  get reflector(): SelfReflector {
    return (this._reflector ??= new SelfReflector(this.dir));
  }

  get versioning(): TemporalVersioning {
    return (this._versioning ??= new TemporalVersioning(this.dir));
  }

  get prefetcher(): PredictivePrefetcher {
    return (this._prefetcher ??= new PredictivePrefetcher(this.dir));
  }

  get affective(): AffectiveMemory {
    return (this._affective ??= new AffectiveMemory(this.dir));
  }

  get coordinator(): MemoryCoordinator {
    return (this._coordinator ??= new MemoryCoordinator(this.dir));
  }

  get benchmark(): MemoryBenchmark {
    return (this._benchmark ??= new MemoryBenchmark(this.dir));
  }

  /** Layer 5: ChronosVeil — bi-temporal causal event graph. */
  get chronosVeil(): ChronosVeil {
    return (this._chronos ??= new ChronosVeil(this.dir));
  }

  /** Layer 7: EchoVeil — reservoir-computing echo propagation (alias for echoForge). */
  get echoVeil(): EchoForge {
    return (this._echoForge ??= new EchoForge(this.dir));
  }

  /** Layer 8: SynapseQuench — deterministic spectral propagation with phase-based quenching. */
  get synapseQuench(): SynapseQuench {
    return (this._synapseQuench ??= new SynapseQuench(this.dir));
  }

  /** Layer 9: HarmonicSheafWeaver — sheaf cohomology + eigenmode foresight. */
  get sheafWeaver(): HarmonicSheafWeaver {
    return (this._sheafWeaver ??= new HarmonicSheafWeaver(this.dir));
  }

  /** Layer 10: AetherForgeERL — epistemic resonance lattice. */
  get aetherForge(): AetherForgeERL {
    return (this._aether ??= new AetherForgeERL(this.dir));
  }

  /** Layer 11: SupraSheaf — cross-layer sheaf coordinator. */
  get supraSheaf(): SupraSheaf {
    if (!this._supra) {
      this._supra = new SupraSheaf();
      this._supra.setForgeRefs({
        echo: {
          getNodes: () => {
            try { return Object.values((this.echoVeil as any)['store'].nodes ?? {}); }
            catch { return []; }
          },
        },
        aether: {
          getNodes: () => {
            try { return Object.values((this.aetherForge as any)['store'].nodes ?? {}); }
            catch { return []; }
          },
        },
      });
    }
    return this._supra;
  }

  /** Layer 12: QPTW — Quantum-Phase Temporal Weaver. */
  get qptw(): QPTW {
    return (this._qptw ??= new QPTW(this.dir));
  }

  /** Layer 13: TitanicForge — Neural Surprise-Augmented Sheaf Weaver. */
  get titanicForge(): TitanicForge {
    return (this._titanic ??= new TitanicForge(this.dir));
  }

  get qerw(): QERW {
    return (this._qerw ??= new QERW(this.dir));
  }

  get qisrd(): QISRD {
    return (this._qisrd ??= new QISRD(this.dir));
  }

  /** Layer 17: EclipseForge — temporal sheaf resonator with temporal stalks + spectral resonance. */
  get eclipseForge(): EclipseForge {
    return (this._eclipse ??= new EclipseForge(this.dir));
  }

  /** Layer 18: QITRL — quantum-inspired temporal resonance lattice with low-rank tensor propagation. */
  get qitrl(): QITRL {
    return (this._qitrl ??= new QITRL(this.dir));
  }

  // ── Intelligence tools (each stores its own file in this.dir) ──

  get contradiction(): ContradictionDetector {
    return (this._contradiction ??= new ContradictionDetector(this.dir));
  }
  get burnoutSeismograph(): BurnoutSeismograph {
    return (this._burnout ??= new BurnoutSeismograph(this.dir));
  }
  get regretOracle(): RegretOracle {
    return (this._regret ??= new RegretOracle(this.dir));
  }
  get techDebt(): TechDebtSeismograph {
    return (this._techDebt ??= new TechDebtSeismograph(this.dir));
  }
  get bugPattern(): BugPatternProphet {
    return (this._bugPattern ??= new BugPatternProphet(this.dir));
  }
  get apiArchaeologist(): APIArchaeologist {
    return (this._api ??= new APIArchaeologist(this.dir));
  }
  get velocityTracker(): VelocityTracker {
    return (this._velocity ??= new VelocityTracker(this.dir));
  }
  get architectureDrift(): ArchitectureDriftDetector {
    return (this._architecture ??= new ArchitectureDriftDetector(this.dir));
  }
  get patternLearner(): PatternLearner {
    return (this._patterns ??= new PatternLearner(this.dir));
  }

  // ── New intelligence tool getters ──

  get falseMemoryDetector(): FalseMemoryDetector {
    return (this._falseMemory ??= new FalseMemoryDetector(this.dir));
  }
  get sourceAttributor(): SourceAttributor {
    return (this._sourceAttributor ??= new SourceAttributor(this.dir));
  }
  get conflictResolver(): ConflictResolver {
    return (this._conflictResolver ??= new ConflictResolver(this.dir));
  }
  get memoryAuditor(): MemoryAuditor {
    return (this._memoryAuditor ??= new MemoryAuditor(this.dir));
  }
  get schemaInferrer(): SchemaInferrer {
    return (this._schemaInferrer ??= new SchemaInferrer(this.dir));
  }
  get meetingGhost(): MeetingGhost {
    return (this._meetingGhost ??= new MeetingGhost(this.dir));
  }
  get deadReckoning(): DeadReckoning {
    return (this._deadReckoning ??= new DeadReckoning(this.dir));
  }
  get livingManifesto(): LivingManifesto {
    return (this._livingManifesto ??= new LivingManifesto(this.dir));
  }
  get relationshipIntelligence(): RelationshipIntelligence {
    return (this._relationship ??= new RelationshipIntelligence(this.dir));
  }
  get skillShadow(): SkillShadow {
    return (this._skillShadow ??= new SkillShadow(this.dir));
  }
  get curriculumArchitect(): CurriculumArchitect {
    return (this._curriculum ??= new CurriculumArchitect(this.dir));
  }
  get codebaseAnthropologist(): CodebaseAnthropologist {
    return (this._codebaseAnthropologist ??= new CodebaseAnthropologist(this.dir));
  }
  get institutionalMemory(): InstitutionalMemory {
    return (this._institutionalMemory ??= new InstitutionalMemory(this.dir));
  }

  // ── Operational layer getters (L10-L22) ──

  get engramLog(): EngramLog {
    return (this._engramLog ??= new EngramLog(this.dir));
  }
  get consolidationEngine(): ConsolidationEngine {
    return (this._consolidation ??= new ConsolidationEngine(this.dir, []));
  }
  get synapticPruner(): SynapticPruner {
    return (this._synapticPruner ??= new SynapticPruner(this.dir));
  }
  get provenanceForge(): ProvenanceForge {
    return (this._provenanceForge ??= new ProvenanceForge(this.dir));
  }
  get spacedRepetitionForge(): SpacedRepetitionForge {
    return (this._spacedRepetition ??= new SpacedRepetitionForge());
  }
  get constitutionalGuard(): ConstitutionalGuard {
    return (this._constitutionalGuard ??= new ConstitutionalGuard(this.dir));
  }
  get auditForge(): AuditForge {
    return (this._auditForge ??= new AuditForge(this.dir));
  }
  get prospectiveTrigger(): ProspectiveTrigger {
    return (this._prospectiveTrigger ??= new ProspectiveTrigger(this.dir));
  }
  get biasRevealer(): BiasRevealer {
    return (this._biasRevealer ??= new BiasRevealer(this.dir));
  }
  get contextVector(): ContextVector {
    return (this._contextVector ??= new ContextVector(this.dir));
  }
  get rehearsalEngine(): RehearsalEngine {
    return (this._rehearsalEngine ??= new RehearsalEngine(this.dir));
  }
  get schemaDistorter(): SchemaDistorter {
    return (this._schemaDistorter ??= new SchemaDistorter(this.dir));
  }
  get confidenceCalibrator(): ConfidenceCalibrator {
    return (this._confidenceCalibrator ??= new ConfidenceCalibrator(this.dir));
  }

  // ── Layer 1: Working Memory ──

  get workingMemory(): WorkingMemory { return this.working; }

  setGoal(goal: string): void {
    this.working.currentGoal = goal;
    this.working.taskStartTime = Date.now();
    this.saveWorking();
  }

  trackFile(filePath: string): void {
    if (!this.working.activeFiles.includes(filePath)) {
      this.working.activeFiles.push(filePath);
      if (this.working.activeFiles.length > 20) this.working.activeFiles.shift();
      this.saveWorking();
    }
  }

  trackError(error: string): void {
    this.working.recentErrors.push(error.slice(0, 200));
    if (this.working.recentErrors.length > 10) this.working.recentErrors.shift();
    this.saveWorking();
  }

  trackPattern(pattern: string): void {
    if (!this.working.discoveredPatterns.includes(pattern)) {
      this.working.discoveredPatterns.push(pattern);
      if (this.working.discoveredPatterns.length > 20) this.working.discoveredPatterns.shift();
      this.saveWorking();
    }
  }

  trackToolUsage(tool: string): void {
    if (!this.working.toolsUsedSequence) this.working.toolsUsedSequence = [];
    this.working.toolsUsedSequence.push(tool);
    if (this.working.toolsUsedSequence.length > 100) this.working.toolsUsedSequence.shift();
    this.affective.updateFromToolSequence(this.working.toolsUsedSequence);
  }

  clearWorking(): void {
    this.working = { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
    this.saveWorking();
  }

  // ── Layer 2: Episodic Memory ──

  storeEpisode(episode: EpisodicMemory): void {
    fs.appendFileSync(this.episodicFile, JSON.stringify(episode) + '\n', 'utf-8');
    this.trimFile(this.episodicFile, 100);

    // Layer 5: ingest into ChronosVeil for temporal graph
    // Layer 7: weave into EchoForge for causal echo propagation
    const summary = episode.summary || '';
    const domain: ChronosDomain = episode.taskType === 'burnout' ? 'burnout'
      : episode.taskType === 'relationship' ? 'relationship'
      : episode.taskType === 'decision' ? 'decision'
      : 'general';
    if (summary.length > 0) {
      this.chronosVeil.ingest(summary, 'episodic', ['episode'], undefined, domain);
      void this.echoVeil.weave(summary, { domain: domain as any, tags: ['episode'] });
      try { this.aetherForge.weave(summary, { domain: domain as any, tags: ['episode'] }); } catch { /* ignore */ }
    }

    const files = episode.filesChanged || [];
    const taskType = episode.taskType || 'general';
    this.prefetcher.createProfile(summary, files, taskType);

    if (episode.outcome === 'success' && this.working.toolsUsedSequence && this.working.toolsUsedSequence.length > 1) {
      this.procedural.extractFromExecution(
        this.working.currentGoal || episode.summary,
        taskType,
        this.working.toolsUsedSequence.map(t => ({ tool: t, args: {} })),
        episode.outcome
      );
    }
  }

  loadEpisodes(count = 10): EpisodicMemory[] {
    try {
      if (!fs.existsSync(this.episodicFile)) return [];
      const lines = fs.readFileSync(this.episodicFile, 'utf-8').trim().split('\n');
      return lines.slice(-count).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  }

  get episodeCount(): number {
    try {
      if (!fs.existsSync(this.episodicFile)) return 0;
      return fs.readFileSync(this.episodicFile, 'utf-8').trim().split('\n').filter(l => l.trim()).length;
    } catch { return 0; }
  }

  // ── Layer 3: Semantic Memory ──

  storeFact(content: string, type: MemoryEntry['type'] = 'fact', tags: string[] = []): void {
    const facts = this.loadSemanticEntries();
    if (facts.some(f => this.similarity(f.content, content) > 0.8)) return;

    const importance = ImportanceScorer.judgeSync(content, type);

    facts.push({
      id: generateId('mem'),
      timestamp: Date.now(),
      type,
      content,
      tags,
      importance,
      confidence: 0.5,
      accessCount: 0,
      lastAccessed: Date.now(),
    });

    if (facts.length > 500) {
      const archived = this.decay.applyDecay();
      if (archived.archived > 0) void archived;
    }

    fs.writeFileSync(this.semanticFile, JSON.stringify(facts, null, 2), 'utf-8');

    this.graph.extractFromMemoryEntry(facts[facts.length - 1]);
    this.retriever.invalidateCache();
  }

  searchFacts(query: string, limit = 5): MemoryEntry[] {
    this._turnCount++;
    if (this._turnCount % 10 === 0) {
      const auditResult = this.reflector.audit(this.working.recentErrors, []);
      if (auditResult.questions.length > 0) void auditResult;
    }

    const results = this.retriever.search(query, limit);

    for (const r of results) {
      this.decay.access(r.entry.id);
    }

    return results.map(r => r.entry);
  }

  /**
   * Returns ChronosVeil context for the given domain, formatted for prompt injection.
   * Pass undefined for domain to get cross-domain temporal context.
   */
  getChronosContext(domain?: ChronosDomain, limit = 4): string {
    return this.chronosVeil.query(domain ? `${domain} signals` : 'recent', 5)
      .resolvedEvents
      .slice(0, limit)
      .map(e => `• [chrono:${e.domain}/${e.layer}] ${e.content.slice(0, 140)}`)
      .join('\n');
  }

  /**
   * Run MC foresight rollout via ChronosVeil for the given signal domain.
   */
  forecastRisk(domain: ChronosDomain = 'burnout'): string {
    const events = this.chronosVeil.query(`${domain} signals`, 30).resolvedEvents;
    if (events.length === 0) return `No ${domain} signals recorded yet.`;
    const score = events.reduce((s, e) => s + e.importance, 0) / events.length;
    const level = score > 7 ? 'high' : score > 4 ? 'medium' : 'low';
    return `ChronosVeil foresight: ${domain} risk is ${level} (signal strength ${(score / 10 * 100).toFixed(0)}% from ${events.length} events).`;
  }

  getContextString(task = ''): string {
    const episodes = this.loadEpisodes(5);
    const facts = this.searchFacts(task, 5);
    const parts: string[] = [];

    if (facts.length > 0) {
      parts.push('Relevant memory:\n' + facts.map(f => `• [${f.type}] ${f.content}`).join('\n'));
    }

    if (episodes.length > 0) {
      const recent = episodes.slice(-3);
      parts.push('Recent sessions:\n' + recent.map(e =>
        `• ${new Date(e.timestamp).toLocaleDateString()} — ${e.summary} (${e.outcome})`
      ).join('\n'));
    }

    const procedural = this.procedural.retrieve(task, 1);
    if (procedural.length > 0) {
      parts.push('Workflow template:\n' + this.procedural.generatePlanTemplate(procedural[0]));
    }

    if (this.working.activeFiles.length > 0) {
      parts.push('Previously active files:\n' + this.working.activeFiles.slice(-10).join('\n'));
    }

    // Layer 5: ChronosVeil temporal context
    const chronosCtx = this.getChronosContext(undefined, 3);
    if (chronosCtx) parts.push('Temporal signals:\n' + chronosCtx);

    return parts.join('\n\n');
  }

  getContextCompressed(task = '', tokenBudget = 2000): string {
    this.compressor.setBudget(tokenBudget);
    const episodes = this.loadEpisodes(10);
    const proceduralTraces = this.procedural.retrieve(task, 3);
    const semantic = this.searchFacts(task, 20);

    const compressed = this.compressor.compress(semantic, episodes, proceduralTraces, task);

    const parts: string[] = [];
    parts.push(`[Memory] ${compressed.tokens}/${tokenBudget} tokens`);
    for (const entry of compressed.entries) {
      const conf = Math.round(entry.confidence * 100);
      parts.push(`• [${entry.layer}] ${entry.content.slice(0, 150)} (conf: ${conf}%)`);
    }

    return parts.join('\n');
  }

  getStats(): { semanticCount: number; episodeCount: number; workingFiles: number; proceduralCount: number; graphNodes: number } {
    const semantic = this.loadSemanticEntries();
    return {
      semanticCount: semantic.length,
      episodeCount: this.episodeCount,
      workingFiles: this.working.activeFiles.length,
      proceduralCount: this.procedural.getStats().totalTraces,
      graphNodes: this.graph.getStats().nodeCount,
    };
  }

  get stats(): { semanticCount: number; episodeCount: number; workingFiles: number; proceduralCount: number; graphNodes: number } {
    return this.getStats();
  }

  extractFacts(userMessage: string, assistantResponse: string): void {
    const combined = assistantResponse.trim();
    if (combined.length > 50) {
      this.storeFact(combined.slice(0, 300), 'pattern', []);
    }
  }

  extractEntities(userMessage: string, assistantResponse: string): void {
    const graph = this.graph;
    const conversationId = generateId('conv');
    graph.addNode(conversationId, 'concept', { userMessage: userMessage.slice(0, 200), assistantResponse: assistantResponse.slice(0, 200), timestamp: Date.now() });

    const topics = this.extractTopics(userMessage + ' ' + assistantResponse);
    for (const topic of topics) {
      graph.addNode(topic, 'concept', {});
      graph.addEdge(conversationId, 'about', topic);
    }
  }

  private extractTopics(text: string): string[] {
    const topics: string[] = [];
    const seen = new Set<string>();

    const patterns = [
      /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g,
      /\b(?:who|what|how|why|where|when|tell\sme|explain|describe|what\sis|what\sare)\s+(.+?)(?:\?|\.|$)/gi,
    ];

    for (const line of text.split(/[.?!\n]+/)) {
      const lower = line.toLowerCase().trim();
      if (!lower || lower.length < 5) continue;

      const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'i', 'me', 'my', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'we', 'us', 'our', 'they', 'them', 'their', 'this', 'that', 'these', 'those', 'please', 'tell']);

      const words = line.split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));
      const key = words.slice(0, 4).join(' ');
      if (!seen.has(key) && words.length >= 2) {
        seen.add(key);
        topics.push(key);
      }
    }

    return topics.slice(0, 10);
  }

  graphQuery(question: string): string {
    return this.graph.query(question).answer;
  }

  query(q: string, limit = 10): MemoryEntry[] {
    return q.trim() ? this.searchFacts(q, limit) : this.loadSemanticEntries().slice(-limit);
  }

  clearAll(): void {
    try { fs.writeFileSync(this.semanticFile, '[]', 'utf-8'); } catch { /* ignore */ }
    this.clearWorking();
    this.procedural.clear();
    this.graph.clearGraph();
  }

  exportMemory(): string {
    return JSON.stringify({
      semantic: this.loadSemanticEntries(),
      episodes: this.loadEpisodes(9999),
      working: this.working,
      procedural: this.procedural.getStats(),
      graph: this.graph.exportGraph(),
    }, null, 2);
  }

  importMemory(data: string): number {
    try {
      const parsed = JSON.parse(data);
      const entries: MemoryEntry[] = parsed.semantic || [];
      fs.writeFileSync(this.semanticFile, JSON.stringify(entries, null, 2), 'utf-8');
      this.retriever.invalidateCache();
      return entries.length;
    } catch { return 0; }
  }

  consolidate(): number {
    const entries = this.loadSemanticEntries();
    const before = entries.length;
    const deduped: MemoryEntry[] = [];
    for (const e of entries) {
      if (!deduped.some(d => this.similarity(d.content, e.content) > 0.85)) {
        deduped.push(e);
      }
    }
    fs.writeFileSync(this.semanticFile, JSON.stringify(deduped, null, 2), 'utf-8');
    this.retriever.invalidateCache();
    return before - deduped.length;
  }

  // ── NEW: Advanced Operations ──

  runBenchmark(): string {
    return this.benchmark.compare();
  }

  applyDecay(): void {
    this.decay.applyDecay();
    this.retriever.invalidateCache();
  }

  getBeliefsTimeline(entryId: string): string | null {
    return this.versioning.howDidOpinionChange(entryId);
  }

  getRecentChanges(days = 7): { entity: string; was: string; now: string; changedAt: number }[] {
    return this.versioning.getRecentChanges(days);
  }

  predictNext(goal: string): { episodicSummaries: string[]; semanticFacts: string[]; confidence: number } {
    return this.prefetcher.prefetch(goal, this.working.activeFiles);
  }

  getAffectiveState(): { arousal: number; valence: number; cognitiveLoad: number } {
    return this.affective.getState();
  }

  runSelfAudit(errors?: string[], corrections?: string[]): void {
    const { auditResult, newFacts } = this.reflector.sessionEndAudit(
      this.working.currentGoal || '', errors || this.working.recentErrors, corrections || []
    );
    for (const fact of newFacts) {
      this.storeFact(fact, 'fact', ['self-audit']);
    }
    void auditResult;
  }

  queryKnowledgeGraph(question: string): { answer: string; confidence: number; hops: number } {
    return this.graph.query(question);
  }

  multiHopQuery(startEntity: string, relations: string[]): { path: string[]; score: number }[] {
    return this.graph.traverse(startEntity, relations);
  }

  loadSemanticEntries(): MemoryEntry[] {
    try {
      if (!fs.existsSync(this.semanticFile)) return [];
      return JSON.parse(fs.readFileSync(this.semanticFile, 'utf-8'));
    } catch { return []; }
  }

  private loadWorking(): WorkingMemory {
    try {
      if (!fs.existsSync(this.workingFile)) return { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
      return JSON.parse(fs.readFileSync(this.workingFile, 'utf-8'));
    } catch { return { activeFiles: [], recentErrors: [], discoveredPatterns: [] }; }
  }

  private saveWorking(): void {
    fs.writeFileSync(this.workingFile, JSON.stringify(this.working, null, 2), 'utf-8');
  }

  private trimFile(file: string, maxLines: number): void {
    try {
      const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
      if (lines.length > maxLines) {
        fs.writeFileSync(file, lines.slice(-maxLines).join('\n') + '\n', 'utf-8');
      }
    } catch { /* ignore */ }
  }

  private similarity(a: string, b: string): number {
    const al = a.toLowerCase(), bl = b.toLowerCase();
    if (al === bl) return 1;
    const aWords = al.split(/\s+/).filter(w => w.length > 1);
    const bWords = bl.split(/\s+/).filter(w => w.length > 1);
    if (aWords.length === 0 || bWords.length === 0) return 0;
    const wordSet = new Set(aWords);
    const wordOverlap = bWords.filter(w => wordSet.has(w)).length;
    const jaccard = wordOverlap / (wordSet.size + bWords.length - wordOverlap);
    const bigrams = (s: string) => { const r = new Set<string>(); for (let i = 0; i < s.length - 1; i++) r.add(s.slice(i, i + 2)); return r; };
    const aBigrams = bigrams(al), bBigrams = bigrams(bl);
    const intersection = new Set([...aBigrams].filter(x => bBigrams.has(x)));
    const bigramSim = intersection.size / Math.max(aBigrams.size + bBigrams.size - intersection.size, 1);
    return jaccard * 0.6 + bigramSim * 0.4;
  }
}