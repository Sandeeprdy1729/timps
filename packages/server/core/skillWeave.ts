// core/skillWeave.ts - Meta-learned memory skills with policy-optimized self-management

import { execute, query } from '../db/postgres';

export type MemorySkillKind = 'extract' | 'consolidate' | 'prune' | 'route';

export interface SkillSignal {
  content?: string;
  raw?: any;
  tags?: string[];
  metadata?: Record<string, any>;
  userId?: number;
  projectId?: string;
}

export interface SkillWeaveResult {
  skillId: string;
  selectedSkills: string[];
  utility: number;
  action: MemorySkillKind;
  processed: {
    content: string;
    summary: string;
    shouldRetain: boolean;
    retentionTier: 'raw' | 'episodic' | 'semantic';
  };
}

const SKILL_TEMPLATES: Array<{ id: string; kind: MemorySkillKind; patterns: RegExp[]; tags: string[] }> = [
  { id: 'code_debt_to_burnout', kind: 'consolidate', patterns: [/\b(debt|legacy|refactor|complexity|flaky)\b/i], tags: ['code', 'burnout', 'risk'] },
  { id: 'bug_pattern_extract', kind: 'extract', patterns: [/\b(bug|error|crash|failed test|regression)\b/i], tags: ['code', 'bug'] },
  { id: 'relationship_signal_route', kind: 'route', patterns: [/\b(team|relationship|colleague|handoff|review)\b/i], tags: ['relationship'] },
  { id: 'burnout_signal_extract', kind: 'extract', patterns: [/\b(burnout|stress|tired|drained|overwhelmed)\b/i], tags: ['burnout'] },
  { id: 'low_signal_prune', kind: 'prune', patterns: [/^.{0,60}$/s], tags: ['prune'] },
  { id: 'long_horizon_consolidate', kind: 'consolidate', patterns: [/\b(pattern|trajectory|history|over time|keeps happening)\b/i], tags: ['long-horizon'] },
];

export class SkillWeave {
  isEnabled(): boolean {
    return process.env.ENABLE_SKILLWEAVE !== 'false';
  }

