import type { EvalResult, RegressionResult, EvalBaseline } from './types.js';

export class RegressionDetector {
  private thresholds: Record<string, number>;

  constructor(thresholds: Record<string, number> = {}) {
    this.thresholds = { ...thresholds };
  }

  check(
    result: EvalResult,
    baseline: EvalBaseline | null,
  ): RegressionResult[] {
    const regressions: RegressionResult[] = [];

    for (const metric of result.metrics) {
      const baselineValue = baseline?.metrics[metric.name];
      const threshold = metric.threshold ?? this.thresholds[metric.name];

      if (baselineValue === undefined) {
        const thresholdVal = threshold ?? this.thresholds[metric.name];
        let severity: 'pass' | 'warn' | 'block' = 'pass';
        let passed = true;

        if (metric.direction === 'higher' && thresholdVal !== undefined) {
          if (metric.value < thresholdVal) {
            severity = 'block';
            passed = false;
          }
        } else if (metric.direction === 'lower' && thresholdVal !== undefined) {
          if (metric.value > thresholdVal) {
            severity = 'block';
            passed = false;
          }
        }

        regressions.push({
          datasetName: result.datasetName,
          metric: metric.name,
          baseline: 0,
          current: metric.value,
          delta: metric.value,
          threshold: thresholdVal ?? 0,
          passed,
          severity,
        });
        continue;
      }

      const delta = metric.value - baselineValue;
      const roundedDelta = Math.round(delta * 10000) / 10000;
      const absDelta = Math.abs(roundedDelta);

      let severity: 'pass' | 'warn' | 'block' = 'pass';
      let passed = true;

      if (metric.direction === 'higher') {
        if (metric.value < (threshold ?? baselineValue * 0.9)) {
          severity = 'block';
          passed = false;
        } else if (delta < -baselineValue * 0.05) {
          severity = 'warn';
        }
      } else if (metric.direction === 'lower') {
        if (metric.value > (threshold ?? baselineValue * 1.2)) {
          severity = 'block';
          passed = false;
        } else if (delta > baselineValue * 0.2) {
          severity = 'warn';
        }
      }

      regressions.push({
        datasetName: result.datasetName,
        metric: metric.name,
        baseline: baselineValue,
        current: metric.value,
        delta: roundedDelta,
        threshold: threshold ?? baselineValue,
        passed,
        severity,
      });
    }

    return regressions;
  }

  gateCheck(regressions: RegressionResult[]): {
    blocked: boolean;
    blockers: RegressionResult[];
    warnings: RegressionResult[];
    passed: RegressionResult[];
  } {
    const blockers = regressions.filter(r => r.severity === 'block');
    const warnings = regressions.filter(r => r.severity === 'warn');
    const passed = regressions.filter(r => r.severity === 'pass');

    return {
      blocked: blockers.length > 0,
      blockers,
      warnings,
      passed,
    };
  }

  formatGateReport(gateResult: {
    blocked: boolean;
    blockers: RegressionResult[];
    warnings: RegressionResult[];
    passed: RegressionResult[];
  }): string {
    const lines: string[] = [];
    lines.push(gateResult.blocked ? '❌ EVAL GATE FAILED' : '✅ EVAL GATE PASSED');
    lines.push('');

    if (gateResult.blockers.length > 0) {
      lines.push('Blockers:');
      for (const b of gateResult.blockers) {
        lines.push(`  🔴 ${b.metric} (${b.datasetName}): ${b.baseline} → ${b.current} (Δ=${b.delta > 0 ? '+' : ''}${b.delta})`);
      }
      lines.push('');
    }

    if (gateResult.warnings.length > 0) {
      lines.push('Warnings:');
      for (const w of gateResult.warnings) {
        lines.push(`  🟡 ${w.metric} (${w.datasetName}): ${w.baseline} → ${w.current} (Δ=${w.delta > 0 ? '+' : ''}${w.delta})`);
      }
      lines.push('');
    }

    if (gateResult.passed.length > 0) {
      lines.push('Passed:');
      for (const p of gateResult.passed) {
        lines.push(`  ✅ ${p.metric} (${p.datasetName}): ${p.current}`);
      }
    }

    return lines.join('\n');
  }
}
