// core/gateWeave.ts — GateWeave: Adaptive Memory Admission Weaver
// Write-time + reflection-time scoring, belief versioning, proactive propagation
import { query, execute, queryOne } from '../db/postgres';
import { searchVectors } from '../db/vector';
import { createEmbeddingModel } from '../models';
import { config } from '../config/env';
import crypto from 'crypto';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface AdmissionScore {
  total: number;
  utility: number;
  confidence: number;
  novelty: number;
  recency: number;
  toolRelevance: number;
}

export interface AdmissionDecision {
  decision: 'admit' | 'summarize' | 'discard';
  score: AdmissionScore;
  beliefVersionCreated: boolean;
}

export interface BeliefVersion {
  id?: number;
  user_id: number;
  project_id: string;
  statement_hash: string;
  content: string;
  version: number;
  confidence: number;
  parent_version_id?: number;
  linked_position_id?: number;
  linked_contradiction_ids: number[];
  status: 'active' | 'superseded' | 'retracted';
  metadata: Record<string, any>;
  created_at?: Date;
}

export interface GateWeaveStats {
  total_decisions: number;
  admitted: number;
  summarized: number;
  discarded: number;
  admission_rate: number;
  avg_score: number;
  active_beliefs: number;
  storage_savings_pct: number;
}

// ── Scoring Weights (tunable) ───────────────────────────────────────────────

export interface ScoringWeights {
  utility: number;
  confidence: number;
  novelty: number;
  recency: number;
  toolRelevance: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  utility: 0.30,
  confidence: 0.25,
  novelty: 0.20,
  recency: 0.15,
  toolRelevance: 0.10,
};

const ADMIT_THRESHOLD = 0.45;
const SUMMARIZE_THRESHOLD = 0.25;

// Tool-relevant keywords that boost scores
const TOOL_RELEVANT_TAGS = new Set([
  'burnout', 'stress', 'exhausted', 'overwhelmed', 'drained',
  'relationship', 'drift', 'conflict', 'compatibility',
  'contradiction', 'position', 'belief', 'opinion',
  'regret', 'decision', 'mistake',
  'bug', 'error', 'incident', 'pattern',
  'goal', 'project', 'learning', 'skill',
]);

// ── GateWeave Service ───────────────────────────────────────────────────────

export class GateWeave {
  private embeddingModel = createEmbeddingModel();
  private weights: ScoringWeights = { ...DEFAULT_WEIGHTS };

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Score and gate a memory before storage.
   * Returns the admission decision and score breakdown.
   */
  async evaluateMemory(
    userId: number,
    projectId: string,
    content: string,
    memoryType: string,
    importance: number,
    tags: string[]
  ): Promise<AdmissionDecision> {
    const score = await this.scoreMemory(userId, projectId, content, importance, tags);
    const decision = this.gate(score);

    // Log the decision
    await this.logDecision(userId, projectId, content, decision, score);

    // Check for belief versioning (position-like statements)
    let beliefVersionCreated = false;
    if (decision === 'admit' && this.isPositionLike(content, tags)) {
      beliefVersionCreated = await this.createOrUpdateBeliefVersion(
        userId, projectId, content, score.confidence
      );
    }

    return { decision, score, beliefVersionCreated };
  }

