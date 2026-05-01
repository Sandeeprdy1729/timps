// SynapseMetabolon - Spreading Activation Metabolic Graph with Layered Reasoning
// Substrate and Adaptive Consolidation Cycles
//
// Fusion of SYNAPSE-style spreading activation over a living graph with
// Memory as Metabolism's layered substrate and adaptive consolidation cycles.
//
// Layers: interaction/workflow, reasoning, audit/consolidate
// Cycles: collect -> consolidate (utility-based) -> audit (evidence-gated) -> refresh/decay

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';
import { config } from '../config/env';

export type MetabolicLayer = 'interaction' | 'reasoning' | 'audit';

export interface MetabolicSignal {
  id?: string | number;
  userId?: number;
  projectId?: string;
  content?: string;
  raw?: any;
  embedding?: number[];
  tags?: string[];
  entity?: string;
  confidence?: number;
  outcomeScore?: number;
  metadata?: Record<string, any>;
}

export interface MetabolicNodeResult {
  nodeId: string;
  layer: MetabolicLayer;
  activation: number;
  entities: string[];
}

export interface SpreadingResult {
  summary: string;
  activatedNodes: Array<{
    nodeId: string;
    layer: MetabolicLayer;
    sourceModule: string;
    entityKey: string;
    content: string;
    activation: number;
    createdAt: string;
  }>;
  confidence: number;
  auditLog: string[];
  activationPath: string[];
}

export interface CycleResult {
  consolidated: number;
  audited: number;
  refreshed: number;
  decayed: number;
}

const CODE_SOURCES = ['code', 'cli', 'bug', 'debt', 'api', 'codebase', 'timps-code', 'timps-vscode', 'timps-mcp'];

interface SynapseConfig {
  activationThreshold: number;
  decayRate: number;
  maxSpreadDepth: number;
  consolidationInterval: number;
  maxActivatedNodes: number;
}

const DEFAULT_CONFIG: SynapseConfig = {
  activationThreshold: 0.15,
  decayRate: 0.03,
  maxSpreadDepth: 6,
  consolidationInterval: 10,
  maxActivatedNodes: 50,
};

export class SynapseMetabolon {
  private config: SynapseConfig;
  private metabConfig = (config as any).synapseMetabolon || {};

