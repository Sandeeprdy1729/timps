// ── Tool 9 port: Technical Debt Seismograph ──
// Ported from packages/server/tools/allTools.ts TechDebtSeismographTool
// Storage: JSON file instead of Postgres code_incidents table
// Analysis: deterministic keyword matching (no LLM)

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';

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

export interface CodeIncident {
  id: string;
  project_id: string;
  pattern: string;
  incident_type: string;   // e.g. race_condition, null_pointer, memory_leak, timeout
  time_to_debug_hrs?: number;
  occurred_at: string;
}

export interface PatternCheckResult {
  warning: boolean;
  similarity_score: number;
  matching_incident: string | null;
  risk_level: 'low' | 'medium' | 'high';
  message: string;
}

export interface DebtReport {
  incident_summary: Array<{ incident_type: string; count: number; avg_hours: number }>;
  project_id: string;
}

export class TechDebtSeismograph {
  private file: string;
  private incidents: CodeIncident[] = [];
  private _backend?: StorageBackend;

  constructor(dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.file = path.join(dir, 'code_incidents.json');
    this.load();
  }

  private load(): void {
    try {
      if (this._backend) {
        const data = this._backend.read(path.basename(this.file));
        if (data) {
          this.incidents = data.incidents || [];
        }
      } else if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.incidents = data.incidents || [];
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    const data = { incidents: this.incidents };
    if (this._backend) {
      this._backend.write(path.basename(this.file), data);
    } else {
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /** record_incident: log a production incident tied to a code pattern */
  recordIncident(pattern: string, project_id = 'default', incident_type = 'unknown', time_to_debug_hrs?: number): CodeIncident {
    const incident: CodeIncident = {
      id: `ci_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      project_id,
      pattern,
      incident_type,
      time_to_debug_hrs,
      occurred_at: new Date().toISOString(),
    };
    this.incidents.push(incident);
    if (this.incidents.length > 500) this.incidents.shift();
    this.save();
    return incident;
  }

  /** check_pattern: warn if current code pattern matches past incidents */
  checkPattern(pattern: string, project_id = 'default'): PatternCheckResult {
    const relevant = this.incidents.filter(i => i.project_id === project_id);
    if (!relevant.length) {
      return { warning: false, similarity_score: 0, matching_incident: null, risk_level: 'low', message: 'No incident history yet. Record incidents to enable pattern detection.' };
    }

    let best: CodeIncident | undefined;
    let bestScore = 0;

    for (const inc of relevant) {
      const score = jaccard(pattern, inc.pattern) * 0.5 + jaccard(inc.pattern, pattern) * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = inc;
      }
    }

    const risk_level: PatternCheckResult['risk_level'] = bestScore >= 0.5 ? 'high' : bestScore >= 0.3 ? 'medium' : 'low';

    if (best && bestScore > 0.25) {
      return {
        warning: true,
        similarity_score: bestScore,
        matching_incident: best.pattern,
        risk_level,
        message: `Matches past incident (${best.incident_type}): "${best.pattern.slice(0, 100)}"${best.time_to_debug_hrs ? ` — took ${best.time_to_debug_hrs}h to fix` : ''}`,
      };
    }

    return { warning: false, similarity_score: bestScore, matching_incident: null, risk_level: 'low', message: 'No matching incident patterns found.' };
  }

  /** getIncidents: return raw incident list for a project */
  getIncidents(project_id?: string): CodeIncident[] {
    return project_id ? this.incidents.filter(i => i.project_id === project_id) : this.incidents;
  }

  /** report: summarize incidents by type for a project */
  report(project_id = 'default'): DebtReport {
    const relevant = this.incidents.filter(i => i.project_id === project_id);
    const byType: Record<string, { count: number; total_hrs: number }> = {};
    for (const i of relevant) {
      if (!byType[i.incident_type]) byType[i.incident_type] = { count: 0, total_hrs: 0 };
      byType[i.incident_type].count++;
      byType[i.incident_type].total_hrs += i.time_to_debug_hrs ?? 0;
    }
    const incident_summary = Object.entries(byType)
      .map(([incident_type, { count, total_hrs }]) => ({ incident_type, count, avg_hours: count > 0 ? total_hrs / count : 0 }))
      .sort((a, b) => b.count - a.count);
    return { incident_summary, project_id };
  }
}
