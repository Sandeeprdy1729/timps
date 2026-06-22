// ── @timps/memory-core — L13: ProvenanceForge ──
// Complete source tracking for every memory entry.
// Answers "where did this come from?" with a verifiable chain of custody.
// Every memory write records its provenance; every read returns confidence-weighted reliability.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from './backends/types.js';

export type SourceKind =
  | 'user_direct'
  | 'user_implied'
  | 'agent_inference'
  | 'agent_pattern'
  | 'tool_output'
  | 'web_search'
  | 'doc_reference'
  | 'git_history'
  | 'cross_project';

export interface Provenance {
  id: string;
  sourceKind: SourceKind;
  sourceDetail: string;
  actorId: string;
  observedAt: number;
  validFrom?: number;
  validUntil?: number;
  evidenceCount: number;
  confidence: number;
  chainOfCustody: { actor: string; op: string; at: number }[];
  parentIds: string[];
}

export type ProvenanceInput = Omit<Provenance, 'id' | 'chainOfCustody'> & { actor: string };

export class ProvenanceForge {
  private _backend?: StorageBackend;

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  record(input: ProvenanceInput): Provenance {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ ...input, recordedAt: Date.now() }))
      .digest('hex');
    const full: Provenance = {
      ...input,
      id: hash,
      chainOfCustody: [{ actor: input.actor, op: 'record', at: Date.now() }],
    };
    const file = path.join(this.dir, `${hash}.json`);
    fs.writeFileSync(file, JSON.stringify(full, null, 2), 'utf-8');
    return full;
  }

  explain(id: string): Provenance | null {
    const file = path.join(this.dir, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Provenance;
  }

  reliability(p: Provenance): number {
    const ageDays = (Date.now() - p.observedAt) / (24 * 60 * 60 * 1000);
    const ageDecay = Math.exp(-ageDays / 30);
    const sourceWeight: Record<SourceKind, number> = {
      user_direct: 1.0,
      doc_reference: 0.95,
      git_history: 0.95,
      tool_output: 0.9,
      web_search: 0.7,
      user_implied: 0.6,
      agent_inference: 0.5,
      agent_pattern: 0.7,
      cross_project: 0.5,
    };
    const sw = sourceWeight[p.sourceKind] ?? 0.5;
    const evidenceBoost = Math.min(1, 0.5 + p.evidenceCount * 0.1);
    return sw * ageDecay * evidenceBoost * p.confidence;
  }

  addCustodyStep(id: string, actor: string, op: string): Provenance | null {
    const existing = this.explain(id);
    if (!existing) return null;
    existing.chainOfCustody.push({ actor, op, at: Date.now() });
    const file = path.join(this.dir, `${id}.json`);
    fs.writeFileSync(file, JSON.stringify(existing, null, 2), 'utf-8');
    return existing;
  }

  delete(id: string): boolean {
    const file = path.join(this.dir, `${id}.json`);
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  }

  listBySource(kind: SourceKind): Provenance[] {
    const out: Provenance[] = [];
    const files = fs.readdirSync(this.dir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const p = JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf-8')) as Provenance;
      if (p.sourceKind === kind) out.push(p);
    }
    return out;
  }
}
