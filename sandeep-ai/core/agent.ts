import { createModel, BaseModel } from '../models';
import { memoryIndex } from '../memory/memoryIndex';
import { getToolDefinitions, getToolByName, ToolResult } from '../tools';
import { Message, ToolCall, ToolDefinition, GenerateOptions } from '../models/baseModel';
import { config } from '../config/env';
import { toolRouter } from './toolRouter';
import { Planner } from './planner';
import { Executor } from './executor';
import { forgeLink } from './forgeLink';
import { weaveForge } from './weaveForge';
import { skillWeave } from './skillWeave';
import { atomChain } from './atomChain';
import { chronosVeil } from './chronosVeil';
import { policyMetabol } from './policyMetabol';
import { layerForge } from './layerForge';
import { echoForge } from './echoForge';

export interface AgentConfig {
  userId: number;
  projectId?: string;
  username?: string;
  systemPrompt?: string;
  maxIterations?: number;
  modelProvider?: 'openai' | 'gemini' | 'ollama' | 'openrouter';
  memoryMode?: 'persistent' | 'ephemeral';
}

export interface AgentResponse {
  content: string;
  toolResults?: ToolResult[];
  iterations: number;
  memoryStored: boolean;
  toolsActivated?: string[];
  planExecuted?: boolean;
}

const DEFAULT_SYSTEM_PROMPT = `You are TIMPs — a persistent cognitive partner with 18 specialized intelligence tools.

TOOL REFERENCE:
1. temporal_mirror — record/reflect behavioral patterns over time
2. regret_oracle — warn before repeating past regretted decisions
3. living_manifesto — derive actual values from behavior, not stated beliefs
4. burnout_seismograph — detect burnout 6 weeks early vs personal baseline
5. argument_dna_mapper — detect contradictions against past stated positions
6. dead_reckoning — simulate future trajectories from decision history
7. skill_shadow — coach using the user's own workflow patterns
8. curriculum_architect — personalized learning plans from actual retention data
9. tech_debt_seismograph — warn when code matches past incident patterns
10. bug_pattern_prophet — detect personal bug-writing pattern triggers
11. api_archaeologist — store and retrieve undocumented API quirks
12. codebase_anthropologist — preserve codebase cultural intelligence
13. institutional_memory — preserve decision rationale from people who leave
14. chemistry_engine — predict person-to-person working compatibility
15. meeting_ghost — extract and track meeting commitments
16. collective_wisdom — anonymized cross-user decision intelligence
17. relationship_intelligence — track relationship health and detect drift
18. curate_tier — agent-native hierarchical curation: organizes memories into raw/episodic/semantic tiers with adaptive gating

STANDARD TOOLS: file_operations, web_search, web_fetch

RULES:
- When ACTIVE TOOL DIRECTIVES appear below, execute them FIRST before responding
- Always pass user_id to every tool call
- When tools return warnings (contradictions, burnout risk, regrets), surface them explicitly
- After each conversation, use temporal_mirror(record) to log behavioral signals`;

export class Agent {
  private userId: number;
  private projectId: string;
  private memoryMode: 'persistent' | 'ephemeral';
  private username?: string;
  private systemPrompt: string;
  private model: BaseModel;
  private maxIterations: number;
  private allToolDefinitions: ToolDefinition[];
  private planner: Planner;
  private executor: Executor;