  async evolveAndApply(
    signal: SkillSignal,
    sourceModule: string,
    outcomeScore: number = 0.5
  ): Promise<SkillWeaveResult> {
    const content = this.extractContent(signal);
    const selectedSkills = this.selectPolicySkills(content, sourceModule);
    const skillId = selectedSkills[0] || this.deriveSkillId(content, sourceModule);
    const action = this.skillKind(skillId);
    const userId = signal.userId || 1;
    const projectId = signal.projectId || 'default';
    const utility = await this.updateSkillUtility(skillId, sourceModule, outcomeScore, userId, projectId);
    const processed = this.composeSkills(selectedSkills, content, utility);

    if (this.isEnabled()) {
      try {
        await execute(
          `INSERT INTO skill_weave_events
            (skill_id, user_id, project_id, source_module, selected_skills, action, content, processed, outcome_score, utility, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
          [
            skillId,
            userId,
            projectId,
            sourceModule,
            selectedSkills,
            action,
            content,
            JSON.stringify(processed),
            this.clamp(outcomeScore, 0, 1),
            utility,
          ]
        );

        if (utility < 0.35 || !processed.shouldRetain) {
          await this.markPruned(skillId, sourceModule, userId, projectId);
        }
      } catch (err) {
        console.warn('[SkillWeave] Failed to persist skill event:', err);
      }
    }

    return { skillId, selectedSkills, utility, action, processed };
  }

  async policyContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 5): Promise<string> {
    if (!this.isEnabled()) return '';
    const selected = this.selectPolicySkills(queryText, 'query');

    try {
      const rows = await query<{ skill_id: string; utility: number; source_module: string; action: string }>(
        `SELECT skill_id, utility, source_module, action
         FROM skill_policies
         WHERE user_id = $1
           AND project_id = $2
           AND (skill_id = ANY($3) OR utility >= 0.65)
         ORDER BY utility DESC, updated_at DESC
         LIMIT $4`,
        [userId, projectId, selected, limit]
      );

      if (rows.length === 0) return '';
      return `\n\n### Evolving Skill Policy (SkillWeave)\n${rows
        .map(row => `- ${row.skill_id} (${row.action}; utility=${Number(row.utility).toFixed(2)}; source=${row.source_module})`)
        .join('\n')}`;
    } catch {
      return '';
    }
  }

  private async updateSkillUtility(
    skillId: string,
    sourceModule: string,
    outcomeScore: number,
    userId: number,
    projectId: string
  ): Promise<number> {
    const delta = 0.09 * (this.clamp(outcomeScore, 0, 1) - 0.5);
    const current = await this.getSkillUtility(skillId, userId, projectId);
    const next = this.clamp(current + delta, 0.1, 1.0);
    const action = this.skillKind(skillId);

    if (this.isEnabled()) {
      await execute(
        `INSERT INTO skill_policies
          (skill_id, user_id, project_id, source_module, action, utility, version, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (skill_id, user_id, project_id) DO UPDATE SET
           utility = EXCLUDED.utility,
           version = skill_policies.version + 1,
           source_module = EXCLUDED.source_module,
           action = EXCLUDED.action,
           updated_at = CURRENT_TIMESTAMP`,
        [skillId, userId, projectId, sourceModule, action, next, JSON.stringify({ last_delta: delta })]
      );
    }

    return next;
  }

  private async getSkillUtility(skillId: string, userId: number, projectId: string): Promise<number> {
    try {
      const rows = await query<{ utility: number }>(
        'SELECT utility FROM skill_policies WHERE skill_id = $1 AND user_id = $2 AND project_id = $3',
        [skillId, userId, projectId]
      );
      return Number(rows[0]?.utility ?? 0.5);
    } catch {
      return 0.5;
    }
  }

  private async markPruned(skillId: string, sourceModule: string, userId: number, projectId: string): Promise<void> {
    await execute(
      `INSERT INTO skill_weave_events
        (skill_id, user_id, project_id, source_module, selected_skills, action, content, processed, outcome_score, utility, created_at)
       VALUES ($1, $2, $3, $4, $5, 'prune', 'low-utility skill policy', $6, 0.0, 0.1, CURRENT_TIMESTAMP)`,
      [skillId, userId, projectId, sourceModule, [skillId], JSON.stringify({ shouldRetain: false, reason: 'low utility' })]
    );
  }

  private selectPolicySkills(content: string, sourceModule: string): string[] {
    const selected = SKILL_TEMPLATES
      .filter(template => template.patterns.some(pattern => pattern.test(content)) || template.tags.some(tag => sourceModule.toLowerCase().includes(tag)))
      .map(template => template.id);

    if (sourceModule.toLowerCase().includes('code') || sourceModule.toLowerCase().includes('cli')) {
      selected.push('code_debt_to_burnout');
    }

    return [...new Set(selected)].slice(0, 4);
  }

  private composeSkills(selectedSkills: string[], content: string, utility: number): SkillWeaveResult['processed'] {
    const lowSignal = selectedSkills.includes('low_signal_prune') && utility < 0.45;
    const shouldRetain = !lowSignal && content.trim().length > 20;
    const retentionTier = utility > 0.72 ? 'semantic' : utility > 0.42 ? 'episodic' : 'raw';

    return {
      content,
      summary: content.replace(/\s+/g, ' ').trim().slice(0, 240),
      shouldRetain,
      retentionTier,
    };
  }

  private deriveSkillId(content: string, sourceModule: string): string {
    const source = sourceModule.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'general';
    if (/\b(code|bug|debt|api|repo|test)\b/i.test(content)) return `${source}_code_extract`;
    if (/\b(burnout|stress|relationship|team)\b/i.test(content)) return `${source}_human_signal_route`;
    return `${source}_memory_consolidate`;
  }

  private skillKind(skillId: string): MemorySkillKind {
    const template = SKILL_TEMPLATES.find(item => item.id === skillId);
    if (template) return template.kind;
    if (skillId.includes('prune')) return 'prune';
    if (skillId.includes('route')) return 'route';
    if (skillId.includes('extract')) return 'extract';
    return 'consolidate';
  }

  private extractContent(signal: SkillSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export const skillWeave = new SkillWeave();
