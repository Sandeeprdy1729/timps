// ── Tool 7 port: Velocity Tracker (from Skill Shadow) ──
// Ported from packages/server/tools/allTools.ts SkillShadowTool
// Storage: JSON file instead of Postgres workflow_patterns table
// Analysis: frequency + success_rate scoring (no LLM for basic coaching)

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';

function contextOverlap(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const wa = normalize(a);
  const wb = new Set(normalize(b));
  if (wa.length === 0 || wb.size === 0) return 0;
  return wa.filter(w => wb.has(w)).length / wa.length;
}

export interface WorkflowPattern {
  id: string;
  pattern_type: string;   // e.g. breakthrough_strategy, peak_time, stuck_signal, recovery_method
  description: string;
  success_rate: number;   // 0-1
  observed_count: number;
  last_seen: string;
}

export interface CoachResult {
  advice: string;
  relevant_pattern?: string;
  confidence: number;
  action_now: string;
}

export class VelocityTracker {
  private file: string;
  private patterns: WorkflowPattern[] = [];
  private _backend?: StorageBackend;

  constructor(dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.file = path.join(dir, 'workflow_patterns.json');
    this.load();
  }

  private load(): void {
    try {
      if (this._backend) {
        const data = this._backend.read(path.basename(this.file));
        if (data) {
          this.patterns = data.patterns || [];
        }
      } else if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.patterns = data.patterns || [];
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    const data = { patterns: this.patterns };
    if (this._backend) {
      this._backend.write(path.basename(this.file), data);
    } else {
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /** observe: log a work pattern with a success rate */
  observe(pattern_type: string, description: string, success_rate = 0.5): WorkflowPattern {
    const existing = this.patterns.find(p => p.pattern_type === pattern_type && p.description === description);
    if (existing) {
      existing.observed_count++;
      existing.success_rate = (existing.success_rate * (existing.observed_count - 1) + success_rate) / existing.observed_count;
      existing.last_seen = new Date().toISOString();
      this.save();
      return existing;
    }
    const pat: WorkflowPattern = {
      id: `wp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      pattern_type,
      description,
      success_rate,
      observed_count: 1,
      last_seen: new Date().toISOString(),
    };
    this.patterns.push(pat);
    if (this.patterns.length > 300) this.patterns.shift();
    this.save();
    return pat;
  }

  /** coach: get personalized advice for current situation based on your actual patterns */
  coach(current_situation: string): CoachResult {
    if (!this.patterns.length) {
      return { advice: 'No patterns observed yet. Keep using TIMPS and I will learn how you work best.', confidence: 0, action_now: 'Observe more work sessions with observe().' };
    }

    // Find patterns most relevant to current situation, ranked by context overlap + success_rate
    const scored = this.patterns
      .map(p => ({
        p,
        score: contextOverlap(current_situation, p.description) * 0.6 + p.success_rate * 0.4,
      }))
      .sort((a, b) => b.score - a.score)
      .filter(s => s.score > 0.1);

    if (!scored.length) {
      return {
        advice: 'No directly relevant patterns found for your current situation.',
        confidence: 0,
        action_now: 'Try applying your highest success-rate pattern: ' + (this.patterns.sort((a, b) => b.success_rate - a.success_rate)[0]?.description ?? 'none yet'),
      };
    }

    const best = scored[0];
    const highSuccess = this.patterns.filter(p => p.success_rate >= 0.7).slice(0, 3);

    return {
      advice: `Based on your history, "${best.p.description}" (${best.p.pattern_type}) works well in similar situations.`,
      relevant_pattern: best.p.description,
      confidence: Math.min(best.score, 1),
      action_now: highSuccess.length ? `Your top strategies: ${highSuccess.map(p => p.description).join('; ')}` : `Apply your best pattern: ${best.p.description}`,
    };
  }

  /** patterns: view all learned workflow patterns */
  getPatterns(): { patterns: WorkflowPattern[]; total: number } {
    return {
      patterns: [...this.patterns].sort((a, b) => b.success_rate - a.success_rate || b.observed_count - a.observed_count),
      total: this.patterns.length,
    };
  }
}
