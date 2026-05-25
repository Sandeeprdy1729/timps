// ── TIMPS Code — EchoVeil ──
// CLI integration layer for EchoForge (Layer 7).
// Injects echo-based predictions into the agent system prompt and
// surfaces burnout/contradiction/relationship warnings proactively.
//
// Design:
//   • echoVeil.ts is stateless — it wraps the Memory's echoForge instance.
//   • injectEchoContext() is called from agent.ts before each run().
//   • The /echo slash command uses getEchoReport() for human-readable output.

import type { Memory } from './memory.js';
import type { SynapseQuench, SpectralPrediction } from './synapseQuench.js';

export interface EchoWarning {
  domain: string;
  riskLevel: 'high' | 'medium' | 'low';
  riskScore: number;
  message: string;
}

export interface EchoInjectionResult {
  /** System prompt fragment to append */
  promptFragment: string;
  /** Warnings to surface as pre-flight alerts */
  warnings: EchoWarning[];
  /** Whether any high-risk domains were found */
  hasHighRisk: boolean;
  /** Milliseconds the echo query took */
  latencyMs: number;
}

export interface EchoReport {
  timestamp: string;
  activeNodeCount: number;
  edgeCount: number;
  avgEchoAmp: number;
  domainRisks: Array<{
    domain: string;
    riskScore: number;
    riskLevel: string;
    trajectory: number[];
    explanation: string;
  }>;
  topWarnings: string[];
}

// ── Domain-specific thresholds ─────────────────────────────────────────────

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
 * Build an EchoForge context fragment for the agent system prompt.
 *
 * Called at the start of each agent.run() turn:
 *   const echoResult = await injectEchoContext(memory);
 *   if (echoResult.hasHighRisk) {
 *     for (const w of echoResult.warnings) yield { type: 'text', content: `⚠️ ${w.message}` };
 *   }
 *   systemPrompt += echoResult.promptFragment;
 *
 * Fast-fails gracefully on any error — never blocks the agent.
 */
export async function injectEchoContext(memory: Memory): Promise<EchoInjectionResult> {
  const t0 = Date.now();
  const warnings: EchoWarning[] = [];
  const lines: string[] = [];

  try {
    const echoForge = memory.echoVeil;
    if (!echoForge) {
      return { promptFragment: '', warnings: [], hasHighRisk: false, latencyMs: 0 };
    }

    // Predict risk for monitored domains in parallel
    const predictions = await Promise.allSettled(
      RISK_DOMAINS.map((domain) => echoForge.predict(domain, { lookbackDays: 14 }))
    );

    const highRiskLines: string[] = [];

    for (let i = 0; i < RISK_DOMAINS.length; i++) {
      const domain = RISK_DOMAINS[i]!;
      const pred = predictions[i];
      if (pred?.status !== 'fulfilled') continue;
      const p = pred.value;

      if (p.riskLevel === 'high') {
        highRiskLines.push(
          `• ${DOMAIN_LABELS[domain]} HIGH (${(p.riskScore * 100).toFixed(0)}%): ${p.explanation}`
        );
        warnings.push({
          domain,
          riskLevel: 'high',
          riskScore: p.riskScore,
          message: `${DOMAIN_LABELS[domain]} (${(p.riskScore * 100).toFixed(0)}%) — ${p.explanation}`,
        });
      } else if (p.riskLevel === 'medium' && p.riskScore > 0.45) {
        warnings.push({
          domain,
          riskLevel: 'medium',
          riskScore: p.riskScore,
          message: `${DOMAIN_LABELS[domain]} elevated (${(p.riskScore * 100).toFixed(0)}%) — monitor closely.`,
        });
      }
    }

    if (highRiskLines.length > 0) {
      lines.push('## Echo Intelligence Alerts');
      lines.push(...highRiskLines);
    }

    // Inject top burnout + contradiction echo context
    try {
      const burnoutCtx = await echoForge.getContextString('burnout', 3);
      if (!burnoutCtx.includes('No active nodes')) {
        lines.push('\n## Echo Memory (Burnout signals)');
        lines.push(burnoutCtx);
      }
    } catch { /* ignore */ }

    try {
      const contradictionCtx = await echoForge.getContextString('contradiction', 3);
      if (!contradictionCtx.includes('No active nodes')) {
        lines.push('\n## Echo Memory (Contradiction signals)');
        lines.push(contradictionCtx);
      }
    } catch { /* ignore */ }

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0 ? `\n${lines.join('\n')}\n` : '';
    const hasHighRisk = warnings.some((w) => w.riskLevel === 'high');

    return { promptFragment, warnings, hasHighRisk, latencyMs };
  } catch {
    // Echo intelligence is best-effort — never fail the agent
    return { promptFragment: '', warnings: [], hasHighRisk: false, latencyMs: Date.now() - t0 };
  }
}

// ── Report generation for /echo command ───────────────────────────────────

/**
 * Generate a human-readable EchoForge report.
 * Used by the /echo slash command handler.
 */
