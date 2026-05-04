import type { Message, ToolCall, ToolDefinition, AgentEvent, TokenUsage, ModelProvider } from '../config/types.js';
import { getTool, getToolRisk, getToolDefinitions } from '../tools/tools.js';
import type { ToolExecResult } from '../tools/tools.js';
import { PermissionSystem as Permissions } from '../utils/permissions.js';
import { estimateTokens, estimateCost, generateId, sleep } from '../utils/utils.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export interface AgentConfig {
  provider: ModelProvider;
  cwd: string;
  trustLevel?: import('../config/types.js').TrustLevel;
  maxContextTokens?: number;
  maxTurns?: number;
  maxCorrections?: number;
  autoCorrect?: boolean;
  memoryEnabled?: boolean;
  completionPromise?: () => boolean;
}

const SYSTEM_PROMPT = `You are TIMPS Code, a production-grade AI coding agent.

## Core Rules
1. Read files before editing them — never assume content
2. Make surgical edits (edit_file) rather than full rewrites (write_file) when possible
3. Run tests after making changes to verify correctness
4. Fix root causes, not symptoms
5. Loop until tests pass — never exit with failing tests
6. Keep responses concise — prefer code over prose
7. Use think tool for complex reasoning before acting
8. Use todo_write/todo_read to track multi-step plans

## Tool Usage
- Use read_file with line ranges for large files
- Use search_code to find patterns before editing
- Use run_diagnostics to check types/lint after changes
- Use bash for running tests, installs, builds
- Use web_search/fetch_url when you need documentation
- Use memory_store to save important discoveries for future sessions
`;

export class BaseAgent {
  protected provider: ModelProvider;
  protected cwd: string;
  protected messages: Message[] = [];
  protected totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  protected maxContextTokens: number;
  protected maxTurns: number;
  protected maxCorrections: number;
  protected autoCorrect: boolean;
  protected permissions: Permissions;
  protected abortController: AbortController | null = null;

  constructor(config: AgentConfig) {
    this.provider = config.provider;
    this.cwd = config.cwd;
    this.maxContextTokens = config.maxContextTokens ?? 100_000;
    this.maxTurns = config.maxTurns ?? 30;
    this.maxCorrections = config.maxCorrections ?? 5;
    this.autoCorrect = config.autoCorrect ?? true;
    this.permissions = new Permissions();
    this.messages.push({ role: 'system', content: this.buildSystemPrompt() });
  }

  protected buildSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();
    this.messages.push({ role: 'user', content: userMessage, timestamp: Date.now() });
    yield { type: 'status', message: 'Thinking...' };

    for (let turn = 0; turn < this.maxTurns; turn++) {
      // Compact context if needed
      if (this.estimateContextTokens() > this.maxContextTokens * 0.8) {
        yield* this.compactContext();
      }

      const isLocal = this.provider.name === 'ollama' || this.provider.name === 'hybrid';
      const tools = getToolDefinitions(isLocal);
      const result = yield* this.executeTurn(tools);

      if (result.done) {
        yield* this.finalize();
        return;
      }
      if (result.error) {
        yield { type: 'error', message: result.error };
        return;
      }
    }

