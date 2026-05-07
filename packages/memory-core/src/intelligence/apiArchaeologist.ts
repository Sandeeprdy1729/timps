// ── Tool 11 port: API Archaeologist ──
// Ported from sandeep-ai/tools/allTools.ts APIArchaeologistTool
// Storage: JSON file instead of Postgres api_knowledge table
// Operations: record_quirk, lookup, list — identical to sandeep-ai version

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface APIQuirk {
  id: string;
  api_name: string;
  endpoint?: string;
  discovered_quirk: string;
  severity: 'info' | 'warning' | 'critical';
  discovered_at: string;
}

export interface APILookupResult {
  api: string;
  quirks: APIQuirk[];
  total: number;
}

export class APIArchaeologist {
  private file: string;
  private knowledge: APIQuirk[] = [];

  constructor(dir: string) {
    this.file = path.join(dir, 'api_knowledge.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.knowledge = data.knowledge || [];
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    fs.writeFileSync(this.file, JSON.stringify({ knowledge: this.knowledge }, null, 2), 'utf-8');
  }

  /** record_quirk: save a discovered API quirk to institutional memory */
  recordQuirk(api_name: string, quirk: string, endpoint?: string, severity: APIQuirk['severity'] = 'info'): APIQuirk {
    const q: APIQuirk = {
      id: `aq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      api_name,
      endpoint,
      discovered_quirk: quirk,
      severity,
      discovered_at: new Date().toISOString(),
    };
    this.knowledge.push(q);
    if (this.knowledge.length > 1000) this.knowledge.shift();
    this.save();
    return q;
  }

  /** lookup: search what we know about a specific API */
  lookup(api_name: string): APILookupResult {
    const lower = api_name.toLowerCase();
    const matches = this.knowledge.filter(k => k.api_name.toLowerCase().includes(lower));
    // Sort: critical first, then by date desc
    const sorted = matches.sort((a, b) => {
      const sev = { critical: 2, warning: 1, info: 0 };
      return (sev[b.severity] - sev[a.severity]) || (new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime());
    });
    return { api: api_name, quirks: sorted, total: sorted.length };
  }

  /** list: all known APIs with quirk counts */
  list(): Array<{ api_name: string; quirk_count: number }> {
    const counts: Record<string, number> = {};
    for (const k of this.knowledge) {
      counts[k.api_name] = (counts[k.api_name] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([api_name, quirk_count]) => ({ api_name, quirk_count }))
      .sort((a, b) => b.quirk_count - a.quirk_count);
  }
}
