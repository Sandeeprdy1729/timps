// ── Tool 12 port: Architecture Drift Detector (from Codebase Anthropologist) ──
// Ported from packages/server/tools/allTools.ts CodebaseAnthropologistTool
// Storage: JSON file instead of Postgres codebase_culture table
// Operations: record_insight, query, culture_report, drift_check

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

export type InsightType = 'architectural_decision' | 'cultural_allergy' | 'workaround' | 'rejected_approach' | 'convention' | 'constraint';

export interface CodebaseInsight {
  id: string;
  project_id: string;
  insight_type: InsightType;
  description: string;
  evidence?: string;
  created_at: string;
}

export interface DriftCheckResult {
  hasDrift: boolean;
  driftedAreas: string[];
  alignedWith: string[];
  explanation: string;
}

export class ArchitectureDriftDetector {
  private file: string;
  private insights: CodebaseInsight[] = [];

  constructor(dir: string) {
    this.file = path.join(dir, 'codebase_culture.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.insights = data.insights || [];
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    fs.writeFileSync(this.file, JSON.stringify({ insights: this.insights }, null, 2), 'utf-8');
  }

  /** record_insight: save a codebase insight */
  recordInsight(insight_type: InsightType, description: string, project_id = 'default', evidence?: string): CodebaseInsight {
    const insight: CodebaseInsight = {
      id: `ci_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      project_id,
      insight_type,
      description,
      evidence,
      created_at: new Date().toISOString(),
    };
    this.insights.push(insight);
    if (this.insights.length > 500) this.insights.shift();
    this.save();
    return insight;
  }

  /** query: find insights matching a question/context */
  query(question: string, project_id = 'default'): CodebaseInsight[] {
    const relevant = this.insights.filter(i => i.project_id === project_id);
    return relevant
      .map(i => ({ i, score: jaccard(question, i.description) + (i.evidence ? jaccard(question, i.evidence) * 0.3 : 0) }))
      .filter(x => x.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(x => x.i);
  }

  /** drift_check: detect if current patterns conflict with stored architectural decisions */
  driftCheck(currentPatterns: string[], project_id = 'default'): DriftCheckResult {
    const archDecisions = this.insights.filter(i =>
      i.project_id === project_id &&
      (i.insight_type === 'architectural_decision' || i.insight_type === 'convention' || i.insight_type === 'constraint')
    );
    const allergies = this.insights.filter(i =>
      i.project_id === project_id && i.insight_type === 'cultural_allergy'
    );

    if (!archDecisions.length && !allergies.length) {
      return { hasDrift: false, driftedAreas: [], alignedWith: [], explanation: 'No codebase culture recorded yet.' };
    }

    const context = currentPatterns.join(' ');
    const driftedAreas: string[] = [];
    const alignedWith: string[] = [];

    // Check allergies: if current patterns resemble something we should avoid
    for (const allergy of allergies) {
      const score = jaccard(context, allergy.description);
      if (score > 0.2) {
        driftedAreas.push(`Matches cultural allergy: "${allergy.description.slice(0, 80)}"`);
      }
    }

    // Check rejected approaches
    const rejected = this.insights.filter(i => i.project_id === project_id && i.insight_type === 'rejected_approach');
    for (const r of rejected) {
      const score = jaccard(context, r.description);
      if (score > 0.25) {
        driftedAreas.push(`Resembles rejected approach: "${r.description.slice(0, 80)}"`);
      }
    }

    // Check alignment with decisions
    for (const dec of archDecisions) {
      const score = jaccard(context, dec.description);
      if (score > 0.15) {
        alignedWith.push(dec.description.slice(0, 60));
      }
    }

    return {
      hasDrift: driftedAreas.length > 0,
      driftedAreas: driftedAreas.slice(0, 5),
      alignedWith: alignedWith.slice(0, 3),
      explanation: driftedAreas.length > 0
        ? `${driftedAreas.length} architectural concern(s) detected.`
        : 'Current patterns align with stored architecture decisions.',
    };
  }

  /** culture_report: full insight list for a project */
  cultureReport(project_id = 'default'): { insights: CodebaseInsight[]; project_id: string; insight_count: number } {
    const relevant = this.insights.filter(i => i.project_id === project_id);
    return { insights: relevant, project_id, insight_count: relevant.length };
  }
}
