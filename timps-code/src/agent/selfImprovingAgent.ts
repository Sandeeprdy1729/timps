// ── TIMPS Self-Improving Agent — Learn from mistakes autonomously ──
// Implements the "feedback loop agents" concept from the research:
// Detects failure patterns, builds a mistake taxonomy, and pre-emptively
// avoids known failure modes in future tasks.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export type MistakeCategory =
  | 'wrong-file-assumption'    // Assumed file content without reading
  | 'insufficient-context'     // Acted with too little context
  | 'incorrect-tool-sequence'  // Used tools in wrong order
  | 'missed-dependency'        // Forgot to update dependent files
  | 'test-regression'          // Broke existing tests
  | 'type-error'               // TypeScript/type issues
  | 'logic-error'              // Wrong algorithmic logic
  | 'permission-violation'     // Tried to access protected resource
  | 'infinite-loop'            // Got stuck in correction cycles
  | 'over-engineering'         // Solution too complex
  | 'under-specification'      // Asked to clarify too much
  | 'tool-misuse'              // Used wrong tool for the job
  | 'other';

export interface MistakeRecord {
  id: string;
  timestamp: number;
  category: MistakeCategory;
  taskType: string;
  description: string;
  context: string;            // What the agent was doing
  errorMessage: string;       // Actual error
  correction: string;         // What fixed it
  preventionHint: string;     // How to avoid next time
  occurrences: number;
  lastSeen: number;
  filePatterns: string[];     // File types/patterns involved
  toolSequence: string[];     // Tools that were misused
}

export interface LearningReport {
  totalMistakes: number;
  topCategories: Array<{ category: MistakeCategory; count: number }>;
  recentMistakes: MistakeRecord[];
  preventionInstructions: string[];
  improvementScore: number;   // 0-100, tracks improvement over time
}

export interface PreflightCheck {
  passed: boolean;
  warnings: string[];
  blockers: string[];
  suggestedActions: string[];
}

const LEARNING_DIR = path.join(os.homedir(), '.timps', 'learning');

export class SelfImprovingAgent {
  private projectHash: string;
  private mistakesPath: string;
  private mistakes = new Map<string, MistakeRecord>();
  private sessionMistakes: MistakeRecord[] = [];

  constructor(projectHash: string) {
    this.projectHash = projectHash;
    this.mistakesPath = path.join(LEARNING_DIR, projectHash, 'mistakes.jsonl');
    fs.mkdirSync(path.dirname(this.mistakesPath), { recursive: true });
    this.loadMistakes();
  }

  // ── Mistake recording ──────────────────────────────────────────────────────

  /**
   * Record a mistake the agent made. Call when a tool fails or correction is needed.
   */
  recordMistake(options: {
    category: MistakeCategory;
    taskType: string;
    description: string;
    context: string;
    errorMessage: string;
    correction?: string;
    toolSequence?: string[];
    filePatterns?: string[];
  }): string {
    const existing = this.findSimilarMistake(options.description, options.category);

    if (existing) {
      // Increment occurrence count for known mistake
      existing.occurrences++;
      existing.lastSeen = Date.now();
      if (options.correction) existing.correction = options.correction;
      this.persistMistake(existing);
      return existing.id;
    }

    const mistakeId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const preventionHint = this.generatePreventionHint(options.category, options.description);

    const record: MistakeRecord = {
      id: mistakeId,
      timestamp: Date.now(),
      category: options.category,
      taskType: options.taskType,
      description: options.description,
      context: options.context.slice(0, 500),
      errorMessage: options.errorMessage.slice(0, 300),
      correction: options.correction ?? '',
      preventionHint,
      occurrences: 1,
      lastSeen: Date.now(),
      filePatterns: options.filePatterns ?? [],
      toolSequence: options.toolSequence ?? [],
    };

    this.mistakes.set(mistakeId, record);
    this.sessionMistakes.push(record);
    this.persistMistake(record);
    return mistakeId;
  }

  /**
   * Record the correction that fixed a mistake.
   */
  recordCorrection(mistakeId: string, correction: string): void {
    const mistake = this.mistakes.get(mistakeId);
    if (mistake) {
      mistake.correction = correction;
      this.persistMistake(mistake);
    }
  }

  // ── Pre-flight checks ──────────────────────────────────────────────────────

