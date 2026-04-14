// agent/base.ts - Base Agent Framework
// Generic async streaming agent with tool execution, self-correction, and memory integration

import type {
  Message, ToolCall, ToolDefinition, StreamEvent, AgentEvent,
  TokenUsage, PlanStep, ModelProvider,
} from '../types.js';
import { getTool, getToolRisk, getToolDefinitions } from '../tools.js';
import type { ToolExecResult } from '../tools.js';
import { Permissions } from '../permissions.js';
import { estimateTokens, estimateCost } from '../utils.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface AgentConfig {
  provider: ModelProvider;
  cwd: string;
  maxContextTokens?: number;
  maxTurns?: number;
  maxCorrections?: number;
  autoCorrect?: boolean;
  enableSelfCorrection?: boolean;
  enableMemorySync?: boolean;
  completionPromise?: () => boolean;  // Exit code hook - agent can't exit until this returns true
  minSuccessRate?: number;  // Force iterations until success rate >= this
}

export interface ExecutionContext {
  messages: Message[];
  toolCalls: ToolCall[];
  currentTurn: number;
  totalUsage: TokenUsage;
  startTime: number;
}

const SYSTEM_PROMPT = `TIMPS Code. Execution only. No prose.

## State
- Memory: synced, patterns stored
- Context: compact, tokens managed
- Goal: deliver working code

## Rules
1. Read before edit
2. Test after change
3. Fix root cause, not symptoms
4. Loop until tests pass — never exit on failure
5. Greetings -> minimal response
6. Code over explanation
`;

export abstract class BaseAgent {
  protected provider: ModelProvider;
  protected cwd: string;
  protected messages: Message[] = [];
  protected totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  protected maxContextTokens: number;
  protected maxTurns: number;
  protected maxCorrections: number;
  protected autoCorrect: boolean;
  protected enableSelfCorrection: boolean;
  protected enableMemorySync: boolean;
  protected permissions: Permissions;
  protected abortController: AbortController | null = null;
  protected completionPromise?: () => boolean;
  protected minSuccessRate: number = 1.0;
  private successCount: number = 0;
  private failureCount: number = 0;

  constructor(config: AgentConfig) {
    this.provider = config.provider;
    this.cwd = config.cwd;
    this.maxContextTokens = config.maxContextTokens ?? 100000;
    this.maxTurns = config.maxTurns ?? 25;
    this.maxCorrections = config.maxCorrections ?? 3;
    this.autoCorrect = config.autoCorrect ?? true;
    this.enableSelfCorrection = config.enableSelfCorrection ?? true;
    this.enableMemorySync = config.enableMemorySync ?? true;
    this.completionPromise = config.completionPromise;
    this.minSuccessRate = config.minSuccessRate ?? 1.0;
    this.permissions = new Permissions('normal', []);
  }

  protected buildSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  async *run(initialMessage: string): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();
    this.messages.push({ role: 'user', content: initialMessage, timestamp: Date.now() });

    if (this.messages.length === 1) {
      this.messages.unshift({ role: 'system', content: this.buildSystemPrompt() });
    }

    yield { type: 'status', message: 'Starting agent loop...' };

    let turn = 0;
    let lastResult: { done: boolean; error?: string } = { done: false };
    
    while (turn < this.maxTurns) {
      turn++;
      
      const check = this.checkContextBudget();
      if (check.needsCompaction) {
        yield* this.compactContext();
      }

      const tools = getToolDefinitions(this.isLocalModel);
      lastResult = yield* this.executeTurn(tools);
      
      if (lastResult.done) {
        if (this.completionPromise && !this.completionPromise()) {
          yield { type: 'status', message: 'Completion promise not met — continuing...' };
          continue;
        }
        yield* this.finalize();
        return;
      }

      if (lastResult.error) {
        this.failureCount++;
        yield { type: 'error', message: lastResult.error };
        
        if (this.completionPromise && !this.completionPromise()) {
          yield { type: 'status', message: 'Failure — retrying until completion promise satisfied...' };
          continue;
        }
        return;
      }
    }

