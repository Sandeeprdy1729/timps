// ── TIMPS Benchmark Infrastructure ──
// Reproducible evaluation against LongMemEval-S style benchmarks

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getMemoryDir } from '../config/config.js';
import type { MemoryEntry } from './types.js';
import { HybridRetriever } from './hybridRetriever.js';

interface BenchmarkQuery {
  id: string;
  query: string;
  expectedKeywords: string[];
  expectedTypes: string[];
}

interface BenchmarkResult {
  queryId: string;
  retrieved: string[];
  expected: string[];
  recallAtK: number[];
  mrr: number;
  precisionAt5: number;
}

interface BenchmarkReport {
  timestamp: number;
  totalQueries: number;
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  avgPrecision: number;
  tokenEfficiency: number;
  results: BenchmarkResult[];
}

export class MemoryBenchmark {
  private dir: string;
  private hybridRetriever: HybridRetriever;

  constructor(projectPath: string) {
    this.dir = projectPath;
    this.hybridRetriever = new HybridRetriever(projectPath);
  }

  // ── Benchmark Datasets ────────────────────────────────────

  generateSyntheticBenchmark(count = 50): BenchmarkQuery[] {
    const queries: BenchmarkQuery[] = [];
    const templates = [
      { query: 'API framework', keywords: ['express', 'fastify', 'api', 'rest', 'route'], types: ['fact', 'architecture'] },
      { query: 'database setup', keywords: ['postgres', 'mysql', 'mongodb', 'database', 'schema'], types: ['fact', 'convention'] },
      { query: 'auth implementation', keywords: ['auth', 'jwt', 'session', 'login', 'middleware'], types: ['pattern', 'convention'] },
      { query: 'testing setup', keywords: ['test', 'jest', 'vitest', 'coverage', 'spec'], types: ['fact', 'convention'] },
      { query: 'deployment config', keywords: ['docker', 'deploy', 'nginx', 'build', 'ci'], types: ['fact', 'pattern'] },
      { query: 'state management', keywords: ['redux', 'zustand', 'store', 'state', 'context'], types: ['pattern', 'decision'] },
      { query: 'error handling', keywords: ['error', 'try', 'catch', 'exception', 'boundary'], types: ['pattern', 'convention'] },
      { query: 'code style', keywords: ['eslint', 'prettier', 'format', 'style', 'lint'], types: ['convention', 'fact'] },
      { query: 'component patterns', keywords: ['react', 'vue', 'component', 'render', 'hook'], types: ['pattern', 'convention'] },
      { query: 'performance optimization', keywords: ['perf', 'cache', 'memo', 'lazy', 'optimize'], types: ['pattern', 'fact'] },
    ];

    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      queries.push({
        id: `q${i + 1}`,
        query: template.query,
        expectedKeywords: template.keywords,
        expectedTypes: template.types,
      });
    }