  constructor(cfg: Partial<SynapseConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...cfg,
      activationThreshold: this.metabConfig.activationThreshold ?? cfg.activationThreshold ?? DEFAULT_CONFIG.activationThreshold,
      decayRate: this.metabConfig.decayRate ?? cfg.decayRate ?? DEFAULT_CONFIG.decayRate,
      maxSpreadDepth: this.metabConfig.maxSpreadDepth ?? cfg.maxSpreadDepth ?? DEFAULT_CONFIG.maxSpreadDepth,
      maxActivatedNodes: this.metabConfig.maxActivatedNodes ?? cfg.maxActivatedNodes ?? DEFAULT_CONFIG.maxActivatedNodes,
    };
  }

  isEnabled(): boolean {
    return process.env.ENABLE_SYNAPSEMETABOLON !== 'false' && this.metabConfig.enabled !== false;
  }

  async injectEvent(signal: MetabolicSignal, sourceModule: string): Promise<MetabolicNodeResult> {
    const nodeId = `syn_${crypto.randomUUID()}`;
    const userId = signal.userId || 1;
    const projectId = signal.projectId || 'default';
    const content = this.extractContent(signal);
    const layer = this.determineLayer(signal, sourceModule);
    const entities = this.extractEntities(signal, sourceModule);
    const activation = this.clamp(signal.confidence ?? this.defaultActivation(layer, signal), 0.05, 1);

    if (!this.isEnabled()) {
      return { nodeId, layer, activation, entities };
    }

    try {
      await execute(
        `INSERT INTO metabolic_nodes
          (node_id, user_id, project_id, source_module, source_record_id, layer,
           entity_keys, content, raw_signal, activation, utility, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
         ON CONFLICT (node_id) DO NOTHING`,
        [
          nodeId,
          userId,
          projectId,
          sourceModule,
          signal.id ? String(signal.id) : null,
          layer,
          entities,
          content,
          JSON.stringify(signal.raw ?? signal),
          activation,
          activation * 0.8,
          JSON.stringify(signal.metadata || {}),
        ]
      );

      await this.addRelationalEdges(nodeId, userId, projectId, sourceModule, entities, layer, activation);
      await this.spreadActivation(nodeId, userId, projectId, activation);

      if (this.isCodingSource(sourceModule)) {
        await this.forgeCodingMetabolicChain(nodeId, userId, projectId, entities, content, activation);
      }

      if (signal.embedding) {
        await upsertVectors([{
          id: nodeId,
          vector: signal.embedding,
          payload: {
            type: 'metabolic_node',
            user_id: userId,
            project_id: projectId,
            source_module: sourceModule,
            layer,
            entity_keys: entities,
            content,
            activation,
          },
        }]);
      }
    } catch (err) {
      console.warn('[SynapseMetabolon] Failed to inject event:', err);
    }

    return { nodeId, layer, activation, entities };
  }

  async queryWithSpread(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 10
  ): Promise<SpreadingResult> {
    if (!this.isEnabled()) {
      return { summary: '', activatedNodes: [], confidence: 0, auditLog: [], activationPath: [] };
    }

    const auditLog: string[] = [];
    const activationPath: string[] = ['query_seed'];

    try {
      const queryEntities = this.extractEntities({ content: queryText }, 'query');
      const seedNodes = await this.findSeedNodes(queryText, userId, projectId, queryEntities, Math.max(limit, 5));
      auditLog.push(`found ${seedNodes.length} seed nodes for query`);

      if (seedNodes.length === 0) {
        return {
          summary: '',
          activatedNodes: [],
          confidence: 0,
          refusal: true,
          auditLog: [...auditLog, 'refused: no seed nodes'],
          activationPath: ['refused'],
        };
      }

      const activated = await this.runSpreadingActivation(
        seedNodes,
        userId,
        projectId,
        queryText,
        queryEntities
      );
      activationPath.push('spread');
      auditLog.push(`spread activation to ${activated.length} nodes`);

      const cycled = await this.runMetabolicCycle(activated, userId, projectId);
      activationPath.push('cycle');
      auditLog.push(`metabolic cycle: consolidated=${cycled.consolidated} audited=${cycled.audited}`);

      const final = cycled.nodes.slice(0, limit);
      const summary = await this.produceRefreshedSummary(final, queryText);
      auditLog.push(`produced ${summary.length} char summary`);

      const confidence = final.length > 0
        ? final.reduce((sum: number, n: any) => sum + Number(n.activation || 0), 0) / final.length
        : 0;

      return {
        summary,
        activatedNodes: final.map((n: any) => ({
          nodeId: n.node_id,
          layer: n.layer,
          sourceModule: n.source_module,
          entityKey: (n.entity_keys || [])[0] || 'general',
          content: n.content,
          activation: Number(n.activation || 0),
          createdAt: n.created_at,
        })),
        confidence,
        auditLog,
        activationPath,
      };
    } catch (err) {
      console.warn('[SynapseMetabolon] Query failed:', err);
      return { summary: '', activatedNodes: [], confidence: 0, auditLog, activationPath };
    }
  }

  async runConsolidationCycle(userId: number, projectId: string = 'default'): Promise<CycleResult> {
    if (!this.isEnabled()) {
      return { consolidated: 0, audited: 0, refreshed: 0, decayed: 0 };
    }

    const result: CycleResult = { consolidated: 0, audited: 0, refreshed: 0, decayed: 0 };

    try {
      const lowUtility = await query<any>(
        `SELECT node_id, activation, utility, created_at, layer, content
         FROM metabolic_nodes
         WHERE user_id = $1 AND project_id = $2 AND utility < $3
         ORDER BY utility ASC
         LIMIT 50`,
        [userId, projectId, this.config.activationThreshold * 2]
      );

      for (const node of lowUtility) {
        const age = Date.now() - new Date(node.created_at).getTime();
        const ageHours = age / (1000 * 60 * 60);

        if (node.activation < this.config.decayRate && ageHours > 24) {
          await execute(
            `UPDATE metabolic_nodes SET activation = GREATEST(0, activation - $1), utility = GREATEST(0, utility - $1) WHERE node_id = $2`,
            [this.config.decayRate * 0.5, node.node_id]
          );
          result.decayed++;
        } else if (ageHours > 48) {
          await execute(
            `UPDATE metabolic_nodes SET utility = utility * 0.9, updated_at = CURRENT_TIMESTAMP WHERE node_id = $1`,
            [node.node_id]
          );
          result.refreshed++;
        }
      }

      const highActivation = await query<any>(
        `SELECT node_id, activation, layer FROM metabolic_nodes
         WHERE user_id = $1 AND project_id = $2 AND activation > $3
         ORDER BY activation DESC
         LIMIT 20`,
        [userId, projectId, 0.7]
      );

      for (const node of highActivation) {
        await execute(
          `UPDATE metabolic_nodes SET utility = LEAST(1, utility + 0.1), updated_at = CURRENT_TIMESTAMP WHERE node_id = $1`,
          [node.node_id]
        );
        result.consolidated++;
      }

      result.audited = lowUtility.length;
    } catch (err) {
      console.warn('[SynapseMetabolon] Consolidation cycle failed:', err);
    }

    return result;
  }

  async buildMetabolicContext(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 5
  ): Promise<string> {
    const resolved = await this.queryWithSpread(queryText, userId, projectId, limit);
    if (!resolved.summary || resolved.activatedNodes.length === 0) return '';

    const lines = resolved.activatedNodes.slice(0, 5).map((n: any) =>
      `[${n.layer}] (${n.activation.toFixed(2)}) ${n.content?.slice(0, 120) || ''}`
    );

    return `\n\n### SynapseMetabolon Context (activation spread)\n${lines.join('\n')}\nConfidence: ${resolved.confidence.toFixed(2)}\nPath: ${resolved.activationPath.join(' → ')}`;
  }

  async getStats(userId: number, projectId: string = 'default'): Promise<any> {
    if (!this.isEnabled()) return { totalNodes: 0, totalEdges: 0, layers: {}, avgActivation: 0 };

    const [totalNodes, totalEdges, layerStats] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM metabolic_nodes WHERE user_id = $1 AND project_id = $2`, [userId, projectId]),
      query(`SELECT COUNT(*) as count FROM metabolic_edges WHERE source_node_id IN (SELECT node_id FROM metabolic_nodes WHERE user_id = $1 AND project_id = $2)`, [userId, projectId]),
      query(`SELECT layer, COUNT(*) as count, AVG(activation) as avg_act FROM metabolic_nodes WHERE user_id = $1 AND project_id = $2 GROUP BY layer`, [userId, projectId]),
    ]);

    const layers: Record<string, { count: number; avgActivation: number }> = {};
    for (const row of layerStats) {
      layers[row.layer] = { count: parseInt(row.count), avgActivation: parseFloat(row.avg_act) || 0 };
    }

    return {
      totalNodes: parseInt((totalNodes[0] as any).count),
      totalEdges: parseInt((totalEdges[0] as any).count),
      layers,
      avgActivation: layerStats.length > 0
        ? layerStats.reduce((sum: number, r: any) => sum + (parseFloat(r.avg_act) || 0), 0) / layerStats.length
        : 0,
    };
  }

  async getGraph(userId: number, limit: number = 30): Promise<any> {
    if (!this.isEnabled()) return { nodes: [], edges: [] };

    const [nodes, edges] = await Promise.all([
      query(`SELECT node_id, layer, source_module, entity_keys, content, activation, utility, created_at
             FROM metabolic_nodes
             WHERE user_id = $1
             ORDER BY activation DESC
             LIMIT $2`, [userId, limit]),
      query(`SELECT source_node_id, target_node_id, edge_type, weight, confidence
             FROM metabolic_edges
             WHERE source_node_id IN (SELECT node_id FROM metabolic_nodes WHERE user_id = $1)
             ORDER BY weight DESC
             LIMIT $2`, [userId, limit * 2]),
    ]);

    const enriched = nodes.map((n: any) => ({
      ...n,
      isCoding: CODE_SOURCES.some(s => n.source_module?.includes(s)),
    }));

    return { nodes: enriched, edges };
  }

  private async findSeedNodes(
    queryText: string,
    userId: number,
    projectId: string,
    queryEntities: string[],
    limit: number
  ): Promise<any[]> {
    const lower = queryText.toLowerCase();
    const wantsReasoning = /\b(why|how|cause|reason|explain|analyze|pattern|burnout|relationship)\b/.test(lower);
    const layerPriority = wantsReasoning ? "ARRAY['reasoning', 'audit', 'interaction']" : "ARRAY['interaction', 'reasoning', 'audit']";

    return query<any>(
      `SELECT node_id, layer, source_module, entity_keys, content, activation, utility, created_at
       FROM metabolic_nodes
       WHERE user_id = $1
         AND project_id = $2
         AND (entity_keys && $3::text[] OR layer = ANY(${layerPriority}))
       ORDER BY activation DESC, utility DESC, created_at DESC
       LIMIT $4`,
      [userId, projectId, queryEntities, limit]
    );
  }

  private async runSpreadingActivation(
    seedNodes: any[],
    userId: number,
    projectId: string,
    queryText: string,
    queryEntities: string[]
  ): Promise<any[]> {
    const activated = new Map<string, any>();
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; activation: number; depth: number }> = [];

    for (const node of seedNodes) {
      activated.set(node.node_id, { ...node, spreadActivation: node.activation });
      queue.push({ nodeId: node.node_id, activation: node.activation, depth: 0 });
      visited.add(node.node_id);
    }

    while (queue.length > 0 && activated.size < this.config.maxActivatedNodes) {
      const current = queue.shift()!;
      if (current.depth >= this.config.maxSpreadDepth) continue;
      if (current.activation < this.config.activationThreshold) continue;

      const neighbors = await query<any>(
        `SELECT me.target_node_id, me.edge_type, me.weight, mn.*
         FROM metabolic_edges me
         JOIN metabolic_nodes mn ON mn.node_id = me.target_node_id
         WHERE me.source_node_id = $1 AND mn.user_id = $2 AND mn.project_id = $3`,
        [current.nodeId, userId, projectId]
      );

      for (const neighbor of neighbors) {
        if (visited.has(neighbor.node_id)) continue;

        const spreadAmount = current.activation * (neighbor.weight || 0.5) * 0.6;
        if (spreadAmount < this.config.activationThreshold) continue;

        visited.add(neighbor.node_id);
        activated.set(neighbor.node_id, {
          ...neighbor,
          spreadActivation: spreadAmount,
          spreadFrom: current.nodeId,
          edgeType: neighbor.edge_type,
        });

        queue.push({ nodeId: neighbor.node_id, activation: spreadAmount, depth: current.depth + 1 });
      }
    }

    return Array.from(activated.values()).sort(
      (a, b) => (b.spreadActivation || b.activation) - (a.spreadActivation || a.activation)
    );
  }

  private async runMetabolicCycle(
    activated: any[],
    userId: number,
    projectId: string
  ): Promise<{ nodes: any[]; consolidated: number; audited: number }> {
    let consolidated = 0;
    let audited = 0;

    for (const node of activated) {
      if (node.spreadActivation > 0.7 && node.layer === 'reasoning') {
        consolidated++;
        node.spreadActivation = Math.min(1, node.spreadActivation + 0.1);
      }

      if (node.layer === 'audit' && node.spreadActivation < 0.3) {
        audited++;
      }
    }

    return { nodes: activated, consolidated, audited };
  }

  private async produceRefreshedSummary(nodes: any[], queryText: string): Promise<string> {
    if (nodes.length === 0) return '';

    const lower = queryText.toLowerCase();
    const wantsLongitudinal = /\b(over time|history|pattern|burnout|relationship|trajectory)\b/.test(lower);
    const wantsLatest = /\b(current|latest|resolved|recent)\b/.test(lower);

    const lines: string[] = [];

    if (wantsLongitudinal) {
      for (const n of nodes.slice(0, 6)) {
        const entity = (n.entity_keys || [])[0] || 'general';
        const act = (n.spreadActivation || n.activation || 0).toFixed(2);
        lines.push(`- ${entity}/${n.layer} [act:${act}]: ${String(n.content).slice(0, 120)}`);
      }
    } else if (wantsLatest) {
      for (const n of nodes.slice(0, 4)) {
        const entity = (n.entity_keys || [])[0] || 'general';
        lines.push(`- ${entity}/${n.layer}: ${String(n.content).slice(0, 180)}`);
      }
    } else {
      for (const n of nodes.slice(0, 5)) {
        const entity = (n.entity_keys || [])[0] || 'general';
        const act = (n.spreadActivation || n.activation || 0).toFixed(2);
        lines.push(`- ${entity}/${n.layer} [act:${act}]: ${String(n.content).slice(0, 160)}`);
      }
    }

    return lines.join('\n');
  }

  private async addRelationalEdges(
    nodeId: string,
    userId: number,
    projectId: string,
    sourceModule: string,
    entities: string[],
    layer: MetabolicLayer,
    activation: number
  ): Promise<void> {
    for (const entity of entities.slice(0, 6)) {
      const previous = await query<any>(
        `SELECT node_id, layer, activation FROM metabolic_nodes
         WHERE user_id = $1 AND project_id = $2 AND node_id <> $3
           AND entity_keys && ARRAY[$4]::text[]
         ORDER BY created_at DESC
         LIMIT 3`,
        [userId, projectId, nodeId, entity]
      );

      for (const row of previous) {
        const weight = this.computeEdgeWeight(row.layer, layer, row.activation, activation);
        const edgeType = this.computeEdgeType(row.layer, layer);

        await execute(
          `INSERT INTO metabolic_edges
            (source_node_id, target_node_id, edge_type, entity_keys, weight, confidence, provenance_module, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           ON CONFLICT (source_node_id, target_node_id, edge_type) DO UPDATE SET
             weight = GREATEST(metabolic_edges.weight, EXCLUDED.weight)`,
          [row.node_id, nodeId, edgeType, [entity, layer], weight, activation, sourceModule]
        );
      }
    }
  }

  private async spreadActivation(nodeId: string, userId: number, projectId: string, activation: number): Promise<void> {
    if (activation < this.config.activationThreshold * 2) return;

    const neighbors = await query<any>(
      `SELECT target_node_id, weight FROM metabolic_edges WHERE source_node_id = $1`,
      [nodeId]
    );

    for (const n of neighbors.slice(0, 5)) {
      const spreadAmount = activation * (n.weight || 0.5) * 0.3;
      if (spreadAmount < this.config.activationThreshold * 0.5) continue;

      await execute(
        `UPDATE metabolic_nodes SET activation = LEAST(1, activation + $1), utility = LEAST(1, utility + $2) WHERE node_id = $3`,
        [spreadAmount * 0.1, spreadAmount * 0.05, n.target_node_id]
      );
    }
  }

  private async forgeCodingMetabolicChain(
    nodeId: string,
    userId: number,
    projectId: string,
    entities: string[],
    content: string,
    activation: number
  ): Promise<void> {
    const lower = content.toLowerCase();
    const targets: string[] = [];
    if (/\b(debt|legacy|refactor|complexity|deadline|pressure)\b/.test(lower)) targets.push('burnout');
    if (/\b(team|review|handoff|communication|collaboration)\b/.test(lower)) targets.push('relationship');
    if (/\b(bug|error|crash|regression|failure)\b/.test(lower)) targets.push('bug');
    if (/\b(api|contract|endpoint|integration)\b/.test(lower)) targets.push('api');

    for (const target of targets) {
      const rows = await query<any>(
        `SELECT node_id FROM metabolic_nodes
         WHERE user_id = $1 AND project_id = $2 AND entity_keys && ARRAY[$3]::text[]
         ORDER BY activation DESC, created_at DESC
         LIMIT 2`,
        [userId, projectId, target]
      );

      for (const row of rows) {
        await execute(
          `INSERT INTO metabolic_edges
            (source_node_id, target_node_id, edge_type, entity_keys, weight, confidence, provenance_module, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           ON CONFLICT (source_node_id, target_node_id, edge_type) DO NOTHING`,
          [nodeId, row.node_id, 'coding_metabolic_link', [...entities, target], activation * 0.7, activation, 'synapse-metabolon']
        );
      }
    }
  }

  private determineLayer(signal: MetabolicSignal, sourceModule: string): MetabolicLayer {
    const content = this.extractContent(signal).toLowerCase();
    const tags = (signal.tags || []).join(' ').toLowerCase();
    const combined = `${content} ${tags} ${sourceModule.toLowerCase()}`;

    if (/\b(reflect|audit|review|analyze|evaluate|consolidate|assess)\b/.test(combined)) {
      return 'audit';
    }
    if (/\b(why|how|cause|reason|pattern|strategy|plan|design|architecture)\b/.test(combined)) {
      return 'reasoning';
    }
    return 'interaction';
  }

  private extractEntities(signal: MetabolicSignal, sourceModule: string): string[] {
    const content = this.extractContent(signal);
    const entities = new Set<string>((signal.tags || []).map(t => t.toLowerCase()));
    if (signal.entity) entities.add(signal.entity.toLowerCase());

    const lower = `${content} ${sourceModule}`.toLowerCase();
    if (/\b(code|repo|function|class|api|test|bug|debt|refactor)\b/.test(lower)) entities.add('code');
    if (/\b(bug|error|crash|regression|failed)\b/.test(lower)) entities.add('bug');
    if (/\b(burnout|stress|energy|tired|overwhelmed)\b/.test(lower)) entities.add('burnout');
    if (/\b(team|relationship|colleague|handoff|review)\b/.test(lower)) entities.add('relationship');

    if (entities.size === 0) entities.add('general');
    return [...entities].slice(0, 12);
  }

  private defaultActivation(layer: MetabolicLayer, signal: MetabolicSignal): number {
    let act = layer === 'reasoning' ? 0.65 : layer === 'audit' ? 0.55 : 0.45;
    if ((signal.tags || []).length > 0) act += 0.05;
    if (signal.outcomeScore !== undefined) act += (signal.outcomeScore - 0.5) * 0.2;
    return this.clamp(act, 0.05, 1);
  }

  private computeEdgeWeight(sourceLayer: string, targetLayer: string, sourceAct: number, targetAct: number): number {
    let base = 0.4;
    if (sourceLayer === targetLayer) base += 0.2;
    if (sourceLayer === 'interaction' && targetLayer === 'reasoning') base += 0.15;
    if (sourceLayer === 'reasoning' && targetLayer === 'audit') base += 0.15;
    return this.clamp(base + (sourceAct + targetAct) * 0.1, 0.1, 1);
  }

  private computeEdgeType(sourceLayer: string, targetLayer: string): string {
    if (sourceLayer === targetLayer) return 'semantic_same';
    if (sourceLayer === 'interaction' && targetLayer === 'reasoning') return 'elevated_to_reasoning';
    if (sourceLayer === 'reasoning' && targetLayer === 'audit') return 'flagged_for_audit';
    return 'temporal_linked';
  }

  private isCodingSource(sourceModule: string): boolean {
    const lower = sourceModule.toLowerCase();
    return CODE_SOURCES.some(s => lower.includes(s));
  }

  private extractContent(signal: MetabolicSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export const synapseMetabolon = new SynapseMetabolon();
