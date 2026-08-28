// ── TIMPS Self-Reflection & Memory Audit ──
// Meta-memory: identify gaps, contradictions, and generate clarifying questions

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getMemoryDir } from '../config/config.js';
import type { MemoryEntry, SelfReflectionResult, ConflictEntry } from './types.js';

export class SelfReflector {
  private dir: string;
  private conflictsFile: string;

  constructor(projectPath: string) {
    this.dir = projectPath;
    this.conflictsFile = path.join(this.dir, 'conflicts.json');
  }

  private loadSemantic(): MemoryEntry[] {
    const semanticFile = path.join(this.dir, 'semantic.json');
    try {
      if (!fs.existsSync(semanticFile)) return [];
      return JSON.parse(fs.readFileSync(semanticFile, 'utf-8'));
    } catch { return []; }
  }

  private loadConflicts(): ConflictEntry[] {
    try {
      if (!fs.existsSync(this.conflictsFile)) return [];
      return JSON.parse(fs.readFileSync(this.conflictsFile, 'utf-8'));
    } catch { return []; }
  }

  private saveConflict(entry: ConflictEntry): void {
    const conflicts = this.loadConflicts();
    conflicts.push(entry);
    if (conflicts.length > 50) conflicts.shift();
    fs.writeFileSync(this.conflictsFile, JSON.stringify(conflicts, null, 2), 'utf-8');
  }

  // ── Contradiction Detection ────────────────────────────────

  detectContradictions(entries: MemoryEntry[]): ConflictEntry[] {
    const conflicts: ConflictEntry[] = [];
    const textMap = new Map<string, MemoryEntry[]>();

    for (const entry of entries) {
      const words = entry.content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (const word of words) {
        if (!textMap.has(word)) textMap.set(word, []);
        textMap.get(word)!.push(entry);
      }
    }

    for (const [word, related] of textMap) {
      if (related.length < 2) continue;

      for (let i = 0; i < related.length; i++) {
        for (let j = i + 1; j < related.length; j++) {
          const e1 = related[i], e2 = related[j];
          if (e1.type === e2.type && e1.id !== e2.id && this.areContradicting(e1.content, e2.content)) {
            conflicts.push({
              fact1: e1.content.slice(0, 100),
              fact2: e2.content.slice(0, 100),
              detectedAt: Date.now(),
              resolved: false,
            });
            this.saveConflict({ fact1: e1.content.slice(0, 100), fact2: e2.content.slice(0, 100), detectedAt: Date.now(), resolved: false });
          }
        }
      }
    }

    return conflicts;
  }

  private areContradicting(a: string, b: string): boolean {
    const negations = ['not', 'never', 'no', "don't", "doesn't", "isn't", "aren't", "wasn't", "weren't"];
    const aLower = a.toLowerCase(), bLower = b.toLowerCase();
    const aHasNeg = negations.some(n => aLower.includes(n));
    const bHasNeg = negations.some(n => bLower.includes(n));

    if (aHasNeg !== bHasNeg) {
      const aContent = aLower.replace(new RegExp(negations.join('|'), 'g'), '').trim();
      const bContent = bLower.replace(new RegExp(negations.join('|'), 'g'), '').trim();
      if (aContent.includes(bContent) || bContent.includes(aContent)) return true;
    }

    const bothNegative = negations.some(n => aLower.includes(n)) && negations.some(n => bLower.includes(n));
    if (bothNegative && aLower !== bLower) {
      const wordsA = aLower.split(/\s+/).filter(w => !negations.includes(w));
      const wordsB = bLower.split(/\s+/).filter(w => !negations.includes(w));
      const overlap = wordsA.filter(w => wordsB.includes(w)).length;
      if (overlap > 3) return true;
    }

    return false;
  }

  // ── Gap Identification ────────────────────────────────────

  identifyGaps(recentErrors: string[], entries: MemoryEntry[]): string[] {
    const gaps: string[] = [];
    const memoryTopics = new Set(entries.map(e => e.content.toLowerCase()).join(' ').split(/\s+/).filter(w => w.length > 4));

    for (const error of recentErrors) {
      const errorTokens = error.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const hasRelevant = errorTokens.some(et => memoryTopics.has(et));
      if (!hasRelevant) {
        gaps.push(`No memory about: ${errorTokens.slice(0, 3).join(' ')}`);
      }
    }

    return gaps.slice(0, 5);
  }

  // ── Low Confidence Flagging ───────────────────────────────

  flagLowConfidence(entries: MemoryEntry[]): string[] {
    return entries
      .filter(e => (e.confidence || 0.5) < 0.5 || (e.importance || 5) < 3)
      .map(e => `Low confidence in: ${e.content.slice(0, 80)}`)
      .slice(0, 5);
  }

  // ── Generate Clarifying Questions ─────────────────────────

  generateQuestions(conflicts: ConflictEntry[], gaps: string[]): string[] {
    const questions: string[] = [];

    if (conflicts.length > 0) {
      const c = conflicts.find(c => !c.resolved);
      if (c) {
        questions.push(`Is it "${c.fact1}" or "${c.fact2}"?`);
      }
    }

    for (const gap of gaps) {
      const topic = gap.replace('No memory about: ', '').trim();
      questions.push(`What's the correct approach for: ${topic}?`);
    }

    return questions.slice(0, 3);
  }

  // ── Full Audit ────────────────────────────────────────────

  audit(
    recentErrors: string[] = [],
    userCorrections: string[] = []
  ): SelfReflectionResult {
    const entries = this.loadSemantic();
    const conflicts = this.detectContradictions(entries);
    const gaps = this.identifyGaps(recentErrors, entries);
    const lowConfFlags = this.flagLowConfidence(entries);

    for (const correction of userCorrections) {
      const entry: Partial<MemoryEntry> = {
        content: `User correction: ${correction}`,
        type: 'fact',
        timestamp: Date.now(),
        source: 'user_explicit',
        importance: 8,
        confidence: 1,
      };
      void entry;
    }

    const questions = this.generateQuestions(conflicts.filter(c => !c.resolved), gaps);

    return {
      gaps,
      contradictions: conflicts.filter(c => !c.resolved).map(c => ({ id: '', timestamp: c.detectedAt, type: 'fact', content: `Conflict: ${c.fact1} vs ${c.fact2}`, tags: [] })),
      lowConfidenceFlags: lowConfFlags,
      questions,
      newMemories: [],
    };
  }

  // ── Session End Audit ────────────────────────────────────

  sessionEndAudit(
    sessionSummary: string,
    errors: string[],
    corrections: string[]
  ): { auditResult: SelfReflectionResult; newFacts: string[] } {
    const result = this.audit(errors, corrections);
    const newFacts: string[] = [];

    if (result.gaps.length > 0) {
      newFacts.push(`Identified gap during session: ${result.gaps[0]}`);
    }

    return { auditResult: result, newFacts };
  }

  getStats(): { totalConflicts: number; unresolvedCount: number } {
    const conflicts = this.loadConflicts();
    return {
      totalConflicts: conflicts.length,
      unresolvedCount: conflicts.filter(c => !c.resolved).length,
    };
  }
}