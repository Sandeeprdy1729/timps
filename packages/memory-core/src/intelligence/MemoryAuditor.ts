// ── Tool 22: MemoryAuditor ──
// Weekly memory health audit. Scans all stored memories and reports
// counts of weak, contradicted, outdated, and unsourced entries.
// Provides actionable recommendations for memory hygiene.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';

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
  private _backend?: StorageBackend;

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
  }

  async audit(): Promise<AuditReport> {
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
    if (this._backend) {
      const backend = this._backend;
      const provFiles = backend.list('provenance/');
      if (provFiles && Array.isArray(provFiles)) {
        for (const entry of semantic) {
          const hasProv = provFiles.some((f: string) => {
            try {
              const p = backend.read(f);
              return p && (p.parentIds?.includes(entry.id) || p.id === entry.id);
            } catch { return false; }
          });
          if (!hasProv) {
            unsourcedEntries.push({ id: entry.id, content: (entry.content ?? '').slice(0, 100) });
          }
        }
      } else {
        unsourcedEntries.push(...semantic.map(e => ({ id: e.id, content: (e.content ?? '').slice(0, 100) })));
      }
    } else if (fs.existsSync(provDir)) {
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
    const outdated = outdatedEntries.length;
    const unsourced = unsourcedEntries.length;

    // Contradiction scan. The naive double loop is O(n²) and each iteration
    // runs jaccard normalization — a few thousand memories become millions of
    // comparisons. Instead, index entries by their significant tokens (length
    // > 2, matching ConflictResolver's jaccard normalization) and evaluate only
    // pairs that SHARE at least one token. That is exact, not approximate:
    // a pair sharing no token has jaccard 0 (< 0.2) and can never conflict.
    // A single very common token (e.g. "error", "should") would still put every
    // entry in one bucket, so each bucket is capped to its most recent
    // AUDIT_MAX_BUCKET_ENTRIES — conflicts among ancient entries sharing only a
    // stopword-adjacent token are unlikely enough to skip in a health audit.
    // Using ConflictResolver.evaluate (pure) also avoids instantiating a
    // ConflictResolver and writing a conflict-resolutions file per candidate.
    const AUDIT_MAX_BUCKET_ENTRIES = 64;
    let contradicted = 0;
    try {
      const { ConflictResolver } = await import('./ConflictResolver.js');
      const tokenize = (s: string) =>
        new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
      const index = new Map<string, number[]>();
      for (let i = 0; i < semantic.length; i++) {
        const tokens = tokenize(semantic[i].content ?? '');
        for (const t of tokens) {
          const bucket = index.get(t);
          if (bucket) bucket.push(i);
          else index.set(t, [i]);
        }
      }
      const checked = new Set<string>();
      for (const bucket of index.values()) {
        const capped = bucket.slice(-AUDIT_MAX_BUCKET_ENTRIES);
        for (let x = 0; x < capped.length; x++) {
          for (let y = x + 1; y < capped.length; y++) {
            const i = capped[x];
            const j = capped[y];
            const key = i < j ? `${i}:${j}` : `${j}:${i}`;
            if (checked.has(key)) continue;
            checked.add(key);
            const r = ConflictResolver.evaluate(
              { id: semantic[i].id, content: semantic[i].content ?? '', timestamp: semantic[i].timestamp ?? 0, confidence: semantic[i].confidence ?? 0.5, layer: 'L3' },
              { id: semantic[j].id, content: semantic[j].content ?? '', timestamp: semantic[j].timestamp ?? 0, confidence: semantic[j].confidence ?? 0.5, layer: 'L3' },
            );
            if (r.conflict) contradicted++;
          }
        }
      }
    } catch { /* ConflictResolver unavailable */ }

    if (weak > 3) recommendations.push(`${weak} low-confidence memories found — consider re-verifying`);
    if (outdated > 5) recommendations.push(`${outdated} outdated memories (>30 days) — run ConsolidationEngine`);
    if (unsourced > 3) recommendations.push(`${unsourced} unsourced memories — run SourceAttributor`);

    const raw = totalEntries === 0
      ? 100
      : (1 - (weak + outdated + unsourced) / Math.max(1, totalEntries)) * 100;
    const healthScore = Math.max(0, Math.min(100, Math.round(raw)));

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
      if (this._backend) {
        const data = this._backend.read('semantic.json');
        if (data) return Array.isArray(data) ? data : [];
        return [];
      }
      const f = path.join(this.dir, 'semantic.json');
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
    } catch { /* ignore */ }
    return [];
  }

  private loadEpisodes(): any[] {
    try {
      if (this._backend) {
        return this._backend.read('episodes.json') ?? [];
      }
      const f = path.join(this.dir, 'episodes.json');
      if (!fs.existsSync(f)) return [];
      return JSON.parse(fs.readFileSync(f, 'utf-8')) as any[];
    } catch { return []; }
  }
}
