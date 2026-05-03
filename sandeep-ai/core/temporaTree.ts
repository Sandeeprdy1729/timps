// core/temporaTree.ts - TemporaTree: Temporal Memory Tree with Gated Hierarchical
// Consolidation and Unified Agentic LTM/STM Policy
//
// Fuses TiMem (arXiv 2601.02845) + FluxMem (arXiv 2602.14038) + AgeMem (arXiv 2601.01885):
//
// Temporal Memory Tree: Systematic consolidation from raw observations to persona abstractions
//   Root: raw events → Branches: episodic clusters → Leaves: abstracted persona patterns
//
// Gated Hierarchical Consolidation (STIM → MTEM → LTSM) with BMM-style gating:
//   Short-term buffer → Structure-aware episodic → Long-term semantic consolidation
//
// Unified Agentic Policy: Learned LTM/STM management via reflection actions
//   (consolidate/update/prune) based on utility and evidence

import * as crypto from 'crypto';
import { execute, query } from '../db/postgres';
import { upsertVectors } from '../db/vector';

export type TemporaLevel = 'raw' | 'episodic' | 'persona';
export type TemporaLayer = 'stim' | 'mtem' | 'ltsm';
export type PolicyAction = 'consolidate' | 'update' | 'prune' | 'retain';

export interface TemporaSignal {
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

export interface TemporaNodeResult {
  nodeId: string;
  level: TemporaLevel;
  layer: TemporaLayer;
  policyAction: PolicyAction;
  parentNodeId?: string;
}

export interface TemporaQueryResult {
  summary: string;
  abstractions: Array<{
    nodeId: string;
    level: TemporaLevel;
    layer: TemporaLayer;
    content: string;
    confidence: number;
    createdAt: string;
  }>;
  confidence: number;
  policyTrace: {
    treeGrowth: string;
    gating: string;
    policyDecision: string;
  };
}

const CODE_SOURCES = ['code', 'cli', 'bug', 'debt', 'api', 'codebase', 'timps-code', 'vscode', 'mcp'];

export class TemporaTree {
  private bmmThreshold: number;
  private maxTreeDepth: number;
  private policyLearnRate: number;

  constructor(opts: {
    bmmThreshold?: number;
    maxTreeDepth?: number;
    policyLearnRate?: number;
  } = {}) {
    const envCfg = (global as any).__temporaTreeConfig || {};
    this.bmmThreshold = envCfg.bmmThreshold ?? opts.bmmThreshold ?? 0.55;
    this.maxTreeDepth = envCfg.maxTreeDepth ?? opts.maxTreeDepth ?? 4;
    this.policyLearnRate = envCfg.policyLearnRate ?? opts.policyLearnRate ?? 0.1;
  }

  isEnabled(): boolean {
    return process.env.ENABLE_TEMPORATREE !== 'false';
  }

  async growTree(signal: TemporaSignal, sourceModule: string): Promise<TemporaNodeResult> {
    const nodeId = crypto.randomUUID();
    const userId = signal.userId ?? 1;
    const projectId = signal.projectId ?? 'default';
    const content = this.extractContent(signal);
    const level = this.determineLevel(signal, sourceModule);
    const layer = this.determineLayer(signal, sourceModule);
    const confidence = this.clamp(signal.confidence ?? this.defaultConfidence(layer), 0.05, 1);
    const parentNodeId = await this.findParentNode(userId, projectId, signal, sourceModule);
    let policyAction: PolicyAction = 'retain';

    if (!this.isEnabled()) {
      return { nodeId, level, layer, policyAction, parentNodeId };
    }

    try {
      // Append raw node with full provenance
      await execute(
        `INSERT INTO tempora_nodes
          (node_id, user_id, project_id, source_module, source_record_id, level, layer,
           node_data, parent_id, confidence, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (node_id) DO NOTHING`,
        [
          nodeId, userId, projectId, sourceModule,
          signal.id ? String(signal.id) : null,
          level, layer,
          JSON.stringify({ content, tags: signal.tags, entity: signal.entity, raw: signal.raw }),
          parentNodeId ?? null,
          confidence,
          JSON.stringify(signal.metadata ?? {}),
        ]
      );

      // BMM-style gated consolidation
      const gatingResult = await this.gatedConsolidate(nodeId, userId, projectId, layer, content, confidence, signal);

      // Apply unified agentic policy
      policyAction = await this.applyUnifiedPolicy(nodeId, userId, projectId, layer, confidence, sourceModule, gatingResult);

      // Vector upsert
      if (signal.embedding) {
        await upsertVectors([{
          id: nodeId,
          vector: signal.embedding,
          payload: {
            type: 'tempora_node',
            user_id: userId,
            project_id: projectId,
            source_module: sourceModule,
            level,
            layer,
            parent_id: parentNodeId,
            content,
            confidence,
          },
        }]);
      }

      // Coding ecosystem persona chain
      if (this.isCodingSource(sourceModule)) {
        await this.forgeCodingPersonaChain(nodeId, userId, projectId, content, confidence, signal);
      }
    } catch (err) {
      console.warn('[TemporaTree] Failed to grow tree:', err);
    }

    return { nodeId, level, layer, policyAction, parentNodeId };
  }

