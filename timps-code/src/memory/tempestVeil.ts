// ── TIMPS Code — TempestVeil ──
// CLI integration layer for TempestForge tree methods (Layer 10b).
// Injects hierarchical temporal tree queries, subtree contradiction detection,
// and branch resonance trajectories into the agent system prompt.
//
// Design:
//   • tempestVeil.ts is stateless — wraps AetherForgeERL's tree methods.
//   • injectTempestContext() is called from agent.ts before each run() for
//     point-in-time tree-walking context retrieval.
//   • The /tempest slash command uses getTempestReport().

import type { Memory } from './memory.js';

export interface TempestBranchWarning {
  nodeId: string;
  content: string;
  amplitude: number;
  domain: string;
  terminalAmplitude: number;
}

export interface TempestInjectionResult {
  promptFragment: string;
  branchWarnings: TempestBranchWarning[];
  signalCount: number;
  latencyMs: number;
}

export interface TempestReport {
  timestamp: string;
  treeRootCount: number;
  totalNodes: number;
  branchCount: number;
  highRiskBranches: number;
  contradictionsInSubtrees: number;
  recentNodes: Array<{
    id: string;
    content: string;
    domain: string;
    amplitude: number;
    status: string;
  }>;
  branchSummaries: Array<{
    rootId: string;
    depth: number;
    terminalAmplitude: number;
    atRisk: number;
  }>;
  topWarnings: string[];
}

/**
 * Build a TempestForge context fragment for the agent system prompt.
 * Walks the causal tree for recent high-amplitude signals and injects
 * branch resonance trajectories.
 */
export function injectTempestContext(memory: Memory): TempestInjectionResult {
  const t0 = Date.now();
  const branchWarnings: TempestBranchWarning[] = [];
  const lines: string[] = [];

  try {
    const forge = memory.aetherForge;
    if (!forge) {
      return { promptFragment: '', branchWarnings: [], signalCount: 0, latencyMs: 0 };
    }

    // Point-in-time query for recent high-amplitude signals
    const recent = forge.queryPointInTime(Date.now(), {
      windowMs: 7 * 86_400_000,
      limit: 8,
      minAmplitude: 0.3,
    });

    if (recent.length === 0) {
      return {
        promptFragment: '\n## Tempest Memory (causal tree): No recent high-amplitude signals.\n',
        branchWarnings: [],
        signalCount: 0,
        latencyMs: Date.now() - t0,
      };
    }

    // Walk tree branches from each recent root node for resonance trajectory
    const hasParent = new Set<string>();
    for (const e of forge['store'].edges) {
      if (e.edgeType === 'causes' || e.edgeType === 'supersedes') {
        hasParent.add(e.toId);
      }
    }

    const branchLines: string[] = [];
    for (const node of recent) {
      const isRoot = !hasParent.has(node.id);
      if (isRoot) {
        try {
          const br = forge.branchResonance(node.id, 0.85, 6);
          if (br.trajectory.length > 1) {
            branchLines.push(
              `• Branch "${node.content.slice(0, 50)}": ${br.trajectory.length} nodes, ` +
              `terminal amplitude ${(br.terminalAmplitude * 100).toFixed(0)}%, ` +
              `${br.atRisk.length} at-risk`
            );
            if (br.atRisk.length > 0) {
              for (const aid of br.atRisk) {
                const an = forge['store'].nodes[aid];
                if (an) {
                  branchWarnings.push({
                    nodeId: aid,
                    content: an.content.slice(0, 60),
                    amplitude: an.amplitude,
                    domain: an.domain,
                    terminalAmplitude: br.terminalAmplitude,
                  });
                }
              }
            }
          }
        } catch { /* skip single branch */ }
      }
    }

    if (branchLines.length > 0) {
      lines.push('## Tempest Intelligence (causal tree branches)');
      lines.push(...branchLines);
    }

    // Check for subtree contradictions in active branches
    let subtreeCount = 0;
    for (const node of recent) {
      if (!hasParent.has(node.id)) {
        try {
          const sc = forge.subtreeContradictions(node.id, 3);
          if (sc.contradictions.length > 0) {
            subtreeCount += sc.contradictions.length;
          }
        } catch { /* skip */ }
      }
    }
    if (subtreeCount > 0) {
      lines.push(`• Subtree contradictions: ${subtreeCount} edges in non-trivial H¹`);
    }

    lines.push(`• ${recent.length} recent high-amplitude signals in causal tree`);

    const latencyMs = Date.now() - t0;
    const promptFragment = lines.length > 0 ? `\n${lines.join('\n')}\n` : '';

    return { promptFragment, branchWarnings, signalCount: recent.length, latencyMs };
  } catch {
    return { promptFragment: '', branchWarnings: [], signalCount: 0, latencyMs: Date.now() - t0 };
  }
}

