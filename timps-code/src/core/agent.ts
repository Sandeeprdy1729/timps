// ── TIMPS Code — Self-Correcting Agent ──
// Planning · Tool execution · Error recovery · Snapshot integration · Memory

import type {
  Message, ModelProvider, ToolCall, ToolDefinition,
  StreamEvent, AgentEvent, TokenUsage, PlanStep,
} from '../config/types.js';
import { ALL_TOOLS, getTool, getToolRisk, getToolDefinitions } from '../tools/tools.js';
import type { ToolExecResult } from '../tools/tools.js';
import type { PluginManager } from '../plugins/pluginManager.js';
import { SnapshotManager } from '../memory/snapshot.js';
import { PermissionSystem as Permissions } from '../utils/permissions.js';
import { Memory } from '../memory/memory.js';
import { getSkillContext } from '../utils/skills.js';
import { estimateTokens, generateId, estimateCost } from '../utils/utils.js';
import type { TeamMemory } from '../memory/teamMemory.js';
import { TodoStore } from '../utils/todo.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ── New intelligence layers ──
import { SessionBridge } from '../memory/sessionBridge.js';
import { RiskEngine } from '../utils/riskEngine.js';
import { ContextOrchestrator } from './contextOrchestrator.js';
import { injectEchoContext } from '../memory/echoVeil.js';
import { injectQISRDContext } from '../memory/qisrdVeil.js';
import { SelfImprovingAgent } from '../agent/selfImprovingAgent.js';
import { DurableJobEngine } from './durableJob.js';
import { CodeGraph } from '../memory/codeGraph.js';

const getProvenForge = async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pf = require('../../sandeep-ai/core/provenForge.js');
    return pf.provenForge;
  } catch {
    const { provenForge } = await import('../team/provenForgeStub.js');
    return provenForge;
  }
};

export interface AgentOptions {
  provider: ModelProvider;
  cwd: string;
  memory: Memory;
  permissions: Permissions;
  snapshots: SnapshotManager;
  maxTurns?: number;          // max tool-use rounds (default: 25)
  maxCorrections?: number;    // max self-correction attempts (default: 3)
  maxContextTokens?: number;  // trigger compaction after this (default: 100000)
  customInstructions?: string;
  autoCorrect?: boolean;      // auto-retry on errors (default: true)
  techStack?: import('../config/types.js').TechStack;
  teamMemory?: TeamMemory;
  branchName?: string;
  pluginManager?: PluginManager;
  // New intelligence layers
  sessionBridge?: SessionBridge;
  riskEngine?: RiskEngine;
  contextOrchestrator?: ContextOrchestrator;
  selfImproving?: SelfImprovingAgent;
  durableJob?: DurableJobEngine;
  codeGraph?: CodeGraph;
}

export const TIMPS_SYSTEM_PROMPT = `You are TIMPS Code — a highly capable AI coding agent running in the user's terminal.
TIMPS stands for Trustworthy Interactive Memory Partner System.

## Core Identity
- You have persistent memory across sessions (3-layer: working, episodic, semantic)
- You learn from every session — your knowledge grows over time
- You support Claude, GPT-4, Gemini, and local models (Ollama)
- You are the open-source, memory-first alternative to Claude Code

## Capabilities
Tools available: read_file, write_file, edit_file, list_directory, run_bash,
find_files, search_code, get_git_status, multi_edit, patch_file, run_tests, think

## Rules (non-negotiable)
1. ALWAYS read files before editing — never guess file contents
2. Use edit_file for surgical edits, write_file only for new files or rewrites
3. After code changes, verify: run type checks or tests if available
4. Analyze root cause before retrying on errors
5. Use think tool for non-trivial reasoning before acting
6. For greetings/questions needing no file ops: respond in text WITHOUT tools
7. Prefer non-interactive bash commands; never sudo without explicit permission
8. For multi-file changes, plan order to minimize breakage
9. When you identify TODO items in the task, list them clearly as "- [ ] item" format

## Memory Protocol
- Reference memory context when it's relevant to the task
- If you discover architectural decisions, patterns, or conventions: state them explicitly
- If you find bugs/errors, explain the root cause clearly (this gets saved to memory)
- End complex tasks with: "Remembered: [what was learned]"

## Output Style
- Be direct and concise — code over prose
- Show results, not plans
- Use tool results to confirm changes, not just say "done"
`;

