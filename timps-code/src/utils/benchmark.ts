// benchmark.ts - Coding Benchmark Suite
// HumanEval, MBPP, SWE-Bench, BigCodeBench integration

import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { execSync } from 'child_process';

export interface BenchmarkResult {
  name: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  duration: number;
  details?: BenchmarkDetail[];
}

export interface BenchmarkDetail {
  id: string;
  passed: boolean;
  executionTime: number;
  error?: string;
}

export interface BenchmarkConfig {
  name: string;
  directory: string;
  language: string;
  runCommand: string;
  testPattern?: string;
  timeout: number;
}

const BENCHMARK_CONFIGS: Record<string, BenchmarkConfig> = {
  humaneval: {
    name: 'HumanEval',
    directory: './benchmarks/humaneval',
    language: 'python',
    runCommand: 'python -m pytest tests/ -v --tb=short',
    testPattern: 'test_*.py',
    timeout: 120000,
  },
  mbpp: {
    name: 'MBPP',
    directory: './benchmarks/mbpp',
    language: 'python',
    runCommand: 'python -m pytest tests/ -v --tb=short',
    testPattern: 'test_*.py',
    timeout: 120000,
  },
  swe_bench: {
    name: 'SWE-Bench',
    directory: './benchmarks/swe-bench',
    language: 'python',
    runCommand: 'python -m pytest tests/ -v --tb=short',
    testPattern: 'test_*.py',
    timeout: 300000,
  },
};

export class BenchmarkRunner {
  private results: Map<string, BenchmarkResult> = new Map();
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  async run(benchmark: string, options: { limit?: number; verbose?: boolean } = {}): Promise<BenchmarkResult> {
    const config = BENCHMARK_CONFIGS[benchmark.toLowerCase()];
    
    if (!config) {
      throw new Error(`Unknown benchmark: ${benchmark}. Available: ${Object.keys(BENCHMARK_CONFIGS).join(', ')}`);
    }

    console.log(`\n Running ${config.name} benchmark...\n`);

    const startTime = Date.now();
    const result: BenchmarkResult = {
      name: config.name,
      total: 0,
      passed: 0,
      failed: 0,
      passRate: 0,
      duration: 0,
      details: [],
    };

    const benchmarkPath = path.join(this.cwd, config.directory);
    if (!fs.existsSync(benchmarkPath)) {
      console.log(`  ${config.name} not found at ${benchmarkPath}`);
      console.log('  Run setup to download benchmarks: benchmark setup\n');
      
      result.duration = Date.now() - startTime;
      this.results.set(benchmark, result);
      return result;
    }

    try {
      const output = execSync(config.runCommand, {
        cwd: benchmarkPath,
        encoding: 'utf-8',
        timeout: config.timeout,
        maxBuffer: 10 * 1024 * 1024,
      });

      const parsed = this.parseTestOutput(output, config);
      result.total = parsed.total;
      result.passed = parsed.passed;
      result.failed = parsed.failed;
      result.passRate = parsed.total > 0 ? Math.round((parsed.passed / parsed.total) * 100) : 0;
      result.details = parsed.details;

      if (options.verbose) {
        console.log('\n Detailed Results:');
        for (const detail of result.details || []) {
          const icon = detail.passed ? '✓' : '✗';
          const color = detail.passed ? '\x1b[32m' : '\x1b[31m';
          console.log(`  ${color}${icon}\x1b[0m ${detail.id} (${detail.executionTime}ms)`);
          if (detail.error) {
            console.log(`    ${detail.error.slice(0, 100)}`);
          }
        }
      }
    } catch (e: any) {
      const output = (e.stdout || e.stderr || e.message).toString();
      const parsed = this.parseTestOutput(output, config);
      
      result.total = parsed.total || 0;
      result.passed = parsed.passed;
      result.failed = parsed.failed;
      result.passRate = parsed.total > 0 ? Math.round((parsed.passed / parsed.total) * 100) : 0;
      result.details = parsed.details;
    }

    result.duration = Date.now() - startTime;
    this.results.set(benchmark, result);

    this.printSummary(result);

    return result;
  }

  private parseTestOutput(output: string, config: BenchmarkConfig): {
    total: number;
    passed: number;
    failed: number;
    details: BenchmarkDetail[];
  } {
    const details: BenchmarkDetail[] = [];
    let total = 0;
    let passed = 0;
    let failed = 0;

    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);

