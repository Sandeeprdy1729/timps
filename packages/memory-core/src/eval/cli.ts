#!/usr/bin/env tsx
import { loadAllDatasets, createFreshEngine, seedEngineWithDataset, evaluateDataset, formatEvalSummary } from './runner.js';
import { BaselineManager } from './baseline.js';
import { RegressionDetector } from './regression.js';
import { AbTestRunner } from './abtest.js';
import type { VariantConfig, EvalResult } from './types.js';
import { DEFAULT_EVAL_THRESHOLDS } from './types.js';

const args = process.argv.slice(2);

function printHelp(): void {
  console.log(`
TIMPS Eval CLI — Quality Measurement & Regression Detection

Usage:
  npx tsx packages/memory-core/src/eval/cli.ts [options]

Options:
  --all                  Run all datasets
  --dataset <name>       Run a specific dataset
  --ab <a> <b>           A/B test two variants
  --baseline             Save current results as baseline
  --gate                 Check against baseline (gate check)
  --baseline-dir <path>  Baseline directory (default: .timps/eval-baselines)
  --json <file>          Output results as JSON to file
  --help                 Show this help

Examples:
  npx tsx eval.ts --all
  npx tsx eval.ts --dataset multi-layer-recall
  npx tsx eval.ts --ab baseline experiment --dataset multi-layer-recall
  npx tsx eval.ts --baseline
  npx tsx eval.ts --gate
`);
}

async function main(): Promise<void> {
  if (args.includes('--help') || args.length === 0) {
    printHelp();
    return;
  }

  const baselineDir = args.includes('--baseline-dir')
    ? args[args.indexOf('--baseline-dir') + 1]
    : '.timps/eval-baselines';
  const jsonFile = args.includes('--json')
    ? args[args.indexOf('--json') + 1]
    : null;
  const datasetName = args.includes('--dataset')
    ? args[args.indexOf('--dataset') + 1]
    : null;

  const datasets = datasetName
    ? loadAllDatasets().filter(d => d.name === datasetName)
    : args.includes('--all') ? loadAllDatasets() : [];

  if (datasets.length === 0 && !args.includes('--baseline') && !args.includes('--gate') && !args.includes('--ab')) {
    console.error('No datasets found. Use --all, --dataset <name>, --baseline, --gate, or --ab.');
    printHelp();
    process.exit(1);
  }

  if (args.includes('--ab')) {
    const aName = args[args.indexOf('--ab') + 1] || 'baseline';
    const bName = args[args.indexOf('--ab') + 2] || 'experiment';
    const variantA: VariantConfig = { name: aName, overrides: {} };
    const variantB: VariantConfig = { name: bName, overrides: {} };
    const runner = new AbTestRunner();
    const ds = args.includes('--dataset') ? datasetName! : datasets[0]?.name;

    if (!ds) {
      console.error('Please specify a dataset: --dataset <name>');
      process.exit(1);
    }

    const results = await runner.runComparison(variantA, variantB, [ds], 'cli-ab', 'unknown');
    console.log(runner.formatReport(results));
    return;
  }

  if (args.includes('--baseline')) {
    const manager = new BaselineManager(baselineDir);
    for (const dataset of datasets) {
      const engine = createFreshEngine();
      seedEngineWithDataset(engine, dataset);
      const result = await evaluateDataset(engine, dataset, `cli-baseline-${Date.now()}`, 'unknown', 'default');
      manager.saveBaseline(result, 'main');
      console.log(`✅ Baseline saved: ${dataset.name}`);
    }
    return;
  }

  if (args.includes('--gate')) {
    const manager = new BaselineManager(baselineDir);
    const detector = new RegressionDetector(DEFAULT_EVAL_THRESHOLDS);
    let blocked = false;
    const allGateResults: any[] = [];

    for (const dataset of datasets) {
      const engine = createFreshEngine();
      seedEngineWithDataset(engine, dataset);
      const result = await evaluateDataset(engine, dataset, `cli-gate-${Date.now()}`, 'unknown', 'default');
      allGateResults.push(result);

      const { baseline, deltas, passed } = manager.compareAgainstBaseline(result, 'main');
      if (!baseline) {
        console.log(`⬜ ${dataset.name}: No baseline (run --baseline first)`);
        continue;
      }

      if (!passed) {
        blocked = true;
        console.log(`🔴 ${dataset.name}: GATE BLOCKED`);
        for (const [metric, delta] of Object.entries(deltas)) {
          const bv = baseline.metrics[metric];
          const cv = result.metrics.find(m => m.name === metric)?.value;
          console.log(`     ${metric}: ${bv} → ${cv} (Δ=${delta > 0 ? '+' : ''}${delta})`);
        }
      } else {
        console.log(`✅ ${dataset.name}: Passed`);
      }
    }

    if (blocked) {
      console.log('\n❌ EVAL GATE FAILED — fix regressions before merging');
      process.exit(1);
    } else {
      console.log('\n✅ EVAL GATE PASSED — all metrics meet thresholds');
    }

    if (jsonFile) {
      const fs = await import('node:fs');
      fs.writeFileSync(jsonFile, JSON.stringify({ results: allGateResults, blocked }, null, 2));
    }
    return;
  }

  // Run datasets
  const results: EvalResult[] = [];
  for (const dataset of datasets) {
    const engine = createFreshEngine();
    seedEngineWithDataset(engine, dataset);
    const result = await evaluateDataset(engine, dataset, `cli-run-${Date.now()}`, 'unknown', 'default');
    results.push(result);
    console.log(formatEvalSummary(result));
    console.log('');
  }

  if (jsonFile) {
    const fs = await import('node:fs');
    fs.writeFileSync(jsonFile, JSON.stringify({ results }, null, 2));
    console.log(`Results written to: ${jsonFile}`);
  }
}

main().catch(err => {
  console.error('Eval CLI error:', err);
  process.exit(1);
});
