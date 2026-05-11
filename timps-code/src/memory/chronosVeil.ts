// ── TIMPS Chronos Veil — Temporal Causal Memory ──
// 4-layer classification: Knowledge → Memory → Wisdom → Intelligence

import * as fs from 'node:fs';
import * as path from 'node:path';

export type ChronosLayer = 'knowledge' | 'memory' | 'wisdom' | 'intelligence';
export type ChronosDomain = 'burnout' | 'relationship' | 'decision' | 'code_pattern' | 'contradiction' | 'goal' | 'general';

export interface ChronosEvent {
  id: string;
  content: string;
  layer: ChronosLayer;
  domain: ChronosDomain;
  sourceModule: string;
  tags: string[];
  entities: string[];
  createdAt: number;
  importance: number;
  activation: number;
  causalPredecessors: string[];
  causalSuccessors: string[];
  supersededBy?: string;
  confidence: number;
  version: number;
  expiresAt?: number;
}

export interface ChronosQueryResult {
  resolvedEvents: ChronosEvent[];
  conflicts: string[];
  confidence: number;
  causalChain: string[];
}

export class ChronosVeil {
  private dir: string;
  private eventsFile: string;
  private causalFile: string;

  constructor(projectPath: string) {
    this.dir = path.join(projectPath, '.timps', 'chronos');
    this.eventsFile = path.join(this.dir, 'events.json');
    this.causalFile = path.join(this.dir, 'causal-edges.json');
    this.ensureDir();
  }

  private ensureDir(): void {
    fs.mkdirSync(this.dir, { recursive: true });
  }

  private loadEvents(): ChronosEvent[] {
    try {
      if (!fs.existsSync(this.eventsFile)) return [];
      return JSON.parse(fs.readFileSync(this.eventsFile, 'utf-8'));
    } catch { return []; }
  }

  private saveEvents(events: ChronosEvent[]): void {
    fs.writeFileSync(this.eventsFile, JSON.stringify(events, null, 2), 'utf-8');
  }

  private loadCausalEdges(): Array<{ from: string; to: string; type: string; weight: number }> {
    try {
      if (!fs.existsSync(this.causalFile)) return [];
      return JSON.parse(fs.readFileSync(this.causalFile, 'utf-8'));
    } catch { return []; }
  }

  private saveCausalEdges(edges: Array<{ from: string; to: string; type: string; weight: number }>): void {
    fs.writeFileSync(this.causalFile, JSON.stringify(edges, null, 2), 'utf-8');
  }