    yield { type: 'error', message: `Max turns (${this.maxTurns}) reached` };
    yield { type: 'done', usage: this.totalUsage };
  }

  protected async *executeTurn(tools: ToolDefinition[]): AsyncGenerator<AgentEvent, { done: boolean; error?: string }> {
    let fullText = '';
    const toolCalls: ToolCall[] = [];
    const pendingArgs = new Map<string, string>();
    const pendingNames = new Map<string, string>();

    try {
      for await (const event of this.provider.stream(this.messages, tools, {
        signal: this.abortController!.signal,
        maxTokens: 8192,
      })) {
        switch (event.type) {
          case 'text':
            fullText += event.content;
            yield { type: 'text', content: event.content };
            break;
          case 'thinking':
            yield { type: 'thinking', content: event.content };
            break;
          case 'tool_start':
            pendingArgs.set(event.id, '');
            pendingNames.set(event.id, event.name);
            break;
          case 'tool_delta':
            pendingArgs.set(event.id, (pendingArgs.get(event.id) || '') + event.argumentsChunk);
            break;
          case 'tool_end': {
            const argsStr = pendingArgs.get(event.id) || '{}';
            let args: Record<string, unknown>;
            try { args = JSON.parse(argsStr); } catch { args = { raw: argsStr }; }
            toolCalls.push({ id: event.id, name: pendingNames.get(event.id) || 'unknown', arguments: args });
            break;
          }
          case 'done':
            if (event.usage) {
              this.totalUsage.inputTokens += event.usage.inputTokens;
              this.totalUsage.outputTokens += event.usage.outputTokens;
              this.totalUsage.estimatedCost = (this.totalUsage.estimatedCost || 0) +
                estimateCost(this.provider.model, event.usage.inputTokens, event.usage.outputTokens);
            }
            break;
          case 'error':
            yield { type: 'error', message: event.message };
            break;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        yield { type: 'status', message: 'Cancelled.' };
        return { done: true };
      }
      return { done: false, error: `Provider error: ${err.message}` };
    }

    const assistantMsg: Message = { role: 'assistant', content: fullText, timestamp: Date.now() };
    if (toolCalls.length > 0) assistantMsg.toolCalls = toolCalls;
    this.messages.push(assistantMsg);

    if (toolCalls.length === 0) return { done: true };

    for (const tc of toolCalls) {
      yield* this.executeToolCall(tc);
    }

    return { done: false };
  }

  protected async *executeToolCall(tc: ToolCall): AsyncGenerator<AgentEvent> {
    // Special: ask_user — pause and prompt
    if (tc.name === 'ask_user') {
      const question = String(tc.arguments.question || 'Please provide input:');
      yield { type: 'ask_user', question, callId: tc.id };
      const answer = await this.promptUser(question);
      this.messages.push({ role: 'tool', content: answer, toolCallId: tc.id, name: 'ask_user' });
      yield { type: 'tool_result', tool: 'ask_user', result: answer, success: true };
      return;
    }

    const tool = getTool(tc.name);
    if (!tool) {
      const msg = `Unknown tool: ${tc.name}`;
      this.messages.push({ role: 'tool', content: msg, toolCallId: tc.id, name: tc.name });
      yield { type: 'tool_result', tool: tc.name, result: msg, success: false };
      return;
    }

    const risk = getToolRisk(tc.name);
    const needsApproval = this.permissions.requiresApproval(tc.name, tc.arguments);
    if (needsApproval) {
      const msg = `Permission denied for ${tc.name}`;
      this.messages.push({ role: 'tool', content: msg, toolCallId: tc.id, name: tc.name });
      yield { type: 'tool_result', tool: tc.name, result: msg, success: false };
      return;
    }

    const startMs = Date.now();
    yield { type: 'tool_start', tool: tc.name, args: tc.arguments };

    const result = await this.executeWithRetry(tool, tc.arguments);
    const durationMs = Date.now() - startMs;

    this.messages.push({ role: 'tool', content: result.content, toolCallId: tc.id, name: tc.name });
    yield { type: 'tool_result', tool: tc.name, result: result.content, success: !result.isError, durationMs };

    if (result.isError && this.autoCorrect) {
      yield* this.selfCorrect(tc, result.content);
    }
  }

  private async executeWithRetry(
    tool: { execute: (args: Record<string, unknown>, cwd: string) => Promise<ToolExecResult> },
    args: Record<string, unknown>
  ): Promise<ToolExecResult> {
    const TRANSIENT = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'fetch failed', 'timeout'];
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const result = await tool.execute(args, this.cwd);
        if (!result.isError || !TRANSIENT.some(e => result.content.includes(e))) return result;
        if (attempt < 3) await sleep(Math.pow(2, attempt) * 1000);
      } catch (err: any) {
        if (attempt === 3) return { content: `Failed after retries: ${err.message}`, isError: true };
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
    return { content: 'Tool failed after retries', isError: true };
  }

  protected async *selfCorrect(failedCall: ToolCall, errorMsg: string): AsyncGenerator<AgentEvent> {
    const recoverable = [
      'oldString not found', 'No such file', 'ENOENT', 'Exit 1', 'Exit 2',
      'found 0 times', 'must be unique', 'AssertionError', 'Test failed',
    ];
    if (!recoverable.some(r => errorMsg.includes(r))) return;

    yield { type: 'selfcorrect', attempt: 1, error: errorMsg };
    this.messages.push({
      role: 'user',
      content: `Tool error: ${errorMsg.slice(0, 400)}\n\nAnalyze and fix:\n1. What exactly failed?\n2. What was the wrong assumption?\n3. Fix definitively.${failedCall.name === 'edit_file' ? '\nHint: re-read the file first to get the exact current content.' : ''}`,
    });
  }

  private async promptUser(question: string): Promise<string> {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      return await rl.question(`  ${question}\n  > `);
    } finally {
      rl.close();
    }
  }

  protected async *compactContext(): AsyncGenerator<AgentEvent> {
    if (this.messages.length < 10) return;
    yield { type: 'status', message: 'Compacting context...' };

    const before = this.estimateContextTokens();
    const nonSystem = this.messages.filter(m => m.role !== 'system');
    const toSummarize = nonSystem.slice(0, -4);
    if (toSummarize.length < 4) return;

    // Save to history
    const histDir = path.join(os.homedir(), '.timps', 'history');
    fs.mkdirSync(histDir, { recursive: true });
    fs.writeFileSync(path.join(histDir, `compacted_${Date.now()}.json`), JSON.stringify(toSummarize, null, 2));

    const historyText = toSummarize
      .map(m => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content.slice(0, 300) : '[tool]'}`)
      .join('\n---\n');

    let summary = '';
    try {
      for await (const ev of this.provider.stream([
        { role: 'user', content: `Summarize this coding session in under 200 words. Focus on what was done, current state, and key decisions:\n\n${historyText}` },
      ], [])) {
        if (ev.type === 'text') summary += ev.content;
      }
    } catch { summary = 'Previous context compacted.'; }

    const sysMessages = this.messages.filter(m => m.role === 'system');
    const recent = nonSystem.slice(-4);
    this.messages = [
      ...sysMessages,
      { role: 'user', content: `[Session summary]\n${summary}` },
      { role: 'assistant', content: 'Understood. Continuing.' },
      ...recent,
    ];

    const after = this.estimateContextTokens();
    yield { type: 'context_compacted', before, after };
  }

  protected estimateContextTokens(): number {
    return this.messages.reduce((acc, m) => {
      const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return acc + estimateTokens(c);
    }, 0);
  }

  protected async *finalize(): AsyncGenerator<AgentEvent> {
    yield { type: 'done', usage: this.totalUsage };
  }

  abort(): void { this.abortController?.abort(); }
  getUsage(): TokenUsage { return { ...this.totalUsage }; }
  getMessages(): Message[] { return [...this.messages]; }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content, timestamp: Date.now() });
  }

  clearHistory(): void {
    const sys = this.messages.find(m => m.role === 'system');
    this.messages = sys ? [sys] : [];
    this.totalUsage = { inputTokens: 0, outputTokens: 0 };
  }
}
