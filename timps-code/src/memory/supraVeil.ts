// ── TIMPS Code — SupraVeil ──
// CLI integration layer for SupraSheaf (Layer 11 — cross-layer sheaf coordinator).
// Injects cross-layer contradiction warnings and joint foresight into the
// agent system prompt.

import type { Memory } from './memory.js';

export interface SupraWarning {
  message: string;
  severity: 'high' | 'medium' | 'low';
  layerPair: string;
}

export interface SupraInjectionResult {
  promptFragment: string;
  warnings: SupraWarning[];
  hasCrossLayerIssue: boolean;
  latencyMs: number;
}

export function injectSupraContext(memory: Memory): SupraInjectionResult {
  const t0 = Date.now();
  const warnings: SupraWarning[] = [];
  const lines: string[] = [];

  try {
    const sheaf = memory.supraSheaf;
    if (!sheaf) {
      return { promptFragment: '', warnings: [], hasCrossLayerIssue: false, latencyMs: 0 };
    }

    // Cross-layer H¹ check
    const h1 = sheaf.computeCrossLayerH1();
    if (!h1.isConsistent) {
      lines.push(`• Cross-layer H¹=${h1.betti1} across ${h1.layerCount} layers (${h1.totalNodes} nodes)`);
      if (h1.contradictions.length > 0) {
        for (const c of h1.contradictions.slice(0, 3)) {
          const msg = `Cross-layer contradiction: "${c.from.content.slice(0, 40)}" (${c.from.layerId}) vs "${c.to.content.slice(0, 40)}" (${c.to.layerId})`;
          lines.push(`  • ${msg}`);
          warnings.push({
            message: msg,
            severity: 'high',
            layerPair: `${c.from.layerId}↔${c.to.layerId}`,
          });
        }
      }
    }

    // Joint foresight for key domains
    for (const domain of ['burnout', 'relationship', 'decision'] as const) {
      try {
        const f = sheaf.jointForesight(domain, { horizon: 6 });
        if (f.riskLevel === 'high' || f.riskLevel === 'medium') {
          lines.push(`• ${f.title}: ${f.riskLevel.toUpperCase()} at ${Math.round(f.riskScore * 100)}%`);
        }
      } catch { /* skip domain */ }
    }

    // Sheaf consistency check
    const consistency = sheaf.sheafConsistency();
    if (consistency.gluingScore < 0.3) {
      warnings.push({
        message: `Low cross-layer connectivity (gluing=${consistency.gluingScore})`,
        severity: 'medium',
        layerPair: 'all',
      });
    }

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0 ? `\n## SupraSheaf Cross-Layer Intelligence\n${lines.join('\n')}\n` : '';
    const hasCrossLayerIssue = warnings.some(w => w.severity === 'high');

    return { promptFragment, warnings, hasCrossLayerIssue, latencyMs };
  } catch {
    return { promptFragment: '', warnings: [], hasCrossLayerIssue: false, latencyMs: Date.now() - t0 };
  }
}
