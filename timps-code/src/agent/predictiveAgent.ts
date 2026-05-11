// ── TIMPS Self-Improving Agent Loop v2 ──
// Observe → Reason → Predict → Act → Verify → Consolidate

import type {
  Message, ModelProvider, ToolCall, ToolDefinition,
  StreamEvent, AgentEvent, TokenUsage,
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

const MAX_RETRIES = 3;
const CONFIDENCE_THRESHOLD = 0.7;

interface AgentTurn {
  observe: string;
  reason: string;
  predict: string[];
  act: string;
  verify: 'pass' | 'fail' | 'skip';
  errors: string[];
}

export class PredictiveAgent {
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
  private turnHistory: AgentTurn[] = [];
  private isLocalModel: boolean;
  private costPerTurn: number = 0;
  private selfDevMode: boolean = false;

  constructor(
    private agentOpts: {
      provider: ModelProvider;
      cwd: string;
      memory: Memory;
      permissions: Permissions;
      snapshots: SnapshotManager;
      maxTurns?: number;
      maxCorrections?: number;
      maxContextTokens?: number;
      customInstructions?: string;
      autoCorrect?: boolean;
      techStack?: import('../config/types.js').TechStack;
      teamMemory?: TeamMemory;
      branchName?: string;
      pluginManager?: PluginManager;
    }
  ) {
    this.provider = agentOpts.provider;
    this.cwd = agentOpts.cwd;
    this.memory = agentOpts.memory;
    this.permissions = agentOpts.permissions;
    this.snapshots = agentOpts.snapshots;
    this.maxTurns = agentOpts.maxTurns ?? 25;
    this.maxCorrections = agentOpts.maxCorrections ?? 3;
    this.maxContextTokens = agentOpts.maxContextTokens ?? 100000;
    this.customInstructions = agentOpts.customInstructions ?? '';
    this.autoCorrect = agentOpts.autoCorrect ?? true;
    this.techStack = agentOpts.techStack;
    this.teamMemory = agentOpts.teamMemory;
    this.branchName = agentOpts.branchName;
    this.pluginManager = agentOpts.pluginManager;
    this.isLocalModel = agentOpts.provider.name === 'ollama';
    this.messages.push({ role: 'system', content: this.buildSystemPrompt() });
  }

  private buildSystemPrompt(): string {
    const memoryCtx = this.memory.getContextString();
    const teamCtx = this.teamMemory?.getContextString() || '';
    const skillCtx = getSkillContext();

    const basePrompt = this.isLocalModel ? this.getLocalPrompt() : this.getCloudPrompt();

    let prompt = basePrompt;
    if (memoryCtx) prompt += `\n## Memory Context\n${memoryCtx}\n`;
    if (teamCtx) prompt += `\n## Team Knowledge\n${teamCtx}\n`;
    if (skillCtx) prompt += `\n## Skills\n${skillCtx}\n`;
    if (this.techStack) prompt += `\n## Tech Stack\n${JSON.stringify(this.techStack)}\n`;
    if (this.customInstructions) prompt += `\n## Custom Instructions\n${this.customInstructions}\n`;
    prompt += `\nWorking directory: ${this.cwd}\n`;

    return prompt;
  }

  private getCloudPrompt(): string {
    return `You are TIMPS — Trustworthy Interactive Memory Partner System. A memory-first AI coding agent that learns from every session.

## Core Capabilities
- 4-layer memory: working, episodic, semantic, procedural
- 17 intelligence tools: contradiction detection, bug pattern warnings, burnout analysis, tech debt warnings
- Self-correcting: retry on errors with revised approach
- Git-style memory branching: /branch, /merge, /diff

## Rules
1. Always read files before editing — never guess
2. Use edit_file for surgical edits, write_file only for new files
3. Verify changes with tests/type checks
4. Use think tool for non-trivial reasoning
5. Reference memory context when relevant
6. End complex tasks with "Remembered: [what was learned]"
7. If confidence < 70%, ask user instead of guessing

## Intelligence Tools Auto-Activated
- Bug Pattern Prophet: warns if context matches your past bugs
- Contradiction Detector: catches if you contradict past decisions
- Tech Debt Seismograph: warns if code matches past incidents
- Burnout Seismograph: monitors your stress signals
`;
  }

  private getLocalPrompt(): string {
    return `You are TIMPS, a fast AI coding assistant.

## Response Rules
- Greetings/questions: plain text response
- Coding tasks: use tools DIRECTLY, never show code in markdown

## CRITICAL: File creation
When asked to create a file, use write_file IMMEDIATELY:
<tool_call>
<name>write_file</name>
<arguments>{"path": "file.txt", "content": "content"}</arguments>
</tool_call>
`;
  }

  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();

    this.messages.push({ role: 'user', content: userMessage, timestamp: Date.now() });
    this.memory.setGoal(userMessage);

    const contextSize = this.estimateContextTokens();
    if (contextSize > this.maxContextTokens) {
      yield* this.compactContext();
    }

    // Check bug patterns before starting
    const bugCheck = this.memory.bugPattern.warn(userMessage);
    if (bugCheck.alert) {
      yield { type: 'text', content: `⚠️ Bug Pattern Prophet: ${bugCheck.risk_level.toUpperCase()} risk — ${bugCheck.likely_bug_types.join(', ')}\n${bugCheck.suggestion}\n\n` };
    }

    // Check tech debt patterns
    const debtCheck = this.memory.techDebt.checkPattern(userMessage, 'default');
    if (debtCheck.warning) {
      yield { type: 'text', content: `⚠️ Tech Debt: ${debtCheck.risk_level} — ${debtCheck.message}\n` };
    }

    let turns = 0;
    while (turns < this.maxTurns) {
      turns++;

      const tools = [
        ...getToolDefinitions(this.isLocalModel),
        ...(this.pluginManager?.getPluginToolDefs() ?? []),
      ];

      const toolCalls: ToolCall[] = [];
      let fullText = '';
      const currentToolArgs = new Map<string, string>();
      const currentToolNames = new Map<string, string>();
      let hasToolCalls = false;

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
              currentToolArgs.set(event.id, (currentToolArgs.get(event.id) || '') + event.argumentsChunk);
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
              if (event.usage) {
                this.totalUsage.inputTokens += event.usage.inputTokens;
                this.totalUsage.outputTokens += event.usage.outputTokens;
                this.costPerTurn = estimateCost(this.provider.model, event.usage.inputTokens, event.usage.outputTokens);
                this.totalUsage.estimatedCost = (this.totalUsage.estimatedCost || 0) + this.costPerTurn;
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
        yield { type: 'error', message: `Provider error: ${(err as Error).message}` };
        return;
      }

      // Save assistant message
      const assistantMsg: Message = { role: 'assistant', content: fullText, timestamp: Date.now() };
      if (toolCalls.length > 0) assistantMsg.toolCalls = toolCalls;
      this.messages.push(assistantMsg);

      if (!hasToolCalls || toolCalls.length === 0) {
        if (fullText) {
          this.memory.extractFacts(userMessage, fullText);
          const saved = await this.saveMemoryFromSession(userMessage, fullText);
          if (saved) yield { type: 'memory_saved', summary: saved };
        }
        yield { type: 'done', usage: this.totalUsage };
        return;
      }

      // Execute tools
      yield* this.executeToolCalls(toolCalls);
    }

    yield { type: 'error', message: `Max turns (${this.maxTurns}) reached` };
    yield { type: 'done', usage: this.totalUsage };
  }

  private async *executeToolCalls(toolCalls: ToolCall[]): AsyncGenerator<AgentEvent> {
    for (const tc of toolCalls) {
      const tool = getTool(tc.name) ?? this.pluginManager?.getPluginTool(tc.name);
      if (!tool) {
        this.messages.push({ role: 'tool', content: `Unknown tool: ${tc.name}`, toolCallId: tc.id, name: tc.name });
        yield { type: 'tool_result', tool: tc.name, result: `Unknown tool: ${tc.name}`, success: false };
        continue;
      }

      const risk = getToolRisk(tc.name);
      const allowed = !this.permissions.requiresApproval(tc.name, tc.arguments as Record<string, unknown>);
      if (!allowed) {
        const msg = 'Permission denied';
        this.messages.push({ role: 'tool', content: msg, toolCallId: tc.id, name: tc.name });
        yield { type: 'tool_result', tool: tc.name, result: msg, success: false };
        continue;
      }

      if (risk !== 'low' && tc.arguments.path) {
        const snapId = this.snapshots.capture([String(tc.arguments.path)], `Before ${tc.name}`);
        if (snapId) yield { type: 'snapshot_created', id: snapId, fileCount: 1 };
      }

      yield { type: 'tool_start', tool: tc.name, args: tc.arguments };

      const TRANSIENT_ERRORS = ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'fetch failed', 'AbortError', 'timeout'];
      let result: ToolExecResult | null = null;
      let lastError = '';
      const execStart = Date.now();

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          result = await tool.execute(tc.arguments, this.cwd);
        } catch (err) {
          result = { content: `Tool error: ${(err as Error).message}`, isError: true };
        }

        if (!result.isError || !TRANSIENT_ERRORS.some(e => result!.content.includes(e))) {
          break;
        }

        lastError = result.content;
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000;
          yield { type: 'selfcorrect', attempt: attempt + 1, error: `Transient error, retrying in ${delay / 1000}s` };
          await new Promise(r => setTimeout(r, delay));
          result = null;
        }
      }

      if (!result) {
        result = { content: `Failed after ${MAX_RETRIES} retries`, isError: true };
      }

      const durationMs = Date.now() - execStart;

      if (result.filesModified) {
        for (const f of result.filesModified) this.memory.trackFile(f);
      }
      if (tc.arguments.path) this.memory.trackFile(String(tc.arguments.path));

      if (result.isError) {
        this.memory.trackError(`${tc.name}: ${result.content.slice(0, 200)}`);
      }

      this.messages.push({ role: 'tool', content: result.content, toolCallId: tc.id, name: tc.name });
      yield { type: 'tool_result', tool: tc.name, result: result.content, success: !result.isError, durationMs };

      if (result.isError && this.autoCorrect) {
        yield* this.attemptSelfCorrection(tc, result.content);
      }
    }
  }

  private async *attemptSelfCorrection(failedCall: ToolCall, errorMsg: string): AsyncGenerator<AgentEvent> {
    const recoverable = [
      'oldString not found', 'No such file', 'ENOENT', 'Exit 1', 'Exit 2',
      'found 0 times', 'must be unique',
    ];
    if (!recoverable.some(r => errorMsg.includes(r))) return;

    for (let attempt = 1; attempt <= this.maxCorrections; attempt++) {
      yield { type: 'selfcorrect', attempt, error: errorMsg };

      this.messages.push({
        role: 'user',
        content: `Error: ${errorMsg.slice(0, 300)}\n\nAttempt ${attempt}/${this.maxCorrections}. Think:\n1. What went wrong?\n2. What assumptions were incorrect?\n3. How to fix definitively?` +
          (failedCall.name === 'edit_file' ? '\nRe-read the file to get correct content.' : ''),
      });
      return;
    }
  }

  private async *compactContext(): AsyncGenerator<AgentEvent> {
    if (this.messages.length < 10) return;

    const nonSystemMessages = this.messages.filter(m => m.role !== 'system');
    if (nonSystemMessages.length < 6) return;

    try {
      const historyDir = path.join(os.homedir(), '.timps', 'history');
      fs.mkdirSync(historyDir, { recursive: true });
      fs.writeFileSync(
        path.join(historyDir, `compacted_${Date.now()}.json`),
        JSON.stringify(nonSystemMessages.slice(0, -4), null, 2),
        'utf-8'
      );
    } catch { /* best effort */ }

    const beforeTokens = this.estimateContextTokens();

    const freshMessages = this.messages.filter(m => m.role === 'system');
    freshMessages.push({
      role: 'user',
      content: `[Previous context summarized — see history file for full detail]`,
    });
    freshMessages.push({
      role: 'assistant',
      content: 'Understood. Continuing with summarized context.',
    });

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

  private async saveMemoryFromSession(userMessage: string, assistantResponse: string): Promise<string | null> {
    this.memory.extractFacts(userMessage, assistantResponse);

    if (this.todoStore) {
      this.todoStore.extractFromText(assistantResponse);
    }

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
        return fact;
      }
    }
    return null;
  }

  // Self-Dev Mode: agent can read and improve its own code
  async *selfDev(command: string): AsyncGenerator<AgentEvent> {
    if (!this.selfDevMode) {
      yield { type: 'error', message: 'Self-dev mode is disabled. Enable with --self-dev' };
      return;
    }

    const agentSourcePath = path.join(__dirname, '..', '..');
    const relevantFiles = [
      path.join(agentSourcePath, 'core', 'agent.ts'),
      path.join(agentSourcePath, 'memory', 'memory.ts'),
      path.join(agentSourcePath, 'models', 'providerMesh.ts'),
    ];

    yield { type: 'status', message: 'Self-dev: reading agent source...' };

    const context = relevantFiles
      .filter(f => fs.existsSync(f))
      .map(f => `=== ${path.relative(agentSourcePath, f)} ===\n${fs.readFileSync(f, 'utf-8').slice(0, 5000)}`)
      .join('\n\n');

    this.messages.push({
      role: 'user',
      content: `SELF-DEV MODE: ${command}\n\nAgent source:\n${context}\n\nPropose improvements or make changes.`,
    });

    for await (const event of this.run(`Self-improve: ${command}`)) {
      yield event;
    }
  }

  enableSelfDev(): void { this.selfDevMode = true; }
  disableSelfDev(): void { this.selfDevMode = false; }

  abort(): void { this.abortController?.abort(); }
  getUsage(): TokenUsage { return { ...this.totalUsage }; }
  clearHistory(): void {
    const sysMsg = this.messages[0];
    this.messages = [sysMsg];
    this.totalUsage = { inputTokens: 0, outputTokens: 0 };
  }
  switchProvider(provider: ModelProvider): void { this.provider = provider; }
  setTodoStore(store: TodoStore): void { this.todoStore = store; }

  getTurnHistory(): AgentTurn[] { return this.turnHistory; }
  getLastTurnCost(): number { return this.costPerTurn; }

  estimateConfidence(toolCall: ToolCall): number {
    const knownTools = new Set(['read_file', 'list_directory', 'find_files', 'search_code', 'git_status', 'bash']);
    if (knownTools.has(toolCall.name)) return 0.95;
    if (toolCall.name === 'edit_file' || toolCall.name === 'write_file') return 0.85;
    return 0.7;
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
  }
}