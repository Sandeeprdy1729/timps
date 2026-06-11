// core/weaveForge.ts - Hybrid Memory Weaver with orthogonal layers and utility rewards
//
// WeaveForge turns tool, reflection, planner, and coding-agent outputs into
// traceable hybrid memory: graph links, experience abstractions, and passage
// evidence. It is deliberately lightweight: online updates are bounded,
// provenance is preserved, and existing dual-search remains the fallback.

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export type WeaveLayer = 'semantic' | 'temporal' | 'causal' | 'entity';
export type WeaveHybridType = 'graph' | 'experience' | 'passage';

export interface WeaveSignal {
  id?: string | number;
  userId?: number;
  projectId?: string;
  memoryId?: number;
  versionId?: string;
  content?: string;
  raw?: any;
  evidence?: string;
  embedding?: number[];
  tags?: string[];
  metadata?: Record<string, any>;
  outcomeScore?: number;
}

export interface WeaveResult {
  nodeId: string;
  layers: WeaveLayer[];
  utilityWeight: number;
  abstraction: string;
}

export interface WeaveContextItem {
  nodeId: string;
  sourceModule: string;
  content: string;
  abstraction: string;
  evidence: string;
  layers: WeaveLayer[];
  utilityWeight: number;
  rewardScore: number;
  relevance: number;
}

interface WeaveOptions {
  userId?: number;
  projectId?: string;
  outcomeScore?: number;
  parentNodeId?: string;
}

const LAYER_INTENTS: Record<string, WeaveLayer[]> = {
  coding_impact: ['causal', 'semantic', 'temporal'],
  burnout_risk: ['causal', 'temporal', 'semantic'],
  decision_history: ['temporal', 'causal', 'semantic'],
  skill_evolution: ['semantic', 'temporal', 'entity'],
  relationship: ['entity', 'temporal', 'causal'],
  contradiction: ['semantic', 'causal', 'temporal'],
  provenance_forge: ['temporal', 'semantic'],
  general: ['semantic', 'temporal'],
};

const CODING_MODULE_HINTS = ['code', 'cli', 'tech_debt', 'bug_pattern', 'api_archaeologist', 'codebase'];

export class WeaveForge {
  isEnabled(): boolean {
    return process.env.ENABLE_WEAVEFORGE !== 'false';
  }

  async weaveSignal(
    signal: WeaveSignal,
    sourceModule: string,
    options: WeaveOptions = {}
  ): Promise<WeaveResult> {
    const nodeId = crypto.randomUUID();
    const outcomeScore = this.clamp(options.outcomeScore ?? signal.outcomeScore ?? 0.5, 0, 1);
    const content = this.extractContent(signal);
    const evidence = signal.evidence || this.extractEvidence(signal);
    const layers = this.inferLayers(content, sourceModule, signal.tags || []);
    const abstraction = this.abstractExperience(content, sourceModule, signal.tags || []);
    const utilityWeight = this.computeUtilityWeight(signal, sourceModule, outcomeScore);
    const rewardDelta = this.rewardDelta(outcomeScore);
    const userId = options.userId ?? signal.userId ?? 1;
    const projectId = options.projectId ?? signal.projectId ?? 'default';

    if (!this.isEnabled()) {
      return { nodeId, layers, utilityWeight, abstraction };
    }

    try {
      await execute(
        `INSERT INTO weave_nodes
          (node_id, user_id, project_id, source_module, source_record_id, memory_id, version_id,
           content, abstraction, utility_weight, reward_score, layers, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (node_id) DO NOTHING`,
        [
          nodeId,
          userId,
          projectId,
          sourceModule,
          signal.id ? String(signal.id) : null,
          signal.memoryId || null,
          signal.versionId || null,
          content,
          abstraction,
          utilityWeight,
          rewardDelta,
          layers,
          JSON.stringify(signal.metadata || {}),
        ]
      );

      await execute(
        `INSERT INTO weave_experiences (node_id, abstraction, pattern_tags, utility_weight, source_module)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (node_id) DO UPDATE SET
           abstraction = EXCLUDED.abstraction,
           pattern_tags = EXCLUDED.pattern_tags,
           utility_weight = EXCLUDED.utility_weight,
           updated_at = CURRENT_TIMESTAMP`,
        [nodeId, abstraction, signal.tags || [], utilityWeight, sourceModule]
      );

      await execute(
        `INSERT INTO weave_passages (node_id, evidence, provenance_module, raw_signal)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (node_id) DO UPDATE SET
           evidence = EXCLUDED.evidence,
           raw_signal = EXCLUDED.raw_signal`,
        [nodeId, evidence, sourceModule, JSON.stringify(signal.raw ?? signal)]
      );

      await this.forgeOrthogonalEdges(nodeId, userId, projectId, sourceModule, layers, utilityWeight, options.parentNodeId);
      await this.densifyReward(nodeId, rewardDelta);

      if (this.isCodingSource(sourceModule)) {
        await this.weaveCodingLinks(nodeId, userId, projectId, content, utilityWeight);
      }

      if (utilityWeight < 0.3) {
        await this.applyDecay(nodeId, sourceModule);
      }

      if (signal.embedding) {
        await upsertVectors([{
          id: nodeId,
          vector: signal.embedding,
          payload: {
            type: 'weave_node',
            user_id: userId,
            project_id: projectId,
            source_module: sourceModule,
            utility_weight: utilityWeight,
            layers,
            content,
            abstraction,
          },
        }]);
      }
    } catch (err) {
      console.warn('[WeaveForge] Failed to weave signal:', err);
    }

    return { nodeId, layers, utilityWeight, abstraction };
  }

