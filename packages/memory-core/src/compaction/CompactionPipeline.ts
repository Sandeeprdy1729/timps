// ── @timps/memory-core — Phase 4c: CompactionPipeline ──
// Orchestrates the full compaction lifecycle:
//   classify → cluster → consolidate → compress → archive → delete → reindex
//
// This is the main entry point for compaction operations.
// Designed to be called from CompactionQueue background worker or CLI.

import type { MemoryEntry } from '../types.js';
import type {
  CompactionConfig, ClassifiedMemory, CompactionTier,
  ConsolidatedFact, CompressionResult,
  ArchiveManifest, CompactionReport,
} from './types.js';
import type { MemoryCluster } from './ClusterEngine.js';
import { DEFAULT_COMPACTION_CONFIG } from './types.js';
import { MemoryClassifier } from './MemoryClassifier.js';
import { ClusterEngine } from './ClusterEngine.js';
import { LLMConsolidationEngine } from './LLMConsolidationEngine.js';
import { ContentCompressor } from './ContentCompressor.js';
import { ArchiveBackend } from './ArchiveBackend.js';

export interface PipelineOptions {
  config?: Partial<CompactionConfig>;
  metadataMap: Map<string, {
    recallCount: number;
    lastAccess: number;
    importance: number;
    layer: string;
    inContradiction: boolean;
    partOfConsolidated: boolean;
    pinnedByUser: boolean;
    embedding?: number[];
  }>;
  /** IDs to exclude from archival/deletion (e.g., from contradiction set) */
  protectedIds?: Set<string>;
  /** Callback for each step (for progress reporting) */
  onStep?: (step: string, detail: string) => void;
}

export class CompactionPipeline {
  private config: CompactionConfig;
  private classifier: MemoryClassifier;
  private clusterEngine: ClusterEngine;
  private consolidationEngine: LLMConsolidationEngine;
  private compressor: ContentCompressor;
  private archiveBackend: ArchiveBackend;
  private metadataMap: Map<string, {
    recallCount: number; lastAccess: number; importance: number;
    layer: string; inContradiction: boolean;
    partOfConsolidated: boolean; pinnedByUser: boolean;
    embedding?: number[];
  }>;
  private protectedIds: Set<string>;

  constructor(dir: string, options: PipelineOptions) {
    this.config = { ...DEFAULT_COMPACTION_CONFIG, ...options.config };
    this.classifier = new MemoryClassifier({ config: this.config });
    this.clusterEngine = new ClusterEngine({
      minClusterSize: this.config.clusterMinSize,
      maxClusterSize: this.config.clusterMaxSize,
      embedDim: this.config.clusterEmbedDim,
      clusterCount: this.config.clusterCount,
    });
    this.consolidationEngine = new LLMConsolidationEngine(this.config);
    this.compressor = new ContentCompressor();
    this.archiveBackend = new ArchiveBackend(dir);
    this.metadataMap = options.metadataMap as any;
    this.protectedIds = options.protectedIds ?? new Set();
  }

