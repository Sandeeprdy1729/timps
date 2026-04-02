// ── TIMPS Code — Self-Correcting Agent ──
// Planning · Tool execution · Error recovery · Snapshot integration · Memory

import type {
  Message, ModelProvider, ToolCall, ToolDefinition,
  StreamEvent, AgentEvent, TokenUsage, PlanStep,
} from './types.js';
import { ALL_TOOLS, getTool, getToolRisk, getToolDefinitions } from './tools.js';
import type { ToolExecResult } from './tools.js';
import { SnapshotManager } from './snapshot.js';
import { Permissions } from './permissions.js';
import { Memory } from './memory.js';
import { getSkillContext } from './skills.js';
import { estimateTokens, generateId, estimateCost } from './utils.js';
import type { TeamMemory } from './teamMemory.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

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
  techStack?: import('./types.js').TechStack;
  teamMemory?: TeamMemory;
}

const SYSTEM_PROMPT = `You are TIMPS Code, an expert AI coding agent running in the user's terminal.

## Capabilities
You have tools for reading, writing, editing files, running shell commands, searching code, and git operations.
You can solve complex multi-step coding tasks autonomously.

## Rules
1. ALWAYS read files before editing them. Never guess file contents.
2. Use edit_file for surgical changes, write_file only for new files or complete rewrites.
3. After making changes, verify by running tests or type-checking if available.
4. When you encounter errors, analyze the root cause before retrying.
5. Use the think tool for complex reasoning before acting.
6. Keep explanations concise. Show what you did, not what you plan to do.
7. For bash commands, prefer non-interactive. Never use sudo without asking.
8. When multiple files need changes, plan the order to avoid breakage.
9. For casual messages, greetings, or questions that don't need file/code operations, respond naturally in text WITHOUT using any tools. Only use tools when they provide concrete value.
`;

