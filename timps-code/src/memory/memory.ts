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

    const summary = episode.summary || '';
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
    const words = new Set(al.split(/\s+/));
    const bWords = bl.split(/\s+/);
    const overlap = bWords.filter(w => words.has(w)).length;
    return overlap / Math.max(words.size, bWords.length);
  }
}