  /**
   * Run the full compaction pipeline on a set of memory entries.
   *
   * @param entries - All semantic memory entries
   * @returns A detailed compaction report
   */
  async run(entries: MemoryEntry[]): Promise<CompactionReport> {
    const startTime = Date.now();
    const report: CompactionReport = {
      timestamp: startTime,
      durationMs: 0,
      steps: {
        classified: 0, hot: 0, warm: 0, cold: 0, deleted: 0,
        clustersFormed: 0, consolidated: 0, compressed: 0,
        archived: 0, purgeDeleted: 0,
      },
      storageSavings: {
        before: { entries: entries.length, sizeEstimate: this._estimateSize(entries) },
        after: { entries: 0, sizeEstimate: 0 },
        savingsPercent: 0,
      },
      errors: [],
    };

    const beforeSize = this._estimateSize(entries);

    try {
      // Step 1: Classify
      this._step('classify', 'Assigning compaction tiers to memories');
      const classified = this.classifier.classifyAll(entries, this.metadataMap);
      report.steps.classified = classified.length;
      report.steps.hot = classified.filter(c => c.tier === 'hot').length;
      report.steps.warm = classified.filter(c => c.tier === 'warm').length;
      report.steps.cold = classified.filter(c => c.tier === 'cold').length;
      report.steps.deleted = classified.filter(c => c.tier === 'deleted').length;

      // Step 2: Cluster warm memories
      this._step('cluster', 'Clustering warm memories for consolidation');
      const warmMemories = classified.filter(c => c.tier === 'warm' && !this.protectedIds.has(c.id));
      const clusters: MemoryCluster[] = [];
      if (warmMemories.length >= this.config.clusterMinSize) {
        const formed = this.clusterEngine.cluster(warmMemories);
        clusters.push(...formed);
      }
      report.steps.clustersFormed = clusters.length;

      // Step 3: Consolidate clusters (LLM)
      this._step('consolidate', `Consolidating ${clusters.length} clusters`);
      const consolidatedFacts: ConsolidatedFact[] = [];
      for (const cluster of clusters) {
        try {
          const fact = await this.consolidationEngine.consolidate({
            clusterId: cluster.id,
            entries: cluster.members.map(m => ({
              id: m.id,
              content: m.content,
              type: m.type,
              timestamp: m.timestamp,
              tags: m.tags,
            })),
          });
          consolidatedFacts.push(fact);
        } catch (err) {
          report.errors.push(`Consolidation failed for cluster ${cluster.id}: ${err}`);
        }
      }
      report.steps.consolidated = consolidatedFacts.length;

      // Step 4: Compress medium-value memories (hot memories that are verbose)
      this._step('compress', 'Compressing verbose hot memories');
      const hotVerboseMemories = classified
        .filter(c => c.tier === 'hot' && c.content.length > 200);
      const compressionResults = this.compressor.compressMany(
        hotVerboseMemories.map(m => ({ id: m.id, content: m.content }))
      );
      report.steps.compressed = compressionResults.size;

      // Step 5: Archive cold memories
      this._step('archive', `Archiving ${report.steps.cold} cold memories`);
      const coldMemories = classified
        .filter(c => c.tier === 'cold' && !this.protectedIds.has(c.id));
      if (coldMemories.length > 0) {
        const coldEntries = coldMemories.map(c => entries.find(e => e.id === c.id)!).filter(Boolean);
        if (coldEntries.length > 0) {
          const archiveManifest = await this.archiveBackend.archiveBatch(coldEntries, this.config);
          report.steps.archived = archiveManifest.totalArchived;
        }
      }

      // Step 6: Delete fully-consolidated originals (those marked 'deleted' tier)
      this._step('delete', 'Purging consolidated originals');
      const toDelete = classified.filter(c =>
        c.tier === 'deleted' && !this.protectedIds.has(c.id)
      );
      report.steps.purgeDeleted = toDelete.length;

      // Step 7: Calculate results
      const keptEntries = classified.filter(c => c.tier === 'hot' || c.tier === 'warm').length + consolidatedFacts.length;
      const compressedSize = compressionResults.size > 0
        ? report.steps.compressed * 100 // rough estimate: avg 100 bytes per compressed entry
        : 0;
      const afterSize = beforeSize - report.steps.archived * 500 - report.steps.purgeDeleted * 500 + compressedSize;

      report.storageSavings = {
        before: { entries: entries.length, sizeEstimate: beforeSize },
        after: { entries: keptEntries + coldMemories.length, sizeEstimate: Math.max(0, afterSize) },
        savingsPercent: beforeSize > 0
          ? Math.round((1 - afterSize / beforeSize) * 1000) / 10
          : 0,
      };

    } catch (err) {
      report.errors.push(`Pipeline failed: ${err}`);
    }

    report.durationMs = Date.now() - startTime;
    return report;
  }

  /**
   * Run only the classification step (no side effects).
   */
  classifyOnly(entries: MemoryEntry[]): ClassifiedMemory[] {
    return this.classifier.classifyAll(entries, this.metadataMap);
  }

  /**
   * Run only the archive step (cold memories → archive backend).
   */
  async archiveOnly(entries: MemoryEntry[]): Promise<ArchiveManifest | null> {
    const classified = this.classifyOnly(entries);
    const coldMemories = classified.filter(c => c.tier === 'cold' && !this.protectedIds.has(c.id));
    if (coldMemories.length === 0) return null;
    const coldEntries = coldMemories.map(c => entries.find(e => e.id === c.id)!).filter(Boolean);
    return this.archiveBackend.archiveBatch(coldEntries, this.config);
  }

  /**
   * Run only the consolidation step (warm memories → LLM summaries).
   */
  async consolidateOnly(entries: MemoryEntry[]): Promise<ConsolidatedFact[]> {
    const classified = this.classifyOnly(entries);
    const warmMemories = classified.filter(c => c.tier === 'warm' && !this.protectedIds.has(c.id));
    if (warmMemories.length < this.config.clusterMinSize) return [];
    const clusters = this.clusterEngine.cluster(warmMemories);
    const facts: ConsolidatedFact[] = [];
    for (const cluster of clusters) {
      try {
        facts.push(await this.consolidationEngine.consolidate({
          clusterId: cluster.id,
          entries: cluster.members.map(m => ({
            id: m.id,
            content: m.content,
            type: m.type,
            timestamp: m.timestamp,
            tags: m.tags,
          })),
        }));
      } catch { /* skip failed clusters */ }
    }
    return facts;
  }

  /** Estimate storage size of a set of entries in bytes. */
  private _estimateSize(entries: MemoryEntry[]): number {
    return entries.reduce((s, e) => s + Buffer.byteLength(JSON.stringify(e), 'utf-8'), 0);
  }

  private _step(name: string, detail: string): void {
    if (this._onStep) this._onStep(name, detail);
  }

  private _onStep?: (step: string, detail: string) => void;

  set onStep(cb: ((step: string, detail: string) => void) | undefined) {
    this._onStep = cb;
  }
}

export { DEFAULT_COMPACTION_CONFIG };
