// core/chronosVeil.ts - Layered persistence oracle with append-only entity graph
//
// Chronos Veil separates persistence semantics so facts are superseded with
// provenance, experiences decay, wisdom revises only with evidence, and
// intelligence stays ephemeral. Ingestion is append-only; conflict resolution
// happens at query time through a bounded temporal/entity traversal.

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export type PersistenceLayer = 'knowledge' | 'memory' | 'wisdom' | 'intelligence';

export interface ChronosSignal {
  id?: string | number;
  userId?: number;
  projectId?: string;
  content?: string;
  raw?: any;
  embedding?: number[];
  tags?: string[];
  entity?: string;
  confidence?: number;
  evidence?: string;
  metadata?: Record<string, any>;
}

export interface ChronosEventResult {
  eventId: string;
  layer: PersistenceLayer;
  entities: string[];
  supersedes?: string;
}

export interface VeilResolution {
  summary: string;
  resolvedEvents: Array<{
    eventId: string;
    layer: PersistenceLayer;
    sourceModule: string;
    entityKey: string;
    content: string;
    supersedes?: string;
    confidence: number;
    createdAt: string;
  }>;
  conflicts: string[];
  confidence: number;
}

const CODE_SOURCES = ['code', 'cli', 'bug', 'debt', 'api', 'codebase', 'timps-code'];

export class ChronosVeil {
  isEnabled(): boolean {
    return process.env.ENABLE_CHRONOSVEIL !== 'false';
  }