export async function getEchoReport(memory: Memory): Promise<EchoReport> {
  const echoForge = memory.echoVeil;
  const timestamp = new Date().toISOString();

  if (!echoForge) {
    return {
      timestamp,
      activeNodeCount: 0,
      edgeCount: 0,
      avgEchoAmp: 0,
      domainRisks: [],
      topWarnings: ['EchoForge not initialized'],
    };
  }

  const [status, allPredictions] = await Promise.all([
    echoForge.getStatus(),
    echoForge.predictAll({ lookbackDays: 30 }),
  ]);

  const domainRisks = Object.entries(allPredictions)
    .map(([domain, pred]) => ({
      domain,
      riskScore: pred!.riskScore,
      riskLevel: pred!.riskLevel,
      trajectory: pred!.trajectory.slice(0, 6),
      explanation: pred!.explanation,
    }))
    .sort((a, b) => b.riskScore - a.riskScore);

  const topWarnings = domainRisks
    .filter((d) => d.riskLevel !== 'low')
    .map((d) => `[${d.riskLevel.toUpperCase()}] ${d.domain}: ${d.explanation}`);

  return {
    timestamp,
    activeNodeCount: status.activeNodeCount,
    edgeCount: status.edgeCount,
    avgEchoAmp: status.avgEchoAmp,
    domainRisks,
    topWarnings,
  };
}

// ── Weave helper for agent tool results ───────────────────────────────────

/**
 * Weave a new observation from agent tool results into EchoForge.
 * Called after each tool execution to keep echo memory current.
 */
export async function weaveToolResult(
  memory: Memory,
  content: string,
  opts: { domain?: string; causalParentId?: string } = {}
): Promise<void> {
  try {
    const echoForge = memory.echoVeil;
    if (!echoForge) return;
    await echoForge.weave(content, {
      domain: opts.domain as import('./echoVeil.js').EchoVeilDomain | undefined,
      causalParentId: opts.causalParentId,
    });
  } catch { /* fire-and-forget */ }
}

// Re-export type alias for the EchoDomain as used in timps-code context
export type EchoVeilDomain =
  | 'burnout' | 'relationship' | 'decision'
  | 'code_pattern' | 'contradiction' | 'goal' | 'general';

// ── SynapseQuench Integration ─────────────────────────────────────────────────

/**
 * Enhanced echo context using SynapseQuench spectral propagation.
 * Falls back to standard EchoForge if SynapseQuench produces no results.
 * Called from agent.ts as a complement to injectEchoContext().
 */
export function injectSpectralContext(memory: Memory): {
  promptFragment: string;
  warnings: EchoWarning[];
  hasHighRisk: boolean;
  spectralPredictions: SpectralPrediction[];
} {
  const warnings: EchoWarning[] = [];
  const lines: string[] = [];
  const spectralPredictions: SpectralPrediction[] = [];

  try {
    const quench = memory.synapseQuench;
    const status = quench.getStatus();
    if (status.activeNodeCount === 0) {
      return { promptFragment: '', warnings: [], hasHighRisk: false, spectralPredictions: [] };
    }

    // Predict risk for monitored domains
    for (const domain of RISK_DOMAINS) {
      const pred = quench.predict(domain, { lookbackDays: 14 });
      spectralPredictions.push(pred);

      if (pred.riskLevel === 'high') {
        lines.push(`• ${DOMAIN_LABELS[domain]} HIGH (${Math.round(pred.riskScore * 100)}%): ${pred.explanation}`);
        warnings.push({
          domain,
          riskLevel: 'high',
          riskScore: pred.riskScore,
          message: `${DOMAIN_LABELS[domain]} (${Math.round(pred.riskScore * 100)}%) — ${pred.explanation}`,
        });
      } else if (pred.riskLevel === 'medium' && pred.riskScore > 0.45) {
        warnings.push({
          domain,
          riskLevel: 'medium',
          riskScore: pred.riskScore,
          message: `${DOMAIN_LABELS[domain]} elevated (${Math.round(pred.riskScore * 100)}%) — spectral coherence ${Math.round((pred.confidence ?? 0) * 100)}%.`,
        });
      }

      // Surface phase conflicts as proactive warnings
      for (const conflict of pred.phaseConflicts) {
        if (conflict.type === 'destructive') {
          warnings.push({
            domain,
            riskLevel: 'medium',
            riskScore: 0.5,
            message: `Phase conflict detected: ${conflict.summary}`,
          });
        }
      }
    }

    if (lines.length > 0) {
      lines.unshift('## SynapseQuench Spectral Alerts');
    }

    const promptFragment = lines.length > 0 ? `\n${lines.join('\n')}\n` : '';
    const hasHighRisk = warnings.some(w => w.riskLevel === 'high');

    return { promptFragment, warnings, hasHighRisk, spectralPredictions };
  } catch {
    return { promptFragment: '', warnings: [], hasHighRisk: false, spectralPredictions: [] };
  }
}

/**
 * Weave a tool result into both EchoForge and SynapseQuench.
 * Dual-write ensures both systems stay synchronized.
 */
export function weaveToolResultSpectral(
  memory: Memory,
  content: string,
  opts: { domain?: string; causalParentId?: string } = {}
): void {
  try {
    const quench = memory.synapseQuench;
    quench.weave(content, {
      domain: opts.domain as EchoVeilDomain | undefined,
      causalParentId: opts.causalParentId,
    });
  } catch { /* fire-and-forget */ }
}
