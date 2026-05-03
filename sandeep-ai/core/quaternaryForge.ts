// core/quaternaryForge.ts - QuaternaryForge: Typed Four-Layer Persistence Router with
// Evidence-Gated Wisdom Consolidation and Bi-Temporal Decay
//
// Fuses four-layer persistence semantics (arXiv 2604.11364) with typed routing:
//
// Four-Layer Typing: Knowledge/Memory/Wisdom/Intelligence with distinct update rules
// Evidence-Gated Wisdom: Multi-tool validation threshold for promotion
// Bi-Temporal Decay: Validity windows + decay in Memory layer
// Coding Boost: CLI/VS/MCP events classify and propagate to relevant tools/layers

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export type QuaternaryLayer = 'knowledge' | 'memory' | 'wisdom' | 'intelligence';
export type QuaternaryAction = 'supersede' | 'decay' | 'gate' | 'ephemeral';

export interface QuaternarySignal {
  id?: string | number;
  userId?: number;
  projectId?: string;
  content?: string;
  raw?: any;
  embedding?: number[];
  tags?: string[];
  entity?: string;
  confidence?: number;
  evidence?: string;
  metadata?: Record<string, any>;
}

export interface QuaternaryEntryResult {
  entryId: string;
  layer: QuaternaryLayer;
  evidenceScore: number;
  validFrom: Date;
  validTo?: Date;
}

export interface QuaternaryQueryResult {
  summary: string;
  layerContributions: Record<string, number>;
  entries: Array<{
    entryId: string;
    layer: QuaternaryLayer;
    content: string;
    evidenceScore: number;
    validFrom: string;
    validTo?: string;
    createdAt: string;
  }>;
  confidence: number;
}

const CODE_SOURCES = ['code', 'cli', 'bug', 'debt', 'api', 'codebase', 'timps-code', 'vscode', 'mcp'];
const WISDOM_EVIDENCE_THRESHOLD = 0.65;
const MEMORY_DECAY_RATE = 0.03;

export class QuaternaryForge {
  private wisdomThreshold: number;
  private memoryDecayRate: number;
  private intelligenceMaxAge: number;

  constructor(opts: { wisdomThreshold?: number; memoryDecayRate?: number; intelligenceMaxAge?: number } = {}) {
    const envCfg = (global as any).__quaternaryForgeConfig || {};
    this.wisdomThreshold = envCfg.wisdomThreshold ?? opts.wisdomThreshold ?? WISDOM_EVIDENCE_THRESHOLD;
    this.memoryDecayRate = envCfg.memoryDecayRate ?? opts.memoryDecayRate ?? MEMORY_DECAY_RATE;
    this.intelligenceMaxAge = envCfg.intelligenceMaxAge ?? opts.intelligenceMaxAge ?? 30; // days
  }

  isEnabled(): boolean {
    return process.env.ENABLE_QUATERNARYFORGE !== 'false';
  }

