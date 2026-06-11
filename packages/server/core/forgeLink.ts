// ForgeLink — Typed Relationship Forge with Modular Lifecycle Orchestration
// Forges typed edges (causal, dependency, temporal, influence, contradiction, evolution)
// between memory elements across all 17 tools + coding agent outputs.

import { query, execute } from '../db/postgres';
import { searchVectors, upsertVectors } from '../db/vector';
import { EmbeddingService } from '../memory/embedding';
import { createModel } from '../models';
import { config } from '../config/env';

// ── Types ──────────────────────────────────────────────────────────────────────

export type EdgeType = 'causal' | 'dependency' | 'temporal' | 'influence' | 'contradiction' | 'evolution';

export interface TypedEdge {
  id?: number;
  sourceMemoryId: number;
  targetMemoryId: number;
  edgeType: EdgeType;
  weight: number;
  confidence: number;
  provenanceModule: string;
  metadata: Record<string, any>;
}

export interface ModuleSchema {
  name: string;
  tableName: string;
  signalFields: string[];           // fields that carry meaningful signal
  domain: 'self' | 'cognitive' | 'developer' | 'collective' | 'relationship';
  linkedModules: string[];          // modules this naturally connects to
}

export interface StructuredOutput {
  moduleSource: string;
  domain: string;
  keySignals: Array<{ field: string; value: any }>;
  timestamp: Date;
  userId: number;
  sourceRecordId: number;
}

export interface ForgedEdgeResult {
  edges: TypedEdge[];
  propagations: string[];
}

// ── Cross-domain influence map ─────────────────────────────────────────────────
// Defines which edge types to forge between module domains
const DOMAIN_INFLUENCE_MAP: Record<string, Array<{ target: string; edgeType: EdgeType }>> = {
  'bug_pattern_prophet':       [{ target: 'tech_debt_seismograph', edgeType: 'dependency' }, { target: 'skill_shadow', edgeType: 'influence' }, { target: 'burnout_seismograph', edgeType: 'influence' }],
  'tech_debt_seismograph':     [{ target: 'skill_shadow', edgeType: 'influence' }, { target: 'dead_reckoning', edgeType: 'causal' }, { target: 'burnout_seismograph', edgeType: 'influence' }],
  'burnout_seismograph':       [{ target: 'relationship_intelligence', edgeType: 'influence' }, { target: 'skill_shadow', edgeType: 'causal' }],
  'temporal_mirror':           [{ target: 'living_manifesto', edgeType: 'evolution' }, { target: 'dead_reckoning', edgeType: 'causal' }],
  'regret_oracle':             [{ target: 'dead_reckoning', edgeType: 'causal' }, { target: 'temporal_mirror', edgeType: 'temporal' }],
  'skill_shadow':              [{ target: 'curriculum_architect', edgeType: 'dependency' }],
  'relationship_intelligence': [{ target: 'chemistry_engine', edgeType: 'dependency' }, { target: 'burnout_seismograph', edgeType: 'influence' }],
  'meeting_ghost':             [{ target: 'relationship_intelligence', edgeType: 'temporal' }],
  'codebase_anthropologist':   [{ target: 'institutional_memory', edgeType: 'dependency' }, { target: 'tech_debt_seismograph', edgeType: 'influence' }],
  'api_archaeologist':         [{ target: 'bug_pattern_prophet', edgeType: 'dependency' }],
  'argument_dna_mapper':       [{ target: 'living_manifesto', edgeType: 'contradiction' }],
  'collective_wisdom':         [{ target: 'dead_reckoning', edgeType: 'influence' }],
  'institutional_memory':      [{ target: 'codebase_anthropologist', edgeType: 'dependency' }],
};

