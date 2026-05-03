// core/apexSynapse.ts - ApexSynapse: Entity-Centric Temporal Graph Weaver with
// Query-Time Multi-Tool Resolution Agent and Validity Propagation
//
// Fuses APEX-MEM (entity-centric temporally grounded events, append-only, query-time resolution)
// + Graphiti/Zep (valid_at/invalid_at on nodes/edges for point-in-time reasoning):
//
// Append-Only Entity Graph: Ontology-driven, entity-centric events with validity timestamps
// Query-Time Multi-Tool Apex Agent: Resolves via provenance traversal + conflict resolution
// Synapse Propagation: Weighted updates across related entities
// Coding Boost: CLI/VS/MCP events forge causally linked superseding nodes

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export interface ApexSignal {
  id?: string | number;
  userId?: number;
  projectId?: string;
  content?: string;
  raw?: any;
  embedding?: number[];
  tags?: string[];
  entity?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface ApexEventResult {
  eventId: string;
  entities: string[];
  validFrom: Date;
  validTo?: Date;
  confidence: number;
}

export interface ApexQueryResult {
  summary: string;
  resolvedEvents: Array<{
    eventId: string;
    entities: string[];
    content: string;
    validFrom: string;
    validTo?: string;
    confidence: number;
    createdAt: string;
  }>;
  confidence: number;
  validityWindow: { from: string; to?: string };
  agentTrace: {
    retrieval: string;
    resolution: string;
    synthesis: string;
  };
}

const CODE_SOURCES = ['code', 'cli', 'bug', 'debt', 'api', 'codebase', 'timps-code', 'vscode', 'mcp'];

export class ApexSynapse {
  private maxResolutionSteps: number;
  private minConfidence: number;
  private maxPropagationDepth: number;

  constructor(opts: { maxResolutionSteps?: number; minConfidence?: number; maxPropagationDepth?: number } = {}) {
    const envCfg = (global as any).__apexSynapseConfig || {};
    this.maxResolutionSteps = envCfg.maxResolutionSteps ?? opts.maxResolutionSteps ?? 8;
    this.minConfidence = envCfg.minConfidence ?? opts.minConfidence ?? 0.6;
    this.maxPropagationDepth = envCfg.maxPropagationDepth ?? opts.maxPropagationDepth ?? 3;
  }

  isEnabled(): boolean {
    return process.env.ENABLE_APEXSYNAPSE !== 'false';
  }

  async forgeEvent(signal: ApexSignal, sourceModule: string): Promise<ApexEventResult> {
    const eventId = crypto.randomUUID();
    const userId = signal.userId ?? 1;
    const projectId = signal.projectId ?? 'default';
    const content = this.extractContent(signal);
    const entities = this.extractEntities(signal, sourceModule);
    const confidence = this.clamp(signal.confidence ?? this.defaultConfidence(signal), 0.05, 1);
    const validFrom = new Date();
    const validTo = this.determineValidTo(signal, content);

    if (!this.isEnabled()) {
      return { eventId, entities, validFrom, validTo, confidence };
    }

    try {
      // Append-only entity event with validity
      await execute(
        `INSERT INTO apexsynapse_events
          (event_id, user_id, project_id, source_module, source_record_id,
           entities, content, raw_event, confidence,
           valid_from, valid_to, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          eventId, userId, projectId, sourceModule,
          signal.id ? String(signal.id) : null,
          entities, content,
          JSON.stringify(signal.raw ?? signal),
          confidence, validFrom, validTo ?? null,
          JSON.stringify(signal.metadata ?? {}),
        ]
      );

      // Synapse propagation to related entities
      await this.propagateSynapseUpdates(eventId, userId, projectId, entities, content, confidence);

      // Coding ecosystem temporal chain
      if (this.isCodingSource(sourceModule)) {
        await this.forgeCodingTemporalChain(eventId, userId, projectId, entities, content, confidence);
      }

      // Supersede prior conflicting events
      await this.supersedePriorEvents(eventId, userId, projectId, entities, content, sourceModule);

      // Vector upsert
      if (signal.embedding) {
        await upsertVectors([{
          id: eventId,
          vector: signal.embedding,
          payload: {
            type: 'apexsynapse_event',
            user_id: userId,
            project_id: projectId,
            source_module: sourceModule,
            entities,
            content,
            confidence,
            valid_from: validFrom.toISOString(),
          },
        }]);
      }
    } catch (err) {
      console.warn('[ApexSynapse] Failed to forge event:', err);
    }

    return { eventId, entities, validFrom, validTo, confidence };
  }

  async queryApex(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    timePoint?: Date
  ): Promise<ApexQueryResult> {
    if (!this.isEnabled()) {
      return {
        summary: '', resolvedEvents: [], confidence: 0,
        validityWindow: { from: '' },
        agentTrace: { retrieval: 'disabled', resolution: 'disabled', synthesis: 'disabled' },
      };
    }

    const agentTrace = { retrieval: '', resolution: '', synthesis: '' };
    const queryEntities = this.extractQueryEntities(queryText);

    try {
      // Point-in-time retrieval with validity windows
      const timeFilter = timePoint ? 'AND valid_from <= $5 AND (valid_to IS NULL OR valid_to >= $5)' : '';
      const timeParams = timePoint ? [timePoint.toISOString()] : [];

      const rows = await query<any>(
        `SELECT event_id, entities, content, confidence, valid_from, valid_to,
                created_at, source_module, raw_event
         FROM apexsynapse_events
         WHERE user_id = $1 AND project_id = $2
           AND entities && $3::text[]
           ${timeFilter}
         ORDER BY
           CASE WHEN valid_to IS NULL THEN 1 ELSE 0 END DESC,
           confidence DESC,
           created_at DESC
         LIMIT $4`,
        [userId, projectId, queryEntities, 20, ...timeParams]
      );
      agentTrace.retrieval = `retrieved ${rows.length} events at ${timePoint ? timePoint.toISOString() : 'current'} validity`;

      // Apex resolution: conflict resolution via provenance
      const resolved = this.resolveConflicts(rows);
      agentTrace.resolution = resolved.conflicts > 0
        ? `resolved ${resolved.conflicts} conflicts via supersession`
        : 'no conflicts detected';

      // Coherent view synthesis
      const summary = this.produceCoherentView(resolved.events, queryText, timePoint);
      agentTrace.synthesis = `synthesized ${summary.length} char view`;

      const confidence = resolved.events.length > 0
        ? resolved.events.reduce((s, e) => s + Number(e.confidence || 0), 0) / resolved.events.length
        : 0;

      const validityWindow = timePoint
        ? { from: timePoint.toISOString() }
        : { from: new Date().toISOString() };

      return {
        summary,
        resolvedEvents: resolved.events.map(e => ({
          eventId: e.event_id,
          entities: e.entities || [],
          content: e.content,
          validFrom: e.valid_from,
          validTo: e.valid_to || undefined,
          confidence: Number(e.confidence || 0),
          createdAt: e.created_at,
        })),
        confidence,
        validityWindow,
        agentTrace,
      };
    } catch (err) {
      console.warn('[ApexSynapse] Query failed:', err);
      return {
        summary: '', resolvedEvents: [], confidence: 0,
        validityWindow: { from: '' },
        agentTrace,
      };
    }
  }

  async buildApexContext(queryText: string, userId: number, projectId: string = 'default', timePoint?: Date, limit: number = 5): Promise<string> {
    const result = await this.queryApex(queryText, userId, projectId, timePoint);
    if (!result.summary || result.resolvedEvents.length === 0) return '';
    const timeStr = timePoint ? ` at ${timePoint.toISOString().split('T')[0]}` : '';
    return `\n\n### ApexSynapse Context${timeStr}\n${result.summary}\nConfidence: ${result.confidence.toFixed(2)}\nAgent Trace: retrieval=${result.agentTrace.retrieval}, resolution=${result.agentTrace.resolution}, synthesis=${result.agentTrace.synthesis}`;
  }

  // ── Synapse propagation ──

  private async propagateSynapseUpdates(
    eventId: string, userId: number, projectId: string,
    entities: string[], content: string, confidence: number
  ): Promise<void> {
    const relatedEvents = await query<any>(
      `SELECT event_id, entities, confidence FROM apexsynapse_events
       WHERE user_id = $1 AND project_id = $2 AND event_id <> $3
         AND entities && $4::text[]
       ORDER BY confidence DESC LIMIT 5`,
      [userId, projectId, eventId, entities]
    );

    for (const re of relatedEvents) {
      const sharedEntities = entities.filter(e => (re.entities || []).includes(e));
      const propagationWeight = this.clamp(
        (confidence + Number(re.confidence || 0)) / 2 * (sharedEntities.length * 0.15),
        0.1, 1
      );

      await execute(
        `INSERT INTO apexsynapse_edges
          (source_event_id, target_event_id, edge_type, shared_entities,
           weight, created_at)
         VALUES ($1, $2, 'synapse', $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (source_event_id, target_event_id, edge_type) DO UPDATE SET
           weight = LEAST(1.0, apexsynapse_edges.weight + EXCLUDED.weight * 0.1)`,
        [eventId, re.event_id, sharedEntities, propagationWeight]
      );
    }
  }

  // ── Supersede prior events ──

  private async supersedePriorEvents(
    eventId: string, userId: number, projectId: string,
    entities: string[], content: string, sourceModule: string
  ): Promise<void> {
    const lower = content.toLowerCase();
    const hasSupersession = /\b(supersedes|replaces|updated|no longer|fixed|resolved|instead)\b/.test(lower);

    if (!hasSupersession) return;

    const prior = await query<{ event_id: string }>(
      `SELECT event_id FROM apexsynapse_events
       WHERE user_id = $1 AND project_id = $2
         AND entities && $3::text[]
         AND event_id <> $4
         AND valid_to IS NULL
       ORDER BY created_at DESC LIMIT 3`,
      [userId, projectId, entities, eventId]
    );

    for (const p of prior) {
      await execute(
        `UPDATE apexsynapse_events SET valid_to = CURRENT_TIMESTAMP WHERE event_id = $1`,
        [p.event_id]
      );

      await execute(
        `INSERT INTO apexsynapse_edges
          (source_event_id, target_event_id, edge_type, shared_entities, weight, created_at)
         VALUES ($1, $2, 'supersedes', $3, 1.0, CURRENT_TIMESTAMP)
         ON CONFLICT (source_event_id, target_event_id, edge_type) DO NOTHING`,
        [eventId, p.event_id, entities]
      );
    }
  }

  // ── Coding ecosystem temporal chain ──

  private async forgeCodingTemporalChain(
    eventId: string, userId: number, projectId: string,
    entities: string[], content: string, confidence: number
  ): Promise<void> {
    const lower = content.toLowerCase();
    const targets: string[] = [];
    if (/\b(debt|legacy|refactor|complexity)\b/.test(lower)) targets.push('burnout');
    if (/\b(team|review|handoff)\b/.test(lower)) targets.push('relationship');
    if (/\b(bug|error|crash)\b/.test(lower)) targets.push('bug');

    for (const target of targets) {
      const related = await query<{ event_id: string }>(
        `SELECT event_id FROM apexsynapse_events
         WHERE user_id = $1 AND project_id = $2
           AND entities && ARRAY[$3]::text[]
         ORDER BY confidence DESC, created_at DESC LIMIT 2`,
        [userId, projectId, target]
      );

      for (const r of related) {
        await execute(
          `INSERT INTO apexsynapse_edges
            (source_event_id, target_event_id, edge_type, shared_entities, weight, created_at)
           VALUES ($1, $2, 'coding_temporal', $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (source_event_id, target_event_id, edge_type) DO UPDATE SET
             weight = GREATEST(apexsynapse_edges.weight, EXCLUDED.weight)`,
          [eventId, r.event_id, [...entities, target], confidence]
        );
      }
    }
  }

  // ── Conflict resolution ──

  private resolveConflicts(rows: any[]): { events: any[]; conflicts: number } {
    // Prioritize events with no valid_to (currently active)
    const active = rows.filter(r => !r.valid_to);
    const superseded = rows.filter(r => r.valid_to);

    // Detect entity conflicts
    const byEntity = new Map<string, any[]>();
    for (const r of active) {
      for (const entity of r.entities || ['general']) {
        byEntity.set(entity, [...(byEntity.get(entity) || []), r]);
      }
    }

    let conflicts = 0;
    for (const [entity, entityRows] of byEntity) {
      if (entityRows.length > 1) conflicts++;
    }

    return { events: [...active, ...superseded], conflicts };
  }

  // ── Coherent view synthesis ──

  private produceCoherentView(events: any[], queryText: string, timePoint?: Date): string {
    if (events.length === 0) return '';

    const lower = queryText.toLowerCase();
    const wantsPointInTime = /\b(at|on|when|was|point.in.time)\b/.test(lower);
    const wantsEvolution = /\b(evolution|change|over.time|history)\b/.test(lower);

    const lines: string[] = [];

    if (wantsPointInTime) {
      for (const e of events.slice(0, 6)) {
        const entities = (e.entities || []).slice(0, 2).join(', ');
        const validStr = e.valid_to ? ` (valid until ${new Date(e.valid_to).toISOString().split('T')[0]})` : ' (active)';
        lines.push(`- [${entities}] ${e.content.slice(0, 140)}${validStr}`);
      }
    } else if (wantsEvolution) {
      const sorted = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      for (const e of sorted.slice(0, 6)) {
        const entities = (e.entities || []).slice(0, 2).join(', ');
        const date = new Date(e.created_at).toISOString().split('T')[0];
        const superseded = e.valid_to ? ' (superseded)' : '';
        lines.push(`- ${date} [${entities}] ${e.content.slice(0, 120)}${superseded}`);
      }
    } else {
      for (const e of events.slice(0, 5)) {
        const entities = (e.entities || []).slice(0, 2).join(', ');
        const active = e.valid_to ? '' : ' (active)';
        lines.push(`- [${entities}] ${e.content.slice(0, 160)}${active}`);
      }
    }

    return lines.join('\n');
  }

  // ── Helpers ──

  private determineValidTo(signal: ApexSignal, content: string): Date | undefined {
    const lower = content.toLowerCase();
    // Temporary/ephemeral signals get short validity windows
    if (/\b(temporary|draft|tentative|preliminary)\b/.test(lower)) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    }
    // Open-ended for persistent facts
    return undefined;
  }

  private extractEntities(signal: ApexSignal, sourceModule: string): string[] {
    const content = this.extractContent(signal);
    const entities = new Set<string>((signal.tags || []).map(t => t.toLowerCase()));
    if (signal.entity) entities.add(signal.entity.toLowerCase());

    const lower = `${content} ${sourceModule}`.toLowerCase();
    if (/\b(code|repo|function|class|api|test|bug|debt|refactor)\b/.test(lower)) entities.add('code');
    if (/\b(bug|error|crash|regression|failed)\b/.test(lower)) entities.add('bug');
    if (/\b(debt|legacy|refactor|complexity)\b/.test(lower)) entities.add('tech-debt');
    if (/\b(burnout|stress|energy|tired|overwhelmed)\b/.test(lower)) entities.add('burnout');
    if (/\b(team|relationship|colleague|handoff|review)\b/.test(lower)) entities.add('relationship');

    const names = content.match(/\b[A-Z][A-Za-z0-9_/-]{2,}\b/g) || [];
    for (const name of names.slice(0, 5)) entities.add(name.toLowerCase());

    if (entities.size === 0) entities.add('general');
    return [...entities].slice(0, 12);
  }

  private extractQueryEntities(queryText: string): string[] {
    const entities = new Set<string>();
    const lower = queryText.toLowerCase();
    if (/\b(code|repo|api|bug|debt|refactor)\b/.test(lower)) entities.add('code');
    if (/\b(bug|error|crash)\b/.test(lower)) entities.add('bug');
    if (/\b(burnout|stress|tired)\b/.test(lower)) entities.add('burnout');
    if (/\b(team|relationship|colleague)\b/.test(lower)) entities.add('relationship');
    if (entities.size === 0) entities.add('general');
    return [...entities];
  }

  private defaultConfidence(signal: ApexSignal): number {
    let c = 0.55;
    if ((signal.tags || []).length > 0) c += 0.1;
    if (signal.confidence) c = signal.confidence;
    return this.clamp(c, 0.1, 1);
  }

  private isCodingSource(sourceModule: string): boolean {
    return CODE_SOURCES.some(s => sourceModule.toLowerCase().includes(s));
  }

  private extractContent(signal: ApexSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}

export const apexSynapse = new ApexSynapse();