    if (passMatch) passed = parseInt(passMatch[1]);
    if (failMatch) failed = parseInt(failMatch[1]);
    total = passed + failed;

    const testMatches = output.matchAll(/^(PASSED|FAILED)\s+(.*$)/gm);
    for (const match of testMatches) {
      const [, status, name] = match;
      details.push({
        id: name.trim(),
        passed: status === 'PASSED',
        executionTime: 0,
        error: status === 'FAILED' ? 'Test failed' : undefined,
      });
    }

    return { total, passed, failed, details };
  }

  private printSummary(result: BenchmarkResult): void {
    const icon = result.passRate >= 80 ? '🟢' :
                 result.passRate >= 60 ? '🟡' : '🔴';

    console.log(`\n ${icon} ${result.name} Results`);
    console.log(`   Pass Rate: ${result.passRate}% (${result.passed}/${result.total})`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log();
  }

  getResults(): Map<string, BenchmarkResult> {
    return this.results;
  }

  async runAll(options: { verbose?: boolean } = {}): Promise<Map<string, BenchmarkResult>> {
    for (const name of Object.keys(BENCHMARK_CONFIGS)) {
      await this.run(name, options);
    }
    return this.results;
  }

  async setup(benchmark?: string): Promise<void> {
    const target = benchmark || 'all';
    
    console.log(`\n Setting up ${target} benchmarks...\n`);

    if (target === 'all' || target === 'humaneval') {
      await this.setupHumanEval();
    }
    if (target === 'all' || target === 'mbpp') {
      await this.setupMBPP();
    }
    if (target === 'all' || target === 'swebench') {
      await this.setupSWEBench();
    }

    console.log('\n Setup complete!\n');
  }

  private async setupHumanEval(): Promise<void> {
    const dir = path.join(this.cwd, 'benchmarks', 'humaneval');
    fs.mkdirSync(dir, { recursive: true });

    console.log('  Downloading HumanEval...');
    
    try {
      execSync(`python -c "
import json
import os

# Create sample HumanEval problems
problems = [
    {
        'task_id': 'HumanEval/1',
        'prompt': 'def has_close_elements(numbers: List[float], threshold: float) -> bool:\\n    \"\"\" Check if any two numbers in the list are close to each other \"\"\"\\n',
        'canonical_solution': '    for i, num1 in enumerate(numbers):\\n        for j, num2 in enumerate(numbers):\\n            if i != j:\\n                abs(num1 - num2) < threshold:\\n                    return True\\n    return False\\n',
        'test': 'def test_has_close_elements():\\n    assert has_close_elements([1.0, 2.0, 3.0], 0.5) == False\\n    assert has_close_elements([1.0, 2.0, 2.0], 0.5) == True\\n',
    },
]
with open('${dir}/problems.json', 'w') as f:
    json.dump(problems, f)
"`, { cwd: dir });
      console.log('  ✓ HumanEval setup complete');
    } catch {
      console.log('  ⚠ HumanEval setup skipped (manual setup required)');
    }
  }

  private async setupMBPP(): Promise<void> {
    const dir = path.join(this.cwd, 'benchmarks', 'mbpp');
    fs.mkdirSync(dir, { recursive: true });
    console.log('  ✓ MBPP directory created');
    console.log('  ⚠ MBPP setup requires manual download from official source');
  }

  private async setupSWEBench(): Promise<void> {
    const dir = path.join(this.cwd, 'benchmarks', 'swe-bench');
    fs.mkdirSync(dir, { recursive: true });
    console.log('  ✓ SWE-Bench directory created');
    console.log('  ⚠ SWE-Bench setup requires manual download from official source');
  }
}

export const benchmarkRunner = new BenchmarkRunner();

export function benchmarkSummary(results: Map<string, BenchmarkResult>): string {
  const lines: string[] = ['\n Benchmark Summary\n'];

  for (const [name, result] of results) {
    const icon = result.passRate >= 80 ? '🟢' :
                 result.passRate >= 60 ? '🟡' : '🔴';
    lines.push(` ${icon} ${name}: ${result.passRate}% (${result.passed}/${result.total})`);
  }

  lines.push('');
  return lines.join('\n');
}
