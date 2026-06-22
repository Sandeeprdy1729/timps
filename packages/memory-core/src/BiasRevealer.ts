// ── @timps/memory-core — L18: BiasRevealer ──
// Detects over- and under-representation in saved memory by analyzing
// topic distributions, source kinds, and sentiment biases.
// Solves the "motivated forgetting / bias" bottleneck.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from './backends/types.js';

export interface BiasReport {
  overrepresented: { category: string; count: number; expected: number; ratio: number }[];
  underrepresented: { category: string; count: number; expected: number; ratio: number }[];
  sourceBias: { sourceKind: string; percentage: number }[];
  sentimentBias: { positive: number; negative: number; neutral: number };
  recommendation: string;
}

export class BiasRevealer {
  private _backend?: StorageBackend;

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
  }

  reveal(): BiasReport {
    const semantic = this.loadSemantic();
    const episodes = this.loadEpisodes();
    const provenance = this.loadProvenance();

    const total = semantic.length + episodes.length;
    if (total === 0) {
      return {
        overrepresented: [],
        underrepresented: [],
        sourceBias: [],
        sentimentBias: { positive: 0, negative: 0, neutral: 0 },
        recommendation: 'No memory data to analyze.',
      };
    }

    const topicCounts = new Map<string, number>();
    for (const e of semantic) {
      const tags = e.tags ?? [];
      for (const tag of tags) {
        topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
      }
      const words = (e.content ?? '').toLowerCase().split(/\s+/);
      for (const w of words) {
        if (w.length > 4) topicCounts.set(w, (topicCounts.get(w) ?? 0) + 1);
      }
    }

    const avgCount = total / Math.max(1, topicCounts.size);
    const overrepresented: BiasReport['overrepresented'] = [];
    const underrepresented: BiasReport['underrepresented'] = [];

    for (const [category, count] of topicCounts) {
      if (count > avgCount * 2) {
        overrepresented.push({ category, count, expected: Math.round(avgCount), ratio: count / avgCount });
      } else if (count < avgCount * 0.3 && count > 0) {
        underrepresented.push({ category, count, expected: Math.round(avgCount), ratio: count / avgCount });
      }
    }

    overrepresented.sort((a, b) => b.ratio - a.ratio);
    underrepresented.sort((a, b) => a.ratio - b.ratio);

    const sourceCounts = new Map<string, number>();
    for (const p of provenance) {
      sourceCounts.set(p.sourceKind, (sourceCounts.get(p.sourceKind) ?? 0) + 1);
    }
    const totalProv = provenance.length || 1;
    const sourceBias = [...sourceCounts.entries()]
      .map(([sourceKind, count]) => ({ sourceKind, percentage: Math.round((count / totalProv) * 100) }))
      .sort((a, b) => b.percentage - a.percentage);

    const sentimentBias = { positive: 0, negative: 0, neutral: 0 };
    for (const e of semantic) {
      const text = (e.content ?? '').toLowerCase();
      const positiveWords = ['good', 'great', 'excellent', 'works', 'fixed', 'solved', 'best', 'success'];
      const negativeWords = ['bad', 'broken', 'fails', 'error', 'crash', 'bug', 'wrong', 'terrible'];
      let pos = 0;
      let neg = 0;
      for (const w of positiveWords) { if (text.includes(w)) pos++; }
      for (const w of negativeWords) { if (text.includes(w)) neg++; }
      if (pos > neg) sentimentBias.positive++;
      else if (neg > pos) sentimentBias.negative++;
      else sentimentBias.neutral++;
    }

    const recommendation = this.generateRecommendation(overrepresented, underrepresented, sourceBias);

    return { overrepresented: overrepresented.slice(0, 10), underrepresented: underrepresented.slice(0, 10), sourceBias, sentimentBias, recommendation };
  }

  private generateRecommendation(
    over: BiasReport['overrepresented'],
    under: BiasReport['underrepresented'],
    sourceBias: BiasReport['sourceBias'],
  ): string {
    const parts: string[] = [];
    if (over.length > 0) {
      parts.push(`Over-represented topics: ${over.slice(0, 3).map(o => o.category).join(', ')}`);
    }
    if (under.length > 0) {
      parts.push(`Under-represented topics: ${under.slice(0, 3).map(u => u.category).join(', ')}`);
    }
    const topSource = sourceBias[0];
    if (topSource && topSource.percentage > 60) {
      parts.push(`${topSource.sourceKind} dominates (${topSource.percentage}% of sourced memories)`);
    }
    if (parts.length === 0) parts.push('No significant bias detected.');
    return parts.join('. ');
  }

  private loadSemantic(): any[] {
    try {
      const f = path.join(this.dir, 'semantic.json');
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
    } catch { /* ignore */ }
    return [];
  }

  private loadEpisodes(): any[] {
    try {
      if (this._backend) return this._backend.read('episodes.json') ?? [];
      const f = path.join(this.dir, 'episodes.json');
      if (!fs.existsSync(f)) return [];
      return JSON.parse(fs.readFileSync(f, 'utf-8')) as any[];
    } catch { return []; }
  }

  private loadProvenance(): any[] {
    try {
      const provDir = path.join(this.dir, 'provenance');
      if (!fs.existsSync(provDir)) return [];
      return fs.readdirSync(provDir)
        .filter(f => f.endsWith('.json'))
        .map(f => JSON.parse(fs.readFileSync(path.join(provDir, f), 'utf-8')));
    } catch { return []; }
  }
}
