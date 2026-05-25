// ── TIMPS Code — SheafVeil ──
// CLI integration layer for HarmonicSheafWeaver (Layer 9).
// Injects sheaf-cohomology-based predictions and contradiction warnings
// into the agent system prompt proactively.
//
// Design:
//   • sheafVeil.ts is stateless — it wraps Memory's HarmonicSheafWeaver instance.
//   • injectSheafContext() is called from agent.ts before each run().
//   • The /sheaf slash command uses getSheafReport() for human-readable output.

import type { Memory } from './memory.js';
import type {
  SheafPrediction,
  CohomologyResult,
  SheafStatus,
} from '@timps/memory-core';

export interface SheafWarning {
  domain: string;
  riskLevel: 'high' | 'medium' | 'low';
  riskScore: number;
  message: string;
  /** Whether this is a cohomological (algebraic) contradiction */
  isCohomological: boolean;
}

export interface SheafInjectionResult {
  /** System prompt fragment to append */
  promptFragment: string;
  /** Warnings to surface as pre-flight alerts */
  warnings: SheafWarning[];
  /** Whether any high-risk or algebraic contradictions were found */
  hasHighRisk: boolean;
  /** Milliseconds the sheaf query took */
  latencyMs: number;
  /** Cohomology summary */
  cohomology: CohomologyResult | null;
}

export interface SheafReport {
  timestamp: string;
  activeNodeCount: number;
  edgeCount: number;
  avgAmplitude: number;
  spectralGap: number;
  betti1: number;
  domainRisks: Array<{
    domain: string;
    riskScore: number;
    riskLevel: string;
    trajectory: number[];
    explanation: string;
    eigenmodeWeights: number[];
  }>;
  contradictions: {
    count: number;
    nodeIds: string[];
    isConsistent: boolean;
  };
  topWarnings: string[];
}

// ── Domain labels ──────────────────────────────────────────────────────────

const RISK_DOMAINS = [
  'burnout',
  'contradiction',
  'relationship',
  'decision',
] as const;

type MonitoredDomain = typeof RISK_DOMAINS[number];

const DOMAIN_LABELS: Record<MonitoredDomain, string> = {
  burnout: 'Burnout trajectory',
  contradiction: 'Contradiction risk',
  relationship: 'Relationship drift',
  decision: 'Decision reversal risk',
};

// ── Main injection function ────────────────────────────────────────────────

/**
 * Build a HarmonicSheafWeaver context fragment for the agent system prompt.
 *
 * Called at the start of each agent.run() turn:
 *   const sheafResult = injectSheafContext(memory);
 *   if (sheafResult.hasHighRisk) {
 *     for (const w of sheafResult.warnings) yield { type: 'text', content: `⚠️ ${w.message}` };
 *   }
 *   systemPrompt += sheafResult.promptFragment;
 *
 * Synchronous + fast-fails gracefully on any error — never blocks the agent.
 */