// ── Module registry schemas ────────────────────────────────────────────────────
const MODULE_SCHEMAS: ModuleSchema[] = [
  { name: 'temporal_mirror',        tableName: 'behavioral_events',       signalFields: ['event_type', 'context', 'outcome', 'emotional_valence'], domain: 'self', linkedModules: ['living_manifesto', 'dead_reckoning'] },
  { name: 'regret_oracle',          tableName: 'decisions',               signalFields: ['description', 'decision_type', 'regret_score', 'outcome_noted'], domain: 'self', linkedModules: ['dead_reckoning', 'temporal_mirror'] },
  { name: 'living_manifesto',       tableName: 'value_observations',      signalFields: ['inferred_value', 'evidence', 'frequency'], domain: 'self', linkedModules: ['temporal_mirror'] },
  { name: 'burnout_seismograph',    tableName: 'burnout_signals',         signalFields: ['signal_type', 'value', 'deviation_pct'], domain: 'self', linkedModules: ['relationship_intelligence', 'skill_shadow'] },
  { name: 'argument_dna_mapper',    tableName: 'contradiction_history',   signalFields: ['position', 'contradiction'], domain: 'self', linkedModules: ['living_manifesto'] },
  { name: 'dead_reckoning',         tableName: 'life_simulations',        signalFields: ['scenario', 'simulation_result', 'confidence'], domain: 'cognitive', linkedModules: ['regret_oracle', 'temporal_mirror'] },
  { name: 'skill_shadow',           tableName: 'workflow_patterns',       signalFields: ['pattern_type', 'description', 'success_rate'], domain: 'cognitive', linkedModules: ['curriculum_architect'] },
  { name: 'curriculum_architect',   tableName: 'learning_events',         signalFields: ['topic', 'outcome', 'retention_days'], domain: 'cognitive', linkedModules: ['skill_shadow'] },
  { name: 'tech_debt_seismograph',  tableName: 'code_incidents',          signalFields: ['pattern', 'incident_type', 'time_to_debug_hrs'], domain: 'developer', linkedModules: ['skill_shadow', 'burnout_seismograph'] },
  { name: 'bug_pattern_prophet',    tableName: 'bug_patterns',            signalFields: ['bug_type', 'trigger_context', 'frequency'], domain: 'developer', linkedModules: ['tech_debt_seismograph', 'skill_shadow'] },
  { name: 'api_archaeologist',      tableName: 'api_knowledge',           signalFields: ['api_name', 'endpoint', 'discovered_quirk'], domain: 'developer', linkedModules: ['bug_pattern_prophet'] },
  { name: 'codebase_anthropologist', tableName: 'codebase_culture',       signalFields: ['insight_type', 'description', 'evidence'], domain: 'developer', linkedModules: ['institutional_memory'] },
  { name: 'institutional_memory',   tableName: 'institutional_knowledge', signalFields: ['decision', 'rationale', 'alternatives_rejected'], domain: 'collective', linkedModules: ['codebase_anthropologist'] },
  { name: 'chemistry_engine',       tableName: 'behavioral_profiles',     signalFields: ['person_identifier', 'profile_data'], domain: 'collective', linkedModules: ['relationship_intelligence'] },
  { name: 'meeting_ghost',          tableName: 'meeting_commitments',     signalFields: ['meeting_title', 'person_name', 'commitment', 'status'], domain: 'collective', linkedModules: ['relationship_intelligence'] },
  { name: 'collective_wisdom',      tableName: 'wisdom_contributions',    signalFields: ['decision_context', 'outcome'], domain: 'collective', linkedModules: ['dead_reckoning'] },
  { name: 'relationship_intelligence', tableName: 'relationship_health',  signalFields: ['contact_name', 'health_score', 'drift_alert'], domain: 'relationship', linkedModules: ['chemistry_engine', 'burnout_seismograph'] },
];

// ── ForgeLink class ────────────────────────────────────────────────────────────

export class ForgeLink {
  private modules: Map<string, ModuleSchema> = new Map();
  private embeddingService: EmbeddingService;
  private initialized = false;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  // ── Lifecycle: Register ──────────────────────────────────────────────────
  registerModules(): void {
    for (const schema of MODULE_SCHEMAS) {
      this.modules.set(schema.name, schema);
    }
    this.initialized = true;
    console.log(`[ForgeLink] Registered ${this.modules.size} modules`);
  }

