// ── Tool: Codebase Anthropologist — surfaces cultural norms from stored decisions ──
// "What does this team actually do?" mined from the same data architects use.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';

export interface CulturalNorm {
  norm: string;          // e.g. "uses async/await over .then()"
  frequency: number;     // how many stored decisions support it
  confidence: number;    // 0-1
  evidence: string[];
}

export interface CodebaseCulture {
  norms: CulturalNorm[];
  taboos: string[];      // things that come up often as regrets
  generated_at: string;
  decisions_mined: number;
}

const NORM_PATTERNS: { rx: RegExp; norm: string }[] = [
  { rx: /\b(?:async|await)\b/i, norm: 'uses async/await for asynchronous control flow' },
  { rx: /\b(?:typescript|ts|strict)\b/i, norm: 'TypeScript is the default language' },
  { rx: /\b(?:test|vitest|jest|coverage)\b/i, norm: 'tests are required before merge' },
  { rx: /\b(?:pr|pull request|review)\b/i, norm: 'changes go through pull-request review' },
  { rx: /\b(?:rest|api|restful|endpoint)\b/i, norm: 'HTTP APIs follow RESTful conventions' },
  { rx: /\b(?:postgres|postgresql|psql)\b/i, norm: 'PostgreSQL is the default relational store' },
  { rx: /\b(?:redis|cache)\b/i, norm: 'Redis used for ephemeral state and queues' },
  { rx: /\b(?:docker|compose|container)\b/i, norm: 'services are containerized with Docker' },
  { rx: /\b(?:pnpm|npm workspaces|monorepo)\b/i, norm: 'monorepo-managed dependencies' },
  { rx: /\b(?:ollama|local model|self-host)\b/i, norm: 'local-first where possible' },
  { rx: /\b(?:tailwind|utility class)\b/i, norm: 'utility-first styling on the frontend' },
  { rx: /\b(?:zod|schema|validate)\b/i, norm: 'schemas are the contract between client and server' },
  { rx: /\b(?:react|component|jsx)\b/i, norm: 'React is the default UI framework' },
  { rx: /\b(?:github action|gh action|workflow)\b/i, norm: 'CI runs on GitHub Actions' },
  { rx: /\b(?:sentry|opentelemetry|tracing|observ)\b/i, norm: 'observability is non-negotiable in production' },
];

export class CodebaseAnthropologist {
  private file: string;
  private decisionTexts: string[] = [];
  private _backend?: StorageBackend;

  constructor(dir: string, backend?: StorageBackend) {
    this._backend = backend;
    this.file = path.join(dir, 'culture_decisions.json');
    this.load();
  }

  private load(): void {
    const files = ['positions.json', 'decisions.json', 'architecture_insights.json', 'culture_decisions.json'];
    for (const f of files) {
      if (this._backend) {
        const data = this._backend.read(f);
        if (!data) continue;
        try {
          if (f === 'positions.json' && Array.isArray(data.positions)) {
            for (const p of data.positions) if (p.claim) this.decisionTexts.push(p.claim);
          }
          if (f === 'decisions.json' && Array.isArray(data.decisions)) {
            for (const d of data.decisions) if (d.decision) this.decisionTexts.push(d.decision);
          }
          if (f === 'architecture_insights.json' && Array.isArray(data.insights)) {
            for (const i of data.insights) if (i.description) this.decisionTexts.push(i.description);
          }
          if (f === 'culture_decisions.json' && Array.isArray(data.decisions)) {
            for (const d of data.decisions) if (d.text) this.decisionTexts.push(d.text);
          }
        } catch { /* ignore */ }
      } else {
        const full = path.join(path.dirname(this.file), f);
        if (!fs.existsSync(full)) continue;
        try {
          const data = JSON.parse(fs.readFileSync(full, 'utf-8'));
          if (f === 'positions.json' && Array.isArray(data.positions)) {
            for (const p of data.positions) if (p.claim) this.decisionTexts.push(p.claim);
          }
          if (f === 'decisions.json' && Array.isArray(data.decisions)) {
            for (const d of data.decisions) if (d.decision) this.decisionTexts.push(d.decision);
          }
          if (f === 'architecture_insights.json' && Array.isArray(data.insights)) {
            for (const i of data.insights) if (i.description) this.decisionTexts.push(i.description);
          }
          if (f === 'culture_decisions.json' && Array.isArray(data.decisions)) {
            for (const d of data.decisions) if (d.text) this.decisionTexts.push(d.text);
          }
        } catch { /* ignore */ }
      }
    }
  }

  /** Add a decision text directly (for new observations). */
  observe(text: string): void {
    this.decisionTexts.push(text);
    const data = { decisions: this.decisionTexts.slice(-500) };
    if (this._backend) {
      this._backend.write(path.basename(this.file), data);
    } else {
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /** Surface the cultural norms of the codebase. */
  culture(): CodebaseCulture {
    const counts = new Map<string, { frequency: number; evidence: string[] }>();
    for (const tpl of NORM_PATTERNS) {
      const evidence: string[] = [];
      let frequency = 0;
      for (const d of this.decisionTexts) {
        if (tpl.rx.test(d)) {
          frequency++;
          if (evidence.length < 3) evidence.push(d.slice(0, 120));
        }
      }
      if (frequency > 0) counts.set(tpl.norm, { frequency, evidence });
    }
    const norms: CulturalNorm[] = Array.from(counts.entries())
      .map(([norm, { frequency, evidence }]) => ({
        norm,
        frequency,
        confidence: Math.min(1, frequency / Math.max(3, this.decisionTexts.length / 5)),
        evidence,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    // Taboos: things stored as regrets
    const taboos: string[] = [];
    const regretKey = 'decisions.json';
    if (this._backend) {
      const data = this._backend.read(regretKey);
      if (data) {
        try {
          for (const d of data.decisions || []) {
            if (d.regret_score > 0.6) taboos.push(`${d.decision} (regret ${(d.regret_score * 100).toFixed(0)}%)`);
          }
        } catch { /* ignore */ }
      }
    } else {
      const regretFile = path.join(path.dirname(this.file), 'decisions.json');
      if (fs.existsSync(regretFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(regretFile, 'utf-8'));
          for (const d of data.decisions || []) {
            if (d.regret_score > 0.6) taboos.push(`${d.decision} (regret ${(d.regret_score * 100).toFixed(0)}%)`);
          }
        } catch { /* ignore */ }
      }
    }

    return {
      norms,
      taboos: taboos.slice(0, 5),
      generated_at: new Date().toISOString(),
      decisions_mined: this.decisionTexts.length,
    };
  }
}