  constructor(agentConfig: AgentConfig) {
    this.userId = agentConfig.userId;
    this.projectId = agentConfig.projectId || 'default';
    this.memoryMode = agentConfig.memoryMode || 'persistent';
    this.username = agentConfig.username;
    this.systemPrompt = agentConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.model = createModel(agentConfig.modelProvider || (config.models.defaultProvider as any));
    this.maxIterations = agentConfig.maxIterations || 15;
    this.planner = new Planner();
    this.executor = new Executor();

    // Initialize ForgeLink module registry (idempotent)
    if (forgeLink.isEnabled() || process.env.ENABLE_FORGELINK !== 'false') {
      forgeLink.registerModules();
    }

    const internalTools = getToolDefinitions();
    this.allToolDefinitions = internalTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async run(userMessage: string): Promise<AgentResponse> {
    memoryIndex.addToShortTerm(this.userId, this.projectId, {
      role: 'user',
      content: userMessage,
    });

    // ── Step 1: Route — decide which tools are relevant ──────────────────────
    const routing = await toolRouter.routeByLLM(userMessage, this.userId);
    const activeTools = toolRouter.filterToolDefinitions(this.allToolDefinitions, routing.routes);

    // ForgeLink/WeaveForge/SkillWeave/AtomChain: intent-aware memory policy context
    let forgeLinkContext = '';
    let evolutionContext = '';
    const intent = toolRouter.detectQueryIntent(userMessage) || forgeLink.detectIntent(userMessage);
    if (forgeLink.isEnabled()) {
      const relatedEdges = await forgeLink.intentAwareRetrieve(userMessage, intent, this.userId, 5);
      if (relatedEdges.length > 0) {
        const edgeSummary = relatedEdges.map(e =>
          `${e.edge.provenanceModule} —[${e.edge.edgeType}]→ ${e.edge.metadata?.targetModule || 'unknown'} (conf=${e.relevance.toFixed(2)})`
        ).join('\n');
        forgeLinkContext = `\n\n### Linked Relationship Context (ForgeLink)\n${edgeSummary}`;
      }
    }
    evolutionContext =
      await chronosVeil.buildVeilContext(userMessage, this.userId, this.projectId, 4) +
      await weaveForge.buildWeaveContext(userMessage, intent, this.userId, this.projectId, 4) +
      await skillWeave.policyContext(userMessage, this.userId, this.projectId, 4) +
      await atomChain.buildAtomicContext(userMessage, this.userId, this.projectId, 4) +
      await policyMetabol.buildPolicyContext(userMessage, this.userId, this.projectId, 4) +
      await layerForge.buildLayerContext(userMessage, this.userId, this.projectId, 4) +
      await echoForge.buildEchoContext(userMessage, this.userId, this.projectId, 4);
    const routingHint = toolRouter.buildRoutingHint(routing.routes, this.userId);

    // ── Step 2: Plan — for complex tasks, build a multi-step plan ─────────────
    if (routing.needs_planning && routing.complexity === 'complex') {
      return this.runWithPlan(userMessage, routing.routes);
    }

    // ── Step 3: Execute — standard agentic loop with focused tool set ─────────
    const context = await memoryIndex.retrieveContext(this.userId, this.projectId, userMessage);
    const contextString = memoryIndex.formatContextForPrompt(context);
    let messages = this.buildMessages(userMessage, contextString, routingHint, forgeLinkContext + evolutionContext);

    let iterations = 0;
    const toolResults: ToolResult[] = [];
    const toolsActivated: string[] = [];

    while (iterations < this.maxIterations) {
      iterations++;

      const response = await this.model.generate(messages, {
        tools: activeTools.length > 0 ? activeTools : undefined,
      });

      memoryIndex.addToShortTerm(this.userId, this.projectId, {
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls,
      });

      if (!response.toolCalls || response.toolCalls.length === 0) {
        await this.reflectAndStore(userMessage, response.content);
        return {
          content: response.content,
          iterations,
          memoryStored: true,
          toolsActivated,
        };
      }

      for (const toolCall of response.toolCalls) {
        const result = await this.executeToolCall(toolCall);
        toolResults.push(result);
        toolsActivated.push(toolCall.function.name);

        // ForgeLink: process tool output for typed edge forging
        if (forgeLink.isEnabled() && !result.error) {
          try {
            const outputData = JSON.parse(result.result);
            await forgeLink.process(toolCall.function.name, outputData, this.userId, outputData.id);
          } catch { /* result may not be JSON — skip edge forging */ }
        }

        if (!result.error) {
          await this.evolveToolOutput(toolCall.function.name, result.result, 0.65);
        }

        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        });
        messages.push({
          role: 'tool',
          content: result.error ? `Error: ${result.error}` : result.result,
          tool_call_id: toolCall.id,
        });
      }
    }

