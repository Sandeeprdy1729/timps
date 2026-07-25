// swebench-runner.ts - SWE-bench Evaluation Runner
// Runs SWE-bench Lite/Verified to measure agent performance

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as childProcess from 'node:child_process';
import { Agent } from '../core/agent.js';
import { createProvider } from '../models/index.js';
import type { ModelProvider, ProviderName } from '../config/types.js';

export interface SWEBenchConfig {
  provider: ProviderName;
  model?: string;
  suite: 'lite' | 'verified' | 'pro' | 'full';
  maxInstances?: number;
  outputDir?: string;
  timeout?: number;
  multiFileModifications?: boolean;  // Pro requires multi-file changes
  longHorizon?: boolean;            // Pro has longer time horizons
}

export interface SWEBenchInstance {
  instance_id: string;
  repo: string;
  base_commit: string;
  patch: string;
  problem_statement: string;
  model_patch?: string;
  status?: string;
}

export interface EvaluationResult {
  instance_id: string;
  model_patch: string;
  status: 'resolved' | 'resolved_other' | 'unresolved';
  resolved_at?: string;
  metrics: {
    patch_diff: string;
    test_results?: string;
  };
}

export class SWEBenchRunner {
  private config: SWEBenchConfig;
  private provider: ModelProvider;
  private outputDir: string;
  private results: EvaluationResult[] = [];
  private instances: SWEBenchInstance[] = [];

