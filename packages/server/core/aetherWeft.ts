// core/aetherWeft.ts - AetherWeft: Adaptive Knowledge Lifecycle Weaver with
// Hierarchical Context Trees and Dynamic Validity Rivers
//
// Fuses ByteRover AKL (Adaptive Knowledge Lifecycle) + H-MEM hierarchical trees:
//
// Hierarchical Context Tree: Domain → Topic → Subtopic → Entry with bindings
// Adaptive Knowledge Lifecycle (AKL): Importance, maturity tiers, recency decay
// Dynamic Validity Rivers: Provenance-linked temporal/causal webs with confidence flow
// Coding Boost: CLI/VS/MCP events seed Entries that mature/weave into persona predictions

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export type AetherLevel = 'domain' | 'topic' | 'subcategory' | 'entry';
export type AetherMaturity = 'draft' | 'validated' | 'stable' | 'core';

export interface AetherSignal {
  id?: string | number;
  userId?: number;
  projectId?: string;
  content?: string;
  raw?: any;
  embedding?: number[];
  tags?: string[];
  entity?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface AetherAKL {
  importance: number;
  maturity: AetherMaturity;
  recencyDecay: number;
  provenance: string;
  evidenceCount: number;
}

export interface AetherEntryResult {
  entryId: string;
  level: AetherLevel;
  maturity: AetherMaturity;
  validityScore: number;
  parentPath: string[];
}

export interface AetherQueryResult {
  summary: string;
  entries: Array<{
    entryId: string;
    level: AetherLevel;
    maturity: AetherMaturity;
    content: string;
    validityScore: number;
    akl: AetherAKL;
    createdAt: string;
  }>;
  avgValidity: number;
  maturityPath: string[];
}

const CODE_SOURCES = ['code', 'cli', 'bug', 'debt', 'api', 'codebase', 'timps-code', 'vscode', 'mcp'];
const MATURITY_ORDER: Record<AetherMaturity, number> = { draft: 0, validated: 1, stable: 2, core: 3 };

export class AetherWeft {
  private maturityThreshold: number;
  private decayRate: number;
  private maxRiverDepth: number;

  constructor(opts: { maturityThreshold?: number; decayRate?: number; maxRiverDepth?: number } = {}) {
    const envCfg = (global as any).__aetherWeftConfig || {};
    this.maturityThreshold = envCfg.maturityThreshold ?? opts.maturityThreshold ?? 0.6;
    this.decayRate = envCfg.decayRate ?? opts.decayRate ?? 0.02;
    this.maxRiverDepth = envCfg.maxRiverDepth ?? opts.maxRiverDepth ?? 5;
  }

  isEnabled(): boolean {
    return process.env.ENABLE_AETHERWEFT !== 'false';
  }

  async weaveEntry(signal: AetherSignal, sourceModule: string): Promise<AetherEntryResult> {
    const entryId = crypto.randomUUID();
    const userId = signal.userId ?? 1;
    const projectId = signal.projectId ?? 'default';
    const content = this.extractContent(signal);

    if (!this.isEnabled()) {
      return { entryId, level: 'entry', maturity: 'draft', validityScore: 0, parentPath: [] };
    }

    try {
      // Create hierarchical tree entry with AKL metadata
      const akl = this.computeAKL(signal, sourceModule);
      const level = this.determineLevel(signal, sourceModule);
      const parentPath = await this.findParentPath(userId, projectId, level, signal);

      await execute(
        `INSERT INTO aetherweft_entries
          (entry_id, user_id, project_id, source_module, source_record_id,
           level, maturity, content, akl_data, parent_path, validity_score,
           metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (entry_id) DO NOTHING`,
        [
          entryId, userId, projectId, sourceModule,
          signal.id ? String(signal.id) : null,
          level, akl.maturity, content,
          JSON.stringify(akl), parentPath,
          this.computeInitialValidity(signal, akl),
          JSON.stringify(signal.metadata ?? {}),
        ]
      );

      // Weave dynamic validity rivers
      await this.weaveValidityRivers(entryId, userId, projectId, content, akl, signal);

      // Coding ecosystem lifecycle weave
      if (this.isCodingSource(sourceModule)) {
        await this.weaveCodingLifecycle(entryId, userId, projectId, content, akl);
      }

      // Agentic curation (maturity advancement)
      await this.agenticCurate(entryId, userId, projectId, akl, content);

      // Vector upsert
      if (signal.embedding) {
        await upsertVectors([{
          id: entryId,
          vector: signal.embedding,
          payload: {
            type: 'aetherweft_entry',
            user_id: userId,
            project_id: projectId,
            source_module: sourceModule,
            level,
            maturity: akl.maturity,
            content,
            validityScore: this.computeInitialValidity(signal, akl),
          },
        }]);
      }

      return { entryId, level, maturity: akl.maturity, validityScore: this.computeInitialValidity(signal, akl), parentPath };
    } catch (err) {
      console.warn('[AetherWeft] Failed to weave entry:', err);
      return { entryId, level: 'entry', maturity: 'draft', validityScore: 0, parentPath: [] };
    }
  }

