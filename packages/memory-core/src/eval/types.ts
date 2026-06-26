export interface EvalExample {
  query: string;
  expectedMemories: string[];
  context?: string;
}

export interface EvalDataset {
  name: string;
  version: string;
  description: string;
  examples: EvalExample[];
}

export interface EvalMetric {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  direction?: 'higher' | 'lower';
}

export interface EvalResult {
  datasetName: string;
  runId: string;
  timestamp: number;
  gitSha: string;
  variantName: string;
  metrics: EvalMetric[];
  perExample: {
    query: string;
    recallAt5: boolean;
    recallAt10: boolean;
    mrr: number;
    latencyMs: number;
    expectedCount: number;
    foundCount: number;
    errors?: string[];
  }[];
  summary: {
    totalExamples: number;
    passed: number;
    failed: number;
    avgRecallAt5: number;
    avgRecallAt10: number;
    avgMrr: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
  };
}

export interface EvalBaseline {
  datasetName: string;
  branch: string;
  timestamp: number;
  gitSha: string;
  metrics: Record<string, number>;
}

export interface RegressionResult {
  datasetName: string;
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  threshold: number;
  passed: boolean;
  severity: 'pass' | 'warn' | 'block';
}

export interface VariantConfig {
  name: string;
  description?: string;
  overrides: Record<string, unknown>;
}

export interface EvalConfig {
  datasets: string[];
  variants: VariantConfig[];
  baselineBranch?: string;
  thresholds: Record<string, number>;
}

export interface AbTestResult {
  variantA: string;
  variantB: string;
  datasetName: string;
  metrics: {
    name: string;
    a: number;
    b: number;
    delta: number;
    winner: 'a' | 'b' | 'tie';
  }[];
  recommendation: string;
}

export const DEFAULT_EVAL_THRESHOLDS: Record<string, number> = {
  'recall@5': 90,
  'recall@10': 95,
  'mrr': 0.80,
  'latency_p95_ms': 200,
};

export const DATASET_NAMES = [
  'multi-layer-recall',
  'adversarial-contradictions',
  'long-context-retrieval',
  'temporal-ordering',
  'multi-agent-consistency',
] as const;

export type DatasetName = (typeof DATASET_NAMES)[number];
