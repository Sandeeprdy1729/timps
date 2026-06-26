import type { AbTestResult, EvalResult, VariantConfig, EvalDataset } from './types.js';
import { loadDataset, runVariant, createFreshEngine, seedEngineWithDataset, evaluateDataset } from './runner.js';

export class AbTestRunner {
  async runComparison(
    variantA: VariantConfig,
    variantB: VariantConfig,
    datasetNames: string[],
    runId: string,
    gitSha: string,
  ): Promise<AbTestResult[]> {
    const results: AbTestResult[] = [];

    for (const name of datasetNames) {
      const dataset = loadDataset(name);
      const engineA = createFreshEngine();
      seedEngineWithDataset(engineA, dataset);
      const resultA = await evaluateDataset(engineA, dataset, runId, gitSha, variantA.name);
      const engineB = createFreshEngine();
      seedEngineWithDataset(engineB, dataset);
      const resultB = await evaluateDataset(engineB, dataset, runId, gitSha, variantB.name);

      const metrics = resultA.metrics.map((mA, i) => {
        const mB = resultB.metrics[i];
        const delta = Math.round((mA.value - mB.value) * 10000) / 10000;
        let winner: 'a' | 'b' | 'tie' = 'tie';
        const direction = mA.direction || 'higher';
        if (delta > 0.01) winner = direction === 'higher' ? 'a' : 'b';
        else if (delta < -0.01) winner = direction === 'higher' ? 'b' : 'a';

        return {
          name: mA.name,
          a: mA.value,
          b: mB.value,
          delta,
          winner,
        };
      });

      const aWins = metrics.filter(m => m.winner === 'a').length;
      const bWins = metrics.filter(m => m.winner === 'b').length;

      let recommendation: string;
      if (aWins > bWins) {
        recommendation = `Variant A ("${variantA.name}") wins on ${aWins}/${metrics.length} metrics. Consider adopting.`;
      } else if (bWins > aWins) {
        recommendation = `Variant B ("${variantB.name}") wins on ${bWins}/${metrics.length} metrics. Consider adopting.`;
      } else {
        recommendation = `Both variants are comparable (${aWins}-${bWins}). No clear winner.`;
      }

      results.push({
        variantA: variantA.name,
        variantB: variantB.name,
        datasetName: name,
        metrics,
        recommendation,
      });
    }

    return results;
  }

  formatReport(abResults: AbTestResult[]): string {
    const lines: string[] = [];
    lines.push('═'.repeat(60));
    lines.push('A/B Test Comparison Report');
    lines.push('═'.repeat(60));
    lines.push('');

    for (const r of abResults) {
      lines.push(`Dataset: ${r.datasetName}`);
      lines.push(`A: ${r.variantA}  vs  B: ${r.variantB}`);
      lines.push('─'.repeat(50));
      lines.push('Metric'.padEnd(25) + 'A'.padEnd(12) + 'B'.padEnd(12) + 'Winner');
      lines.push('─'.repeat(50));
      for (const m of r.metrics) {
        const w = m.winner === 'a' ? '🅰' : m.winner === 'b' ? '🅱' : '➖';
        lines.push(
          m.name.padEnd(25) +
          String(m.a).padEnd(12) +
          String(m.b).padEnd(12) +
          w,
        );
      }
      lines.push('─'.repeat(50));
      lines.push(`→ ${r.recommendation}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}
