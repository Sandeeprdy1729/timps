// ── @timps/memory-core — L11: ConsolidationEngine ──
// Sleep-equivalent background consolidation: promotes episodic → semantic,
// archives stale episodes, and generates weekly digests.
// Designed to be called from cron / idle hooks.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateId } from './storage.js';
import type { StorageBackend } from './backends/types.js';

export interface ConsolidationRule {
  name: string;
  match: (entry: any) => boolean;
  transform: (entry: any) => any;
  promote: boolean;
}

export class ConsolidationEngine {
  private _backend?: StorageBackend;

  constructor(private dir: string, private rules: ConsolidationRule[], backend?: StorageBackend) {
    this._backend = backend;
  }

  run(opts: { sinceMs?: number; dryRun?: boolean } = {}): {
    promoted: number;
    archived: number;
    summary: string;
  } {
    const episodes = this._readJSON('episodes.json', []);
    if (!Array.isArray(episodes) || episodes.length === 0) return { promoted: 0, archived: 0, summary: '' };
    const since = opts.sinceMs ?? Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = episodes.filter((e: any) => e.timestamp >= since);

    let promoted = 0;
    let archived = 0;
    const digest: string[] = [];

    for (const entry of recent) {
      for (const rule of this.rules) {
        if (!rule.match(entry)) continue;
        const derived = rule.transform(entry);
        if (!opts.dryRun) {
          if (rule.promote) {
            const sem = this._readJSON('semantic.json', []);
            sem.push({ ...derived, id: generateId('con'), timestamp: Date.now() });
            this._writeJSON('semantic.json', sem);
            promoted++;
          } else {
            archived++;
          }
        }
        digest.push(`[${rule.name}] ${(entry.summary || entry.content || '').slice(0, 60)}`);
      }
    }

    return {
      promoted,
      archived,
      summary: digest.slice(0, 20).join('\n'),
    };
  }

  /** Read a JSON value via the backend when configured, else raw fs. */
  private _readJSON(key: string, fallback: any): any {
    if (this._backend) {
      const v = this._backend.read(key);
      return v === null || v === undefined ? fallback : v;
    }
    const file = path.join(this.dir, key);
    if (!fs.existsSync(file)) return fallback;
    try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
  }

  /** Write a JSON value via the backend when configured, else raw fs. */
  private _writeJSON(key: string, value: any): void {
    if (this._backend) { this._backend.write(key, value); return; }
    fs.writeFileSync(path.join(this.dir, key), JSON.stringify(value, null, 2), 'utf-8');
  }

  addRule(rule: ConsolidationRule): void {
    this.rules.push(rule);
  }

  getRules(): ConsolidationRule[] {
    return [...this.rules];
  }
}
