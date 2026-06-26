import type { MemoryEntry } from '../types.js';

// ── Tool 5 port: Argument DNA Mapper → Contradiction Detector ──
// Ported from packages/server/tools/contradictionTool.ts + positionStore.ts
// Storage: JSON file instead of Postgres + Qdrant
// Analysis: deterministic Jaccard similarity instead of LLM
//
// HSW integration (Layer 9):
//   Accepts an optional HarmonicSheafWeaver instance. When provided:
//   • store() weaves claims into the sheaf (domain='contradiction')
//   • check() augments results with algebraic H¹ cohomology from the sheaf

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageBackend } from '../backends/types.js';
import type { HarmonicSheafWeaver, CohomologyResult } from '../HarmonicSheafWeaver.js';
import { LSHIndex } from '../computation/LSHIndex.js';

export interface Position {
  id: string;
  content: string;
  extracted_claim: string;
  topic_cluster: string;
  claim_type: 'normative' | 'empirical' | 'predictive' | 'general';
  confidence_expressed: number;
  source_context: string;
  contradiction_count: number;
  created_at: string;
}

export interface ContradictionRecord {
  position_id: string;
  contradicted_by_text: string;
  contradiction_score: number;
  semantic_similarity: number;
  explanation: string;
  acknowledged: boolean;
  resolved: boolean;
  created_at: string;
}

export interface ContradictionResult {
  verdict: 'CONTRADICTION' | 'PARTIAL' | 'CLEAN';
  contradiction_score: number;
  semantic_similarity: number;
  matched_position?: Position;
  explanation: string;
  extracted_claims: string[];
  positions_checked: number;
  /** Algebraic H¹ cohomology result from HarmonicSheafWeaver (if wired) */
  sheafCohomology?: CohomologyResult;
}

// ── Heuristic claim extraction ──
function extractClaims(text: string): string[] {
  // Split into sentences, take non-trivial ones
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.split(/\s+/).length >= 3)
    .slice(0, 5);
}

