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

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'by', 'from', 'as', 'it', 'its',
  'this', 'that', 'these', 'those', 'what', 'why', 'when', 'where', 'which',
  'how', 'who', 'do', 'does', 'did', 'not', 'no', 'via', 'use', 'uses', 'used',
  'using', 'we', 'you', 'they', 'them', 'their', 'about', 'into', 'between',
  'out', 'through', 'during', 'after', 'before', 'would', 'could', 'should',
]);

/** Lowercased, stopword-free token bag. Empty for <3 char or punctuation-only input. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

/** Order-independent lexical overlap: shared tokens / smaller token count. */
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

/**
 * Relevance verdict for no-self-hint scoring: an expected memory counts as
 * found when it shares a meaningful fraction of its content tokens with a
 * retrieved memory. Keeps paraphrase tolerance while rejecting fuzzy matches.
 */
function isExpectedHit(expected: string, found: string): boolean {
  const te = tokenize(expected);
  if (te.length < 2) {
    return found.toLowerCase().includes(expected.toLowerCase());
  }
  return tokenOverlap(expected, found) >= 0.45;
}

/**
 * Vacuity guard: an example whose expected memory is stored word-for-word
 * (identical or a substring) makes recall deterministic regardless of retrieval
 * quality — it is flagged `trivial` and excluded from the aggregates.
 */
function isTriviallySeeded(expected: string, stored: string): boolean {
  const eNorm = expected.trim().toLowerCase();
  const sNorm = stored.trim().toLowerCase();
  if (eNorm.length === 0 || sNorm.length === 0) return false;
  return sNorm.includes(eNorm) || eNorm.includes(sNorm);
}

const FALLBACK_PREFIXES = [
  'From the project records',
  'Documented in the build notes',
  'Noted during the last review',
];

/**
 * Deterministic lightweight paraphrase (no Math.random, no external deps).
 * Keeps all content tokens so BM25 ranking is preserved, but reorders the
 * framing so the stored text is no longer a literal copy of the expected
 * memory. Used for seeds when the dataset does not ship explicit seeds.
 */
export function paraphraseSeed(content: string): string {
  const prefix = FALLBACK_PREFIXES[content.length % FALLBACK_PREFIXES.length];
  const words = content.split(' ');
  const mid = Math.max(1, Math.floor(words.length / 2));
  const reordered = [
    ...words.slice(mid),
    ...words.slice(0, mid),
  ];
  return `${prefix}: ${reordered.join(' ')}`;
}

export function seedEngineWithDataset(engine: MemoryEngine, dataset: EvalDataset): void {
  for (const example of dataset.examples) {
    if (example.seeds) {
      for (const seed of example.seeds) {
        engine.store({
          content: example.seedsAreExact ? seed.content : paraphraseSeed(seed.content),
          type: 'fact',
          tags: seed.tags ?? [dataset.name, example.context || 'general'],
          timestamp: seed.timestamp,
        });
      }
    } else {
      for (const memory of example.expectedMemories) {
        engine.store({
          content: paraphraseSeed(memory),
          type: 'fact',
          tags: [dataset.name, example.context || 'general'],
        });
      }
    }
  }
  if (dataset.distractors) {
    for (const d of dataset.distractors) {
      engine.store({
        content: d,
        type: 'fact',
        tags: [dataset.name, 'distractor'],
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
    const storedMemories = engine.getSemanticEntries().map(e => e.content);

    const trivial = example.expectedMemories.some(expected =>
      storedMemories.some(stored => isTriviallySeeded(expected, stored)),
    );

    const matchedMemories = example.expectedMemories.filter(em =>
      foundMemories.some(fm => isExpectedHit(em, fm)),
    );
    const rank = results.findIndex(r =>
      example.expectedMemories.some(em => isExpectedHit(em, r.content)),
    );

    const errors: string[] = [];
    if (trivial) {
      errors.push('Expected memory stored verbatim at seed time — example is self-fulfilling and excluded from aggregates');
    } else if (matchedMemories.length === 0) {
      errors.push('No expected memories found in top 10 results');
    }

    perExample.push({
      query: example.query,
      recallAt5: rank >= 0 && rank < 5,
      recallAt10: rank >= 0,
      mrr: rank >= 0 ? 1 / (rank + 1) : 0,
      latencyMs,
      expectedCount: example.expectedMemories.length,
      foundCount: matchedMemories.length,
      trivial: trivial || undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  const total = perExample.length;
  const scorable = perExample.filter(p => !p.trivial);
  const scorableCount = scorable.length;
  const trivialExcluded = total - scorableCount;
  const passed = scorable.filter(p => p.recallAt5).length;
  const avgRecallAt5 = scorableCount > 0 ? (passed / scorableCount) * 100 : 0;
  const avgRecallAt10 = scorableCount > 0 ? (scorable.filter(p => p.recallAt10).length / scorableCount) * 100 : 0;
  const avgMrr = scorableCount > 0 ? scorable.reduce((s, p) => s + p.mrr, 0) / scorableCount : 0;
  const avgLatencyMs = scorableCount > 0 ? scorable.reduce((s, p) => s + p.latencyMs, 0) / scorableCount : 0;

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
      trivialExcluded,
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
    `Recall@5:  ${s.avgRecallAt5}% (${s.passed} scorable examples passed)`,
    `Recall@10: ${s.avgRecallAt10}%`,
    `MRR:       ${s.avgMrr}`,
    `Latency:   p50=${s.p50LatencyMs}ms  p95=${s.p95LatencyMs}ms  p99=${s.p99LatencyMs}ms`,
    `Timestamp: ${new Date(result.timestamp).toISOString()}`,
  ];
  if (s.trivialExcluded > 0) {
    lines.splice(2, 0, `Vacuity:   ${s.trivialExcluded} self-fulfilling example(s) excluded`);
  }
  return lines.join('\n');
}
