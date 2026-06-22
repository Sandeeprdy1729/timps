// ── Tool 25: SchemaInferrer ──
// Auto-extracts typed schemas from the episode and semantic stream.
// Identifies recurring patterns, structures, and templates
// that can be used to organize future memory entries.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';

export interface InferredSchema {
  type: string;
  schema: Record<string, string>;
  exampleCount: number;
  firstSeen: number;
  lastSeen: number;
  confidence: number;
}

export interface SchemaInferenceResult {
  schemas: InferredSchema[];
  totalEntriesAnalyzed: number;
}

export class SchemaInferrer {
  private _backend?: StorageBackend;

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
  }

  infer(): SchemaInferenceResult {
    const episodes = this.loadEpisodes();
    const semantic = this.loadSemantic();
    const allEntries = [...episodes, ...semantic];
    const totalEntriesAnalyzed = allEntries.length;

    if (totalEntriesAnalyzed === 0) return { schemas: [], totalEntriesAnalyzed: 0 };

    const patternCounts = new Map<string, { count: number; firstSeen: number; lastSeen: number; example: string }>();

    for (const entry of allEntries) {
      const content = (entry.content ?? entry.summary ?? '').toLowerCase();
      const words = content.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 3);
      if (words.length < 3) continue;

      const key = words.slice(0, 5).join(' ');
      const existing = patternCounts.get(key);
      if (existing) {
        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, entry.timestamp ?? Date.now());
      } else {
        patternCounts.set(key, {
          count: 1,
          firstSeen: entry.timestamp ?? Date.now(),
          lastSeen: entry.timestamp ?? Date.now(),
          example: (entry.content ?? entry.summary ?? '').slice(0, 120),
        });
      }
    }

    const schemas: InferredSchema[] = [];
    for (const [pattern, info] of patternCounts) {
      if (info.count < 2) continue;
      const words = pattern.split(' ');
      const fields: Record<string, string> = {};
      for (let i = 0; i < words.length; i++) {
        fields[`field_${i}`] = words[i];
      }
      schemas.push({
        type: `pattern_${crypto.randomBytes(3).toString('hex')}`,
        schema: fields,
        exampleCount: info.count,
        firstSeen: info.firstSeen,
        lastSeen: info.lastSeen,
        confidence: Math.min(1, info.count * 0.1),
      });
    }

    schemas.sort((a, b) => b.exampleCount - a.exampleCount);

    return { schemas: schemas.slice(0, 20), totalEntriesAnalyzed };
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
}