  async queryWeft(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    minMaturity?: number
  ): Promise<AetherQueryResult> {
    const maturityMin = minMaturity ?? this.maturityThreshold;

    if (!this.isEnabled()) {
      return { summary: '', entries: [], avgValidity: 0, maturityPath: [] };
    }

    try {
      const targetLevel = this.levelForQuery(queryText);
      const rows = await query<any>(
        `SELECT entry_id, level, maturity, content, akl_data, parent_path,
                validity_score, created_at, source_module
         FROM aetherweft_entries
         WHERE user_id = $1 AND project_id = $2
           AND (level = $3 OR level = 'entry')
           AND validity_score >= $4
         ORDER BY validity_score DESC, created_at DESC
         LIMIT $5`,
        [userId, projectId, targetLevel, maturityMin, 20]
      );

      const entries = rows.map(r => {
        const akl = typeof r.akl_data === 'string' ? JSON.parse(r.akl_data) : r.akl_data;
        return {
          entryId: r.entry_id,
          level: r.level,
          maturity: r.maturity,
          content: r.content,
          validityScore: Number(r.validity_score || 0),
          akl,
          createdAt: r.created_at,
        };
      });

      const summary = this.synthesizeWeft(entries, queryText);
      const avgValidity = entries.length > 0
        ? entries.reduce((s, e) => s + e.validityScore, 0) / entries.length
        : 0;

      return {
        summary,
        entries: entries.slice(0, 10),
        avgValidity,
        maturityPath: [...new Set(entries.map(e => e.maturity))],
      };
    } catch (err) {
      console.warn('[AetherWeft] Query failed:', err);
      return { summary: '', entries: [], avgValidity: 0, maturityPath: [] };
    }
  }

  async buildWeftContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 5): Promise<string> {
    const result = await this.queryWeft(queryText, userId, projectId);
    if (!result.summary || result.entries.length === 0) return '';
    return `\n\n### AetherWeft Context\n${result.summary}\nAvg Validity: ${result.avgValidity.toFixed(2)} | Maturity: ${result.maturityPath.join(', ')}`;
  }

  // ── AKL computation ──

  private computeAKL(signal: AetherSignal, sourceModule: string): AetherAKL {
    const content = this.extractContent(signal);
    const importance = this.computeImportance(signal, sourceModule);
    const maturity = this.determineMaturity(signal, importance);
    const recencyDecay = this.computeRecencyDecay(content, signal);

    return {
      importance,
      maturity,
      recencyDecay,
      provenance: sourceModule,
      evidenceCount: (signal.tags || []).length,
    };
  }

  private computeImportance(signal: AetherSignal, sourceModule: string): number {
    let importance = 0.5;
    const content = this.extractContent(signal);
    if (content.length > 100) importance += 0.1;
    if (content.length > 300) importance += 0.1;
    if ((signal.tags || []).length > 2) importance += 0.1;
    if (signal.confidence) importance += signal.confidence * 0.15;
    if (this.isCodingSource(sourceModule)) importance += 0.05;
    return this.clamp(importance, 0.1, 1);
  }

