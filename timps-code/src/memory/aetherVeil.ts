// ── TIMPS Code — AetherVeil ──
// CLI integration layer for AetherForgeERL (Layer 10).
// Injects epistemic-lattice-based predictions, contradiction warnings,
// and epistemic status into the agent system prompt.

import type { Memory } from './memory.js';
import type {
  ERLPrediction,
  ERLCohomologyResult,
  ERLStatus,
} from '@timps/memory-core';

export interface AetherWarning {
  domain: string;
  riskLevel: 'high' | 'medium' | 'low';
  riskScore: number;
  message: string;
  isEpistemic: boolean;
  contradictionBurden: number;
}

export interface AetherInjectionResult {
  promptFragment: string;
  warnings: AetherWarning[];
  hasHighRisk: boolean;
  latencyMs: number;
  cohomology: ERLCohomologyResult | null;
}

export interface AetherReport {
  timestamp: string;
  activeNodeCount: number;
  edgeCount: number;
  avgAmplitude: number;
  spectralGap: number;
  betti1: number;
  latticeLevelCount: number;
  epistemicDistribution: Record<string, number>;
  domainRisks: Array<{
    domain: string;
    riskScore: number;
    riskLevel: string;
    trajectory: number[];
    explanation: string;
    epistemicWeight: number;
    contradictionBurden: number;
  }>;
  contradictions: {
    count: number;
    nodeIds: string[];
    isConsistent: boolean;
  };
  topWarnings: string[];
}

const RISK_DOMAINS = [
  'burnout',
  'contradiction',
  'relationship',
  'decision',
] as const;

type MonitoredDomain = typeof RISK_DOMAINS[number];

const DOMAIN_LABELS: Record<MonitoredDomain, string> = {
  burnout: 'Burnout trajectory',
  contradiction: 'Epistemic contradiction',
  relationship: 'Relationship drift',
  decision: 'Decision reversal risk',
};

/**
 * Build an AetherForgeERL context fragment for the agent system prompt.
 * Called at the start of each agent.run() turn.
 */
export function injectAetherContext(memory: Memory): AetherInjectionResult {
  const t0 = Date.now();
  const warnings: AetherWarning[] = [];
  const lines: string[] = [];

  try {
    const forge = memory.aetherForge;
    if (!forge) {
      return { promptFragment: '', warnings: [], hasHighRisk: false, latencyMs: 0, cohomology: null };
    }

    const highRiskLines: string[] = [];
    for (const domain of RISK_DOMAINS) {
      try {
        const pred = forge.predict(domain, { lookbackDays: 14 });
        if (pred.riskLevel === 'high') {
          highRiskLines.push(
            `• ${DOMAIN_LABELS[domain]} HIGH (${Math.round(pred.riskScore * 100)}%): ${pred.explanation}`
          );
          warnings.push({
            domain,
            riskLevel: 'high',
            riskScore: pred.riskScore,
            message: `${DOMAIN_LABELS[domain]} (${Math.round(pred.riskScore * 100)}%) — ${pred.explanation}`,
            isEpistemic: true,
            contradictionBurden: pred.contradictionBurden,
          });
        } else if (pred.riskLevel === 'medium' && pred.riskScore > 0.45) {
          warnings.push({
            domain,
            riskLevel: 'medium',
            riskScore: pred.riskScore,
            message: `${DOMAIN_LABELS[domain]} elevated (${Math.round(pred.riskScore * 100)}%) — monitor closely.`,
            isEpistemic: true,
            contradictionBurden: pred.contradictionBurden,
          });
        }
      } catch { /* skip domain */ }
    }

    let cohomology: ERLCohomologyResult | null = null;
    try {
      cohomology = forge.detectContradictions();
      if (cohomology && !cohomology.isConsistent) {
        const epiDist = Object.entries(cohomology.epistemicDistribution ?? {})
          .map(([s, c]) => `${s}: ${c}`).join(', ');
        highRiskLines.push(
          `• EPISTEMIC CONTRADICTION: H¹=${cohomology.betti1}, spectral gap=${cohomology.spectralGap.toFixed(3)}, ${cohomology.contradictionNodeIds.length} nodes involved. Status distribution: ${epiDist}`
        );
        warnings.push({
          domain: 'contradiction',
          riskLevel: 'high',
          riskScore: Math.min(1, 0.5 + cohomology.betti1 * 0.15),
          message: `ERL H¹=${cohomology.betti1}: epistemic contradictions detected. ${cohomology.contradictionNodeIds.length} nodes in non-trivial cocycles.`,
          isEpistemic: true,
          contradictionBurden: cohomology.contradictionNodeIds.length / Math.max(1, cohomology.contradictionNodeIds.length + 1),
        });
      }
    } catch { /* skip */ }

    if (highRiskLines.length > 0) {
      lines.push('## Aether Intelligence Alerts (Epistemic Resonance Lattice)');
      lines.push(...highRiskLines);
    }

    try {
      const ctx = forge.getContextString('burnout', 3);
      if (!ctx.includes('No active')) {
        lines.push('\n## Aether Memory (Burnout epistemic signals)');
        lines.push(ctx);
      }
    } catch { /* ignore */ }

    try {
      const ctx = forge.getContextString('contradiction', 3);
      if (!ctx.includes('No active')) {
        lines.push('\n## Aether Memory (Contradiction epistemic signals)');
        lines.push(ctx);
      }
    } catch { /* ignore */ }

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0 ? `\n${lines.join('\n')}\n` : '';
    const hasHighRisk = warnings.some(w => w.riskLevel === 'high');

    return { promptFragment, warnings, hasHighRisk, latencyMs, cohomology };
  } catch {
    return { promptFragment: '', warnings: [], hasHighRisk: false, latencyMs: Date.now() - t0, cohomology: null };
  }
}

