// ── TIMPS Code — EclipseVeil ──
// CLI integration for EclipseForge (Layer 17 — Temporal Sheaf Resonator).
// Injects temporal stalk-aware predictions, H¹ cohomology contradictions,
// and resonance warnings into the agent system prompt.

import type { Memory } from './memory.js';
import type { EclipseDomain } from '@timps/memory-core';

export interface EclipseInjectionResult {
  promptFragment: string;
  warnings: string[];
  hasIssue: boolean;
  latencyMs: number;
}

export function injectEclipseContext(memory: Memory, domains?: EclipseDomain[]): EclipseInjectionResult {
  const t0 = Date.now();
  const warnings: string[] = [];
  const lines: string[] = [];

  try {
    const e = memory.eclipseForge;
    const targets = domains ?? (['burnout', 'relationship', 'decision'] as EclipseDomain[]);

    for (const domain of targets) {
      try {
        const pred = e.predict(domain);
        if (pred.riskLevel === 'high' || pred.riskLevel === 'medium') {
          lines.push(`• EFSR [${domain}]: ${pred.riskLevel.toUpperCase()} (risk=${(pred.riskScore * 100).toFixed(0)}%, gap=${(pred.eigenmodeWeights[0] ?? 0).toFixed(2)})`);
          if (pred.riskLevel === 'high') {
            warnings.push(`EFSR high risk in ${domain}: ${pred.explanation}`);
          }
        }
      } catch { /* skip */ }
    }

    try {
      const coh = e.detectContradictions();
      if (!coh.isConsistent) {
        lines.push(`• EFSR cohomology: H¹ β₁=${coh.betti1}, gap=${coh.spectralGap}, temporal-overlap=${coh.temporalOverlapScore}`);
        if (coh.betti1 > 0) {
          warnings.push(`EFSR temporal contradiction (β₁=${coh.betti1}) — time-aware inconsistency detected`);
        }
      }
    } catch { /* skip */ }

    const nodes = e.exportNodes();
    const active = nodes.filter(n => !n.stalk.invalidAt);
    const meanAmp = active.length > 0
      ? active.reduce((s, n) => s + n.oscillator.amplitude, 0) / active.length
      : 0;
    lines.push(`• EFSR temporal sheaf: ${active.length}/${nodes.length} active, mean-amp=${meanAmp.toFixed(3)}`);

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0
      ? `\n## EclipseForge Temporal Resonance\n${lines.join('\n')}\n`
      : '';

    return { promptFragment, warnings, hasIssue: warnings.length > 0, latencyMs };
  } catch {
    return { promptFragment: '', warnings: [], hasIssue: false, latencyMs: Date.now() - t0 };
  }
}
