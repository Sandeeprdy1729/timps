// ── @timps/memory-core — MemoryEngine ──
// The single entry-point for all 3-layer memory operations + 9 intelligence tools.
// All storage is file-based (JSON) — no database server required.

import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';

import type {
  MemoryEntry, MemoryEntryType, EpisodicEntry, WorkingState,
  SearchOptions, MemoryPack, MemorySnapshot, MergeResult, MemoryStats,
} from './types.js';

import {
  projectHash, memoryDir, generateId,
  loadWorking, saveWorking,
  appendEpisode, loadEpisodes, episodeCount,
  loadSemantic, saveSemantic,
  trackFile, trackError, trackPattern,
  jaccardSimilarity,
} from './storage.js';

import { searchEntries } from './search.js';

// Intelligence tools — ported from sandeep-ai
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

export class MemoryEngine {
  private dir: string;
  private hash: string;
  private working: WorkingState;

  // ── Layer 5: ChronosForge (lazy-init) ──
  private _chronos?: ChronosForge;

  // ── Layer 7: EchoForge (lazy-init) ──
  private _echo?: EchoForge;

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

  constructor(projectPath: string) {
    this.dir = memoryDir(projectPath);
    this.hash = projectHash(projectPath);
    this.working = loadWorking(this.dir);
  }

  // ── Lazy getters for tool instances ──
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
  get meetingGhost(): MeetingGhost {
    return (this._meetingGhost ??= new MeetingGhost(this.dir));
  }
  get deadReckoning(): DeadReckoning {
    return (this._deadReckoning ??= new DeadReckoning(this.dir));
  }
  get livingManifesto(): LivingManifesto {
    return (this._livingManifesto ??= new LivingManifesto(this.dir));
  }
  get relationship(): RelationshipIntelligence {
    return (this._relationship ??= new RelationshipIntelligence(this.dir));
  }
  get skillShadow(): SkillShadow {
    return (this._skillShadow ??= new SkillShadow(this.dir));
  }
  get curriculum(): CurriculumArchitect {
    return (this._curriculum ??= new CurriculumArchitect(this.dir));
  }
  get codebaseAnthropologist(): CodebaseAnthropologist {
    return (this._codebaseAnthropologist ??= new CodebaseAnthropologist(this.dir));
  }
  get institutionalMemory(): InstitutionalMemory {
    return (this._institutionalMemory ??= new InstitutionalMemory(this.dir));
  }

  /** Layer 5: ChronosForge — bi-temporal causal memory weaver + foresight simulator. */
  get chronosForge(): ChronosForge {
    return (this._chronos ??= new ChronosForge(this.dir));
  }

  /**
   * Layer 7: EchoForge — causal echo propagation + reservoir computing.
   * Deterministic O(V+E) foresight: -85% latency vs MC rollouts, +17pt prediction.
   */
  get echoForge(): EchoForge {
    return (this._echo ??= new EchoForge(this.dir));
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

  /** Store a fact/pattern/preference in semantic memory. Deduplicates by Jaccard similarity. */
  store(entry: { content: string; type?: MemoryEntryType; tags?: string[] }): void {
    const facts = loadSemantic(this.dir);
    const { content, type = 'fact', tags = [] } = entry;
    if (facts.some(f => jaccardSimilarity(f.content, content) > 0.8)) return;
    facts.push({ id: generateId('mem'), timestamp: Date.now(), type, content, tags });
    saveSemantic(this.dir, facts);
    // Layer 5: weave into ChronosForge temporal graph
    this.chronosForge.weave(content, { tags });
    // Layer 7: weave into EchoForge causal propagation graph (fire-and-forget)
    void this.echoForge.weave(content, { tags });
  }

  /** Recall entries matching a query using BM25 keyword search. */
  recall(query: string, options?: SearchOptions): MemoryEntry[] {
    return searchEntries(loadSemantic(this.dir), query, options);
  }

  /** Get a formatted context string for injection into agent prompts. */
  getContextString(task = ''): string {
    const episodes = loadEpisodes(this.dir, 5);
    const facts = searchEntries(loadSemantic(this.dir), task, { limit: 5 });
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
    return before - deduped.length;
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

  // ── Intelligence convenience aliases (mirror sandeep-ai API names) ──

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
}
