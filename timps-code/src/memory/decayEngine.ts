// ── TIMPS Ebbinghaus Decay Engine ──
// Importance-weighted decay with crypt compression

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MemoryEntry, MemoryDiff } from './types.js';

const DEFAULT_HALF_LIFE_DAYS = 30;
const DECAY_THRESHOLD = 0.15;
const CRYPT_FILE = 'crypt.json';

export class DecayEngine {
  private dir: string;
  private semanticFile: string;
  private halfLife: number;

  constructor(projectPath: string, halfLifeDays = DEFAULT_HALF_LIFE_DAYS) {
    this.dir = projectPath;
    this.semanticFile = path.join(this.dir, 'semantic.json');
    this.halfLife = halfLifeDays * 24 * 60 * 60 * 1000;
  }

  private loadEntries(): MemoryEntry[] {
    try {
      if (!fs.existsSync(this.semanticFile)) return [];
      return JSON.parse(fs.readFileSync(this.semanticFile, 'utf-8'));
    } catch { return []; }
  }

  private loadCrypt(): { compressed: MemoryEntry[] } {
    const cryptFile = path.join(this.dir, CRYPT_FILE);
    try {
      if (!fs.existsSync(cryptFile)) return { compressed: [] };
      return JSON.parse(fs.readFileSync(cryptFile, 'utf-8'));
    } catch { return { compressed: [] }; }
  }

  private saveCrypt(compressed: MemoryEntry[]): void {
    const cryptFile = path.join(this.dir, CRYPT_FILE);
    fs.writeFileSync(cryptFile, JSON.stringify({ compressed }, null, 2), 'utf-8');
  }

  private decayFunction(importance: number, lastAccess: number): number {
    const timeSinceAccess = Date.now() - (lastAccess || Date.now());
    const importanceNormalized = importance / 10;
    return importanceNormalized * Math.exp(-timeSinceAccess / this.halfLife);
  }

  score(entry: MemoryEntry): number {
    const importance = entry.importance || 5;
    const lastAccess = entry.lastAccessed || entry.timestamp;
    return this.decayFunction(importance, lastAccess);
  }

  applyDecay(): { archived: number; diffs: MemoryDiff[]; activeCount: number } {
    const entries = this.loadEntries();
    const crypt = this.loadCrypt();
    const active: MemoryEntry[] = [];
    const archived: MemoryEntry[] = [];
    const diffs: MemoryDiff[] = [];

    for (const entry of entries) {
      const recallProb = this.score(entry);

      if (recallProb < DECAY_THRESHOLD) {
        archived.push({
          ...entry,
          content: `${entry.type}: ${entry.content.slice(0, 100)} [archived ${new Date().toISOString()}]`,
        });
        const existing = entries.find(e => e.id === entry.id && e.content !== entry.content);
        if (existing) {
          diffs.push({
            entity: entry.type,
            was: existing.content.slice(0, 50),
            now: entry.content.slice(0, 50),
            changedAt: Date.now(),
            trigger: 'decay_archive',
          });
        }
      } else {
        active.push(entry);
      }
    }

    if (archived.length > 0) {
      fs.writeFileSync(this.semanticFile, JSON.stringify(active, null, 2), 'utf-8');
      this.saveCrypt([...crypt.compressed, ...archived]);
    }

    return { archived: archived.length, diffs, activeCount: active.length };
  }

  access(entryId: string): void {
    const entries = this.loadEntries();
    const idx = entries.findIndex(e => e.id === entryId);
    if (idx >= 0) {
      entries[idx].lastAccessed = Date.now();
      entries[idx].accessCount = (entries[idx].accessCount || 0) + 1;
      entries[idx].importance = Math.min(10, (entries[idx].importance || 5) + 0.1);
      fs.writeFileSync(this.semanticFile, JSON.stringify(entries, null, 2), 'utf-8');
    }
  }

  bumpImportance(entryId: string, delta = 2): void {
    const entries = this.loadEntries();
    const idx = entries.findIndex(e => e.id === entryId);
    if (idx >= 0) {
      entries[idx].importance = Math.min(10, (entries[idx].importance || 5) + delta);
      fs.writeFileSync(this.semanticFile, JSON.stringify(entries, null, 2), 'utf-8');
    }
  }

  reviveFromCrypt(limit = 10): MemoryEntry[] {
    const crypt = this.loadCrypt();
    return crypt.compressed.slice(-limit);
  }

  getStats(): { activeCount: number; archivedCount: number; avgImportance: number } {
    const entries = this.loadEntries();
    const crypt = this.loadCrypt();
    const avgImportance = entries.length > 0
      ? entries.reduce((s, e) => s + (e.importance || 5), 0) / entries.length
      : 0;
    return {
      activeCount: entries.length,
      archivedCount: crypt.compressed.length,
      avgImportance: Math.round(avgImportance * 10) / 10,
    };
  }
}

// LLM-based importance scorer
export class ImportanceScorer {
  private static async scoreWithLLM(content: string, type: string): Promise<number> {
    const typeScores: Record<string, number> = {
      error: 8, decision: 7, architecture: 7, convention: 5,
      pattern: 6, fact: 4, preference: 5, error_lesson: 8,
    };
    const base = typeScores[type] || 5;

    if (content.includes('never') || content.includes('always') || content.includes('critical') || content.includes('bug')) return Math.min(base + 1, 10);
    if (content.includes('deprecated') || content.includes('old') || content.includes('legacy')) return Math.max(base - 1, 2);
    return base;
  }

  static async judge(content: string, type: MemoryEntry['type']): Promise<number> {
    return this.scoreWithLLM(content, type);
  }

  static judgeSync(content: string, type: MemoryEntry['type']): number {
    const typeScores: Record<string, number> = {
      error: 8, decision: 7, architecture: 7, convention: 5,
      pattern: 6, fact: 4, preference: 5, error_lesson: 8,
    };
    const base = typeScores[type] || 5;

    if (content.includes('never') || content.includes('always') || content.includes('critical') || content.includes('bug')) return Math.min(base + 1, 10);
    if (content.includes('deprecated') || content.includes('old') || content.includes('legacy')) return Math.max(base - 1, 2);
    if (content.length > 200) return Math.min(base + 0.5, 10);
    if (content.includes('user') || content.includes('prefer')) return Math.min(base + 0.5, 10);

    return base;
  }
}