  async forgeTyped(signal: QuaternarySignal, sourceModule: string): Promise<QuaternaryEntryResult> {
    const entryId = crypto.randomUUID();
    const userId = signal.userId ?? 1;
    const projectId = signal.projectId ?? 'default';
    const content = this.extractContent(signal);

    if (!this.isEnabled()) {
      return { entryId, layer: 'memory', evidenceScore: 0, validFrom: new Date() };
    }

    try {
      // Classify signal into layer
      const layer = await this.classifyToLayer(signal, sourceModule);

      // Compute evidence score
      const evidenceScore = this.computeEvidenceScore(signal, sourceModule);

      // Determine validity window based on layer
      const validFrom = new Date();
      const validTo = this.getLayerValidTo(layer, signal, content);

      // Insert with layer typing
      await execute(
        `INSERT INTO quaternaryforge_entries
          (entry_id, user_id, project_id, source_module, source_record_id,
           layer, content, raw_data, evidence_score,
           valid_from, valid_to, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
         ON CONFLICT (entry_id) DO NOTHING`,
        [
          entryId, userId, projectId, sourceModule,
          signal.id ? String(signal.id) : null,
          layer, content,
          JSON.stringify(signal.raw ?? signal),
          evidenceScore, validFrom, validTo ?? null,
          JSON.stringify(signal.metadata ?? {}),
        ]
      );

      // Apply layer-specific semantics
      await this.applyLayerSemantics(layer, entryId, userId, projectId, signal, evidenceScore);

      // Propagate within compatible layers only
      await this.propagateTypedSynapse(layer, entryId, userId, projectId, content, evidenceScore);

      // Coding ecosystem layer chain
      if (this.isCodingSource(sourceModule)) {
        await this.forgeCodingLayerChain(layer, entryId, userId, projectId, content, evidenceScore);
      }

      // Wisdom gating: check if promotion is warranted
      if (layer === 'wisdom' || (layer === 'memory' && evidenceScore >= this.wisdomThreshold)) {
        await this.checkWisdomPromotion(entryId, userId, projectId, evidenceScore, content);
      }

      // Vector upsert
      if (signal.embedding) {
        await upsertVectors([{
          id: entryId,
          vector: signal.embedding,
          payload: {
            type: 'quaternaryforge_entry',
            user_id: userId,
            project_id: projectId,
            source_module: sourceModule,
            layer,
            content,
            evidence_score: evidenceScore,
            valid_from: validFrom.toISOString(),
          },
        }]);
      }

      return { entryId, layer, evidenceScore, validFrom, validTo };
    } catch (err) {
      console.warn('[QuaternaryForge] Failed to forge typed entry:', err);
      return { entryId, layer: 'memory', evidenceScore: 0, validFrom: new Date() };
    }
  }

  async queryTyped(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    preferredLayers?: QuaternaryLayer[]
  ): Promise<QuaternaryQueryResult> {
    if (!this.isEnabled()) {
      return { summary: '', layerContributions: {}, entries: [], confidence: 0 };
    }

    const layers = preferredLayers ?? this.layersForQuery(queryText);

    try {
      const rows = await query<any>(
        `SELECT entry_id, layer, content, evidence_score, valid_from, valid_to,
                created_at, source_module
         FROM quaternaryforge_entries
         WHERE user_id = $1 AND project_id = $2
           AND layer = ANY($3)
           AND (valid_to IS NULL OR valid_to >= CURRENT_TIMESTAMP)
         ORDER BY
           CASE layer
             WHEN 'knowledge' THEN 1
             WHEN 'wisdom' THEN 2
             WHEN 'memory' THEN 3
             WHEN 'intelligence' THEN 4
           END,
           evidence_score DESC,
           created_at DESC
         LIMIT $4`,
        [userId, projectId, layers, 20]
      );

      const entries = rows.map(r => ({
        entryId: r.entry_id,
        layer: r.layer,
        content: r.content,
        evidenceScore: Number(r.evidence_score || 0),
        validFrom: r.valid_from,
        validTo: r.valid_to || undefined,
        createdAt: r.created_at,
      }));

      // Layer contribution analysis
      const layerContributions: Record<string, number> = {};
      for (const entry of entries) {
        layerContributions[entry.layer] = (layerContributions[entry.layer] || 0) + 1;
      }

      const summary = this.synthesizeLayered(entries, queryText);
      const confidence = entries.length > 0
        ? entries.reduce((s, e) => s + e.evidenceScore, 0) / entries.length
        : 0;

      return { summary, layerContributions, entries: entries.slice(0, 10), confidence };
    } catch (err) {
      console.warn('[QuaternaryForge] Typed query failed:', err);
      return { summary: '', layerContributions: {}, entries: [], confidence: 0 };
    }
  }

