// ── TIMPS Code — QITRL Veil ──
// CLI integration for QITRL (Layer 18 — Quantum-Inspired Temporal Resonance Lattice).
// Injects lattice-based predictions, entanglement entropy contradiction alerts,
// and low-rank factor stats into the agent system prompt.

import type { Memory } from './memory.js';
import type { QITRLDomain } from '@timps/memory-core';

export interface QITRLInjectionResult {
  promptFragment: string;
  warnings: string[];
  hasIssue: boolean;
  latencyMs: number;
}

export function injectQITRLContext(memory: Memory, domains?: QITRLDomain[]): QITRLInjectionResult {
  const t0 = Date.now();
  const warnings: string[] = [];
  const lines: string[] = [];

  try {
    const q = memory.qitrl;
    const targets = domains ?? (['burnout', 'relationship', 'decision'] as QITRLDomain[]);

    for (const domain of targets) {
      try {
        const pred = q.predict(domain);
        if (pred.riskLevel === 'high' || pred.riskLevel === 'medium') {
          lines.push(`• QITRL [${domain}]: ${pred.riskLevel.toUpperCase()} (risk=${(pred.riskScore * 100).toFixed(0)}%, top-σ=${(pred.singularValues[0] ?? 0).toFixed(3)})`);
          if (pred.riskLevel === 'high') {
            warnings.push(`QITRL high risk in ${domain}: ${pred.explanation}`);
          }
        }
      } catch { /* skip */ }
    }

    try {
      const coh = q.detectContradictions();
      if (!coh.isConsistent) {
        lines.push(`• QITRL cohomology: H¹ β₁=${coh.betti1}, gap=${coh.spectralGap}, mean-entropy=${coh.meanEntanglementEntropy}`);
        if (coh.betti1 > 0) {
          warnings.push(`QITRL entanglement contradiction (β₁=${coh.betti1}) — lattice inconsistency detected`);
        }
      }
    } catch { /* skip */ }

    const sites = q.exportSites();
    const active = sites.filter(s => !s.invalidAt);
    const meanEntropy = active.length > 0
      ? active.reduce((sum, s) => sum + s.entanglementEntropy, 0) / active.length
      : 0;
    lines.push(`• QITRL lattice: ${active.length}/${sites.length} active, mean-entropy=${meanEntropy.toFixed(3)}`);

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0
      ? `\n## QITRL Lattice Intelligence\n${lines.join('\n')}\n`
      : '';

    return { promptFragment, warnings, hasIssue: warnings.length > 0, latencyMs };
  } catch {
    return { promptFragment: '', warnings: [], hasIssue: false, latencyMs: Date.now() - t0 };
  }
}
