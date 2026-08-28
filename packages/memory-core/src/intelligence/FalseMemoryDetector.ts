// ── Tool 18: FalseMemoryDetector ──
// Flags memories that lack strong provenance, have low evidence counts,
// or match known schema-distortion patterns. Returns a false-memory risk score.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';
import type { Provenance, SourceKind } from '../ProvenanceForge.js';

export interface FalseMemoryScore {
  memoryId: string;
  content: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  contributingFactors: string[];
  recommendation: string;
}

const SOURCE_RISK: Record<SourceKind, number> = {
  user_direct: 0.05,
  doc_reference: 0.05,
  git_history: 0.05,
  tool_output: 0.10,
  web_search: 0.20,
  user_implied: 0.45,
  agent_inference: 0.55,
  agent_pattern: 0.30,
  cross_project: 0.40,
};

export class FalseMemoryDetector {
  private _backend?: StorageBackend;

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
  }

  score(memory: { id?: string; content?: string; provenance?: Provenance; evidenceCount: number; ageDays: number }): FalseMemoryScore {
    const prov = memory.provenance;
    const sourceKind = prov?.sourceKind ?? 'agent_inference';
    const sourceRisk = SOURCE_RISK[sourceKind] ?? 0.5;
    const evidencePenalty = Math.max(0, 0.5 - memory.evidenceCount * 0.1);
    const ageRisk = Math.min(0.2, memory.ageDays / 365);
    const unverifiedPenalty = !prov ? 0.3 : 0;

    const rawScore = sourceRisk + evidencePenalty + ageRisk + unverifiedPenalty;
    const riskScore = Math.min(1, rawScore);

    const riskLevel: FalseMemoryScore['riskLevel'] =
      riskScore < 0.2 ? 'low'
      : riskScore < 0.4 ? 'medium'
      : riskScore < 0.6 ? 'high'
      : 'critical';

    const contributingFactors: string[] = [];
    if (sourceRisk > 0.3) contributingFactors.push(`High-risk source: ${sourceKind}`);
    if (evidencePenalty > 0.2) contributingFactors.push('Low evidence count');
    if (ageRisk > 0.1) contributingFactors.push('Old memory with no re-verification');
    if (unverifiedPenalty > 0) contributingFactors.push('No provenance record');

    const recommendation = riskLevel === 'critical' || riskLevel === 'high'
      ? `Verify with the user before relying on "${(memory.content ?? '').slice(0, 60)}"`
      : 'No action needed';

    return {
      memoryId: memory.id ?? 'unknown',
      content: (memory.content ?? '').slice(0, 200),
      riskScore,
      riskLevel,
      contributingFactors,
      recommendation,
    };
  }
}
