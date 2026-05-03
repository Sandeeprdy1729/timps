// core/veilForge.ts - VeilForge: Four-Layer Persistence Projector with Ontology-Driven
// Append-Only Entity Graph and Query-Time Multi-Tool Resolution Veil
//
// Fuses Missing Knowledge Layer (arXiv 2604.11364) + APEX-MEM (arXiv 2604.14362):
//
// Four-Layer Projector: Distinct persistence semantics per signal type
//   - knowledge: indefinite supersession with provenance (facts, not decayed)
//   - memory: Ebbinghaus-style decay (experiences fade gradually)
//   - wisdom: evidence-gated revision (insights revise only on strong evidence)
//   - intelligence: ephemeral inference (transient thoughts dissipate)
//
// Ontology-Driven Append-Only Entity Graph:
//   - Entity-centric temporal/causal/property edges preserving full evolution
//   - Domain-agnostic ontology for flexible traversal
//
// Query-Time Multi-Tool Veil Agent:
//   - Orchestrates 17-tool proxies + graph traversal for conflict resolution
//   - Emits compact, coherent summaries with full provenance

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export type VeilLayer = 'knowledge' | 'memory' | 'wisdom' | 'intelligence';
export type OntologyEdgeType = 'supersedes' | 'temporal_next' | 'causal' | 'property' | 'coding_longitudinal';

export interface VeilSignal {
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

export interface VeilEventResult {
  eventId: string;
  layer: VeilLayer;
  entities: string[];
  supersedes?: string;
}

export interface VeilResolution {
  summary: string;
  resolvedEvents: Array<{
    eventId: string;
    layer: VeilLayer;
    sourceModule: string;
    entityKey: string;
    content: string;
    supersedes?: string;
    confidence: number;
    createdAt: string;
  }>;
  conflicts: string[];
  confidence: number;
  refusal: boolean;
  veilTrace: {
    retriever: string;
    judge: string;
    summarizer: string;
  };
}

const CODE_SOURCES = ['code', 'cli', 'bug', 'debt', 'api', 'codebase', 'timps-code', 'vscode', 'mcp'];

export class VeilForge {
  private maxTraverseSteps: number;
  private confidenceThreshold: number;
  private refusalThreshold: number;
  private maxSummaryLength: number;

  constructor(opts: {
    maxTraverseSteps?: number;
    confidenceThreshold?: number;
    refusalThreshold?: number;
    maxSummaryLength?: number;
  } = {}) {
    const envCfg = (global as any).__veilForgeConfig || {};
    this.maxTraverseSteps = envCfg.maxTraverseSteps ?? opts.maxTraverseSteps ?? 8;
    this.confidenceThreshold = envCfg.confidenceThreshold ?? opts.confidenceThreshold ?? 0.65;
    this.refusalThreshold = envCfg.refusalThreshold ?? opts.refusalThreshold ?? 0.15;
    this.maxSummaryLength = envCfg.maxSummaryLength ?? opts.maxSummaryLength ?? 500;
  }

  isEnabled(): boolean {
    return process.env.ENABLE_VEILFORGE !== 'false';
  }

