import * as path from 'node:path';
import { MemoryEngine } from '@timps/memory-core';
import type { MemoryEngineOptions } from '@timps/memory-core';
import type { MemoryEntry, WorkingMemory } from './types.js';
import { generateId } from '../utils/utils.js';
import { getMemoryDir } from '../config/config.js';

// CLI-specific sub-modules (unique features not in memory-core)
import { KnowledgeGraphStore } from './knowledgeGraph.js';
import { ContextCompressor } from './contextCompressor.js';
import { ProceduralMemory } from './proceduralMemory.js';
import { SelfReflector } from './selfReflector.js';
import { TemporalVersioning } from './temporalVersioning.js';
import { PredictivePrefetcher } from './predictivePrefetcher.js';
import { AffectiveMemory } from './affectiveMemory.js';
import { MemoryCoordinator } from './memoryCoordinator.js';
import { MemoryBenchmark } from './benchmark.js';
import { TeamMemory } from './teamMemory.js';
import { SessionBridge } from './sessionBridge.js';
import { SessionIngestionPipeline } from './sessionIngestion.js';

export class Memory {
  /** The canonical memory engine — single source of truth for all storage/retrieval. */
  readonly engine: MemoryEngine;
  private dir: string;

  // CLI-specific sub-modules
  private _graph?: KnowledgeGraphStore;
  private _compressor?: ContextCompressor;
  private _procedural?: ProceduralMemory;
  private _reflector?: SelfReflector;
  private _versioning?: TemporalVersioning;
  private _prefetcher?: PredictivePrefetcher;
  private _affective?: AffectiveMemory;
  private _coordinator?: MemoryCoordinator;
  private _benchmark?: MemoryBenchmark;
  private _team?: TeamMemory;
  private _sessionBridge?: SessionBridge;
  private _sessionIngestion?: SessionIngestionPipeline;

  private _turnCount = 0;

  constructor(projectPath: string, options?: MemoryEngineOptions) {
    this.dir = getMemoryDir(projectPath);
    this.engine = new MemoryEngine(projectPath, { ...options, dir: this.dir });
  }

  // ── CLI sub-module accessors (unique features not in memory-core) ──

