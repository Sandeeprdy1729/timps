// ── TIMPS Context Compressor ──
// Token budgeting + context compression for efficient LLM injection

import type { MemoryEntry, ContextWindow, ContextEntry, EpisodicMemory, ProceduralTrace } from './types.js';

const DEFAULT_TOKEN_BUDGET = 2000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface ScoredEntry {
  entry: MemoryEntry | EpisodicMemory | ProceduralTrace;
  layer: string;
  relevance: number;
  recency: number;
  importance: number;
  combinedScore: number;
  tokens: number;
}

export class ContextCompressor {
  private budget: number;

  constructor(budget = DEFAULT_TOKEN_BUDGET) {
    this.budget = budget;
  }

  setBudget(tokens: number): void {
    this.budget = tokens;
  }

  private score(entry: MemoryEntry | EpisodicMemory | ProceduralTrace, layer: string, query?: string): ScoredEntry {
    const now = Date.now();
    const timestamp = 'timestamp' in entry ? entry.timestamp : now;

    let recency = 1;
    const age = now - timestamp;
    if (age > 0) {
      const days = age / (1000 * 60 * 60 * 24);
      recency = Math.max(0.1, 1 / (1 + days * 0.05));
    }

    let importance = 0.5;
    if ('importance' in entry && entry.importance !== undefined) importance = entry.importance / 10;
    if ('confidence' in entry && typeof entry.confidence === 'number') importance = Math.max(importance, entry.confidence);
    if ('usageCount' in entry && typeof entry.usageCount === 'number') importance += Math.min(entry.usageCount * 0.05, 0.5);

    let relevance = 0.5;
    if (query && 'content' in entry) {
      const qTokens = query.toLowerCase().split(/\s+/);
      const contentLower = entry.content.toLowerCase();
      const matches = qTokens.filter(t => contentLower.includes(t)).length;
      relevance = matches / Math.max(qTokens.length, 1);
    }

    const layerWeight = layer === 'semantic' ? 1.2 : layer === 'procedural' ? 1.1 : layer === 'episodic' ? 0.9 : 0.7;
    const combinedScore = (relevance * 0.4 + recency * 0.3 + importance * 0.3) * layerWeight;

    let tokens = 20;
    if ('content' in entry) tokens = estimateTokens(entry.content);
    else if ('summary' in entry) tokens = estimateTokens(entry.summary);
    else if ('goal' in entry) tokens = estimateTokens(entry.goal);

    return { entry, layer, relevance, recency, importance, combinedScore, tokens };
  }

  compress(
    semantic: MemoryEntry[],
    episodic: EpisodicMemory[],
    procedural: ProceduralTrace[],
    query = ''
  ): ContextWindow {
    const allEntries: ScoredEntry[] = [];

    for (const e of semantic) allEntries.push(this.score(e, 'semantic', query));
    for (const e of episodic) allEntries.push(this.score(e, 'episodic', query));
    for (const e of procedural) allEntries.push(this.score(e, 'procedural', query));

    allEntries.sort((a, b) => b.combinedScore - a.combinedScore);

    const selected: ContextEntry[] = [];
    let totalTokens = 0;

    for (const scored of allEntries) {
      if (totalTokens + scored.tokens > this.budget) {
        if (scored.tokens < 100 && totalTokens < this.budget * 0.9) {
          const summary = this.summarize(scored.entry, scored.layer);
          const sumTokens = estimateTokens(summary);
          if (totalTokens + sumTokens <= this.budget * 0.95) {
            selected.push({ entry: scored.entry as MemoryEntry, content: summary, layer: scored.layer, confidence: scored.importance, tokens: sumTokens });
            totalTokens += sumTokens;
          }
        }
        break;
      }
      selected.push({ entry: scored.entry as MemoryEntry, content: 'content' in scored.entry ? scored.entry.content : 'summary' in scored.entry ? scored.entry.summary : '', layer: scored.layer, confidence: scored.importance, tokens: scored.tokens });
      totalTokens += scored.tokens;
    }

    return { tokens: totalTokens, budget: this.budget, entries: selected };
  }

  private summarize(entry: MemoryEntry | EpisodicMemory | ProceduralTrace, layer: string): string {
    if ('content' in entry) return `[${layer}] ${entry.content.slice(0, 150)}`;
    if ('summary' in entry) return `[episodic] ${(entry as EpisodicMemory).summary}`;
    if ('goal' in entry) return `[procedural] ${(entry as ProceduralTrace).goal}`;
    return `[${layer}] memory entry`;
  }

  summarizeCluster(entries: MemoryEntry[]): string {
    if (entries.length === 0) return '';
    if (entries.length === 1) return entries[0].content;

    const types = [...new Set(entries.map(e => e.type))];
    const tokens = entries.map(e => e.content).join(' ').split(/\s+/);
    const timeRange = entries.map(e => e.timestamp).sort();

    let summary = `${entries.length} related ${types.join('/')} memories.`;
    if (timeRange.length > 1) {
      const daysAgo = Math.round((Date.now() - timeRange[timeRange.length - 1]) / (1000 * 60 * 60 * 24));
      summary += ` Spanning ${daysAgo} days.`;
    }

    const keyContent = entries.slice(0, 3).map(e => e.content.slice(0, 80)).join('; ');
    summary += ` Key facts: ${keyContent}`;

    return summary.slice(0, 300);
  }

  getCompressionStats(window: ContextWindow): { originalTokens: number; compressedTokens: number; compressionRatio: number; entryCount: number } {
    const originalTokens = window.entries.reduce((s, e) => s + e.tokens * 2, 0);
    return {
      originalTokens,
      compressedTokens: window.tokens,
      compressionRatio: originalTokens > 0 ? originalTokens / window.tokens : 1,
      entryCount: window.entries.length,
    };
  }
}