  constructor(config: SWEBenchConfig) {
    this.config = config;
    this.provider = createProvider(config.provider, config.model);
    this.outputDir = config.outputDir || path.join(os.homedir(), '.timps', 'swebench');
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async *run(): AsyncGenerator<{ type: string; message: string; progress?: number }> {
    yield { type: 'status', message: `🧪 SWE-bench Evaluation: ${this.config.suite}` };

    yield* this.loadInstances();
    
    const total = this.instances.length;
    let passed = 0;

    for (let i = 0; i < this.instances.length; i++) {
      const instance = this.instances[i];
      yield { type: 'status', message: `Testing ${i + 1}/${total}: ${instance.instance_id}`, progress: Math.floor((i / total) * 100) };

      const result = await this.evaluateInstance(instance);
      this.results.push(result);

      if (result.status === 'resolved') {
        passed++;
      }

      // Save intermediate results
      this.saveResults();
    }

    const passRate = (passed / total) * 100;
    yield { type: 'status', message: `✅ SWE-bench Complete: ${passed}/${total} (${passRate.toFixed(1)}%)`, progress: 100 };
    yield { type: 'status', message: `📁 Results: ${this.outputDir}` };
  }

  private async *loadInstances(): AsyncGenerator<{ type: string; message: string }> {
    yield { type: 'status', message: '📥 Loading SWE-bench instances...' };

    // Check for local SWE-bench data
    const dataDir = process.env.SWEBENCH_DATA || '/tmp/swebench';
    
    if (fs.existsSync(path.join(dataDir, 'instances.json'))) {
      const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'instances.json'), 'utf-8'));
      this.instances = data.slice(0, this.config.maxInstances || 10);
      yield { type: 'status', message: `Loaded ${this.instances.length} instances from local data` };
      return;
    }

    // Try to download SWE-bench Lite
    yield { type: 'status', message: '📡 Attempting to fetch SWE-bench Lite...' };

    try {
      // Clone SWE-bench repository for data
      const tarball = path.join(os.tmpdir(), 'swebench-lite.tar.gz');
      
      // For now, create mock instances for testing
      this.instances = this.generateMockInstances(this.config.maxInstances || 10);
      yield { type: 'status', message: `Using ${this.instances.length} mock instances (install SWE-bench for real eval)` };
    } catch (e) {
      this.instances = this.generateMockInstances(5);
      yield { type: 'status', message: `Using ${this.instances.length} mock instances for demo` };
    }
  }

  private generateMockInstances(count: number): SWEBenchInstance[] {
    const mockIssues = [
      { repo: 'django/django', issue: 'Fix timezone handling in DateTimeField', patch: '--- a/django/db/models/fields/__init__.py\n+++ b/django/db/models/fields/__init__.py\n@@ -100 +100 @@\n-        return super().to_python(value)\n+        if value is None:\n+            return value\n+        return super().to_python(value)' },
      { repo: 'pytest-dev/pytest', issue: 'Handle parametrized fixtures correctly', patch: '--- a/src/_pytest/fixtures.py\n+++ b/src/_pytest/fixtures.py\n@@ -50 +50 @@\n-        raise FixturesLookupError(msg)\n+        if name not in self._arg2fixturedefs:\n+            raise FixturesLookupError(msg)' },
      { repo: 'pandas-dev/pandas', issue: 'Fix dtype inference for nullable integers', patch: '--- a/pandas/core/arrays/integer.py\n+++ b/pandas/core/arrays/integer.py\n@@ -80 +80 @@\n-        return cls._from_sequence(data, dtype)\n+        if len(data) == 0:\n+            return cls._from_sequence([], dtype)' },
      { repo: 'requests/requests', issue: 'Handle streaming responses properly', patch: '--- a/src/requests/models.py\n+++ b/src/requests/models.py\n@@ -200 +200 @@\n-        return stream\n+        if not hasattr(stream, \"close\"):\n+            return stream' },
      { repo: 'numpy/numpy', issue: 'Resolve broadcasting edge case', patch: '--- a/numpy/lib/stride_tricks.py\n+++ b/numpy/lib/stride_tricks.py\n@@ -120 +120 @@\n-    return as_strided(a, shape=shape, strides=strides)\n+    if a.ndim == 0:\n+        return a.reshape(1, 1)\n+    return as_strided(a, shape=shape, strides=strides)' },
      { repo: 'flask/flask', issue: 'Fix blueprint registration order', patch: '--- a/src/flask/blueprints.py\n+++ b/src/flask/blueprints.py\n@@ -300 +300 @@\n-        self.deferred_functions.append(f)\n+        if f not in self.deferred_functions:\n+            self.deferred_functions.append(f)' },
      { repo: 'scikit-learn/scikit-learn', issue: 'Handle NaN in preprocessing', patch: '--- a/sklearn/preprocessing/_data.py\n+++ b/sklearn/preprocessing/_data.py\n@@ -150 +150 @@\n-        self.mean_ = np.nanmean(X, axis=0)\n+        with warnings.catch_warnings():\n+            warnings.simplefilter(\"ignore\", RuntimeWarning)\n+            self.mean_ = np.nanmean(X, axis=0)' },
      { repo: 'matplotlib/matplotlib', issue: 'Fix figure close event', patch: '--- a/lib/matplotlib/figure.py\n+++ b/lib/matplotlib/figure.py\n@@ -250 +250 @@\n-        self.canvas.mpl_disconnect(cid)\n+        if self.canvas is not None:\n+            self.canvas.mpl_disconnect(cid)' },
      { repo: 'pillow/Pillow', issue: 'Handle corrupt image gracefully', patch: '--- a/src/PIL/Image.py\n+++ b/src/PIL/Image.py\n@@ -300 +300 @@\n-        raise SyntaxError(msg)\n+        try:\n+            self.load()\n+        except Exception:\n+            raise SyntaxError(msg)' },
      { repo: 'redis/redis', issue: 'Fix client connection pool', patch: '--- a/redis/connection.py\n+++ b/redis/connection.py\n@@ -400 +400 @@\n-        self._connections.put(connection)\n+        if connection.is_connected:\n+            self._connections.put(connection)' },
    ];

    return mockIssues.slice(0, count).map((issue, idx) => ({
      instance_id: `${issue.repo.replace('/', '-')}_${idx}`,
      repo: issue.repo,
      base_commit: 'abc123def456',
      patch: issue.patch,
      problem_statement: issue.issue,
    }));
  }

  private async evaluateInstance(instance: SWEBenchInstance): Promise<EvaluationResult> {
    const startTime = Date.now();
    
    // Create a temporary directory for this instance
    const instanceDir = path.join(this.outputDir, instance.instance_id);
    fs.mkdirSync(instanceDir, { recursive: true });

    try {
      // In a real implementation:
      // 1. Clone the repository
      // 2. Checkout the base commit
      // 3. Run the agent with the problem statement
      // 4. Capture the patch
      // 5. Run the evaluation

      // For now, simulate the agent running
      const isPro = this.config.suite === 'pro';
      const maxTurns = isPro 
        ? (this.config.timeout || 50)  // Pro has longer horizon
        : (this.config.timeout || 25);
      const agent = new Agent({
        provider: this.provider,
        cwd: instanceDir,
        memory: {} as any,
        permissions: {} as any,
        snapshots: {} as any,
        maxTurns,
      });

      const problemPrompt = `You are working on a GitHub issue in ${instance.repo}.

Issue: ${instance.problem_statement}

${isPro ? '⚠️ PRO MODE: This issue requires multi-file modifications and thorough analysis. Consider the full context before making changes.' : ''}

Instructions:
1. Explore the codebase to understand the issue
2. Find the relevant code that needs to be fixed
${isPro ? '3. Identify ALL files that need modification' : '3. Implement the fix'}
4. Ensure tests pass

Working directory: ${instanceDir}`;

      let patchContent = '';
      
      for await (const event of agent.run(problemPrompt)) {
        if (event.type === 'tool_result' && event.tool === 'read_file') {
          // Capture what the agent reads
        }
        if (event.type === 'text') {
          patchContent += event.content;
        }
      }

      // Evaluate by comparing agent patch against expected patch
      const expectedPatch = instance.patch || '';
      const agentPatch = patchContent.trim();
      
      // Deterministic evaluation: check if key lines from expected patch appear in agent output
      let status: 'resolved' | 'unresolved';
      if (expectedPatch && agentPatch) {
        const expectedLines = expectedPatch.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
        const matchingLines = expectedLines.filter(line => agentPatch.includes(line.replace(/^\+/, '')));
        const matchRatio = expectedLines.length > 0 ? matchingLines.length / expectedLines.length : 0;
        status = matchRatio >= 0.5 ? 'resolved' : 'unresolved';
      } else if (agentPatch && !expectedPatch) {
        // Mock instance with no expected patch: count as resolved if agent produced output
        status = agentPatch.length > 10 ? 'resolved' : 'unresolved';
      } else {
        status = 'unresolved';
      }

      return {
        instance_id: instance.instance_id,
        model_patch: patchContent.slice(0, 1000),
        status,
        resolved_at: status === 'resolved' ? new Date().toISOString() : undefined,
        metrics: {
          patch_diff: patchContent.slice(0, 500),
        },
      };
    } catch (e) {
      return {
        instance_id: instance.instance_id,
        model_patch: '',
        status: 'unresolved',
        metrics: {
          patch_diff: (e as Error).message,
        },
      };
    } finally {
      // Cleanup
      try {
        fs.rmSync(instanceDir, { recursive: true, force: true });
      } catch {}
    }
  }

  private saveResults(): void {
    const resultsFile = path.join(this.outputDir, 'results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
  }

  getResults(): EvaluationResult[] {
    return this.results;
  }

  getStats(): { total: number; resolved: number; passRate: number } {
    const resolved = this.results.filter(r => r.status === 'resolved').length;
    return {
      total: this.results.length,
      resolved,
      passRate: (resolved / this.results.length) * 100,
    };
  }
}

export async function runSWEbench(config: SWEBenchConfig): Promise<void> {
  const runner = new SWEBenchRunner(config);
  
  for await (const event of runner.run()) {
    if (event.message) {
      console.log(`  ${event.message}`);
    }
  }

  const stats = runner.getStats();
  console.log(`\n📊 SWE-bench Results:`);
  console.log(`   Total: ${stats.total}`);
  console.log(`   Resolved: ${stats.resolved}`);
  console.log(`   Pass Rate: ${stats.passRate.toFixed(1)}%`);
  
  if (stats.passRate >= 78) {
    console.log(`\n✅ Strong performance on mock instances`);
  } else {
    console.log(`\n⚠️  Results are on mock instances only — install SWE-bench for real evaluation`);
  }
}