  get graph(): KnowledgeGraphStore {
    return (this._graph ??= new KnowledgeGraphStore(this.dir));
  }
  get compressor(): ContextCompressor {
    return (this._compressor ??= new ContextCompressor());
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
  get team(): TeamMemory {
    return (this._team ??= new TeamMemory(path.basename(this.dir), 'default'));
  }
  get sessionBridge(): SessionBridge {
    return (this._sessionBridge ??= new SessionBridge(path.basename(this.dir), this.dir));
  }
  get sessionIngestion(): SessionIngestionPipeline {
    return (this._sessionIngestion ??= new SessionIngestionPipeline(this));
  }

  // ── Intelligence tools (delegated to MemoryEngine) ──
  get contradiction() { return this.engine.contradiction; }
  get burnoutSeismograph() { return this.engine.burnoutSeismograph; }
  get regretOracle() { return this.engine.regretOracle; }
  get techDebt() { return this.engine.techDebt; }
  get bugPattern() { return this.engine.bugPattern; }
  get apiArchaeologist() { return this.engine.apiArchaeologist; }
  get velocityTracker() { return this.engine.velocityTracker; }
  get architectureDrift() { return this.engine.architectureDrift; }
  get patternLearner() { return this.engine.patternLearner; }
  get falseMemoryDetector() { return this.engine.falseMemoryDetector; }
  get sourceAttributor() { return this.engine.sourceAttributor; }
  get conflictResolver() { return this.engine.conflictResolver; }
  get memoryAuditor() { return this.engine.memoryAuditor; }
  get schemaInferrer() { return this.engine.schemaInferrer; }
  get meetingGhost() { return this.engine.meetingGhost; }
  get deadReckoning() { return this.engine.deadReckoning; }
  get livingManifesto() { return this.engine.livingManifesto; }
  get relationshipIntelligence() { return this.engine.relationship; }
  get skillShadow() { return this.engine.skillShadow; }
  get curriculumArchitect() { return this.engine.curriculum; }
  get codebaseAnthropologist() { return this.engine.codebaseAnthropologist; }
  get institutionalMemory() { return this.engine.institutionalMemory; }

  // ── Forge layers (delegated to MemoryEngine) ──
  get chronosVeil() { return this.engine.chronosForge as any; }
  get echoVeil() { return this.engine.echoForge; }
  get sheafWeaver() { return this.engine.harmonicSheafWeaver; }
  get synapseQuench(): any { return null; }
  get aetherForge() { return this.engine.aetherForge; }
  get supraSheaf() { return this.engine.supraSheaf; }
  get qptw() { return this.engine.qptw; }
  get titanicForge() { return this.engine.titanicForge; }
  get qerw() { return this.engine.qerw; }
  get qisrd() { return this.engine.qisrd; }
  get eclipseForge() { return this.engine.eclipseForge; }
  get qitrl() { return this.engine.qitrl; }
  get engramLog() { return this.engine.engramLog; }
  get consolidationEngine() { return this.engine.consolidationEngine; }
  get synapticPruner() { return this.engine.synapticPruner; }
  get provenanceForge() { return this.engine.provenanceForge; }
  get spacedRepetitionForge() { return this.engine.spacedRepetitionForge; }
  get constitutionalGuard() { return this.engine.constitutionalGuard; }
  get auditForge() { return this.engine.auditForge; }
  get prospectiveTrigger() { return this.engine.prospectiveTrigger; }
  get biasRevealer() { return this.engine.biasRevealer; }
  get contextVector() { return this.engine.contextVector; }
  get rehearsalEngine() { return this.engine.rehearsalEngine; }
  get schemaDistorter() { return this.engine.schemaDistorter; }
  get confidenceCalibrator() { return this.engine.confidenceCalibrator; }

  // ── Layer 1: Working Memory (delegated to MemoryEngine) ──

  get workingMemory(): WorkingMemory {
    const w = this.engine.workingMemory;
    return {
      currentGoal: w.currentGoal,
      activeFiles: [...w.activeFiles],
      recentErrors: [...w.recentErrors],
      discoveredPatterns: [...w.discoveredPatterns],
    };
  }

  setGoal(goal: string) { this.engine.setGoal(goal); }
  trackFile(filePath: string) { this.engine.trackFile(filePath); }
  trackError(error: string) { this.engine.trackError(error); }
  trackPattern(pattern: string) { this.engine.trackPattern(pattern); }
  clearWorking() { this.engine.clearWorking(); }

  trackToolUsage(tool: string): void {
    this._turnCount++;
  }

  // ── Layer 2: Episodic Memory (delegated to MemoryEngine) ──

  storeEpisode(episode: any): void {
    this.engine.storeEpisode({
      summary: episode.summary || '',
      outcome: episode.outcome || 'unknown',
      timestamp: episode.timestamp || Date.now(),
      durationMs: episode.durationMs,
      errorCount: episode.errorsEncountered,
      tags: episode.taskType ? [episode.taskType] : undefined,
    });
    const files = episode.filesChanged || [];
    const taskType = episode.taskType || 'general';
    if (episode.summary) {
      this.prefetcher.createProfile(episode.summary, files, taskType);
    }
  }

  loadEpisodes(count = 10) { return this.engine.loadEpisodes(count); }

  get episodeCount(): number {
    return this.engine.getStats().episodeCount;
  }

  // ── Layer 3: Semantic Memory (delegated to MemoryEngine) ──

  storeFact(content: string, type: string = 'fact', tags: string[] = []): void {
    this.engine.store({ content, type: type as any, tags });
    this.graph.extractFromMemoryEntry({ id: '', timestamp: Date.now(), type: type as any, content, tags });
  }

  searchFacts(query: string, limit = 5): MemoryEntry[] {
    this._turnCount++;
    const results = this.engine.recall(query, { limit, useIntelligence: true });
    return results.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      type: r.type,
      content: r.content,
      tags: r.tags,
      score: r.score,
      calibratedConfidence: (r as any).calibratedConfidence,
      falseMemoryRisk: (r as any).falseMemoryRisk,
      sourceReliability: (r as any).sourceReliability,
      sourceKind: (r as any).sourceKind,
    })) as unknown as MemoryEntry[];
  }

  query(q: string, limit = 10): MemoryEntry[] {
    return q.trim() ? this.searchFacts(q, limit) : [];
  }

  getContextString(task = ''): string {
    return this.engine.getContextString(task);
  }

  getContextCompressed(task = '', tokenBudget = 2000): string {
    this.compressor.setBudget(tokenBudget);
    const rawEpisodes = this.loadEpisodes(10);
    const episodes: any[] = rawEpisodes.map(e => ({
      ...e,
      outcome: e.outcome === 'failure' ? 'failed' : e.outcome === 'unknown' ? 'partial' : e.outcome,
      filesChanged: [] as string[],
      toolsUsed: [] as string[],
    }));
    const proceduralTraces = this.procedural.retrieve(task, 3);
    const semantic = this.searchFacts(task, 20);
    const compressed = this.compressor.compress(semantic, episodes, proceduralTraces, task);
    const parts: string[] = [];
    parts.push(`[Memory] ${compressed.tokens}/${tokenBudget} tokens`);
    for (const entry of compressed.entries) {
      parts.push(`\u2022 [${entry.layer}] ${entry.content.slice(0, 150)} (conf: ${Math.round(entry.confidence * 100)}%)`);
    }
    return parts.join('\n');
  }

  getStats() {
    const base = this.engine.getStats();
    const graphStats = this.graph.getStats();
    return {
      ...base,
      proceduralCount: this.procedural.getStats().totalTraces,
      graphNodes: graphStats.nodeCount,
      graphEdges: graphStats.edgeCount,
    };
  }
  get stats() { return this.getStats(); }

  extractFacts(userMessage: string, assistantResponse: string): void {
    this.engine.extractFacts(userMessage, assistantResponse);
  }

  extractEntities(userMessage: string, assistantResponse: string): void {
    const conversationId = generateId('conv');
    this.graph.addNode(conversationId, 'concept', {
      userMessage: userMessage.slice(0, 200),
      assistantResponse: assistantResponse.slice(0, 200),
      timestamp: Date.now(),
    });
  }

  graphQuery(question: string): string {
    return this.graph.query(question).answer;
  }

  // ── Export / Import / Consolidate (delegated to MemoryEngine) ──

  clearAll(): void {
    this.engine.clearWorking();
  }

  exportMemory(): string {
    return JSON.stringify({ semantic: this.loadSemanticEntries(), working: this.engine.workingMemory });
  }

  importMemory(data: string): number {
    try {
      const parsed = JSON.parse(data);
      for (const entry of (parsed.semantic || [])) {
        this.engine.store({ content: entry.content, type: entry.type, tags: entry.tags || [] });
      }
      return (parsed.semantic || []).length;
    } catch { return 0; }
  }

  consolidate(): number {
    return this.engine.consolidate();
  }

  loadSemanticEntries(): MemoryEntry[] {
    return this.searchFacts('', 500);
  }

  // ── Decay compatibility getter (thin wrapper over engine operations) ──

  get decay(): { getStats(): { activeCount: number; archivedCount: number; avgImportance: number } } {
    return {
      getStats: () => {
        const stats = this.engine.getStats();
        return {
          activeCount: stats.semanticCount,
          archivedCount: 0,
          avgImportance: 5.0,
        };
      },
    };
  }

  // ── CLI-specific advanced operations ──

  runBenchmark(): string {
    return this.benchmark.compare();
  }

  applyDecay(): void {
    this.engine.consolidate();
    this.engine.synapticPruner.sweep();
  }

  getBeliefsTimeline(entryId: string): string | null {
    return this.versioning.howDidOpinionChange(entryId);
  }

  getRecentChanges(days = 7) {
    return this.versioning.getRecentChanges(days);
  }

  predictNext(goal: string) {
    return this.prefetcher.prefetch(goal, this.engine.workingMemory.activeFiles);
  }

  getAffectiveState() {
    return this.affective.getState();
  }

  runSelfAudit(errors?: string[], corrections?: string[]): void {
    const { auditResult, newFacts } = this.reflector.sessionEndAudit(
      this.engine.workingMemory.currentGoal || '',
      errors || this.engine.workingMemory.recentErrors,
      corrections || []
    );
    for (const fact of newFacts) {
      this.storeFact(fact, 'fact', ['self-audit']);
    }
  }

  queryKnowledgeGraph(question: string) {
    return this.graph.query(question);
  }

  multiHopQuery(startEntity: string, relations: string[]) {
    return this.graph.traverse(startEntity, relations);
  }

  getChronosContext(domain?: string, limit = 4): string {
    return this.engine.chronosForge.getContextString(domain as any, limit);
  }

  forecastRisk(domain = 'burnout'): string {
    try {
      const events = this.engine.chronosForge.getContextString(domain as any, 30);
      if (!events) return `No ${domain} signals recorded yet.`;
      return `ChronosForge foresight: ${domain} risk based on recent signals.`;
    } catch {
      return `No ${domain} signals recorded yet.`;
    }
  }
}