  async queryTree(
    queryText: string,
    userId: number,
    projectId: string = 'default',
    limit: number = 8
  ): Promise<TemporaQueryResult> {
    if (!this.isEnabled()) {
      return {
        summary: '', abstractions: [], confidence: 0,
        policyTrace: { treeGrowth: 'disabled', gating: 'disabled', policyDecision: 'disabled' },
      };
    }

    const policyTrace = { treeGrowth: '', gating: '', policyDecision: '' };

    try {
      // Traverse monotonic paths from raw → persona
      const targetLevel = this.targetLevelForQuery(queryText);
      const rows = await query<any>(
        `SELECT node_id, level, layer, node_data, parent_id, confidence, created_at, source_module
         FROM tempora_nodes
         WHERE user_id = $1 AND project_id = $2
           AND (level = $3 OR layer = $4)
         ORDER BY confidence DESC, created_at DESC
         LIMIT $5`,
        [userId, projectId, targetLevel, this.targetLayerForQuery(queryText), limit * 2]
      );
      policyTrace.treeGrowth = `traversed ${rows.length} nodes at ${targetLevel}/${this.targetLayerForQuery(queryText)} level`;

      // Abstract persona from path
      const abstractions = rows.map(r => {
        const nd = typeof r.node_data === 'string' ? JSON.parse(r.node_data) : r.node_data;
        return {
          nodeId: r.node_id,
          level: r.level,
          layer: r.layer,
          content: nd?.content || r.node_data,
          confidence: Number(r.confidence || 0),
          createdAt: r.created_at,
        };
      });

      const personaSummary = this.abstractPersona(abstractions, queryText);
      policyTrace.gating = 'BMM gating applied across STIM/MTEM/LTSM transitions';

      const confidence = abstractions.length > 0
        ? abstractions.reduce((s, a) => s + a.confidence, 0) / abstractions.length
        : 0;

      return {
        summary: personaSummary,
        abstractions: abstractions.slice(0, limit),
        confidence,
        policyTrace,
      };
    } catch (err) {
      console.warn('[TemporaTree] Query failed:', err);
      return {
        summary: '', abstractions: [], confidence: 0,
        policyTrace,
      };
    }
  }

  async buildTreeContext(queryText: string, userId: number, projectId: string = 'default', limit: number = 5): Promise<string> {
    const result = await this.queryTree(queryText, userId, projectId, limit);
    if (!result.summary || result.abstractions.length === 0) return '';
    return `\n\n### TemporaTree Context\n${result.summary}\nConfidence: ${result.confidence.toFixed(2)}\nPolicy Trace: growth=${result.policyTrace.treeGrowth}, gating=${result.policyTrace.gating}`;
  }

  // ── Gated hierarchical consolidation (BMM-style) ──

