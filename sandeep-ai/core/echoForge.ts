// core/echoForge.ts - EchoForge: Hierarchical Abstraction Echo Chamber with
// Confidence-Weighted Multi-Level Retrieval and Self-Reflective Modular Consolidation
//
// Fuses H-MEM (Domain/Category/Trace/Episode layers with semantic abstraction)
// + Modular Unified Framework (Interaction/Reasoning/Consolidation + self-reflective loops):
//
// Multi-Level Hierarchy: Domain → Category → Trace → Episode with explicit bindings
// Confidence-Weighted Echo: Upward propagation with prediction-error minimization
// Modular Self-Reflective Loops: Interaction → Reasoning → Consolidation cycles
// Coding Boost: CLI/VS/MCP events forge Episodes that echo upward to persona/domain

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
  confidence?: number;
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

export type EchoLevel = 'domain' | 'category' | 'trace' | 'episode';
export type EchoModule = 'interaction' | 'reasoning' | 'consolidation';

export interface EchoHierarchicalNode {
  nodeId: string;
  level: EchoLevel;
  moduleId: EchoModule;
  confidence: number;
  content: string;
  parentId?: string;
  children: string[];
}

export interface EchoConfidentResult {
  summary: string;
  nodes: Array<{
    nodeId: string;
    level: EchoLevel;
    moduleId: EchoModule;
    content: string;
    confidence: number;
    createdAt: string;
  }>;
  avgConfidence: number;
  hierarchyPath: string[];
  reflectTrace: {
    interaction: string;
    reasoning: string;
    consolidation: string;
  };
}

const CODE_SOURCES = ['code', 'cli', 'bug', 'debt', 'api', 'codebase', 'timps-code', 'vscode', 'mcp'];

export class EchoForge {
  private minConfidence: number;
  private maxEchoDepth: number;
  private reflectionDepth: number;

  constructor(opts: { minConfidence?: number; maxEchoDepth?: number; reflectionDepth?: number } = {}) {
    const envCfg = (global as any).__echoForgeConfig || {};
    this.minConfidence = envCfg.minConfidence ?? opts.minConfidence ?? 0.65;
    this.maxEchoDepth = envCfg.maxEchoDepth ?? opts.maxEchoDepth ?? 4;
    this.reflectionDepth = envCfg.reflectionDepth ?? opts.reflectionDepth ?? 3;
  }

  // ── Legacy API (backward-compatible) ──

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
            segmentId, userId, projectId, sourceModule,
            signal.id ? String(signal.id) : null,
            rawContext, evidence, intentTags,
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

  // ── H-MEM Hierarchical Abstraction Echo Chamber ──

  async forgeHierarchical(signal: EchoSignal, sourceModule: string): Promise<{
    episodeId: string;
    hierarchyPath: string[];
    confidence: number;
  }> {
    const episodeId = crypto.randomUUID();
    const userId = signal.userId ?? 1;
    const projectId = signal.projectId ?? 'default';
    const content = this.extractContent(signal);

    if (!this.isEnabled()) {
      return { episodeId, hierarchyPath: [], confidence: 0 };
    }

    try {
      const confidence = this.computeInitialConfidence(signal, sourceModule);
      const module = this.determineModule(signal, sourceModule);

      // Create bottom-level episode
      await execute(
        `INSERT INTO echo_hierarchical_nodes
          (node_id, user_id, project_id, source_module, source_record_id,
           level, module, content, confidence, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (node_id) DO NOTHING`,
        [
          episodeId, userId, projectId, sourceModule,
          signal.id ? String(signal.id) : null,
          'episode', module, content, confidence,
          JSON.stringify(signal.metadata ?? {}),
        ]
      );

      // Echo upward with prediction-error minimization
      const hierarchyPath = await this.echoUpward(episodeId, userId, projectId, content, confidence, sourceModule, signal);

      // Coding ecosystem chain
      if (this.isCodingSource(sourceModule)) {
        await this.forgeCodingEchoChain(episodeId, userId, projectId, content, confidence);
      }

      // Modular self-reflective consolidation
      await this.reflectiveConsolidate(episodeId, userId, projectId, content, confidence);

      // Vector upsert
      if (signal.embedding) {
        await upsertVectors([{
          id: episodeId,
          vector: signal.embedding,
          payload: {
            type: 'echoforge_hierarchical',
            user_id: userId,
            project_id: projectId,
            source_module: sourceModule,
            level: 'episode',
            confidence,
            hierarchy_path: hierarchyPath,
          },
        }]);
      }

      return { episodeId, hierarchyPath, confidence };
    } catch (err) {
      console.warn('[EchoForge] Failed to forge hierarchical:', err);
      return { episodeId, hierarchyPath: [], confidence: 0 };
    }
  }

