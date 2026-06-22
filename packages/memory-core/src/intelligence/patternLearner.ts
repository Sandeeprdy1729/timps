// ── Pattern Learner — general-purpose pattern storage with dedup ──
// Used by MemoryEngine.learnPattern() to accumulate discovered patterns.

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

export interface LearnedPattern {
  id: string;
  content: string;
  tags: string[];
  observed_count: number;
  last_seen: string;
}

export class PatternLearner {
  private file: string;
  private patterns: LearnedPattern[] = [];
  private readonly DEDUP_THRESHOLD = 0.8;
  private _backend?: StorageBackend;

  constructor(dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.file = path.join(dir, 'learned_patterns.json');
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

  /** Store an observation — deduplicates by Jaccard similarity */
  learn(content: string, tags: string[] = []): LearnedPattern | null {
    if (!content.trim()) return null;
    const existing = this.patterns.find(p => jaccard(p.content, content) >= this.DEDUP_THRESHOLD);
    if (existing) {
      existing.observed_count++;
      existing.last_seen = new Date().toISOString();
      for (const t of tags) if (!existing.tags.includes(t)) existing.tags.push(t);
      this.save();
      return existing;
    }
    const pat: LearnedPattern = {
      id: `lp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      content: content.trim(),
      tags: ['learned', ...tags],
      observed_count: 1,
      last_seen: new Date().toISOString(),
    };
    this.patterns.push(pat);
    if (this.patterns.length > 500) this.patterns.shift();
    this.save();
    return pat;
  }

  /** Get all patterns, optionally filtered by tag */
  getAll(tag?: string): LearnedPattern[] {
    const all = tag ? this.patterns.filter(p => p.tags.includes(tag)) : this.patterns;
    return [...all].sort((a, b) => b.observed_count - a.observed_count);
  }
}