// Compact prompt for local/small models — avoids overwhelming 7B models
const LOCAL_SYSTEM_PROMPT = `You are TIMPS Code, a helpful AI coding assistant in the user's terminal.

## Rules
- For greetings and simple questions: reply in plain text.
- For coding tasks (create files, edit, run commands): use tools directly.
- NEVER show code in markdown blocks — always use the write_file tool.

## Available tools (use XML format):
<tool_call>
<name>write_file</name>
<arguments>{"path": "filename", "content": "file content here"}</arguments>
</tool_call>

<tool_call>
<name>read_file</name>
<arguments>{"path": "filename"}</arguments>
</tool_call>

<tool_call>
<name>run_bash</name>
<arguments>{"command": "ls -la"}</arguments>
</tool_call>

<tool_call>
<name>edit_file</name>
<arguments>{"path": "filename", "oldString": "text to replace", "newString": "replacement text"}</arguments>
</tool_call>

<tool_call>
<name>think</name>
<arguments>{"thought": "your reasoning here"}</arguments>
</tool_call>

## When creating files:
- Use write_file tool to create the file directly
- Do NOT display code — just create it
- Example: User asks to create hello.py
  → Call write_file immediately with the content
`;

export class Agent {
  private provider: ModelProvider;
  private cwd: string;
  private memory: Memory;
  private permissions: Permissions;
  private snapshots: SnapshotManager;
  private messages: Message[] = [];
  private totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  private maxTurns: number;
  private maxCorrections: number;
  private maxContextTokens: number;
  private customInstructions: string;
  private autoCorrect: boolean;
  private techStack?: import('../config/types.js').TechStack;
  private teamMemory?: TeamMemory;
  private todoStore: TodoStore | null = null;
  private abortController: AbortController | null = null;
  private branchName?: string;
  private pendingMergeTarget?: string;
  private pluginManager?: PluginManager;

  // New intelligence layers
  private sessionBridge?: SessionBridge;
  private riskEngine?: RiskEngine;
  private contextOrchestrator?: ContextOrchestrator;
  private selfImproving?: SelfImprovingAgent;
  private durableJob?: DurableJobEngine;
  private codeGraph?: CodeGraph;

  constructor(opts: AgentOptions) {
    this.provider = opts.provider;
    this.cwd = opts.cwd;
    this.memory = opts.memory;
    this.permissions = opts.permissions;
    this.snapshots = opts.snapshots;
    this.maxTurns = opts.maxTurns ?? 25;
    this.maxCorrections = opts.maxCorrections ?? 3;
    this.maxContextTokens = opts.maxContextTokens ?? 100000;
    this.customInstructions = opts.customInstructions ?? '';
    this.autoCorrect = opts.autoCorrect ?? true;
    this.techStack = opts.techStack;
    this.teamMemory = opts.teamMemory;
    this.branchName = opts.branchName;
    this.pluginManager = opts.pluginManager;
    // Wire in intelligence layers
    this.sessionBridge = opts.sessionBridge;
    this.riskEngine = opts.riskEngine;
    this.contextOrchestrator = opts.contextOrchestrator;
    this.selfImproving = opts.selfImproving;
    this.durableJob = opts.durableJob;
    this.codeGraph = opts.codeGraph;
    this.branchName = opts.branchName;
    this.pluginManager = opts.pluginManager;

    // Initialize with system prompt
    this.messages.push({ role: 'system', content: this.buildSystemPrompt() });
  }

  /** Whether the provider is a local/small model that needs a simpler prompt */
  private get isLocalModel(): boolean {
    return this.provider.name === 'ollama' || (this.provider.name as string) === 'opencode';
  }

