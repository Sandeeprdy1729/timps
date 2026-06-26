import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MemoryEngine } from '../MemoryEngine.js';
import { InMemoryBackend } from '../backends/InMemoryBackend.js';
import { loadDataset, loadAllDatasets, createFreshEngine, seedEngineWithDataset, evaluateDataset, formatEvalSummary, computeDatasetSha } from './runner.js';
import { BaselineManager } from './baseline.js';
import { RegressionDetector } from './regression.js';
import { AbTestRunner } from './abtest.js';
import { EvalStorage } from './storage.js';
import type { EvalResult, EvalBaseline, VariantConfig, RegressionResult } from './types.js';
import { DATASET_NAMES, DEFAULT_EVAL_THRESHOLDS } from './types.js';

describe('Eval Datasets', () => {
  it('loads all 5 datasets', () => {
    const datasets = loadAllDatasets();
    expect(datasets).toHaveLength(5);
    const names = datasets.map(d => d.name);
    expect(names).toContain('multi-layer-recall');
    expect(names).toContain('adversarial-contradictions');
    expect(names).toContain('long-context-retrieval');
    expect(names).toContain('temporal-ordering');
    expect(names).toContain('multi-agent-consistency');
  });

  it('each dataset has a valid version string', () => {
    const datasets = loadAllDatasets();
    for (const d of datasets) {
      expect(d.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(d.examples.length).toBeGreaterThan(0);
    }
  });

  it('each dataset example has query and expectedMemories', () => {
    const datasets = loadAllDatasets();
    for (const d of datasets) {
      for (const ex of d.examples) {
        expect(ex.query).toBeTruthy();
        expect(ex.expectedMemories.length).toBeGreaterThan(0);
      }
    }
  });

  it('computeDatasetSha returns consistent hash', () => {
    const sha1 = computeDatasetSha();
    const sha2 = computeDatasetSha();
    expect(sha1).toBe(sha2);
    expect(sha1.length).toBe(64);
  });
});

describe('Eval Runner', () => {
  it('creates a fresh engine with InMemoryBackend', () => {
    const engine = createFreshEngine();
    expect(engine).toBeInstanceOf(MemoryEngine);
  });

  it('evaluates a dataset and produces metrics', async () => {
    const dataset = loadDataset('multi-layer-recall');
    const engine = createFreshEngine();
    seedEngineWithDataset(engine, dataset);
    const result = await evaluateDataset(engine, dataset, 'test-run', 'abc123', 'default');

    expect(result.datasetName).toBe('multi-layer-recall');
    expect(result.runId).toBe('test-run');
    expect(result.gitSha).toBe('abc123');
    expect(result.variantName).toBe('default');
    expect(result.metrics.length).toBeGreaterThan(0);

    const recall5 = result.metrics.find(m => m.name === 'recall@5');
    expect(recall5).toBeDefined();
    expect(recall5!.value).toBeGreaterThanOrEqual(0);
    expect(recall5!.unit).toBe('%');

    expect(result.perExample.length).toBe(dataset.examples.length);
    expect(result.summary.totalExamples).toBe(dataset.examples.length);
  });

  it('formatEvalSummary produces readable output', async () => {
    const dataset = loadDataset('multi-layer-recall');
    const engine = createFreshEngine();
    seedEngineWithDataset(engine, dataset);
    const result = await evaluateDataset(engine, dataset, 'test-run', 'abc123', 'default');
    const summary = formatEvalSummary(result);

    expect(summary).toContain('Dataset:');
    expect(summary).toContain('Recall@5:');
    expect(summary).toContain('MRR:');
    expect(summary).toContain('Latency:');
  });

  it('evaluates all 5 datasets without errors', async () => {
    const datasets = loadAllDatasets();
    for (const dataset of datasets) {
      const engine = createFreshEngine();
      seedEngineWithDataset(engine, dataset);
      const result = await evaluateDataset(engine, dataset, 'test-run', 'abc123', 'default');
      expect(result.summary.totalExamples).toBe(dataset.examples.length);
      expect(result.metrics.length).toBeGreaterThan(0);
    }
  });
});

describe('BaselineManager', () => {
  let tmpDir: string;
  let baselineManager: BaselineManager;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-baseline-test-'));
    baselineManager = new BaselineManager(tmpDir);
  });

  it('saves and loads a baseline', () => {
    const mockResult: EvalResult = {
      datasetName: 'multi-layer-recall',
      runId: 'test-run',
      timestamp: Date.now(),
      gitSha: 'abc123',
      variantName: 'default',
      metrics: [
        { name: 'recall@5', value: 95.0, unit: '%', threshold: 90, direction: 'higher' },
        { name: 'latency_p95', value: 45, unit: 'ms', threshold: 200, direction: 'lower' },
      ],
      perExample: [],
      summary: { totalExamples: 8, passed: 7, failed: 1, avgRecallAt5: 87.5, avgRecallAt10: 95.0, avgMrr: 0.85, avgLatencyMs: 30, p50LatencyMs: 25, p95LatencyMs: 45, p99LatencyMs: 60 },
    };

    baselineManager.saveBaseline(mockResult, 'main');
    const loaded = baselineManager.loadBaseline('multi-layer-recall', 'main');

    expect(loaded).not.toBeNull();
    expect(loaded!.datasetName).toBe('multi-layer-recall');
    expect(loaded!.branch).toBe('main');
    expect(loaded!.metrics['recall@5']).toBe(95.0);
  });

  it('returns null for missing baseline', () => {
    const loaded = baselineManager.loadBaseline('nonexistent', 'main');
    expect(loaded).toBeNull();
  });

  it('compareAgainstBaseline returns deltas', () => {
    const mockResult: EvalResult = {
      datasetName: 'multi-layer-recall',
      runId: 'test-run-2',
      timestamp: Date.now(),
      gitSha: 'def456',
      variantName: 'default',
      metrics: [
        { name: 'recall@5', value: 92.0, unit: '%', threshold: 90, direction: 'higher' },
      ],
      perExample: [],
      summary: { totalExamples: 8, passed: 7, failed: 1, avgRecallAt5: 87.5, avgRecallAt10: 95.0, avgMrr: 0.85, avgLatencyMs: 30, p50LatencyMs: 25, p95LatencyMs: 45, p99LatencyMs: 60 },
    };

    const result = baselineManager.compareAgainstBaseline(mockResult, 'main');
    expect(result.baseline).not.toBeNull();
    expect(result.deltas['recall@5']).toBe(-3.0);
  });

  it('lists baselines', () => {
    const baselines = baselineManager.listBaselines();
    expect(baselines.length).toBeGreaterThan(0);
  });
});

