// ── Tool 2 port: Regret Oracle ──
// Ported from sandeep-ai/tools/allTools.ts RegretOracleTool
// Storage: JSON file instead of Postgres decisions table
// Analysis: deterministic Jaccard similarity (no LLM)

import * as fs from 'node:fs';
import * as path from 'node:path';

function jaccard(a: string, b: string): number {
  const normalize = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const sa = normalize(a);
  const sb = normalize(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export interface Decision {
  id: string;
  description: string;
  decision_type?: string;
  regret_score: number;   // 0 = no regret, 1 = strong regret
  outcome_noted?: string;
  decided_at: string;
}

export interface RegretCheckResult {
  warning: boolean;
  matching_past_decision: string | null;
  similarity_score: number;
  message: string;
}

export class RegretOracle {
  private file: string;
  private decisions: Decision[] = [];

  constructor(dir: string) {
    this.file = path.join(dir, 'decisions.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.decisions = data.decisions || [];
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    fs.writeFileSync(this.file, JSON.stringify({ decisions: this.decisions }, null, 2), 'utf-8');
  }

  /** log: record a decision with optional outcome and regret score */
  log(description: string, outcome?: string, regret_score = 0, decision_type?: string): Decision {
    const dec: Decision = {
      id: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      description,
      decision_type,
      regret_score,
      outcome_noted: outcome,
      decided_at: new Date().toISOString(),
    };
    this.decisions.push(dec);
    if (this.decisions.length > 200) this.decisions.shift();
    this.save();
    return dec;
  }

  /** check: warn if new_decision matches any past regretted decisions */
  check(new_decision: string): RegretCheckResult {
    const regretted = this.decisions.filter(d => d.regret_score > 0.5);
    if (!regretted.length) {
      return { warning: false, matching_past_decision: null, similarity_score: 0, message: 'No regret history found. Go ahead, but I will remember this.' };
    }

    let best: Decision | undefined;
    let bestScore = 0;

    for (const d of regretted) {
      const score = jaccard(new_decision, d.description);
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }

    if (best && bestScore > 0.3) {
      return {
        warning: true,
        matching_past_decision: best.description,
        similarity_score: bestScore,
        message: `This resembles a past decision you regretted (score: ${best.regret_score}): "${best.description.slice(0, 100)}"`,
      };
    }

    return { warning: false, matching_past_decision: null, similarity_score: bestScore, message: 'No matching past regrets found.' };
  }

  /** review: show decision history sorted by regret_score desc */
  review(limit = 20): Decision[] {
    return [...this.decisions]
      .sort((a, b) => b.regret_score - a.regret_score)
      .slice(0, limit);
  }
}
