// ── @timps/memory-core — L19: ContextVector ──
// Encodes and matches encoding context to improve state-dependent recall.
// When storing, captures context (domain, files, tags, time); when retrieving,
// boosts scores for memories stored in similar contexts.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from './backends/types.js';

export interface ContextProfile {
  id: string;
  domain: string;
  activeFiles: string[];
  tags: string[];
  timeOfDay: number;
  dayOfWeek: number;
  storedAt: number;
}

export interface ContextMatch {
  profileId: string;
  score: number;
  matchedDimensions: string[];
}

export class ContextVector {
  private _backend?: StorageBackend;
  private filePath: string;
  private profiles: ContextProfile[] = [];

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.filePath = path.join(dir, 'context-vectors.json');
    this.load();
  }

  private load(): void {
    try {
      if (this._backend) {
        const data = this._backend.read('context/vectors.json');
        if (data) this.profiles = data;
      } else if (fs.existsSync(this.filePath)) {
        this.profiles = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch { this.profiles = []; }
  }

  private save(): void {
    if (this._backend) {
      this._backend.write('context/vectors.json', this.profiles);
    } else {
      fs.writeFileSync(this.filePath, JSON.stringify(this.profiles, null, 2), 'utf-8');
    }
  }

  capture(input: Omit<ContextProfile, 'id' | 'storedAt'>): ContextProfile {
    const profile: ContextProfile = {
      ...input,
      id: crypto.randomBytes(6).toString('hex'),
      storedAt: Date.now(),
    };
    this.profiles.push(profile);
    if (this.profiles.length > 500) this.profiles = this.profiles.slice(-500);
    this.save();
    return profile;
  }

  match(context: { domain: string; activeFiles?: string[]; tags?: string[] }): ContextMatch[] {
    const now = new Date();
    const currentTimeOfDay = now.getHours() * 60 + now.getMinutes();
    const currentDayOfWeek = now.getDay();

    const scored: ContextMatch[] = [];

    for (const p of this.profiles) {
      let score = 0;
      const matchedDimensions: string[] = [];

      if (p.domain === context.domain) {
        score += 3;
        matchedDimensions.push('domain');
      }

      if (context.activeFiles) {
        const fileOverlap = p.activeFiles.filter(f => context.activeFiles!.includes(f)).length;
        if (fileOverlap > 0) {
          score += Math.min(fileOverlap, 3) * 0.5;
          matchedDimensions.push(`files(${fileOverlap})`);
        }
      }

      if (context.tags) {
        const tagOverlap = p.tags.filter(t => context.tags!.includes(t)).length;
        if (tagOverlap > 0) {
          score += Math.min(tagOverlap, 3) * 0.3;
          matchedDimensions.push(`tags(${tagOverlap})`);
        }
      }

      const timeDiff = Math.abs(p.timeOfDay - currentTimeOfDay);
      if (timeDiff < 60) {
        score += 0.2;
        matchedDimensions.push('time');
      }

      if (p.dayOfWeek === currentDayOfWeek) {
        score += 0.1;
      }

      if (score > 0) {
        scored.push({ profileId: p.id, score, matchedDimensions });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 10);
  }

  prune(maxAgeDays = 90): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const before = this.profiles.length;
    this.profiles = this.profiles.filter(p => p.storedAt >= cutoff);
    this.save();
    return before - this.profiles.length;
  }

  count(): number {
    return this.profiles.length;
  }
}