    return queries;
  }

  // ── Evaluation ─────────────────────────────────────────────

  private computeRecall(retrieved: string[], expected: string[]): number[] {
    const recall: number[] = [];
    for (const k of [1, 3, 5]) {
      const topK = retrieved.slice(0, k);
      const relevant = expected.filter(e => topK.some(r => r.toLowerCase().includes(e.toLowerCase())));
      recall.push(relevant.length / Math.max(expected.length, 1));
    }
    return recall;
  }

  private computeMRR(retrieved: string[], expected: string[]): number {
    for (let i = 0; i < retrieved.length; i++) {
      if (expected.some(e => retrieved[i].toLowerCase().includes(e.toLowerCase()))) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }

  // ── Run Benchmark ──────────────────────────────────────────

  run(count = 50): BenchmarkReport {
    const queries = this.generateSyntheticBenchmark(count);
    const results: BenchmarkResult[] = [];
    let totalTokens = 0;

    const entries = this.loadSemanticEntries();

    for (const q of queries) {
      const hybridResults = this.hybridRetriever.search(q.query, 5);
      const retrieved = hybridResults.map(r => r.entry.content);

      const keywordMatches = retrieved.filter(r =>
        q.expectedKeywords.some(k => r.toLowerCase().includes(k))
      );

      const recall = this.computeRecall(retrieved, q.expectedKeywords);
      const mrr = this.computeMRR(retrieved, q.expectedKeywords);

      results.push({
        queryId: q.id,
        retrieved,
        expected: q.expectedKeywords,
        recallAtK: recall,
        mrr,
        precisionAt5: keywordMatches.length / 5,
      });

      totalTokens += retrieved.reduce((s, r) => s + Math.ceil(r.length / 4), 0);
    }

    const recallAt1 = results.reduce((s, r) => s + r.recallAtK[0], 0) / results.length;
    const recallAt3 = results.reduce((s, r) => s + r.recallAtK[1], 0) / results.length;
    const recallAt5 = results.reduce((s, r) => s + r.recallAtK[2], 0) / results.length;
    const avgMRR = results.reduce((s, r) => s + r.mrr, 0) / results.length;
    const avgPrecision = results.reduce((s, r) => s + r.precisionAt5, 0) / results.length;
    const tokenEfficiency = totalTokens / results.length;

    const report: BenchmarkReport = {
      timestamp: Date.now(),
      totalQueries: count,
      recallAt1,
      recallAt3,
      recallAt5,
      mrr: avgMRR,
      avgPrecision,
      tokenEfficiency,
      results,
    };

    this.saveReport(report);
    return report;
  }

  // ── Legacy Compatibility: Linear Search Benchmark ──────────

  runLegacy(count = 50): BenchmarkReport {
    const queries = this.generateSyntheticBenchmark(count);
    const results: BenchmarkResult[] = [];
    const entries = this.loadSemanticEntries();
    let totalTokens = 0;

    for (const q of queries) {
      const qTokens = q.query.toLowerCase().split(/\s+/);
      const scored = entries.map(e => {
        const content = e.content.toLowerCase();
        const matchCount = qTokens.filter(t => content.includes(t)).length;
        return { content: e.content, score: matchCount / qTokens.length };
      }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

      const retrieved = scored.slice(0, 5).map(s => s.content);
      const recall = this.computeRecall(retrieved, q.expectedKeywords);
      const mrr = this.computeMRR(retrieved, q.expectedKeywords);

      results.push({
        queryId: q.id,
        retrieved,
        expected: q.expectedKeywords,
        recallAtK: recall,
        mrr,
        precisionAt5: retrieved.filter(r => q.expectedKeywords.some(k => r.toLowerCase().includes(k))).length / 5,
      });

      totalTokens += retrieved.reduce((s, r) => s + Math.ceil(r.length / 4), 0);
    }

    const report: BenchmarkReport = {
      timestamp: Date.now(),
      totalQueries: count,
      recallAt1: results.reduce((s, r) => s + r.recallAtK[0], 0) / results.length,
      recallAt3: results.reduce((s, r) => s + r.recallAtK[1], 0) / results.length,
      recallAt5: results.reduce((s, r) => s + r.recallAtK[2], 0) / results.length,
      mrr: results.reduce((s, r) => s + r.mrr, 0) / results.length,
      avgPrecision: results.reduce((s, r) => s + r.precisionAt5, 0) / results.length,
      tokenEfficiency: totalTokens / results.length,
      results,
    };

    return report;
  }

  // ── Comparison Report ──────────────────────────────────────

  compare(): string {
    const hybrid = this.run(50);
    const legacy = this.runLegacy(50);

    return `
════════════════════════════════════════════════════
  TIMPS Memory Benchmark Report
════════════════════════════════════════════════════
  Generated: ${new Date().toLocaleString()}
  Memory entries: ${this.loadSemanticEntries().length}

┌─────────────────────────────────────────────────────┐
│ Metric              │ Legacy  │ Hybrid   │ Delta  │
├─────────────────────┼─────────┼──────────┼────────┤
│ Recall@1            │ ${(legacy.recallAt1 * 100).toFixed(1)}%  │ ${(hybrid.recallAt1 * 100).toFixed(1)}%   │ ${((hybrid.recallAt1 - legacy.recallAt1) * 100).toFixed(1)}% │
│ Recall@3            │ ${(legacy.recallAt3 * 100).toFixed(1)}%  │ ${(hybrid.recallAt3 * 100).toFixed(1)}%   │ ${((hybrid.recallAt3 - legacy.recallAt3) * 100).toFixed(1)}% │
│ Recall@5            │ ${(legacy.recallAt5 * 100).toFixed(1)}%  │ ${(hybrid.recallAt5 * 100).toFixed(1)}%   │ ${((hybrid.recallAt5 - legacy.recallAt5) * 100).toFixed(1)}% │
│ MRR                 │ ${(legacy.mrr * 100).toFixed(1)}%  │ ${(hybrid.mrr * 100).toFixed(1)}%   │ ${((hybrid.mrr - legacy.mrr) * 100).toFixed(1)}% │
│ Token Efficiency    │ ${legacy.tokenEfficiency.toFixed(0)}      │ ${hybrid.tokenEfficiency.toFixed(0)}      │ ${(hybrid.tokenEfficiency - legacy.tokenEfficiency).toFixed(0)}     │
└─────────────────────────────────────────────────────┘
`;
  }

  // ── Utility ────────────────────────────────────────────────

  private loadSemanticEntries(): MemoryEntry[] {
    const semanticFile = path.join(this.dir, 'semantic.json');
    try {
      if (!fs.existsSync(semanticFile)) return [];
      return JSON.parse(fs.readFileSync(semanticFile, 'utf-8'));
    } catch { return []; }
  }

  private saveReport(report: BenchmarkReport): void {
    const reportFile = path.join(this.dir, 'benchmark-latest.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
  }

  loadLatestReport(): BenchmarkReport | null {
    const reportFile = path.join(this.dir, 'benchmark-latest.json');
    try {
      if (!fs.existsSync(reportFile)) return null;
      return JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
    } catch { return null; }
  }
}