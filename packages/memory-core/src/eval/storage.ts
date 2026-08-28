import type { StorageBackend } from '../backends/types.js';
import type { EvalResult, EvalBaseline } from './types.js';

const EVAL_RESULTS_PREFIX = 'eval:results:';
const EVAL_BASELINES_PREFIX = 'eval:baselines:';

export class EvalStorage {
  private backend: StorageBackend;

  constructor(backend: StorageBackend) {
    this.backend = backend;
  }

  async saveResult(result: EvalResult): Promise<void> {
    const key = `${EVAL_RESULTS_PREFIX}${result.datasetName}:${result.runId}`;
    await this.backend.write(key, JSON.stringify(result));
  }

  async loadResult(datasetName: string, runId: string): Promise<EvalResult | null> {
    const key = `${EVAL_RESULTS_PREFIX}${datasetName}:${runId}`;
    try {
      const raw = await this.backend.read(key);
      if (!raw) return null;
      if (typeof raw === 'string') return JSON.parse(raw) as EvalResult;
      return raw as EvalResult;
    } catch {
      return null;
    }
  }

  async listResults(datasetName?: string): Promise<EvalResult[]> {
    const prefix = datasetName
      ? `${EVAL_RESULTS_PREFIX}${datasetName}:`
      : EVAL_RESULTS_PREFIX;
    try {
      const keys = await this.backend.list(prefix);
      const results: EvalResult[] = [];
      for (const key of (keys as string[]) || []) {
        try {
          const raw = await this.backend.read(key);
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) as EvalResult : raw as EvalResult;
            results.push(parsed);
          }
        } catch {
          // skip corrupt entries
        }
      }
      return results.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  async saveBaseline(baseline: EvalBaseline): Promise<void> {
    const key = `${EVAL_BASELINES_PREFIX}${baseline.datasetName}:${baseline.branch}`;
    await this.backend.write(key, JSON.stringify(baseline));
  }

  async loadBaseline(datasetName: string, branch: string = 'main'): Promise<EvalBaseline | null> {
    const key = `${EVAL_BASELINES_PREFIX}${datasetName}:${branch}`;
    try {
      const raw = await this.backend.read(key);
      if (!raw) return null;
      if (typeof raw === 'string') return JSON.parse(raw) as EvalBaseline;
      return raw as EvalBaseline;
    } catch {
      return null;
    }
  }

  async listBaselines(): Promise<EvalBaseline[]> {
    try {
      const keys = await this.backend.list(EVAL_BASELINES_PREFIX);
      const baselines: EvalBaseline[] = [];
      for (const key of (keys as string[]) || []) {
        try {
          const raw = await this.backend.read(key);
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) as EvalBaseline : raw as EvalBaseline;
            baselines.push(parsed);
          }
        } catch {
          // skip corrupt entries
        }
      }
      return baselines;
    } catch {
      return [];
    }
  }

  async getTimeSeries(datasetName: string, metricName: string, limit: number = 100): Promise<{ timestamp: number; value: number }[]> {
    const results = await this.listResults(datasetName);
    return results
      .slice(0, limit)
      .map(r => {
        const metric = r.metrics.find(m => m.name === metricName);
        return metric ? { timestamp: r.timestamp, value: metric.value } : null;
      })
      .filter((x): x is { timestamp: number; value: number } => x !== null)
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}
