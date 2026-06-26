import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { MemoryEngine } from '../MemoryEngine.js';
import { InMemoryBackend } from '../backends/InMemoryBackend.js';
import type {
  EvalDataset, EvalResult, EvalMetric, EvalConfig, VariantConfig, EvalExample,
} from './types.js';
import { DATASET_NAMES, DEFAULT_EVAL_THRESHOLDS } from './types.js';

const DATASET_PATHS = [
  path.join(process.cwd(), 'packages', 'memory-core', 'evals', 'datasets'),
  path.join(process.cwd(), 'evals', 'datasets'),
  path.join(__dirname, '..', '..', '..', 'evals', 'datasets'),
];

function resolveDatasetPath(name: string): string {
  for (const dir of DATASET_PATHS) {
    const filePath = path.join(dir, `${name}.json`);
    if (fs.existsSync(filePath)) return filePath;
  }
  throw new Error(`Dataset "${name}" not found in any of: ${DATASET_PATHS.join(', ')}`);
}

export function loadDataset(name: string): EvalDataset {
  const filePath = resolveDatasetPath(name);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as EvalDataset;
}

export function loadAllDatasets(): EvalDataset[] {
  return DATASET_NAMES.map(name => loadDataset(name));
}

export function computeDatasetSha(): string {
  const hash = crypto.createHash('sha256');
  for (const name of DATASET_NAMES) {
    const filePath = resolveDatasetPath(name);
    const content = fs.readFileSync(filePath, 'utf-8');
    hash.update(name);
    hash.update('\0');
    hash.update(content);
  }
  return hash.digest('hex');
}

export function seedEngineWithDataset(engine: MemoryEngine, dataset: EvalDataset): void {
  for (const example of dataset.examples) {
    for (const memory of example.expectedMemories) {
      engine.store({
        content: memory,
        type: 'fact',
        tags: [dataset.name, example.context || 'general'],
      });
    }
  }
}

export async function evaluateDataset(
  engine: MemoryEngine,
  dataset: EvalDataset,
  runId: string,
  gitSha: string,
  variantName: string,
): Promise<EvalResult> {
  const perExample: EvalResult['perExample'] = [];
  const latencies: number[] = [];

  for (const example of dataset.examples) {
    const t0 = performance.now();
    const results = await engine.recall(example.query, { limit: 10 });
    const latencyMs = performance.now() - t0;
    latencies.push(latencyMs);

    const foundMemories = results.map(r => r.content);
    const matchedMemories = example.expectedMemories.filter(em =>
      foundMemories.some(fm => fm.includes(em.slice(0, 40))),
    );
    const rank = results.findIndex(r =>
      example.expectedMemories.some(em => r.content.includes(em.slice(0, 40))),
    );

    perExample.push({
      query: example.query,
      recallAt5: rank >= 0 && rank < 5,
      recallAt10: rank >= 0,
      mrr: rank >= 0 ? 1 / (rank + 1) : 0,
      latencyMs,
      expectedCount: example.expectedMemories.length,
      foundCount: matchedMemories.length,
      errors: matchedMemories.length === 0 ? ['No expected memories found in top 10 results'] : undefined,
    });
  }

  const total = perExample.length;
  const passed = perExample.filter(p => p.recallAt5).length;
  const avgRecallAt5 = total > 0 ? (passed / total) * 100 : 0;
  const avgRecallAt10 = total > 0 ? (perExample.filter(p => p.recallAt10).length / total) * 100 : 0;
  const avgMrr = total > 0 ? perExample.reduce((s, p) => s + p.mrr, 0) / total : 0;
  const avgLatencyMs = total > 0 ? latencies.reduce((a, b) => a + b, 0) / total : 0;

  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const p50LatencyMs = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
  const p95LatencyMs = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
  const p99LatencyMs = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;

  return {
    datasetName: dataset.name,
    runId,
    timestamp: Date.now(),
    gitSha,
    variantName,
    metrics: [
      { name: 'recall@5', value: Math.round(avgRecallAt5 * 100) / 100, unit: '%', threshold: DEFAULT_EVAL_THRESHOLDS['recall@5'], direction: 'higher' },
      { name: 'recall@10', value: Math.round(avgRecallAt10 * 100) / 100, unit: '%', threshold: DEFAULT_EVAL_THRESHOLDS['recall@10'], direction: 'higher' },
      { name: 'mrr', value: Math.round(avgMrr * 10000) / 10000, unit: '', threshold: DEFAULT_EVAL_THRESHOLDS['mrr'], direction: 'higher' },
      { name: 'latency_p50', value: Math.round(p50LatencyMs * 100) / 100, unit: 'ms', direction: 'lower' },
      { name: 'latency_p95', value: Math.round(p95LatencyMs * 100) / 100, unit: 'ms', threshold: DEFAULT_EVAL_THRESHOLDS['latency_p95_ms'], direction: 'lower' },
      { name: 'latency_p99', value: Math.round(p99LatencyMs * 100) / 100, unit: 'ms', direction: 'lower' },
    ],
    perExample,
    summary: {
      totalExamples: total,
      passed,
      failed: total - passed,
      avgRecallAt5: Math.round(avgRecallAt5 * 100) / 100,
      avgRecallAt10: Math.round(avgRecallAt10 * 100) / 100,
      avgMrr: Math.round(avgMrr * 10000) / 10000,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
      p50LatencyMs: Math.round(p50LatencyMs * 100) / 100,
      p95LatencyMs: Math.round(p95LatencyMs * 100) / 100,
      p99LatencyMs: Math.round(p99LatencyMs * 100) / 100,
    },
  };
}

export function createFreshEngine(): MemoryEngine {
  const backend = new InMemoryBackend();
  return new MemoryEngine('/eval-temp', { backend });
}

export async function runVariant(
  variant: VariantConfig,
  datasets: EvalDataset[],
  runId: string,
  gitSha: string,
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  for (const dataset of datasets) {
    const engine = createFreshEngine();
    seedEngineWithDataset(engine, dataset);
    const result = await evaluateDataset(engine, dataset, runId, gitSha, variant.name);
    results.push(result);
  }
  return results;
}

export async function runFullEvalSuite(
  config: EvalConfig,
  gitSha: string,
): Promise<{ variantResults: Map<string, EvalResult[]>; runId: string }> {
  const datasets = config.datasets.map(name => loadDataset(name));
  const runId = `eval-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const variantResults = new Map<string, EvalResult[]>();

  for (const variant of config.variants) {
    const results = await runVariant(variant, datasets, runId, gitSha);
    variantResults.set(variant.name, results);
  }

  return { variantResults, runId };
}

export function formatEvalSummary(result: EvalResult): string {
  const s = result.summary;
  const lines = [
    `Dataset: ${result.datasetName}`,
    `Variant: ${result.variantName}`,
    `Recall@5:  ${s.avgRecallAt5}% (${s.passed}/${s.totalExamples} passed)`,
    `Recall@10: ${s.avgRecallAt10}%`,
    `MRR:       ${s.avgMrr}`,
    `Latency:   p50=${s.p50LatencyMs}ms  p95=${s.p95LatencyMs}ms  p99=${s.p99LatencyMs}ms`,
    `Timestamp: ${new Date(result.timestamp).toISOString()}`,
  ];
  return lines.join('\n');
}
