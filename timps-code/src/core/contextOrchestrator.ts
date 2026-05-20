// ── TIMPS Context Orchestrator — Task-aware selective context loading ──
// Solves Context Window limitation: instead of compressing ALL context,
// intelligently selects WHICH context is relevant to the current task.
// Prevents context window degradation during long sessions.

import type { Message } from '../config/types.js';

export type TaskType =
  | 'bug-fix'
  | 'feature'
  | 'refactor'
  | 'test-writing'
  | 'documentation'
  | 'architecture'
  | 'security-audit'
  | 'performance'
  | 'exploration'
  | 'deployment'
  | 'general';

export interface ContextSlot {
  id: string;
  type: 'memory' | 'file' | 'conversation' | 'system' | 'tool-result';
  content: string;
  tokens: number;
  relevanceScore: number;   // 0-1, computed per task
  importance: number;       // 0-1, inherent importance
  recency: number;          // 0-1, how recent
  tags: string[];
}

export interface ContextBudget {
  total: number;
  system: number;           // Reserved for system prompt
  memory: number;           // For memory injection
  conversation: number;     // For message history
  files: number;            // For file contents
  toolResults: number;      // For tool outputs
}

export interface OrchestrationResult {
  selectedSlots: ContextSlot[];
  totalTokens: number;
  droppedSlots: number;
  compressionRatio: number;  // Original / Selected
  taskType: TaskType;
  strategy: string;
}

// Token budgets per task type (as fraction of total budget)
const TASK_BUDGETS: Record<TaskType, Partial<ContextBudget>> = {
  'bug-fix':       { memory: 0.15, conversation: 0.45, files: 0.30, toolResults: 0.10 },
  'feature':       { memory: 0.20, conversation: 0.35, files: 0.35, toolResults: 0.10 },
  'refactor':      { memory: 0.25, conversation: 0.25, files: 0.40, toolResults: 0.10 },
  'test-writing':  { memory: 0.10, conversation: 0.30, files: 0.50, toolResults: 0.10 },
  'documentation': { memory: 0.20, conversation: 0.40, files: 0.30, toolResults: 0.10 },
  'architecture':  { memory: 0.35, conversation: 0.40, files: 0.15, toolResults: 0.10 },
  'security-audit':{ memory: 0.15, conversation: 0.25, files: 0.45, toolResults: 0.15 },
  'performance':   { memory: 0.15, conversation: 0.25, files: 0.45, toolResults: 0.15 },
  'exploration':   { memory: 0.20, conversation: 0.30, files: 0.40, toolResults: 0.10 },
  'deployment':    { memory: 0.10, conversation: 0.35, files: 0.45, toolResults: 0.10 },
  'general':       { memory: 0.20, conversation: 0.40, files: 0.30, toolResults: 0.10 },
};

// Keywords that signal each task type
const TASK_TYPE_SIGNALS: Record<TaskType, string[]> = {
  'bug-fix':        ['fix', 'bug', 'error', 'crash', 'broken', 'failing', 'debug', 'exception', 'issue'],
  'feature':        ['add', 'implement', 'create', 'build', 'new feature', 'support', 'extend'],
  'refactor':       ['refactor', 'clean', 'simplify', 'reorganize', 'restructure', 'extract', 'improve'],
  'test-writing':   ['test', 'spec', 'coverage', 'unit test', 'integration test', 'e2e'],
  'documentation':  ['document', 'doc', 'readme', 'comment', 'jsdoc', 'explain', 'describe'],
  'architecture':   ['architect', 'design', 'structure', 'pattern', 'system', 'scalab', 'overview'],
  'security-audit': ['security', 'vulnerability', 'audit', 'exploit', 'injection', 'xss', 'csrf', 'auth'],
  'performance':    ['performance', 'slow', 'optimize', 'speed', 'latency', 'memory leak', 'profil'],
  'exploration':    ['understand', 'explore', 'how does', 'what is', 'show me', 'explain'],
  'deployment':     ['deploy', 'docker', 'kubernetes', 'ci/cd', 'pipeline', 'production', 'release'],
  'general':        [],
};

export class ContextOrchestrator {
  private maxTokens: number;
  private systemReserved: number;

