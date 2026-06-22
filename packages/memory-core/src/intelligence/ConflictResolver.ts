// ── Tool 21: ConflictResolver ──
// Given two memories that may contradict, determines whether they are
// actually contradictory, which is more reliable, and what action to take.
// Never silently overwrites — defaults to keep-both.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';

export interface MemoryRef {
  id: string;
  content: string;
  timestamp: number;
  confidence: number;
  layer: string;
}

export interface ConflictResolution {
  conflict: boolean;
  action: 'keep-both' | 'supersede' | 'ask-user';
  reason: string;
  moreReliable: string | null;
  similarity: number;
}

const NEGATORS = /\b(not|never|don't|doesn't|shouldn't|avoid|stop|remove|disable|reject|bad|wrong|false)\b/i;
const AFFIRMERS = /\b(should|must|always|use|enable|add|good|best|true|correct|do|allow|prefer)\b/i;

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

function sentimentConflict(a: string, b: string): boolean {
  const aNeg = NEGATORS.test(a);
  const bNeg = NEGATORS.test(b);
  const aAff = AFFIRMERS.test(a);
  const bAff = AFFIRMERS.test(b);
  return (aNeg && bAff) || (aAff && bNeg);
}

export class ConflictResolver {
  private file: string;
  private resolutions: ConflictResolution[] = [];
  private _backend?: StorageBackend;

  constructor(private dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.file = path.join(dir, 'conflict-resolutions.json');
    this.load();
  }

  private load(): void {
    try {
      if (this._backend) {
        const data = this._backend.read(path.basename(this.file));
        if (data) this.resolutions = data;
      } else if (fs.existsSync(this.file)) {
        this.resolutions = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      }
    } catch { this.resolutions = []; }
  }

  private save(): void {
    const data = this.resolutions.slice(-200);
    if (this._backend) {
      this._backend.write(path.basename(this.file), data);
    } else {
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  resolve(a: MemoryRef, b: MemoryRef): ConflictResolution {
    const sim = jaccard(a.content, b.content);

    if (sim < 0.2) {
      const result: ConflictResolution = {
        conflict: false,
        action: 'keep-both',
        reason: 'Memories are not semantically related',
        moreReliable: null,
        similarity: sim,
      };
      return result;
    }

    const isConflict = sentimentConflict(a.content, b.content);
    if (!isConflict && sim < 0.6) {
      const result: ConflictResolution = {
        conflict: false,
        action: 'keep-both',
        reason: 'Memories are similar but not contradictory',
        moreReliable: null,
        similarity: sim,
      };
      this.resolutions.push(result);
      this.save();
      return result;
    }

    if (isConflict || sim >= 0.6) {
      const moreReliable = a.confidence > b.confidence ? a.id : b.id;
      const timestamp = a.timestamp > b.timestamp ? a.id : b.id;
      const useNewer = a.timestamp !== b.timestamp;

      const result: ConflictResolution = {
        conflict: true,
        action: useNewer || moreReliable === a.id ? 'supersede' : 'keep-both',
        reason: useNewer
          ? `${moreReliable} is newer (higher confidence when equal)`
          : `${moreReliable} has higher confidence (${Math.max(a.confidence, b.confidence).toFixed(2)} vs ${Math.min(a.confidence, b.confidence).toFixed(2)})`,
        moreReliable,
        similarity: sim,
      };

      if (result.action === 'ask-user' && Math.abs(a.confidence - b.confidence) < 0.1) {
        result.action = 'ask-user';
        result.reason = 'Conflicting memories with similar confidence — user judgment needed';
      }

      this.resolutions.push(result);
      this.save();
      return result;
    }

    return {
      conflict: true,
      action: 'ask-user',
      reason: 'Default: never silently overwrite conflicting memories',
      moreReliable: null,
      similarity: sim,
    };
  }

  getHistory(): ConflictResolution[] {
    return [...this.resolutions];
  }

  clearHistory(): void {
    this.resolutions = [];
    this.save();
  }
}