describe('RegressionDetector', () => {
  it('detects regression when below threshold', () => {
    const detector = new RegressionDetector(DEFAULT_EVAL_THRESHOLDS);
    const result: EvalResult = {
      datasetName: 'multi-layer-recall',
      runId: 'test',
      timestamp: Date.now(),
      gitSha: 'abc',
      variantName: 'default',
      metrics: [
        { name: 'recall@5', value: 85.0, unit: '%', threshold: 90, direction: 'higher' },
      ],
      perExample: [],
      summary: { totalExamples: 8, passed: 6, failed: 2, avgRecallAt5: 75, avgRecallAt10: 85, avgMrr: 0.7, avgLatencyMs: 30, p50LatencyMs: 25, p95LatencyMs: 45, p99LatencyMs: 60 },
    };

    const regressions = detector.check(result, null);
    expect(regressions.length).toBeGreaterThan(0);

    const recallRegression = regressions.find(r => r.metric === 'recall@5');
    expect(recallRegression).toBeDefined();
    expect(recallRegression!.severity).toBe('block');
    expect(recallRegression!.passed).toBe(false);
  });

  it('passes when metric meets threshold', () => {
    const detector = new RegressionDetector(DEFAULT_EVAL_THRESHOLDS);
    const result: EvalResult = {
      datasetName: 'multi-layer-recall',
      runId: 'test',
      timestamp: Date.now(),
      gitSha: 'abc',
      variantName: 'default',
      metrics: [
        { name: 'recall@5', value: 95.0, unit: '%', threshold: 90, direction: 'higher' },
      ],
      perExample: [],
      summary: { totalExamples: 8, passed: 8, failed: 0, avgRecallAt5: 100, avgRecallAt10: 100, avgMrr: 1.0, avgLatencyMs: 30, p50LatencyMs: 25, p95LatencyMs: 45, p99LatencyMs: 60 },
    };

    const regressions = detector.check(result, null);
    const recallRegression = regressions.find(r => r.metric === 'recall@5');
    expect(recallRegression!.severity).toBe('pass');
  });

  it('gateCheck correctly identifies blockers', () => {
    const detector = new RegressionDetector();
    const regressions: RegressionResult[] = [
      { datasetName: 'test', metric: 'recall@5', baseline: 95, current: 80, delta: -15, threshold: 90, passed: false, severity: 'block' },
      { datasetName: 'test', metric: 'latency_p95', baseline: 45, current: 50, delta: 5, threshold: 200, passed: true, severity: 'pass' },
    ];

    const gate = detector.gateCheck(regressions);
    expect(gate.blocked).toBe(true);
    expect(gate.blockers).toHaveLength(1);
    expect(gate.passed).toHaveLength(1);
  });

  it('formatGateReport produces readable output', () => {
    const detector = new RegressionDetector();
    const regressions: RegressionResult[] = [
      { datasetName: 'test', metric: 'recall@5', baseline: 95, current: 88, delta: -7, threshold: 90, passed: false, severity: 'block' },
    ];
    const gate = detector.gateCheck(regressions);
    const report = detector.formatGateReport(gate);
    expect(report).toContain('EVAL GATE FAILED');
    expect(report).toContain('recall@5');
  });
});

