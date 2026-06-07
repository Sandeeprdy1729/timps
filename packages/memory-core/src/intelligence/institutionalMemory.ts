// ── Tool: Institutional Memory — preserve departed contributors' knowledge ──
// Tracks who recorded each insight, alerts when a contributor goes dormant,
// and exposes their contributions for the team after they leave.

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Contribution {
  id: string;
  contributor: string;   // canonical name (lowercase)
  kind: 'decision' | 'pattern' | 'incident' | 'quirk' | 'position';
  text: string;
  recorded_at: string;
  last_activity: string;  // last time the contributor was seen in the codebase
}

export interface DepartedContributor {
  name: string;
  days_since_last_seen: number;
  contributions: Contribution[];
  recommendation: string;
}

const DORMANT_DAYS = 90;

export class InstitutionalMemory {
  private file: string;
  private contributions: Contribution[] = [];
  private activity: Map<string, string> = new Map();  // contributor → last ISO date

  constructor(dir: string) {
    this.file = path.join(dir, 'institutional_memory.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.contributions = data.contributions || [];
        this.activity = new Map(Object.entries(data.activity || {}));
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    fs.writeSync(
      fs.openSync(this.file, 'w'),
      JSON.stringify({
        contributions: this.contributions,
        activity: Object.fromEntries(this.activity),
      }, null, 2),
      0,
      'utf-8'
    );
  }

  /** Record a contribution from a person. Updates their last-seen date. */
  record(contributor: string, kind: Contribution['kind'], text: string): Contribution {
    const name = contributor.toLowerCase();
    const now = new Date().toISOString();
    const c: Contribution = {
      id: `im_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      contributor: name,
      kind,
      text,
      recorded_at: now,
      last_activity: this.activity.get(name) || now,
    };
    this.contributions.push(c);
    this.activity.set(name, now);
    if (this.contributions.length > 1000) this.contributions.shift();
    this.save();
    return c;
  }

  /** Mark that a contributor was active on a given date (without adding a contribution). */
  markActive(contributor: string, date?: string): void {
    this.activity.set(contributor.toLowerCase(), date || new Date().toISOString());
    this.save();
  }

  /** List contributors who haven't been seen in DORMANT_DAYS. */
  departed(): DepartedContributor[] {
    const now = Date.now();
    const out: DepartedContributor[] = [];
    for (const [name, lastSeen] of this.activity.entries()) {
      const lastMs = new Date(lastSeen).getTime();
      const daysSince = Math.floor((now - lastMs) / 86400000);
      if (daysSince < DORMANT_DAYS) continue;
      const contribs = this.contributions.filter(c => c.contributor === name);
      if (contribs.length === 0) continue;
      out.push({
        name,
        days_since_last_seen: daysSince,
        contributions: contribs,
        recommendation: contribs.length > 0
          ? `Preserve ${contribs.length} contribution(s) from ${name}. Their decisions, patterns, and quirks are still in the codebase.`
          : `${name} has no recorded contributions.`,
      });
    }
    return out.sort((a, b) => b.days_since_last_seen - a.days_since_last_seen);
  }

  /** All contributions by a specific person (e.g. when they leave). */
  contributionsBy(contributor: string): Contribution[] {
    const name = contributor.toLowerCase();
    return this.contributions.filter(c => c.contributor === name);
  }
}
