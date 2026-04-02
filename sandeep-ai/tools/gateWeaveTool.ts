// tools/gateWeaveTool.ts — GateWeave Tool: Memory Admission & Belief Versioning
import { BaseTool, ToolParameter } from './baseTool';
import { gateWeave } from '../core/gateWeave';

export class GateWeaveTool extends BaseTool {
  name = 'gateweave';
  description =
    'GateWeave: Adaptive Memory Admission Weaver — view admission stats, list versioned beliefs, ' +
    'get belief history, and tune scoring weights. Provides transparency into memory gating decisions.';

  parameters: ToolParameter = {
    type: 'object',
    description: 'Parameters for GateWeave operations',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['stats', 'list_beliefs', 'belief_history', 'tune_weights'],
      },
      user_id: {
        type: 'number',
        description: 'User ID',
      },
      project_id: {
        type: 'string',
        description: 'Project ID (defaults to "default")',
      },
      belief_id: {
        type: 'number',
        description: 'Belief ID for history lookup',
      },
      weights: {
        type: 'object',
        description: 'Scoring weight overrides: {utility, confidence, novelty, recency, toolRelevance}',
        properties: {
          utility: { type: 'number', description: 'Weight for future utility (0-1)' },
          confidence: { type: 'number', description: 'Weight for factual confidence (0-1)' },
          novelty: { type: 'number', description: 'Weight for semantic novelty (0-1)' },
          recency: { type: 'number', description: 'Weight for temporal recency (0-1)' },
          toolRelevance: { type: 'number', description: 'Weight for TIMPs tool relevance (0-1)' },
        },
      },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    this.validateParams(params);

    const { operation, user_id, project_id = 'default', belief_id, weights } = params;

    switch (operation) {
      case 'stats':
        return this.getStats(user_id);
      case 'list_beliefs':
        return this.listBeliefs(user_id, project_id);
      case 'belief_history':
        return this.getBeliefHistory(belief_id);
      case 'tune_weights':
        return this.tuneWeights(weights);
      default:
        return JSON.stringify({ error: `Unknown operation: ${operation}` });
    }
  }

  private async getStats(userId: number): Promise<string> {
    const stats = await gateWeave.getStats(userId);
    return JSON.stringify({
      operation: 'stats',
      ...stats,
      interpretation: stats.total_decisions > 0
        ? `GateWeave has processed ${stats.total_decisions} memories. ` +
          `${stats.admission_rate > 0 ? (stats.admission_rate * 100).toFixed(1) : 0}% were admitted (high-value). ` +
          `${stats.storage_savings_pct.toFixed(1)}% were gated (summarized or discarded), ` +
          `saving storage and improving retrieval precision. ` +
          `${stats.active_beliefs} active versioned beliefs are being tracked.`
        : 'No memories have been processed through GateWeave yet.',
    }, null, 2);
  }

  private async listBeliefs(userId: number, projectId: string): Promise<string> {
    const beliefs = await gateWeave.listBeliefs(userId, projectId);
    return JSON.stringify({
      operation: 'list_beliefs',
      count: beliefs.length,
      beliefs: beliefs.map(b => ({
        id: b.id,
        content: b.content.slice(0, 200),
        version: b.version,
        confidence: b.confidence,
        status: b.status,
        created_at: b.created_at,
      })),
    }, null, 2);
  }

  private async getBeliefHistory(beliefId: number | undefined): Promise<string> {
    if (!beliefId) {
      return JSON.stringify({ error: 'belief_id is required for belief_history operation' });
    }
    const history = await gateWeave.getBeliefHistory(beliefId);
    return JSON.stringify({
      operation: 'belief_history',
      chain_length: history.length,
      versions: history.map(b => ({
        id: b.id,
        version: b.version,
        content: b.content.slice(0, 200),
        confidence: b.confidence,
        status: b.status,
        parent_version_id: b.parent_version_id,
        created_at: b.created_at,
      })),
    }, null, 2);
  }

  private tuneWeights(weights: Record<string, number> | undefined): string {
    if (!weights) {
      return JSON.stringify({ error: 'weights object is required for tune_weights operation' });
    }
    gateWeave.setWeights(weights);
    return JSON.stringify({
      operation: 'tune_weights',
      message: 'Scoring weights updated and normalized.',
      new_weights: weights,
    }, null, 2);
  }
}
