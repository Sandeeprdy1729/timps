// ── Tool: Dead Reckoning — simulate future outcomes from past decisions ──
// Uses Jaccard similarity to find similar past decisions, then aggregates their regret/regret_score.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';

export interface PastDecision {
  id: string;
  decision: string;
  context?: string;
  regret_score: number;    // 0–1, 1 = catastrophic regret
  outcome: 'positive' | 'neutral' | 'negative';
  created_at: string;
}

export interface SimulationResult {
  scenario: string;
  similar_past: PastDecision[];
  predicted_outcome: 'positive' | 'neutral' | 'negative' | 'unknown';
  confidence: number;       // 0–1
  rationale: string;
  horizon_months: number;
}

function jaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  return inter / (setA.size + setB.size - inter);
}

export class DeadReckoning {
  private file: string;
  private decisions: PastDecision[] = [];
  private _backend?: StorageBackend;

  constructor(dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.file = path.join(dir, 'past_decisions.json');
    this.load();
  }

  private load(): void {
    try {
      if (this._backend) {
        const data = this._backend.read(path.basename(this.file));
        if (data) {
          this.decisions = data.decisions || [];
        }
      } else if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.decisions = data.decisions || [];
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    const data = { decisions: this.decisions };
    if (this._backend) {
      this._backend.write(path.basename(this.file), data);
    } else {
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /** Log a past decision with its outcome (used to seed the simulation model). */
  log(decision: string, context: string, regret_score: number, outcome: 'positive' | 'neutral' | 'negative'): PastDecision {
    const d: PastDecision = {
      id: `pd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      decision,
      context,
      regret_score: Math.max(0, Math.min(1, regret_score)),
      outcome,
      created_at: new Date().toISOString(),
    };
    this.decisions.push(d);
    if (this.decisions.length > 500) this.decisions.shift();
    this.save();
    return d;
  }

  /** Simulate the likely outcome of a hypothetical decision based on similar history. */
  simulate(scenario: string, horizon_months = 12): SimulationResult {
    const scored = this.decisions
      .map(d => ({ d, sim: jaccard(scenario, d.decision + ' ' + (d.context || '')) }))
      .filter(x => x.sim > 0.05)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 5);

    if (scored.length === 0) {
      return {
        scenario,
        similar_past: [],
        predicted_outcome: 'unknown',
        confidence: 0,
        rationale: 'No similar past decisions on file. Log a few outcomes (log(decision, context, regret_score, outcome)) to seed the model.',
        horizon_months,
      };
    }

    // Weighted vote by similarity × regret
    let posScore = 0, negScore = 0, neuScore = 0;
    for (const { d, sim } of scored) {
      const weight = sim * (1 - d.regret_score * 0.5);
      if (d.outcome === 'positive') posScore += weight;
      else if (d.outcome === 'negative') negScore += weight;
      else neuScore += weight;
    }
    const total = posScore + negScore + neuScore || 1;
    const posFrac = posScore / total;
    const negFrac = negScore / total;
    const neuFrac = neuScore / total;
    const confidence = Math.min(1, scored[0].sim * (scored.length / 5));

    let predicted: 'positive' | 'neutral' | 'negative' | 'unknown';
    if (negFrac > posFrac && negFrac > neuFrac) predicted = 'negative';
    else if (posFrac > negFrac && posFrac > neuFrac) predicted = 'positive';
    else if (neuFrac > 0) predicted = 'neutral';
    else predicted = 'unknown';

    const topRegret = scored.find(s => s.d.outcome === 'negative' && s.d.regret_score > 0.5);
    const rationale = topRegret
      ? `Similar to "${topRegret.d.decision}" (regret ${(topRegret.d.regret_score * 100).toFixed(0)}%). ${scored.length} past decision(s) match.`
      : `${scored.length} similar past decision(s) found. ${predicted === 'positive' ? 'Outcomes skew positive.' : predicted === 'negative' ? 'Outcomes skew negative — review regrets.' : 'Outcomes mixed.'}`;

    return {
      scenario,
      similar_past: scored.map(s => s.d),
      predicted_outcome: predicted,
      confidence,
      rationale,
      horizon_months,
    };
  }
}