  /**
   * Run pre-flight checks before executing a task.
   * Returns warnings based on patterns of past mistakes.
   */
  preflightCheck(taskDescription: string, taskType: string, toolPlan: string[]): PreflightCheck {
    const warnings: string[] = [];
    const blockers: string[] = [];
    const suggestedActions: string[] = [];

    const taskLower = taskDescription.toLowerCase();

    // Check for patterns that previously caused mistakes
    for (const mistake of this.mistakes.values()) {
      if (mistake.occurrences < 2) continue; // Only learn from repeated mistakes

      // Task type match
      if (mistake.taskType === taskType) {
        const hintTokens = mistake.preventionHint.toLowerCase().split(/\s+/);
        const matchCount = hintTokens.filter(t => taskLower.includes(t) && t.length > 3).length;

        if (matchCount >= 2) {
          if (mistake.occurrences >= 3) {
            warnings.push(`⚠️ Pattern match: "${mistake.description}" occurred ${mistake.occurrences}x. ${mistake.preventionHint}`);
          }
        }
      }

      // Tool sequence match
      if (mistake.toolSequence.length > 0 && toolPlan.length > 0) {
        const toolOverlap = mistake.toolSequence.filter(t => toolPlan.includes(t));
        if (toolOverlap.length >= 2 && mistake.category === 'incorrect-tool-sequence') {
          warnings.push(`⚠️ Risky tool sequence: ${toolOverlap.join(' → ')} previously caused issues`);
          suggestedActions.push(mistake.correction || 'Verify tool execution order');
        }
      }
    }

    // Category-specific pre-flight checks
    this.addCategoryChecks(taskDescription, taskType, warnings, suggestedActions);

    return {
      passed: blockers.length === 0,
      warnings,
      blockers,
      suggestedActions,
    };
  }

  private addCategoryChecks(
    task: string,
    taskType: string,
    warnings: string[],
    suggestions: string[]
  ): void {
    const taskLower = task.toLowerCase();

    // Check for common mistake patterns
    const editWithoutRead = this.getMistakeCountByCategory('wrong-file-assumption');
    if (editWithoutRead >= 3 && (taskLower.includes('edit') || taskLower.includes('change'))) {
      suggestions.push('Read files before editing — this mistake has occurred frequently');
    }

    const dependencyMisses = this.getMistakeCountByCategory('missed-dependency');
    if (dependencyMisses >= 2 && taskType === 'refactor') {
      suggestions.push('Check all imports/exports after refactoring — dependency misses are common');
    }

    const testRegressions = this.getMistakeCountByCategory('test-regression');
    if (testRegressions >= 2) {
      suggestions.push('Run tests before and after changes to catch regressions');
    }

    const typeErrors = this.getMistakeCountByCategory('type-error');
    if (typeErrors >= 3) {
      suggestions.push('Run `npx tsc --noEmit` after TypeScript changes');
    }
  }

  // ── Learning report ────────────────────────────────────────────────────────

  /**
   * Generate a learning report for the agent's system prompt injection.
   */
  buildLearningReport(): LearningReport {
    const categoryCounts = new Map<MistakeCategory, number>();
    for (const mistake of this.mistakes.values()) {
      categoryCounts.set(mistake.category, (categoryCounts.get(mistake.category) ?? 0) + mistake.occurrences);
    }

    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    const recentMistakes = Array.from(this.mistakes.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 5);

    const preventionInstructions = this.buildPreventionInstructions();

    const totalOccurrences = Array.from(this.mistakes.values())
      .reduce((sum, m) => sum + m.occurrences, 0);

    // Simple improvement score: if mistakes are decreasing, score is higher
    const sessionCount = this.sessionMistakes.length;
    const avgHistorical = totalOccurrences / Math.max(1, this.mistakes.size);
    const improvementScore = Math.max(0, Math.min(100,
      100 - (sessionCount / Math.max(1, avgHistorical)) * 20
    ));

    return {
      totalMistakes: this.mistakes.size,
      topCategories,
      recentMistakes,
      preventionInstructions,
      improvementScore: Math.round(improvementScore),
    };
  }

