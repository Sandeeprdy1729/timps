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
import { join, resolve } from 'path';
import { parseArgs } from 'util';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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

  // tool_calls checks — look for [tool: name] markers in output
  for (const toolName of evCase.expected.tool_calls ?? []) {
    const passed = toolCallsMade.includes(toolName);
    checks.push({ name: `tool_called:"${toolName}"`, passed, detail: passed ? undefined : `Tool not called: ${toolName}` });
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

// ── Agent invocation ──────────────────────────────────────────────────────

/** Invoke the timps binary with a prompt and return stdout + tool calls detected. */
async function invokeAgent(
  prompt: string,
  cwd: string,
  timeoutMs: number,
): Promise<{ output: string; toolCalls: string[] }> {
  const bin = process.platform === 'win32' ? 'timps.exe' : 'timps';

  // Resolve the binary — prefer local build, fall back to PATH
  const localBin = resolve(process.cwd(), 'target', 'debug', bin);
  const binPath = existsSync(localBin) ? localBin : bin;

  try {
    const { stdout, stderr } = await execFileAsync(
      binPath,
      ['--prompt', prompt],
      { cwd, timeout: timeoutMs, maxBuffer: 1024 * 1024 },
    );

    const combined = (stdout || '') + (stderr || '');

    // Parse tool calls from [tool: name] markers emitted by the CLI
    const toolCalls: string[] = [];
    const toolRe = /\[tool:\s*([^\]]+)\]/g;
    let match;
    while ((match = toolRe.exec(combined)) !== null) {
      toolCalls.push(match[1].trim());
    }

    return { output: combined, toolCalls };
  } catch (err: any) {
    // Timeout or exec error
    const msg = err?.killed
      ? `Timed out after ${timeoutMs}ms`
      : err?.message || String(err);
    return { output: msg, toolCalls: [] };
  }
}

// ── Suite runner ──────────────────────────────────────────────────────────

/** Extract an EvalSuite from a dynamically imported module. */
function extractSuite(mod: any): EvalSuite | null {
  // Priority: default export → named exports that look like EvalSuite
  if (mod.default && mod.default.cases) return mod.default;
  for (const val of Object.values(mod)) {
    if (val && typeof val === 'object' && 'cases' in val && Array.isArray((val as any).cases)) {
      return val as EvalSuite;
    }
  }
  return null;
}

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

async function main() {
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

  const allSuites: SuiteResult[] = [];
  const cwd = process.cwd();

  for (const file of files) {
    const suiteName = file.replace(/\.\w+$/, '');
    console.log(`\n  Suite: ${suiteName}`);

    const mod = await import(join(suitesDir, file));
    const suite = extractSuite(mod);

    if (!suite) {
      console.log(`    ⚠ No EvalSuite found in ${file}, skipping`);
      continue;
    }

    console.log(`    ${suite.description} (${suite.cases.length} cases)`);

    const results: EvalResult[] = [];
    for (const evCase of suite.cases) {
      const timeoutMs = evCase.timeout_ms ?? 30_000;
      const t0 = Date.now();
      const { output, toolCalls } = await invokeAgent(evCase.input, cwd, timeoutMs);
      const latencyMs = Date.now() - t0;

      const result = evalCase(evCase, output, toolCalls);
      result.latency_ms = latencyMs;
      results.push(result);

      const icon = result.passed ? '✓' : '✗';
      console.log(`    ${icon} ${evCase.id}: ${evCase.description} (${latencyMs}ms)`);
      if (!result.passed) {
        for (const check of result.checks.filter((c) => !c.passed)) {
          console.log(`        FAIL: ${check.name} — ${check.detail ?? ''}`);
        }
      }
    }

    const suiteResult = aggregateSuite(suiteName, results);
    allSuites.push(suiteResult);
    console.log(`    → ${suiteResult.passed}/${suiteResult.total} passed (score: ${suiteResult.score})`);
  }

  writeFileSync(outputFile, JSON.stringify(allSuites, null, 2));
  console.log(`\nResults written to: ${outputFile}`);

  // Exit with non-zero if any suite had failures
  const anyFailed = allSuites.some((s) => s.failed > 0);
  process.exit(anyFailed ? 1 : 0);
}

// Cross-platform CLI entry check (works on Windows, macOS, Linux)
const isMainModule = process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (isMainModule) {
  main().catch((err) => {
    console.error('Eval runner failed:', err);
    process.exit(1);
  });
}