  async evolveFromFeedback(
    experience: WeaveSignal,
    sourceModule: string,
    outcomeScore: number,
    options: WeaveOptions = {}
  ): Promise<number> {
    const result = await this.weaveSignal(experience, sourceModule, {
      ...options,
      outcomeScore,
    });
    return result.utilityWeight;
  }

  async policyTraverse(
    queryText: string,
    intent: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 6
  ): Promise<WeaveContextItem[]> {
    const layers = LAYER_INTENTS[intent] || LAYER_INTENTS.general;

    try {
      const rows = await query<any>(
        `SELECT
           n.node_id,
           n.source_module,
           n.content,
           n.abstraction,
           p.evidence,
           n.layers,
           n.utility_weight,
           n.reward_score,
           (
             n.utility_weight * 0.55 +
             GREATEST(n.reward_score, 0) * 0.25 +
             CASE WHEN n.source_module = ANY($4) THEN 0.20 ELSE 0 END
           ) AS relevance
         FROM weave_nodes n
         LEFT JOIN weave_passages p ON p.node_id = n.node_id
         WHERE n.user_id = $1
           AND n.project_id = $2
           AND n.layers && $3::text[]
           AND n.utility_weight >= 0.2
         ORDER BY relevance DESC, n.updated_at DESC
         LIMIT $5`,
        [userId, projectId, layers, this.modulesForQuery(queryText), limit]
      );

      return rows.map(row => ({
        nodeId: row.node_id,
        sourceModule: row.source_module,
        content: row.content,
        abstraction: row.abstraction,
        evidence: row.evidence || '',
        layers: row.layers || [],
        utilityWeight: Number(row.utility_weight || 0),
        rewardScore: Number(row.reward_score || 0),
        relevance: Number(row.relevance || 0),
      }));
    } catch {
      return [];
    }
  }

  async buildWeaveContext(
    queryText: string,
    intent: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 5
  ): Promise<string> {
    if (!this.isEnabled()) return '';

    const items = await this.policyTraverse(queryText, intent, userId, projectId, limit);
    if (items.length === 0) return '';

    const lines = items.map(item => {
      const layers = item.layers.join('/');
      return `- ${item.abstraction || item.content.slice(0, 160)} [${item.sourceModule}; ${layers}; utility=${item.utilityWeight.toFixed(2)}]`;
    });

    return `\n\n### Hybrid Weave Context (WeaveForge)\n${lines.join('\n')}`;
  }

