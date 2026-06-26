import { Router } from 'express';
import type { Request, Response } from 'express';
import { MemoryEngine } from '../MemoryEngine.js';
import { BaselineManager } from '../eval/baseline.js';
import { RegressionDetector } from '../eval/regression.js';
import { AbTestRunner } from '../eval/abtest.js';
import { EvalStorage } from '../eval/storage.js';
import { loadDataset, loadAllDatasets, seedEngineWithDataset, evaluateDataset, createFreshEngine, runFullEvalSuite } from '../eval/runner.js';
import type { VariantConfig, EvalConfig, EvalResult } from '../eval/types.js';
import { DATASET_NAMES, DEFAULT_EVAL_THRESHOLDS } from '../eval/types.js';
import type { StorageBackend } from '../backends/types.js';

export function createEvalRoutes(
  engine: MemoryEngine,
  backend: StorageBackend,
  baselineDir: string,
): Router {
  const router = Router();
  const baselineManager = new BaselineManager(baselineDir);
  const regressionDetector = new RegressionDetector(DEFAULT_EVAL_THRESHOLDS);
  const abTestRunner = new AbTestRunner();
  const evalStorage = new EvalStorage(backend);

  router.get('/datasets', (_req: Request, res: Response) => {
    const datasets = loadAllDatasets().map(d => ({
      name: d.name,
      version: d.version,
      description: d.description,
      exampleCount: d.examples.length,
    }));
    res.json({ datasets });
  });

  router.get('/datasets/:name', (req: Request, res: Response) => {
    try {
      const dataset = loadDataset(req.params.name as string);
      res.json(dataset);
    } catch {
      res.status(404).json({ error: `Dataset "${req.params.name as string}" not found` });
    }
  });

  router.post('/run', async (req: Request, res: Response) => {
    try {
      const { datasets, variantName } = req.body;
      const names = datasets && Array.isArray(datasets) ? datasets : [...DATASET_NAMES];
      const gitSha = req.body.gitSha || 'unknown';
      const variant: VariantConfig = {
        name: variantName || 'default',
        overrides: req.body.overrides || {},
      };

      const results: any[] = [];
      for (const name of names) {
        const dataset = loadDataset(name);
        const evalEngine = createFreshEngine();
        seedEngineWithDataset(evalEngine, dataset);
        const result = await evaluateDataset(evalEngine, dataset, `api-${Date.now()}`, gitSha, variant.name);
        results.push(result);
        await evalStorage.saveResult(result);
      }

      res.json({ results, count: results.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/results', async (req: Request, res: Response) => {
    const datasetName = req.query.dataset as string | undefined;
    const results = await evalStorage.listResults(datasetName);
    res.json({ results, count: results.length });
  });

  router.get('/results/:runId', async (req: Request, res: Response) => {
    const datasetName = req.query.dataset as string;
    if (!datasetName) {
      return res.status(400).json({ error: 'dataset query param required' });
    }
    const result = await evalStorage.loadResult(datasetName, req.params.runId as string);
    if (!result) return res.status(404).json({ error: 'Result not found' });
    res.json(result);
  });

  router.post('/baseline', async (req: Request, res: Response) => {
    try {
      const runId = req.body.runId;
      const datasetName = req.body.datasetName;
      const branch = req.body.branch || 'main';

      if (runId && datasetName) {
        const result = await evalStorage.loadResult(datasetName, runId);
        if (!result) return res.status(404).json({ error: 'Run result not found' });
        const baseline = baselineManager.saveBaseline(result, branch);
        await evalStorage.saveBaseline(baseline);
        res.json({ baseline });
      } else {
        const results = await evalStorage.listResults();
        const byDataset = new Map<string, EvalResult>();
        for (const r of results) {
          if (!byDataset.has(r.datasetName)) byDataset.set(r.datasetName, r);
        }
        const baselines = [];
        for (const [, result] of byDataset) {
          const baseline = baselineManager.saveBaseline(result, branch);
          await evalStorage.saveBaseline(baseline);
          baselines.push(baseline);
        }
        res.json({ baselines, count: baselines.length });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/baseline', async (req: Request, res: Response) => {
    const datasetName = req.query.dataset as string;
    const branch = (req.query.branch as string) || 'main';

    if (datasetName) {
      const baseline = await evalStorage.loadBaseline(datasetName, branch);
      if (!baseline) return res.status(404).json({ error: 'No baseline found' });
      res.json(baseline);
    } else {
      const baselines = await evalStorage.listBaselines();
      res.json({ baselines, count: baselines.length });
    }
  });

  router.get('/regression/:datasetName', async (req: Request, res: Response) => {
    try {
      const branch = (req.query.branch as string) || 'main';
      const results = await evalStorage.listResults(req.params.datasetName as string);
      if (results.length === 0) return res.status(404).json({ error: 'No results found' });

      const latest = results[0];
      const baseline = await evalStorage.loadBaseline(req.params.datasetName as string, branch);
      const regressions = regressionDetector.check(latest, baseline);
      const gateResult = regressionDetector.gateCheck(regressions);
      const report = regressionDetector.formatGateReport(gateResult);

      res.json({ regressions, gateResult, report });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/ab-test', async (req: Request, res: Response) => {
    try {
      const { variantA, variantB, datasets } = req.body;
      if (!variantA || !variantB) {
        return res.status(400).json({ error: 'variantA and variantB required' });
      }
      const dsNames = datasets && Array.isArray(datasets) ? datasets : [...DATASET_NAMES];
      const gitSha = req.body.gitSha || 'unknown';
      const runId = `ab-${Date.now()}`;

      const results = await abTestRunner.runComparison(variantA, variantB, dsNames, runId, gitSha);
      const report = abTestRunner.formatReport(results);

      res.json({ results, report });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/timeseries/:datasetName/:metricName', async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const series = await evalStorage.getTimeSeries(req.params.datasetName as string, req.params.metricName as string, limit);
    res.json({ datasetName: req.params.datasetName as string, metricName: req.params.metricName as string, data: series });
  });

  router.post('/gate', async (req: Request, res: Response) => {
    try {
      const branch = (req.body.branch as string) || 'main';

      const results = await evalStorage.listResults();
      const latestByDataset = new Map<string, EvalResult>();
      for (const r of results) {
        if (!latestByDataset.has(r.datasetName)) latestByDataset.set(r.datasetName, r);
      }

      const allRegressions: any[] = [];
      let blocked = false;

      for (const [datasetName, latest] of latestByDataset) {
        const baseline = await evalStorage.loadBaseline(datasetName, branch);
        const regressions = regressionDetector.check(latest, baseline);
        const gateResult = regressionDetector.gateCheck(regressions);
        allRegressions.push(...regressions);
        if (gateResult.blocked) blocked = true;
      }

      const gateResult = regressionDetector.gateCheck(allRegressions);
      const report = regressionDetector.formatGateReport(gateResult);

      res.json({ blocked, regressions: allRegressions, report });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
