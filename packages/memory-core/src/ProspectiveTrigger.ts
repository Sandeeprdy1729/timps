// ── @timps/memory-core — L17: ProspectiveTrigger ──
// "When X happens, surface Y." Registers triggers that fire when a context
// matches a condition, surfacing the associated memory or action.
// Solves the "prospective memory failure" bottleneck.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateId } from './storage.js';

export interface Trigger {
  id: string;
  when: string;
  surface: string;
  memoryId: string;
  createdAt: number;
  lastFired?: number;
  fireCount: number;
  enabled: boolean;
}

export interface TriggerMatch {
  memoryId: string;
  reason: string;
  triggerId: string;
}

export class ProspectiveTrigger {
  private triggers: Trigger[] = [];
  private filePath: string;

  constructor(private dir: string) {
    this.filePath = path.join(dir, 'prospective-triggers.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        this.triggers = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch { this.triggers = []; }
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.triggers, null, 2), 'utf-8');
  }

  register(input: { when: string; surface: string; memoryId: string }): Trigger {
    const trigger: Trigger = {
      id: generateId('trg'),
      when: input.when,
      surface: input.surface,
      memoryId: input.memoryId,
      createdAt: Date.now(),
      fireCount: 0,
      enabled: true,
    };
    this.triggers.push(trigger);
    this.save();
    return trigger;
  }

  evaluate(context: string): TriggerMatch[] {
    const matches: TriggerMatch[] = [];
    const ctxLower = context.toLowerCase();
    for (const t of this.triggers) {
      if (!t.enabled) continue;
      const whenLower = t.when.toLowerCase();
      if (ctxLower.includes(whenLower)) {
        t.lastFired = Date.now();
        t.fireCount++;
        matches.push({
          memoryId: t.memoryId,
          reason: `Trigger "${t.when}" matched context`,
          triggerId: t.id,
        });
      }
    }
    if (matches.length > 0) this.save();
    return matches;
  }

  remove(id: string): boolean {
    const before = this.triggers.length;
    this.triggers = this.triggers.filter(t => t.id !== id);
    if (this.triggers.length < before) { this.save(); return true; }
    return false;
  }

  toggle(id: string, enabled: boolean): boolean {
    const t = this.triggers.find(tr => tr.id === id);
    if (!t) return false;
    t.enabled = enabled;
    this.save();
    return true;
  }

  list(): Trigger[] {
    return [...this.triggers];
  }

  clearFired(): void {
    for (const t of this.triggers) {
      t.fireCount = 0;
    }
    this.save();
  }

  count(): number {
    return this.triggers.length;
  }
}