  async getStats(): Promise<{
    totalNodes: number;
    avgUtility: number;
    byModule: Record<string, number>;
    byLayer: Record<string, number>;
  }> {
    try {
      const total = await query<{ count: string; avg: string }>(
        'SELECT COUNT(*) as count, AVG(utility_weight) as avg FROM weave_nodes'
      );
      const byModule = await query<{ source_module: string; count: string }>(
        'SELECT source_module, COUNT(*) as count FROM weave_nodes GROUP BY source_module ORDER BY count DESC LIMIT 15'
      );
      const byLayer = await query<{ layer: string; count: string }>(
        'SELECT unnest(layers) as layer, COUNT(*) as count FROM weave_nodes GROUP BY layer'
      );

      return {
        totalNodes: parseInt(total[0]?.count || '0', 10),
        avgUtility: parseFloat(total[0]?.avg || '0'),
        byModule: Object.fromEntries(byModule.map(row => [row.source_module, parseInt(row.count, 10)])),
        byLayer: Object.fromEntries(byLayer.map(row => [row.layer, parseInt(row.count, 10)])),
      };
    } catch {
      return { totalNodes: 0, avgUtility: 0, byModule: {}, byLayer: {} };
    }
  }

  private async forgeOrthogonalEdges(
    nodeId: string,
    userId: number,
    projectId: string,
    sourceModule: string,
    layers: WeaveLayer[],
    weight: number,
    parentNodeId?: string
  ): Promise<void> {
    if (parentNodeId) {
      await this.insertWeaveEdge(nodeId, parentNodeId, 'temporal', 'lineage', weight, sourceModule, { parentNodeId });
    }

    for (const layer of layers) {
      const rows = await query<{ node_id: string; utility_weight: number; source_module: string }>(
        `SELECT node_id, utility_weight, source_module
         FROM weave_nodes
         WHERE user_id = $1
           AND project_id = $2
           AND node_id <> $3
           AND layers && ARRAY[$4]::text[]
         ORDER BY utility_weight DESC, updated_at DESC
         LIMIT 3`,
        [userId, projectId, nodeId, layer]
      );

      for (const row of rows) {
        const edgeWeight = this.clamp((weight + Number(row.utility_weight || 0.5)) / 2, 0.1, 1);
        await this.insertWeaveEdge(
          nodeId,
          row.node_id,
          layer,
          this.edgeTypeForLayer(layer, sourceModule, row.source_module),
          edgeWeight,
          sourceModule,
          { sourceModule, targetModule: row.source_module }
        );
      }
    }
  }