  ingest(content: string, sourceModule: string, tags: string[] = [], entity?: string, domain: ChronosDomain = 'general'): ChronosEvent {
    const events = this.loadEvents();
    const layers = this.classifyLayer(content, tags, domain);

    const newEvent: ChronosEvent = {
      id: `ce_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content: content.slice(0, 2000),
      layer: layers.primaryLayer,
      domain,
      sourceModule,
      tags,
      entities: entity ? [entity, ...this.extractEntities(content)] : this.extractEntities(content),
      createdAt: Date.now(),
      importance: this.assessImportance(content, tags),
      activation: layers.activation,
      causalPredecessors: this.findCausalPredecessors(content, domain),
      causalSuccessors: [],
      confidence: layers.confidence,
      version: 1,
    };

    // Update successor references for predecessor events
    for (const predId of newEvent.causalPredecessors) {
      const pred = events.find(e => e.id === predId);
      if (pred) {
        pred.causalSuccessors.push(newEvent.id);
      }
    }

    events.push(newEvent);
    this.saveEvents(events);

    // Save causal edge
    const causalEdges = this.loadCausalEdges();
    for (const predId of newEvent.causalPredecessors) {
      causalEdges.push({ from: predId, to: newEvent.id, type: 'causal', weight: 1.0 });
    }
    this.saveCausalEdges(causalEdges);

    return newEvent;
  }

  private classifyLayer(content: string, tags: string[], domain: ChronosDomain): { primaryLayer: ChronosLayer; activation: number; confidence: number } {
    const contentLower = content.toLowerCase();

    const isEvidenceGated =
      content.includes('evidence shows') ||
      content.includes('repeatedly') ||
      content.includes('pattern confirmed') ||
      content.includes('consistently') ||
      tags.includes('insight') ||
      tags.includes('wisdom') ||
      domain === 'contradiction';

    const isEphemeral =
      content.includes('draft') ||
      content.includes('thought') ||
      content.includes('wondering') ||
      content.includes('maybe') ||
      tags.includes('draft') ||
      tags.includes('thought');

    const isMemory =
      !isEvidenceGated && !isEphemeral &&
      (content.includes('session') ||
        content.includes('yesterday') ||
        content.includes('remember') ||
        tags.includes('experience'));

    if (isEvidenceGated) {
      return { primaryLayer: 'wisdom', activation: 0.9, confidence: 0.85 };
    }
    if (isEphemeral) {
      return { primaryLayer: 'intelligence', activation: 0.3, confidence: 0.5 };
    }
    if (isMemory || domain === 'burnout' || domain === 'relationship') {
      return { primaryLayer: 'memory', activation: 0.7, confidence: 0.75 };
    }

    return { primaryLayer: 'knowledge', activation: 0.6, confidence: 0.8 };
  }

  private extractEntities(content: string): string[] {
    const entities: string[] = [];
    const patterns = [
      /\b([A-Z][a-z]+(?:\.[a-z]+)*)\b/g,
      /\b([a-z]+(?:[A-Z][a-z]+)+)\b/g,
      /\b([\w-]+(?:\/[\w-]+)+)\b/g,
    ];

    for (const pattern of patterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(content)) !== null) {
        const word = m[1];
        if (word.length > 2 && word.length < 50 && !['The', 'This', 'That', 'When', 'What', 'Where', 'How'].includes(word)) {
          entities.push(word);
        }
      }
    }

    return [...new Set(entities)].slice(0, 10);
  }

  private assessImportance(content: string, tags: string[]): number {
    let score = 5;
    if (content.includes('critical') || content.includes('must') || content.includes('never')) score += 3;
    if (content.includes('architecture') || content.includes('decision')) score += 2;
    if (content.includes('bug') || content.includes('error') || content.includes('incident')) score += 2;
    if (content.includes('deprecated') || content.includes('legacy')) score -= 1;
    if (tags.includes('error')) score += 2;
    if (tags.includes('lesson')) score += 1;
    return Math.max(1, Math.min(10, score));
  }

  private findCausalPredecessors(content: string, domain: ChronosDomain): string[] {
    const events = this.loadEvents();
    const domainEvents = events
      .filter(e => e.domain === domain && e.layer !== 'intelligence')
      .slice(-20);

    const contentTokens = new Set(content.toLowerCase().split(/\W+/));

    return domainEvents
      .filter(e => {
        const eventTokens = new Set(e.content.toLowerCase().split(/\W+/));
        const overlap = [...contentTokens].filter(t => eventTokens.has(t)).length;
        return overlap >= 2;
      })
      .map(e => e.id);
  }

  query(userQuery: string, limit = 8): ChronosQueryResult {
    const events = this.loadEvents();
    const queryLower = userQuery.toLowerCase();
    const queryTokens = new Set(queryLower.split(/\W+/));

    const scored = events.map(event => {
      const eventTokens = new Set(event.content.toLowerCase().split(/\W+/));
      const overlap = [...queryTokens].filter(t => eventTokens.has(t)).length;
      const tokenScore = overlap / Math.max(queryTokens.size, 1);
      const domainScore = event.domain === 'general' ? 0.5 : 1.0;
      const layerScore = event.layer === 'wisdom' ? 1.3 : event.layer === 'knowledge' ? 1.1 : event.layer === 'memory' ? 1.0 : 0.7;
      const activationScore = event.activation / 10;
      const recencyScore = Math.exp(-(Date.now() - event.createdAt) / (30 * 24 * 60 * 60 * 1000));

      return {
        event,
        score: tokenScore * 0.3 + domainScore * 0.2 + layerScore * 0.2 + activationScore * 0.15 + recencyScore * 0.15,
      };
    }).filter(r => r.score > 0.05).sort((a, b) => b.score - a.score);

    const resolved = scored.slice(0, limit).map(r => r.event);
    const conflicts = resolved
      .filter((e, i, arr) => arr.findIndex(x => x.id !== e.id && x.layer === e.layer && this.isContradiction(e.content, x.content)) !== -1)
      .map(e => e.id);

    const causalChain = this.buildCausalChain(resolved);

    return {
      resolvedEvents: resolved,
      conflicts: [...new Set(conflicts)],
      confidence: scored.length > 0 ? scored[0].score : 0,
      causalChain,
    };
  }

  private isContradiction(a: string, b: string): boolean {
    const negations = ['not', 'never', 'no', "don't", "won't", "can't", "doesn't"];
    const aNeg = negations.some(n => a.toLowerCase().includes(n));
    const bNeg = negations.some(n => b.toLowerCase().includes(n));
    if (aNeg !== bNeg) {
      const aCore = a.toLowerCase().replace(/not|never|no|don't|won't|can't|doesn't/gi, '').trim();
      const bCore = b.toLowerCase().replace(/not|never|no|don't|won't|can't|doesn't/gi, '').trim();
      if (aCore === bCore) return true;
    }
    return false;
  }

  private buildCausalChain(events: ChronosEvent[]): string[] {
    if (events.length === 0) return [];
    const sorted = [...events].sort((a, b) => a.createdAt - b.createdAt);
    const chain: string[] = [];

    for (const event of sorted) {
      if (chain.length === 0) {
        chain.push(event.id);
      } else {
        const last = events.find(e => e.id === chain[chain.length - 1]);
        if (last && (last.causalSuccessors.includes(event.id) || event.causalPredecessors.includes(last.id))) {
          chain.push(event.id);
        }
      }
    }

    return chain;
  }

  getStats(): { total: number; byLayer: Record<ChronosLayer, number>; byDomain: Record<ChronosDomain, number>; avgImportance: number } {
    const events = this.loadEvents();
    const byLayer: Record<string, number> = { knowledge: 0, memory: 0, wisdom: 0, intelligence: 0 };
    const byDomain: Record<string, number> = { burnout: 0, relationship: 0, decision: 0, code_pattern: 0, contradiction: 0, goal: 0, general: 0 };

    for (const e of events) {
      byLayer[e.layer] = (byLayer[e.layer] || 0) + 1;
      byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
    }

    const avgImportance = events.length > 0
      ? events.reduce((s, e) => s + e.importance, 0) / events.length
      : 0;

    return { total: events.length, byLayer: byLayer as any, byDomain: byDomain as any, avgImportance };
  }

  consolidate(): { consolidated: number; decayed: number } {
    const events = this.loadEvents();
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    let consolidated = 0;
    let decayed = 0;

    const active: ChronosEvent[] = [];
    const forArchive: ChronosEvent[] = [];

    for (const e of events) {
      const age = now - e.createdAt;
      const isExpired = e.expiresAt && now > e.expiresAt;
      const isLowUtility = e.activation < 0.2 && age > THIRTY_DAYS;
      const isSuperseded = e.supersededBy !== undefined;

      if (isExpired || isLowUtility) {
        forArchive.push(e);
        decayed++;
      } else {
        active.push(e);
      }
    }

    if (forArchive.length > 0) {
      const archivePath = path.join(this.dir, `archive_${Date.now()}.json`);
      fs.writeFileSync(archivePath, JSON.stringify(forArchive, null, 2), 'utf-8');
    }

    this.saveEvents(active);
    return { consolidated, decayed };
  }
}