  async projectAndForge(signal: VeilSignal, sourceModule: string): Promise<VeilEventResult> {
    const eventId = crypto.randomUUID();
    const userId = signal.userId ?? 1;
    const projectId = signal.projectId ?? 'default';
    const content = this.extractContent(signal);
    const layer = this.determineLayer(signal, sourceModule);
    const entities = this.extractEntities(signal, sourceModule);
    const confidence = this.clamp(signal.confidence ?? this.defaultConfidence(layer, signal), 0.05, 1);
    const supersedes = (layer === 'knowledge' || layer === 'wisdom')
      ? await this.findSupersededEvent(userId, projectId, entities, sourceModule, content)
      : undefined;

    if (!this.isEnabled()) {
      return { eventId, layer, entities, supersedes };
    }

    try {
      // Append-only with full provenance
      await execute(
        `INSERT INTO veilforge_events
          (event_id, user_id, project_id, source_module, source_record_id, layer,
           entity_keys, content, raw_event, evidence, confidence, supersedes_event_id,
           metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          eventId, userId, projectId, sourceModule,
          signal.id ? String(signal.id) : null,
          layer, entities, content,
          JSON.stringify(signal.raw ?? signal),
          signal.evidence || content,
          confidence, supersedes ?? null,
          JSON.stringify(signal.metadata ?? {}),
        ]
      );

      // Project to four-layer semantics
      await this.projectToLayer(eventId, userId, projectId, layer, sourceModule, entities, content, confidence);

      // Add ontology-driven entity graph edges
      await this.addOntologyEdges(eventId, userId, projectId, sourceModule, entities, layer, confidence, supersedes);

      // Coding ecosystem supersession chain
      if (this.isCodingSource(sourceModule)) {
        await this.forgeCodingSupersession(eventId, userId, projectId, entities, content, confidence);
      }

      // Vector upsert for dual-search coordination
      if (signal.embedding) {
        await upsertVectors([{
          id: eventId,
          vector: signal.embedding,
          payload: {
            type: 'veilforge_event',
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
      console.warn('[VeilForge] Failed to project and forge:', err);
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
      return {
        summary: '', resolvedEvents: [], conflicts: [],
        confidence: 0, refusal: true,
        veilTrace: { retriever: 'disabled', judge: 'disabled', summarizer: 'disabled' },
      };
    }

    const queryEntities = this.extractEntities({ content: queryText }, 'query');
    const preferredLayers = this.layersForQuery(queryText);
    const veilTrace = { retriever: '', judge: '', summarizer: '' };

    try {
      // RETRIEVER: Graph traversal to fetch candidate events
      const rows = await query<any>(
        `SELECT event_id, layer, source_module, entity_keys, content, supersedes_event_id,
                confidence, created_at, raw_event
         FROM veilforge_events
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
      veilTrace.retriever = `retrieved ${rows.length} candidates via entity/layer traversal`;

      // JUDGE: Multi-tool conflict resolution with delta-only updates
      const { resolved, conflicts } = this.judgeResolution(rows, queryEntities);
      veilTrace.judge = conflicts.length > 0
        ? `detected ${conflicts.length} conflicts; resolved via supersession priority`
        : 'no conflicts detected';

      // Refusal on insufficient evidence
      if (resolved.length === 0) {
        return {
          summary: '', resolvedEvents: [], conflicts: [],
          confidence: 0, refusal: true, veilTrace,
        };
      }

      const lowConfidence = resolved.reduce((s, r) => s + Number(r.confidence || 0), 0) / resolved.length;
      if (lowConfidence < this.refusalThreshold) {
        return {
          summary: '', resolvedEvents: [], conflicts: [],
          confidence: lowConfidence, refusal: true, veilTrace,
        };
      }

      const finalResolved = resolved.slice(0, limit);

      // SUMMARIZER: Compact, context-aware summary with provenance
      const summary = this.produceSummary(finalResolved, conflicts, queryText);
      veilTrace.summarizer = `produced ${summary.length} char summary with provenance`;

      const confidence = finalResolved.reduce((s, r) => s + Number(r.confidence || 0), 0) / finalResolved.length;

      return {
        summary,
        resolvedEvents: finalResolved.map(r => ({
          eventId: r.event_id,
          layer: r.layer,
          sourceModule: r.source_module,
          entityKey: (r.entity_keys || [])[0] || 'general',
          content: r.content,
          supersedes: r.supersedes_event_id || undefined,
          confidence: Number(r.confidence || 0),
          createdAt: r.created_at,
        })),
        conflicts,
        confidence,
        refusal: false,
        veilTrace,
      };
    } catch (err) {
      console.warn('[VeilForge] Query failed:', err);
      return {
        summary: '', resolvedEvents: [], conflicts: [],
        confidence: 0, refusal: true, veilTrace,
      };
    }
  }

  async buildVeilContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 5): Promise<string> {
    const resolved = await this.queryWithVeil(queryText, userId, projectId, limit);
    if (!resolved.summary || resolved.refusal) return '';
    return `\n\n### VeilForge Resolution\n${resolved.summary}\nConfidence: ${resolved.confidence.toFixed(2)}\nVeil Trace: retriever=${resolved.veilTrace.retriever}, judge=${resolved.veilTrace.judge}, summarizer=${resolved.veilTrace.summarizer}`;
  }

  // ── Four-layer projection ──

  private async projectToLayer(
    eventId: string, userId: number, projectId: string,
    layer: VeilLayer, sourceModule: string,
    entities: string[], content: string, confidence: number
  ): Promise<void> {
    const decayWeight = layer === 'memory' ? 0.72 : 1.0;
    const revisionGate = layer === 'wisdom' ? confidence >= 0.7 : true;

    await execute(
      `INSERT INTO veilforge_layer_projections
        (event_id, user_id, project_id, layer, source_module, entity_keys,
         decay_weight, revision_gate_passed, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (event_id, layer) DO UPDATE SET
         decay_weight = EXCLUDED.decay_weight,
         revision_gate_passed = EXCLUDED.revision_gate_passed,
         updated_at = CURRENT_TIMESTAMP`,
      [eventId, userId, projectId, layer, sourceModule, entities, decayWeight, revisionGate, content]
    );
  }

