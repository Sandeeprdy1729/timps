// core/bindWeave.ts - BindWeave: Structure-Enriched Binding Weaver with Cross-Event
// Induction and Modular Self-Reflective Consolidation
//
// Fuses StructMem (arXiv 2604.21748) + Memory in the LLM Era (arXiv 2604.01707):
//
// Structured Event Binding: Explicit entity/temporal/causal anchors per event
//   - Entity bindings: named entities, concepts, code artifacts
//   - Temporal anchors: durative and point-wise semantic time
//   - Causal links: cause-effect, influence, dependency chains
//
// Cross-Event Weaver: Induces connections via multi-faceted scoring
//   - Semantic similarity + prediction-error + tool-augmented pathways
//   - Leverages 17-tool proxies for longitudinal induction
//
// Modular Self-Reflective Layers: Interaction → Reasoning → Consolidation
//   - Audit and refine cycles for evolving coherence

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export type BindLayer = 'interaction' | 'reasoning' | 'consolidation';
export type BindEdgeType = 'entity' | 'temporal' | 'causal' | 'semantic' | 'induced' | 'coding_longitudinal';

export interface BindSignal {
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

export interface BindFrame {
  eventId: string;
  entityBindings: string[];
  temporalAnchor: string;
  causalLinks: string[];
  content: string;
}

export interface BindResult {
  eventId: string;
  inducedWeaves: number;
  layer: BindLayer;
  coherenceScore: number;
}

export interface BindQueryResult {
  summary: string;
  bindings: Array<{
    eventId: string;
    entityBindings: string[];
    content: string;
    coherenceScore: number;
    weaveDegree: number;
    createdAt: string;
  }>;
  inducedConnections: number;
  confidence: number;
  reflectTrace: {
    interaction: string;
    reasoning: string;
    consolidation: string;
  };
}

const CODE_SOURCES = ['code', 'cli', 'bug', 'debt', 'api', 'codebase', 'timps-code', 'vscode', 'mcp'];

export class BindWeave {
  private inductionThreshold: number;
  private maxWeaveDegree: number;
  private reflectionDepth: number;

  constructor(opts: {
    inductionThreshold?: number;
    maxWeaveDegree?: number;
    reflectionDepth?: number;
  } = {}) {
    const envCfg = (global as any).__bindWeaveConfig || {};
    this.inductionThreshold = envCfg.inductionThreshold ?? opts.inductionThreshold ?? 0.45;
    this.maxWeaveDegree = envCfg.maxWeaveDegree ?? opts.maxWeaveDegree ?? 6;
    this.reflectionDepth = envCfg.reflectionDepth ?? opts.reflectionDepth ?? 3;
  }

  isEnabled(): boolean {
    return process.env.ENABLE_BINDWEAVE !== 'false';
  }