/**
 * Generate a human-readable AetherForgeERL report for /aether command.
 */
export function getAetherReport(memory: Memory): AetherReport {
  const forge = memory.aetherForge;
  const timestamp = new Date().toISOString();

  if (!forge) {
    return {
      timestamp,
      activeNodeCount: 0,
      edgeCount: 0,
      avgAmplitude: 0,
      spectralGap: 1,
      betti1: 0,
      latticeLevelCount: 0,
      epistemicDistribution: {},
      domainRisks: [],
      contradictions: { count: 0, nodeIds: [], isConsistent: true },
      topWarnings: ['AetherForgeERL not initialized'],
    };
  }

  const status = forge.getStatus();
  const allPredictions = forge.predictAll({ lookbackDays: 30 });
  const cohomology = forge.detectContradictions();

  const domainRisks = Object.entries(allPredictions)
    .map(([domain, pred]) => ({
      domain,
      riskScore: pred.riskScore,
      riskLevel: pred.riskLevel,
      trajectory: pred.trajectory.slice(0, 6),
      explanation: pred.explanation,
      epistemicWeight: pred.epistemicWeight,
      contradictionBurden: pred.contradictionBurden,
    }))
    .sort((a, b) => b.riskScore - a.riskScore);

  const topWarnings: string[] = [];

  if (!cohomology.isConsistent) {
    topWarnings.push(`[EPISTEMIC] H¹=${cohomology.betti1}: ${cohomology.contradictionNodeIds.length} nodes in non-trivial cocycles`);
  }

  for (const d of domainRisks) {
    if (d.riskLevel !== 'low') {
      topWarnings.push(`[${d.riskLevel.toUpperCase()}] ${d.domain}: ${d.explanation}`);
    }
  }

  return {
    timestamp,
    activeNodeCount: status.activeNodeCount,
    edgeCount: status.edgeCount,
    avgAmplitude: status.avgAmplitude,
    spectralGap: status.spectralGap,
    betti1: status.betti1,
    latticeLevelCount: status.latticeLevelCount,
    epistemicDistribution: Object.fromEntries(
      Object.entries(status.epistemicDistribution ?? {}).map(([k, v]) => [k, v as number])
    ),
    domainRisks,
    contradictions: {
      count: cohomology.contradictionNodeIds.length,
      nodeIds: cohomology.contradictionNodeIds.slice(0, 10),
      isConsistent: cohomology.isConsistent,
    },
    topWarnings,
  };
}

/**
 * Weave a new observation from agent tool results into AetherForgeERL.
 */
export function weaveToolResultAether(
  memory: Memory,
  content: string,
  opts: { domain?: string; causalParentId?: string; evidenceCount?: number } = {}
): void {
  try {
    const forge = memory.aetherForge;
    if (!forge) return;
    forge.weave(content, {
      domain: opts.domain as import('@timps/memory-core').ERLDomain | undefined,
      causalParentId: opts.causalParentId,
      evidenceCount: opts.evidenceCount ?? 1,
    });
  } catch { /* fire-and-forget */ }
}