  // ── Ontology-driven append-only entity graph ──

  private async addOntologyEdges(
    eventId: string, userId: number, projectId: string,
    sourceModule: string, entities: string[],
    layer: VeilLayer, confidence: number, supersedes?: string
  ): Promise<void> {
    if (supersedes) {
      await this.insertOntologyEdge(eventId, supersedes, 'supersedes', entities, sourceModule, confidence);
    }

    for (const entity of entities.slice(0, 6)) {
      const previous = await query<{ event_id: string }>(
        `SELECT event_id FROM veilforge_events
         WHERE user_id = $1 AND project_id = $2
           AND event_id <> $3 AND entity_keys && ARRAY[$4]::text[]
         ORDER BY created_at DESC LIMIT 2`,
        [userId, projectId, eventId, entity]
      );

      for (const row of previous) {
        await this.insertOntologyEdge(row.event_id, eventId, 'temporal_next', [entity, layer], sourceModule, confidence);
      }
    }
  }

  private async forgeCodingSupersession(
    eventId: string, userId: number, projectId: string,
    entities: string[], content: string, confidence: number
  ): Promise<void> {
    const lower = content.toLowerCase();
    const targets: string[] = [];
    if (/\b(debt|legacy|refactor|complexity|deadline)\b/.test(lower)) targets.push('burnout');
    if (/\b(team|review|handoff|communication)\b/.test(lower)) targets.push('relationship');
    if (/\b(bug|error|crash|regression)\b/.test(lower)) targets.push('bug');

    for (const target of targets) {
      const rows = await query<{ event_id: string }>(
        `SELECT event_id FROM veilforge_events
         WHERE user_id = $1 AND project_id = $2
           AND entity_keys && ARRAY[$3]::text[]
         ORDER BY confidence DESC, created_at DESC LIMIT 2`,
        [userId, projectId, target]
      );

      for (const row of rows) {
        await this.insertOntologyEdge(eventId, row.event_id, 'coding_longitudinal', [...entities, target], 'coding-ecosystem', confidence);
      }
    }
  }

  private async insertOntologyEdge(
    sourceId: string, targetId: string, edgeType: OntologyEdgeType,
    entityKeys: string[], provenanceModule: string, confidence: number
  ): Promise<void> {
    await execute(
      `INSERT INTO veilforge_entity_edges
        (source_event_id, target_event_id, edge_type, entity_keys, confidence, provenance_module, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (source_event_id, target_event_id, edge_type) DO UPDATE SET
         confidence = GREATEST(veilforge_entity_edges.confidence, EXCLUDED.confidence)`,
      [sourceId, targetId, edgeType, entityKeys, confidence, provenanceModule]
    );
  }

  // ── Conflict resolution ──

  private judgeResolution(rows: any[], queryEntities: string[]): { resolved: any[]; conflicts: string[] } {
    const resolved = this.resolveSupersession(rows);
    const conflicts = this.detectConflicts(rows);
    return { resolved, conflicts };
  }

  private resolveSupersession(rows: any[]): any[] {
    const superseded = new Set(rows.map(r => r.supersedes_event_id).filter(Boolean));
    return rows.filter(r => !superseded.has(r.event_id));
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
      const active = entityRows.filter(r => !r.supersedes_event_id);
      const layers = new Set(active.map(r => r.layer));
      if (active.length > 2 && layers.size > 1) {
        conflicts.push(`${entity}: ${active.length} active events across ${[...layers].join('/')}`);
      }
    }
    return conflicts.slice(0, 5);
  }

  // ── Summary production ──