    return {
      content: 'I reached the maximum iterations. Here is what I found so far.',
      toolResults,
      iterations,
      memoryStored: false,
      toolsActivated,
    };
  }

  // ── Multi-step planned execution for complex tasks ──────────────────────────
  private async runWithPlan(userMessage: string, routes: any[]): Promise<AgentResponse> {
    try {
      const context = await memoryIndex.retrieveContext(this.userId, this.projectId, userMessage);
      const contextString = memoryIndex.formatContextForPrompt(context);

      const plan = await this.planner.createPlan(userMessage, contextString);
      const { plan: executedPlan, results } = await this.executor.executePlan(plan);
      const successRate = results.length > 0
        ? results.filter(r => r.success).length / results.length
        : 0.5;

      const summary = results
        .filter(r => r.success)
        .map(r => `${r.step.description}: ${r.output.slice(0, 200)}`)
        .join('\n\n');

      await this.evolveToolOutput('planner_executor', summary || userMessage, successRate);

      // Final synthesis pass
      const synthMessages: Message[] = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `${userMessage}\n\nI have executed a multi-step plan. Here are the results:\n\n${summary}\n\nPlease synthesize these results into a clear, helpful response.` },
      ];
      const finalResponse = await this.model.generate(synthMessages, { max_tokens: 1500 });

      await this.reflectAndStore(userMessage, finalResponse.content);

      return {
        content: finalResponse.content,
        iterations: results.length,
        memoryStored: true,
        planExecuted: true,
        toolsActivated: routes.map((r: any) => r.tool_name),
      };
    } catch (err: any) {
      // Fall back to simple loop if planning fails
      return this.run(userMessage);
    }
  }

  private buildMessages(userMessage: string, contextString: string, routingHint: string = '', forgeLinkContext: string = ''): Message[] {
    const systemContent =
      this.systemPrompt +
      (contextString ? `\n\n### User Context\n${contextString}` : '') +
      `\n\n### Recent Conversation\n${memoryIndex.getShortTermContext(this.userId, this.projectId)}` +
      routingHint +
      (forgeLinkContext || '');

    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: userMessage },
    ];
  }

  private async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const tool = getToolByName(toolCall.function.name);
    if (!tool) {
      return { toolCallId: toolCall.id, result: '', error: `Unknown tool: ${toolCall.function.name}` };
    }
    try {
      const args = JSON.parse(toolCall.function.arguments);
      // Ensure user_id is always injected
      if (!args.user_id) args.user_id = this.userId;
      const result = await tool.execute(args);
      return { toolCallId: toolCall.id, result };
    } catch (error: any) {
      return { toolCallId: toolCall.id, result: '', error: error.message };
    }
  }

  private async evolveToolOutput(sourceModule: string, content: string, outcomeScore: number): Promise<void> {
    const signal = {
      userId: this.userId,
      projectId: this.projectId,
      content,
      raw: content,
      outcomeScore,
      confidence: outcomeScore,
      tags: this.tagsForSource(sourceModule, content),
      metadata: { source_module: sourceModule },
    };

    await Promise.allSettled([
      chronosVeil.ingestEvent(signal, sourceModule),
      weaveForge.weaveSignal(signal, sourceModule, { userId: this.userId, projectId: this.projectId, outcomeScore }),
      skillWeave.evolveAndApply(signal, sourceModule, outcomeScore),
      atomChain.executeAtomic(signal, sourceModule, outcomeScore >= 0.6 ? 'consolidate' : 'create', outcomeScore),
      policyMetabol.runLoop(signal, sourceModule, outcomeScore),
      layerForge.forgeCompress(signal, sourceModule, sourceModule),
      echoForge.runReconstruction(signal, sourceModule, sourceModule),
    ]);
  }

  private async evolveReflectionMemory(
    memory: { content: string; type: string; importance: number; tags: string[] },
    importance: number
  ): Promise<void> {
    const outcomeScore = Math.max(0.1, Math.min(1.0, importance / 5));
    const signal = {
      userId: this.userId,
      projectId: this.projectId,
      content: memory.content,
      confidence: outcomeScore,
      tags: memory.tags || [],
      metadata: { memory_type: memory.type, importance },
      outcomeScore,
    };

    await Promise.allSettled([
      chronosVeil.ingestEvent(signal, 'reflection'),
      weaveForge.weaveSignal(signal, 'reflection', { userId: this.userId, projectId: this.projectId, outcomeScore }),
      skillWeave.evolveAndApply(signal, 'reflection', outcomeScore),
      atomChain.executeAtomic(signal, 'reflection', importance >= 4 ? 'consolidate' : 'create', outcomeScore),
      policyMetabol.runLoop(signal, 'reflection', outcomeScore),
      layerForge.forgeCompress(signal, 'reflection', memory.type),
      echoForge.runReconstruction(signal, 'reflection', memory.type),
    ]);
  }

  private tagsForSource(sourceModule: string, content: string): string[] {
    const tags = new Set<string>();
    const lower = `${sourceModule} ${content}`.toLowerCase();

    if (/\b(code|bug|debt|api|repo|test|refactor)\b/.test(lower)) tags.add('code');
    if (/\b(burnout|stress|energy|tired)\b/.test(lower)) tags.add('burnout');
    if (/\b(team|relationship|colleague|handoff)\b/.test(lower)) tags.add('relationship');
    if (/\b(plan|step|executor|planner)\b/.test(lower)) tags.add('planning');
    if (/\b(fact|decision|resolved|supersede|contract)\b/.test(lower)) tags.add('knowledge');
    if (tags.size === 0) tags.add(sourceModule);

    return [...tags];
  }

  private async reflectAndStore(userMessage: string, assistantResponse: string): Promise<void> {
    if (this.memoryMode === 'ephemeral') return;

    const reflection = await this.extractMemories(userMessage, assistantResponse);
    const conversationId = 'conv_' + Date.now();
    const messageId = 'msg_' + Date.now();

    // Guard against LLM returning non-array values
    for (const memory of (Array.isArray(reflection.memories) ? reflection.memories : [])) {
      try {
        await memoryIndex.storeMemory(
          this.userId, this.projectId, memory.content,
          memory.type === 'reflection' ? 'reflection' : 'explicit',
          memory.importance, memory.tags || [], conversationId, messageId
        );
        await this.evolveReflectionMemory(memory, memory.importance || 1);
      } catch { /* silent — vector store may be unavailable */ }
    }
    for (const goal of (Array.isArray(reflection.goals) ? reflection.goals : [])) {
      try { await memoryIndex.storeGoal(this.userId, goal.title, goal.description, goal.priority); } catch { }
    }
    for (const pref of (Array.isArray(reflection.preferences) ? reflection.preferences : [])) {
      try { await memoryIndex.storePreference(this.userId, pref.key, pref.value, pref.category); } catch { }
    }
    for (const project of (Array.isArray(reflection.projects) ? reflection.projects : [])) {
      try { await memoryIndex.storeProject(this.userId, project.name, project.description, project.techStack); } catch { }
    }
  }

  private async extractMemories(userMessage: string, assistantResponse: string): Promise<{
    memories: Array<{ content: string; type: string; importance: number; tags: string[] }>;
    goals: Array<{ title: string; description?: string; priority: number }>;
    preferences: Array<{ key: string; value: string; category?: string }>;
    projects: Array<{ name: string; description?: string; techStack?: string[] }>;
  }> {
    const extractionPrompt = `Analyze this conversation and extract structured information. Return JSON only:

{"memories":[{"content":"...","type":"fact|preference|goal|project|general","importance":1-5,"tags":["tag1"]}],"goals":[{"title":"...","description":"...","priority":1-5}],"preferences":[{"key":"...","value":"...","category":"..."}],"projects":[{"name":"...","description":"...","techStack":["..."]}]}

Only include meaningful entries. Focus on facts, preferences, goals, projects about the user.

User: ${userMessage}
Assistant: ${assistantResponse}`;

    try {
      const response = await this.model.generate(
        [{ role: 'user', content: extractionPrompt }],
        { max_tokens: 1500 }
      );
      const content = response.content.trim().replace(/```json|```/g, '').trim();
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        return JSON.parse(content.substring(start, end + 1));
      }
    } catch { /* silent fail */ }

    return { memories: [], goals: [], preferences: [], projects: [] };
  }

  setSystemPrompt(prompt: string): void { this.systemPrompt = prompt; }
  getProjectId(): string { return this.projectId; }
  getUserId(): number { return this.userId; }
  getMemoryMode(): string { return this.memoryMode; }
  clearConversation(): void { memoryIndex.clearShortTerm(this.userId, this.projectId); }
}