    yield { type: 'error', message: `Max turns (${this.maxTurns}) reached` };
    yield { type: 'done', usage: this.totalUsage };
  }

  protected abstract executeTurn(tools: ToolDefinition[]): AsyncGenerator<AgentEvent, { done: boolean; error?: string }>;

  protected async *executeTurnWithTools(tools: ToolDefinition[]): AsyncGenerator<AgentEvent, { done: boolean; error?: string }> {
    let fullText = '';
    const toolCalls: ToolCall[] = [];
    let currentToolArgs = new Map<string, string>();
    let currentToolName = new Map<string, string>();

    try {
      for await (const event of this.provider.stream(this.messages, tools, { signal: this.abortController!.signal })) {
        switch (event.type) {
          case 'text':
            fullText += event.content;
            yield { type: 'text', content: event.content };
            break;

          case 'thinking':
            yield { type: 'thinking', content: event.content };
            break;

          case 'tool_start':
            currentToolArgs.set(event.id, '');
            currentToolName.set(event.id, event.name);
            break;

          case 'tool_delta':
            currentToolArgs.set(event.id, (currentToolArgs.get(event.id) || '') + event.argumentsChunk);
            break;

          case 'tool_end': {
            const argsStr = currentToolArgs.get(event.id) || '{}';
            let args: Record<string, unknown>;
            try { args = JSON.parse(argsStr); } catch { args = { raw: argsStr }; }
            
            toolCalls.push({
              id: event.id,
              name: currentToolName.get(event.id) || 'unknown',
              arguments: args,
            });
            break;
          }

          case 'done':
            if (event.usage) {
              this.totalUsage.inputTokens += event.usage.inputTokens;
              this.totalUsage.outputTokens += event.usage.outputTokens;
              const turnCost = estimateCost(this.provider.model, event.usage.inputTokens, event.usage.outputTokens);
              this.totalUsage.estimatedCost = (this.totalUsage.estimatedCost || 0) + turnCost;
            }
            break;

          case 'error':
            yield { type: 'error', message: event.message };
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        yield { type: 'error', message: 'Cancelled' };
        return { done: true };
      }
      yield { type: 'error', message: `Provider error: ${(err as Error).message}` };
      return { done: false, error: (err as Error).message };
    }

    const assistantMsg: Message = {
      role: 'assistant',
      content: fullText,
      timestamp: Date.now(),
    };
    if (toolCalls.length > 0) assistantMsg.toolCalls = toolCalls;
    this.messages.push(assistantMsg);

    if (toolCalls.length === 0) {
      return { done: true };
    }

    for (const tc of toolCalls) {
      yield* this.executeToolCall(tc);
    }

    return { done: false };
  }

  protected async *executeToolCall(tc: ToolCall): AsyncGenerator<AgentEvent> {
    if (tc.name === 'ask_user') {
      const question = String(tc.arguments.question || 'Provide input:');
      yield { type: 'ask_user', question, callId: tc.id };
      return;
    }

    const tool = getTool(tc.name);
    if (!tool) {
      this.messages.push({ role: 'tool', content: `Unknown tool: ${tc.name}`, toolCallId: tc.id, name: tc.name });
      yield { type: 'tool_result', tool: tc.name, result: `Unknown tool: ${tc.name}`, success: false };
      return;
    }

    const risk = getToolRisk(tc.name);
    const allowed = await this.permissions.check(tc.name, tc.arguments, risk);
    if (!allowed) {
      const msg = 'Permission denied';
      this.messages.push({ role: 'tool', content: msg, toolCallId: tc.id, name: tc.name });
      yield { type: 'tool_result', tool: tc.name, result: msg, success: false };
      return;
    }

    yield { type: 'tool_start', tool: tc.name, args: tc.arguments };

    const result = await this.executeToolWithRetry(tool, tc.arguments);
    
    this.messages.push({
      role: 'tool',
      content: result.content,
      toolCallId: tc.id,
      name: tc.name,
    });

    yield { type: 'tool_result', tool: tc.name, result: result.content, success: !result.isError };

    if (result.isError && this.autoCorrect && this.enableSelfCorrection) {
      yield* this.attemptSelfCorrection(tc, result.content);
    }
  }

  protected async executeToolWithRetry(
    tool: { execute: (args: Record<string, unknown>, cwd: string) => Promise<ToolExecResult> },
    args: Record<string, unknown>
  ): Promise<ToolExecResult> {
    const TRANSIENT_ERRORS = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'fetch failed', 'AbortError', 'timeout'];
    const MAX_RETRIES = 3;
    let lastError = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await tool.execute(args, this.cwd);
        if (!result.isError || !TRANSIENT_ERRORS.some(e => result.content.includes(e))) {
          return result;
        }
        lastError = result.content;
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (err) {
        lastError = (err as Error).message;
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    return { content: `Failed after ${MAX_RETRIES} retries: ${lastError}`, isError: true };
  }

  protected async *attemptSelfCorrection(failedCall: ToolCall, errorMsg: string): AsyncGenerator<AgentEvent> {
    const recoverable = [
      'oldString not found', 'No such file', 'ENOENT',
      'Exit 1', 'Exit 2', 'found 0 times', 'must be unique',
    ];

    if (!recoverable.some(r => errorMsg.includes(r))) return;

    for (let attempt = 1; attempt <= this.maxCorrections; attempt++) {
      yield { type: 'selfcorrect', attempt, error: errorMsg };

      this.messages.push({
        role: 'user',
        content: `Error: ${errorMsg.slice(0, 300)}

Attempt ${attempt}/${this.maxCorrections}. Analyze and fix:
1. What exactly failed?
2. What assumption was wrong?
3. How to fix definitively?` +
          (failedCall.name === 'edit_file' ? '\nRe-read the file before editing.' : ''),
      });

      return;
    }
  }

  protected checkContextBudget(): { needsCompaction: boolean; currentTokens: number } {
    const currentTokens = this.estimateContextTokens();
    return {
      needsCompaction: currentTokens > this.maxContextTokens * 0.8,
      currentTokens,
    };
  }

  protected async *compactContext(): AsyncGenerator<AgentEvent> {
    if (this.messages.length < 10) return;

    yield { type: 'status', message: 'Compacting context...' };

    const historyDir = path.join(os.homedir(), '.timps', 'history');
    fs.mkdirSync(historyDir, { recursive: true });
    
    const nonSystem = this.messages.filter(m => m.role !== 'system');
    if (nonSystem.length < 6) return;

    const histFile = path.join(historyDir, `compacted_${Date.now()}.json`);
    fs.writeFileSync(histFile, JSON.stringify(nonSystem.slice(0, -4), null, 2), 'utf-8');

    const historyText = nonSystem.slice(0, -4)
      .map(m => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content.slice(0, 500) : '[tool]'}`)
      .join('\n---\n');

    let summary = '';
    try {
      const summaryMessages: Message[] = [
        { role: 'user', content: `Summarize this conversation:\n\n${historyText}\n\nKeep under 300 words, focus on decisions and current state.` }
      ];
      for await (const event of this.provider.stream(summaryMessages, [])) {
        if (event.type === 'text') summary += event.content;
      }
    } catch { /* best-effort */ }

    const before = this.estimateContextTokens();

    const freshMessages = this.messages.filter(m => m.role === 'system');
    freshMessages.push({
      role: 'user',
      content: `[Session summary]\n${summary || 'Previous context compacted.'}`,
    });
    freshMessages.push({
      role: 'assistant',
      content: 'Understood. Continuing with full context from summary.',
    });

    const recent = nonSystem.slice(-4);
    this.messages = [...freshMessages, ...recent];

    const after = this.estimateContextTokens();
    yield { type: 'context_compacted', before, after };
  }

  protected estimateContextTokens(): number {
    return this.messages.reduce((acc, m) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return acc + Math.round(content.length / 4);
    }, 0);
  }

  protected async *finalize(): AsyncGenerator<AgentEvent> {
    const userMsgs = this.messages.filter(m => m.role === 'user');
    const toolsUsed = new Set<string>();
    const filesChanged = new Set<string>();

    for (const m of this.messages) {
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          toolsUsed.add(tc.name);
          if (tc.arguments.path) filesChanged.add(String(tc.arguments.path));
        }
      }
    }

    yield { type: 'done', usage: this.totalUsage };
  }

  protected get isLocalModel(): boolean {
    return this.provider.name === 'ollama' || this.provider.name === 'opencode';
  }

  abort(): void {
    this.abortController?.abort();
  }

  getUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  clearHistory(): void {
    const sysMsg = this.messages[0];
    this.messages = sysMsg ? [sysMsg] : [];
    this.totalUsage = { inputTokens: 0, outputTokens: 0 };
  }

  addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({ role, content, timestamp: Date.now() });
  }

  addSystemMessage(content: string): void {
    this.messages.unshift({ role: 'system', content, timestamp: Date.now() });
  }
}