describe('AbTestRunner', () => {
  it('compares two variants', async () => {
    const runner = new AbTestRunner();
    const variantA: VariantConfig = { name: 'baseline', overrides: {} };
    const variantB: VariantConfig = { name: 'experiment', overrides: {} };

    const results = await runner.runComparison(variantA, variantB, ['multi-layer-recall'], 'ab-test', 'abc123');
    expect(results).toHaveLength(1);
    expect(results[0].variantA).toBe('baseline');
    expect(results[0].variantB).toBe('experiment');
    expect(results[0].datasetName).toBe('multi-layer-recall');
    expect(results[0].metrics.length).toBeGreaterThan(0);
    expect(results[0].recommendation).toBeTruthy();
  });

  it('formatReport produces readable output', async () => {
    const runner = new AbTestRunner();
    const variantA: VariantConfig = { name: 'baseline', overrides: {} };
    const variantB: VariantConfig = { name: 'experiment', overrides: {} };

    const results = await runner.runComparison(variantA, variantB, ['multi-layer-recall'], 'ab-test', 'abc123');
    const report = runner.formatReport(results);
    expect(report).toContain('A/B Test Comparison Report');
    expect(report).toContain('baseline');
    expect(report).toContain('experiment');
  });
});

describe('EvalStorage', () => {
  it('saves and loads eval results', async () => {
    const backend = new InMemoryBackend();
    const storage = new EvalStorage(backend);

    const result: EvalResult = {
      datasetName: 'multi-layer-recall',
      runId: 'test-run',
      timestamp: Date.now(),
      gitSha: 'abc123',
      variantName: 'default',
      metrics: [{ name: 'recall@5', value: 95.0, unit: '%', threshold: 90, direction: 'higher' }],
      perExample: [],
      summary: { totalExamples: 8, passed: 8, failed: 0, avgRecallAt5: 100, avgRecallAt10: 100, avgMrr: 1.0, avgLatencyMs: 30, p50LatencyMs: 25, p95LatencyMs: 45, p99LatencyMs: 60 },
    };

    await storage.saveResult(result);
    const loaded = await storage.loadResult('multi-layer-recall', 'test-run');
    expect(loaded).not.toBeNull();
    expect(loaded!.datasetName).toBe('multi-layer-recall');
  });

  it('lists results sorted by timestamp desc', async () => {
    const backend = new InMemoryBackend();
    const storage = new EvalStorage(backend);

    const oldResult: EvalResult = {
      datasetName: 'multi-layer-recall',
      runId: 'old',
      timestamp: 1000,
      gitSha: 'abc',
      variantName: 'default',
      metrics: [{ name: 'recall@5', value: 90, unit: '%' }],
      perExample: [],
      summary: { totalExamples: 8, passed: 8, failed: 0, avgRecallAt5: 100, avgRecallAt10: 100, avgMrr: 1.0, avgLatencyMs: 30, p50LatencyMs: 25, p95LatencyMs: 45, p99LatencyMs: 60 },
    };
    const newResult: EvalResult = { ...oldResult, runId: 'new', timestamp: 2000 };

    await storage.saveResult(oldResult);
    await storage.saveResult(newResult);

    const results = await storage.listResults('multi-layer-recall');
    expect(results).toHaveLength(2);
    expect(results[0].runId).toBe('new');
    expect(results[1].runId).toBe('old');
  });

  it('saves and loads baselines', async () => {
    const backend = new InMemoryBackend();
    const storage = new EvalStorage(backend);

    const baseline: EvalBaseline = {
      datasetName: 'multi-layer-recall',
      branch: 'main',
      timestamp: Date.now(),
      gitSha: 'abc123',
      metrics: { 'recall@5': 95.0 },
    };

    await storage.saveBaseline(baseline);
    const loaded = await storage.loadBaseline('multi-layer-recall', 'main');
    expect(loaded).not.toBeNull();
    expect(loaded!.metrics['recall@5']).toBe(95.0);
  });

  it('getTimeSeries returns ordered data', async () => {
    const backend = new InMemoryBackend();
    const storage = new EvalStorage(backend);

    for (let i = 0; i < 5; i++) {
      const result: EvalResult = {
        datasetName: 'multi-layer-recall',
        runId: `run-${i}`,
        timestamp: 1000 + i * 100,
        gitSha: 'abc',
        variantName: 'default',
        metrics: [{ name: 'recall@5', value: 90 + i, unit: '%' }],
        perExample: [],
        summary: { totalExamples: 8, passed: 8, failed: 0, avgRecallAt5: 100, avgRecallAt10: 100, avgMrr: 1.0, avgLatencyMs: 30, p50LatencyMs: 25, p95LatencyMs: 45, p99LatencyMs: 60 },
      };
      await storage.saveResult(result);
    }

    const series = await storage.getTimeSeries('multi-layer-recall', 'recall@5', 10);
    expect(series).toHaveLength(5);
    expect(series[0].timestamp).toBe(1000);
    expect(series[4].timestamp).toBe(1400);
  });
});