  async retrieveConfident(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    minConfidence?: number
  ): Promise<EchoConfidentResult> {
    const threshold = minConfidence ?? this.minConfidence;

    if (!this.isEnabled()) {
      return {
        summary: '', nodes: [], avgConfidence: 0, hierarchyPath: [],
        reflectTrace: { interaction: 'disabled', reasoning: 'disabled', consolidation: 'disabled' },
      };
    }

    const reflectTrace = { interaction: '', reasoning: '', consolidation: '' };

    try {
      // Multi-level traversal
      const targetLevel = this.levelForQuery(queryText);
      const rows = await query<any>(
        `SELECT node_id, level, module, content, confidence, parent_id, created_at
         FROM echo_hierarchical_nodes
         WHERE user_id = $1 AND project_id = $2
           AND level = $3 AND confidence >= $4
         ORDER BY confidence DESC, created_at DESC
         LIMIT $5`,
        [userId, projectId, targetLevel, threshold, 20]
      );
      reflectTrace.interaction = `traversed ${rows.length} nodes at ${targetLevel} level`;

      // Confidence-weighted filtering
      const filtered = rows.map(r => ({
        nodeId: r.node_id,
        level: r.level,
        moduleId: r.module,
        content: r.content,
        confidence: Number(r.confidence || 0),
        createdAt: r.created_at,
      })).filter(n => n.confidence >= threshold);
      reflectTrace.reasoning = `filtered to ${filtered.length} nodes above ${threshold.toFixed(2)} confidence`;

      // Modular consolidation synthesis
      const summary = this.synthesizeHierarchical(filtered, queryText);
      reflectTrace.consolidation = `synthesized ${summary.length} char summary from ${filtered.length} nodes`;

      const avgConfidence = filtered.length > 0
        ? filtered.reduce((s, n) => s + n.confidence, 0) / filtered.length
        : 0;

      return {
        summary,
        nodes: filtered.slice(0, 10),
        avgConfidence,
        hierarchyPath: this.extractHierarchyPath(filtered),
        reflectTrace,
      };
    } catch (err) {
      console.warn('[EchoForge] Confident retrieval failed:', err);
      return {
        summary: '', nodes: [], avgConfidence: 0, hierarchyPath: [],
        reflectTrace,
      };
    }
  }