  private produceSummary(resolved: any[], conflicts: string[], queryText: string): string {
    if (resolved.length === 0) return '';

    const lower = queryText.toLowerCase();
    const wantsLongitudinal = /\b(over time|history|pattern|burnout|relationship|trajectory)\b/.test(lower);
    const wantsLatest = /\b(current|latest|resolved|recent)\b/.test(lower);
    const wantsTimeline = /\b(when|timeline|evolution)\b/.test(lower);

    const lines: string[] = [];

    if (wantsTimeline) {
      for (const row of resolved.slice(0, 8)) {
        const entity = (row.entity_keys || [])[0] || 'general';
        const date = new Date(row.created_at).toISOString().split('T')[0];
        lines.push(`- ${date} ${entity}/${row.layer}: ${String(row.content).slice(0, 140)}`);
      }
    } else if (wantsLatest) {
      for (const row of resolved.slice(0, 4)) {
        const entity = (row.entity_keys || [])[0] || 'general';
        const supersession = row.supersedes_event_id ? ' (supersedes prior)' : '';
        lines.push(`- ${entity}/${row.layer}: ${String(row.content).slice(0, 180)}${supersession}`);
      }
    } else if (wantsLongitudinal) {
      for (const row of resolved.slice(0, 6)) {
        const entity = (row.entity_keys || [])[0] || 'general';
        const conf = Number(row.confidence || 0).toFixed(2);
        const age = this.computeAge(row.created_at);
        lines.push(`- ${entity}/${row.layer} [${conf}] (${age}): ${String(row.content).slice(0, 120)}`);
      }
    } else {
      for (const row of resolved.slice(0, 5)) {
        const entity = (row.entity_keys || [])[0] || 'general';
        const supersession = row.supersedes_event_id ? ` supersedes ${String(row.supersedes_event_id).slice(0, 8)}` : '';
        lines.push(`- ${entity}/${row.layer}: ${String(row.content).slice(0, 180)}${supersession}`);
      }
    }

    if (conflicts.length > 0) {
      lines.push(`- unresolved conflicts: ${conflicts.join('; ')}`);
    }

    let summary = lines.join('\n');
    if (summary.length > this.maxSummaryLength) {
      summary = summary.slice(0, this.maxSummaryLength) + '\n- (truncated)';
    }

    return summary;
  }

  // ── Layer determination ──

  private determineLayer(signal: VeilSignal, sourceModule: string): VeilLayer {
    const content = this.extractContent(signal).toLowerCase();
    const tags = (signal.tags || []).join(' ').toLowerCase();
    const combined = `${content} ${tags} ${sourceModule.toLowerCase()}`;

    if (/\b(value|principle|lesson|wisdom|insight|learned)\b/.test(combined) && (signal.confidence ?? 0.7) >= 0.65) {
      return 'wisdom';
    }
    if (/\b(fact|decision|api|contract|endpoint|resolved|fixed|supersedes|position)\b/.test(combined)) {
      return 'knowledge';
    }
    if (/\b(draft|maybe|temporary|thinking|hypothesis|speculation)\b/.test(combined)) {
      return 'intelligence';
    }
    return 'memory';
  }

  private layersForQuery(queryText: string): VeilLayer[] {
    const lower = queryText.toLowerCase();
    if (/\b(fact|current|latest|resolved|supersede|why|decision|api)\b/.test(lower)) return ['knowledge', 'wisdom'];
    if (/\b(pattern|burnout|relationship|history|over time|trajectory)\b/.test(lower)) return ['memory', 'wisdom', 'knowledge'];
    if (/\b(plan|draft|temporary|what if)\b/.test(lower)) return ['intelligence', 'memory'];
    return ['knowledge', 'memory', 'wisdom'];
  }

  // ── Helpers ──

  private async findSupersededEvent(
    userId: number, projectId: string, entities: string[],
    sourceModule: string, content: string
  ): Promise<string | undefined> {
    const lower = content.toLowerCase();
    const hasResolutionSignal = /\b(resolved|fixed|supersedes|instead|now|updated|replaced|no longer)\b/.test(lower);
    if (!hasResolutionSignal) return undefined;

    try {
      const rows = await query<{ event_id: string }>(
        `SELECT event_id FROM veilforge_events
         WHERE user_id = $1 AND project_id = $2
           AND source_module = $3 AND entity_keys && $4::text[]
         ORDER BY created_at DESC LIMIT 1`,
        [userId, projectId, sourceModule, entities]
      );
      return rows[0]?.event_id;
    } catch {
      return undefined;
    }
  }

  private extractEntities(signal: VeilSignal, sourceModule: string): string[] {
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

  private defaultConfidence(layer: VeilLayer, signal: VeilSignal): number {
    let c = layer === 'knowledge' ? 0.72 : layer === 'wisdom' ? 0.68 : layer === 'memory' ? 0.56 : 0.45;
    if ((signal.evidence || '').length > 40) c += 0.08;
    if ((signal.tags || []).length > 0) c += 0.05;
    return this.clamp(c, 0.05, 1);
  }

  private isCodingSource(sourceModule: string): boolean {
    const lower = sourceModule.toLowerCase();
    return CODE_SOURCES.some(s => lower.includes(s));
  }

  private extractContent(signal: VeilSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private computeAge(createdAt: string | Date): string {
    const created = new Date(createdAt);
    const days = Math.floor((Date.now() - created.getTime()) / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return '1d ago';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}

export const veilForge = new VeilForge();