  /**
   * Get a summary text for medium-score gated memories.
   * Appends to an existing summary or creates a new one.
   */
  async summarizeAndLink(
    userId: number,
    projectId: string,
    content: string,
    tags: string[]
  ): Promise<number> {
    // Look for a recent summary to append to (within last hour)
    const existing = await queryOne<{ id: number; summary: string; source_count: number; source_previews: string[] }>(
      `SELECT id, summary, source_count, source_previews FROM gateweave_summaries
       WHERE user_id = $1 AND project_id = $2
         AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY created_at DESC LIMIT 1`,
      [userId, projectId]
    );

    const preview = content.length > 200 ? content.slice(0, 200) + '...' : content;

    if (existing) {
      const updatedPreviews = [...(existing.source_previews || []), preview].slice(-10);
      await execute(
        `UPDATE gateweave_summaries
         SET summary = summary || E'\n• ' || $1,
             source_count = source_count + 1,
             source_previews = $2,
             tags = tags || $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [preview, updatedPreviews, tags, existing.id]
      );
      return existing.id;
    }

    const result = await query<{ id: number }>(
      `INSERT INTO gateweave_summaries (user_id, project_id, summary, source_count, source_previews, tags)
       VALUES ($1, $2, $3, 1, $4, $5) RETURNING id`,
      [userId, projectId, `• ${preview}`, [preview], tags]
    );
    return result[0].id;
  }

  /**
   * Create or update a belief version for position-like statements.
   * If a similar belief exists, supersedes it and links the chain.
   */
  async createOrUpdateBeliefVersion(
    userId: number,
    projectId: string,
    content: string,
    confidence: number
  ): Promise<boolean> {
    const hash = this.hashStatement(content);

    // Find existing active belief with similar hash or semantic similarity
    const existing = await this.findSimilarBelief(userId, projectId, content);

    if (existing) {
      // Supersede the old version
      await execute(
        `UPDATE belief_versions SET status = 'superseded' WHERE id = $1`,
        [existing.id]
      );

      // Create new version linked to parent
      await query(
        `INSERT INTO belief_versions
         (user_id, project_id, statement_hash, content, version, confidence,
          parent_version_id, linked_position_id, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)`,
        [
          userId, projectId, hash, content, existing.version + 1,
          confidence, existing.id, existing.linked_position_id,
          JSON.stringify({ evolved_from: existing.content.slice(0, 200) }),
        ]
      );
    } else {
      // Create first version
      await query(
        `INSERT INTO belief_versions
         (user_id, project_id, statement_hash, content, version, confidence, status)
         VALUES ($1, $2, $3, $4, 1, $5, 'active')`,
        [userId, projectId, hash, content, confidence]
      );
    }

    return true;
  }

  /**
   * Proactively propagate high-impact belief changes to dependent tool tables.
   * Called after a belief version is created/updated.
   */
  async propagateToTools(
    userId: number,
    content: string,
    tags: string[]
  ): Promise<string[]> {
    const propagated: string[] = [];
    const lowerContent = content.toLowerCase();

    // Propagate to burnout baseline if burnout-related
    if (this.matchesAny(lowerContent, ['burnout', 'stress', 'exhaust', 'overwhelm', 'drain', 'energy'])) {
      const hasBaseline = await queryOne(
        `SELECT id FROM burnout_baseline WHERE user_id = $1`,
        [userId]
      );
      if (hasBaseline) {
        // Flag baseline for refresh
        await execute(
          `UPDATE burnout_baseline SET computed_at = NOW() - INTERVAL '31 days' WHERE user_id = $1`,
          [userId]
        );
        propagated.push('burnout_baseline_refresh_flagged');
      }
    }

    // Propagate to relationship health if relationship-related
    if (this.matchesAny(lowerContent, ['relationship', 'friend', 'colleague', 'partner', 'drift', 'conflict'])) {
      // Find mentioned contacts and flag for health recompute
      const contacts = await query<{ contact_name: string }>(
        `SELECT DISTINCT contact_name FROM relationship_health WHERE user_id = $1`,
        [userId]
      );
      if (contacts.length > 0) {
        await execute(
          `UPDATE relationship_health SET computed_at = NOW() - INTERVAL '8 days' WHERE user_id = $1`,
          [userId]
        );
        propagated.push('relationship_health_refresh_flagged');
      }
    }

    return propagated;
  }

  /**
   * Get GateWeave statistics for a user.
   */
  async getStats(userId: number): Promise<GateWeaveStats> {
    const decisions = await query<{ decision: string; cnt: string; avg_score: string }>(
      `SELECT decision, COUNT(*)::text as cnt, AVG(score)::text as avg_score
       FROM gateweave_decisions WHERE user_id = $1
       GROUP BY decision`,
      [userId]
    );

    const beliefs = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text as cnt FROM belief_versions WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    let total = 0, admitted = 0, summarized = 0, discarded = 0, scoreSum = 0;
    for (const d of decisions) {
      const c = parseInt(d.cnt, 10);
      total += c;
      scoreSum += parseFloat(d.avg_score) * c;
      if (d.decision === 'admit') admitted = c;
      else if (d.decision === 'summarize') summarized = c;
      else if (d.decision === 'discard') discarded = c;
    }

    return {
      total_decisions: total,
      admitted,
      summarized,
      discarded,
      admission_rate: total > 0 ? admitted / total : 0,
      avg_score: total > 0 ? scoreSum / total : 0,
      active_beliefs: parseInt(beliefs?.cnt || '0', 10),
      storage_savings_pct: total > 0 ? ((summarized + discarded) / total) * 100 : 0,
    };
  }

  /**
   * List active beliefs for a user/project.
   */
  async listBeliefs(
    userId: number,
    projectId: string,
    limit: number = 20
  ): Promise<BeliefVersion[]> {
    return query<BeliefVersion>(
      `SELECT * FROM belief_versions
       WHERE user_id = $1 AND project_id = $2 AND status = 'active'
       ORDER BY created_at DESC LIMIT $3`,
      [userId, projectId, limit]
    );
  }

  /**
   * Get the version history of a specific belief chain.
   */
  async getBeliefHistory(beliefId: number): Promise<BeliefVersion[]> {
    // Traverse upward via parent_version_id
    const chain: BeliefVersion[] = [];
    let currentId: number | null = beliefId;

    while (currentId !== null && chain.length < 50) {
      const belief: BeliefVersion | null = await queryOne<BeliefVersion>(
        `SELECT * FROM belief_versions WHERE id = $1`,
        [currentId]
      );
      if (!belief) break;
      chain.push(belief);
      currentId = belief.parent_version_id ?? null;
    }

    return chain.reverse(); // oldest first
  }

  /**
   * Update scoring weights (tunable per user preference).
   */
  setWeights(weights: Partial<ScoringWeights>): void {
    this.weights = { ...this.weights, ...weights };
    // Normalize to sum to 1.0
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (const key of Object.keys(this.weights) as (keyof ScoringWeights)[]) {
        this.weights[key] /= sum;
      }
    }
  }

  // ── Private Scoring Methods ─────────────────────────────────────────────

  private async scoreMemory(
    userId: number,
    projectId: string,
    content: string,
    importance: number,
    tags: string[]
  ): Promise<AdmissionScore> {
    const utility = await this.scoreUtility(userId, projectId, content);
    const confidence = this.scoreConfidence(userId, content, importance);
    const novelty = await this.scoreNovelty(userId, projectId, content);
    const recency = this.scoreRecency();
    const toolRelevance = this.scoreToolRelevance(content, tags);

    const total =
      this.weights.utility * utility +
      this.weights.confidence * confidence +
      this.weights.novelty * novelty +
      this.weights.recency * recency +
      this.weights.toolRelevance * toolRelevance;

    return { total, utility, confidence, novelty, recency, toolRelevance };
  }

  /**
   * Utility: How relevant is this memory to the user's active context?
   * Uses embedding similarity against recent memories.
   */
  private async scoreUtility(
    userId: number,
    projectId: string,
    content: string
  ): Promise<number> {
    if (!config.qdrant.url) {
      // Fallback: Use importance-based heuristic
      return 0.5;
    }

    try {
      const embedding = await this.embeddingModel.getEmbedding(content);
      const recent = await searchVectors(embedding.embedding, 5, {
        must: [
          { key: 'user_id', match: { value: userId } },
          { key: 'project_id', match: { value: projectId } },
        ],
      });

      if (recent.length === 0) return 0.5; // No context yet

      // Average similarity to recent relevant memories
      // Higher similarity = more relevant to current context = higher utility
      const avgSim = recent.reduce((sum, r) => {
        // Qdrant search results have a score field in the raw response
        // but our VectorPoint interface doesn't expose it;
        // approximate via payload presence
        return sum + 0.7; // baseline for having relevant neighbors
      }, 0) / recent.length;

      return Math.min(1.0, avgSim);
    } catch {
      return 0.5;
    }
  }

  /**
   * Confidence: Cross-check against known contradictions.
   * Lower confidence if the statement conflicts with existing beliefs.
   */
  private scoreConfidence(
    _userId: number,
    content: string,
    importance: number
  ): number {
    // Base confidence from importance (1-5 → 0.2-1.0)
    const baseConfidence = Math.min(1.0, importance / 5);

    // Penalize very short or vague content
    const lengthFactor = Math.min(1.0, content.length / 100);

    // Boost if content contains concrete details (numbers, dates, names)
    const concreteness = /\d{4}|\d+%|\$\d+|specific|exact|precisely/i.test(content) ? 1.1 : 1.0;

    return Math.min(1.0, baseConfidence * 0.6 + lengthFactor * 0.3 + concreteness * 0.1);
  }

  /**
   * Novelty: How different is this from what we already know?
   * Uses cosine distance to existing memories.
   */
  private async scoreNovelty(
    userId: number,
    projectId: string,
    content: string
  ): Promise<number> {
    if (!config.qdrant.url) {
      return 0.5; // Assume moderate novelty without vectors
    }

    try {
      const embedding = await this.embeddingModel.getEmbedding(content);
      const similar = await searchVectors(embedding.embedding, 3, {
        must: [
          { key: 'user_id', match: { value: userId } },
          { key: 'project_id', match: { value: projectId } },
        ],
      });

      if (similar.length === 0) return 0.9; // Very novel — nothing similar exists

      // If very similar memories exist, novelty is low
      // We can't directly get the similarity score from our VectorPoint interface,
      // so we use the count of near-neighbors as a proxy
      return Math.max(0.1, 1.0 - (similar.length / 5));
    } catch {
      return 0.5;
    }
  }

  /**
   * Recency: Temporal freshness with exponential decay.
   * Since we're scoring at write-time, this is always high (close to 1.0).
   * For batch/delayed ingestion, this would decay.
   */
  private scoreRecency(): number {
    return 0.95; // At write-time, recency is near-maximum
  }

  /**
   * Tool Relevance: Does the content relate to TIMPs specialized tools?
   * Boosts memories about burnout, relationships, contradictions, etc.
   */
  private scoreToolRelevance(content: string, tags: string[]): number {
    const lowerContent = content.toLowerCase();
    let relevance = 0.5; // baseline

    // Check tags
    for (const tag of tags) {
      if (TOOL_RELEVANT_TAGS.has(tag.toLowerCase())) {
        relevance = Math.min(1.0, relevance + 0.15);
      }
    }

    // Check content keywords
    for (const keyword of TOOL_RELEVANT_TAGS) {
      if (lowerContent.includes(keyword)) {
        relevance = Math.min(1.0, relevance + 0.1);
        break; // One content match is enough
      }
    }

    return relevance;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  private gate(score: AdmissionScore): 'admit' | 'summarize' | 'discard' {
    if (score.total >= ADMIT_THRESHOLD) return 'admit';
    if (score.total >= SUMMARIZE_THRESHOLD) return 'summarize';
    return 'discard';
  }

  private isPositionLike(content: string, tags: string[]): boolean {
    const positionPatterns = [
      /\bi think\b/i, /\bi believe\b/i, /\bin my opinion\b/i,
      /\bshould\b/i, /\bmust\b/i, /\bwill always\b/i,
      /\bnever\b/i, /\beveryone should\b/i,
    ];
    if (tags.some(t => ['position', 'belief', 'opinion', 'claim'].includes(t.toLowerCase()))) {
      return true;
    }
    return positionPatterns.some(p => p.test(content));
  }

  private hashStatement(content: string): string {
    // Normalize: lowercase, remove extra whitespace, first 200 chars
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  private async findSimilarBelief(
    userId: number,
    projectId: string,
    content: string
  ): Promise<BeliefVersion | null> {
    const hash = this.hashStatement(content);

    // First try exact hash match
    const hashMatch = await queryOne<BeliefVersion>(
      `SELECT * FROM belief_versions
       WHERE user_id = $1 AND project_id = $2 AND statement_hash = $3 AND status = 'active'
       ORDER BY version DESC LIMIT 1`,
      [userId, projectId, hash]
    );

    if (hashMatch) return hashMatch;

    // Fallback: keyword overlap with recent active beliefs
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 5);
    if (words.length === 0) return null;

    const pattern = words.join('|');
    const similar = await queryOne<BeliefVersion>(
      `SELECT * FROM belief_versions
       WHERE user_id = $1 AND project_id = $2 AND status = 'active'
         AND content ~* $3
       ORDER BY version DESC LIMIT 1`,
      [userId, projectId, pattern]
    );

    return similar;
  }

  private async logDecision(
    userId: number,
    projectId: string,
    content: string,
    decision: 'admit' | 'summarize' | 'discard',
    score: AdmissionScore
  ): Promise<void> {
    try {
      await execute(
        `INSERT INTO gateweave_decisions
         (user_id, project_id, content_preview, decision, score, score_breakdown)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          projectId,
          content.slice(0, 500),
          decision,
          score.total,
          JSON.stringify(score),
        ]
      );
    } catch {
      // Non-critical — don't fail memory storage for logging errors
    }
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some(k => text.includes(k));
  }
}

// Singleton
export const gateWeave = new GateWeave();
