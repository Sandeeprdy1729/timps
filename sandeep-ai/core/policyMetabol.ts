// core/policyMetabol.ts - Runtime RL memory governor with write-manage-read policy loop

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export type MetabolAction = 'write' | 'manage' | 'read' | 'govern' | 'consolidate';

export interface MetabolSignal {
  id?: string | number;
  userId?: number;
  projectId?: string;
  content?: string;
  raw?: any;
  embedding?: number[];
  tags?: string[];
  queryContext?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface PolicyMetabolResult {
  nodeId: string;
  actionType: string;
  phase: MetabolAction;
  utility: number;
  governed: boolean;
  guidedRead: Array<{ nodeId: string; content: string; utility: number; actionType: string }>;
}

const DEFAULT_ACTION_UTILITY = 0.5;

export class PolicyMetabol {
  isEnabled(): boolean {
    return process.env.ENABLE_POLICYMETABOL !== 'false';
  }

  async runLoop(
    signal: MetabolSignal,
    sourceModule: string,
    outcomeScore: number = 0.5
  ): Promise<PolicyMetabolResult> {
    const nodeId = crypto.randomUUID();
    const userId = signal.userId || 1;
    const projectId = signal.projectId || 'default';
    const content = this.extractContent(signal);
    const actionType = this.deriveActionType(content, sourceModule);
    const phase = this.derivePhase(content, sourceModule);
    const utility = await this.updatePolicyUtility(actionType, phase, sourceModule, outcomeScore, userId, projectId);
    const governed = utility < 0.35;

    if (this.isEnabled()) {
      try {
        await execute(
          `INSERT INTO metabol_nodes
            (node_id, user_id, project_id, source_module, source_record_id, action_type,
             phase, content, tags, utility, governed, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (node_id) DO NOTHING`,
          [
            nodeId,
            userId,
            projectId,
            sourceModule,
            signal.id ? String(signal.id) : null,
            actionType,
            phase,
            content,
            signal.tags || this.tagsFor(content, sourceModule),
            utility,
            governed,
            JSON.stringify(signal.metadata || {}),
          ]
        );

        await this.recordEpisode(nodeId, userId, projectId, sourceModule, actionType, phase, outcomeScore, utility);

        if (governed) {
          await this.governPrune(nodeId, actionType, utility);
        }

        if (this.isCodingSource(sourceModule)) {
          await this.reinforceCodingLink(nodeId, userId, projectId, actionType, utility);
        }

        if (signal.embedding) {
          await upsertVectors([{
            id: nodeId,
            vector: signal.embedding,
            payload: {
              type: 'policy_metabol_node',
              user_id: userId,
              project_id: projectId,
              source_module: sourceModule,
              action_type: actionType,
              phase,
              utility,
              governed,
              content,
            },
          }]);
        }
      } catch (err) {
        console.warn('[PolicyMetabol] Failed to run memory policy loop:', err);
      }
    }

    const guidedRead = await this.policyGuidedRetrieve(signal.queryContext || content, userId, projectId, 4);
    return { nodeId, actionType, phase, utility, governed, guidedRead };
  }

  async policyGuidedRetrieve(
    context: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 6
  ): Promise<Array<{ nodeId: string; content: string; utility: number; actionType: string }>> {
    if (!this.isEnabled()) return [];

    const tags = this.tagsFor(context, 'query');
    try {
      const rows = await query<any>(
        `SELECT node_id, content, utility, action_type
         FROM metabol_nodes
         WHERE user_id = $1
           AND project_id = $2
           AND governed = FALSE
           AND (tags && $3::text[] OR utility >= 0.7)
         ORDER BY utility DESC, updated_at DESC
         LIMIT $4`,
        [userId, projectId, tags, limit]
      );

      return rows.map(row => ({
        nodeId: row.node_id,
        content: row.content,
        utility: Number(row.utility || 0),
        actionType: row.action_type,
      }));
    } catch {
      return [];
    }
  }

  async buildPolicyContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 5): Promise<string> {
    const items = await this.policyGuidedRetrieve(queryText, userId, projectId, limit);
    if (items.length === 0) return '';

    return `\n\n### PolicyMetabol Governance Context\n${items
      .map(item => `- ${item.actionType}: ${item.content.slice(0, 180)} [utility=${item.utility.toFixed(2)}]`)
      .join('\n')}`;
  }

  private async updatePolicyUtility(
    actionType: string,
    phase: MetabolAction,
    sourceModule: string,
    outcomeScore: number,
    userId: number,
    projectId: string
  ): Promise<number> {
    const current = await this.getPolicyUtility(actionType, userId, projectId);
    const delta = 0.10 * (this.clamp(outcomeScore, 0, 1) - 0.5);
    const next = this.clamp(current + delta, 0.1, 1.0);

    if (this.isEnabled()) {
      await execute(
        `INSERT INTO metabol_policy_utilities
          (action_type, user_id, project_id, source_module, phase, utility, version, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (action_type, user_id, project_id) DO UPDATE SET
           utility = EXCLUDED.utility,
           phase = EXCLUDED.phase,
           source_module = EXCLUDED.source_module,
           version = metabol_policy_utilities.version + 1,
           metadata = EXCLUDED.metadata,
           updated_at = CURRENT_TIMESTAMP`,
        [actionType, userId, projectId, sourceModule, phase, next, JSON.stringify({ last_delta: delta })]
      );
    }

    return next;
  }

