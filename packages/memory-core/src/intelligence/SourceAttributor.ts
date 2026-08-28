// ── Tool 20: SourceAttributor ──
// Returns a human-readable provenance chain for any memory id.
// Answers "where did this come from?" with full traceability.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';
import type { Provenance } from '../ProvenanceForge.js';

export interface AttributionResult {
  memoryId: string;
  sourceKind: string;
  sourceDetail: string;
  actorId: string;
  observedAt: string;
  confidence: number;
  chainOfCustody: { actor: string; op: string; at: string }[];
  reliability: number;
}

export class SourceAttributor {
  private _backend?: StorageBackend;

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
  }

  attribute(memoryId: string): AttributionResult | null {
    const prov = this.loadProvenance(memoryId);
    if (!prov) return null;

    const reliability = this.calculateReliability(prov);

    return {
      memoryId,
      sourceKind: prov.sourceKind,
      sourceDetail: prov.sourceDetail,
      actorId: prov.actorId,
      observedAt: new Date(prov.observedAt).toISOString(),
      confidence: prov.confidence,
      chainOfCustody: prov.chainOfCustody.map(c => ({
        actor: c.actor,
        op: c.op,
        at: new Date(c.at).toISOString(),
      })),
      reliability,
    };
  }

  explain(memoryId: string): string {
    const attr = this.attribute(memoryId);
    if (!attr) return `Memory ${memoryId}: no provenance found.`;

    const lines: string[] = [
      `Memory ${attr.memoryId}`,
      `  Source: ${attr.sourceKind} (${attr.sourceDetail})`,
      `  Actor: ${attr.actorId}`,
      `  Observed: ${attr.observedAt}`,
      `  Confidence: ${(attr.confidence * 100).toFixed(0)}%`,
      `  Reliability: ${(attr.reliability * 100).toFixed(0)}%`,
    ];

    if (attr.chainOfCustody.length > 1) {
      lines.push('  Chain of custody:');
      for (const c of attr.chainOfCustody) {
        lines.push(`    ${c.at} — ${c.actor} did "${c.op}"`);
      }
    }

    return lines.join('\n');
  }

  private loadProvenance(memoryId: string): Provenance | null {
    try {
      if (this._backend) {
        const files = this._backend.list('provenance/');
        if (!files) return null;
        const jsonFiles = (Array.isArray(files) ? files : []).filter((f: string) => f.endsWith('.json'));
        for (const f of jsonFiles) {
          const p = this._backend.read(f) as Provenance | null;
          if (p && (p.parentIds.includes(memoryId) || p.id === memoryId)) return p;
        }
        return null;
      }
      const provDir = path.join(this.dir, 'provenance');
      if (!fs.existsSync(provDir)) return null;
      const files = fs.readdirSync(provDir).filter(f => f.endsWith('.json'));
      for (const f of files) {
        const p = JSON.parse(fs.readFileSync(path.join(provDir, f), 'utf-8')) as Provenance;
        if (p.parentIds.includes(memoryId) || p.id === memoryId) return p;
      }
      return null;
    } catch { return null; }
  }

  private calculateReliability(p: Provenance): number {
    const ageDays = (Date.now() - p.observedAt) / (24 * 60 * 60 * 1000);
    const ageDecay = Math.exp(-ageDays / 30);
    const sourceWeight: Record<string, number> = {
      user_direct: 1.0, doc_reference: 0.95, git_history: 0.95,
      tool_output: 0.9, web_search: 0.7, user_implied: 0.6,
      agent_inference: 0.5, agent_pattern: 0.7, cross_project: 0.5,
    };
    const sw = sourceWeight[p.sourceKind] ?? 0.5;
    const evidenceBoost = Math.min(1, 0.5 + p.evidenceCount * 0.1);
    return sw * ageDecay * evidenceBoost * p.confidence;
  }
}
