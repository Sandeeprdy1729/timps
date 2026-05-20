// ── TIMPS Architecture Agent — High-level architectural reasoning ──
// Solves limitation 2.5: "brilliant at code but terrible at architecture"
// Specializes in: trade-off analysis, design patterns, scalability,
// technical debt detection, and system-wide impact reasoning.

import type { ModelProvider, AgentEvent, Message, TokenUsage } from '../config/types.js';
import type { CodeGraph } from '../memory/codeGraph.js';
import type { SessionBridge } from '../memory/sessionBridge.js';

export interface ArchitecturalProposal {
  summary: string;
  rationale: string;
  tradeoffs: {
    pros: string[];
    cons: string[];
    alternatives: string[];
  };
  impactedComponents: string[];
  riskLevel: 'low' | 'medium' | 'high';
  implementationSteps: string[];
  estimatedComplexity: 'trivial' | 'small' | 'medium' | 'large' | 'epic';
  technicalDebt: string[];   // What debt this creates or resolves
  reversibility: 'easy' | 'medium' | 'hard' | 'irreversible';
}

export interface ArchitectureReview {
  overallScore: number;      // 0-100
  issues: ArchitectureIssue[];
  strengths: string[];
  recommendations: string[];
  patternViolations: string[];
}

export interface ArchitectureIssue {
  type: 'coupling' | 'cohesion' | 'scalability' | 'security' | 'maintainability' | 'performance' | 'debt';
  severity: 'info' | 'warning' | 'error' | 'critical';
  location: string;
  description: string;
  suggestion: string;
}

const ARCHITECT_SYSTEM_PROMPT = `You are the Lead Software Architect for TIMPS — an elite AI coding system.

## Your Role
You reason at the SYSTEM level, not the file level. You:
- Analyze architectural trade-offs and long-term implications
- Identify coupling, cohesion, scalability, and technical debt issues
- Propose design patterns appropriate for the context
- Evaluate change impact across the entire system
- Balance pragmatism with principled design

## Architectural Reasoning Framework
For any design decision, analyze:
1. **SOLID Principles** — Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
2. **CAP Theorem** — For distributed systems: Consistency, Availability, Partition tolerance
3. **Technical Debt Quadrant** — Deliberate vs inadvertent, reckless vs prudent
4. **Change Velocity** — How often will this component change? High-change = thin interfaces
5. **Team Dynamics** — How will this structure scale with team size?

## Output Format
When proposing architecture changes:
1. State the PROBLEM clearly
2. Propose a SOLUTION with explicit trade-offs
3. List ALTERNATIVES considered and why they were rejected
4. Identify RISKS and mitigation strategies
5. Provide IMPLEMENTATION STEPS in dependency order

## Anti-patterns to detect
- God classes/modules (excessive responsibility)
- Circular dependencies
- Leaky abstractions
- Premature optimization
- Missing abstraction layers
- Spaghetti dependencies
- N+1 query patterns
- Tight coupling to infrastructure
`;

export class ArchitectAgent {
  private provider: ModelProvider;
  private cwd: string;
  private codeGraph?: CodeGraph;
  private sessionBridge?: SessionBridge;
  private messages: Message[] = [];
  private totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  private abortController: AbortController | null = null;

  constructor(options: {
    provider: ModelProvider;
    cwd: string;
    codeGraph?: CodeGraph;
    sessionBridge?: SessionBridge;
  }) {
    this.provider = options.provider;
    this.cwd = options.cwd;
    this.codeGraph = options.codeGraph;
    this.sessionBridge = options.sessionBridge;

    this.messages.push({
      role: 'system',
      content: this.buildSystemPrompt(),
    });
  }

  private buildSystemPrompt(): string {
    let prompt = ARCHITECT_SYSTEM_PROMPT;

    // Inject code graph summary if available
    if (this.codeGraph && this.codeGraph.nodeCount > 0) {
      const summary = this.codeGraph.summarize();
      if (summary) {
        prompt += `\n\n${summary}`;
      }
    }

    // Inject past architectural decisions from session bridge
    if (this.sessionBridge) {
      const profile = (this.sessionBridge as any).loadProfile?.();
      if (profile?.keyDecisions?.length > 0) {
        prompt += '\n\n## Past Architectural Decisions\n';
        for (const dec of profile.keyDecisions.slice(0, 8)) {
          prompt += `- ${dec}\n`;
        }
      }
    }

    prompt += `\nWorking directory: ${this.cwd}\n`;
    return prompt;
  }

  // ── Core architectural reasoning ───────────────────────────────────────────

  /**
   * Analyze a proposed change and produce a full architectural assessment.
   */
  async *analyzeChange(changeDescription: string): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();

    const prompt = this.buildChangeAnalysisPrompt(changeDescription);
    this.messages.push({ role: 'user', content: prompt });

    yield { type: 'status', message: 'Analyzing architectural implications...' };

    let fullText = '';
    try {
      for await (const event of this.provider.stream(
        this.messages, [],
        { signal: this.abortController.signal }
      )) {
        if (event.type === 'text') {
          fullText += event.content;
          yield { type: 'text', content: event.content };
        }
        if (event.type === 'done' && event.usage) {
          this.totalUsage.inputTokens += event.usage.inputTokens;
          this.totalUsage.outputTokens += event.usage.outputTokens;
        }
      }
    } catch (err) {
      yield { type: 'error', message: `Architecture analysis failed: ${(err as Error).message}` };
      return;
    }