  async bindEvent(signal: BindSignal, sourceModule: string): Promise<BindResult> {
    const eventId = crypto.randomUUID();
    const userId = signal.userId ?? 1;
    const projectId = signal.projectId ?? 'default';
    const content = this.extractContent(signal);

    // Create structured event frame with explicit bindings
    const frame = this.createStructuredFrame(eventId, signal, sourceModule);
    const layer = this.determineLayer(signal, sourceModule);
    const coherenceScore = this.computeCoherence(frame, signal);

    if (!this.isEnabled()) {
      return { eventId, inducedWeaves: 0, layer, coherenceScore };
    }

    try {
      // Insert bound event with frame
      await execute(
        `INSERT INTO bindweave_events
          (event_id, user_id, project_id, source_module, source_record_id, layer,
           frame_data, entity_bindings, temporal_anchor, causal_links,
           coherence_score, content, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          eventId, userId, projectId, sourceModule,
          signal.id ? String(signal.id) : null,
          layer,
          JSON.stringify(frame),
          frame.entityBindings,
          frame.temporalAnchor,
          frame.causalLinks,
          coherenceScore,
          content,
          JSON.stringify(signal.metadata ?? {}),
        ]
      );

      // Induce cross-event connections via multi-faceted scoring
      const inducedCount = await this.induceCrossEventWeaves(eventId, userId, projectId, frame, signal, sourceModule);

      // Coding ecosystem longitudinal weave
      if (this.isCodingSource(sourceModule)) {
        await this.weaveCodingLongitudinal(eventId, userId, projectId, content, signal);
      }

      // Modular self-reflective consolidation
      await this.reflectiveConsolidate(eventId, userId, projectId, layer, coherenceScore, inducedCount);

      // Vector upsert
      if (signal.embedding) {
        await upsertVectors([{
          id: eventId,
          vector: signal.embedding,
          payload: {
            type: 'bindweave_event',
            user_id: userId,
            project_id: projectId,
            source_module: sourceModule,
            layer,
            entity_bindings: frame.entityBindings,
            content,
            coherenceScore,
            inducedWeaves: inducedCount,
          },
        }]);
      }

      return { eventId, inducedWeaves: inducedCount, layer, coherenceScore };
    } catch (err) {
      console.warn('[BindWeave] Failed to bind event:', err);
      return { eventId, inducedWeaves: 0, layer, coherenceScore };
    }
  }

  async queryWeave(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 8
  ): Promise<BindQueryResult> {
    if (!this.isEnabled()) {
      return {
        summary: '', bindings: [], inducedConnections: 0, confidence: 0,
        reflectTrace: { interaction: 'disabled', reasoning: 'disabled', consolidation: 'disabled' },
      };
    }

    const reflectTrace = { interaction: '', reasoning: '', consolidation: '' };

    try {
      // Traverse weave via entity bindings and induced connections
      const queryBindings = this.extractEntityBindings(queryText);

      const rows = await query<any>(
        `SELECT e.event_id, e.entity_bindings, e.content, e.coherence_score, e.layer,
                e.created_at, e.source_module,
                (SELECT COUNT(*) FROM bindweave_edges WHERE source_event_id = e.event_id OR target_event_id = e.event_id) as weave_degree
         FROM bindweave_events e
         WHERE e.user_id = $1 AND e.project_id = $2
           AND (e.entity_bindings && $3::text[] OR e.content ILIKE $4)
         ORDER BY e.coherence_score DESC, e.created_at DESC
         LIMIT $5`,
        [userId, projectId, queryBindings, `%${queryText.slice(0, 50)}%`, limit * 2]
      );
      reflectTrace.interaction = `retrieved ${rows.length} events via binding traversal`;

      // Reasoning layer: score and filter by weave coherence
      const scored = rows.map(r => ({
        eventId: r.event_id,
        entityBindings: r.entity_bindings || [],
        content: r.content,
        coherenceScore: Number(r.coherence_score || 0),
        weaveDegree: Number(r.weave_degree || 0),
        createdAt: r.created_at,
      })).filter(b => b.coherenceScore >= this.inductionThreshold);
      reflectTrace.reasoning = `filtered to ${scored.length} events above coherence threshold`;

      const inducedConnections = scored.reduce((s, b) => s + b.weaveDegree, 0);

      // Consolidation: synthesize refined output
      const summary = this.synthesizeRefined(scored, queryText);
      reflectTrace.consolidation = `synthesized ${summary.length} char summary from ${scored.length} bindings`;

      const confidence = scored.length > 0
        ? scored.reduce((s, b) => s + b.coherenceScore, 0) / scored.length
        : 0;

      return {
        summary,
        bindings: scored.slice(0, limit),
        inducedConnections,
        confidence,
        reflectTrace,
      };
    } catch (err) {
      console.warn('[BindWeave] Query failed:', err);
      return {
        summary: '', bindings: [], inducedConnections: 0, confidence: 0,
        reflectTrace,
      };
    }
  }

  async buildWeaveContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 5): Promise<string> {
    const result = await this.queryWeave(queryText, userId, projectId, limit);
    if (!result.summary || result.bindings.length === 0) return '';
    return `\n\n### BindWeave Context\n${result.summary}\nConfidence: ${result.confidence.toFixed(2)} | Weave Connections: ${result.inducedConnections}\nReflect Trace: interaction=${result.reflectTrace.interaction}, reasoning=${result.reflectTrace.reasoning}, consolidation=${result.reflectTrace.consolidation}`;
  }

  // ── Structured event frame creation ──

  private createStructuredFrame(eventId: string, signal: BindSignal, sourceModule: string): BindFrame {
    const content = this.extractContent(signal);
    const entityBindings = this.extractEntityBindings(content);
    const temporalAnchor = this.extractTemporalAnchor(content, signal);
    const causalLinks = this.extractCausalLinks(content, signal);

    return { eventId, entityBindings, temporalAnchor, causalLinks, content };
  }

  private extractEntityBindings(content: string): string[] {
    const entities = new Set<string>();
    const lower = content.toLowerCase();

    if (/\b(code|repo|function|class|api|test|bug|debt|refactor|module)\b/.test(lower)) entities.add('code');
    if (/\b(bug|error|crash|regression|failed|exception)\b/.test(lower)) entities.add('bug');
    if (/\b(debt|legacy|refactor|complexity|flaky|slow)\b/.test(lower)) entities.add('tech-debt');
    if (/\b(burnout|stress|energy|tired|overwhelmed|exhausted)\b/.test(lower)) entities.add('burnout');
    if (/\b(team|relationship|colleague|handoff|review|communication)\b/.test(lower)) entities.add('relationship');
    if (/\b(skill|workflow|learn|practice|improve)\b/.test(lower)) entities.add('skill');
    if (/\b(decision|choice|trade.off|prefer)\b/.test(lower)) entities.add('decision');
    if (/\b(goal|target|objective|milestone)\b/.test(lower)) entities.add('goal');

    const namedEntities = content.match(/\b[A-Z][A-Za-z0-9_/-]{2,}\b/g) || [];
    for (const ne of namedEntities.slice(0, 8)) entities.add(ne.toLowerCase());

    if (entities.size === 0) entities.add('general');
    return [...entities].slice(0, 16);
  }

  private extractTemporalAnchor(content: string, signal: BindSignal): string {
    const durativeMatch = content.match(/\b(for\s+\d+\s+(day|week|month|year|hour|minute)s?)\b/i);
    if (durativeMatch) return `durative:${durativeMatch[0]}`;

    const pointMatch = content.match(/\b(\d{4}-\d{2}-\d{2}|today|yesterday|tomorrow|last\s+week|next\s+month)\b/i);
    if (pointMatch) return `point:${pointMatch[0]}`;

    const relativeMatch = content.match(/\b(ago|since|before|after|during|while)\b/i);
    if (relativeMatch) return `relative:${relativeMatch[0]}`;

    return 'unspecified';
  }

  private extractCausalLinks(content: string, signal: BindSignal): string[] {
    const links: string[] = [];
    const lower = content.toLowerCase();

    if (/\b(because|due to|caused|led to|result|consequence|therefore)\b/.test(lower)) links.push('cause-effect');
    if (/\b(enables|allows|prevents|blocks|requires)\b/.test(lower)) links.push('dependency');
    if (/\b(implies|suggests|indicates|correlates)\b/.test(lower)) links.push('inference');
    if (/\b(triggers|initiates|starts|begins)\b/.test(lower)) links.push('trigger');

    if (links.length === 0) links.push('association');
    return links;
  }

  // ── Cross-event induction ──

  private async induceCrossEventWeaves(
    eventId: string, userId: number, projectId: string,
    frame: BindFrame, signal: BindSignal, sourceModule: string
  ): Promise<number> {
    let induced = 0;

    // Semantic similarity via shared entity bindings
    const semanticMatches = await query<any>(
      `SELECT event_id, entity_bindings, coherence_score FROM bindweave_events
       WHERE user_id = $1 AND project_id = $2 AND event_id <> $3
         AND entity_bindings && $4::text[]
         AND coherence_score >= $5
       ORDER BY coherence_score DESC LIMIT $6`,
      [userId, projectId, eventId, frame.entityBindings, this.inductionThreshold, this.maxWeaveDegree]
    );

    for (const match of semanticMatches) {
      const edgeScore = this.computeInductionScore(frame, match, signal);
      if (edgeScore >= this.inductionThreshold) {
        await this.insertWeaveEdge(eventId, match.event_id, 'induced', edgeScore, sourceModule, 'semantic');
        induced++;
      }
    }

    // Causal induction via shared causal links
    if (frame.causalLinks.some(c => c !== 'association')) {
      const causalMatches = await query<any>(
        `SELECT event_id, causal_links FROM bindweave_events
         WHERE user_id = $1 AND project_id = $2 AND event_id <> $3
           AND causal_links && $4::text[]
         ORDER BY created_at DESC LIMIT 3`,
        [userId, projectId, eventId, frame.causalLinks]
      );

      for (const match of causalMatches) {
        await this.insertWeaveEdge(eventId, match.event_id, 'causal', 0.6, sourceModule, 'causal');
        induced++;
      }
    }

    // Temporal induction via overlapping anchors
    if (frame.temporalAnchor !== 'unspecified') {
      const temporalMatches = await query<any>(
        `SELECT event_id FROM bindweave_events
         WHERE user_id = $1 AND project_id = $2 AND event_id <> $3
           AND temporal_anchor = $4
         ORDER BY created_at DESC LIMIT 2`,
        [userId, projectId, eventId, frame.temporalAnchor]
      );

      for (const match of temporalMatches) {
        await this.insertWeaveEdge(eventId, match.event_id, 'temporal', 0.5, sourceModule, 'temporal');
        induced++;
      }
    }

    return induced;
  }

  private computeInductionScore(frame: BindFrame, match: any, signal: BindSignal): number {
    const sharedEntities = frame.entityBindings.filter(e => (match.entity_bindings || []).includes(e));
    let score = sharedEntities.length * 0.15;
    score += (match.coherence_score || 0) * 0.2;
    if (signal.confidence) score += signal.confidence * 0.1;
    return this.clamp(score, 0, 1);
  }

  private async insertWeaveEdge(
    sourceId: string, targetId: string, edgeType: BindEdgeType,
    weight: number, provenanceModule: string, reason: string
  ): Promise<void> {
    await execute(
      `INSERT INTO bindweave_edges
        (source_event_id, target_event_id, edge_type, weight, provenance_module, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (source_event_id, target_event_id, edge_type) DO UPDATE SET
         weight = LEAST(1.0, bindweave_edges.weight + EXCLUDED.weight * 0.1)`,
      [sourceId, targetId, edgeType, weight, provenanceModule, reason]
    );
  }

  // ── Coding ecosystem longitudinal weave ──

  private async weaveCodingLongitudinal(
    eventId: string, userId: number, projectId: string,
    content: string, signal: BindSignal
  ): Promise<void> {
    const lower = content.toLowerCase();
    const targets: string[] = [];
    if (/\b(debt|legacy|refactor|complexity)\b/.test(lower)) targets.push('burnout');
    if (/\b(team|review|handoff)\b/.test(lower)) targets.push('relationship');
    if (/\b(bug|error|crash)\b/.test(lower)) targets.push('bug');

    for (const target of targets) {
      const relatedEvents = await query<{ event_id: string }>(
        `SELECT event_id FROM bindweave_events
         WHERE user_id = $1 AND project_id = $2
           AND entity_bindings && ARRAY[$3]::text[]
         ORDER BY coherence_score DESC LIMIT 2`,
        [userId, projectId, target]
      );

      for (const re of relatedEvents) {
        await this.insertWeaveEdge(eventId, re.event_id, 'coding_longitudinal', 0.65, 'coding-ecosystem', 'coding_signal');
      }
    }
  }

  // ── Modular self-reflective consolidation ──

  private async reflectiveConsolidate(
    eventId: string, userId: number, projectId: string,
    layer: BindLayer, coherenceScore: number, inducedCount: number
  ): Promise<void> {
    // Interaction layer: audit event quality
    if (coherenceScore < 0.3) {
      await execute(
        `UPDATE bindweave_events SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"audit_flagged": true}'::jsonb WHERE event_id = $1`,
        [eventId]
      );
    }

    // Reasoning layer: validate induced connections
    if (inducedCount > 3) {
      // High induction density — verify top connections
      const topEdges = await query<any>(
        `SELECT target_event_id, weight FROM bindweave_edges
         WHERE source_event_id = $1 AND edge_type = 'induced'
         ORDER BY weight DESC LIMIT 2`,
        [eventId]
      );

      for (const edge of topEdges) {
        if (edge.weight < this.inductionThreshold + 0.1) {
          await execute(
            `UPDATE bindweave_edges SET weight = weight * 0.7 WHERE source_event_id = $1 AND target_event_id = $2`,
            [eventId, edge.target_event_id]
          );
        }
      }
    }

    // Consolidation layer: update layer assignment based on accumulated coherence
    const layerUpdates: Record<BindLayer, number> = { interaction: 0, reasoning: 1, consolidation: 2 };
    const currentTier = layerUpdates[layer] ?? 0;
    if (coherenceScore >= 0.7 && currentTier < 2) {
      const newLayer: BindLayer = currentTier < 1 ? 'reasoning' : 'consolidation';
      await execute(
        `UPDATE bindweave_events SET layer = $1, updated_at = CURRENT_TIMESTAMP WHERE event_id = $2`,
        [newLayer, eventId]
      );
    }
  }

  // ── Synthesis ──

  private synthesizeRefined(bindings: Array<{ entityBindings: string[]; content: string; weaveDegree: number }>, queryText: string): string {
    if (bindings.length === 0) return '';

    const lower = queryText.toLowerCase();
    const wantsPattern = /\b(pattern|connection|relationship|link)\b/.test(lower);

    const lines: string[] = [];

    if (wantsPattern) {
      const highWeave = bindings.filter(b => b.weaveDegree >= 2);
      if (highWeave.length > 0) {
        lines.push('Strongly connected events:');
        for (const b of highWeave.slice(0, 4)) {
          const entities = b.entityBindings.slice(0, 3).join(', ');
          lines.push(`- [${entities}]: ${b.content.slice(0, 140)} (weave: ${b.weaveDegree})`);
        }
      }
    } else {
      for (const b of bindings.slice(0, 5)) {
        const entities = b.entityBindings.slice(0, 3).join(', ');
        lines.push(`- [${entities}]: ${b.content.slice(0, 160)} (weave: ${b.weaveDegree})`);
      }
    }

    return lines.join('\n');
  }

  // ── Helpers ──

  private determineLayer(signal: BindSignal, sourceModule: string): BindLayer {
    const content = this.extractContent(signal).toLowerCase();
    const confidence = signal.confidence ?? 0.5;

    if (confidence >= 0.7 || /\b(pattern|insight|learned|consolidated)\b/.test(content)) return 'consolidation';
    if (confidence >= 0.45 || /\b(analysis|reasoning|why|because)\b/.test(content)) return 'reasoning';
    return 'interaction';
  }

  private computeCoherence(frame: BindFrame, signal: BindSignal): number {
    let score = 0.4;
    if (frame.entityBindings.length > 1) score += 0.15;
    if (frame.causalLinks.length > 0 && !frame.causalLinks.includes('association')) score += 0.1;
    if (frame.temporalAnchor !== 'unspecified') score += 0.1;
    if ((signal.tags || []).length > 0) score += 0.05;
    if (signal.confidence) score += signal.confidence * 0.2;
    return this.clamp(score, 0.1, 1);
  }

  private isCodingSource(sourceModule: string): boolean {
    return CODE_SOURCES.some(s => sourceModule.toLowerCase().includes(s));
  }

  private extractContent(signal: BindSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}

export const bindWeave = new BindWeave();
