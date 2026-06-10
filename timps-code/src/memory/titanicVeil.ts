// ── TIMPS Code — Titanic Veil ──
// CLI integration for TitanicForge (Layer 13 — Neural Surprise-Augmented Sheaf Weaver).
// Injects surprise metrics, multi-view predictions, and H¹ contradiction
// context into the agent system prompt.

import type { Memory } from './memory.js';
import type { TitanicDomain } from '@timps/memory-core';

export interface TitanicInjectionResult {
  promptFragment: string;
  warnings: string[];
  neuralUpdateCount: number;
  latencyMs: number;
}

export function injectTitanicContext(
  memory: Memory,
  domains?: TitanicDomain[],
): TitanicInjectionResult {
  const t0 = Date.now();
  const warnings: string[] = [];
  const lines: string[] = [];
  let neuralUpdateCount = 0;

  try {
    const t = memory.titanicForge;
    const targets = domains ?? (['burnout', 'relationship', 'decision'] as TitanicDomain[]);

    for (const domain of targets) {
      try {
        const pred = t.predict(domain);
        if (pred.riskLevel === 'high' || pred.riskLevel === 'medium') {
          lines.push(`• Titanic [${domain}]: ${pred.riskLevel.toUpperCase()} (risk=${(pred.riskScore * 100).toFixed(0)}%, surprise=${pred.meanSurprise.toFixed(3)})`);
          if (pred.riskLevel === 'high') {
            warnings.push(`TitanicForge high risk in ${domain}: ${pred.explanation}`);
          }
        }
      } catch { /* skip */ }
    }

    const nodes = t.exportNodes();
    const active = nodes.filter(n => !n.invalidAt);
    const highSurprise = active.filter(n => n.surprise > 0.3);
    const stats = (t as any).store;
    neuralUpdateCount = stats?.neuralUpdateCount ?? 0;

    if (highSurprise.length > 0) {
      lines.push(`• Titanic surprise events: ${highSurprise.length}/${active.length} nodes have high surprise`);
      for (const n of highSurprise.slice(0, 3)) {
        warnings.push(`Surprising event: "${n.content.slice(0, 50)}" (surprise=${n.surprise.toFixed(2)})`);
      }
    }

    if (neuralUpdateCount > 0) {
      lines.push(`• Titanic neural module: ${neuralUpdateCount} test-time updates`);
    }

    // Multi-view stats
    const viewCounts: Record<string, number> = { semantic: 0, temporal: 0, causal: 0, entity: 0 };
    const edges = (stats?.edges ?? []) as Array<{ viewType: string }>;
    for (const e of edges) {
      viewCounts[e.viewType] = (viewCounts[e.viewType] ?? 0) + 1;
    }
    const viewStr = Object.entries(viewCounts)
      .filter(([, c]) => c > 0)
      .map(([v, c]) => `${v}:${c}`)
      .join(', ');
    if (viewStr) lines.push(`• Titanic multi-view edges: ${viewStr}`);

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0
      ? `\n## TitanicForge Neural-Symbolic Intelligence\n${lines.join('\n')}\n`
      : '';

    return { promptFragment, warnings, neuralUpdateCount, latencyMs };
  } catch {
    return { promptFragment: '', warnings: [], neuralUpdateCount: 0, latencyMs: Date.now() - t0 };
  }
}