    this.messages.push({ role: 'assistant', content: fullText });
    yield { type: 'done', usage: this.totalUsage };
  }

  /**
   * Review existing architecture for issues.
   */
  async *reviewArchitecture(scope?: string): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();

    const codeStats = this.codeGraph ? this.codeGraph.summarize() : '';
    const prompt = this.buildReviewPrompt(scope, codeStats);
    this.messages.push({ role: 'user', content: prompt });

    yield { type: 'status', message: 'Reviewing system architecture...' };

    let fullText = '';
    try {
      for await (const event of this.provider.stream(
        this.messages, [],
        { signal: this.abortController.signal }
      )) {
        if (event.type === 'text') {
          fullText += event.content;
          yield { type: 'text', content: event.content };
        }
        if (event.type === 'done' && event.usage) {
          this.totalUsage.inputTokens += event.usage.inputTokens;
          this.totalUsage.outputTokens += event.usage.outputTokens;
        }
      }
    } catch (err) {
      yield { type: 'error', message: `Architecture review failed: ${(err as Error).message}` };
      return;
    }

    this.messages.push({ role: 'assistant', content: fullText });
    yield { type: 'done', usage: this.totalUsage };
  }

  /**
   * Compare two design options and recommend the best approach.
   */
  async *compareDesigns(option1: string, option2: string, context: string): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();

    const prompt = `## Design Comparison Request

**Context**: ${context}

**Option A**: ${option1}

**Option B**: ${option2}

Analyze both options using the architectural reasoning framework. 
Consider: maintainability, scalability, complexity, coupling, reversibility.
Structure your response as:
1. Trade-offs for Option A
2. Trade-offs for Option B
3. Recommendation with justification
4. Conditions under which the other option would be better`;

    this.messages.push({ role: 'user', content: prompt });
    yield { type: 'status', message: 'Comparing design options...' };

    let fullText = '';
    try {
      for await (const event of this.provider.stream(
        this.messages, [],
        { signal: this.abortController.signal }
      )) {
        if (event.type === 'text') {
          fullText += event.content;
          yield { type: 'text', content: event.content };
        }
      }
    } catch (err) {
      yield { type: 'error', message: `Design comparison failed: ${(err as Error).message}` };
      return;
    }

    this.messages.push({ role: 'assistant', content: fullText });
    yield { type: 'done', usage: this.totalUsage };
  }

  /**
   * Analyze a file change for architectural impact using the code graph.
   */
  async *impactAnalysis(filePath: string): AsyncGenerator<AgentEvent> {
    if (!this.codeGraph) {
      yield { type: 'text', content: 'Code graph not available. Run a full analysis first.' };
      yield { type: 'done', usage: this.totalUsage };
      return;
    }

    const impactSummary = this.codeGraph.impactSummary(filePath);
    const symbols = this.codeGraph.getFileSymbols(filePath);

    const prompt = `## Change Impact Analysis

**File**: ${filePath}

**Code Graph Impact**:
${impactSummary}

**Symbols in this file**:
${symbols.map(s => `- ${s.type} \`${s.name}\` (line ${s.startLine}, complexity: ${s.complexity ?? 'N/A'})`).join('\n')}

Analyze:
1. What could break if this file changes?
2. Which symbols are high-risk to modify?
3. What testing is needed?
4. Are there architectural concerns about how this file is used?`;

    this.messages.push({ role: 'user', content: prompt });
    yield { type: 'status', message: 'Analyzing change impact...' };

    let fullText = '';
    try {
      for await (const event of this.provider.stream(
        this.messages, [],
        { signal: this.abortController!.signal }
      )) {
        if (event.type === 'text') {
          fullText += event.content;
          yield { type: 'text', content: event.content };
        }
      }
    } catch (err) {
      yield { type: 'error', message: `Impact analysis failed: ${(err as Error).message}` };
      return;
    }

    this.messages.push({ role: 'assistant', content: fullText });
    yield { type: 'done', usage: this.totalUsage };
  }

  // ── Prompt builders ────────────────────────────────────────────────────────

  private buildChangeAnalysisPrompt(changeDescription: string): string {
    const parts = [
      `## Architectural Analysis Request`,
      ``,
      `**Proposed Change**: ${changeDescription}`,
    ];

    if (this.codeGraph && this.codeGraph.nodeCount > 0) {
      const stats = this.codeGraph.getStats();
      parts.push('');
      parts.push(`**Codebase Context**:`);
      parts.push(`- ${stats.fileCount} files, ${stats.functionCount} functions`);
      parts.push(`- Average complexity: ${stats.avgComplexity}`);
      if (stats.mostConnected.length > 0) {
        parts.push(`- Most connected: ${stats.mostConnected.slice(0, 3).join(', ')}`);
      }
    }

    parts.push('');
    parts.push('Analyze this change and provide:');
    parts.push('1. Architectural trade-offs (pros/cons)');
    parts.push('2. Risk assessment (coupling, scalability, tech debt)');
    parts.push('3. Alternative approaches');
    parts.push('4. Recommended implementation sequence');
    parts.push('5. Tests required to validate the change');

    return parts.join('\n');
  }

  private buildReviewPrompt(scope?: string, codeStats?: string): string {
    const parts = [
      `## Architecture Review Request`,
      scope ? `Scope: ${scope}` : `Scope: Full system`,
      '',
    ];

    if (codeStats) {
      parts.push(codeStats);
      parts.push('');
    }

    parts.push('Review the architecture for:');
    parts.push('1. **Coupling issues** — overly dependent components');
    parts.push('2. **Cohesion problems** — mixed responsibilities');
    parts.push('3. **Scalability bottlenecks** — what breaks at 10x load?');
    parts.push('4. **Technical debt** — shortcuts that will cost later');
    parts.push('5. **Security architecture** — trust boundaries, input validation placement');
    parts.push('6. **Missing abstractions** — where future changes will be painful');

    return parts.join('\n');
  }

  /** Cancel any in-progress analysis */
  cancel(): void {
    this.abortController?.abort();
  }
}
