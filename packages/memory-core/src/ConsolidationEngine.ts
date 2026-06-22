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
    const episodicFile = path.join(this.dir, 'episodes.json');
    if (!fs.existsSync(episodicFile)) return { promoted: 0, archived: 0, summary: '' };
    const since = opts.sinceMs ?? Date.now() - 7 * 24 * 60 * 60 * 1000;
    const content = fs.readFileSync(episodicFile, 'utf-8').trim();
    if (!content) return { promoted: 0, archived: 0, summary: '' };
    const recent = JSON.parse(content).filter((e: any) => e.timestamp >= since);

    let promoted = 0;
    let archived = 0;
    const digest: string[] = [];

    for (const entry of recent) {
      for (const rule of this.rules) {
        if (!rule.match(entry)) continue;
        const derived = rule.transform(entry);
        if (!opts.dryRun) {
          if (rule.promote) {
            const semFile = path.join(this.dir, 'semantic.json');
            const sem = fs.existsSync(semFile)
              ? JSON.parse(fs.readFileSync(semFile, 'utf-8'))
              : [];
            sem.push({ ...derived, id: generateId('con'), timestamp: Date.now() });
            fs.writeFileSync(semFile, JSON.stringify(sem, null, 2), 'utf-8');
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

  addRule(rule: ConsolidationRule): void {
    this.rules.push(rule);
  }

  getRules(): ConsolidationRule[] {
    return [...this.rules];
  }
}
