// core/echoForge.ts - Multi-agent episodic context reconstructor with intent grounding

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export interface EchoSignal {
  id?: string | number;
  userId?: number;
  projectId?: string;
  content?: string;
  raw?: any;
  embedding?: number[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface EchoHierarchy {
  intentTags: string[];
  gist: string;
  evidenceCount: number;
  causalTargets: string[];
}

export interface EchoResult {
  segmentId: string;
  hierarchy: EchoHierarchy;
  evidence: string;
}

export class EchoForge {
  isEnabled(): boolean {
    return process.env.ENABLE_ECHOFORGE !== 'false';
  }

  async runReconstruction(
    signal: EchoSignal,
    sourceModule: string,
    intentContext: string = 'general'
  ): Promise<EchoResult> {
    const segmentId = crypto.randomUUID();
    const userId = signal.userId || 1;
    const projectId = signal.projectId || 'default';
    const rawContext = this.extractContent(signal);
    const intentTags = this.intentTags(`${rawContext} ${intentContext}`, sourceModule, signal.tags || []);
    const evidence = this.assistantLocalReason(rawContext, sourceModule, intentTags);
    const hierarchy = this.masterCurate([evidence], intentTags, intentContext);

    if (this.isEnabled()) {
      try {
        await execute(
          `INSERT INTO echo_segments
            (segment_id, user_id, project_id, source_module, source_record_id,
             raw_context, local_evidence, intent_tags, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
           ON CONFLICT (segment_id) DO NOTHING`,
          [
            segmentId,
            userId,
            projectId,
            sourceModule,
            signal.id ? String(signal.id) : null,
            rawContext,
            evidence,
            intentTags,
            JSON.stringify(signal.metadata || {}),
          ]
        );

        await execute(
          `INSERT INTO echo_hierarchies
            (hierarchy_id, user_id, project_id, segment_id, intent_tags, gist,
             hierarchy, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (hierarchy_id) DO NOTHING`,
          [crypto.randomUUID(), userId, projectId, segmentId, hierarchy.intentTags, hierarchy.gist, JSON.stringify(hierarchy)]
        );

        await this.propagateCausalLinks(segmentId, userId, projectId, hierarchy);

        if (this.isCodingSource(sourceModule)) {
          await this.forgeCodingReconstruction(segmentId, userId, projectId, hierarchy);
        }

        if (signal.embedding) {
          await upsertVectors([{
            id: segmentId,
            vector: signal.embedding,
            payload: {
              type: 'echo_segment',
              user_id: userId,
              project_id: projectId,
              source_module: sourceModule,
              intent_tags: intentTags,
              gist: hierarchy.gist,
            },
          }]);
        }
      } catch (err) {
        console.warn('[EchoForge] Failed to run episodic reconstruction:', err);
      }
    }

    return { segmentId, hierarchy, evidence };
  }

  async intentGroundedRetrieve(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 5
  ): Promise<Array<{ segmentId: string; gist: string; intentTags: string[]; evidence: string }>> {
    if (!this.isEnabled()) return [];

    const tags = this.intentTags(queryText, 'query', []);
    try {
      const rows = await query<any>(
        `SELECT h.segment_id, h.gist, h.intent_tags, s.local_evidence
         FROM echo_hierarchies h
         JOIN echo_segments s ON s.segment_id = h.segment_id
         WHERE h.user_id = $1
           AND h.project_id = $2
           AND h.intent_tags && $3::text[]
         ORDER BY h.updated_at DESC
         LIMIT $4`,
        [userId, projectId, tags, limit]
      );

      return rows.map(row => ({
        segmentId: row.segment_id,
        gist: row.gist,
        intentTags: row.intent_tags || [],
        evidence: row.local_evidence || '',
      }));
    } catch {
      return [];
    }
  }

  async buildEchoContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 4): Promise<string> {
    const items = await this.intentGroundedRetrieve(queryText, userId, projectId, limit);
    if (items.length === 0) return '';

    return `\n\n### EchoForge Reconstructed Episodic Context\n${items
      .map(item => `- ${item.gist} [intent=${item.intentTags.slice(0, 5).join(',')}]`)
      .join('\n')}`;
  }

  private assistantLocalReason(rawContext: string, sourceModule: string, intentTags: string[]): string {
    const context = rawContext.replace(/\s+/g, ' ').trim();
    const role = this.isCodingSource(sourceModule) ? 'coding-assistant' : 'memory-assistant';
    return `${role} evidence (${intentTags.slice(0, 4).join(', ')}): ${context.slice(0, 500)}`;
  }

  private masterCurate(evidences: string[], intentTags: string[], intentContext: string): EchoHierarchy {
    const joined = evidences.join(' ');
    const causalTargets = intentTags.filter(tag => ['burnout', 'relationship', 'skill', 'bug', 'tech-debt'].includes(tag));
    return {
      intentTags,
      gist: `${intentContext}: ${joined.replace(/\s+/g, ' ').slice(0, 260)}`,
      evidenceCount: evidences.length,
      causalTargets,
    };
  }

  private async propagateCausalLinks(segmentId: string, userId: number, projectId: string, hierarchy: EchoHierarchy): Promise<void> {
    const related = await query<{ segment_id: string }>(
      `SELECT segment_id FROM echo_hierarchies
       WHERE user_id = $1
         AND project_id = $2
         AND segment_id <> $3
         AND intent_tags && $4::text[]
       ORDER BY updated_at DESC
       LIMIT 3`,
      [userId, projectId, segmentId, hierarchy.intentTags]
    );

    for (const row of related) {
      await this.insertEchoEdge(segmentId, row.segment_id, 'intent_hierarchy', hierarchy.intentTags, 0.7);
    }
  }

  private async forgeCodingReconstruction(segmentId: string, userId: number, projectId: string, hierarchy: EchoHierarchy): Promise<void> {
    const targets = await query<{ segment_id: string }>(
      `SELECT segment_id FROM echo_hierarchies
       WHERE user_id = $1
         AND project_id = $2
         AND segment_id <> $3
         AND intent_tags && ARRAY['burnout','relationship','skill']::text[]
       ORDER BY updated_at DESC
       LIMIT 3`,
      [userId, projectId, segmentId]
    );

    for (const target of targets) {
      await this.insertEchoEdge(segmentId, target.segment_id, 'coding_reconstruction', hierarchy.intentTags, 0.8);
    }
  }

  private async insertEchoEdge(
    sourceSegmentId: string,
    targetSegmentId: string,
    edgeType: string,
    intentTags: string[],
    confidence: number
  ): Promise<void> {
    await execute(
      `INSERT INTO echo_edges
        (source_segment_id, target_segment_id, edge_type, intent_tags, confidence, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (source_segment_id, target_segment_id, edge_type) DO UPDATE SET
         confidence = GREATEST(echo_edges.confidence, EXCLUDED.confidence),
         updated_at = CURRENT_TIMESTAMP`,
      [sourceSegmentId, targetSegmentId, edgeType, intentTags, confidence]
    );
  }

  private intentTags(content: string, sourceModule: string, providedTags: string[]): string[] {
    const tags = new Set(providedTags.map(tag => tag.toLowerCase()));
    const lower = `${content} ${sourceModule}`.toLowerCase();
    if (/\b(code|bug|debt|api|repo|test|refactor)\b/.test(lower)) tags.add('code');
    if (/\b(bug|error|crash|regression)\b/.test(lower)) tags.add('bug');
    if (/\b(debt|legacy|refactor|complexity)\b/.test(lower)) tags.add('tech-debt');
    if (/\b(burnout|stress|energy|tired)\b/.test(lower)) tags.add('burnout');
    if (/\b(team|relationship|colleague|handoff)\b/.test(lower)) tags.add('relationship');
    if (/\b(skill|workflow|learn)\b/.test(lower)) tags.add('skill');
    if (/\b(history|episode|session|incident|timeline)\b/.test(lower)) tags.add('episodic');
    if (tags.size === 0) tags.add('general');
    return [...tags].slice(0, 12);
  }

  private isCodingSource(sourceModule: string): boolean {
    return /\b(code|cli|bug|debt|api|codebase|timps-code)\b/i.test(sourceModule);
  }

  private extractContent(signal: EchoSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }
}

export const echoForge = new EchoForge();