  async ingestEvent(signal: ChronosSignal, sourceModule: string): Promise<ChronosEventResult> {
    const eventId = crypto.randomUUID();
    const userId = signal.userId || 1;
    const projectId = signal.projectId || 'default';
    const content = this.extractContent(signal);
    const layer = this.determineLayer(signal, sourceModule);
    const entities = this.extractEntities(signal, sourceModule);
    const confidence = this.clamp(signal.confidence ?? this.defaultConfidence(layer, signal), 0.05, 1);
    const supersedes = layer === 'knowledge' || layer === 'wisdom'
      ? await this.findSupersededEvent(userId, projectId, entities, sourceModule, content)
      : undefined;

    if (!this.isEnabled()) {
      return { eventId, layer, entities, supersedes };
    }

    try {
      await execute(
        `INSERT INTO chronos_events
          (event_id, user_id, project_id, source_module, source_record_id, layer,
           entity_keys, content, raw_event, evidence, confidence, supersedes_event_id,
           metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          eventId,
          userId,
          projectId,
          sourceModule,
          signal.id ? String(signal.id) : null,
          layer,
          entities,
          content,
          JSON.stringify(signal.raw ?? signal),
          signal.evidence || content,
          confidence,
          supersedes || null,
          JSON.stringify(signal.metadata || {}),
        ]
      );

      await this.projectToLayer(eventId, userId, projectId, layer, sourceModule, entities, content, confidence);
      await this.addEntityGraphEdges(eventId, userId, projectId, sourceModule, entities, layer, confidence, supersedes);

      if (this.isCodingSource(sourceModule)) {
        await this.forgeCodingEntityChain(eventId, userId, projectId, entities, content, confidence);
      }

      if (signal.embedding) {
        await upsertVectors([{
          id: eventId,
          vector: signal.embedding,
          payload: {
            type: 'chronos_event',
            user_id: userId,
            project_id: projectId,
            source_module: sourceModule,
            layer,
            entity_keys: entities,
            content,
            supersedes,
            confidence,
          },
        }]);
      }
    } catch (err) {
      console.warn('[ChronosVeil] Failed to ingest event:', err);
    }

    return { eventId, layer, entities, supersedes };
  }

  async queryWithVeil(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 8
  ): Promise<VeilResolution> {
    if (!this.isEnabled()) {
      return { summary: '', resolvedEvents: [], conflicts: [], confidence: 0 };
    }

    const queryEntities = this.extractEntities({ content: queryText }, 'query');
    const preferredLayers = this.layersForQuery(queryText);

    try {
      const rows = await query<any>(
        `SELECT event_id, layer, source_module, entity_keys, content, supersedes_event_id,
                confidence, created_at
         FROM chronos_events
         WHERE user_id = $1
           AND project_id = $2
           AND (entity_keys && $3::text[] OR layer = ANY($4))
         ORDER BY
           CASE WHEN supersedes_event_id IS NULL THEN 1 ELSE 0 END DESC,
           confidence DESC,
           created_at DESC
         LIMIT $5`,
        [userId, projectId, queryEntities, preferredLayers, limit * 3]
      );

      const resolved = this.resolveSupersession(rows).slice(0, limit);
      const conflicts = this.detectConflicts(rows);
      const confidence = resolved.length
        ? resolved.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / resolved.length
        : 0;

      return {
        summary: this.produceTemporalSummary(resolved, conflicts),
        resolvedEvents: resolved.map(row => ({
          eventId: row.event_id,
          layer: row.layer,
          sourceModule: row.source_module,
          entityKey: (row.entity_keys || [])[0] || 'general',
          content: row.content,
          supersedes: row.supersedes_event_id || undefined,
          confidence: Number(row.confidence || 0),
          createdAt: row.created_at,
        })),
        conflicts,
        confidence,
      };
    } catch {
      return { summary: '', resolvedEvents: [], conflicts: [], confidence: 0 };
    }
  }

  async buildVeilContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 5): Promise<string> {
    const resolved = await this.queryWithVeil(queryText, userId, projectId, limit);
    if (!resolved.summary) return '';

    return `\n\n### Chronos Veil Resolution\n${resolved.summary}\nConfidence: ${resolved.confidence.toFixed(2)}`;
  }

  private async projectToLayer(
    eventId: string,
    userId: number,
    projectId: string,
    layer: PersistenceLayer,
    sourceModule: string,
    entities: string[],
    content: string,
    confidence: number
  ): Promise<void> {
    const decayWeight = layer === 'memory' ? 0.72 : 1.0;
    const revisionGate = layer === 'wisdom' ? confidence >= 0.7 : true;

    await execute(
      `INSERT INTO chronos_layer_projections
        (event_id, user_id, project_id, layer, source_module, entity_keys, decay_weight,
         revision_gate_passed, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (event_id, layer) DO UPDATE SET
         decay_weight = EXCLUDED.decay_weight,
         revision_gate_passed = EXCLUDED.revision_gate_passed,
         updated_at = CURRENT_TIMESTAMP`,
      [eventId, userId, projectId, layer, sourceModule, entities, decayWeight, revisionGate, content]
    );
  }

  private async addEntityGraphEdges(
    eventId: string,
    userId: number,
    projectId: string,
    sourceModule: string,
    entities: string[],
    layer: PersistenceLayer,
    confidence: number,
    supersedes?: string
  ): Promise<void> {
    if (supersedes) {
      await this.insertGraphEdge(eventId, supersedes, 'supersedes', entities, sourceModule, confidence);
    }

    for (const entity of entities.slice(0, 6)) {
      const previous = await query<{ event_id: string }>(
        `SELECT event_id FROM chronos_events
         WHERE user_id = $1
           AND project_id = $2
           AND event_id <> $3
           AND entity_keys && ARRAY[$4]::text[]
         ORDER BY created_at DESC
         LIMIT 2`,
        [userId, projectId, eventId, entity]
      );

      for (const row of previous) {
        await this.insertGraphEdge(row.event_id, eventId, 'temporal_next', [entity, layer], sourceModule, confidence);
      }
    }
  }

  private async forgeCodingEntityChain(
    eventId: string,
    userId: number,
    projectId: string,
    entities: string[],
    content: string,
    confidence: number
  ): Promise<void> {
    const lower = content.toLowerCase();
    const targets: string[] = [];
    if (/\b(debt|legacy|refactor|complexity|deadline)\b/.test(lower)) targets.push('burnout');
    if (/\b(team|review|handoff|communication)\b/.test(lower)) targets.push('relationship');
    if (/\b(bug|error|crash|regression)\b/.test(lower)) targets.push('bug');

    for (const target of targets) {
      const rows = await query<{ event_id: string }>(
        `SELECT event_id FROM chronos_events
         WHERE user_id = $1
           AND project_id = $2
           AND entity_keys && ARRAY[$3]::text[]
         ORDER BY confidence DESC, created_at DESC
         LIMIT 2`,
        [userId, projectId, target]
      );

      for (const row of rows) {
        await this.insertGraphEdge(eventId, row.event_id, 'coding_longitudinal_link', [...entities, target], 'timps-code', confidence);
      }
    }
  }

  private async insertGraphEdge(
    sourceEventId: string,
    targetEventId: string,
    edgeType: string,
    entityKeys: string[],
    provenanceModule: string,
    confidence: number
  ): Promise<void> {
    await execute(
      `INSERT INTO chronos_entity_edges
        (source_event_id, target_event_id, edge_type, entity_keys, confidence, provenance_module, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (source_event_id, target_event_id, edge_type) DO UPDATE SET
         confidence = GREATEST(chronos_entity_edges.confidence, EXCLUDED.confidence)`,
      [sourceEventId, targetEventId, edgeType, entityKeys, confidence, provenanceModule]
    );
  }

  private async findSupersededEvent(
    userId: number,
    projectId: string,
    entities: string[],
    sourceModule: string,
    content: string
  ): Promise<string | undefined> {
    const lower = content.toLowerCase();
    const hasResolutionSignal = /\b(resolved|fixed|supersedes|instead|now|updated|replaced|no longer)\b/.test(lower);
    if (!hasResolutionSignal) return undefined;

    try {
      const rows = await query<{ event_id: string }>(
        `SELECT event_id FROM chronos_events
         WHERE user_id = $1
           AND project_id = $2
           AND source_module = $3
           AND entity_keys && $4::text[]
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, projectId, sourceModule, entities]
      );
      return rows[0]?.event_id;
    } catch {
      return undefined;
    }
  }

  private determineLayer(signal: ChronosSignal, sourceModule: string): PersistenceLayer {
    const content = this.extractContent(signal).toLowerCase();
    const tags = (signal.tags || []).join(' ').toLowerCase();
    const combined = `${content} ${tags} ${sourceModule.toLowerCase()}`;

    if (/\b(value|principle|lesson|wisdom|should remember|insight)\b/.test(combined) && (signal.confidence ?? 0.7) >= 0.65) {
      return 'wisdom';
    }
    if (/\b(fact|decision|api|contract|endpoint|resolved|fixed|supersedes|position)\b/.test(combined)) {
      return 'knowledge';
    }
    if (/\b(draft|maybe|temporary|thinking|plan step|hypothesis)\b/.test(combined)) {
      return 'intelligence';
    }
    return 'memory';
  }

  private layersForQuery(queryText: string): PersistenceLayer[] {
    const lower = queryText.toLowerCase();
    if (/\b(fact|current|latest|resolved|supersede|why|decision|api)\b/.test(lower)) return ['knowledge', 'wisdom'];
    if (/\b(pattern|burnout|relationship|history|over time|trajectory)\b/.test(lower)) return ['memory', 'wisdom', 'knowledge'];
    if (/\b(plan|draft|temporary|what if)\b/.test(lower)) return ['intelligence', 'memory'];
    return ['knowledge', 'memory', 'wisdom'];
  }

  private resolveSupersession(rows: any[]): any[] {
    const superseded = new Set(rows.map(row => row.supersedes_event_id).filter(Boolean));
    return rows.filter(row => !superseded.has(row.event_id));
  }

  private detectConflicts(rows: any[]): string[] {
    const byEntity = new Map<string, any[]>();
    for (const row of rows) {
      for (const entity of row.entity_keys || ['general']) {
        byEntity.set(entity, [...(byEntity.get(entity) || []), row]);
      }
    }

    const conflicts: string[] = [];
    for (const [entity, entityRows] of byEntity) {
      const active = entityRows.filter(row => !row.supersedes_event_id);
      const layers = new Set(active.map(row => row.layer));
      if (active.length > 2 && layers.size > 1) {
        conflicts.push(`${entity}: ${active.length} active events across ${[...layers].join('/')}`);
      }
    }
    return conflicts.slice(0, 5);
  }

  private produceTemporalSummary(rows: any[], conflicts: string[]): string {
    if (rows.length === 0) return '';

    const lines = rows.slice(0, 5).map(row => {
      const entity = (row.entity_keys || [])[0] || 'general';
      const supersession = row.supersedes_event_id ? ` supersedes ${String(row.supersedes_event_id).slice(0, 8)}` : '';
      return `- ${entity}/${row.layer}: ${String(row.content).slice(0, 180)}${supersession}`;
    });

    if (conflicts.length > 0) {
      lines.push(`- unresolved conflicts: ${conflicts.join('; ')}`);
    }

    return lines.join('\n');
  }

  private extractEntities(signal: ChronosSignal, sourceModule: string): string[] {
    const content = this.extractContent(signal);
    const entities = new Set<string>((signal.tags || []).map(tag => tag.toLowerCase()));
    if (signal.entity) entities.add(signal.entity.toLowerCase());

    const lower = `${content} ${sourceModule}`.toLowerCase();
    if (/\b(code|repo|function|class|api|test|bug|debt|refactor)\b/.test(lower)) entities.add('code');
    if (/\b(bug|error|crash|regression|failed)\b/.test(lower)) entities.add('bug');
    if (/\b(debt|legacy|refactor|complexity)\b/.test(lower)) entities.add('tech-debt');
    if (/\b(burnout|stress|energy|tired|overwhelmed)\b/.test(lower)) entities.add('burnout');
    if (/\b(team|relationship|colleague|handoff|review)\b/.test(lower)) entities.add('relationship');

    const names = content.match(/\b[A-Z][A-Za-z0-9_/-]{2,}\b/g) || [];
    for (const name of names.slice(0, 5)) {
      entities.add(name.toLowerCase());
    }

    if (entities.size === 0) entities.add('general');
    return [...entities].slice(0, 12);
  }

  private defaultConfidence(layer: PersistenceLayer, signal: ChronosSignal): number {
    let confidence = layer === 'knowledge' ? 0.72 : layer === 'wisdom' ? 0.68 : layer === 'memory' ? 0.56 : 0.45;
    if ((signal.evidence || '').length > 40) confidence += 0.08;
    if ((signal.tags || []).length > 0) confidence += 0.05;
    return this.clamp(confidence, 0.05, 1);
  }

  private isCodingSource(sourceModule: string): boolean {
    const lower = sourceModule.toLowerCase();
    return CODE_SOURCES.some(source => lower.includes(source));
  }

  private extractContent(signal: ChronosSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export const chronosVeil = new ChronosVeil();
export const aetherForge = chronosVeil;