// Compact prompt for local/small models — avoids overwhelming 7B models
const LOCAL_SYSTEM_PROMPT = `You are TIMPS Code, a friendly and capable AI coding assistant running in the user's terminal.

You help users build websites, apps, scripts, and any coding project.

## How to respond:
- If the user says hi, asks a question, or chats: respond naturally in plain text. Be friendly and helpful.
- If the user asks you to CREATE, BUILD, or WRITE code: use write_file tool to create the files.
- If the user asks you to CHANGE or FIX existing code: first use read_file, then use edit_file.
- If the user asks to RUN something: use the bash tool.

## Tool usage:
When you need to use a tool, output EXACTLY this XML format (do NOT wrap in markdown code blocks):

<tool_call>
<name>TOOL_NAME</name>
<arguments>{"param": "value"}</arguments>
</tool_call>

IMPORTANT: Output the <tool_call> tags directly. Do NOT put them inside \`\`\` code fences.

Example — creating a file:
<tool_call>
<name>write_file</name>
<arguments>{"path": "index.html", "content": "<!DOCTYPE html>\\n<html>\\n<body>Hello</body>\\n</html>"}</arguments>
</tool_call>

You can use multiple tool calls in one response. Always explain what you're doing briefly.
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
  private techStack?: import('./types.js').TechStack;
  private teamMemory?: TeamMemory;
  private abortController: AbortController | null = null;

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

    // Initialize with system prompt
    this.messages.push({ role: 'system', content: this.buildSystemPrompt() });
  }

  /** Whether the provider is a local/small model that needs a simpler prompt */
  private get isLocalModel(): boolean {
    return this.provider.name === 'ollama' || this.provider.name === 'opencode';
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

    let prompt = SYSTEM_PROMPT;
    
    // Add memory context
    const memories = this.memory.query('', 10);
    if (memories.length > 0) {
      prompt += '\n## Project Knowledge (from memory)\n';
      for (const m of memories) {
        prompt += `- ${m.content}\n`;
      }
    }

    // Add custom instructions
    if (this.customInstructions) {
      prompt += `\n## User Instructions\n${this.customInstructions}\n`;
    }

    // ── Tech Stack Enforcement (CRITICAL — must follow) ──
    if (this.techStack) {
      const ts = this.techStack;
      prompt += `\n## REQUIRED Technology Stack (MUST use these — team mandate)\n`;
      prompt += `You are working on a project with strict technology requirements. ALL code you write MUST use ONLY these technologies:\n`;
      if (ts.languages.length > 0) prompt += `**Languages:** ${ts.languages.join(', ')}\n`;
      if (ts.frameworks.length > 0) prompt += `**Frameworks:** ${ts.frameworks.join(', ')}\n`;
      if (ts.libraries.length > 0) prompt += `**Libraries:** ${ts.libraries.join(', ')}\n`;
      if (ts.patterns.length > 0) prompt += `**Architecture/Patterns:** ${ts.patterns.join(', ')}\n`;
      if (ts.rules.length > 0) {
        prompt += `**Coding Rules:**\n`;
        for (const r of ts.rules) prompt += `  - ${r}\n`;
      }
      prompt += `\nIMPORTANT: If the user asks you to write code, you MUST use the technologies listed above. `;
      prompt += `If they ask for something in a technology NOT in this list, explain the required stack and offer to implement it using the approved technologies instead.\n`;
      prompt += `When you learn something new about these technologies during the session, proactively teach the user best practices and idiomatic patterns.\n`;
    }

    // ── Team Memory (shared across all team members) ──
    if (this.teamMemory) {
      try {
        const teamCtx = this.teamMemory.getContextString();
        if (teamCtx) {
          prompt += `\n## Team Context (shared memory — all members see this)\n${teamCtx}\n`;
        }
      } catch { /* team memory might be locked */ }
    }

    // Add skill context from SkillGalaxy
    const skillCtx = getSkillContext();
    if (skillCtx) {
      prompt += `\n${skillCtx}\n`;
    }

    // Add working memory
    const working = this.memory.workingMemory;
    if (working.activeFiles.length > 0) {
      prompt += `\n## Active Files\n${working.activeFiles.join(', ')}\n`;
    }
    if (working.recentErrors.length > 0) {
      prompt += `\n## Recent Errors to Avoid\n${working.recentErrors.slice(-3).join('\n')}\n`;
    }

    // Inject discovered patterns for consistency — agent MUST reuse these
    if (working.discoveredPatterns.length > 0) {
      prompt += `\n## Established Patterns (MUST follow for consistency)\n`;
      prompt += `When creating or modifying code, follow these discovered conventions:\n`;
      for (const p of working.discoveredPatterns) {
        prompt += `- ${p}\n`;
      }
    }

    // Inject convention-type memories — project's coding standards
    const conventions = this.memory.query('convention', 20)
      .filter(m => m.type === 'convention' || m.type === 'pattern');
    if (conventions.length > 0) {
      prompt += `\n## Project Conventions\n`;
      for (const c of conventions) {
        prompt += `- ${c.content}\n`;
      }
    }

    return prompt;
  }

  // ═══════════════════════════════════════
  // Main execution loop
  // ═══════════════════════════════════════

  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    this.abortController = new AbortController();

    // Add user message
    this.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });

    // Update working memory
    this.memory.setGoal(userMessage);

    // Context compaction check
    const contextSize = this.estimateContextSize();
    if (contextSize > this.maxContextTokens) {
      yield* this.compactContext();
    }

    // Agent loop: stream → collect tool calls → execute → repeat
    let turns = 0;
    while (turns < this.maxTurns) {
      turns++;
      const tools = getToolDefinitions(this.isLocalModel);
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
        if (fullText) this.memory.extractFacts(userMessage, fullText);
        yield { type: 'done', usage: this.totalUsage };
        return;
      }

      // Execute tool calls
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
      const tool = getTool(tc.name);
      if (!tool) {
        this.messages.push({
          role: 'tool', content: `Unknown tool: ${tc.name}`, toolCallId: tc.id, name: tc.name,
        });
        yield { type: 'tool_result', tool: tc.name, result: `Unknown tool: ${tc.name}`, success: false };
        continue;
      }

      // Permission check
      const risk = getToolRisk(tc.name);
      const allowed = await this.permissions.check(tc.name, tc.arguments, risk);
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
      }

      // Add tool result to conversation
      this.messages.push({
        role: 'tool', content: result.content, toolCallId: tc.id, name: tc.name,
      });

      yield { type: 'tool_result', tool: tc.name, result: result.content, success: !result.isError, durationMs };

      // Self-correction: if tool failed and auto-correct is on
      if (result.isError && this.autoCorrect) {
        yield* this.attemptSelfCorrection(tc, result.content);
      }
    }
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

    for (let attempt = 1; attempt <= this.maxCorrections; attempt++) {
      yield { type: 'selfcorrect', attempt, error: errorMsg };

      // Inject correction hint
      this.messages.push({
        role: 'user',
        content: `The ${failedCall.name} tool failed: "${errorMsg.slice(0, 300)}". ` +
          `Please analyze the error and fix your approach. ` +
          (failedCall.name === 'edit_file' ? 'Re-read the file to get the correct content before editing.' : ''),
      });

      // Re-run one iteration (will pick up from the loop in run())
      return; // Let the main loop handle the next model call
    }
  }

  // ═══════════════════════════════════════
  // Context compaction
  // ═══════════════════════════════════════

  private async *compactContext(): AsyncGenerator<AgentEvent> {
    const before = this.estimateContextSize();

    // Keep system message and last 10 messages (not 6)
    const systemMsg = this.messages[0];
    const recent = this.messages.slice(-10);

    // Summarize middle messages
    const middle = this.messages.slice(1, -10);
    if (middle.length < 4) return; // not worth compacting

    // NEVER silently destroy context — save full history to disk first
    try {
      const historyDir = path.join(os.homedir(), '.timps', 'history');
      fs.mkdirSync(historyDir, { recursive: true });
      const histFile = path.join(historyDir, `compacted_${Date.now()}.json`);
      fs.writeFileSync(histFile, JSON.stringify(middle, null, 2), 'utf-8');
    } catch { /* best effort */ }

    const summary = this.summarizeMessages(middle);

    this.messages = [
      systemMsg,
      { role: 'user', content: `[Previous conversation summary: ${summary}]`, timestamp: Date.now() },
      ...recent,
    ];

    const after = this.estimateContextSize();
    // Explicit notification — user always knows when compaction happens
    yield { type: 'context_compacted', before, after };
  }

  private summarizeMessages(msgs: Message[]): string {
    const parts: string[] = [];
    const toolsUsed = new Set<string>();
    const filesChanged = new Set<string>();

    for (const m of msgs) {
      if (m.role === 'user') parts.push(`User asked: ${m.content.slice(0, 100)}`);
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          toolsUsed.add(tc.name);
          if (tc.arguments.path) filesChanged.add(String(tc.arguments.path));
        }
      }
    }

    let summary = parts.slice(0, 3).join('. ');
    if (toolsUsed.size > 0) summary += ` Tools used: ${[...toolsUsed].join(', ')}.`;
    if (filesChanged.size > 0) summary += ` Files: ${[...filesChanged].join(', ')}.`;
    return summary;
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

  setTechStack(techStack: import('./types.js').TechStack | undefined): void {
    this.techStack = techStack;
    this.updateSystemPrompt();
  }

  setTeamMemory(teamMemory: TeamMemory | undefined): void {
    this.teamMemory = teamMemory;
    this.updateSystemPrompt();
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
