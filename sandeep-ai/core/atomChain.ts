// core/atomChain.ts - Learnable atomic continuum with query-aware DAG-tag indexing

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export type AtomicOpType = 'create' | 'read' | 'update' | 'delete' | 'consolidate';

export interface AtomicSignal {
  id?: string | number;
  userId?: number;
  projectId?: string;
  content?: string;
  raw?: any;
  embedding?: number[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface AtomicResult {
  nodeId: string;
  opType: AtomicOpType;
  tags: string[];
  policyUtility: number;
}

const OP_DEFAULTS: Record<AtomicOpType, number> = {
  create: 0.55,
  read: 0.5,
  update: 0.5,
  delete: 0.35,
  consolidate: 0.6,
};

export class AtomChain {
  isEnabled(): boolean {
    return process.env.ENABLE_ATOMCHAIN !== 'false';
  }

  async executeAtomic(
    signal: AtomicSignal,
    sourceModule: string,
    opType: AtomicOpType = 'create',
    outcomeScore: number = 0.5
  ): Promise<AtomicResult> {
    const nodeId = crypto.randomUUID();
    const userId = signal.userId || 1;
    const projectId = signal.projectId || 'default';
    const content = this.extractContent(signal);
    const tags = this.extractIntentTags(content, sourceModule, signal.tags || []);
    const policyUtility = await this.updatePolicyUtility(opType, sourceModule, outcomeScore, userId, projectId);

    if (this.isEnabled()) {
      try {
        await execute(
          `INSERT INTO atomic_nodes
            (node_id, user_id, project_id, source_module, source_record_id, op_type, tags, content, metadata, utility, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (node_id) DO NOTHING`,
          [
            nodeId,
            userId,
            projectId,
            sourceModule,
            signal.id ? String(signal.id) : null,
            opType,
            tags,
            content,
            JSON.stringify(signal.metadata || {}),
            policyUtility,
          ]
        );

        await this.chainTemporal(nodeId, userId, projectId, sourceModule, tags, policyUtility);
        await this.coConsolidateTags(nodeId, tags, policyUtility);

        if (this.isCodingSource(sourceModule)) {
          await this.chainCodingAtomic(nodeId, userId, projectId, tags, policyUtility);
        }

        if (policyUtility < 0.32 || opType === 'delete') {
          await this.pruneLowUtility(nodeId, policyUtility);
        }

        if (signal.embedding) {
          await upsertVectors([{
            id: nodeId,
            vector: signal.embedding,
            payload: {
              type: 'atomic_node',
              user_id: userId,
              project_id: projectId,
              source_module: sourceModule,
              op_type: opType,
              tags,
              utility: policyUtility,
              content,
            },
          }]);
        }
      } catch (err) {
        console.warn('[AtomChain] Failed to execute atomic op:', err);
      }
    }

    return { nodeId, opType, tags, policyUtility };
  }

  async queryAwareRetrieve(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 6
  ): Promise<Array<{ nodeId: string; content: string; tags: string[]; sourceModule: string; relevance: number }>> {
    const tags = this.extractIntentTags(queryText, 'query', []);

    try {
      const rows = await query<any>(
        `SELECT
           node_id,
           content,
           tags,
           source_module,
           utility,
           (
             utility * 0.6 +
             (SELECT COUNT(*)::float FROM unnest(tags) t WHERE t = ANY($3)) * 0.2
           ) AS relevance
         FROM atomic_nodes
         WHERE user_id = $1
           AND project_id = $2
           AND tags && $3::text[]
           AND pruned = FALSE
         ORDER BY relevance DESC, updated_at DESC
         LIMIT $4`,
        [userId, projectId, tags, limit]
      );

      return rows.map(row => ({
        nodeId: row.node_id,
        content: row.content,
        tags: row.tags || [],
        sourceModule: row.source_module,
        relevance: Number(row.relevance || 0),
      }));
    } catch {
      return [];
    }
  }

  async buildAtomicContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 5): Promise<string> {
    if (!this.isEnabled()) return '';

    const items = await this.queryAwareRetrieve(queryText, userId, projectId, limit);
    if (items.length === 0) return '';

    return `\n\n### Atomic Continuum Context (AtomChain)\n${items
      .map(item => `- ${item.content.slice(0, 180)} [${item.sourceModule}; tags=${item.tags.slice(0, 5).join(',')}; score=${item.relevance.toFixed(2)}]`)
      .join('\n')}`;
  }

  private async updatePolicyUtility(
    opType: AtomicOpType,
    sourceModule: string,
    outcomeScore: number,
    userId: number,
    projectId: string
  ): Promise<number> {
    const current = await this.getPolicyUtility(opType, userId, projectId);
    const delta = 0.11 * (this.clamp(outcomeScore, 0, 1) - 0.5);
    const next = this.clamp(current + delta, 0.1, 1.0);

    if (this.isEnabled()) {
      await execute(
        `INSERT INTO atomic_policy_utilities
          (op_type, user_id, project_id, source_module, utility, version, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 1, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (op_type, user_id, project_id) DO UPDATE SET
           utility = EXCLUDED.utility,
           version = atomic_policy_utilities.version + 1,
           source_module = EXCLUDED.source_module,
           metadata = EXCLUDED.metadata,
           updated_at = CURRENT_TIMESTAMP`,
        [opType, userId, projectId, sourceModule, next, JSON.stringify({ last_delta: delta })]
      );
    }

    return next;
  }

  private async getPolicyUtility(opType: AtomicOpType, userId: number, projectId: string): Promise<number> {
    try {
      const rows = await query<{ utility: number }>(
        'SELECT utility FROM atomic_policy_utilities WHERE op_type = $1 AND user_id = $2 AND project_id = $3',
        [opType, userId, projectId]
      );
      return Number(rows[0]?.utility ?? OP_DEFAULTS[opType]);
    } catch {
      return OP_DEFAULTS[opType];
    }
  }

  private async chainTemporal(
    nodeId: string,
    userId: number,
    projectId: string,
    sourceModule: string,
    tags: string[],
    weight: number
  ): Promise<void> {
    const prev = await query<{ node_id: string }>(
      `SELECT node_id FROM atomic_nodes
       WHERE user_id = $1 AND project_id = $2 AND node_id <> $3
       ORDER BY created_at DESC LIMIT 1`,
      [userId, projectId, nodeId]
    );

    if (prev[0]) {
      await this.insertAtomicEdge(prev[0].node_id, nodeId, 'temporal_next', tags, weight, sourceModule);
    }
  }

  private async coConsolidateTags(nodeId: string, tags: string[], weight: number): Promise<void> {
    for (const tag of tags.slice(0, 8)) {
      await execute(
        `INSERT INTO atomic_tag_index (tag, node_id, weight, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (tag, node_id) DO UPDATE SET
           weight = GREATEST(atomic_tag_index.weight, EXCLUDED.weight),
           updated_at = CURRENT_TIMESTAMP`,
        [tag, nodeId, weight]
      );
    }
  }

  private async chainCodingAtomic(
    nodeId: string,
    userId: number,
    projectId: string,
    tags: string[],
    weight: number
  ): Promise<void> {
    const targets = await query<{ node_id: string; source_module: string }>(
      `SELECT node_id, source_module FROM atomic_nodes
       WHERE user_id = $1
         AND project_id = $2
         AND source_module IN ('burnout_seismograph', 'relationship_intelligence', 'skill_shadow')
       ORDER BY utility DESC, updated_at DESC
       LIMIT 3`,
      [userId, projectId]
    );

    for (const target of targets) {
      await this.insertAtomicEdge(nodeId, target.node_id, 'coding_to_longitudinal', tags, weight, target.source_module);
    }
  }

  private async insertAtomicEdge(
    sourceNodeId: string,
    targetNodeId: string,
    edgeType: string,
    tags: string[],
    weight: number,
    provenanceModule: string
  ): Promise<void> {
    await execute(
      `INSERT INTO atomic_edges
        (source_node_id, target_node_id, edge_type, tags, weight, provenance_module, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (source_node_id, target_node_id, edge_type) DO UPDATE SET
         weight = LEAST(1.0, atomic_edges.weight + EXCLUDED.weight * 0.1),
         updated_at = CURRENT_TIMESTAMP`,
      [sourceNodeId, targetNodeId, edgeType, tags, weight, provenanceModule]
    );
  }

  private async pruneLowUtility(nodeId: string, utility: number): Promise<void> {
    await execute(
      `UPDATE atomic_nodes
       SET pruned = TRUE,
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE node_id = $1`,
      [nodeId, JSON.stringify({ pruned_reason: 'low policy utility', utility })]
    );
  }

  private extractIntentTags(content: string, sourceModule: string, providedTags: string[]): string[] {
    const tags = new Set(providedTags.map(tag => tag.toLowerCase()));
    const lower = `${content} ${sourceModule}`.toLowerCase();

    if (/\b(code|repo|function|class|api|test|bug|debt|refactor)\b/.test(lower)) tags.add('code');
    if (/\b(bug|error|crash|regression|failed)\b/.test(lower)) tags.add('bug');
    if (/\b(debt|legacy|refactor|complexity)\b/.test(lower)) tags.add('tech-debt');
    if (/\b(burnout|stress|energy|tired|overwhelmed)\b/.test(lower)) tags.add('burnout');
    if (/\b(team|relationship|colleague|handoff|review)\b/.test(lower)) tags.add('relationship');
    if (/\b(pattern|history|trajectory|over time|again)\b/.test(lower)) tags.add('long-horizon');
    if (/\b(today|yesterday|week|month|deadline|\d{4})\b/.test(lower)) tags.add('temporal');
    if (tags.size === 0) tags.add('general');

    return [...tags].slice(0, 12);
  }

  private isCodingSource(sourceModule: string): boolean {
    return /\b(code|cli|bug|debt|api|codebase)\b/i.test(sourceModule);
  }

  private extractContent(signal: AtomicSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export const atomChain = new AtomChain();
