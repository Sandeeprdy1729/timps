import { BaseTool, ToolParameter } from './baseTool';
import { positionStore, ContradictionResult, Position } from './positionStore';
import { createModel } from '../models';
import { config } from '../config/env';

interface ExtractedClaim {
  claim: string;
  topic: string;
  claim_type: 'normative' | 'empirical' | 'predictive' | 'general';
  confidence: number;
}

interface ClaimExtractionResult {
  claims: ExtractedClaim[];
  is_arguable: boolean;
}

interface ContradictionScore {
  verdict: 'CONTRADICTION' | 'PARTIAL' | 'CLEAN';
  contradiction_score: number;
  semantic_similarity: number;
  explanation: string;
  memory_quote: string | null;
}

export class ContradictionTool extends BaseTool {
  name = 'argument_dna_mapper';
  description =
    'Tool 5 — Argument DNA Mapper. Detects if a new statement contradicts any of the ' +
    "user's previously stored positions. Can also store new positions, list all stored " +
    'positions, or delete a position. Use this whenever a user makes a claim or argues ' +
    'a position — the tool will warn if they have said the opposite before.';

  parameters: ToolParameter = {
    type: 'object',
    description: 'Argument DNA Mapper parameters',
    properties: {
      operation: {
        type: 'string',
        description:
          'check: analyze text for contradictions against memory | ' +
          'store: manually store a position | ' +
          'list: list all stored positions | ' +
          'delete: remove a position by id',
        enum: ['check', 'store', 'list', 'delete'],
      },
      text: {
        type: 'string',
        description: 'The text or statement to check or store',
      },
      user_id: {
        type: 'number',
        description: 'The user ID whose positions to check against',
      },
      project_id: {
        type: 'string',
        description: 'Project context (defaults to "default")',
      },
      position_id: {
        type: 'number',
        description: 'Position ID to delete (only for delete operation)',
      },
      auto_store: {
        type: 'boolean',
        description:
          'Whether to automatically store extracted claims after checking (default: true)',
      },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const {
      operation,
      text,
      user_id,
      project_id = 'default',
      position_id,
      auto_store = true,
    } = params;

    switch (operation) {
      case 'check':
        if (!text) return JSON.stringify({ error: 'text is required for check operation' });
        return this.checkContradictions(text, user_id, project_id, auto_store);

      case 'store':
        if (!text) return JSON.stringify({ error: 'text is required for store operation' });
        return this.storePositionFromText(text, user_id, project_id);

      case 'list':
        return this.listPositions(user_id, project_id);

      case 'delete':
        if (!position_id)
          return JSON.stringify({ error: 'position_id is required for delete operation' });
        return this.deletePosition(position_id, user_id);

      default:
        return JSON.stringify({ error: `Unknown operation: ${operation}` });
    }
  }

  // ─── Core: check text for contradictions ─────────────────────────────────

  private async checkContradictions(
    text: string,
    userId: number,
    projectId: string,
    autoStore: boolean
  ): Promise<string> {
    try {
      // Step 1: Extract arguable claims from input text
      const extraction = await this.extractClaims(text);

      if (!extraction.is_arguable || extraction.claims.length === 0) {
        return JSON.stringify({
          verdict: 'CLEAN',
          reason: 'No arguable claims detected in text',
          extracted_claims: [],
          positions_checked: 0,
          contradiction_score: 0,
          semantic_similarity: 0,
          explanation:
            'The provided text does not contain arguable position statements that could be contradicted.',
        });
      }

      // Step 2: For each extracted claim, search existing positions
      const allResults: ContradictionResult[] = [];

      for (const claim of extraction.claims) {
        const similarPositions = await positionStore.searchSimilarPositions(
          userId,
          projectId,
          claim.claim,
          5
        );

        if (similarPositions.length === 0) {
          // No similar positions found — store if auto_store is on
          if (autoStore) {
            await this.persistClaim(claim, text, userId, projectId);
          }
          continue;
        }

        // Step 3: Score contradiction against each similar position
        for (const pos of similarPositions) {
          const score = await this.scoreContradiction(claim.claim, pos.extracted_claim);

          const result: ContradictionResult = {
            verdict: score.verdict,
            contradiction_score: score.contradiction_score,
            semantic_similarity: score.semantic_similarity,
            matched_position: pos,
            explanation: score.explanation,
            memory_quote: score.memory_quote || undefined,
            extracted_claims: extraction.claims.map(c => c.claim),
            positions_checked: similarPositions.length,
          };

          allResults.push(result);

          // Record contradiction in history if score is meaningful
          if (score.contradiction_score > 0.35) {
            await positionStore.storeContradictionRecord({
              position_id: pos.id!,
              contradicted_by_text: text,
              contradiction_score: score.contradiction_score,
              semantic_similarity: score.semantic_similarity,
              explanation: score.explanation,
              memory_quote: score.memory_quote || undefined,
              acknowledged: false,
              resolved: false,
            });
          }
        }

        // Auto-store the new claim
        if (autoStore) {
          await this.persistClaim(claim, text, userId, projectId);
        }
      }

      // Step 4: Surface the strongest contradiction found
      if (allResults.length === 0) {
        return JSON.stringify({
          verdict: 'CLEAN',
          extracted_claims: extraction.claims.map(c => c.claim),
          positions_checked: 0,
          contradiction_score: 0,
          semantic_similarity: 0,
          explanation: 'No existing positions found to compare against. Claims stored for future checks.',
        });
      }

      // Sort by contradiction score, return the worst offender
      allResults.sort((a, b) => b.contradiction_score - a.contradiction_score);
      const topResult = allResults[0];

      return JSON.stringify({
        verdict: topResult.verdict,
        contradiction_score: Number(topResult.contradiction_score.toFixed(3)),
        semantic_similarity: Number(topResult.semantic_similarity.toFixed(3)),
        matched_position: topResult.matched_position
          ? {
              id: topResult.matched_position.id,
              extracted_claim: topResult.matched_position.extracted_claim,
              topic_cluster: topResult.matched_position.topic_cluster,
              created_at: topResult.matched_position.created_at,
            }
          : null,
        explanation: topResult.explanation,
        memory_quote: topResult.memory_quote || null,
        extracted_claims: topResult.extracted_claims,
        positions_checked: topResult.positions_checked,
        total_contradictions_found: allResults.filter(r => r.verdict !== 'CLEAN').length,
      });
    } catch (err: any) {
      return JSON.stringify({ error: `ContradictionTool check failed: ${err.message}` });
    }
  }

  // ─── Step 1: LLM claim extraction ────────────────────────────────────────

  private async extractClaims(text: string): Promise<ClaimExtractionResult> {
    const model = createModel(config.models.defaultProvider);
    const prompt = `You are a claim extraction engine. Analyze the following text and extract arguable position statements.

An "arguable claim" is:
- A position someone could disagree with
- Not a factual statement (e.g. "water boils at 100C")
- Not a question
- Not a personal feeling ("I feel sad")

Return ONLY valid JSON, no markdown, no explanation:
{
  "is_arguable": true,
  "claims": [
    {
      "claim": "the core arguable statement in one sentence",
      "topic": "2-3 word topic label",
      "claim_type": "normative|empirical|predictive|general",
      "confidence": 0.0-1.0
    }
  ]
}

If no arguable claims exist, return: {"is_arguable": false, "claims": []}

Text to analyze:
"""${text}"""`;

    try {
      const response = await model.generate([{ role: 'user', content: prompt }], {
        max_tokens: 800,
      });
      const raw = response.content.trim().replace(/```json|```/g, '').trim();
      return JSON.parse(raw) as ClaimExtractionResult;
    } catch {
      // Graceful fallback: treat the entire text as one general claim
      return {
        is_arguable: true,
        claims: [
          {
            claim: text.slice(0, 300),
            topic: 'general',
            claim_type: 'general',
            confidence: 0.5,
          },
        ],
      };
    }
  }

  // ─── Step 2: LLM contradiction scoring ───────────────────────────────────

  private async scoreContradiction(
    newClaim: string,
    storedClaim: string
  ): Promise<ContradictionScore> {
    const model = createModel(config.models.defaultProvider);
    const prompt = `You are a logical contradiction detector. Compare these two statements and determine if they contradict each other.

Statement A (new): "${newClaim}"
Statement B (stored): "${storedClaim}"

Scoring rules:
- semantic_similarity: How topically related are these? (0.0 = unrelated, 1.0 = identical topic)
- contradiction_score: Does A logically oppose or negate B? (0.0 = no conflict, 1.0 = direct negation)
- verdict: CONTRADICTION if score > 0.65, PARTIAL if 0.35-0.65, CLEAN if < 0.35

Return ONLY valid JSON, no markdown:
{
  "verdict": "CONTRADICTION|PARTIAL|CLEAN",
  "contradiction_score": 0.0-1.0,
  "semantic_similarity": 0.0-1.0,
  "explanation": "2 sentences explaining whether and why these contradict",
  "memory_quote": "exact phrase from Statement B that is contradicted, or null"
}`;

    try {
      const response = await model.generate([{ role: 'user', content: prompt }], {
        max_tokens: 500,
      });
      const raw = response.content.trim().replace(/```json|```/g, '').trim();
      return JSON.parse(raw) as ContradictionScore;
    } catch {
      return {
        verdict: 'CLEAN',
        contradiction_score: 0,
        semantic_similarity: 0,
        explanation: 'Could not score contradiction — model response parsing failed.',
        memory_quote: null,
      };
    }
  }

  // ─── Helper: persist a claim to position store ───────────────────────────

  private async persistClaim(
    claim: ExtractedClaim,
    rawText: string,
    userId: number,
    projectId: string
  ): Promise<void> {
    try {
      await positionStore.storePosition({
        user_id: userId,
        project_id: projectId,
        content: rawText,
        extracted_claim: claim.claim,
        topic_cluster: claim.topic,
        claim_type: claim.claim_type,
        confidence_expressed: claim.confidence,
        source_context: rawText.slice(0, 500),
      });
    } catch (err: any) {
      console.error('[ArgumentDNA] Failed to persist claim:', err.message);
    }
  }

  // ─── Store operation ──────────────────────────────────────────────────────

  private async storePositionFromText(
    text: string,
    userId: number,
    projectId: string
  ): Promise<string> {
    try {
      const extraction = await this.extractClaims(text);
      if (!extraction.is_arguable || extraction.claims.length === 0) {
        return JSON.stringify({ success: false, reason: 'No arguable claims found in text' });
      }
      const stored: Position[] = [];
      for (const claim of extraction.claims) {
        const pos = await positionStore.storePosition({
          user_id: userId,
          project_id: projectId,
          content: text,
          extracted_claim: claim.claim,
          topic_cluster: claim.topic,
          claim_type: claim.claim_type,
          confidence_expressed: claim.confidence,
          source_context: text.slice(0, 500),
        });
        stored.push(pos);
      }
      return JSON.stringify({
        success: true,
        stored_count: stored.length,
        positions: stored.map(p => ({ id: p.id, claim: p.extracted_claim, topic: p.topic_cluster })),
      });
    } catch (err: any) {
      return JSON.stringify({ error: `Store failed: ${err.message}` });
    }
  }

  // ─── List operation ───────────────────────────────────────────────────────

  private async listPositions(userId: number, projectId: string): Promise<string> {
    try {
      const positions = await positionStore.getUserPositions(userId, projectId);
      return JSON.stringify({
        total: positions.length,
        positions: positions.map(p => ({
          id: p.id,
          claim: p.extracted_claim,
          topic: p.topic_cluster,
          type: p.claim_type,
          contradiction_count: p.contradiction_count,
          created_at: p.created_at,
        })),
      });
    } catch (err: any) {
      return JSON.stringify({ error: `List failed: ${err.message}` });
    }
  }

  // ─── Delete operation ─────────────────────────────────────────────────────

  private async deletePosition(positionId: number, userId: number): Promise<string> {
    try {
      const deleted = await positionStore.deletePosition(positionId, userId);
      return JSON.stringify({ success: deleted, position_id: positionId });
    } catch (err: any) {
      return JSON.stringify({ error: `Delete failed: ${err.message}` });
    }
  }
}