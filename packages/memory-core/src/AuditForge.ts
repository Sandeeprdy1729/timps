// ── @timps/memory-core — L16: AuditForge ──
// Weekly memory health auditor. Scans all memory layers and produces
// a structured report of weak, contradicted, outdated, and unsourced entries.
// Implements the "memory hygiene" bottleneck.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from './backends/types.js';

export interface AuditSection {
  weak: number;
  contradicted: number;
  outdated: number;
  unsourced: number;
  entries: { id: string; reason: string; confidence: number }[];
}

export interface AuditReport {
  timestamp: number;
  totalEntries: number;
  working: AuditSection;
  episodic: AuditSection;
  semantic: AuditSection;
  suggestions: string[];
  healthScore: number;
}

export class AuditForge {
  private _backend?: StorageBackend;

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
  }

  run(): AuditReport {
    const working = this.auditWorking();
    const episodic = this.auditEpisodic();
    const semantic = this.auditSemantic();
    const totalEntries = working.entries.length + episodic.entries.length + semantic.entries.length;

    const totalWeak = working.weak + episodic.weak + semantic.weak;
    const totalContradicted = working.contradicted + episodic.contradicted + semantic.contradicted;
    const totalOutdated = working.outdated + episodic.outdated + semantic.outdated;
    const totalIssues = totalWeak + totalContradicted + totalOutdated;

    const suggestions: string[] = [];
    if (totalWeak > 5) suggestions.push(`${totalWeak} weak memories found — consider re-verifying with the user`);
    if (totalContradicted > 0) suggestions.push(`${totalContradicted} contradicted memories found — run ConflictResolver`);
    if (totalOutdated > 5) suggestions.push(`${totalOutdated} outdated memories found — run ConsolidationEngine`);
    if (semantic.unsourced > 3) suggestions.push(`${semantic.unsourced} semantic memories lack provenance — run SourceAttributor`);

    const raw = totalEntries === 0
      ? 100
      : (1 - totalIssues / Math.max(1, totalEntries)) * 100;
    const healthScore = Math.max(0, Math.min(100, Math.round(raw)));

    return {
      timestamp: Date.now(),
      totalEntries,
      working,
      episodic,
      semantic,
      suggestions,
      healthScore,
    };
  }

  private auditWorking(): AuditSection {
    const file = path.join(this.dir, 'working.json');
    if (!fs.existsSync(file)) return { weak: 0, contradicted: 0, outdated: 0, unsourced: 0, entries: [] };
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const entries: AuditSection['entries'] = [];
    if (!data.currentGoal) entries.push({ id: 'working', reason: 'No current goal set', confidence: 0 });
    return {
      weak: entries.length,
      contradicted: 0,
      outdated: data.activeFiles?.length > 20 ? 1 : 0,
      unsourced: 0,
      entries,
    };
  }

  private auditEpisodic(): AuditSection {
    const file = path.join(this.dir, 'episodes.json');
    if (!fs.existsSync(file)) return { weak: 0, contradicted: 0, outdated: 0, unsourced: 0, entries: [] };
    const content = fs.readFileSync(file, 'utf-8').trim();
    if (!content) return { weak: 0, contradicted: 0, outdated: 0, unsourced: 0, entries: [] };
    const episodes = JSON.parse(content) as any[];
    const entries: AuditSection['entries'] = [];
    let outdated = 0;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const ep of episodes) {
      if (ep.timestamp < thirtyDaysAgo) outdated++;
    }
    return { weak: 0, contradicted: 0, outdated, unsourced: 0, entries };
  }

  private auditSemantic(): AuditSection {
    const file = path.join(this.dir, 'semantic.json');
    if (!fs.existsSync(file)) return { weak: 0, contradicted: 0, outdated: 0, unsourced: 0, entries: [] };
    const entries: AuditSection['entries'] = [];
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let outdated = 0;
    for (const entry of data) {
      if (entry.timestamp < thirtyDaysAgo) outdated++;
    }
    const provDir = path.join(this.dir, 'provenance');
    const unsourced = Array.isArray(data) ? data.filter((e: any) => {
      if (!fs.existsSync(provDir)) return true;
      const provFiles = fs.readdirSync(provDir);
      return !provFiles.some(f => {
        try {
          const p = JSON.parse(fs.readFileSync(path.join(provDir, f), 'utf-8'));
          return p.parentIds?.includes(e.id);
        } catch { return false; }
      });
    }).length : 0;
    return { weak: 0, contradicted: 0, outdated, unsourced, entries };
  }

  summary(report: AuditReport): string {
    const lines: string[] = [
      `Memory Health Report — ${new Date(report.timestamp).toISOString().slice(0, 10)}`,
      `Health Score: ${report.healthScore}/100`,
      `Total Entries: ${report.totalEntries}`,
      '',
      `Working: ${report.working.weak} weak, ${report.working.outdated} outdated`,
      `Episodic: ${report.episodic.outdated} outdated`,
      `Semantic: ${report.semantic.outdated} outdated, ${report.semantic.unsourced} unsourced`,
      '',
      'Suggestions:',
      ...report.suggestions.map(s => `  • ${s}`),
    ];
    return lines.join('\n');
  }
}
