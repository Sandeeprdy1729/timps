// ── Tool 10 port: Bug Pattern Prophet ──
// Ported from sandeep-ai/tools/allTools.ts BugPatternProphetTool
// Storage: JSON file instead of Postgres bug_patterns table
// Analysis: deterministic frequency + context matching (no LLM)

import * as fs from 'node:fs';
import * as path from 'node:path';

function contextOverlap(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const wa = normalize(a);
  const wb = new Set(normalize(b));
  if (wa.length === 0 || wb.size === 0) return 0;
  const hits = wa.filter(w => wb.has(w)).length;
  return hits / wa.length;
}

export interface BugPattern {
  id: string;
  bug_type: string;         // e.g. off_by_one, null_pointer, race_condition
  trigger_context?: string; // e.g. tired, deadline, new_api
  frequency: number;
  last_occurrence: string;
}

export interface BugWarnResult {
  alert: boolean;
  risk_level: 'low' | 'medium' | 'high';
  likely_bug_types: string[];
  reason: string;
  suggestion: string;
}

export class BugPatternProphet {
  private file: string;
  private patterns: BugPattern[] = [];

  constructor(dir: string) {
    this.file = path.join(dir, 'bug_patterns.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.patterns = data.patterns || [];
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    fs.writeFileSync(this.file, JSON.stringify({ patterns: this.patterns }, null, 2), 'utf-8');
  }

  /** record_bug: log a bug you introduced */
  recordBug(bug_type: string, trigger_context?: string): BugPattern {
    const existing = this.patterns.find(p => p.bug_type === bug_type);
    if (existing) {
      existing.frequency++;
      existing.last_occurrence = new Date().toISOString();
      if (trigger_context) existing.trigger_context = trigger_context;
      this.save();
      return existing;
    }
    const pat: BugPattern = {
      id: `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      bug_type,
      trigger_context,
      frequency: 1,
      last_occurrence: new Date().toISOString(),
    };
    this.patterns.push(pat);
    this.save();
    return pat;
  }

  /** warn: check if current context matches your personal bug patterns */
  warn(current_context: string): BugWarnResult {
    if (!this.patterns.length) {
      return { alert: false, risk_level: 'low', likely_bug_types: [], reason: 'No bug history yet. Record bugs as you find them to enable personalized warnings.', suggestion: 'Start recording bugs with record_bug().' };
    }

    // Score patterns by trigger_context overlap + frequency weight
    const scored = this.patterns
      .map(p => ({
        p,
        score: (p.trigger_context ? contextOverlap(current_context, p.trigger_context) : 0) * 0.6
              + (p.frequency / Math.max(...this.patterns.map(x => x.frequency))) * 0.4,
      }))
      .sort((a, b) => b.score - a.score);

    const topRisk = scored.filter(s => s.score > 0.2);
    if (!topRisk.length) {
      return { alert: false, risk_level: 'low', likely_bug_types: [], reason: 'Context does not match your personal bug-trigger patterns.', suggestion: 'Proceed with normal code review.' };
    }

    const likely_bug_types = topRisk.slice(0, 3).map(s => s.p.bug_type);
    const topScore = topRisk[0].score;
    const risk_level: BugWarnResult['risk_level'] = topScore >= 0.6 ? 'high' : topScore >= 0.4 ? 'medium' : 'low';

    return {
      alert: true,
      risk_level,
      likely_bug_types,
      reason: `Context matches triggers for: ${likely_bug_types.join(', ')}`,
      suggestion: `Double-check for ${likely_bug_types[0]} — you have written this bug ${topRisk[0].p.frequency} time(s) before.`,
    };
  }

  /** profile: view your personal bug fingerprint */
  profile(): { bug_fingerprint: BugPattern[]; total_patterns: number } {
    return {
      bug_fingerprint: [...this.patterns].sort((a, b) => b.frequency - a.frequency),
      total_patterns: this.patterns.length,
    };
  }
}