// ── Jaccard similarity on normalized word sets ──
function jaccard(a: string, b: string): number {
  const normalize = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const sa = normalize(a);
  const sb = normalize(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

// ── Negation flip detection ──
const NEGATORS = /\b(not|never|don't|doesn't|shouldn't|avoid|stop|remove|disable|reject|bad|wrong|false)\b/i;
const AFFIRMERS = /\b(should|must|always|use|enable|add|good|best|true|correct|do|allow|prefer)\b/i;

function sentimentFlip(a: string, b: string): boolean {
  const aNeg = NEGATORS.test(a);
  const bNeg = NEGATORS.test(b);
  const aAff = AFFIRMERS.test(a);
  const bAff = AFFIRMERS.test(b);
  return (aNeg && bAff) || (aAff && bNeg) || (aNeg && !bNeg && jaccard(a, b) > 0.25);
}

export class ContradictionDetector {
  private file: string;
  private positions: Position[] = [];
  private contradictions: ContradictionRecord[] = [];
  private _backend?: StorageBackend;
  /** Optional HarmonicSheafWeaver for algebraic contradiction detection */
  private sheaf?: HarmonicSheafWeaver;
  /** Phase 4b: LSH index for O(1) candidate lookup instead of O(n) scan */
  private _lsh: LSHIndex;

  constructor(dir: string, backend?: StorageBackend, sheaf?: HarmonicSheafWeaver) {
    this._backend = backend;
    this.file = path.join(dir, 'contradiction_positions.json');
    this.sheaf = sheaf;
    this._lsh = new LSHIndex();
    this.load();
    // Rebuild LSH from existing positions
    for (const pos of this.positions) {
      this._lsh.insert(pos.id, pos.extracted_claim);
    }
  }

  private load(): void {
    try {
      if (this._backend) {
        const data = this._backend.read(path.basename(this.file));
        if (data) {
          this.positions = data.positions || [];
          this.contradictions = data.contradictions || [];
        }
      } else if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.positions = data.positions || [];
        this.contradictions = data.contradictions || [];
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    const data = { positions: this.positions, contradictions: this.contradictions };
    if (this._backend) {
      this._backend.write(path.basename(this.file), data);
    } else {
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  /** check: analyze text for contradictions against stored positions */
  check(text: string, autoStore = true): ContradictionResult {
    const claims = extractClaims(text);
    let best: Position | undefined;
    let bestScore = 0;
    let bestSimilarity = 0;
    let positionsChecked = 0;
    const seenIds = new Set<string>();

    for (const claim of claims) {
      // Phase 4b: use LSH to find candidate positions instead of scanning all
      const candidateIds = this._lsh.query(claim, 16);
      const candidates: Position[] = [];
      for (const id of candidateIds) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        const pos = this.positions.find(p => p.id === id);
        if (pos) candidates.push(pos);
      }

      for (const pos of candidates) {
        seenIds.add(pos.id);
        positionsChecked++;
        const sim = jaccard(claim, pos.extracted_claim);
        if (sim < 0.15) continue;
        const flip = sentimentFlip(claim, pos.extracted_claim);
        const score = sim * (flip ? 1.4 : 0.6);
        if (score > bestScore) {
          bestScore = score;
          bestSimilarity = sim;
          best = pos;
        }
      }
    }

    // Fallback: if LSH produced no candidates, scan all positions (cold start)
    if (positionsChecked === 0 && this.positions.length > 0) {
      for (const claim of claims) {
        for (const pos of this.positions) {
          positionsChecked++;
          const sim = jaccard(claim, pos.extracted_claim);
          if (sim < 0.15) continue;
          const flip = sentimentFlip(claim, pos.extracted_claim);
          const score = sim * (flip ? 1.4 : 0.6);
          if (score > bestScore) {
            bestScore = score;
            bestSimilarity = sim;
            best = pos;
          }
        }
      }
    }

    if (autoStore) {
      for (const claim of claims) {
        this.store(text, claim);
      }
    }

    // Augment with algebraic H¹ cohomology from HarmonicSheafWeaver if wired
    let sheafCohomology: CohomologyResult | undefined;
    if (this.sheaf) {
      try {
        sheafCohomology = this.sheaf.detectContradictions({ domain: 'contradiction' });
      } catch { /* non-blocking */ }
    }

    if (best && bestScore > 0.35) {
      best.contradiction_count++;
      this.save();
      return {
        verdict: bestScore > 0.7 ? 'CONTRADICTION' : 'PARTIAL',
        contradiction_score: Math.min(bestScore, 1),
        semantic_similarity: bestSimilarity,
        matched_position: best,
        explanation: `Matches stored position: "${best.extracted_claim.slice(0, 100)}"`,
        extracted_claims: claims,
        positions_checked: positionsChecked || this.positions.length,
        sheafCohomology,
      };
    }

    return {
      verdict: 'CLEAN',
      contradiction_score: 0,
      semantic_similarity: 0,
      explanation: 'No contradictions detected.',
      extracted_claims: claims,
      positions_checked: positionsChecked || this.positions.length,
      sheafCohomology,
    };
  }

  /**
   * Synchronous pre-store conflict check against a list of semantic entries.
   * Used by Phase 2d conflict detection at write time.
   */
  checkBeforeStore(
    newEntry: MemoryEntry,
    existingEntries: MemoryEntry[],
  ): { hasConflict: boolean; conflictingEntry?: MemoryEntry; similarity: number; explanation: string } {
    let best: MemoryEntry | undefined;
    let bestScore = 0;

    for (const existing of existingEntries) {
      const sim = jaccard(newEntry.content, existing.content);
      if (sim < 0.15) continue;
      const flip = sentimentFlip(newEntry.content, existing.content);
      const score = sim * (flip ? 1.4 : 0.6);
      if (score > bestScore) {
        bestScore = score;
        best = existing;
      }
    }

    if (best && bestScore > 0.35) {
      return {
        hasConflict: true,
        conflictingEntry: best,
        similarity: Math.min(bestScore, 1),
        explanation: `Conflicts with existing entry: "${best.content.slice(0, 100)}"`,
      };
    }

    return { hasConflict: false, similarity: 0, explanation: 'No conflict detected' };
  }

  /** store: manually save a position/claim */
  store(content: string, claim?: string): Position {
    const extracted_claim = claim || extractClaims(content)[0] || content.slice(0, 200);
    // Dedup
    const dup = this.positions.find(p => jaccard(p.extracted_claim, extracted_claim) > 0.85);
    if (dup) return dup;

    const pos: Position = {
      id: `pos_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      content: content.slice(0, 500),
      extracted_claim,
      topic_cluster: extracted_claim.split(/\s+/).slice(0, 3).join('_'),
      claim_type: 'general',
      confidence_expressed: 0.7,
      source_context: '',
      contradiction_count: 0,
      created_at: new Date().toISOString(),
    };
    this.positions.push(pos);
    this._lsh.insert(pos.id, extracted_claim);
    if (this.positions.length > 200) {
      const removed = this.positions.shift()!;
      this._lsh.delete(removed.id);
    }
    this.save();

    // Weave claim into HarmonicSheafWeaver for algebraic tracking
    if (this.sheaf) {
      try {
        this.sheaf.weave(extracted_claim, { domain: 'contradiction', tags: [pos.topic_cluster] });
      } catch { /* fire-and-forget */ }
    }

    return pos;
  }

  /** list: all stored positions */
  list(projectId?: string): Position[] {
    return [...this.positions];
  }

  /** delete: remove a position by id */
  delete(id: string): boolean {
    const before = this.positions.length;
    this.positions = this.positions.filter(p => p.id !== id);
    if (this.positions.length < before) { this.save(); return true; }
    return false;
  }
}