  private determineMaturity(signal: AetherSignal, importance: number): AetherMaturity {
    if (importance >= 0.8 && (signal.confidence ?? 0) >= 0.75) return 'stable';
    if (importance >= 0.6 && (signal.confidence ?? 0) >= 0.6) return 'validated';
    if (importance >= 0.4) return 'draft';
    return 'draft';
  }

  private computeRecencyDecay(content: string, signal: AetherSignal): number {
    let decay = 1.0;
    const lower = content.toLowerCase();
    if (/\b(permanent|always|core|fundamental)\b/.test(lower)) decay = 0.98;
    else if (/\b(current|recent|now|active)\b/.test(lower)) decay = 0.95;
    else decay = 0.9;
    return decay;
  }

  private computeInitialValidity(signal: AetherSignal, akl: AetherAKL): number {
    let validity = akl.importance * 0.4 + (signal.confidence ?? 0.5) * 0.3 + akl.recencyDecay * 0.3;
    return this.clamp(validity, 0.1, 1);
  }

  // ── Dynamic validity rivers ──

  private async weaveValidityRivers(
    entryId: string, userId: number, projectId: string,
    content: string, akl: AetherAKL, signal: AetherSignal
  ): Promise<void> {
    const relatedEntries = await query<any>(
      `SELECT entry_id, level, maturity, validity_score, akl_data
       FROM aetherweft_entries
       WHERE user_id = $1 AND project_id = $2 AND entry_id <> $3
       ORDER BY validity_score DESC, created_at DESC
       LIMIT 5`,
      [userId, projectId, entryId]
    );

    for (const re of relatedEntries) {
      const sharedEntities = this.findSharedEntities(content, re.content);
      if (sharedEntities.length > 0) {
        const riverConfidence = this.clamp(
          (akl.importance + Number(re.validity_score || 0)) / 2 * (sharedEntities.length * 0.15),
          0.1, 1
        );

        await execute(
          `INSERT INTO aetherweft_rivers
            (source_entry_id, target_entry_id, river_type, shared_entities,
             confidence, decay_rate, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           ON CONFLICT (source_entry_id, target_entry_id, river_type) DO UPDATE SET
             confidence = GREATEST(aetherweft_rivers.confidence, EXCLUDED.confidence)`,
          [entryId, re.entry_id, 'validity', sharedEntities, riverConfidence, akl.recencyDecay]
        );
      }
    }
  }

  private findSharedEntities(content1: string, content2: string): string[] {
    const entities1 = new Set(content1.toLowerCase().match(/\b[a-z][a-z0-9_-]{2,}\b/g) || []);
    const entities2 = new Set(content2.toLowerCase().match(/\b[a-z][a-z0-9_-]{2,}\b/g) || []);
    return [...entities1].filter(e => entities2.has(e)).slice(0, 5);
  }

  // ── Agentic curation ──

  private async agenticCurate(
    entryId: string, userId: number, projectId: string,
    akl: AetherAKL, content: string
  ): Promise<void> {
    // Check if entry should advance maturity
    const maturityLevel = MATURITY_ORDER[akl.maturity];
    const evidenceThreshold = maturityLevel < 2 ? 2 : 4;

    if (akl.evidenceCount >= evidenceThreshold && akl.importance >= 0.65) {
      const nextMaturity = this.nextMaturity(akl.maturity);
      if (nextMaturity !== akl.maturity) {
        await execute(
          `UPDATE aetherweft_entries SET maturity = $1, updated_at = CURRENT_TIMESTAMP WHERE entry_id = $2`,
          [nextMaturity, entryId]
        );
      }
    }

    // Apply recency decay to low-validity entries
    const validity = this.computeInitialValidity({} as AetherSignal, akl);
    if (validity < 0.3 && akl.maturity === 'draft') {
      await execute(
        `UPDATE aetherweft_entries
         SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"decay_flagged": true}'::jsonb
         WHERE entry_id = $1`,
        [entryId]
      );
    }
  }

  private nextMaturity(current: AetherMaturity): AetherMaturity {
    const order: AetherMaturity[] = ['draft', 'validated', 'stable', 'core'];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : current;
  }

  // ── Coding ecosystem lifecycle weave ──