  // ── Lifecycle: Process (admit → structure → link) ────────────────────────
  async process(
    moduleName: string,
    output: Record<string, any>,
    userId: number,
    sourceRecordId?: number
  ): Promise<ForgedEdgeResult> {
    if (!this.initialized) {
      return { edges: [], propagations: [] };
    }

    const schema = this.modules.get(moduleName);
    if (!schema) {
      return { edges: [], propagations: [] };
    }

    // Step 1: Admit — lightweight utility gate
    if (!this.admitOutput(output, schema)) {
      return { edges: [], propagations: [] };
    }

    // Step 2: Structure — extract key signals
    const structured = this.extractStructured(output, schema, userId, sourceRecordId);

    // Step 3: Link — forge typed edges to related memory elements
    const edges = await this.forgeTypedEdges(structured, schema);

    // Step 4: Propagate — for coding-domain and cross-domain signals
    const propagations = await this.propagateSignals(edges, schema, userId);

    return { edges, propagations };
  }

  // ── Admit: gate low-value outputs ────────────────────────────────────────
  private admitOutput(output: Record<string, any>, schema: ModuleSchema): boolean {
    // Reject empty or minimal outputs
    const signalCount = schema.signalFields.filter(f => output[f] !== undefined && output[f] !== null && output[f] !== '').length;
    return signalCount >= 1;
  }

  // ── Structure: extract typed signals ─────────────────────────────────────
  private extractStructured(
    output: Record<string, any>,
    schema: ModuleSchema,
    userId: number,
    sourceRecordId?: number
  ): StructuredOutput {
    const keySignals = schema.signalFields
      .filter(f => output[f] !== undefined && output[f] !== null)
      .map(f => ({ field: f, value: output[f] }));

    return {
      moduleSource: schema.name,
      domain: schema.domain,
      keySignals,
      timestamp: new Date(),
      userId,
      sourceRecordId: sourceRecordId || 0,
    };
  }

  // ── Link: forge typed edges via domain influence map + embedding proximity ─
  private async forgeTypedEdges(
    structured: StructuredOutput,
    schema: ModuleSchema
  ): Promise<TypedEdge[]> {
    const edges: TypedEdge[] = [];
    if (!structured.sourceRecordId) return edges;

    // Get influence targets for this module
    const influences = DOMAIN_INFLUENCE_MAP[schema.name] || [];

    for (const inf of influences) {
      const targetSchema = this.modules.get(inf.target);
      if (!targetSchema) continue;

      // Find recent records from the target module that could be related
      try {
        const recentTargets = await query(
          `SELECT id FROM ${targetSchema.tableName}
           WHERE ${targetSchema.tableName === 'institutional_knowledge' ? '1=1' : 'user_id = $1'}
           ORDER BY ${this.getTimestampCol(targetSchema.tableName)} DESC LIMIT 5`,
          targetSchema.tableName === 'institutional_knowledge' ? [] : [structured.userId]
        );

        for (const row of recentTargets) {
          // Compute confidence based on temporal proximity and domain alignment
          const confidence = this.computeEdgeConfidence(structured, inf.edgeType);

          if (confidence >= 0.3) {
            const edge: TypedEdge = {
              sourceMemoryId: structured.sourceRecordId,
              targetMemoryId: row.id,
              edgeType: inf.edgeType,
              weight: 1.0,
              confidence,
              provenanceModule: schema.name,
              metadata: {
                sourceDomain: schema.domain,
                targetModule: inf.target,
                targetDomain: targetSchema.domain,
                signals: structured.keySignals.map(s => s.field),
              },
            };
            edges.push(edge);
          }
        }
      } catch (err) {
        // Non-fatal: table may not have data yet
      }
    }

    // Persist edges
    await this.persistEdges(edges);

    return edges;
  }

