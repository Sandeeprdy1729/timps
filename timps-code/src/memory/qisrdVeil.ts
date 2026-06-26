// ── TIMPS Code — QISRD Veil ──
// CLI integration for QISRD (Layer 15 — Quantum-Inspired Sheaf Resonance Dynamics).
// Injects Langevin-resonance predictions, H¹ contradiction intelligence, and
// drift warnings into the agent system prompt.

import type { Memory } from './memory.js';
import type { QISRDDomain } from '@timps-ai/memory-core';

export interface QISRDInjectionResult {
  promptFragment: string;
  warnings: string[];
  hasIssue: boolean;
  driftScore: number;
  latencyMs: number;
}

export function injectQISRDContext(memory: Memory, domains?: QISRDDomain[]): QISRDInjectionResult {
  const t0 = Date.now();
  const warnings: string[] = [];
  const lines: string[] = [];

  try {
    const q = memory.qisrd;
    const targets = domains ?? (['burnout', 'relationship', 'decision'] as QISRDDomain[]);

    for (const domain of targets) {
      try {
        const pred = q.predict(domain);
        if (pred.riskLevel === 'high' || pred.riskLevel === 'medium') {
          lines.push(`• QISRD [${domain}]: ${pred.riskLevel.toUpperCase()} (risk=${(pred.riskScore * 100).toFixed(0)}%, resonance=${pred.resonance.toFixed(2)}, uncertainty=${pred.uncertainty.toFixed(2)})`);
          if (pred.riskLevel === 'high') {
            warnings.push(`QISRD high risk in ${domain}: ${pred.explanation}`);
          }
        }
      } catch { /* skip */ }
    }

    try {
      const contra = q.detectContradictions();
      if (!contra.isConsistent || contra.driftScore > 0.3) {
        lines.push(`• QISRD sheaf: H¹ β₁=${contra.betti1}, gap=${contra.spectralGap}, drift=${contra.driftScore}`);
        if (contra.driftScore > 0.3) {
          warnings.push(`QISRD memory drift ${contra.driftScore} — topology surgery may be needed`);
        }
      }
    } catch { /* skip */ }

    const nodes = q.exportNodes();
    const active = nodes.filter(n => !n.invalidAt);
    const meanResonance = active.length > 0
      ? active.reduce((s, n) => s + n.resonanceScore, 0) / active.length
      : 0;
    lines.push(`• QISRD manifold: ${active.length}/${nodes.length} active, mean-resonance=${meanResonance.toFixed(3)}`);

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0
      ? `\n## QISRD Resonance Intelligence\n${lines.join('\n')}\n`
      : '';

    return { promptFragment, warnings, hasIssue: warnings.length > 0, driftScore: 0, latencyMs };
  } catch {
    return { promptFragment: '', warnings: [], hasIssue: false, driftScore: 0, latencyMs: Date.now() - t0 };
  }
}
