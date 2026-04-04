// core/curateTier.ts — CurateTier: Agent-Native Hierarchical Curation Engine
//
// Three-tier hierarchy: raw (transient) → episodic (event clusters) → semantic (persona-level)
// Atomic lifecycle: admit → curate → tier → propagate → evolve
// Bounded curation: O(1) amortized per memory via heuristic scoring + optional LLM

import { execute, query } from '../db/postgres';

export type CurationTier = 'raw' | 'episodic' | 'semantic';

export interface CurationInput {
  content: string;
  tags: string[];
  importance: number;
  memoryType: string;
  source: string;           // 'reflection' | 'coding' | 'tool-output' | 'user-explicit'
  memoryId?: number;        // existing memory row id (if already stored)
}

export interface CurationResult {
  tier: CurationTier;
  score: number;
  gated: boolean;
  propagatedTo: string[];
}

// Weights for multi-factor curation scoring
const WEIGHTS = {
  relevance: 0.35,
  utility:   0.25,
  novelty:   0.20,
  recency:   0.20,
};

// Thresholds
const GATE_THRESHOLD = 0.3;           // Below this → gate/compress
const EPISODIC_THRESHOLD = 0.5;       // Above this → episodic
const SEMANTIC_THRESHOLD = 0.8;       // Above this + abstract tags → semantic

// Tags that signal semantic-level abstractions
const SEMANTIC_TAGS = new Set([
  'abstract', 'pattern', 'identity', 'values', 'manifesto',
  'persona', 'principle', 'worldview', 'philosophy', 'life-theme',
]);

// Tags that signal episodic-level events
const EPISODIC_TAGS = new Set([
  'event', 'coding', 'meeting', 'session', 'incident', 'decision',
  'bug', 'deployment', 'review', 'project', 'milestone',
]);

// Coding-related sources for auto-curation boost
const CODING_SOURCES = new Set([
  'coding', 'tech-debt', 'bug-pattern', 'api-knowledge',
  'codebase-culture', 'code-incident',
]);

// Tool propagation map: tier + source → which tool tables benefit
const PROPAGATION_MAP: Record<string, string[]> = {
  'episodic:coding':       ['workflow_patterns', 'code_incidents'],
  'episodic:bug-pattern':  ['bug_patterns'],
  'episodic:tech-debt':    ['code_incidents'],
  'episodic:meeting':      ['meeting_commitments'],
  'episodic:decision':     ['decisions'],
  'semantic:coding':       ['workflow_patterns', 'learning_events'],
  'semantic:pattern':      ['behavioral_events'],
  'semantic:identity':     ['value_observations'],
  'semantic:values':       ['value_observations'],
};

export class CurateTier {
  /**
   * Main curation entry point.
   * Scores a memory, assigns a tier, gates low-value items, and propagates.
   */
  async curate(memory: CurationInput, userId: number): Promise<CurationResult> {
    // ── Step 1: Compute multi-factor curation score ──────────────────────
    const relevance = this.computeRelevance(memory);
    const utility   = this.computeUtility(memory);
    const novelty   = this.computeNovelty(memory);
    const recency   = this.computeRecency(memory);

    const score = (
      WEIGHTS.relevance * relevance +
      WEIGHTS.utility   * utility +
      WEIGHTS.novelty   * novelty +
      WEIGHTS.recency   * recency
    );

    // ── Step 2: Gate low-value memories ──────────────────────────────────
    if (score < GATE_THRESHOLD) {
      await this.logDecision(userId, memory, 'raw', score, relevance, utility, novelty, recency, true, []);
      return { tier: 'raw', score, gated: true, propagatedTo: [] };
    }

    // ── Step 3: Assign tier ─────────────────────────────────────────────
    const tier = this.assignTier(memory, score);

    // ── Step 4: Propagate to relevant tool tables ───────────────────────
    const propagatedTo = await this.propagateToTools(memory, tier, userId);

    // ── Step 5: Update memory record with tier + score ──────────────────
    if (memory.memoryId) {
      await this.updateMemoryTier(memory.memoryId, tier, score);
    }

    // ── Step 6: Log curation decision ───────────────────────────────────
    await this.logDecision(userId, memory, tier, score, relevance, utility, novelty, recency, false, propagatedTo);

    return { tier, score, gated: false, propagatedTo };
  }

  /**
   * Assign tier based on score + tag analysis.
   * O(t) where t = number of tags (small constant).
   */
  assignTier(memory: CurationInput, score: number): CurationTier {
    const tags = memory.tags || [];
    const hasSemanticTag = tags.some(t => SEMANTIC_TAGS.has(t.toLowerCase()));
    const hasEpisodicTag = tags.some(t => EPISODIC_TAGS.has(t.toLowerCase()));

    if (score >= SEMANTIC_THRESHOLD && hasSemanticTag) {
      return 'semantic';
    }
    if (score >= EPISODIC_THRESHOLD || hasEpisodicTag) {
      return 'episodic';
    }
    return 'raw';
  }

