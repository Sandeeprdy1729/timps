// ── Tool: Skill Shadow — coach using your own workflow patterns ──
// Companion to VelocityTracker. Uses the same data but reframes the advice
// as "how YOU do this work" rather than "what generally works."

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ShadowPattern {
  pattern_id: string;
  context: string;        // "writing a hard refactor", "fixing a tricky bug"
  your_approach: string;  // distilled from your observed patterns
  confidence: number;
}

interface RawPattern {
  id: string;
  pattern_type: string;
  description: string;
  success_rate: number;
  observed_count: number;
  last_seen: string;
}

function jaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  return inter / (setA.size + setB.size - inter);
}

export class SkillShadow {
  private patternsFile: string;

  constructor(dir: string) {
    this.patternsFile = path.join(dir, 'workflow_patterns.json');
  }

  /** Coach using your own patterns. Reads VelocityTracker's data directly. */
  shadow(situation: string): ShadowPattern | null {
    let patterns: RawPattern[] = [];
    try {
      if (fs.existsSync(this.patternsFile)) {
        const data = JSON.parse(fs.readFileSync(this.patternsFile, 'utf-8'));
        patterns = data.patterns || [];
      }
    } catch { /* ignore */ }

    if (patterns.length === 0) {
      return {
        pattern_id: 'shadow_empty',
        context: situation,
        your_approach: 'No workflow patterns logged yet. Use velocityTracker.observe() a few times to seed Skill Shadow.',
        confidence: 0,
      };
    }

    const ranked = patterns
      .map(p => ({ p, sim: jaccard(situation, p.description) }))
      .filter(x => x.sim > 0.1)
      .sort((a, b) => (b.p.success_rate * b.sim) - (a.p.success_rate * a.sim));

    if (ranked.length === 0) {
      const top = patterns.sort((a, b) => b.success_rate - a.success_rate)[0];
      return {
        pattern_id: top.id,
        context: situation,
        your_approach: `No exact match, but your highest-success pattern is "${top.description}" (${(top.success_rate * 100).toFixed(0)}% success over ${top.observed_count} observations). Consider whether it applies here.`,
        confidence: top.success_rate * 0.5,
      };
    }

    const top = ranked[0];
    return {
      pattern_id: top.p.id,
      context: situation,
      your_approach: `When you "${top.p.description}" you've had ${(top.p.success_rate * 100).toFixed(0)}% success (${top.p.observed_count} observations). Use the same approach here.`,
      confidence: Math.min(1, top.sim * top.p.success_rate),
    };
  }
}
