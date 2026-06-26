import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EvalBaseline, EvalResult } from './types.js';

export class BaselineManager {
  private baselineDir: string;

  constructor(baselineDir: string) {
    this.baselineDir = baselineDir;
    fs.mkdirSync(baselineDir, { recursive: true });
  }

  private baselinePath(datasetName: string, branch: string): string {
    const safeName = `${branch}__${datasetName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.baselineDir, `${safeName}.json`);
  }

  saveBaseline(result: EvalResult, branch: string = 'main'): EvalBaseline {
    const metrics: Record<string, number> = {};
    for (const m of result.metrics) {
      metrics[m.name] = m.value;
    }

    const baseline: EvalBaseline = {
      datasetName: result.datasetName,
      branch,
      timestamp: result.timestamp,
      gitSha: result.gitSha,
      metrics,
    };

    const filePath = this.baselinePath(result.datasetName, branch);
    fs.writeFileSync(filePath, JSON.stringify(baseline, null, 2));
    return baseline;
  }

  loadBaseline(datasetName: string, branch: string = 'main'): EvalBaseline | null {
    const filePath = this.baselinePath(datasetName, branch);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as EvalBaseline;
    } catch {
      return null;
    }
  }

  compareAgainstBaseline(
    result: EvalResult,
    branch: string = 'main',
  ): { baseline: EvalBaseline | null; deltas: Record<string, number>; passed: boolean } {
    const baseline = this.loadBaseline(result.datasetName, branch);
    if (!baseline) {
      return { baseline: null, deltas: {}, passed: true };
    }

    const deltas: Record<string, number> = {};
    let allPassed = true;

    for (const metric of result.metrics) {
      const baselineValue = baseline.metrics[metric.name];
      if (baselineValue === undefined) continue;

      const delta = metric.value - baselineValue;
      deltas[metric.name] = Math.round(delta * 10000) / 10000;

      if (metric.direction === 'higher' && metric.threshold !== undefined) {
        const isPassed = metric.value >= metric.threshold;
        if (!isPassed) allPassed = false;
      } else if (metric.direction === 'lower' && metric.threshold !== undefined) {
        if (metric.value > metric.threshold) allPassed = false;
      }
    }

    return { baseline, deltas, passed: allPassed };
  }

  listBaselines(): EvalBaseline[] {
    const files = fs.readdirSync(this.baselineDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(this.baselineDir, f), 'utf-8')) as EvalBaseline;
      } catch {
        return null;
      }
    }).filter((b): b is EvalBaseline => b !== null);
  }
}
