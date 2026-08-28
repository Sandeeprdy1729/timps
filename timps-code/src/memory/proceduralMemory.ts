// ── TIMPS Procedural Memory Layer ──
// Auto-extracted workflows from successful agent executions

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getMemoryDir } from '../config/config.js';
import { generateId } from '../utils/utils.js';
import type { ProceduralTrace, ProceduralStep } from './types.js';

export class ProceduralMemory {
  private dir: string;
  private tracesFile: string;
  private traces: ProceduralTrace[] = [];

  constructor(projectPath: string) {
    this.dir = projectPath;
    this.tracesFile = path.join(this.dir, 'procedural.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.tracesFile)) {
        this.traces = JSON.parse(fs.readFileSync(this.tracesFile, 'utf-8'));
      }
    } catch { this.traces = []; }
  }

  private save(): void {
    fs.writeFileSync(this.tracesFile, JSON.stringify(this.traces, null, 2), 'utf-8');
  }

  // ── Trace Extraction ────────────────────────────────────────

  extractFromExecution(
    goal: string,
    taskType: string,
    toolSequence: { tool: string; args: Record<string, unknown>; result?: string }[],
    outcome: 'success' | 'partial' | 'failed',
    decisionBranches?: string[],
    successConditions?: string[]
  ): string | null {
    if (outcome === 'failed' || toolSequence.length < 2) return null;

    const trace: ProceduralTrace = {
      id: generateId('proc'),
      goal,
      taskType,
      steps: toolSequence.map((t, i) => ({
        stepIndex: i,
        tool: t.tool,
        args: t.args,
        decision: decisionBranches?.[i],
        result: t.result?.slice(0, 200),
      })),
      successConditions: successConditions || [],
      outcome,
      timestamp: Date.now(),
      confidence: outcome === 'success' ? 0.8 : 0.5,
      usageCount: 0,
    };

    const similar = this.findSimilar(goal, 0.75);
    if (similar && similar.usageCount > 3) {
      similar.usageCount += 1;
      similar.lastUsed = Date.now();
    } else {
      this.traces.push(trace);
      if (this.traces.length > 200) this.traces.shift();
    }

    this.save();
    return trace.id;
  }

  // ── Trace Retrieval ────────────────────────────────────────

  findSimilar(query: string, minSimilarity = 0.6): ProceduralTrace | null {
    const qTokens = query.toLowerCase().split(/\s+/);
    let best: ProceduralTrace | null = null;
    let bestScore = 0;

    for (const trace of this.traces) {
      const goalTokens = trace.goal.toLowerCase().split(/\s+/);
      const matchCount = qTokens.filter(qt => goalTokens.some(gt => gt.includes(qt) || qt.includes(gt))).length;
      const similarity = matchCount / Math.max(qTokens.length, 1);

      if (similarity >= minSimilarity && similarity > bestScore) {
        bestScore = similarity;
        best = trace;
      }
    }

    return best;
  }

  findByTaskType(taskType: string, limit = 5): ProceduralTrace[] {
    return this.traces
      .filter(t => t.taskType === taskType)
      .sort((a, b) => (b.confidence - a.confidence) || (b.usageCount - a.usageCount))
      .slice(0, limit);
  }

  retrieve(goal: string, limit = 3): ProceduralTrace[] {
    const results: { trace: ProceduralTrace; score: number }[] = [];

    for (const trace of this.traces) {
      const qTokens = goal.toLowerCase().split(/\s+/);
      const gTokens = trace.goal.toLowerCase().split(/\s+/);
      const match = qTokens.filter(qt => gTokens.some(gt => gt.includes(qt) || qt.includes(gt))).length;
      const similarity = match / Math.max(qTokens.length, 1);

      if (similarity >= 0.5) {
        const recency = trace.lastUsed
          ? 1 / (1 + (Date.now() - trace.lastUsed) / (1000 * 60 * 60 * 24 * 7))
          : 0.5;
        const score = (similarity * 0.5 + trace.confidence * 0.3 + recency * 0.2);
        results.push({ trace, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit).map(r => r.trace);
  }

  // ── Template Generation ───────────────────────────────────

  generatePlanTemplate(trace: ProceduralTrace): string {
    const steps = trace.steps.map((s, i) => {
      const args = Object.keys(s.args).join(', ');
      const decision = s.decision ? ` (Decision: ${s.decision})` : '';
      return `${i + 1}. Use ${s.tool}(${args})${decision}`;
    }).join('\n');

    return `## Plan Template: ${trace.goal}
**Type:** ${trace.taskType} | **Confidence:** ${Math.round(trace.confidence * 100)}%
**Usage:** ${trace.usageCount} times

### Steps:
${steps}

${trace.successConditions.length > 0 ? `### Success Conditions:\n${trace.successConditions.map(c => `- ${c}`).join('\n')}` : ''}
`;
  }

  // ── Utility ───────────────────────────────────────────────

  getStats(): { totalTraces: number; taskTypes: string[]; avgSteps: number } {
    const taskTypes = [...new Set(this.traces.map(t => t.taskType))];
    const avgSteps = this.traces.length > 0
      ? this.traces.reduce((s, t) => s + t.steps.length, 0) / this.traces.length
      : 0;
    return { totalTraces: this.traces.length, taskTypes, avgSteps: Math.round(avgSteps * 10) / 10 };
  }

  clear(): void {
    this.traces = [];
    this.save();
  }
}