  private buildSystemPrompt(): string {
    // Use compact prompt for local/small models to avoid overwhelming them
    if (this.isLocalModel) {
      let prompt = LOCAL_SYSTEM_PROMPT;
      if (this.customInstructions) {
        prompt += `\nUser instructions: ${this.customInstructions}\n`;
      }
      prompt += `\nWorking directory: ${this.cwd}\n`;
      return prompt;
    }

    let prompt = TIMPS_SYSTEM_PROMPT;

    // ── Memory injection ──
    const memCtx = this.memory.getContextString();
    if (memCtx) {
      prompt += `\n## Memory Context\n${memCtx}\n`;
    }

    // ── Team memory injection ──
    if (this.teamMemory) {
      try {
        const teamCtx = this.teamMemory.getContextString();
        if (teamCtx) {
          prompt += `\n## Team Knowledge\n${teamCtx}\n`;
        }
      } catch { /* team memory might be locked */ }
    }

    // ── Tech stack enforcement ──
    if (this.techStack) {
      const ts = this.techStack;
      prompt += '\n## TECH STACK (STRICT — always follow these)\n';
      if (ts.languages.length > 0) prompt += `Languages: ${ts.languages.join(', ')}\n`;
      if (ts.frameworks.length > 0) prompt += `Frameworks: ${ts.frameworks.join(', ')}\n`;
      if (ts.libraries.length > 0) prompt += `Libraries: ${ts.libraries.join(', ')}\n`;
      if (ts.patterns.length > 0) prompt += `Patterns: ${ts.patterns.join(', ')}\n`;
      if (ts.rules.length > 0) {
        prompt += 'Rules:\n';
        for (const r of ts.rules) prompt += `- ${r}\n`;
      }
    }

    // ── Custom instructions ──
    if (this.customInstructions) {
      prompt += `\n## User Instructions\n${this.customInstructions}\n`;
    }

    // Add skill context from SkillGalaxy
    const skillCtx = getSkillContext();
    if (skillCtx) {
      prompt += `\n${skillCtx}\n`;
    }

    // ── Session Bridge: cross-session persistent context ──
    if (this.sessionBridge) {
      try {
        const bridgeCtx = this.sessionBridge.getCachedContext();
        if (bridgeCtx) {
          const { projectProfile, coldStartHints } = bridgeCtx;
          if (projectProfile) {
            prompt += '\n## Project Profile (from previous sessions)\n';
            if (projectProfile.conventions.length > 0) {
              prompt += `Conventions: ${projectProfile.conventions.slice(0, 5).join(', ')}\n`;
            }
            if (projectProfile.techStack.length > 0) {
              prompt += `Tech stack: ${projectProfile.techStack.join(', ')}\n`;
            }
            if (projectProfile.knownIssues.length > 0) {
              prompt += `Known issues: ${projectProfile.knownIssues.slice(0, 3).join('; ')}\n`;
            }
            if (projectProfile.keyDecisions.length > 0) {
              prompt += `Key decisions: ${projectProfile.keyDecisions.slice(0, 3).join('; ')}\n`;
            }
          }
          if (coldStartHints.length > 0) {
            prompt += `\nQuick context: ${coldStartHints.slice(0, 3).join(' | ')}\n`;
          }
        }
      } catch { /* never fail on bridge errors */ }
    }

    // ── Self-improving: inject learned behaviors ──
    if (this.selfImproving) {
      const learnedBehaviors = this.selfImproving.formatForSystemPrompt();
      if (learnedBehaviors) {
        prompt += `\n${learnedBehaviors}\n`;
      }
    }

    // ── Code graph summary ──
    if (this.codeGraph) {
      try {
        const graphSummary = this.codeGraph.summarize();
        if (graphSummary && graphSummary !== 'Code graph not built yet') {
          prompt += `\n## Codebase Structure\n${graphSummary}\n`;
        }
      } catch { /* ignore */ }
    }

    prompt += `\nWorking directory: ${this.cwd}\n`;
    return prompt;
  }

  // ═══════════════════════════════════════
  // Architect Planning Mode
  // ═══════════════════════════════════════

  async *plan(userMessage: string): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();
    const planPrompt = `You are the Lead Architect. The user asks: "${userMessage}".
Do not write implementation code. Do not use tools.
Draft a concise, bulleted implementation plan. Break the problem into 3-5 high-level steps.
End your response with a confirmation question.`;
    
    const messages: Message[] = [{ role: 'system', content: planPrompt }, { role: 'user', content: userMessage }];
    let fullText = '';
    
