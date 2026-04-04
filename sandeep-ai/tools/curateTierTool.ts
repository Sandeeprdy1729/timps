// tools/curateTierTool.ts — Tool 18: CurateTier (Agent-Native Hierarchical Curation)
import { BaseTool, ToolParameter } from './baseTool';
import { curateTier, CurationInput } from '../core/curateTier';

export class CurateTierTool extends BaseTool {
  name = 'curate_tier';
  description = 'Tool 18 — CurateTier: Agent-native hierarchical curation engine. Curates memories into three tiers (raw/episodic/semantic) with adaptive gating and propagation to relevant tools.';

  parameters: ToolParameter = {
    type: 'object',
    description: 'Parameters for CurateTier operations',
    properties: {
      operation: {
        type: 'string',
        enum: ['curate', 'distribution', 'recent', 'evolve'],
        description: 'curate: score & tier-assign a memory | distribution: get tier stats | recent: recent decisions | evolve: compute tier summaries',
      },
      user_id: { type: 'number', description: 'User ID' },
      content: { type: 'string', description: 'Memory content to curate (for curate operation)' },
      tags: {
        type: 'string',
        description: 'Comma-separated tags for the memory',
      },
      importance: { type: 'number', description: 'Importance score 1-5 (default: 1)' },
      memory_type: { type: 'string', description: 'Memory type: explicit or reflection' },
      source: {
        type: 'string',
        description: 'Source context: reflection | coding | tool-output | user-explicit',
      },
      memory_id: { type: 'number', description: 'Existing memory row ID (optional, for updating)' },
      limit: { type: 'number', description: 'Number of recent decisions to return (default: 20)' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, content, tags, importance, memory_type, source, memory_id, limit } = params;

    switch (operation) {
      case 'curate':
        return this.curateMemory(user_id, content, tags, importance, memory_type, source, memory_id);
      case 'distribution':
        return this.getDistribution(user_id);
      case 'recent':
        return this.getRecent(user_id, limit);
      case 'evolve':
        return this.runEvolve(user_id);
      default:
        return JSON.stringify({ error: `Unknown operation: ${operation}` });
    }
  }

  private async curateMemory(
    userId: number,
    content: string,
    tagsStr: string,
    importance: number,
    memoryType: string,
    source: string,
    memoryId?: number
  ): Promise<string> {
    if (!content) {
      return JSON.stringify({ error: 'Content is required for curate operation' });
    }

    const input: CurationInput = {
      content,
      tags: tagsStr ? tagsStr.split(',').map(t => t.trim()) : [],
      importance: importance || 1,
      memoryType: memoryType || 'explicit',
      source: source || 'reflection',
      memoryId,
    };

    const result = await curateTier.curate(input, userId);

    return JSON.stringify({
      status: result.gated ? 'gated' : 'curated',
      tier: result.tier,
      curation_score: Math.round(result.score * 1000) / 1000,
      gated: result.gated,
      propagated_to: result.propagatedTo,
      message: result.gated
        ? `Memory gated (score ${result.score.toFixed(3)} below threshold). Stored as raw but marked for compression.`
        : `Memory curated into ${result.tier} tier (score ${result.score.toFixed(3)}).${result.propagatedTo.length > 0 ? ` Propagated to: ${result.propagatedTo.join(', ')}` : ''}`,
    });
  }

  private async getDistribution(userId: number): Promise<string> {
    const distribution = await curateTier.getTierDistribution(userId);

    if (distribution.length === 0) {
      return JSON.stringify({ message: 'No curated memories yet. Use curate operation to start building tier hierarchy.' });
    }

    return JSON.stringify({
      distribution,
      total: distribution.reduce((sum, d) => sum + Number(d.count), 0),
      message: 'Tier distribution for user memory hierarchy.',
    });
  }

  private async getRecent(userId: number, limit?: number): Promise<string> {
    const decisions = await curateTier.getRecentDecisions(userId, limit || 20);
    return JSON.stringify({
      decisions: decisions.map(d => ({
        tier: d.tier,
        score: d.curation_score,
        gated: d.gated,
        source: d.source_type,
        propagated: d.propagated_to,
        created: d.created_at,
      })),
      count: decisions.length,
    });
  }

  private async runEvolve(userId: number): Promise<string> {
    await curateTier.evolve(userId);
    const distribution = await curateTier.getTierDistribution(userId);
    return JSON.stringify({
      message: 'Tier evolution complete. Summaries computed.',
      distribution,
    });
  }
}