  private async weaveCodingLifecycle(
    entryId: string, userId: number, projectId: string,
    content: string, akl: AetherAKL
  ): Promise<void> {
    const lower = content.toLowerCase();
    const targets: string[] = [];
    if (/\b(debt|legacy|refactor|complexity)\b/.test(lower)) targets.push('burnout');
    if (/\b(team|review|handoff)\b/.test(lower)) targets.push('relationship');
    if (/\b(bug|error|crash)\b/.test(lower)) targets.push('bug');

    for (const target of targets) {
      const related = await query<{ entry_id: string }>(
        `SELECT entry_id FROM aetherweft_entries
         WHERE user_id = $1 AND project_id = $2
           AND content ILIKE $3
         ORDER BY validity_score DESC LIMIT 2`,
        [userId, projectId, `%${target}%`]
      );

      for (const r of related) {
        await execute(
          `INSERT INTO aetherweft_rivers
            (source_entry_id, target_entry_id, river_type, shared_entities,
             confidence, decay_rate, created_at)
           VALUES ($1, $2, 'coding_lifecycle', $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (source_entry_id, target_entry_id, river_type) DO UPDATE SET
             confidence = GREATEST(aetherweft_rivers.confidence, EXCLUDED.confidence)`,
          [entryId, r.entry_id, [target], akl.importance, akl.recencyDecay]
        );
      }
    }
  }

  // ── Helpers ──

  private determineLevel(signal: AetherSignal, sourceModule: string): AetherLevel {
    const content = this.extractContent(signal).toLowerCase();
    if (/\b(domain|broad|overall|enterprise)\b/.test(content)) return 'domain';
    if (/\b(category|group|classification)\b/.test(content)) return 'topic';
    if (/\b(subcategory|specific|detail)\b/.test(content)) return 'subcategory';
    return 'entry';
  }

  private levelForQuery(queryText: string): AetherLevel {
    const lower = queryText.toLowerCase();
    if (/\b(domain|overview|broad)\b/.test(lower)) return 'domain';
    if (/\b(topic|category)\b/.test(lower)) return 'topic';
    if (/\b(subtopic|subcategory)\b/.test(lower)) return 'subcategory';
    return 'entry';
  }

  private async findParentPath(
    userId: number, projectId: string, level: AetherLevel, signal: AetherSignal
  ): Promise<string[]> {
    const content = this.extractContent(signal);
    try {
      const parentLevel = level === 'entry' ? 'subcategory' : level === 'subcategory' ? 'topic' : level === 'topic' ? 'domain' : null;
      if (!parentLevel) return [];

      const parents = await query<{ entry_id: string }>(
        `SELECT entry_id FROM aetherweft_entries
         WHERE user_id = $1 AND project_id = $2 AND level = $3
         ORDER BY validity_score DESC, created_at DESC LIMIT 1`,
        [userId, projectId, parentLevel]
      );

      return parents.map(p => p.entry_id);
    } catch {
      return [];
    }
  }

  private synthesizeWeft(entries: Array<{ level: AetherLevel; content: string; maturity: AetherMaturity; validityScore: number }>, queryText: string): string {
    if (entries.length === 0) return '';

    const lower = queryText.toLowerCase();
    const wantsMaturity = /\b(maturity|lifecycle|stable|core)\b/.test(lower);

    const lines: string[] = [];

    if (wantsMaturity) {
      const mature = entries.filter(e => e.maturity === 'stable' || e.maturity === 'core');
      if (mature.length > 0) {
        lines.push('Mature entries:');
        for (const e of mature.slice(0, 4)) {
          lines.push(`- [${e.maturity}] ${e.content.slice(0, 140)} [validity: ${e.validityScore.toFixed(2)}]`);
        }
      }
    }

    const all = entries.slice(0, 5);
    if (all.length > 0) {
      lines.push('Recent entries:');
      for (const e of all) {
        lines.push(`- [${e.level}/${e.maturity}] ${e.content.slice(0, 120)} [validity: ${e.validityScore.toFixed(2)}]`);
      }
    }

    return lines.join('\n');
  }

  private isCodingSource(sourceModule: string): boolean {
    return CODE_SOURCES.some(s => sourceModule.toLowerCase().includes(s));
  }

  private extractContent(signal: AetherSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}

export const aetherWeft = new AetherWeft();