  private async getPolicyUtility(actionType: string, userId: number, projectId: string): Promise<number> {
    try {
      const rows = await query<{ utility: number }>(
        'SELECT utility FROM metabol_policy_utilities WHERE action_type = $1 AND user_id = $2 AND project_id = $3',
        [actionType, userId, projectId]
      );
      return Number(rows[0]?.utility ?? DEFAULT_ACTION_UTILITY);
    } catch {
      return DEFAULT_ACTION_UTILITY;
    }
  }

  private async recordEpisode(
    nodeId: string,
    userId: number,
    projectId: string,
    sourceModule: string,
    actionType: string,
    phase: MetabolAction,
    outcomeScore: number,
    utility: number
  ): Promise<void> {
    await execute(
      `INSERT INTO metabol_episodes
        (node_id, user_id, project_id, source_module, action_type, phase, outcome_score, utility, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [nodeId, userId, projectId, sourceModule, actionType, phase, this.clamp(outcomeScore, 0, 1), utility]
    );
  }

  private async governPrune(nodeId: string, actionType: string, utility: number): Promise<void> {
    await execute(
      `UPDATE metabol_nodes
       SET governed = TRUE,
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE node_id = $1`,
      [nodeId, JSON.stringify({ governed_reason: 'low runtime policy utility', action_type: actionType, utility })]
    );
  }

  private async reinforceCodingLink(
    nodeId: string,
    userId: number,
    projectId: string,
    actionType: string,
    utility: number
  ): Promise<void> {
    const targets = await query<{ node_id: string }>(
      `SELECT node_id FROM metabol_nodes
       WHERE user_id = $1
         AND project_id = $2
         AND node_id <> $3
         AND (tags && ARRAY['burnout','relationship','code']::text[])
       ORDER BY utility DESC, updated_at DESC
       LIMIT 3`,
      [userId, projectId, nodeId]
    );

    for (const target of targets) {
      await execute(
        `INSERT INTO metabol_links
          (source_node_id, target_node_id, link_type, action_type, utility, created_at, updated_at)
         VALUES ($1, $2, 'coding_reinforcement', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (source_node_id, target_node_id, link_type) DO UPDATE SET
           utility = GREATEST(metabol_links.utility, EXCLUDED.utility),
           updated_at = CURRENT_TIMESTAMP`,
        [nodeId, target.node_id, actionType, utility]
      );
    }
  }

  private deriveActionType(content: string, sourceModule: string): string {
    const lower = `${content} ${sourceModule}`.toLowerCase();
    if (/\b(code|bug|debt|refactor|api|test)\b/.test(lower) && /\b(burnout|stress|energy)\b/.test(lower)) return 'code_to_burnout_write';
    if (/\b(code|bug|debt|refactor|api|test)\b/.test(lower)) return 'coding_signal_manage';
    if (/\b(relationship|team|handoff|review)\b/.test(lower)) return 'relationship_signal_route';
    if (/\b(resolved|fixed|supersede|decision|fact)\b/.test(lower)) return 'knowledge_supersession_manage';
    if (/\b(read|retrieve|query|search)\b/.test(lower)) return 'policy_guided_read';
    return 'general_memory_write';
  }

  private derivePhase(content: string, sourceModule: string): MetabolAction {
    const lower = `${content} ${sourceModule}`.toLowerCase();
    if (/\b(read|retrieve|query|search)\b/.test(lower)) return 'read';
    if (/\b(prune|forget|deprecate|stale)\b/.test(lower)) return 'govern';
    if (/\b(pattern|consolidate|summary|trajectory)\b/.test(lower)) return 'consolidate';
    if (/\b(update|resolved|fixed|supersede)\b/.test(lower)) return 'manage';
    return 'write';
  }

  private tagsFor(content: string, sourceModule: string): string[] {
    const tags = new Set<string>();
    const lower = `${content} ${sourceModule}`.toLowerCase();
    if (/\b(code|bug|debt|api|repo|test|refactor)\b/.test(lower)) tags.add('code');
    if (/\b(burnout|stress|energy|tired)\b/.test(lower)) tags.add('burnout');
    if (/\b(team|relationship|colleague|handoff)\b/.test(lower)) tags.add('relationship');
    if (/\b(fact|decision|resolved|supersede|contract)\b/.test(lower)) tags.add('knowledge');
    if (/\b(pattern|history|again|over time)\b/.test(lower)) tags.add('episodic');
    if (tags.size === 0) tags.add('general');
    return [...tags];
  }

  private isCodingSource(sourceModule: string): boolean {
    return /\b(code|cli|bug|debt|api|codebase|timps-code)\b/i.test(sourceModule);
  }

  private extractContent(signal: MetabolSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export const policyMetabol = new PolicyMetabol();