  async buildTypedContext(queryText: string, userId: number, projectId: string = 'default', layers?: QuaternaryLayer[], limit: number = 5): Promise<string> {
    const result = await this.queryTyped(queryText, userId, projectId, layers);
    if (!result.summary || result.entries.length === 0) return '';
    const layerStr = Object.entries(result.layerContributions).map(([k, v]) => `${k}: ${v}`).join(', ');
    return `\n\n### QuaternaryForge Context\n${result.summary}\nConfidence: ${result.confidence.toFixed(2)} | Layers: ${layerStr}`;
  }

  // ── Layer classification ──

  private async classifyToLayer(signal: QuaternarySignal, sourceModule: string): Promise<QuaternaryLayer> {
    const content = this.extractContent(signal).toLowerCase();
    const tags = (signal.tags || []).join(' ').toLowerCase();
    const combined = `${content} ${tags} ${sourceModule.toLowerCase()}`;
    const confidence = signal.confidence ?? 0.5;

    // Wisdom: evidence-gated, requires high confidence and strong signals
    if (/\b(insight|lesson|principle|wisdom|learned|pattern established|proven)\b/.test(combined) && confidence >= this.wisdomThreshold) {
      return 'wisdom';
    }

    // Knowledge: facts, decisions, API contracts, resolved issues
    if (/\b(fact|decision|api|contract|endpoint|resolved|fixed|supersedes|position|established)\b/.test(combined)) {
      return 'knowledge';
    }

    // Intelligence: ephemeral, tentative, speculative
    if (/\b(draft|maybe|temporary|thinking|hypothesis|speculation|tentative)\b/.test(combined)) {
      return 'intelligence';
    }

    // Memory: default for experiences, observations
    return 'memory';
  }

  // ── Layer-specific semantics ──

  private async applyLayerSemantics(
    layer: QuaternaryLayer, entryId: string, userId: number, projectId: string,
    signal: QuaternarySignal, evidenceScore: number
  ): Promise<void> {
    const content = this.extractContent(signal);

    switch (layer) {
      case 'knowledge':
        // Supersede prior knowledge entries on same entities
        await this.supersedeKnowledge(entryId, userId, projectId, content, evidenceScore);
        break;

      case 'memory':
        // Apply bi-temporal decay
        await this.applyMemoryDecay(entryId, signal);
        break;

      case 'wisdom':
        // Evidence gating: require validation
        await this.gateWisdom(entryId, evidenceScore);
        break;

      case 'intelligence':
        // Mark as ephemeral with expiration
        await this.markEphemeral(entryId);
        break;
    }
  }

  private async supersedeKnowledge(
    entryId: string, userId: number, projectId: string,
    content: string, evidenceScore: number
  ): Promise<void> {
    const lower = content.toLowerCase();
    const hasSupersession = /\b(supersedes|replaces|updated|no longer|fixed|resolved|instead)\b/.test(lower);

    if (!hasSupersession) return;

    const prior = await query<{ entry_id: string }>(
      `SELECT entry_id FROM quaternaryforge_entries
       WHERE user_id = $1 AND project_id = $2
         AND layer = 'knowledge'
         AND entry_id <> $3 AND valid_to IS NULL
       ORDER BY created_at DESC LIMIT 3`,
      [userId, projectId, entryId]
    );

    for (const p of prior) {
      await execute(
        `UPDATE quaternaryforge_entries SET valid_to = CURRENT_TIMESTAMP WHERE entry_id = $1`,
        [p.entry_id]
      );
    }
  }

  private async applyMemoryDecay(entryId: string, signal: QuaternarySignal): Promise<void> {
    // Decay weight stored in metadata
    const decayWeight = 1.0 - this.memoryDecayRate;
    await execute(
      `UPDATE quaternaryforge_entries
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE entry_id = $1`,
      [entryId, JSON.stringify({ decay_weight: decayWeight, decayed_at: new Date().toISOString() })]
    );
  }

