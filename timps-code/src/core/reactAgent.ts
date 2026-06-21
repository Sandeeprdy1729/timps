// ── TIMPS Code — Native ReAct (Reasoning + Acting) Agent Loop ──
// A clean, deterministic agent loop inspired by the Python ReAct pattern.
// Uses the existing TIMPS provider, tool registry, and type system
// but exposes a clear Thought → Action → Observation cycle.

import type { Message, ToolCall, ModelProvider, ToolDefinition, AgentEvent, TokenUsage } from '../config/types.js';
import { getTool, getToolDefinitions } from '../tools/tools.js';
import { Memory } from '../memory/memory.js';
import { estimateTokens, estimateCost } from '../utils/utils.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const REACT_SYSTEM_PROMPT = `You are an autonomous enterprise operations coordinator.
Use the provided tools to verify real-world data before making assertions.
If you determine you need data from a tool, emit a tool call.
Be precise and output your final resolution clearly once all data is compiled.`;

export interface ReActAgentOptions {
  provider: ModelProvider;
  cwd: string;
  memory: Memory;
  maxCycles?: number;
  localMode?: boolean;
}

export class ReActAgent {
  private provider: ModelProvider;
  private cwd: string;
  private memory: Memory;
  private maxCycles: number;
  private localMode: boolean;
  private messages: Message[] = [];
  private totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  constructor(opts: ReActAgentOptions) {
    this.provider = opts.provider;
    this.cwd = opts.cwd;
    this.memory = opts.memory;
    this.maxCycles = opts.maxCycles ?? 10;
    this.localMode = opts.localMode ?? false;
  }

  private get systemPrompt(): string {
    const graphCtx = this.memory.graphQuery('project knowledge');
    let prompt = REACT_SYSTEM_PROMPT;
    if (graphCtx && !graphCtx.includes('No relevant knowledge')) {
      prompt += `\nPast context: ${graphCtx}\n`;
    }
    prompt += `\nWorking directory: ${this.cwd}\n`;
    return prompt;
  }

  private get toolSchemas(): ToolDefinition[] {
    return getToolDefinitions(this.localMode);
  }

  private async callLlm(): Promise<{ content: string; toolCalls: ToolCall[]; usage?: TokenUsage }> {
    const toolCalls: ToolCall[] = [];
    let fullContent = '';
    const currentToolArgs = new Map<string, string>();
    const currentToolNames = new Map<string, string>();
    let usage: TokenUsage | undefined;

    for await (const event of this.provider.stream(this.messages, this.toolSchemas)) {
      switch (event.type) {
        case 'text':
          fullContent += event.content;
          break;
        case 'tool_start':
          currentToolArgs.set(event.id, '');
          currentToolNames.set(event.id, event.name);
          break;
        case 'tool_delta':
          currentToolArgs.set(event.id,
            (currentToolArgs.get(event.id) || '') + event.argumentsChunk,
          );
          break;
        case 'tool_end': {
          const argsStr = currentToolArgs.get(event.id) || '{}';
          let args: Record<string, unknown>;
          try { args = JSON.parse(argsStr); } catch { args = { raw: argsStr }; }
          toolCalls.push({ id: event.id, name: currentToolNames.get(event.id) || 'unknown', arguments: args });
          break;
        }
        case 'done':
          usage = event.usage;
          break;
        case 'error':
          fullContent += `\n[Provider error: ${event.message}]`;
          break;
      }
    }

    if (usage) {
      this.totalUsage.inputTokens += usage.inputTokens;
      this.totalUsage.outputTokens += usage.outputTokens;
      this.totalUsage.estimatedCost = (this.totalUsage.estimatedCost || 0) +
        estimateCost(this.provider.model, usage.inputTokens, usage.outputTokens);
    }

    return { content: fullContent, toolCalls, usage };
  }

  async *execute(userObjective: string): AsyncGenerator<AgentEvent> {
    // 1. Initialize short-term memory with system prompt and user objective
    this.messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userObjective, timestamp: Date.now() },
    ];

    this.totalUsage = { inputTokens: 0, outputTokens: 0 };

    yield { type: 'text', content: `\n[ReAct Agent] Objective: ${userObjective}\n` };

    // 2. Main ReAct loop — Thought → Action → Observation cycles
    for (let cycle = 1; cycle <= this.maxCycles; cycle++) {
      // Step A: Query the cognitive core (LLM)
      const { content, toolCalls, usage } = await this.callLlm();

      // Commit assistant's reasoning to memory
      const assistantMsg: Message = { role: 'assistant', content, timestamp: Date.now() };
      if (toolCalls.length > 0) assistantMsg.toolCalls = toolCalls;
      this.messages.push(assistantMsg);

      // Step B: Check terminal condition — no tool calls means the core has concluded
      if (toolCalls.length === 0) {
        if (content) {
          this.memory.extractFacts(userObjective, content);
        }
        yield { type: 'text', content: `\n[ReAct Agent] Final answer:\n${content}\n` };
        yield { type: 'done', usage: this.totalUsage };
        return;
      }

      yield { type: 'text', content: `\n[Cycle ${cycle}/${this.maxCycles}] Tool calls intercepted: ${toolCalls.length}\n` };

      // Step C: Execute each tool call (sequential), appending observations to memory
      for (const toolCall of toolCalls) {
        const tool = getTool(toolCall.name);
        let observation: string;

        if (!tool) {
          observation = `Error: Tool '${toolCall.name}' is not bound to the execution registry.`;
        } else {
          yield { type: 'tool_start', tool: toolCall.name, args: toolCall.arguments };
          try {
            const result = await tool.execute(toolCall.arguments, this.cwd);
            observation = result.content;
            yield { type: 'tool_result', tool: toolCall.name, result: result.content.slice(0, 200), success: !result.isError, durationMs: 0 };
          } catch (err) {
            observation = `Error executing ${toolCall.name}: ${(err as Error).message}`;
            yield { type: 'tool_result', tool: toolCall.name, result: observation, success: false };
          }
        }

        // Append observation back to short-term memory
        this.messages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          name: toolCall.name,
          content: observation,
        });
      }
    }

    yield { type: 'text', content: `\n[Timeout] Maximum cycles (${this.maxCycles}) reached without convergence.\n` };
    yield { type: 'done', usage: this.totalUsage };
  }
}