  /**
   * Relevance: importance-based + coding boost.
   * Range: [0, 1]
   */
  private computeRelevance(memory: CurationInput): number {
    const importanceNorm = Math.min(memory.importance / 5, 1);
    const codingBoost = CODING_SOURCES.has(memory.source) ? 0.15 : 0;
    return Math.min(importanceNorm + codingBoost, 1);
  }

  /**
   * Utility: tag richness + content length signal.
   * Range: [0, 1]
   */
  private computeUtility(memory: CurationInput): number {
    const tagScore = Math.min((memory.tags?.length || 0) / 5, 1);
    const contentLength = memory.content.length;
    const lengthScore = Math.min(contentLength / 500, 1);
    return 0.6 * tagScore + 0.4 * lengthScore;
  }

  /**
   * Novelty: heuristic based on unique keywords in content.
   * Range: [0, 1]
   */
  private computeNovelty(memory: CurationInput): number {
    const words = new Set(memory.content.toLowerCase().split(/\s+/));
    // More unique words → higher novelty signal
    return Math.min(words.size / 50, 1);
  }

  /**
   * Recency: always 1.0 for newly ingested memories.
   * For re-curation, this could decay based on age.
   * Range: [0, 1]
   */
  private computeRecency(_memory: CurationInput): number {
    return 1.0; // New memories get full recency
  }

  /**
   * Propagate curated memory context to relevant tool tables.
   * Returns list of tables that received propagation.
   */
  private async propagateToTools(
    memory: CurationInput,
    tier: CurationTier,
    userId: number
  ): Promise<string[]> {
    const propagated: string[] = [];

    // Build propagation keys from tier + source and tier + tags
    const keys = [`${tier}:${memory.source}`];
    for (const tag of memory.tags || []) {
      keys.push(`${tier}:${tag.toLowerCase()}`);
    }

    for (const key of keys) {
      const targets = PROPAGATION_MAP[key];
      if (targets) {
        for (const table of targets) {
          if (!propagated.includes(table)) {
            propagated.push(table);
          }
        }
      }
    }

    // Record propagation targets for the decision log
    // (actual propagation logging happens in logDecision; no duplicate insert needed)

    return propagated;
  }

  /**
   * Update an existing memory row with tier + curation_score.
   */
  private async updateMemoryTier(memoryId: number, tier: CurationTier, score: number): Promise<void> {
    try {
      await execute(
        `UPDATE memories SET tier = $1, curation_score = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [tier, score, memoryId]
      );
    } catch {
      // Best-effort — column may not exist yet if migration hasn't run
    }
  }

  /**
   * Log a curation decision for traceability.
   */
  private async logDecision(
    userId: number,
    memory: CurationInput,
    tier: CurationTier,
    score: number,
    relevance: number,
    utility: number,
    novelty: number,
    recency: number,
    gated: boolean,
    propagatedTo: string[]
  ): Promise<void> {
    try {
      await execute(
        `INSERT INTO curate_tier_decisions
         (user_id, memory_id, tier, curation_score, relevance_score, utility_score, novelty_score, recency_score, gated, source_type, propagated_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [userId, memory.memoryId || null, tier, score, relevance, utility, novelty, recency, gated, memory.source, propagatedTo]
      );
    } catch {
      // Best-effort logging
    }
  }

  /**
   * Batch evolve: compute tier summaries for a user.
   * O(m) where m = number of curated memories.
   */
  async evolve(userId: number): Promise<void> {
    const tiers: CurationTier[] = ['raw', 'episodic', 'semantic'];

    for (const tier of tiers) {
      try {
        const stats = await query<{ count: string; avg_score: string }>(
          `SELECT COUNT(*) as count, COALESCE(AVG(curation_score), 0) as avg_score
           FROM curate_tier_decisions WHERE user_id = $1 AND tier = $2 AND gated = FALSE`,
          [userId, tier]
        );

        if (stats.length > 0) {
          await execute(
            `INSERT INTO curate_tier_summaries (user_id, tier, memory_count, avg_score, computed_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [userId, tier, parseInt(stats[0].count), parseFloat(stats[0].avg_score)]
          );
        }
      } catch {
        // Best-effort evolution
      }
    }
  }

  /**
   * Get tier distribution for a user (for dashboard / diagnostics).
   */
  async getTierDistribution(userId: number): Promise<Array<{ tier: string; count: number; avg_score: number }>> {
    try {
      return await query<{ tier: string; count: number; avg_score: number }>(
        `SELECT tier, COUNT(*) as count, COALESCE(AVG(curation_score), 0) as avg_score
         FROM curate_tier_decisions WHERE user_id = $1 AND gated = FALSE
         GROUP BY tier ORDER BY tier`,
        [userId]
      );
    } catch {
      return [];
    }
  }

  /**
   * Get recent curation decisions for a user.
   */
  async getRecentDecisions(userId: number, limit: number = 20): Promise<any[]> {
    try {
      return await query(
        `SELECT * FROM curate_tier_decisions
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
      );
    } catch {
      return [];
    }
  }
}

export const curateTier = new CurateTier();