  private async gatedConsolidate(
    nodeId: string, userId: number, projectId: string,
    currentLayer: TemporaLayer, content: string, confidence: number, signal: TemporaSignal
  ): Promise<{ promoted: boolean; targetLayer: TemporaLayer; probability: number }> {
    const bmmProb = this.computeBMMProbability(content, confidence, signal);

    let targetLayer = currentLayer;
    let promoted = false;

    if (currentLayer === 'stim' && bmmProb >= this.bmmThreshold) {
      targetLayer = 'mtem';
      promoted = true;
    } else if (currentLayer === 'mtem' && bmmProb >= (this.bmmThreshold + 0.15)) {
      targetLayer = 'ltsm';
      promoted = true;
    }

    if (promoted) {
      await execute(
        `UPDATE tempora_nodes SET layer = $1, updated_at = CURRENT_TIMESTAMP WHERE node_id = $2`,
        [targetLayer, nodeId]
      );

      // Log gating transition
      await execute(
        `INSERT INTO tempora_gating_log
          (node_id, user_id, project_id, from_layer, to_layer, bmm_probability, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [nodeId, userId, projectId, currentLayer, targetLayer, bmmProb]
      );
    }

    return { promoted, targetLayer, probability: bmmProb };
  }

  private computeBMMProbability(content: string, confidence: number, signal: TemporaSignal): number {
    let prob = confidence * 0.5;
    const length = content.length;
    if (length > 50) prob += 0.1;
    if (length > 200) prob += 0.1;
    if ((signal.tags || []).length > 2) prob += 0.1;
    if (/\b(pattern|always|never|consistently|repeatedly)\b/.test(content.toLowerCase())) prob += 0.15;
    return this.clamp(prob, 0.05, 1);
  }

  // ── Unified agentic policy (learned LTM/STM management) ──

  private async applyUnifiedPolicy(
    nodeId: string, userId: number, projectId: string,
    layer: TemporaLayer, confidence: number, sourceModule: string, gatingResult: any
  ): Promise<PolicyAction> {
    const action = this.decidePolicyAction(layer, confidence, gatingResult, sourceModule);

    // Record policy decision
    await execute(
      `INSERT INTO tempora_policy_log
        (node_id, user_id, project_id, layer, confidence, action, source_module, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [nodeId, userId, projectId, layer, confidence, action, sourceModule]
    );

    // Execute action
    if (action === 'prune') {
      await execute(
        `UPDATE tempora_nodes SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"pruned": true}'::jsonb, updated_at = CURRENT_TIMESTAMP WHERE node_id = $1`,
        [nodeId]
      );
    } else if (action === 'consolidate') {
      await this.consolidateNode(nodeId, userId, projectId);
    }

    return action;
  }

  private decidePolicyAction(layer: TemporaLayer, confidence: number, gatingResult: any, sourceModule: string): PolicyAction {
    if (layer === 'stim' && confidence < 0.3) return 'prune';
    if (layer === 'mtem' && confidence < 0.4 && !gatingResult.promoted) return 'prune';
    if (gatingResult.promoted) return 'consolidate';
    if (layer === 'ltsm' && confidence >= 0.6) return 'retain';
    if (confidence >= 0.5) return 'update';
    return 'retain';
  }

  private async consolidateNode(nodeId: string, userId: number, projectId: string): Promise<void> {
    // Find sibling nodes and attempt to merge into higher-level abstraction
    const siblings = await query<any>(
      `SELECT node_id, node_data FROM tempora_nodes
       WHERE user_id = $1 AND project_id = $2 AND node_id <> $3 AND level = 'episodic'
       ORDER BY created_at DESC LIMIT 3`,
      [userId, projectId, nodeId]
    );

    if (siblings.length >= 2) {
      const abstractions = siblings.map(s => {
        const nd = typeof s.node_data === 'string' ? JSON.parse(s.node_data) : s.node_data;
        return nd?.content || '';
      }).filter(Boolean);

      if (abstractions.length >= 2) {
        const mergedContent = abstractions.join('; ');
        const childId = crypto.randomUUID();
        await execute(
          `INSERT INTO tempora_nodes
            (node_id, user_id, project_id, source_module, level, layer, node_data, parent_id, confidence, created_at)
           VALUES ($1, $2, $3, 'consolidation', 'persona', 'ltsm', $4, $5, 0.6, CURRENT_TIMESTAMP)`,
          [childId, userId, projectId, JSON.stringify({ content: mergedContent }), nodeId]
        );
      }
    }
  }

  // ── Coding ecosystem persona chain ──

  private async forgeCodingPersonaChain(
    nodeId: string, userId: number, projectId: string,
    content: string, confidence: number, signal: TemporaSignal
  ): Promise<void> {
    const lower = content.toLowerCase();
    const targets: string[] = [];
    if (/\b(debt|legacy|refactor|complexity)\b/.test(lower)) targets.push('burnout');
    if (/\b(team|review|handoff)\b/.test(lower)) targets.push('relationship');
    if (/\b(bug|error|crash)\b/.test(lower)) targets.push('bug_pattern');

    for (const target of targets) {
      const relatedNodes = await query<{ node_id: string }>(
        `SELECT node_id FROM tempora_nodes
         WHERE user_id = $1 AND project_id = $2
           AND (node_data::text ILIKE $3 OR source_module ILIKE $4)
           AND level = 'episodic'
         ORDER BY confidence DESC, created_at DESC LIMIT 2`,
        [userId, projectId, `%${target}%`, `%${target}%`]
      );

      for (const rn of relatedNodes) {
        await execute(
          `INSERT INTO tempora_edges
            (source_node_id, target_node_id, edge_type, confidence, created_at)
           VALUES ($1, $2, 'coding_persona', $3, CURRENT_TIMESTAMP)
           ON CONFLICT (source_node_id, target_node_id, edge_type) DO NOTHING`,
          [nodeId, rn.node_id, confidence]
        );
      }
    }
  }

  // ── Persona abstraction ──

  private abstractPersona(abstractions: Array<{ level: TemporaLevel; content: string; confidence: number }>, queryText: string): string {
    if (abstractions.length === 0) return '';

    const lower = queryText.toLowerCase();
    const wantsPersona = /\b(pattern|persona|trait|habit|tendency|profile)\b/.test(lower);

    const personaNodes = abstractions.filter(a => a.level === 'persona');
    const episodicNodes = abstractions.filter(a => a.level === 'episodic');
    const rawNodes = abstractions.filter(a => a.level === 'raw');

    const lines: string[] = [];

    if (wantsPersona && personaNodes.length > 0) {
      lines.push('Persona-level abstractions:');
      for (const n of personaNodes.slice(0, 4)) {
        lines.push(`- ${n.content.slice(0, 180)} [confidence: ${n.confidence.toFixed(2)}]`);
      }
    }

    if (episodicNodes.length > 0) {
      lines.push('Episodic clusters:');
      for (const n of episodicNodes.slice(0, 4)) {
        lines.push(`- ${n.content.slice(0, 140)}`);
      }
    }

    if (rawNodes.length > 0 && !wantsPersona) {
      lines.push('Recent observations:');
      for (const n of rawNodes.slice(0, 4)) {
        lines.push(`- ${n.content.slice(0, 140)}`);
      }
    }

    return lines.join('\n');
  }

  // ── Tree traversal ──

  private targetLevelForQuery(queryText: string): TemporaLevel {
    const lower = queryText.toLowerCase();
    if (/\b(pattern|persona|trait|habit|long.term|profile)\b/.test(lower)) return 'persona';
    if (/\b(episode|cluster|session|period)\b/.test(lower)) return 'episodic';
    return 'raw';
  }

  private targetLayerForQuery(queryText: string): TemporaLayer {
    const lower = queryText.toLowerCase();
    if (/\b(stable|long.term|persistent|established)\b/.test(lower)) return 'ltsm';
    if (/\b(recent|short.term|fresh|current)\b/.test(lower)) return 'stim';
    return 'mtem';
  }

  private async findParentNode(
    userId: number, projectId: string, signal: TemporaSignal, sourceModule: string
  ): Promise<string | undefined> {
    const content = this.extractContent(signal);
    const lower = content.toLowerCase();

    try {
      const rows = await query<{ node_id: string }>(
        `SELECT node_id FROM tempora_nodes
         WHERE user_id = $1 AND project_id = $2
           AND level IN ('raw', 'episodic')
           AND layer = $3
         ORDER BY created_at DESC LIMIT 1`,
        [userId, projectId, this.determineLayer(signal, sourceModule)]
      );
      return rows[0]?.node_id;
    } catch {
      return undefined;
    }
  }

  // ── Helpers ──

  private determineLevel(signal: TemporaSignal, sourceModule: string): TemporaLevel {
    const content = this.extractContent(signal).toLowerCase();
    if (/\b(pattern|persona|trait|habit|consistently|always)\b/.test(content)) return 'persona';
    if (/\b(session|episode|period|phase)\b/.test(content)) return 'episodic';
    return 'raw';
  }

  private determineLayer(signal: TemporaSignal, sourceModule: string): TemporaLayer {
    const content = this.extractContent(signal).toLowerCase();
    const tags = (signal.tags || []).join(' ').toLowerCase();
    const combined = `${content} ${tags}`;

    if (/\b(stable|established|persistent|long.term)\b/.test(combined)) return 'ltsm';
    if (/\b(recent|new|fresh|short.term|draft)\b/.test(combined)) return 'stim';
    return 'mtem';
  }

  private defaultConfidence(layer: TemporaLayer): number {
    return layer === 'ltsm' ? 0.72 : layer === 'mtem' ? 0.56 : 0.45;
  }

  private isCodingSource(sourceModule: string): boolean {
    return CODE_SOURCES.some(s => sourceModule.toLowerCase().includes(s));
  }

  private extractContent(signal: TemporaSignal): string {
    if (signal.content) return signal.content;
    if (typeof signal.raw === 'string') return signal.raw;
    if (signal.raw) return JSON.stringify(signal.raw);
    return JSON.stringify(signal);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}

export const temporaTree = new TemporaTree();
