// ── Tool 4 port: Burnout Seismograph ──
// Ported from sandeep-ai/tools/allTools.ts BurnoutSeismographTool
// Storage: JSON file instead of Postgres burnout_signals + burnout_baseline tables
// Analysis: deterministic deviation scoring (no LLM)

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BurnoutSignal {
  id: string;
  signal_type: string;   // e.g. response_time, focus_hours, energy_level, enthusiasm_score
  value: number;
  baseline_value: number | null;
  deviation_pct: number | null;
  recorded_at: string;
}

export interface BurnoutBaseline {
  baseline_data: Record<string, number>;
  computed_at: string;
}

export interface BurnoutAnalysis {
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  risk_score: number;
  key_warning_signals: string[];
  recommendation: string;
  weeks_to_burnout_estimate: number | null;
}

export class BurnoutSeismograph {
  private file: string;
  private signals: BurnoutSignal[] = [];
  private baseline: BurnoutBaseline | null = null;

  constructor(dir: string) {
    this.file = path.join(dir, 'burnout_signals.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.signals = data.signals || [];
        this.baseline = data.baseline || null;
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    fs.writeFileSync(this.file, JSON.stringify(
      { signals: this.signals, baseline: this.baseline }, null, 2
    ), 'utf-8');
  }

  /** record: log a burnout signal value */
  record(signal_type: string, value: number): { recorded: boolean; deviation_pct: number | null } {
    const baselineVal = this.baseline?.baseline_data?.[signal_type] ?? null;
    const deviation = baselineVal !== null ? ((value - baselineVal) / Math.abs(baselineVal)) * 100 : null;

    const sig: BurnoutSignal = {
      id: `bs_${Date.now().toString(36)}`,
      signal_type,
      value,
      baseline_value: baselineVal,
      deviation_pct: deviation !== null ? Math.round(deviation) : null,
      recorded_at: new Date().toISOString(),
    };

    this.signals.push(sig);
    // Keep last 500 signals
    if (this.signals.length > 500) this.signals.shift();
    this.save();
    return { recorded: true, deviation_pct: sig.deviation_pct };
  }

  /** baseline: compute personal baseline from last 30 days of signals */
  computeBaseline(): { success: boolean; baseline?: Record<string, number>; message: string } {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = this.signals.filter(s => new Date(s.recorded_at).getTime() > cutoff);
    if (!recent.length) return { success: false, message: 'Need at least some signal data to set baseline' };

    const sums: Record<string, { sum: number; count: number }> = {};
    for (const s of recent) {
      if (!sums[s.signal_type]) sums[s.signal_type] = { sum: 0, count: 0 };
      sums[s.signal_type].sum += s.value;
      sums[s.signal_type].count++;
    }

    const baseline_data: Record<string, number> = {};
    for (const [type, { sum, count }] of Object.entries(sums)) {
      baseline_data[type] = sum / count;
    }

    this.baseline = { baseline_data, computed_at: new Date().toISOString() };
    this.save();
    return { success: true, baseline: baseline_data, message: 'Baseline set from recent signals' };
  }

  /** analyze: get burnout risk assessment from last 6 weeks of signals */
  analyze(): BurnoutAnalysis {
    const cutoff = Date.now() - 42 * 24 * 60 * 60 * 1000;
    const recent = this.signals.filter(s => new Date(s.recorded_at).getTime() > cutoff);
    if (!recent.length) {
      return { risk_level: 'low', risk_score: 0, key_warning_signals: [], recommendation: 'Not enough signal data. Record daily signals to enable burnout detection.', weeks_to_burnout_estimate: null };
    }

    // Score high negative deviations
    const warnings: string[] = [];
    let totalDeviationScore = 0;
    let deviationCount = 0;

    // Group by type, compute average recent deviation
    const byType: Record<string, number[]> = {};
    for (const s of recent) {
      if (s.deviation_pct !== null) {
        if (!byType[s.signal_type]) byType[s.signal_type] = [];
        byType[s.signal_type].push(s.deviation_pct);
      }
    }

    for (const [type, devs] of Object.entries(byType)) {
      const avg = devs.reduce((a, b) => a + b, 0) / devs.length;
      if (avg < -20) {
        warnings.push(`${type} is ${Math.abs(Math.round(avg))}% below baseline`);
        totalDeviationScore += Math.abs(avg);
        deviationCount++;
      }
    }

    const risk_score = Math.min(100, (totalDeviationScore / Math.max(deviationCount, 1)) / 2);

    const risk_level: BurnoutAnalysis['risk_level'] =
      risk_score >= 70 ? 'critical' :
      risk_score >= 45 ? 'high' :
      risk_score >= 20 ? 'moderate' : 'low';

    const weeks_to_burnout_estimate =
      risk_level === 'critical' ? 2 :
      risk_level === 'high' ? 4 :
      risk_level === 'moderate' ? 8 : null;

    const recommendation =
      risk_level === 'critical' ? 'Immediate break needed. Multiple signals are critically below baseline.' :
      risk_level === 'high' ? 'Reduce workload. Burnout signals are elevated.' :
      risk_level === 'moderate' ? 'Monitor closely. Some signals trending downward.' :
      'All signals within normal range.';

    return { risk_level, risk_score: Math.round(risk_score), key_warning_signals: warnings, recommendation, weeks_to_burnout_estimate };
  }
}
