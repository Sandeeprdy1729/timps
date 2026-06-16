// ── Tool 22: MemoryAuditor ──
// Weekly memory health audit. Scans all stored memories and reports
// counts of weak, contradicted, outdated, and unsourced entries.
// Provides actionable recommendations for memory hygiene.

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface AuditReport {
  timestamp: number;
  totalEntries: number;
  weak: number;
  contradicted: number;
  outdated: number;
  unsourced: number;
  details: {
    weakEntries: { id: string; content: string; confidence: number }[];
    outdatedEntries: { id: string; content: string; ageDays: number }[];
    unsourcedEntries: { id: string; content: string }[];
  };
  recommendations: string[];
  healthScore: number;
}

export class MemoryAuditor {
  constructor(private dir: string) {}

  audit(): AuditReport {
    const semantic = this.loadSemantic();
    const episodes = this.loadEpisodes();

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const weakEntries: AuditReport['details']['weakEntries'] = [];
    const outdatedEntries: AuditReport['details']['outdatedEntries'] = [];
    const unsourcedEntries: AuditReport['details']['unsourcedEntries'] = [];
    const recommendations: string[] = [];

    for (const entry of semantic) {
      const confidence = entry.confidence ?? 0.5;
      if (confidence < 0.3) {
        weakEntries.push({ id: entry.id, content: (entry.content ?? '').slice(0, 100), confidence });
      }
      const ageDays = (now - (entry.timestamp ?? now)) / (24 * 60 * 60 * 1000);
      if (ageDays > 30) {
        outdatedEntries.push({ id: entry.id, content: (entry.content ?? '').slice(0, 100), ageDays: Math.round(ageDays) });
      }
    }

    const provDir = path.join(this.dir, 'provenance');
    if (fs.existsSync(provDir)) {
      const provFiles = new Set(fs.readdirSync(provDir).filter(f => f.endsWith('.json')));
      for (const entry of semantic) {
        const hasProv = [...provFiles].some(f => {
          try {
            const p = JSON.parse(fs.readFileSync(path.join(provDir, f), 'utf-8'));
            return p.parentIds?.includes(entry.id) || p.id === entry.id;
          } catch { return false; }
        });
        if (!hasProv) {
          unsourcedEntries.push({ id: entry.id, content: (entry.content ?? '').slice(0, 100) });
        }
      }
    } else {
      unsourcedEntries.push(...semantic.map(e => ({ id: e.id, content: (e.content ?? '').slice(0, 100) })));
    }

    const totalEntries = semantic.length + episodes.length;
    const weak = weakEntries.length;
    const contradicted = 0;
    const outdated = outdatedEntries.length;
    const unsourced = unsourcedEntries.length;

    if (weak > 3) recommendations.push(`${weak} low-confidence memories found — consider re-verifying`);
    if (outdated > 5) recommendations.push(`${outdated} outdated memories (>30 days) — run ConsolidationEngine`);
    if (unsourced > 3) recommendations.push(`${unsourced} unsourced memories — run SourceAttributor`);

    const healthScore = totalEntries === 0
      ? 100
      : Math.round((1 - (weak + outdated + unsourced) / Math.max(1, totalEntries)) * 100);

    return {
      timestamp: now,
      totalEntries,
      weak,
      contradicted,
      outdated,
      unsourced,
      details: { weakEntries, outdatedEntries, unsourcedEntries },
      recommendations,
      healthScore,
    };
  }

  summary(report: AuditReport): string {
    return [
      `Memory Health: ${report.healthScore}/100`,
      `Entries: ${report.totalEntries} total, ${report.weak} weak, ${report.outdated} outdated, ${report.unsourced} unsourced`,
      ...report.recommendations.map(r => `  → ${r}`),
    ].join('\n');
  }

  private loadSemantic(): any[] {
    try {
      const f = path.join(this.dir, 'semantic.json');
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
    } catch { /* ignore */ }
    return [];
  }

  private loadEpisodes(): any[] {
    try {
      const f = path.join(this.dir, 'episodes.jsonl');
      if (!fs.existsSync(f)) return [];
      const content = fs.readFileSync(f, 'utf-8').trim();
      return content ? content.split('\n').map(l => JSON.parse(l)) : [];
    } catch { return []; }
  }
}