  constructor(maxTokens = 100000) {
    this.maxTokens = maxTokens;
    this.systemReserved = Math.floor(maxTokens * 0.15); // 15% for system prompt
  }

  // ── Task classification ────────────────────────────────────────────────────

  /**
   * Detect the type of task from the user's message.
   */
  detectTaskType(userMessage: string): TaskType {
    const msg = userMessage.toLowerCase();
    const scores = new Map<TaskType, number>();

    for (const [type, signals] of Object.entries(TASK_TYPE_SIGNALS)) {
      const score = signals.filter(s => msg.includes(s)).length;
      if (score > 0) scores.set(type as TaskType, score);
    }

    if (scores.size === 0) return 'general';

    const best = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])[0];
    return best[0];
  }

  // ── Context selection ──────────────────────────────────────────────────────

  /**
   * Select the most relevant messages to keep in context.
   * Call when approaching the context limit.
   */
  selectMessages(
    messages: Message[],
    currentTask: string,
    tokenEstimator: (text: string) => number
  ): { messages: Message[]; dropped: number } {
    const taskType = this.detectTaskType(currentTask);
    const budget = this.computeBudget(taskType);

    // Always keep system message
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');

    // Score each message
    const scored = nonSystem.map((msg, idx) => ({
      msg,
      idx,
      score: this.scoreMessage(msg, idx, nonSystem.length, currentTask, taskType),
      tokens: tokenEstimator(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)),
    }));

    // Greedy selection within budget
    const availableForConversation = budget.conversation;
    const selected: Message[] = [];
    let usedTokens = 0;

    // Always keep last 5 messages (recent context is critical)
    const recentMessages = scored.slice(-5);
    const olderMessages = scored.slice(0, -5);

    // Add recent messages first
    for (const item of recentMessages) {
      selected.push(item.msg);
      usedTokens += item.tokens;
    }

    // Fill remaining budget with highest-scored older messages
    const sortedOlder = [...olderMessages].sort((a, b) => b.score - a.score);
    for (const item of sortedOlder) {
      if (usedTokens + item.tokens > availableForConversation) break;
      selected.push(item.msg);
      usedTokens += item.tokens;
    }

    // Re-sort by original index to maintain conversation order
    const selectedSet = new Set(selected);
    const orderedSelected = nonSystem.filter(m => selectedSet.has(m));

    const result: Message[] = systemMsg ? [systemMsg, ...orderedSelected] : orderedSelected;
    const dropped = messages.length - result.length;

    return { messages: result, dropped };
  }

  /**
   * Prioritize memory entries for injection.
   * Returns entries ranked by relevance to current task.
   */
  rankMemoryForTask(
    memories: Array<{ content: string; type: string; importance: number; tags: string[] }>,
    currentTask: string,
    taskType: TaskType,
    tokenBudget: number,
    tokenEstimator: (text: string) => number
  ): string[] {
    const scored = memories.map(m => ({
      ...m,
      score: this.scoreMemoryEntry(m, currentTask, taskType),
    }));

    scored.sort((a, b) => b.score - a.score);

    const selected: string[] = [];
    let usedTokens = 0;

    for (const entry of scored) {
      const tokens = tokenEstimator(entry.content);
      if (usedTokens + tokens > tokenBudget) break;
      selected.push(entry.content);
      usedTokens += tokens;
    }

    return selected;
  }

  // ── Scoring functions ──────────────────────────────────────────────────────

  private scoreMessage(
    msg: Message,
    idx: number,
    total: number,
    currentTask: string,
    taskType: TaskType
  ): number {
    let score = 0;

    // Recency: recent messages are more important
    score += (idx / total) * 40;

    // Tool results are more valuable than conversational text
    if (msg.role === 'tool') score += 20;
    if (msg.toolCalls && msg.toolCalls.length > 0) score += 15;

    // Content relevance to current task
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const taskWords = currentTask.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const contentLower = content.toLowerCase();
    const wordMatches = taskWords.filter(w => contentLower.includes(w)).length;
    score += wordMatches * 10;

    // Task-type specific boosts
    if (taskType === 'bug-fix' && contentLower.includes('error')) score += 15;
    if (taskType === 'bug-fix' && msg.role === 'tool') score += 10;
    if (taskType === 'architecture' && contentLower.includes('design')) score += 15;

    return score;
  }

  private scoreMemoryEntry(
    entry: { content: string; type: string; importance: number; tags: string[] },
    currentTask: string,
    taskType: TaskType
  ): number {
    let score = entry.importance * 30;

    // Type matching
    if (taskType === 'architecture' && entry.type === 'insight') score += 20;
    if (taskType === 'bug-fix' && entry.type === 'pattern') score += 20;
    if (taskType === 'feature' && entry.type === 'pattern') score += 15;

    // Keyword matching
    const taskWords = currentTask.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const contentLower = entry.content.toLowerCase();
    score += taskWords.filter(w => contentLower.includes(w)).length * 15;

    // Tag matching
    const taskTypeTag = taskType.replace('-', '_');
    if (entry.tags.includes(taskTypeTag) || entry.tags.includes(taskType)) score += 25;

    return score;
  }

  // ── Budget computation ─────────────────────────────────────────────────────

  private computeBudget(taskType: TaskType): ContextBudget {
    const available = this.maxTokens - this.systemReserved;
    const fractions = TASK_BUDGETS[taskType];

    return {
      total: this.maxTokens,
      system: this.systemReserved,
      memory: Math.floor(available * (fractions.memory ?? 0.20)),
      conversation: Math.floor(available * (fractions.conversation ?? 0.40)),
      files: Math.floor(available * (fractions.files ?? 0.30)),
      toolResults: Math.floor(available * (fractions.toolResults ?? 0.10)),
    };
  }

  /**
   * Build a context injection string optimized for the current task.
   * Handles memory, session bridge, and code graph summaries.
   */
  buildInjection(options: {
    taskType: TaskType;
    sessionContext?: string;
    memoryContext?: string;
    codeGraphSummary?: string;
    impactSummary?: string;
    availableTokens: number;
  }): string {
    const parts: string[] = [];
    let remaining = options.availableTokens;

    // Architecture tasks: lead with code graph and session decisions
    if (options.taskType === 'architecture') {
      if (options.codeGraphSummary) {
        parts.push(options.codeGraphSummary);
        remaining -= options.codeGraphSummary.length / 4;
      }
      if (options.impactSummary) {
        parts.push(options.impactSummary);
        remaining -= options.impactSummary.length / 4;
      }
      if (options.sessionContext && remaining > 500) {
        parts.push(options.sessionContext);
      }
    }
    // Bug-fix: lead with recent errors and session context
    else if (options.taskType === 'bug-fix') {
      if (options.sessionContext) {
        parts.push(options.sessionContext);
        remaining -= options.sessionContext.length / 4;
      }
      if (options.memoryContext && remaining > 1000) {
        parts.push(options.memoryContext);
      }
    }
    // Default: memory then session
    else {
      if (options.memoryContext) {
        parts.push(options.memoryContext);
        remaining -= options.memoryContext.length / 4;
      }
      if (options.sessionContext && remaining > 500) {
        parts.push(options.sessionContext);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Summarize long tool output to fit within budget.
   */
  summarizeToolOutput(output: string, maxChars = 3000): string {
    if (output.length <= maxChars) return output;

    const lines = output.split('\n');

    // For error output, keep first and last sections
    if (output.includes('Error') || output.includes('error') || output.includes('FAIL')) {
      const errorLines = lines.filter(l =>
        l.includes('Error') || l.includes('error') || l.includes('FAIL') ||
        l.includes('✗') || l.includes('×') || l.includes('✖')
      );
      if (errorLines.length > 0) {
        return `[Summarized — ${lines.length} lines]\n${errorLines.slice(0, 30).join('\n')}`;
      }
    }

    // Otherwise keep head + tail
    const headLines = lines.slice(0, 20);
    const tailLines = lines.slice(-20);
    const dropped = lines.length - 40;

    return [
      ...headLines,
      `... [${dropped} lines omitted for context efficiency] ...`,
      ...tailLines,
    ].join('\n');
  }
}