  /**
   * Build prevention instructions for injection into system prompt.
   */
  buildPreventionInstructions(): string[] {
    const instructions: string[] = [];
    const categoryCounts = new Map<MistakeCategory, MistakeRecord[]>();

    for (const mistake of this.mistakes.values()) {
      if (!categoryCounts.has(mistake.category)) categoryCounts.set(mistake.category, []);
      categoryCounts.get(mistake.category)!.push(mistake);
    }

    for (const [category, records] of categoryCounts) {
      if (records.length < 2) continue; // Only include well-evidenced patterns

      const totalOccurrences = records.reduce((s, r) => s + r.occurrences, 0);
      if (totalOccurrences < 2) continue;

      const hint = this.generateCategoryLevelHint(category, records);
      if (hint) instructions.push(hint);
    }

    return instructions.slice(0, 8); // Keep concise
  }

  /**
   * Format prevention instructions for system prompt.
   */
  formatForSystemPrompt(): string {
    const instructions = this.buildPreventionInstructions();
    if (instructions.length === 0) return '';

    return [
      '## Learned Behaviors (from past mistakes)',
      ...instructions.map(i => `- ${i}`),
    ].join('\n');
  }

  // ── Session summary ────────────────────────────────────────────────────────

  /**
   * Get a summary of mistakes from this session.
   */
  getSessionSummary(): string {
    if (this.sessionMistakes.length === 0) return '';

    const categorized = new Map<MistakeCategory, number>();
    for (const m of this.sessionMistakes) {
      categorized.set(m.category, (categorized.get(m.category) ?? 0) + 1);
    }

    const lines = [`This session: ${this.sessionMistakes.length} corrections made`];
    for (const [cat, count] of categorized) {
      lines.push(`  - ${cat}: ${count}x`);
    }

    return lines.join('\n');
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private findSimilarMistake(description: string, category: MistakeCategory): MistakeRecord | null {
    const descLower = description.toLowerCase().slice(0, 50);

    for (const mistake of this.mistakes.values()) {
      if (mistake.category !== category) continue;
      if (mistake.description.toLowerCase().slice(0, 50).includes(descLower.slice(0, 20))) {
        return mistake;
      }
    }
    return null;
  }

  private getMistakeCountByCategory(category: MistakeCategory): number {
    let count = 0;
    for (const m of this.mistakes.values()) {
      if (m.category === category) count += m.occurrences;
    }
    return count;
  }

  private generatePreventionHint(category: MistakeCategory, description: string): string {
    const hints: Record<MistakeCategory, string> = {
      'wrong-file-assumption': 'Always read the file before editing it — never assume its content',
      'insufficient-context': 'Gather more context before acting — read related files first',
      'incorrect-tool-sequence': 'Verify the correct tool order: read → understand → plan → edit → verify',
      'missed-dependency': 'After changing an export/interface, grep for all importers and update them',
      'test-regression': 'Run existing tests before and after changes to catch regressions',
      'type-error': 'Run tsc --noEmit after TypeScript changes; check interface compatibility',
      'logic-error': 'Use the think tool to reason through the algorithm before implementing',
      'permission-violation': 'Check file permissions and protected paths before writing',
      'infinite-loop': 'If retrying more than 3 times, step back and rethink the approach',
      'over-engineering': 'Prefer simple solutions; avoid abstractions for single use-cases',
      'under-specification': 'Clarify ambiguities upfront before starting implementation',
      'tool-misuse': 'Use edit_file for surgical edits, write_file only for new files',
      'other': 'Review the error carefully and think about root cause before retrying',
    };
    return hints[category];
  }

  private generateCategoryLevelHint(category: MistakeCategory, records: MistakeRecord[]): string {
    const count = records.reduce((s, r) => s + r.occurrences, 0);
    const base = this.generatePreventionHint(category, '');
    return `[${count}x mistake] ${base}`;
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private persistMistake(mistake: MistakeRecord): void {
    try {
      // Use a simple JSON file per mistake to avoid appending issues
      const mistakePath = path.join(
        path.dirname(this.mistakesPath),
        `${mistake.id}.json`
      );
      fs.writeFileSync(mistakePath, JSON.stringify(mistake));
    } catch { /* ignore */ }
  }

  private loadMistakes(): void {
    try {
      const dir = path.dirname(this.mistakesPath);
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir).filter(f => f.startsWith('m_') && f.endsWith('.json'));
      for (const file of files) {
        try {
          const record = JSON.parse(
            fs.readFileSync(path.join(dir, file), 'utf-8')
          ) as MistakeRecord;
          this.mistakes.set(record.id, record);
        } catch { /* skip corrupt */ }
      }
    } catch { /* no mistakes yet */ }
  }
}