  private async insertWeaveEdge(
    sourceNodeId: string,
    targetNodeId: string,
    layer: WeaveLayer,
    edgeType: string,
    weight: number,
    provenanceModule: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await execute(
        `INSERT INTO weave_edges
          (source_node_id, target_node_id, layer, edge_type, weight, provenance_module, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (source_node_id, target_node_id, layer, edge_type) DO UPDATE SET
           weight = LEAST(1.0, weave_edges.weight + EXCLUDED.weight * 0.1),
           updated_at = CURRENT_TIMESTAMP`,
        [sourceNodeId, targetNodeId, layer, edgeType, weight, provenanceModule, JSON.stringify(metadata)]
      );
    } catch {
      // Best-effort edge forging should not block agent execution.
    }
  }

  private async densifyReward(nodeId: string, delta: number): Promise<void> {
    await execute(
      `UPDATE weave_nodes
       SET reward_score = GREATEST(-1.0, LEAST(1.0, reward_score + $2)),
           utility_weight = GREATEST(0.1, LEAST(1.0, utility_weight + $2)),
           updated_at = CURRENT_TIMESTAMP
       WHERE node_id = $1`,
      [nodeId, delta]
    );
  }

  private async weaveCodingLinks(
    nodeId: string,
    userId: number,
    projectId: string,
    content: string,
    weight: number
  ): Promise<void> {
    const targetModules = new Set<string>();
    const lower = content.toLowerCase();

    if (/\b(debt|refactor|legacy|complexity|slow|flaky)\b/.test(lower)) {
      targetModules.add('burnout_seismograph');
      targetModules.add('skill_shadow');
    }
    if (/\b(bug|error|crash|incident|failed test)\b/.test(lower)) {
      targetModules.add('bug_pattern_prophet');
      targetModules.add('tech_debt_seismograph');
    }
    if (/\b(team|handoff|review|communication|relationship)\b/.test(lower)) {
      targetModules.add('relationship_intelligence');
    }

    for (const targetModule of targetModules) {
      const targets = await query<{ node_id: string }>(
        `SELECT node_id FROM weave_nodes
         WHERE user_id = $1 AND project_id = $2 AND source_module = $3
         ORDER BY utility_weight DESC, updated_at DESC
         LIMIT 2`,
        [userId, projectId, targetModule]
      );

      for (const target of targets) {
        await this.insertWeaveEdge(nodeId, target.node_id, 'causal', 'coding_signal', weight, 'timps-code', {
          targetModule,
          reinforcedBy: 'coding-output',
        });
      }
    }
  }

  private async applyDecay(nodeId: string, sourceModule: string): Promise<void> {
    await execute(
      `UPDATE weave_nodes
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE node_id = $1`,
      [nodeId, JSON.stringify({ decayed: true, decayed_by: sourceModule, decayed_at: new Date().toISOString() })]
    );
  }

  private computeUtilityWeight(signal: WeaveSignal, sourceModule: string, outcomeScore: number): number {
    const content = this.extractContent(signal);
    let weight = 0.5 + this.rewardDelta(outcomeScore);

    if (content.length > 80) weight += 0.05;
    if (content.length > 240) weight += 0.05;
    if ((signal.tags || []).length > 0) weight += 0.05;
    if (this.isCodingSource(sourceModule)) weight += 0.05;
    if (sourceModule.includes('reflection')) weight += 0.03;

    return this.clamp(weight, 0.1, 1.0);
  }

  private rewardDelta(outcomeScore: number): number {
    return 0.15 * (this.clamp(outcomeScore, 0, 1) - 0.5);
  }

  private inferLayers(content: string, sourceModule: string, tags: string[]): WeaveLayer[] {
    const layers = new Set<WeaveLayer>(['semantic']);
    const lower = `${content} ${sourceModule} ${tags.join(' ')}`.toLowerCase();

    if (/\b(today|yesterday|tomorrow|week|month|deadline|after|before|\d{4}-\d{2}-\d{2})\b/.test(lower)) {
      layers.add('temporal');
    }
    if (/\b(cause|because|impact|lead|led|risk|burnout|debt|bug|regret|outcome|prediction)\b/.test(lower)) {
      layers.add('causal');
    }
    if (/\b(user|team|person|relationship|contact|api|project|repo|module|class|function)\b/.test(lower) || /[A-Z][a-z]+/.test(content)) {
      layers.add('entity');
    }
    if (this.isCodingSource(sourceModule)) {
      layers.add('temporal');
      layers.add('causal');
    }

    return [...layers];
  }

  private abstractExperience(content: string, sourceModule: string, tags: string[]): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    const clue = tags.length > 0 ? ` (${tags.slice(0, 4).join(', ')})` : '';
    const prefix = this.isCodingSource(sourceModule)
      ? 'Coding pattern'
      : sourceModule.includes('reflection')
        ? 'Reflected experience'
        : 'Tool experience';

    return `${prefix}${clue}: ${normalized.slice(0, 220)}`;
  }

  private extractContent(signal: WeaveSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private extractEvidence(signal: WeaveSignal): string {
    const raw = signal.raw ?? signal.metadata ?? signal.content ?? signal;
    return typeof raw === 'string' ? raw : JSON.stringify(raw);
  }

  private isCodingSource(sourceModule: string): boolean {
    const lower = sourceModule.toLowerCase();
    return CODING_MODULE_HINTS.some(hint => lower.includes(hint));
  }

  private edgeTypeForLayer(layer: WeaveLayer, sourceModule: string, targetModule: string): string {
    if (sourceModule === targetModule) return 'recurrence';
    if (layer === 'temporal') return 'sequence';
    if (layer === 'causal') return 'influence';
    if (layer === 'entity') return 'entity_link';
    return 'semantic_link';
  }

  private modulesForQuery(queryText: string): string[] {
    const lower = queryText.toLowerCase();
    const modules = new Set<string>(['reflection']);

    if (/\b(code|bug|debt|refactor|api|repo|test)\b/.test(lower)) {
      modules.add('timps-code');
      modules.add('tech_debt_seismograph');
      modules.add('bug_pattern_prophet');
      modules.add('api_archaeologist');
      modules.add('codebase_anthropologist');
    }
    if (/\b(burnout|stress|energy|tired)\b/.test(lower)) modules.add('burnout_seismograph');
    if (/\b(relationship|team|colleague|drift)\b/.test(lower)) modules.add('relationship_intelligence');
    if (/\b(skill|workflow|learn)\b/.test(lower)) modules.add('skill_shadow');

    return [...modules];
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export const weaveForge = new WeaveForge();
export const liveForge = weaveForge;