  // ── Persist edges to PostgreSQL ──────────────────────────────────────────
  private async persistEdges(edges: TypedEdge[]): Promise<void> {
    for (const edge of edges) {
      try {
        await execute(
          `INSERT INTO typed_edges (source_memory_id, target_memory_id, edge_type, weight, confidence, provenance_module, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [edge.sourceMemoryId, edge.targetMemoryId, edge.edgeType, edge.weight, edge.confidence, edge.provenanceModule, JSON.stringify(edge.metadata)]
        );
      } catch (err) {
        // Silent — edge table may not exist yet on first run
      }
    }
  }

  // ── Propagate: cross-domain signal forwarding ────────────────────────────
  private async propagateSignals(
    edges: TypedEdge[],
    sourceSchema: ModuleSchema,
    userId: number
  ): Promise<string[]> {
    const propagations: string[] = [];

    // Coding domain → longitudinal structures
    if (sourceSchema.domain === 'developer') {
      const codingEdges = edges.filter(e =>
        e.metadata?.targetModule === 'skill_shadow' ||
        e.metadata?.targetModule === 'burnout_seismograph'
      );

      for (const edge of codingEdges) {
        if (edge.metadata?.targetModule === 'skill_shadow' && edge.confidence >= 0.5) {
          propagations.push(`[ForgeLink] ${sourceSchema.name} → skill_shadow (${edge.edgeType}, conf=${edge.confidence.toFixed(2)})`);
        }
        if (edge.metadata?.targetModule === 'burnout_seismograph' && edge.confidence >= 0.4) {
          propagations.push(`[ForgeLink] ${sourceSchema.name} → burnout_seismograph (${edge.edgeType}, conf=${edge.confidence.toFixed(2)})`);
        }
      }
    }

    // Self-domain → cognitive forecasting
    if (sourceSchema.domain === 'self') {
      const forecastEdges = edges.filter(e => e.metadata?.targetModule === 'dead_reckoning');
      for (const edge of forecastEdges) {
        propagations.push(`[ForgeLink] ${sourceSchema.name} → dead_reckoning (${edge.edgeType}, conf=${edge.confidence.toFixed(2)})`);
      }
    }

    if (propagations.length > 0) {
      console.log(`[ForgeLink] Propagated ${propagations.length} cross-domain signals`);
    }

    return propagations;
  }

  // ── Intent-Aware Retrieval ───────────────────────────────────────────────
  async intentAwareRetrieve(
    queryText: string,
    intent: string,
    userId: number,
    limit: number = 10
  ): Promise<Array<{ edge: TypedEdge; relevance: number }>> {
    // Map intent to edge types for targeted traversal
    const intentEdgeMap: Record<string, EdgeType[]> = {
      'coding_impact':    ['dependency', 'influence', 'causal'],
      'burnout_risk':     ['influence', 'causal'],
      'decision_history': ['causal', 'temporal', 'evolution'],
      'skill_evolution':  ['evolution', 'dependency', 'influence'],
      'relationship':     ['influence', 'temporal'],
      'contradiction':    ['contradiction', 'evolution'],
      'general':          ['causal', 'dependency', 'temporal', 'influence'],
    };

    const edgeTypes = intentEdgeMap[intent] || intentEdgeMap['general'];
    const placeholders = edgeTypes.map((_, i) => `$${i + 1}`).join(', ');

    try {
      const result = await query<{ id: number; source_memory_id: number; target_memory_id: number; edge_type: string; weight: number; confidence: number; provenance_module: string; metadata: any; created_at: string }>(
        `SELECT id, source_memory_id, target_memory_id, edge_type, weight, confidence, provenance_module, metadata, created_at
         FROM typed_edges
         WHERE edge_type IN (${placeholders})
           AND confidence >= 0.3
         ORDER BY confidence DESC, created_at DESC
         LIMIT $${edgeTypes.length + 1}`,
        [...edgeTypes, limit]
      );

      return result.map(row => ({
        edge: {
          id: row.id,
          sourceMemoryId: row.source_memory_id,
          targetMemoryId: row.target_memory_id,
          edgeType: row.edge_type as EdgeType,
          weight: row.weight,
          confidence: row.confidence,
          provenanceModule: row.provenance_module,
          metadata: row.metadata || {},
        },
        relevance: row.confidence * row.weight,
      }));
    } catch {
      return [];
    }
  }

  // ── Detect query intent from message ─────────────────────────────────────
  detectIntent(message: string): string {
    const intentPatterns: Array<{ pattern: RegExp; intent: string }> = [
      { pattern: /\b(bug|crash|error|debt|refactor|code|implement)\b/i, intent: 'coding_impact' },
      { pattern: /\b(burnout|stress|tired|exhausted|overwhelmed)\b/i, intent: 'burnout_risk' },
      { pattern: /\b(decided|decision|chose|should i|regret)\b/i, intent: 'decision_history' },
      { pattern: /\b(skill|learn|improve|pattern|workflow)\b/i, intent: 'skill_evolution' },
      { pattern: /\b(relationship|team|colleague|friend|drift)\b/i, intent: 'relationship' },
      { pattern: /\b(contradict|inconsistent|changed my mind|but i said)\b/i, intent: 'contradiction' },
    ];

    for (const { pattern, intent } of intentPatterns) {
      if (pattern.test(message)) return intent;
    }
    return 'general';
  }

  // ── Evolve: periodic pattern mining for edge refinement ──────────────────
  async evolveLinks(userId: number): Promise<number> {
    try {
      // Find high-frequency edge patterns and boost confidence
      const updated = await execute(
        `UPDATE typed_edges SET confidence = LEAST(confidence * 1.1, 1.0), updated_at = CURRENT_TIMESTAMP
         WHERE id IN (
           SELECT te.id FROM typed_edges te
           JOIN typed_edges te2 ON te.provenance_module = te2.provenance_module
             AND te.edge_type = te2.edge_type
             AND te.id != te2.id
           WHERE te.confidence < 0.9
           GROUP BY te.id
           HAVING COUNT(*) >= 3
         )`
      );
      return updated;
    } catch {
      return 0;
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  async getStats(): Promise<{ totalEdges: number; byType: Record<string, number>; avgConfidence: number }> {
    try {
      const total = await query<{ count: string }>('SELECT COUNT(*) as count FROM typed_edges');
      const byType = await query<{ edge_type: string; count: string }>('SELECT edge_type, COUNT(*) as count FROM typed_edges GROUP BY edge_type');
      const avgConf = await query<{ avg: string }>('SELECT AVG(confidence) as avg FROM typed_edges');

      const typeMap: Record<string, number> = {};
      for (const row of byType) {
        typeMap[row.edge_type] = parseInt(row.count);
      }

      return {
        totalEdges: parseInt(total[0]?.count || '0'),
        byType: typeMap,
        avgConfidence: parseFloat(avgConf[0]?.avg || '0'),
      };
    } catch {
      return { totalEdges: 0, byType: {}, avgConfidence: 0 };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private getTimestampCol(tableName: string): string {
    const colMap: Record<string, string> = {
      behavioral_events: 'recorded_at',
      decisions: 'decided_at',
      value_observations: 'last_seen',
      burnout_signals: 'recorded_at',
      life_simulations: 'created_at',
      workflow_patterns: 'last_seen',
      learning_events: 'recorded_at',
      code_incidents: 'occurred_at',
      bug_patterns: 'last_occurrence',
      api_knowledge: 'discovered_at',
      codebase_culture: 'created_at',
      institutional_knowledge: 'preserved_at',
      behavioral_profiles: 'updated_at',
      meeting_commitments: 'meeting_date',
      wisdom_contributions: 'contributed_at',
      relationship_health: 'computed_at',
      relationship_signals: 'recorded_at',
      contradiction_history: 'created_at',
    };
    return colMap[tableName] || 'created_at';
  }

  private computeEdgeConfidence(structured: StructuredOutput, edgeType: EdgeType): number {
    // Base confidence by edge type
    const baseMap: Record<EdgeType, number> = {
      causal: 0.5,
      dependency: 0.6,
      temporal: 0.7,      // temporal links are high confidence (co-occurrence)
      influence: 0.4,
      contradiction: 0.55,
      evolution: 0.45,
    };

    let conf = baseMap[edgeType];

    // Boost for richer signal content
    const signalCount = structured.keySignals.length;
    conf += Math.min(signalCount * 0.05, 0.2);

    return Math.min(conf, 1.0);
  }

  isEnabled(): boolean {
    return this.initialized && (process.env.ENABLE_FORGELINK !== 'false');
  }
}

// Singleton
export const forgeLink = new ForgeLink();