    try {
      for await (const event of this.provider.stream(messages, [], { signal: this.abortController.signal })) {
        if (event.type === 'text') {
          fullText += event.content;
          yield { type: 'text', content: event.content };
        }
      }
    } catch (err) {
      yield { type: 'error', message: `Planning failed: ${(err as Error).message}` };
    }
  }

  // ═══════════════════════════════════════
  // Main execution loop
  // ═══════════════════════════════════════

  private pendingUserAnswerResolver: ((ans: string) => void) | null = null;

  public answerUserQuestion(answer: string) {
    if (this.pendingUserAnswerResolver) {
      this.pendingUserAnswerResolver(answer);
      this.pendingUserAnswerResolver = null;
    }
  }

  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();

    // ── Pre-flight: self-improvement check ──
    if (this.selfImproving) {
      const taskType = this.contextOrchestrator?.detectTaskType(userMessage) ?? 'general';
      const preflight = this.selfImproving.preflightCheck(userMessage, taskType, []);
      for (const warning of preflight.warnings) {
        yield { type: 'text', content: `\n> ⚠️ ${warning}\n` };
      }
    }

    // ── Pre-flight: EchoForge intelligence injection ──
    try {
      const echoResult = await injectEchoContext(this.memory);
      if (echoResult.hasHighRisk) {
        for (const w of echoResult.warnings.filter(x => x.riskLevel === 'high')) {
          yield { type: 'text', content: `\n> 🔮 **Echo Alert** [${w.domain}]: ${w.message}\n` };
        }
      }
      if (echoResult.promptFragment) {
        // Patch the system message with live echo context
        const sysIdx = this.messages.findIndex(m => m.role === 'system');
        if (sysIdx !== -1) {
          this.messages[sysIdx] = {
            ...this.messages[sysIdx]!,
            content: this.messages[sysIdx]!.content + echoResult.promptFragment,
          };
        }
      }
    } catch { /* echo is best-effort */ }

    // ── Pre-flight: QISRD resonance intelligence injection ──
    try {
      const qisrdResult = injectQISRDContext(this.memory);
      if (qisrdResult.hasIssue) {
        for (const w of qisrdResult.warnings) {
          yield { type: 'text', content: `\n> 🔮 **QISRD Alert**: ${w}\n` };
        }
      }
      if (qisrdResult.promptFragment) {
        const sysIdx = this.messages.findIndex(m => m.role === 'system');
        if (sysIdx !== -1) {
          this.messages[sysIdx] = {
            ...this.messages[sysIdx]!,
            content: this.messages[sysIdx]!.content + qisrdResult.promptFragment,
          };
        }
      }
    } catch { /* qisrd is best-effort */ }

    // Add user message
    this.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });

    // Update working memory
    this.memory.setGoal(userMessage);

    // Context compaction check — use ContextOrchestrator if available
    const contextSize = this.estimateContextSize();
    if (contextSize > this.maxContextTokens) {
      if (this.contextOrchestrator) {
        const taskType = this.contextOrchestrator.detectTaskType(userMessage);
        const { messages: optimized } = this.contextOrchestrator.selectMessages(
          this.messages,
          userMessage,
          (text: string) => estimateTokens(text)
        );
        // Keep system prompt + optimized messages
        const systemMsg = this.messages.find(m => m.role === 'system');
        this.messages = systemMsg ? [systemMsg, ...optimized.filter(m => m.role !== 'system')] : optimized;
        yield { type: 'text', content: '\n[Context optimized by ContextOrchestrator]\n' };
      } else {
        yield* this.compactContext();
      }
    }

    // Agent loop: stream → collect tool calls → execute → repeat
    let turns = 0;
    while (turns < this.maxTurns) {
      turns++;
      const tools = [
        ...getToolDefinitions(this.isLocalModel),
        ...(this.pluginManager?.getPluginToolDefs() ?? []),
      ];
      const toolCalls: ToolCall[] = [];
      let fullText = '';
      let currentToolArgs = new Map<string, string>();
      let currentToolNames = new Map<string, string>();
      let usage: TokenUsage | undefined;
      let hasToolCalls = false;

      // Stream from model
      try {
        for await (const event of this.provider.stream(
          this.messages, tools, { signal: this.abortController.signal }
        )) {
          switch (event.type) {
            case 'text':
              fullText += event.content;
              yield { type: 'text', content: event.content };
              break;

            case 'thinking':
              yield { type: 'thinking', content: event.content };
              break;

            case 'tool_start':
              hasToolCalls = true;
              currentToolArgs.set(event.id, '');
              currentToolNames.set(event.id, event.name);
              break;

            case 'tool_delta':
              currentToolArgs.set(event.id,
                (currentToolArgs.get(event.id) || '') + event.argumentsChunk
              );
              break;

            case 'tool_end': {
              const argsStr = currentToolArgs.get(event.id) || '{}';
              let args: Record<string, unknown>;
              try { args = JSON.parse(argsStr); } catch { args = { raw: argsStr }; }
              
              const toolName = currentToolNames.get(event.id) || 'unknown';
              toolCalls.push({ id: event.id, name: toolName, arguments: args });
              break;
            }

            case 'done':
              usage = event.usage;
              if (usage) {
                this.totalUsage.inputTokens += usage.inputTokens;
                this.totalUsage.outputTokens += usage.outputTokens;
                // Track running cost
                const turnCost = estimateCost(this.provider.model, usage.inputTokens, usage.outputTokens);
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
          return;
        }
        // NEVER silently downgrade or switch models — surface errors explicitly to user
        yield { type: 'error', message: `Provider error (${this.provider.name}/${this.provider.model}): ${(err as Error).message}` };
        yield { type: 'error', message: 'Use /provider to switch or /model to try a different model.' };
        return;
      }

      // Save assistant message
      const assistantMsg: Message = {
        role: 'assistant',
        content: fullText,
        timestamp: Date.now(),
      };
      if (toolCalls.length > 0) assistantMsg.toolCalls = toolCalls;
      this.messages.push(assistantMsg);

      // If no tool calls, we're done — extract memories and finish
      if (!hasToolCalls || toolCalls.length === 0) {
        if (fullText) {
          this.memory.extractFacts(userMessage, fullText);
          const saved = await this.saveMemoryFromSession(userMessage, fullText);
          if (saved) yield { type: 'memory_saved', summary: saved };

          // ── Save to session bridge for future sessions ──
          if (this.sessionBridge) {
            try {
              this.sessionBridge.saveSession({
                duration: Date.now(),
                messageCount: this.messages.length,
                tasksCompleted: [userMessage.slice(0, 80)],
                filesChanged: [],
                keyDecisions: [],
                conventions: [],
                knownIssues: [],
                techStack: [],
                activeGoal: userMessage.slice(0, 80),
                outcome: 'completed',
              });
            } catch { /* never fail session save */ }
          }
        }
        yield { type: 'done', usage: this.totalUsage };
        return;
      }

      // Execute tool calls (parallel for read-only, sequential for mutating)
      yield* this.executeToolCalls(toolCalls);
    }

    yield { type: 'error', message: `Max turns (${this.maxTurns}) reached` };
    yield { type: 'done', usage: this.totalUsage };
  }

  // ═══════════════════════════════════════
  // Tool execution with permissions & snapshots
  // ═══════════════════════════════════════

  private async *executeToolCalls(toolCalls: ToolCall[]): AsyncGenerator<AgentEvent> {
    for (const tc of toolCalls) {
      // Intercept the ask_user tool manually
      if (tc.name === 'ask_user') {
        const question = String(tc.arguments.question || 'Provide input:');
        yield { type: 'ask_user', question, callId: tc.id };
        const answer = await new Promise<string>(resolve => {
          this.pendingUserAnswerResolver = resolve;
        });
        this.messages.push({
          role: 'tool',
          content: answer,
          toolCallId: tc.id,
          name: tc.name,
        });
        continue;
      }

      const tool = getTool(tc.name) ?? this.pluginManager?.getPluginTool(tc.name);
      if (!tool) {
        this.messages.push({
          role: 'tool', content: `Unknown tool: ${tc.name}`, toolCallId: tc.id, name: tc.name,
        });
        yield { type: 'tool_result', tool: tc.name, result: `Unknown tool: ${tc.name}`, success: false };
        continue;
      }

      // Permission check — use RiskEngine if available, else legacy permission system
      const risk = getToolRisk(tc.name);
      let allowed: boolean;

      if (this.riskEngine) {
        const assessment = this.riskEngine.assess(tc.name, tc.arguments as Record<string, unknown>);
        if (assessment.decision === 'deny') {
          const msg = `Denied (risk score ${assessment.score}): ${assessment.factors.join(', ')}`;
          this.messages.push({ role: 'tool', content: msg, toolCallId: tc.id, name: tc.name });
          yield { type: 'tool_result', tool: tc.name, result: msg, success: false };
          continue;
        }
        if (assessment.decision === 'require-approval') {
          // Fall through to legacy approval check
          allowed = !this.permissions.requiresApproval(tc.name, tc.arguments as Record<string, unknown>);
        } else {
          // auto-approve
          allowed = true;
        }
      } else {
        allowed = !this.permissions.requiresApproval(tc.name, tc.arguments as Record<string, unknown>);
      }

      if (!allowed) {
        const msg = 'Permission denied by user';
        this.messages.push({ role: 'tool', content: msg, toolCallId: tc.id, name: tc.name });
        yield { type: 'tool_result', tool: tc.name, result: msg, success: false };
        continue;
      }

      // Snapshot before file modifications
      if (risk !== 'low' && tc.arguments.path) {
        const fp = String(tc.arguments.path);
        try {
          const snapId = this.snapshots.capture([fp], `Before ${tc.name}: ${fp}`);
          if (snapId) {
            yield { type: 'snapshot_created', id: snapId, fileCount: 1 };
          }
        } catch { /* ignore snapshot errors */ }
      }

      yield { type: 'tool_start', tool: tc.name, args: tc.arguments };

      // Execute with retry + exponential backoff for transient failures
      const TRANSIENT_ERRORS = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'fetch failed', 'AbortError', 'timeout'];
      const MAX_RETRIES = 3;
      let result: ToolExecResult | null = null;
      let lastError = '';
      const execStart = Date.now();

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          result = await tool.execute(tc.arguments, this.cwd);
        } catch (err) {
          result = { content: `Tool error: ${(err as Error).message}`, isError: true };
        }

        // If success or non-transient error, stop retrying
        if (!result.isError || !TRANSIENT_ERRORS.some(e => result!.content.includes(e))) {
          break;
        }

        // Transient error — retry with backoff
        lastError = result.content;
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          yield { type: 'selfcorrect', attempt: attempt + 1, error: `Transient error, retrying in ${delay / 1000}s: ${lastError.slice(0, 80)}` };
          await new Promise(r => setTimeout(r, delay));
          result = null; // reset for next attempt
        }
      }

      if (!result) {
        result = { content: `Failed after ${MAX_RETRIES} retries: ${lastError}`, isError: true };
      }

      const durationMs = Date.now() - execStart;

      // Track files in working memory
      if (result.filesModified) {
        for (const f of result.filesModified) this.memory.trackFile(f);
      }
      if (tc.arguments.path) this.memory.trackFile(String(tc.arguments.path));

      // Track errors
      if (result.isError) {
        this.memory.trackError(`${tc.name}: ${result.content.slice(0, 200)}`);
      } else {
        await this.forgeSuccessfulToolResult(tc.name, result.content);
      }

      // Add tool result to conversation
      this.messages.push({
        role: 'tool', content: result.content, toolCallId: tc.id, name: tc.name,
      });

      yield { type: 'tool_result', tool: tc.name, result: result.content, success: !result.isError, durationMs };

      // Self-correction: if tool failed and auto-correct is on
      if (result.isError && this.autoCorrect) {
        // Record the mistake for future learning
        if (this.selfImproving) {
          const taskType = this.contextOrchestrator?.detectTaskType(
            this.messages.find(m => m.role === 'user')?.content as string ?? ''
          ) ?? 'general';
          this.selfImproving.recordMistake({
            category: 'tool-misuse',
            taskType,
            description: `${tc.name} failed: ${result.content.slice(0, 80)}`,
            context: `Tool: ${tc.name}, args: ${JSON.stringify(tc.arguments).slice(0, 100)}`,
            errorMessage: result.content.slice(0, 200),
            toolSequence: [tc.name],
          });
        }
        yield* this.attemptSelfCorrection(tc, result.content);
      }
    }
  }

  // ═══════════════════════════════════════
  // Parallel tool execution
  // ═══════════════════════════════════════

  private async executeToolsInParallel(
    toolCalls: ToolCall[],
  ): Promise<Array<{ id: string; result: string; success: boolean; tool: string; durationMs: number }>> {
    const readOnlyTools = new Set(['read_file', 'list_directory', 'find_files', 'search_code', 'think']);

    // Split into parallel (read-only) and sequential (mutating) groups
    const parallelCalls = toolCalls.filter(tc => readOnlyTools.has(tc.name));
    const sequentialCalls = toolCalls.filter(tc => !readOnlyTools.has(tc.name));

    const results: Array<{ id: string; result: string; success: boolean; tool: string; durationMs: number }> = [];

    // Run read-only tools in parallel
    if (parallelCalls.length > 1) {
      const parallelResults = await Promise.all(
        parallelCalls.map(tc => this.executeSingleTool(tc))
      );
      results.push(...parallelResults);
    } else {
      for (const tc of parallelCalls) {
        results.push(await this.executeSingleTool(tc));
      }
    }

    // Run mutating tools sequentially (order matters)
    for (const tc of sequentialCalls) {
      results.push(await this.executeSingleTool(tc));
    }

    return results;
  }

  private async executeSingleTool(tc: ToolCall): Promise<{
    id: string; result: string; success: boolean; tool: string; durationMs: number;
  }> {
    const start = Date.now();
    const registered = getTool(tc.name);
    if (!registered) {
      return { id: tc.id, result: `Unknown tool: ${tc.name}`, success: false, tool: tc.name, durationMs: 0 };
    }

    // Permission check
    const risk = getToolRisk(tc.name);
    const allowed = !this.permissions.requiresApproval(tc.name, tc.arguments as Record<string, unknown>);
    if (!allowed) {
      return { id: tc.id, result: `Permission denied for ${tc.name}`, success: false, tool: tc.name, durationMs: 0 };
    }

    const res = await registered.execute(tc.arguments, this.cwd);
    const durationMs = Date.now() - start;

    // Track file changes for memory and snapshots
    if (res.filesModified && res.filesModified.length > 0) {
      for (const f of res.filesModified) this.memory.trackFile(f);
    }

    if (!res.isError) await this.forgeSuccessfulToolResult(tc.name, res.content);

    return { id: tc.id, result: res.content, success: !res.isError, tool: tc.name, durationMs };
  }

  private async forgeSuccessfulToolResult(toolName: string, content: string): Promise<void> {
    try {
      const pf = await getProvenForge();
      if (pf) {
        await pf.forge(
          { content, tags: ['timps-code', 'tool-result', toolName], branch: this.branchName },
          'timps-code-tool-' + toolName,
          this.branchName
        );
      }
    } catch {
      // Optional TIMPS core integration should never break the coding agent.
    }
  }

  // ═══════════════════════════════════════
  // Memory auto-save from agent output
  // ═══════════════════════════════════════

  private async saveMemoryFromSession(userMessage: string, assistantResponse: string): Promise<string | null> {
    // Extract facts from the conversation
    this.memory.extractFacts(userMessage, assistantResponse);

    // Extract todos from agent output
    if (this.todoStore) {
      this.todoStore.extractFromText(assistantResponse);
    }

    // If response mentions key decisions, create a summary
    const keyPhrases = [
      /decided to use\s+([^.]{10,50})/i,
      /implemented\s+([^.]{10,50})/i,
      /fixed\s+([^.]{10,50})/i,
      /the (architecture|pattern|convention|approach) is\s+([^.]{10,60})/i,
      /remembered?:\s*([^.]{10,80})/i,
    ];

    for (const re of keyPhrases) {
      const m = assistantResponse.match(re);
      if (m) {
        const fact = m[0].trim();
        this.memory.storeFact(fact, 'architecture');
        
        // Forge key decisions into ProvenForge with branch context
        try {
          const pf = await getProvenForge();
          if (pf) {
            await pf.forge(
              { content: fact, tags: ['decision', 'architecture', 'key-insight'], branch: this.branchName },
              'timps-code-decision',
              this.branchName
            );
          }
        } catch { /* best-effort */ }
        
        return fact;
      }
    }

    return null;
  }

  // ═══════════════════════════════════════
  // Self-correction
  // ═══════════════════════════════════════

  private async *attemptSelfCorrection(
    failedCall: ToolCall,
    errorMsg: string,
  ): AsyncGenerator<AgentEvent> {
    // Only correct specific recoverable errors
    const recoverable = [
      'oldString not found',
      'No such file',
      'ENOENT',
      'Exit 1',
      'Exit 2',
      'found 0 times',
      'must be unique',
    ];
    if (!recoverable.some(r => errorMsg.includes(r))) return;

    yield { type: 'selfcorrect', attempt: 1, error: errorMsg };

    this.messages.push({
      role: 'user',
      content: `The previous action failed with this error:\n\n<error>\n${errorMsg.slice(0, 300)}\n</error>\n\nThink through:\n1. What exactly went wrong?\n2. What assumptions were incorrect?\n3. How to fix it definitively?\n\nThen take the corrective action.` +
        (failedCall.name === 'edit_file' ? '\nRe-read the file to get the correct content before editing.' : ''),
    });
  }

  // ═══════════════════════════════════════
  // Context compaction — proactive summarization
  // ═══════════════════════════════════════

  public async *compactContext(): AsyncGenerator<AgentEvent> {
    if (this.messages.length < 10) return;

    const nonSystemMessages = this.messages.filter(m => m.role !== 'system');
    if (nonSystemMessages.length < 6) return;

    // Save full history to disk first — NEVER silently destroy context
    try {
      const historyDir = path.join(os.homedir(), '.timps', 'history');
      fs.mkdirSync(historyDir, { recursive: true });
      const histFile = path.join(historyDir, `compacted_${Date.now()}.json`);
      fs.writeFileSync(histFile, JSON.stringify(nonSystemMessages.slice(0, -4), null, 2), 'utf-8');
    } catch { /* best effort */ }

    // Build a summary prompt
    const historyText = nonSystemMessages
      .slice(0, -4) // keep last 4 messages fresh
      .map(m => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content.slice(0, 500) : '[tool]'}`)
      .join('\n---\n');

    const summaryPrompt = `Summarize this conversation compactly for context preservation.
Focus on: decisions made, files changed, problems solved, current state.
Keep under 300 words.

CONVERSATION:
${historyText}`;

    // Quick summary call
    const summaryMessages: Message[] = [
      { role: 'user', content: summaryPrompt }
    ];

    let summary = '';
    for await (const event of this.provider.stream(summaryMessages, [], { maxTokens: 400 })) {
      if (event.type === 'text') summary += event.content;
    }

    // Store episode
    const filesChanged = [...new Set(
      nonSystemMessages
        .flatMap(m => {
          const content = typeof m.content === 'string' ? m.content : '';
          const matches = [...content.matchAll(/(?:read|edit|write|wrote|created|modified)\s+([\w./\-]+\.[a-z]{1,6})/g)];
          return matches.map(match => match[1]);
        })
    )];

    this.memory.storeEpisode({
      timestamp: Date.now(),
      summary,
      filesChanged,
      toolsUsed: [],
      outcome: 'success',
    });

    const beforeTokens = this.estimateContextTokens();

    // Trim to last 4 messages + system + fresh summary
    const freshMessages = this.messages.filter(m => m.role === 'system');
    freshMessages.push({
      role: 'user',
      content: `[Conversation summary from previous context]\n${summary}`,
    });
    freshMessages.push({
      role: 'assistant',
      content: 'Understood. Continuing with full context from the summary above.',
    });

    // Keep last 4 real messages
    const recent = nonSystemMessages.slice(-4);
    this.messages = [...freshMessages, ...recent];

    const afterTokens = this.estimateContextTokens();
    yield { type: 'context_compacted', before: beforeTokens, after: afterTokens };
  }

  private estimateContextTokens(): number {
    return this.messages.reduce((acc, m) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return acc + Math.round(content.length / 4);
    }, 0);
  }

  // ═══════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════

  abort(): void {
    this.abortController?.abort();
  }

  getUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  popLastMessage(): void {
    // Remove the last non-system message (one exchange = user + assistant pair)
    if (this.messages.length > 1) {
      this.messages.pop();
    }
  }

  clearHistory(): void {
    const sysMsg = this.messages[0];
    this.messages = [sysMsg];
    this.totalUsage = { inputTokens: 0, outputTokens: 0 };
  }

  updateSystemPrompt(): void {
    this.messages[0] = { role: 'system', content: this.buildSystemPrompt() };
  }

  switchProvider(provider: ModelProvider): void {
    this.provider = provider;
  }

  setTechStack(techStack: import('../config/types.js').TechStack | undefined): void {
    this.techStack = techStack;
    this.updateSystemPrompt();
  }

  setTeamMemory(teamMemory: TeamMemory | undefined): void {
    this.teamMemory = teamMemory;
    this.updateSystemPrompt();
  }

  setTodoStore(store: TodoStore): void {
    this.todoStore = store;
  }

  getTeamMemory(): TeamMemory | undefined {
    return this.teamMemory;
  }

  getCwd(): string {
    return this.cwd;
  }

  // ═══════════════════════════════════════
  // Session persistence — never lose history
  // ═══════════════════════════════════════

  setPendingMergeTarget(target: string): void {
    this.pendingMergeTarget = target;
    if (this.branchName && this.pendingMergeTarget) {
       console.log(`[ProvenForge] Initiating merge: ${this.pendingMergeTarget} -> ${this.branchName}`);
       getProvenForge().then(pf => {
         if (pf) pf.safeMerge(this.pendingMergeTarget!, this.branchName!, true).catch(()=>{});
       });
    }
  }

  saveSession(sessionDir: string): void {
    fs.mkdirSync(sessionDir, { recursive: true });
    const sessionData = {
      messages: this.messages,
      totalUsage: this.totalUsage,
      timestamp: Date.now(),
      model: this.provider.model,
      provider: this.provider.name,
    };
    fs.writeFileSync(
      path.join(sessionDir, 'latest.json'),
      JSON.stringify(sessionData, null, 2),
      'utf-8',
    );
  }

  restoreSession(sessionDir: string): boolean {
    const file = path.join(sessionDir, 'latest.json');
    if (!fs.existsSync(file)) return false;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (!data.messages || !Array.isArray(data.messages)) return false;
      // Only restore if session is less than 24h old
      if (Date.now() - (data.timestamp || 0) > 24 * 60 * 60 * 1000) return false;
      this.messages = data.messages;
      if (data.totalUsage) this.totalUsage = data.totalUsage;
      // Refresh system prompt with latest memory/skills
      this.messages[0] = { role: 'system', content: this.buildSystemPrompt() };
      return true;
    } catch { return false; }
  }

  hasResumableSession(sessionDir: string): { exists: boolean; messageCount: number; age: string } {
    const file = path.join(sessionDir, 'latest.json');
    if (!fs.existsSync(file)) return { exists: false, messageCount: 0, age: '' };
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (!data.messages || Date.now() - (data.timestamp || 0) > 24 * 60 * 60 * 1000) {
        return { exists: false, messageCount: 0, age: '' };
      }
      const ageSecs = Math.floor((Date.now() - data.timestamp) / 1000);
      let age: string;
      if (ageSecs < 60) age = `${ageSecs}s ago`;
      else if (ageSecs < 3600) age = `${Math.floor(ageSecs / 60)}m ago`;
      else age = `${Math.floor(ageSecs / 3600)}h ago`;
      return { exists: true, messageCount: data.messages.length, age };
    } catch { return { exists: false, messageCount: 0, age: '' }; }
  }

  private estimateContextSize(): number {
    return this.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  }

  async saveEpisode(outcome: 'success' | 'partial' | 'failed'): Promise<void> {
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

    const summary = userMsgs.map(m => m.content.slice(0, 100)).join(' → ');

    this.memory.storeEpisode({
      timestamp: Date.now(),
      summary,
      filesChanged: [...filesChanged],
      toolsUsed: [...toolsUsed],
      outcome,
    });

    // Sync to team memory if active
    if (this.teamMemory) {
      try {
        const store = this.teamMemory as TeamMemory;
        const members = store.getMembers();
        // Find current member name from config
        const memberName = members[members.length - 1] || 'unknown';
        store.addSession({
          memberName,
          timestamp: Date.now(),
          summary,
          filesChanged: [...filesChanged],
          toolsUsed: [...toolsUsed],
          techStack: this.techStack,
        });
      } catch { /* best effort */ }
    }
  }
}
