import * as path from 'node:path';
import { MemoryEngine, MemoryClient, MemoryBranchStore } from '@timps-ai/memory-core';
import type { MemoryEngineOptions, MemoryClientOptions } from '@timps-ai/memory-core';
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

export interface MemoryOptions extends MemoryEngineOptions {
  /** Remote MemoryServer URL. When set, MemoryClient is used instead of local MemoryEngine. */
  remoteUrl?: string;
  /** Auth token for remote MemoryServer. */
  remoteToken?: string;
  /** Options for the MemoryClient when using remote mode. */
  clientOptions?: Omit<MemoryClientOptions, 'baseUrl' | 'token'>;
}

export class Memory {
  /** The canonical memory engine — single source of truth for all storage/retrieval. */
  readonly engine: MemoryEngine | null;
  /** The MemoryClient used when in remote mode. */
  readonly client: MemoryClient | null;
  private dir: string;
  private remoteMode: boolean;

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
  private _branchStore?: MemoryBranchStore;

  private _turnCount = 0;

  constructor(projectPath: string, options?: MemoryOptions) {
    this.dir = getMemoryDir(projectPath);
    this.remoteMode = !!options?.remoteUrl;

    if (this.remoteMode && options?.remoteUrl) {
      // Remote mode: use MemoryClient, no local MemoryEngine
      this.engine = null;
      this.client = new MemoryClient({
        baseUrl: options.remoteUrl,
        token: options.remoteToken,
        ...options.clientOptions,
      });
    } else {
      // Local mode: use MemoryEngine directly
      this.engine = new MemoryEngine(projectPath, options as MemoryEngineOptions);
      this.client = null;
    }
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

  private get _engine(): MemoryEngine {
    if (!this.engine) {
      throw new Error('Local MemoryEngine not available in remote mode. Use client.* methods instead.');
    }
    return this.engine;
  }

  // ── Intelligence tools (delegated to MemoryEngine) ──
  get contradiction() { return this._engine.contradiction; }
  get burnoutSeismograph() { return this._engine.burnoutSeismograph; }
  get regretOracle() { return this._engine.regretOracle; }
  get techDebt() { return this._engine.techDebt; }
  get bugPattern() { return this._engine.bugPattern; }
  get apiArchaeologist() { return this._engine.apiArchaeologist; }
  get velocityTracker() { return this._engine.velocityTracker; }
  get architectureDrift() { return this._engine.architectureDrift; }
  get patternLearner() { return this._engine.patternLearner; }
  get falseMemoryDetector() { return this._engine.falseMemoryDetector; }
  get sourceAttributor() { return this._engine.sourceAttributor; }
  get conflictResolver() { return this._engine.conflictResolver; }
  get memoryAuditor() { return this._engine.memoryAuditor; }
  get schemaInferrer() { return this._engine.schemaInferrer; }
  get meetingGhost() { return this._engine.meetingGhost; }
  get deadReckoning() { return this._engine.deadReckoning; }
  get livingManifesto() { return this._engine.livingManifesto; }
  get relationshipIntelligence() { return this._engine.relationship; }
  get skillShadow() { return this._engine.skillShadow; }
  get curriculumArchitect() { return this._engine.curriculum; }
  get codebaseAnthropologist() { return this._engine.codebaseAnthropologist; }
  get institutionalMemory() { return this._engine.institutionalMemory; }

  // ── Forge layers (delegated to MemoryEngine) ──
  get chronosVeil() { return this._engine.chronosForge as any; }
  get echoVeil() { return this._engine.echoForge; }
  get sheafWeaver() { return this._engine.harmonicSheafWeaver; }
  get synapseQuench(): any { return null; }
  get aetherForge() { return this._engine.aetherForge; }
  get supraSheaf() { return this._engine.supraSheaf; }
  get qptw() { return this._engine.qptw; }
  get titanicForge() { return this._engine.titanicForge; }
  get qerw() { return this._engine.qerw; }
  get qisrd() { return this._engine.qisrd; }
  get eclipseForge() { return this._engine.eclipseForge; }
  get qitrl() { return this._engine.qitrl; }
  get engramLog() { return this._engine.engramLog; }
  get consolidationEngine() { return this._engine.consolidationEngine; }
  get synapticPruner() { return this._engine.synapticPruner; }
  get provenanceForge() { return this._engine.provenanceForge; }
  get spacedRepetitionForge() { return this._engine.spacedRepetitionForge; }
  get constitutionalGuard() { return this._engine.constitutionalGuard; }
  get auditForge() { return this._engine.auditForge; }
  get prospectiveTrigger() { return this._engine.prospectiveTrigger; }
  get biasRevealer() { return this._engine.biasRevealer; }
  get contextVector() { return this._engine.contextVector; }
  get rehearsalEngine() { return this._engine.rehearsalEngine; }
  get schemaDistorter() { return this._engine.schemaDistorter; }
  get confidenceCalibrator() { return this._engine.confidenceCalibrator; }

  // ── Layer 1: Working Memory (delegated to local engine or remote client) ──

  get workingMemory(): WorkingMemory {
    if (this.remoteMode) return { currentGoal: '', activeFiles: [], recentErrors: [], discoveredPatterns: [] };
    const w = this._engine.workingMemory;
    return {
      currentGoal: w.currentGoal,
      activeFiles: [...w.activeFiles],
      recentErrors: [...w.recentErrors],
      discoveredPatterns: [...w.discoveredPatterns],
    };
  }

  setGoal(goal: string) {
    if (this.remoteMode && this.client) { this.client.setGoal(goal).catch(() => {}); return; }
    this._engine.setGoal(goal);
  }
  trackFile(filePath: string) {
    if (this.remoteMode && this.client) { this.client.trackFile(filePath).catch(() => {}); return; }
    this._engine.trackFile(filePath);
  }
  trackError(error: string) {
    if (this.remoteMode && this.client) { this.client.trackError(error).catch(() => {}); return; }
    this._engine.trackError(error);
  }
  trackPattern(pattern: string) {
    if (this.remoteMode) return;
    this._engine.trackPattern(pattern);
  }
  clearWorking() {
    if (this.remoteMode && this.client) { this.client.clearWorking().catch(() => {}); return; }
    this._engine.clearWorking();
  }

  trackToolUsage(tool: string): void {
    this._turnCount++;
  }

  // ── Layer 2: Episodic Memory ──

  storeEpisode(episode: any): void {
    if (this.remoteMode && this.client) {
      this.client.storeEpisode({
        summary: episode.summary || '',
        outcome: episode.outcome || 'unknown',
        timestamp: episode.timestamp || Date.now(),
        durationMs: episode.durationMs,
        errorCount: episode.errorsEncountered,
        tags: episode.taskType ? [episode.taskType] : undefined,
      }).catch(() => {});
    } else {
      this._engine.storeEpisode({
        summary: episode.summary || '',
        outcome: episode.outcome || 'unknown',
        timestamp: episode.timestamp || Date.now(),
        durationMs: episode.durationMs,
        errorCount: episode.errorsEncountered,
        tags: episode.taskType ? [episode.taskType] : undefined,
      });
    }
    const files = episode.filesChanged || [];
    const taskType = episode.taskType || 'general';
    if (episode.summary) {
      this.prefetcher.createProfile(episode.summary, files, taskType);
    }
  }

  loadEpisodes(count = 10) {
    if (this.remoteMode) return [];
    return this._engine.loadEpisodes(count);
  }

  get episodeCount(): number {
    return this.remoteMode ? 0 : this._engine.getStats().episodeCount;
  }

  // ── Layer 3: Semantic Memory ──

  storeFact(content: string, type: string = 'fact', tags: string[] = []): void {
    if (this.remoteMode && this.client) {
      this.client.store({ content, type, tags }).catch(() => {});
    } else {
      this._engine.store({ content, type: type as any, tags });
    }
    this.graph.extractFromMemoryEntry({ id: '', timestamp: Date.now(), type: type as any, content, tags });
  }

  async searchFacts(query: string, limit = 5): Promise<MemoryEntry[]> {
    this._turnCount++;
    if (this.remoteMode) return [];
    const results = await this._engine.recall(query, { limit, useIntelligence: true });
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

  async query(q: string, limit = 10): Promise<MemoryEntry[]> {
    return q.trim() ? this.searchFacts(q, limit) : [];
  }

  async getContextString(task = ''): Promise<string> {
    if (this.remoteMode) return '';
    return await this._engine.getContextString(task);
  }

  async getContextCompressed(task = '', tokenBudget = 2000): Promise<string> {
    if (this.remoteMode) return '[Memory] Remote mode — no local context';
    this.compressor.setBudget(tokenBudget);
    const rawEpisodes = this.loadEpisodes(10);
    const episodes: any[] = rawEpisodes.map(e => ({
      ...e,
      outcome: e.outcome === 'failure' ? 'failed' : e.outcome === 'unknown' ? 'partial' : e.outcome,
      filesChanged: [] as string[],
      toolsUsed: [] as string[],
    }));
    const proceduralTraces = this.procedural.retrieve(task, 3);
    const semantic = await this.searchFacts(task, 20);
    const compressed = this.compressor.compress(semantic, episodes, proceduralTraces, task);
    const parts: string[] = [];
    parts.push(`[Memory] ${compressed.tokens}/${tokenBudget} tokens`);
    for (const entry of compressed.entries) {
      parts.push(`\u2022 [${entry.layer}] ${entry.content.slice(0, 150)} (conf: ${Math.round(entry.confidence * 100)}%)`);
    }
    return parts.join('\n');
  }

  getStats() {
    if (this.remoteMode) return { semanticCount: 0, episodeCount: 0, workingFiles: 0, workingPatterns: 0, proceduralCount: 0, graphNodes: 0, graphEdges: 0 };
    const base = this._engine.getStats();
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
    if (this.remoteMode && this.client) {
      this.client.extractFacts(userMessage, assistantResponse).catch(() => {});
      return;
    }
    this._engine.extractFacts(userMessage, assistantResponse);
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

  // ── Export / Import / Consolidate ──

  clearAll(): void {
    if (this.remoteMode && this.client) { this.client.clearWorking().catch(() => {}); return; }
    this._engine.clearWorking();
  }

  async exportMemory(): Promise<string> {
    if (this.remoteMode) return '{}';
    return JSON.stringify({ semantic: await this.loadSemanticEntries(), working: this._engine.workingMemory });
  }

  importMemory(data: string): number {
    try {
      const parsed = JSON.parse(data);
      if (this.remoteMode) return 0;
      for (const entry of (parsed.semantic || [])) {
        this._engine.store({ content: entry.content, type: entry.type, tags: entry.tags || [] });
      }
      return (parsed.semantic || []).length;
    } catch { return 0; }
  }

  consolidate(): number {
    if (this.remoteMode) return 0;
    return this._engine.consolidate();
  }

  async loadSemanticEntries(): Promise<MemoryEntry[]> {
    return this.searchFacts('', 500);
  }

  // ── Decay compatibility getter ──

  get decay(): { getStats(): { activeCount: number; archivedCount: number; avgImportance: number } } {
    return {
      getStats: () => {
        if (this.remoteMode) return { activeCount: 0, archivedCount: 0, avgImportance: 0 };
        const stats = this._engine.getStats();
        return {
          activeCount: stats.semanticCount,
          archivedCount: 0,
          avgImportance: 5.0,
        };
      },
    };
  }

  // ── Phase 4a: Embedding backfill ──

  async backfillEmbeddings(): Promise<number> {
    if (this.remoteMode || !this._engine) return 0;
    return this._engine.backfillEmbeddings();
  }

  get embeddingStatus(): any {
    if (this.remoteMode || !this._engine) return null;
    return this._engine.embeddingStatus ?? null;
  }

  // ── Phase 5e: International Team Features ──

  private get branchStore(): MemoryBranchStore {
    if (!this._branchStore) {
      this._branchStore = new MemoryBranchStore(this.dir);
    }
    return this._branchStore;
  }

  async audit(opts: { actorId?: string; since?: number; until?: number; types?: string[]; limit?: number }): Promise<any> {
    if (this.remoteMode || !this._engine) return { entries: [], summary: { totalEntries: 0, types: {}, byPlatform: {}, since: 0 } };
    const report = await this._engine.auditMemoryHealth();
    return { entries: [], summary: { totalEntries: report.totalEntries, types: {}, byPlatform: {}, since: opts.since ?? 0 } };
  }

  async getTeamDigest(opts: { since: number; types?: string[]; limit?: number }): Promise<any> {
    if (this.remoteMode || !this._engine) return { entries: [], summary: '', since: 0, generatedAt: Date.now(), timezone: '' };
    const stats = this.getStats();
    return { entries: [], summary: `${stats.semanticCount} memories stored.`, since: opts.since, generatedAt: Date.now(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  createBranch(name: string, description?: string, createdBy?: string): any {
    if (this.remoteMode) return null;
    return this.branchStore.createBranch(name, description, createdBy);
  }

  branchCommit(branchName: string, content: string, reason: string, author?: string, platform?: string, channel?: string): any {
    if (this.remoteMode) return null;
    return this.branchStore.commit(branchName, content, reason, author ?? 'unknown', platform, channel);
  }

  getBranchHistory(branchName: string): any[] {
    if (this.remoteMode) return [];
    return this.branchStore.getHistory(branchName);
  }

  listBranches(showConflicts = false): any[] {
    if (this.remoteMode) return [];
    return this.branchStore.listBranches(showConflicts);
  }

  mergeBranches(source: string, target: string): any {
    if (this.remoteMode) return { success: false, message: 'Remote mode not supported' };
    return this.branchStore.merge(source, target);
  }

  deleteBranch(name: string): boolean {
    if (this.remoteMode) return false;
    return this.branchStore.deleteBranch(name);
  }

  // ── CLI-specific advanced operations ──

  async runBenchmark(): Promise<string> {
    return this.benchmark.compare();
  }

  applyDecay(): void {
    if (this.remoteMode) return;
    this._engine.consolidate();
    this._engine.synapticPruner.sweep();
  }

  getBeliefsTimeline(entryId: string): string | null {
    return this.versioning.howDidOpinionChange(entryId);
  }

  getRecentChanges(days = 7) {
    return this.versioning.getRecentChanges(days);
  }

  predictNext(goal: string) {
    if (this.remoteMode) return null;
    return this.prefetcher.prefetch(goal, this._engine.workingMemory.activeFiles);
  }

  getAffectiveState() {
    return this.affective.getState();
  }

  runSelfAudit(errors?: string[], corrections?: string[]): void {
    if (this.remoteMode) return;
    const { auditResult, newFacts } = this.reflector.sessionEndAudit(
      this._engine.workingMemory.currentGoal || '',
      errors || this._engine.workingMemory.recentErrors,
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
    if (this.remoteMode) return '';
    return this._engine.chronosForge.getContextString(domain as any, limit);
  }

  forecastRisk(domain = 'burnout'): string {
    if (this.remoteMode) return '';
    try {
      const events = this._engine.chronosForge.getContextString(domain as any, 30);
      if (!events) return `No ${domain} signals recorded yet.`;
      return `ChronosForge foresight: ${domain} risk based on recent signals.`;
    } catch {
      return `No ${domain} signals recorded yet.`;
    }
  }
}