export function injectSheafContext(memory: Memory): SheafInjectionResult {
  const t0 = Date.now();
  const warnings: SheafWarning[] = [];
  const lines: string[] = [];

  try {
    const weaver = memory.sheafWeaver;
    if (!weaver) {
      return { promptFragment: '', warnings: [], hasHighRisk: false, latencyMs: 0, cohomology: null };
    }

    // Predict risk for monitored domains
    const highRiskLines: string[] = [];
    for (const domain of RISK_DOMAINS) {
      try {
        const pred = weaver.predict(domain, { lookbackDays: 14 });

        if (pred.riskLevel === 'high') {
          highRiskLines.push(
            `• ${DOMAIN_LABELS[domain]} HIGH (${Math.round(pred.riskScore * 100)}%): ${pred.explanation}`
          );
          warnings.push({
            domain,
            riskLevel: 'high',
            riskScore: pred.riskScore,
            message: `${DOMAIN_LABELS[domain]} (${Math.round(pred.riskScore * 100)}%) — ${pred.explanation}`,
            isCohomological: false,
          });
        } else if (pred.riskLevel === 'medium' && pred.riskScore > 0.45) {
          warnings.push({
            domain,
            riskLevel: 'medium',
            riskScore: pred.riskScore,
            message: `${DOMAIN_LABELS[domain]} elevated (${Math.round(pred.riskScore * 100)}%) — monitor closely.`,
            isCohomological: false,
          });
        }
      } catch { /* skip domain */ }
    }

    // Run cohomology check for algebraic contradiction detection
    let cohomology: CohomologyResult | null = null;
    try {
      cohomology = weaver.detectContradictions();
      if (cohomology && !cohomology.isConsistent) {
        highRiskLines.push(
          `• ⚠️ ALGEBRAIC CONTRADICTION: H¹=${cohomology.betti1}, spectral gap=${cohomology.spectralGap.toFixed(3)}, ${cohomology.contradictionNodeIds.length} nodes involved`
        );
        warnings.push({
          domain: 'contradiction',
          riskLevel: 'high',
          riskScore: Math.min(1, 0.5 + cohomology.betti1 * 0.15),
          message: `Sheaf cohomology H¹=${cohomology.betti1}: irreconcilable contradictions detected algebraically. ${cohomology.contradictionNodeIds.length} nodes form non-trivial cocycles.`,
          isCohomological: true,
        });
      }
    } catch { /* skip */ }

    if (highRiskLines.length > 0) {
      lines.push('## Sheaf Intelligence Alerts (H¹ Cohomology)');
      lines.push(...highRiskLines);
    }

    // Inject context for burnout domain
    try {
      const ctx = weaver.getContextString('burnout', 3);
      if (!ctx.includes('No active')) {
        lines.push('\n## Sheaf Memory (Burnout signals)');
        lines.push(ctx);
      }
    } catch { /* ignore */ }

    // Inject context for contradiction domain
    try {
      const ctx = weaver.getContextString('contradiction', 3);
      if (!ctx.includes('No active')) {
        lines.push('\n## Sheaf Memory (Contradiction signals)');
        lines.push(ctx);
      }
    } catch { /* ignore */ }

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0 ? `\n${lines.join('\n')}\n` : '';
    const hasHighRisk = warnings.some((w) => w.riskLevel === 'high');

    return { promptFragment, warnings, hasHighRisk, latencyMs, cohomology };
  } catch {
    return { promptFragment: '', warnings: [], hasHighRisk: false, latencyMs: Date.now() - t0, cohomology: null };
  }
}

// ── Report generation for /sheaf command ──────────────────────────────────

/**
 * Generate a human-readable HarmonicSheafWeaver report.
 * Used by the /sheaf slash command handler.
 */
export function getSheafReport(memory: Memory): SheafReport {
  const weaver = memory.sheafWeaver;
  const timestamp = new Date().toISOString();

  if (!weaver) {
    return {
      timestamp,
      activeNodeCount: 0,
      edgeCount: 0,
      avgAmplitude: 0,
      spectralGap: 1,
      betti1: 0,
      domainRisks: [],
      contradictions: { count: 0, nodeIds: [], isConsistent: true },
      topWarnings: ['HarmonicSheafWeaver not initialized'],
    };
  }

  const status = weaver.getStatus();
  const allPredictions = weaver.predictAll({ lookbackDays: 30 });
  const cohomology = weaver.detectContradictions();

  const domainRisks = Object.entries(allPredictions)
    .map(([domain, pred]) => ({
      domain,
      riskScore: pred.riskScore,
      riskLevel: pred.riskLevel,
      trajectory: pred.trajectory.slice(0, 6),
      explanation: pred.explanation,
      eigenmodeWeights: pred.eigenmodeWeights,
    }))
    .sort((a, b) => b.riskScore - a.riskScore);

  const topWarnings: string[] = [];

  // Cohomology warnings
  if (!cohomology.isConsistent) {
    topWarnings.push(`[ALGEBRAIC] H¹=${cohomology.betti1}: ${cohomology.contradictionNodeIds.length} nodes in non-trivial cocycles`);
  }

  // Domain risk warnings
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
    domainRisks,
    contradictions: {
      count: cohomology.contradictionNodeIds.length,
      nodeIds: cohomology.contradictionNodeIds.slice(0, 10),
      isConsistent: cohomology.isConsistent,
    },
    topWarnings,
  };
}

// ── Weave helper for agent tool results ───────────────────────────────────

/**
 * Weave a new observation from agent tool results into HarmonicSheafWeaver.
 * Called after each tool execution to keep sheaf memory current.
 */
export function weaveToolResultSheaf(
  memory: Memory,
  content: string,
  opts: { domain?: string; causalParentId?: string } = {}
): void {
  try {
    const weaver = memory.sheafWeaver;
    if (!weaver) return;
    weaver.weave(content, {
      domain: opts.domain as import('@timps/memory-core').SheafDomain | undefined,
      causalParentId: opts.causalParentId,
    });
  } catch { /* fire-and-forget */ }
}