  private async gateWisdom(entryId: string, evidenceScore: number): Promise<void> {
    // Gate wisdom entries until evidence threshold is met
    const passed = evidenceScore >= this.wisdomThreshold;
    await execute(
      `UPDATE quaternaryforge_entries
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE entry_id = $1`,
      [entryId, JSON.stringify({ wisdom_gate: passed ? 'passed' : 'pending', evidence_score: evidenceScore })]
    );
  }

  private async markEphemeral(entryId: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.intelligenceMaxAge);

    await execute(
      `UPDATE quaternaryforge_entries
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           valid_to = LEAST(COALESCE(valid_to, $3), $3)
       WHERE entry_id = $1`,
      [entryId, JSON.stringify({ ephemeral: true, expires_at: expiresAt.toISOString() }), expiresAt]
    );
  }

  // ── Typed synapse propagation ──

  private async propagateTypedSynapse(
    layer: QuaternaryLayer, entryId: string, userId: number, projectId: string,
    content: string, evidenceScore: number
  ): Promise<void> {
    // Only propagate within compatible layers
    const compatibleLayers = this.getCompatibleLayers(layer);

    const related = await query<any>(
      `SELECT entry_id, layer, evidence_score FROM quaternaryforge_entries
       WHERE user_id = $1 AND project_id = $2
         AND entry_id <> $3 AND layer = ANY($4)
       ORDER BY evidence_score DESC LIMIT 4`,
      [userId, projectId, entryId, compatibleLayers]
    );

    for (const r of related) {
      const propagationScore = this.clamp(
        (evidenceScore + Number(r.evidence_score || 0)) / 2,
        0.1, 1
      );

      await execute(
        `INSERT INTO quaternaryforge_propagations
          (source_entry_id, target_entry_id, source_layer, target_layer,
           propagation_score, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (source_entry_id, target_entry_id) DO UPDATE SET
           propagation_score = GREATEST(quaternaryforge_propagations.propagation_score, EXCLUDED.propagation_score)`,
        [entryId, r.entry_id, layer, r.layer, propagationScore]
      );
    }
  }

  private getCompatibleLayers(layer: QuaternaryLayer): QuaternaryLayer[] {
    switch (layer) {
      case 'knowledge': return ['knowledge', 'wisdom'];
      case 'memory': return ['memory', 'knowledge', 'wisdom'];
      case 'wisdom': return ['wisdom', 'knowledge'];
      case 'intelligence': return ['intelligence', 'memory'];
    }
  }

  // ── Wisdom promotion check ──

  private async checkWisdomPromotion(
    entryId: string, userId: number, projectId: string,
    evidenceScore: number, content: string
  ): Promise<void> {
    // Check if memory entry should be promoted to wisdom
    if (evidenceScore >= this.wisdomThreshold + 0.1) {
      await execute(
        `UPDATE quaternaryforge_entries
         SET layer = 'wisdom', updated_at = CURRENT_TIMESTAMP
         WHERE entry_id = $1 AND layer = 'memory'`,
        [entryId]
      );
    }
  }

  // ── Coding ecosystem layer chain ──

  private async forgeCodingLayerChain(
    layer: QuaternaryLayer, entryId: string, userId: number, projectId: string,
    content: string, evidenceScore: number
  ): Promise<void> {
    const lower = content.toLowerCase();
    const targets: string[] = [];
    if (/\b(debt|legacy|refactor|complexity)\b/.test(lower)) targets.push('burnout');
    if (/\b(team|review|handoff)\b/.test(lower)) targets.push('relationship');
    if (/\b(bug|error|crash)\b/.test(lower)) targets.push('bug');

    for (const target of targets) {
      const related = await query<{ entry_id: string }>(
        `SELECT entry_id FROM quaternaryforge_entries
         WHERE user_id = $1 AND project_id = $2
           AND content ILIKE $3
         ORDER BY evidence_score DESC LIMIT 2`,
        [userId, projectId, `%${target}%`]
      );

      for (const r of related) {
        await execute(
          `INSERT INTO quaternaryforge_propagations
            (source_entry_id, target_entry_id, source_layer, target_layer,
             propagation_score, created_at)
           VALUES ($1, $2, $3, 'memory', $4, CURRENT_TIMESTAMP)
           ON CONFLICT (source_entry_id, target_entry_id) DO UPDATE SET
             propagation_score = GREATEST(quaternaryforge_propagations.propagation_score, EXCLUDED.propagation_score)`,
          [entryId, r.entry_id, layer, evidenceScore * 0.8]
        );
      }
    }
  }

  // ── Helpers ──

  private computeEvidenceScore(signal: QuaternarySignal, sourceModule: string): number {
    let score = 0.5;
    const content = this.extractContent(signal);
    if (content.length > 100) score += 0.1;
    if ((signal.tags || []).length > 1) score += 0.05;
    if ((signal.evidence || '').length > 50) score += 0.1;
    if (signal.confidence) score = signal.confidence;
    if (this.isCodingSource(sourceModule)) score += 0.05;
    return this.clamp(score, 0.1, 1);
  }

  private getLayerValidTo(layer: QuaternaryLayer, signal: QuaternarySignal, content: string): Date | undefined {
    switch (layer) {
      case 'intelligence': {
        const d = new Date();
        d.setDate(d.getDate() + this.intelligenceMaxAge);
        return d;
      }
      case 'memory': {
        const lower = content.toLowerCase();
        if (/\b(temporary|draft|tentative)\b/.test(lower)) {
          const d = new Date();
          d.setDate(d.getDate() + 14);
          return d;
        }
        return undefined;
      }
      case 'knowledge':
      case 'wisdom':
        // Open-ended for persistent facts and insights
        return undefined;
    }
  }

  private layersForQuery(queryText: string): QuaternaryLayer[] {
    const lower = queryText.toLowerCase();
    if (/\b(fact|current|latest|resolved|supersede|why|decision)\b/.test(lower)) return ['knowledge', 'wisdom'];
    if (/\b(pattern|burnout|relationship|history|over.time|trajectory)\b/.test(lower)) return ['memory', 'wisdom', 'knowledge'];
    if (/\b(plan|draft|temporary|what if)\b/.test(lower)) return ['intelligence', 'memory'];
    return ['knowledge', 'memory', 'wisdom'];
  }

  private synthesizeLayered(entries: Array<{ layer: QuaternaryLayer; content: string; evidenceScore: number }>, queryText: string): string {
    if (entries.length === 0) return '';

    const lower = queryText.toLowerCase();
    const wantsFacts = /\b(fact|current|latest)\b/.test(lower);
    const wantsPatterns = /\b(pattern|history|over.time)\b/.test(lower);

    const lines: string[] = [];

    if (wantsFacts) {
      const knowledge = entries.filter(e => e.layer === 'knowledge');
      for (const e of knowledge.slice(0, 4)) {
        lines.push(`- [knowledge] ${e.content.slice(0, 160)} [evidence: ${e.evidenceScore.toFixed(2)}]`);
      }
    }

    if (wantsPatterns) {
      const wisdom = entries.filter(e => e.layer === 'wisdom');
      for (const e of wisdom.slice(0, 3)) {
        lines.push(`- [wisdom] ${e.content.slice(0, 140)} [evidence: ${e.evidenceScore.toFixed(2)}]`);
      }
    }

    const memory = entries.filter(e => e.layer === 'memory');
    for (const e of memory.slice(0, 3)) {
      lines.push(`- [memory] ${e.content.slice(0, 120)} [evidence: ${e.evidenceScore.toFixed(2)}]`);
    }

    return lines.join('\n');
  }

  private isCodingSource(sourceModule: string): boolean {
    return CODE_SOURCES.some(s => sourceModule.toLowerCase().includes(s));
  }

  private extractContent(signal: QuaternarySignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}

export const quaternaryForge = new QuaternaryForge();
