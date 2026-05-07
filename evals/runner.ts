/**
 * TIMPS Eval Harness — evaluates agent quality on structured test cases.
 *
 * Usage:
 *   npx tsx evals/runner.ts                      # run all evals
 *   npx tsx evals/runner.ts --suite memory       # run memory-accuracy suite
 *   npx tsx evals/runner.ts --suite task         # run task-completion suite
 *   npx tsx evals/runner.ts --output results.json
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'util';

// ── Types ──────────────────────────────────────────────────────────────────

export interface EvalCase {
  id: string;
  description: string;
  input: string;
  expected: {
    contains?: string[];            // output must contain all these strings
    not_contains?: string[];        // output must NOT contain these strings
    tool_calls?: string[];          // these tool names must have been called
    regex?: string;                 // output must match this regex
  };
  tags?: string[];
  timeout_ms?: number;
}

export interface EvalSuite {
  name: string;
  description: string;
  cases: EvalCase[];
}

export interface EvalResult {
  case_id: string;
  passed: boolean;
  score: number;          // 0-1
  output: string;
  tool_calls_made: string[];
  checks: { name: string; passed: boolean; detail?: string }[];
  latency_ms: number;
  error?: string;
}

export interface SuiteResult {
  suite: string;
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  score: number;           // avg 0-1
  results: EvalResult[];
}

// ── Evaluator ─────────────────────────────────────────────────────────────

export function evalCase(
  evCase: EvalCase,
  output: string,
  toolCallsMade: string[],
): EvalResult {
  const checks: EvalResult['checks'] = [];

  // contains checks
  for (const expected of evCase.expected.contains ?? []) {
    const passed = output.toLowerCase().includes(expected.toLowerCase());
    checks.push({ name: `contains:"${expected}"`, passed, detail: passed ? undefined : `Missing: "${expected}"` });
  }

  // not_contains checks
  for (const forbidden of evCase.expected.not_contains ?? []) {
    const passed = !output.toLowerCase().includes(forbidden.toLowerCase());
    checks.push({ name: `not_contains:"${forbidden}"`, passed, detail: passed ? undefined : `Found forbidden: "${forbidden}"` });
  }

  // tool_calls checks
  for (const toolName of evCase.expected.tool_calls ?? []) {
    const passed = toolCallsMade.includes(toolName);
    checks.push({ name: `tool_called:"${toolName}"`, passed, detail: passed ? undefined : `Tool not called: "${toolName}"` });
  }

  // regex check
  if (evCase.expected.regex) {
    const re = new RegExp(evCase.expected.regex, 'i');
    const passed = re.test(output);
    checks.push({ name: `regex:/${evCase.expected.regex}/`, passed });
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const score = checks.length === 0 ? 1 : passedCount / checks.length;
  const passed = checks.every((c) => c.passed);

  return {
    case_id: evCase.id,
    passed,
    score,
    output: output.slice(0, 2000),
    tool_calls_made: toolCallsMade,
    checks,
    latency_ms: 0,  // caller fills this in
  };
}

// ── Suite runner ──────────────────────────────────────────────────────────

export function aggregateSuite(suiteName: string, results: EvalResult[]): SuiteResult {
  const passed = results.filter((r) => r.passed).length;
  const score = results.reduce((sum, r) => sum + r.score, 0) / (results.length || 1);
  return {
    suite: suiteName,
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    score: Math.round(score * 1000) / 1000,
    results,
  };
}

// ── CLI entry point ────────────────────────────────────────────────────────

if (process.argv[1] === import.meta.url.replace('file://', '')) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      suite: { type: 'string' },
      output: { type: 'string' },
    },
  });

  const suiteFilter = values.suite;
  const outputFile = values.output ?? join('evals', 'results', `run-${Date.now()}.json`);

  // Discover suite files
  const suitesDir = join(process.cwd(), 'evals', 'suites');
  if (!existsSync(suitesDir)) {
    console.error('No evals/suites/ directory found. Create eval suites first.');
    process.exit(1);
  }

  const files = readdirSync(suitesDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .filter((f) => !suiteFilter || f.startsWith(suiteFilter));

  if (files.length === 0) {
    console.error(`No suites found${suiteFilter ? ` matching "${suiteFilter}"` : ''}`);
    process.exit(1);
  }

  console.log(`Running ${files.length} suite(s)...`);

  // Results dir
  const resultsDir = join(process.cwd(), 'evals', 'results');
  mkdirSync(resultsDir, { recursive: true });

  // NOTE: In a full implementation, this would dynamically import suites
  // and invoke a real agent. For now, we output the structure for CI.
  const allSuites: SuiteResult[] = [];

  for (const file of files) {
    console.log(`  Suite: ${file} — [dry run in Phase 17 scaffold]`);
    allSuites.push(aggregateSuite(file.replace(/\.\w+$/, ''), []));
  }

  writeFileSync(outputFile, JSON.stringify(allSuites, null, 2));
  console.log(`\nResults written to: ${outputFile}`);
}
