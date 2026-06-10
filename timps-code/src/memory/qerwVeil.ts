// ── TIMPS Code — QERW Veil ──
// CLI integration for QERW (Layer 14 — QuantumEcho Resonance Weaver).
// Injects curvature-anomaly warnings and geodesic foresight into the
// agent system prompt.

import type { Memory } from './memory.js';
import type { QERWDomain } from '@timps/memory-core';

export interface QERWInjectionResult {
  promptFragment: string;
  warnings: string[];
  hasIssue: boolean;
  latencyMs: number;
}

export function injectQERWContext(memory: Memory, domains?: QERWDomain[]): QERWInjectionResult {
  const t0 = Date.now();
  const warnings: string[] = [];
  const lines: string[] = [];

  try {
    const q = memory.qerw;
    const targets = domains ?? (['burnout', 'relationship', 'decision'] as QERWDomain[]);

    for (const domain of targets) {
      try {
        const pred = q.predict(domain);
        if (pred.riskLevel === 'high' || pred.riskLevel === 'medium') {
          lines.push(`• QERW [${domain}]: ${pred.riskLevel.toUpperCase()} (risk=${(pred.riskScore * 100).toFixed(0)}%, curvature=${pred.meanCurvature.toFixed(3)})`);
          if (pred.riskLevel === 'high') {
            warnings.push(`QERW high risk in ${domain}: curvature anomaly detected — ${pred.trajectory.length} geodesic paths`);
          }
        }
      } catch { /* skip */ }
    }

    try {
      const contra = q.detectContradictions();
      if (!contra.isConsistent) {
        lines.push(`• QERW curvature anomalies: ${contra.highCurvatureNodes} nodes (mean κ=${contra.meanCurvature.toFixed(3)}, max κ=${contra.maxCurvature.toFixed(3)})`);
        for (const a of contra.anomalyRegions.slice(0, 3)) {
          warnings.push(`Curvature anomaly: node ${a.nodeId.slice(-8)} κ=${a.curvature.toFixed(3)} [${a.domain}]`);
        }
      }
    } catch { /* skip */ }

    try {
      const nodes = q.exportNodes();
      const active = nodes.filter(n => !n.invalidAt);
      const meanKappa = active.length > 0
        ? active.reduce((s, n) => s + n.curvature, 0) / active.length
        : 0;
      lines.push(`• QERW manifold: ${active.length}/${nodes.length} active nodes, mean curvature=${meanKappa.toFixed(3)}`);
    } catch { /* skip */ }

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0
      ? `\n## QERW Geodesic Resonance Intelligence\n${lines.join('\n')}\n`
      : '';

    return { promptFragment, warnings, hasIssue: warnings.length > 0, latencyMs };
  } catch {
    return { promptFragment: '', warnings: [], hasIssue: false, latencyMs: Date.now() - t0 };
  }
}
