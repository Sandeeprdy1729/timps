// ── @timps/memory-core — Phase 4c: MemoryClassifier ──
// Assigns compaction tier (hot/warm/cold/deleted) to each memory
// based on age, recall frequency, importance, contradictions, and pin status.

import type { MemoryEntry } from '../types.js';
import type { ClassifiedMemory, CompactionTier, CompactionConfig } from './types.js';

export interface ClassifierOptions {
  config: CompactionConfig;
  now?: number;
}

export class MemoryClassifier {
  private config: CompactionConfig;
  private now: number;

  constructor(options: ClassifierOptions) {
    this.config = options.config;
    this.now = options.now ?? Date.now();
  }

  classify(entry: MemoryEntry, meta: {
    recallCount: number;
    lastAccess: number;
    importance: number;
    layer: string;
    inContradiction: boolean;
    partOfConsolidated: boolean;
    pinnedByUser: boolean;
    embedding?: number[];
  }): ClassifiedMemory {
    const ageDays = (this.now - entry.timestamp) / (24 * 60 * 60 * 1000);
    const lastAccessAgeDays = (this.now - meta.lastAccess) / (24 * 60 * 60 * 1000);
    const inactiveDays = Math.min(ageDays, lastAccessAgeDays);

    const tier = this.determineTier({
      ageDays: inactiveDays,
      importance: meta.importance,
      recallCount: meta.recallCount,
      inContradiction: meta.inContradiction,
      partOfConsolidated: meta.partOfConsolidated,
      pinnedByUser: meta.pinnedByUser,
    });

    return {
      id: entry.id,
      content: entry.content,
      type: entry.type,
      tags: entry.tags,
      timestamp: entry.timestamp,
      layer: meta.layer,
      importance: meta.importance,
      recallCount: meta.recallCount,
      lastAccess: meta.lastAccess,
      embedding: meta.embedding,
      inContradiction: meta.inContradiction,
      partOfConsolidated: meta.partOfConsolidated,
      pinnedByUser: meta.pinnedByUser,
      tier,
    };
  }

  private determineTier(params: {
    ageDays: number;
    importance: number;
    recallCount: number;
    inContradiction: boolean;
    partOfConsolidated: boolean;
    pinnedByUser: boolean;
  }): CompactionTier {
    if (params.pinnedByUser) return 'hot';
    if (params.inContradiction) return 'hot';
    if (params.partOfConsolidated && params.ageDays > this.config.deleteAfterConsolidationDays) {
      return 'deleted';
    }
    if (params.partOfConsolidated) return 'deleted';
    if (
      params.ageDays > this.config.archiveAfterDays &&
      params.importance < this.config.coldImportanceThreshold &&
      params.recallCount < 1
    ) {
      return 'cold';
    }
    if (
      params.importance < this.config.warmImportanceThreshold &&
      params.recallCount < this.config.warmRecallThreshold
    ) {
      return 'warm';
    }
    return 'hot';
  }

  classifyAll(entries: MemoryEntry[], metadataMap: Map<string, {
    recallCount: number;
    lastAccess: number;
    importance: number;
    layer: string;
    inContradiction: boolean;
    partOfConsolidated: boolean;
    pinnedByUser: boolean;
    embedding?: number[];
  }>): ClassifiedMemory[] {
    return entries.map(entry => {
      const meta = metadataMap.get(entry.id) ?? {
        recallCount: 0,
        lastAccess: 0,
        importance: 0.5,
        layer: 'L3',
        inContradiction: false,
        partOfConsolidated: false,
        pinnedByUser: false,
      };
      return this.classify(entry, meta);
    });
  }

  updateConfig(config: Partial<CompactionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
