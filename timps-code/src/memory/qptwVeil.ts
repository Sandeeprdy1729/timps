// ── TIMPS Code — QPTW Veil ──
// CLI integration for QPTW (Layer 12 — Quantum-Phase Temporal Weaver).
// Injects manifold-aware contradiction warnings and phase-based foresight
// into the agent system prompt.

import type { Memory } from './memory.js';
import type { QPTWDomain } from '@timps/memory-core';

export interface QPTWInjectionResult {
  promptFragment: string;
  warnings: string[];
  hasIssue: boolean;
  latencyMs: number;
}

export function injectQPTWContext(memory: Memory, domains?: QPTWDomain[]): QPTWInjectionResult {
  const t0 = Date.now();
  const warnings: string[] = [];
  const lines: string[] = [];

  try {
    const q = memory.qptw;
    const targets = domains ?? (['burnout', 'relationship', 'decision'] as QPTWDomain[]);

    // Phase coherence report for tracked domains
    for (const domain of targets) {
      try {
        const pred = q.predict(domain);
        if (pred.riskLevel === 'high' || pred.riskLevel === 'medium') {
          lines.push(`• QPTW [${domain}]: ${pred.riskLevel.toUpperCase()} (risk=${(pred.riskScore * 100).toFixed(0)}%, resonance=${pred.resonance.toFixed(2)})`);
          if (pred.riskLevel === 'high') {
            warnings.push(`QPTW high risk in ${domain}: ${pred.explanation}`);
          }
        }
      } catch { /* skip */ }
    }

    // Phase-based contradiction check
    try {
      const contra = q.detectContradictions();
      if (!contra.isConsistent) {
        lines.push(`• QPTW contradictions: β₁=${contra.betti1}, phase-incoherence=${contra.phaseIncoherence.toFixed(2)} (${contra.contradictions.length} pairs)`);
        for (const c of contra.contradictions.slice(0, 3)) {
          warnings.push(`Phase contradiction: nodes ${c.nodeA.slice(-8)} ↔ ${c.nodeB.slice(-8)} (interference=${c.interference.toFixed(2)})`);
        }
      }
    } catch { /* skip */ }

    // Manifold stats
    try {
      const nodes = q.exportNodes();
      const active = nodes.filter(n => !n.invalidAt);
      const phaseCoherence = active.length > 0
        ? active.reduce((s, n) => s + Math.cos(n.phase), 0) / active.length
        : 0;
      const meanAmp = active.length > 0
        ? active.reduce((s, n) => s + n.amplitude, 0) / active.length
        : 0;
      lines.push(`• QPTW manifold: ${active.length}/${nodes.length} active, phase-coherence=${phaseCoherence.toFixed(3)}, mean-amplitude=${meanAmp.toFixed(3)}`);
    } catch { /* skip */ }

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0
      ? `\n## QPTW Manifold Intelligence\n${lines.join('\n')}\n`
      : '';

    return { promptFragment, warnings, hasIssue: warnings.length > 0, latencyMs };
  } catch {
    return { promptFragment: '', warnings: [], hasIssue: false, latencyMs: Date.now() - t0 };
  }
}