/**
 * Generate a human-readable TempestForge report for /tempest command.
 */
export function getTempestReport(memory: Memory): TempestReport {
  const forge = memory.aetherForge;
  const timestamp = new Date().toISOString();

  if (!forge) {
    return {
      timestamp, treeRootCount: 0, totalNodes: 0, branchCount: 0,
      highRiskBranches: 0, contradictionsInSubtrees: 0,
      recentNodes: [], branchSummaries: [],
      topWarnings: ['TempestForge not initialized (no AetherForgeERL)'],
    };
  }

  // Identify tree roots (nodes w/o incoming causal/supersedes edges)
  const hasParent = new Set<string>();
  for (const e of forge['store'].edges) {
    if (e.edgeType === 'causes' || e.edgeType === 'supersedes') {
      hasParent.add(e.toId);
    }
  }

  const roots = Object.keys(forge['store'].nodes).filter(
    nid => !hasParent.has(nid) && forge['store'].nodes[nid]?.status !== 'quenched'
  );

  // Walk each root for branch summaries
  const branchSummaries: TempestReport['branchSummaries'] = [];
  let highRiskCount = 0;
  let subtreeContraCount = 0;

  for (const rootId of roots) {
    try {
      const br = forge.branchResonance(rootId, 0.85, 10);
      branchSummaries.push({
        rootId,
        depth: br.trajectory.length,
        terminalAmplitude: br.terminalAmplitude,
        atRisk: br.atRisk.length,
      });
      if (br.terminalAmplitude < 0.2 || br.atRisk.length > 0) {
        highRiskCount++;
      }

      const sc = forge.subtreeContradictions(rootId, 3);
      subtreeContraCount += sc.contradictions.length;
    } catch { /* skip */ }
  }

  // Recent nodes from tree walk
  const recent = forge.queryPointInTime(Date.now(), {
    windowMs: 7 * 86_400_000, limit: 8, minAmplitude: 0.3,
  });
  const recentNodes = recent.map(n => ({
    id: n.id,
    content: n.content.slice(0, 80),
    domain: n.domain,
    amplitude: n.amplitude,
    status: n.status,
  }));

  const topWarnings: string[] = [];
  if (subtreeContraCount > 0) {
    topWarnings.push(`[TEMPEST] ${subtreeContraCount} subtree contradictions detected`);
  }
  if (highRiskCount > 0) {
    topWarnings.push(`[TEMPEST] ${highRiskCount} branches at risk (terminal amplitude < 0.2)`);
  }
  if (branchSummaries.length === 0) {
    topWarnings.push('[TEMPEST] No active causal tree branches');
  }

  return {
    timestamp,
    treeRootCount: roots.length,
    totalNodes: Object.keys(forge['store'].nodes).length,
    branchCount: branchSummaries.length,
    highRiskBranches: highRiskCount,
    contradictionsInSubtrees: subtreeContraCount,
    recentNodes,
    branchSummaries,
    topWarnings,
  };
}

/**
 * Prune a low-utility branch from the causal tree.
 */
export function pruneTempestBranch(
  memory: Memory,
  rootId: string,
  sparedIds: string[] = []
): number {
  try {
    const forge = memory.aetherForge;
    if (!forge) return 0;
    return forge.pruneBranch(rootId, new Set(sparedIds));
  } catch {
    return 0;
  }
}
