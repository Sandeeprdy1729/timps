// ── TIMPS Temporal Versioning ──
// Memory diffs and belief evolution tracking

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getMemoryDir } from '../config/config.js';
import type { MemoryEntry, MemoryDiff } from './types.js';

export class TemporalVersioning {
  private dir: string;
  private versionsFile: string;
  private diffsFile: string;

  constructor(projectPath: string) {
    this.dir = projectPath;
    this.versionsFile = path.join(this.dir, 'versions.json');
    this.diffsFile = path.join(this.dir, 'memory-diffs.json');
  }

  private loadVersions(): Map<string, MemoryEntry[]> {
    try {
      if (!fs.existsSync(this.versionsFile)) return new Map();
      const data = JSON.parse(fs.readFileSync(this.versionsFile, 'utf-8'));
      return new Map(Object.entries(data));
    } catch { return new Map(); }
  }

  private loadDiffs(): MemoryDiff[] {
    try {
      if (!fs.existsSync(this.diffsFile)) return [];
      return JSON.parse(fs.readFileSync(this.diffsFile, 'utf-8'));
    } catch { return []; }
  }

  private saveVersions(versions: Map<string, MemoryEntry[]>): void {
    fs.writeFileSync(this.versionsFile, JSON.stringify(Object.fromEntries(versions), null, 2), 'utf-8');
  }

  private saveDiffs(diffs: MemoryDiff[]): void {
    fs.writeFileSync(this.diffsFile, JSON.stringify(diffs, null, 2), 'utf-8');
  }

  // ── Version Creation ────────────────────────────────────────

  createVersion(entry: MemoryEntry): void {
    const versions = this.loadVersions();
    const existing = versions.get(entry.id) || [];
    existing.push({ ...entry, version: (existing.length > 0 ? (existing[0].version || 0) : 0) + 1, previousVersions: [] });
    versions.set(entry.id, existing);
    this.saveVersions(versions);
  }

  updateWithDiff(
    entryId: string,
    newContent: string,
    trigger: string
  ): { entry: MemoryEntry; diff: MemoryDiff } | null {
    const semanticFile = path.join(this.dir, 'semantic.json');
    let entries: MemoryEntry[] = [];
    try { entries = JSON.parse(fs.readFileSync(semanticFile, 'utf-8')); } catch { return null; }

    const idx = entries.findIndex(e => e.id === entryId);
    if (idx < 0) return null;

    const oldEntry = entries[idx];
    this.createVersion(oldEntry);

    const diff: MemoryDiff = {
      entity: entryId,
      was: oldEntry.content.slice(0, 100),
      now: newContent.slice(0, 100),
      changedAt: Date.now(),
      trigger,
    };

    const diffs = this.loadDiffs();
    diffs.push(diff);
    if (diffs.length > 100) diffs.shift();
    this.saveDiffs(diffs);

    entries[idx] = { ...oldEntry, content: newContent, timestamp: Date.now(), version: (oldEntry.version || 0) + 1, previousVersions: [{ timestamp: oldEntry.timestamp, content: oldEntry.content, trigger }] };
    fs.writeFileSync(semanticFile, JSON.stringify(entries, null, 2), 'utf-8');

    return { entry: entries[idx], diff };
  }

  // ── Belief Timeline ────────────────────────────────────────

  getTimeline(entryId: string): MemoryEntry[] {
    const versions = this.loadVersions();
    return versions.get(entryId) || [];
  }

  getDiffs(entity: string): MemoryDiff[] {
    return this.loadDiffs().filter(d => d.entity === entity);
  }

  getAllDiffs(): MemoryDiff[] {
    return this.loadDiffs();
  }

  // ── Change Summary ─────────────────────────────────────────

  getRecentChanges(days = 7): { entity: string; was: string; now: string; changedAt: number }[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.loadDiffs().filter(d => d.changedAt > cutoff);
  }

  // ── Query Evolution ───────────────────────────────────────

  howDidOpinionChange(entryId: string): string | null {
    const versions = this.loadVersions();
    const history = versions.get(entryId);
    if (!history || history.length < 2) return null;

    const timeline = history.map(v => `(${new Date(v.timestamp).toLocaleDateString()}) ${v.content.slice(0, 60)}`).join(' → ');
    return `Evolution: ${timeline}`;
  }

  getStats(): { totalVersions: number; totalDiffs: number; lastDiff: number | null } {
    const versions = this.loadVersions();
    const diffs = this.loadDiffs();
    const allDiffs = diffs;
    return {
      totalVersions: [...versions.values()].reduce((s, v) => s + v.length, 0),
      totalDiffs: allDiffs.length,
      lastDiff: allDiffs.length > 0 ? allDiffs[allDiffs.length - 1].changedAt : null,
    };
  }
}