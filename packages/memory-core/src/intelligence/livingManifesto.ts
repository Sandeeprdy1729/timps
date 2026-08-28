// ── Tool: Living Manifesto — derive actual values from behavioral patterns ──
// Mines stored decisions, regrets, and contradictions to surface what you actually do,
// not what you say you do.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';

export interface ValueSignal {
  value: string;             // e.g. "shipping speed over perfection"
  evidence: string[];        // 2-3 concrete past decisions that demonstrate it
  strength: number;          // 0-1, frequency-weighted
}

export interface ManifestoReport {
  values: ValueSignal[];
  anti_patterns: string[];   // things you keep doing despite claiming otherwise
  generated_at: string;
  decisions_analyzed: number;
}

const VALUE_TEMPLATES: { keywords: RegExp; value: string }[] = [
  { keywords: /\b(?:ship|release|deploy|launch|merge)\b/i, value: 'shipping speed over perfection' },
  { keywords: /\b(?:test|coverage|spec|tDD)\b/i, value: 'tests as documentation' },
  { keywords: /\b(?:simple|kiss|minimal|less|small|reduce)\b/i, value: 'simplicity over abstraction' },
  { keywords: /\b(?:typescript|strict|typed|types)\b/i, value: 'type safety as a first-class concern' },
  { keywords: /\b(?:ollama|local|self.host|selfhost)\b/i, value: 'local-first tooling' },
  { keywords: /\b(?:docs|readme|document|comment)\b/i, value: 'written context over tribal knowledge' },
  { keywords: /\b(?:postgres|sql|relational)\b/i, value: 'relational data by default' },
  { keywords: /\b(?:redis|queue|worker|async)\b/i, value: 'async-by-default for side effects' },
  { keywords: /\b(?:tailwind|utility|css)\b/i, value: 'utility-first styling' },
  { keywords: /\b(?:rest|api|restful|endpoint)\b/i, value: 'REST over GraphQL for HTTP APIs' },
  { keywords: /\b(?:vitest|jest|test runner)\b/i, value: 'fast test feedback' },
  { keywords: /\b(?:pnpm|npm|yarn|monorepo)\b/i, value: 'monorepo-aware dependency management' },
];

const STATED_VS_ACTUAL = [
  { stated: 'always write tests first', actualSign: /\b(?:ship|deploy|release)\b/i, anti: 'writes tests after shipping under deadline pressure' },
  { stated: 'document everything', actualSign: /\b(?:ship|fast|quick)\b/i, anti: 'skips docs when shipping fast' },
  { stated: 'keep it simple', actualSign: /\b(?:abstract|pattern|framework|library)\b/i, anti: 'over-abstracts when uncertain' },
];

export class LivingManifesto {
  private file: string;
  private decisions: { text: string; source: 'contradiction' | 'regret' | 'decision'; created_at: string }[] = [];
  private _backend?: StorageBackend;

  constructor(dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.file = path.join(dir, 'manifesto_signals.json');
    this.load();
  }

  private load(): void {
    try {
      // Mine from the other tools' data — this is the "values from behavior" trick
      const candidates = ['positions.json', 'decisions.json', 'manifesto_signals.json'];
      const out: typeof this.decisions = [];
      if (this._backend) {
        for (const f of candidates) {
          const data = this._backend.read(f);
          if (!data) continue;
          if (f === 'positions.json' && Array.isArray(data.positions)) {
            for (const p of data.positions) {
              if (p.claim) out.push({ text: p.claim, source: 'contradiction', created_at: p.stored_at || new Date().toISOString() });
            }
          }
          if (f === 'decisions.json' && Array.isArray(data.decisions)) {
            for (const d of data.decisions) {
              if (d.decision) out.push({ text: d.decision, source: 'decision', created_at: d.created_at || new Date().toISOString() });
            }
          }
          if (f === 'manifesto_signals.json' && Array.isArray(data.signals)) {
            for (const s of data.signals) {
              if (s.text) out.push({ text: s.text, source: 'decision', created_at: s.created_at || new Date().toISOString() });
            }
          }
        }
      } else {
        for (const f of candidates) {
          const full = path.join(path.dirname(this.file), f);
          if (fs.existsSync(full)) {
            const data = JSON.parse(fs.readFileSync(full, 'utf-8'));
            if (f === 'positions.json' && Array.isArray(data.positions)) {
              for (const p of data.positions) {
                if (p.claim) out.push({ text: p.claim, source: 'contradiction', created_at: p.stored_at || new Date().toISOString() });
              }
            }
            if (f === 'decisions.json' && Array.isArray(data.decisions)) {
              for (const d of data.decisions) {
                if (d.decision) out.push({ text: d.decision, source: 'decision', created_at: d.created_at || new Date().toISOString() });
              }
            }
            if (f === 'manifesto_signals.json' && Array.isArray(data.signals)) {
              for (const s of data.signals) {
                if (s.text) out.push({ text: s.text, source: 'decision', created_at: s.created_at || new Date().toISOString() });
              }
            }
          }
        }
      }
      this.decisions = out;
    } catch { /* ignore */ }
  }

  /** Ingest a behavior signal directly (for explicit logging). */
  ingest(text: string): void {
    this.decisions.push({ text, source: 'decision', created_at: new Date().toISOString() });
    const data = { signals: this.decisions.slice(-500) };
    if (this._backend) {
      this._backend.write(path.basename(this.file), data);
    } else {
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /** Generate the manifesto from observed behavior. */
  generate(): ManifestoReport {
    const counts = new Map<string, { hits: number; evidence: string[] }>();
    for (const tpl of VALUE_TEMPLATES) {
      const evidence: string[] = [];
      let hits = 0;
      for (const d of this.decisions) {
        if (tpl.keywords.test(d.text)) {
          hits++;
          if (evidence.length < 3) evidence.push(d.text.slice(0, 120));
        }
      }
      if (hits > 0) counts.set(tpl.value, { hits, evidence });
    }
    const values: ValueSignal[] = Array.from(counts.entries())
      .map(([value, { hits, evidence }]) => ({
        value,
        evidence,
        strength: Math.min(1, hits / Math.max(3, this.decisions.length / 4)),
      }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 8);

    const anti_patterns: string[] = [];
    for (const { stated, actualSign, anti } of STATED_VS_ACTUAL) {
      const hasStated = this.decisions.some(d => d.text.toLowerCase().includes(stated));
      const hasActual = this.decisions.some(d => actualSign.test(d.text));
      if (hasActual && !hasStated) anti_patterns.push(`${anti} (stated: "${stated}")`);
    }

    return {
      values,
      anti_patterns,
      generated_at: new Date().toISOString(),
      decisions_analyzed: this.decisions.length,
    };
  }
}