  async buildEchoHierarchicalContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 5): Promise<string> {
    const result = await this.retrieveConfident(queryText, userId, projectId);
    if (!result.summary || result.nodes.length === 0) return '';
    return `\n\n### EchoForge Hierarchical Context\n${result.summary}\nAvg Confidence: ${result.avgConfidence.toFixed(2)} | Hierarchy: ${result.hierarchyPath.join(' → ')}\nReflect Trace: interaction=${result.reflectTrace.interaction}, reasoning=${result.reflectTrace.reasoning}, consolidation=${result.reflectTrace.consolidation}`;
  }

  // ── Echo upward propagation with prediction-error minimization ──

  private async echoUpward(
    episodeId: string, userId: number, projectId: string,
    content: string, confidence: number, sourceModule: string, signal: EchoSignal
  ): Promise<string[]> {
    const path: string[] = [episodeId];
    let currentNodeId = episodeId;
    let currentLevel: EchoLevel = 'episode';
    let currentConfidence = confidence;

    const levels: EchoLevel[] = ['trace', 'category', 'domain'];

    for (const nextLevel of levels) {
      const parentContent = this.abstractContent(content, nextLevel);
      const parentConfidence = this.computeEchoConfidence(currentConfidence, nextLevel);

      // Skip if confidence too low for this level
      if (parentConfidence < this.minConfidence * 0.7) break;

      // Find or create parent
      const parent = await this.findOrCreateParent(userId, projectId, parentContent, nextLevel, sourceModule);
      const parentId = parent.nodeId;

      // Link child → parent
      await execute(
        `INSERT INTO echo_edges
          (source_segment_id, target_segment_id, edge_type, intent_tags, confidence, created_at, updated_at)
         VALUES ($1, $2, 'echo_upward', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (source_segment_id, target_segment_id, edge_type) DO UPDATE SET
           confidence = GREATEST(echo_edges.confidence, EXCLUDED.confidence),
           updated_at = CURRENT_TIMESTAMP`,
        [currentNodeId, parentId, [nextLevel], parentConfidence]
      );

      // Update hierarchical node
      await execute(
        `INSERT INTO echo_hierarchical_nodes
          (node_id, user_id, project_id, source_module, level, module,
           content, confidence, parent_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (node_id) DO UPDATE SET
           confidence = GREATEST(echo_hierarchical_nodes.confidence, EXCLUDED.confidence),
           updated_at = CURRENT_TIMESTAMP`,
        [
          parentId, userId, projectId, sourceModule,
          nextLevel, this.determineModule(signal, sourceModule),
          parentContent, parentConfidence,
          path.length > 1 ? path[path.length - 1] : null,
        ]
      );

      path.push(parentId);
      currentNodeId = parentId;
      currentConfidence = parentConfidence;
      content = parentContent;
    }

    return path;
  }

  private abstractContent(content: string, level: EchoLevel): string {
    const normalized = content.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (level === 'trace') return `Pattern: ${normalized.slice(0, 200)}`;
    if (level === 'category') return `Category pattern from ${normalized.slice(0, 100)}...`;
    if (level === 'domain') return `Domain insight across patterns`;
    return normalized;
  }

  private computeEchoConfidence(current: number, nextLevel: EchoLevel): number {
    const decay = nextLevel === 'trace' ? 0.85 : nextLevel === 'category' ? 0.75 : 0.65;
    return this.clamp(current * decay, 0.1, 1);
  }

  private async findOrCreateParent(
    userId: number, projectId: string, content: string,
    level: EchoLevel, sourceModule: string
  ): Promise<{ nodeId: string; isNew: boolean }> {
    try {
      const similar = await query<{ node_id: string }>(
        `SELECT node_id FROM echo_hierarchical_nodes
         WHERE user_id = $1 AND project_id = $2 AND level = $3
           AND content ILIKE $4
         ORDER BY confidence DESC LIMIT 1`,
        [userId, projectId, level, `%${content.slice(0, 30)}%`]
      );

      if (similar.length > 0) {
        return { nodeId: similar[0].node_id, isNew: false };
      }
    } catch { /* fall through to create */ }

    const nodeId = crypto.randomUUID();
    return { nodeId, isNew: true };
  }

  // ── Modular self-reflective consolidation ──

  private async reflectiveConsolidate(
    episodeId: string, userId: number, projectId: string,
    content: string, confidence: number
  ): Promise<void> {
    // Interaction layer: audit event quality
    if (confidence < 0.3) {
      await execute(
        `UPDATE echo_hierarchical_nodes SET module = 'interaction', updated_at = CURRENT_TIMESTAMP WHERE node_id = $1`,
        [episodeId]
      );
    }

    // Reasoning layer: validate connections
    if (confidence >= 0.5) {
      await execute(
        `UPDATE echo_hierarchical_nodes SET module = 'reasoning', updated_at = CURRENT_TIMESTAMP WHERE node_id = $1`,
        [episodeId]
      );
    }

    // Consolidation layer: high-confidence nodes become consolidated
    if (confidence >= 0.75) {
      await execute(
        `UPDATE echo_hierarchical_nodes SET module = 'consolidation', updated_at = CURRENT_TIMESTAMP WHERE node_id = $1`,
        [episodeId]
      );
    }
  }

  // ── Coding ecosystem echo chain ──

  private async forgeCodingEchoChain(
    episodeId: string, userId: number, projectId: string,
    content: string, confidence: number
  ): Promise<void> {
    const lower = content.toLowerCase();
    const targets: string[] = [];
    if (/\b(debt|legacy|refactor|complexity)\b/.test(lower)) targets.push('burnout');
    if (/\b(team|review|handoff)\b/.test(lower)) targets.push('relationship');
    if (/\b(bug|error|crash)\b/.test(lower)) targets.push('bug');

    for (const target of targets) {
      const related = await query<{ node_id: string }>(
        `SELECT node_id FROM echo_hierarchical_nodes
         WHERE user_id = $1 AND project_id = $2
           AND content ILIKE $3 AND level = 'episode'
         ORDER BY confidence DESC LIMIT 2`,
        [userId, projectId, `%${target}%`]
      );

      for (const r of related) {
        await execute(
          `INSERT INTO echo_edges
            (source_segment_id, target_segment_id, edge_type, intent_tags, confidence, created_at, updated_at)
           VALUES ($1, $2, 'coding_echo', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (source_segment_id, target_segment_id, edge_type) DO UPDATE SET
             confidence = GREATEST(echo_edges.confidence, EXCLUDED.confidence),
             updated_at = CURRENT_TIMESTAMP`,
          [episodeId, r.node_id, [target], confidence]
        );
      }
    }
  }

  // ── Synthesis ──

  private synthesizeHierarchical(nodes: Array<{ level: EchoLevel; content: string; confidence: number }>, queryText: string): string {
    if (nodes.length === 0) return '';

    const lower = queryText.toLowerCase();
    const wantsAbstraction = /\b(pattern|abstraction|summary|domain|category)\b/.test(lower);

    const lines: string[] = [];

    if (wantsAbstraction) {
      const highLevel = nodes.filter(n => n.level === 'domain' || n.level === 'category');
      if (highLevel.length > 0) {
        lines.push('High-level abstractions:');
        for (const n of highLevel.slice(0, 4)) {
          lines.push(`- [${n.level}] ${n.content.slice(0, 160)} [${n.confidence.toFixed(2)}]`);
        }
      }
    }

    const episodes = nodes.filter(n => n.level === 'episode' || n.level === 'trace');
    if (episodes.length > 0) {
      lines.push('Episodes/traces:');
      for (const n of episodes.slice(0, 4)) {
        lines.push(`- [${n.level}] ${n.content.slice(0, 140)} [${n.confidence.toFixed(2)}]`);
      }
    }

    return lines.join('\n');
  }

  private extractHierarchyPath(nodes: Array<{ level: EchoLevel }>): string[] {
    const levels = new Set<string>();
    for (const n of nodes) levels.add(n.level);
    return [...levels];
  }

  // ── Helpers ──

  private computeInitialConfidence(signal: EchoSignal, sourceModule: string): number {
    let c = 0.5;
    const content = this.extractContent(signal);
    if (content.length > 80) c += 0.1;
    if ((signal.tags || []).length > 1) c += 0.05;
    if (signal.confidence) c = signal.confidence;
    if (this.isCodingSource(sourceModule)) c += 0.05;
    return this.clamp(c, 0.1, 1);
  }

  private determineModule(signal: EchoSignal, sourceModule: string): EchoModule {
    const c = this.computeInitialConfidence(signal, sourceModule);
    if (c >= 0.75) return 'consolidation';
    if (c >= 0.5) return 'reasoning';
    return 'interaction';
  }

  private levelForQuery(queryText: string): EchoLevel {
    const lower = queryText.toLowerCase();
    if (/\b(domain|broad|overview|high.level)\b/.test(lower)) return 'domain';
    if (/\b(category|group|class)\b/.test(lower)) return 'category';
    if (/\b(trace|track|thread)\b/.test(lower)) return 'trace';
    return 'episode';
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
    return CODE_SOURCES.some(s => sourceModule.toLowerCase().includes(s));
  }

  private extractContent(signal: EchoSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}

export const echoForge = new EchoForge();
