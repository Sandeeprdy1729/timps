// core/layerForge.ts - Hierarchical semantic compressor with intent-aware gating

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export type LayerForgeLayer = 'working' | 'episodic' | 'semantic';

export interface LayerForgeSignal {
  id?: string | number;
  userId?: number;
  projectId?: string;
  content?: string;
  raw?: any;
  embedding?: number[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface LayerForgeResult {
  unitId?: string;
  layer?: LayerForgeLayer;
  gated: boolean;
  densityScore: number;
  compressedUnit?: {
    gist: string;
    sparseTags: string[];
    symbolic: Record<string, any>;
  };
  reason?: string;
}

export class LayerForge {
  isEnabled(): boolean {
    return process.env.ENABLE_LAYERFORGE !== 'false';
  }

  async forgeCompress(
    signal: LayerForgeSignal,
    sourceModule: string,
    intentContext: string = 'general'
  ): Promise<LayerForgeResult> {
    const userId = signal.userId || 1;
    const projectId = signal.projectId || 'default';
    const content = this.extractContent(signal);
    const densityScore = this.assessSemanticDensity(content, signal.tags || [], sourceModule);

    if (densityScore < 0.35) {
      await this.persistGate(userId, projectId, sourceModule, content, densityScore, 'low semantic density');
      return { gated: true, densityScore, reason: 'low semantic density' };
    }

    const unitId = crypto.randomUUID();
    const layer = this.assignLayer(content, sourceModule, densityScore);
    const compressedUnit = this.structuredCompress(content, signal.tags || [], sourceModule, intentContext);

    if (this.isEnabled()) {
      try {
        await execute(
          `INSERT INTO layer_units
            (unit_id, user_id, project_id, source_module, source_record_id, layer, density_score,
             intent_tags, gist, compressed, raw_content, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (unit_id) DO NOTHING`,
          [
            unitId,
            userId,
            projectId,
            sourceModule,
            signal.id ? String(signal.id) : null,
            layer,
            densityScore,
            compressedUnit.sparseTags,
            compressedUnit.gist,
            JSON.stringify(compressedUnit),
            content,
            JSON.stringify(signal.metadata || {}),
          ]
        );

        await this.onlineSynthesize(unitId, userId, projectId, layer, compressedUnit.sparseTags, densityScore);

        if (this.isCodingSource(sourceModule)) {
          await this.linkCodingToLongitudinal(unitId, userId, projectId, compressedUnit.sparseTags, densityScore);
        }

        if (signal.embedding) {
          await upsertVectors([{
            id: unitId,
            vector: signal.embedding,
            payload: {
              type: 'layer_unit',
              user_id: userId,
              project_id: projectId,
              source_module: sourceModule,
              layer,
              density_score: densityScore,
              intent_tags: compressedUnit.sparseTags,
              gist: compressedUnit.gist,
            },
          }]);
        }
      } catch (err) {
        console.warn('[LayerForge] Failed to persist compressed layer unit:', err);
      }
    }

    return { unitId, layer, gated: false, densityScore, compressedUnit };
  }

  async intentGatedRetrieve(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 6
  ): Promise<Array<{ unitId: string; layer: LayerForgeLayer; gist: string; densityScore: number; intentTags: string[] }>> {
    if (!this.isEnabled()) return [];

    const tags = this.intentTags(queryText, 'query', []);
    const layers = this.layersForIntent(queryText);
    try {
      const rows = await query<any>(
        `SELECT unit_id, layer, gist, density_score, intent_tags
         FROM layer_units
         WHERE user_id = $1
           AND project_id = $2
           AND layer = ANY($3)
           AND intent_tags && $4::text[]
         ORDER BY density_score DESC, updated_at DESC
         LIMIT $5`,
        [userId, projectId, layers, tags, limit]
      );

      return rows.map(row => ({
        unitId: row.unit_id,
        layer: row.layer,
        gist: row.gist,
        densityScore: Number(row.density_score || 0),
        intentTags: row.intent_tags || [],
      }));
    } catch {
      return [];
    }
  }

  async buildLayerContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 5): Promise<string> {
    const items = await this.intentGatedRetrieve(queryText, userId, projectId, limit);
    if (items.length === 0) return '';

    return `\n\n### LayerForge Hierarchical Context\n${items
      .map(item => `- ${item.layer}: ${item.gist} [density=${item.densityScore.toFixed(2)}; tags=${item.intentTags.slice(0, 5).join(',')}]`)
      .join('\n')}`;
  }

  private async persistGate(
    userId: number,
    projectId: string,
    sourceModule: string,
    content: string,
    densityScore: number,
    reason: string
  ): Promise<void> {
    if (!this.isEnabled()) return;
    await execute(
      `INSERT INTO layer_gates
        (user_id, project_id, source_module, content, density_score, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [userId, projectId, sourceModule, content.slice(0, 1000), densityScore, reason]
    );
  }

  private async onlineSynthesize(
    unitId: string,
    userId: number,
    projectId: string,
    layer: LayerForgeLayer,
    intentTags: string[],
    densityScore: number
  ): Promise<void> {
    const related = await query<{ unit_id: string }>(
      `SELECT unit_id FROM layer_units
       WHERE user_id = $1
         AND project_id = $2
         AND unit_id <> $3
         AND layer = $4
         AND intent_tags && $5::text[]
       ORDER BY density_score DESC, updated_at DESC
       LIMIT 3`,
      [userId, projectId, unitId, layer, intentTags]
    );

    for (const row of related) {
      await execute(
        `INSERT INTO layer_synthesis_edges
          (source_unit_id, target_unit_id, layer, intent_tags, weight, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (source_unit_id, target_unit_id, layer) DO UPDATE SET
           weight = GREATEST(layer_synthesis_edges.weight, EXCLUDED.weight),
           updated_at = CURRENT_TIMESTAMP`,
        [unitId, row.unit_id, layer, intentTags, densityScore]
      );
    }
  }

  private async linkCodingToLongitudinal(
    unitId: string,
    userId: number,
    projectId: string,
    intentTags: string[],
    densityScore: number
  ): Promise<void> {
    const targets = await query<{ unit_id: string }>(
      `SELECT unit_id FROM layer_units
       WHERE user_id = $1
         AND project_id = $2
         AND unit_id <> $3
         AND intent_tags && ARRAY['burnout','relationship','skill']::text[]
       ORDER BY density_score DESC, updated_at DESC
       LIMIT 3`,
      [userId, projectId, unitId]
    );

    for (const target of targets) {
      await execute(
        `INSERT INTO layer_synthesis_edges
          (source_unit_id, target_unit_id, layer, intent_tags, weight, created_at, updated_at)
         VALUES ($1, $2, 'semantic', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (source_unit_id, target_unit_id, layer) DO UPDATE SET
           weight = GREATEST(layer_synthesis_edges.weight, EXCLUDED.weight),
           updated_at = CURRENT_TIMESTAMP`,
        [unitId, target.unit_id, [...intentTags, 'coding_longitudinal'], densityScore]
      );
    }
  }

  private assessSemanticDensity(content: string, tags: string[], sourceModule: string): number {
    let score = 0.2;
    if (content.length > 60) score += 0.2;
    if (content.length > 180) score += 0.15;
    if (tags.length > 0) score += 0.1;
    if (/\b(because|caused|resolved|pattern|decision|bug|burnout|relationship|debt|api)\b/i.test(content)) score += 0.2;
    if (this.isCodingSource(sourceModule)) score += 0.1;
    return this.clamp(score, 0, 1);
  }

  private structuredCompress(
    content: string,
    tags: string[],
    sourceModule: string,
    intentContext: string
  ): NonNullable<LayerForgeResult['compressedUnit']> {
    const sparseTags = this.intentTags(`${content} ${intentContext}`, sourceModule, tags);
    return {
      gist: content.replace(/\s+/g, ' ').trim().slice(0, 260),
      sparseTags,
      symbolic: {
        sourceModule,
        intentContext,
        hasCodeSignal: sparseTags.includes('code'),
        hasLongitudinalSignal: sparseTags.includes('burnout') || sparseTags.includes('relationship'),
      },
    };
  }

  private assignLayer(content: string, sourceModule: string, densityScore: number): LayerForgeLayer {
    const lower = `${content} ${sourceModule}`.toLowerCase();
    if (densityScore >= 0.75 || /\b(pattern|principle|lesson|semantic|always|recurring)\b/.test(lower)) return 'semantic';
    if (/\b(yesterday|today|session|incident|bug|meeting|happened)\b/.test(lower)) return 'episodic';
    return 'working';
  }

  private layersForIntent(queryText: string): LayerForgeLayer[] {
    const lower = queryText.toLowerCase();
    if (/\b(pattern|why|principle|lesson|forecast|predict)\b/.test(lower)) return ['semantic', 'episodic'];
    if (/\b(history|incident|session|when|timeline)\b/.test(lower)) return ['episodic', 'semantic'];
    return ['working', 'episodic', 'semantic'];
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
    if (/\b(decision|fact|resolved|supersede)\b/.test(lower)) tags.add('knowledge');
    if (tags.size === 0) tags.add('general');
    return [...tags].slice(0, 12);
  }

  private isCodingSource(sourceModule: string): boolean {
    return /\b(code|cli|bug|debt|api|codebase|timps-code)\b/i.test(sourceModule);
  }

  private extractContent(signal: LayerForgeSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export const layerForge = new LayerForge();
