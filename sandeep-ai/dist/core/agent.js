"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
const models_1 = require("../models");
const memoryIndex_1 = require("../memory/memoryIndex");
const tools_1 = require("../tools");
const env_1 = require("../config/env");
const toolRouter_1 = require("./toolRouter");
const planner_1 = require("./planner");
const executor_1 = require("./executor");
const forgeLink_1 = require("./forgeLink");
const weaveForge_1 = require("./weaveForge");
const skillWeave_1 = require("./skillWeave");
const atomChain_1 = require("./atomChain");
const chronosVeil_1 = require("./chronosVeil");
const policyMetabol_1 = require("./policyMetabol");
const layerForge_1 = require("./layerForge");
const echoForge_1 = require("./echoForge");
const nexusForge_1 = require("./nexusForge");
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
class Agent {
    userId;
    projectId;
    memoryMode;
    username;
    systemPrompt;
    model;
    maxIterations;
    allToolDefinitions;
    planner;
    executor;
    constructor(agentConfig) {
        this.userId = agentConfig.userId;
        this.projectId = agentConfig.projectId || 'default';
        this.memoryMode = agentConfig.memoryMode || 'persistent';
        this.username = agentConfig.username;
        this.systemPrompt = agentConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        this.model = (0, models_1.createModel)(agentConfig.modelProvider || env_1.config.models.defaultProvider);
        this.maxIterations = agentConfig.maxIterations || 15;
        this.planner = new planner_1.Planner();
        this.executor = new executor_1.Executor();
        // Initialize ForgeLink module registry (idempotent)
        if (forgeLink_1.forgeLink.isEnabled() || process.env.ENABLE_FORGELINK !== 'false') {
            forgeLink_1.forgeLink.registerModules();
        }
        const internalTools = (0, tools_1.getToolDefinitions)();
        this.allToolDefinitions = internalTools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));
    }
    async run(userMessage) {
        memoryIndex_1.memoryIndex.addToShortTerm(this.userId, this.projectId, {
            role: 'user',
            content: userMessage,
        });
        // ── Step 1: Route — decide which tools are relevant ──────────────────────
        const routing = await toolRouter_1.toolRouter.routeByLLM(userMessage, this.userId);
        const activeTools = toolRouter_1.toolRouter.filterToolDefinitions(this.allToolDefinitions, routing.routes);
        // ForgeLink/WeaveForge/SkillWeave/AtomChain: intent-aware memory policy context
        let forgeLinkContext = '';
        let evolutionContext = '';
        const intent = toolRouter_1.toolRouter.detectQueryIntent(userMessage) || forgeLink_1.forgeLink.detectIntent(userMessage);
        if (forgeLink_1.forgeLink.isEnabled()) {
            const relatedEdges = await forgeLink_1.forgeLink.intentAwareRetrieve(userMessage, intent, this.userId, 5);
            if (relatedEdges.length > 0) {
                const edgeSummary = relatedEdges.map(e => `${e.edge.provenanceModule} —[${e.edge.edgeType}]→ ${e.edge.metadata?.targetModule || 'unknown'} (conf=${e.relevance.toFixed(2)})`).join('\n');
                forgeLinkContext = `\n\n### Linked Relationship Context (ForgeLink)\n${edgeSummary}`;
            }
        }
        evolutionContext =
            await chronosVeil_1.chronosVeil.buildVeilContext(userMessage, this.userId, this.projectId, 4) +
                await weaveForge_1.weaveForge.buildWeaveContext(userMessage, intent, this.userId, this.projectId, 4) +
                await skillWeave_1.skillWeave.policyContext(userMessage, this.userId, this.projectId, 4) +
                await atomChain_1.atomChain.buildAtomicContext(userMessage, this.userId, this.projectId, 4) +
                await policyMetabol_1.policyMetabol.buildPolicyContext(userMessage, this.userId, this.projectId, 4) +
                await layerForge_1.layerForge.buildLayerContext(userMessage, this.userId, this.projectId, 4) +
                await echoForge_1.echoForge.buildEchoContext(userMessage, this.userId, this.projectId, 4) +
                await nexusForge_1.nexusForge.buildVeilContext(userMessage, this.userId, this.projectId, 4);
        const routingHint = toolRouter_1.toolRouter.buildRoutingHint(routing.routes, this.userId);
        // ── Step 2: Plan — for complex tasks, build a multi-step plan ─────────────
        if (routing.needs_planning && routing.complexity === 'complex') {
            return this.runWithPlan(userMessage, routing.routes);
        }
        // ── Step 3: Execute — standard agentic loop with focused tool set ─────────
        const context = await memoryIndex_1.memoryIndex.retrieveContext(this.userId, this.projectId, userMessage);
        const contextString = memoryIndex_1.memoryIndex.formatContextForPrompt(context);
        let messages = this.buildMessages(userMessage, contextString, routingHint, forgeLinkContext + evolutionContext);
        let iterations = 0;
        const toolResults = [];
        const toolsActivated = [];
        while (iterations < this.maxIterations) {
            iterations++;
            const response = await this.model.generate(messages, {
                tools: activeTools.length > 0 ? activeTools : undefined,
            });
            memoryIndex_1.memoryIndex.addToShortTerm(this.userId, this.projectId, {
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
                if (forgeLink_1.forgeLink.isEnabled() && !result.error) {
                    try {
                        const outputData = JSON.parse(result.result);
                        await forgeLink_1.forgeLink.process(toolCall.function.name, outputData, this.userId, outputData.id);
                    }
                    catch { /* result may not be JSON — skip edge forging */ }
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
    async runWithPlan(userMessage, routes) {
        try {
            const context = await memoryIndex_1.memoryIndex.retrieveContext(this.userId, this.projectId, userMessage);
            const contextString = memoryIndex_1.memoryIndex.formatContextForPrompt(context);
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
            const synthMessages = [
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
                toolsActivated: routes.map((r) => r.tool_name),
            };
        }
        catch (err) {
            // Fall back to simple loop if planning fails
            return this.run(userMessage);
        }
    }
    buildMessages(userMessage, contextString, routingHint = '', forgeLinkContext = '') {
        const systemContent = this.systemPrompt +
            (contextString ? `\n\n### User Context\n${contextString}` : '') +
            `\n\n### Recent Conversation\n${memoryIndex_1.memoryIndex.getShortTermContext(this.userId, this.projectId)}` +
            routingHint +
            (forgeLinkContext || '');
        return [
            { role: 'system', content: systemContent },
            { role: 'user', content: userMessage },
        ];
    }
    async executeToolCall(toolCall) {
        const tool = (0, tools_1.getToolByName)(toolCall.function.name);
        if (!tool) {
            return { toolCallId: toolCall.id, result: '', error: `Unknown tool: ${toolCall.function.name}` };
        }
        try {
            const args = JSON.parse(toolCall.function.arguments);
            // Ensure user_id is always injected
            if (!args.user_id)
                args.user_id = this.userId;
            const result = await tool.execute(args);
            return { toolCallId: toolCall.id, result };
        }
        catch (error) {
            return { toolCallId: toolCall.id, result: '', error: error.message };
        }
    }
    async evolveToolOutput(sourceModule, content, outcomeScore) {
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
            chronosVeil_1.chronosVeil.ingestEvent(signal, sourceModule),
            weaveForge_1.weaveForge.weaveSignal(signal, sourceModule, { userId: this.userId, projectId: this.projectId, outcomeScore }),
            skillWeave_1.skillWeave.evolveAndApply(signal, sourceModule, outcomeScore),
            atomChain_1.atomChain.executeAtomic(signal, sourceModule, outcomeScore >= 0.6 ? 'consolidate' : 'create', outcomeScore),
            policyMetabol_1.policyMetabol.runLoop(signal, sourceModule, outcomeScore),
            layerForge_1.layerForge.forgeCompress(signal, sourceModule, sourceModule),
            echoForge_1.echoForge.runReconstruction(signal, sourceModule, sourceModule),
            nexusForge_1.nexusForge.episodicIndexer(signal, sourceModule),
            nexusForge_1.nexusForge.evolutionOracle(signal, { projectId: this.projectId }),
        ]);
    }
    async evolveReflectionMemory(memory, importance) {
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
            chronosVeil_1.chronosVeil.ingestEvent(signal, 'reflection'),
            weaveForge_1.weaveForge.weaveSignal(signal, 'reflection', { userId: this.userId, projectId: this.projectId, outcomeScore }),
            skillWeave_1.skillWeave.evolveAndApply(signal, 'reflection', outcomeScore),
            atomChain_1.atomChain.executeAtomic(signal, 'reflection', importance >= 4 ? 'consolidate' : 'create', outcomeScore),
            policyMetabol_1.policyMetabol.runLoop(signal, 'reflection', outcomeScore),
            layerForge_1.layerForge.forgeCompress(signal, 'reflection', memory.type),
            echoForge_1.echoForge.runReconstruction(signal, 'reflection', memory.type),
        ]);
    }
    tagsForSource(sourceModule, content) {
        const tags = new Set();
        const lower = `${sourceModule} ${content}`.toLowerCase();
        if (/\b(code|bug|debt|api|repo|test|refactor)\b/.test(lower))
            tags.add('code');
        if (/\b(burnout|stress|energy|tired)\b/.test(lower))
            tags.add('burnout');
        if (/\b(team|relationship|colleague|handoff)\b/.test(lower))
            tags.add('relationship');
        if (/\b(plan|step|executor|planner)\b/.test(lower))
            tags.add('planning');
        if (/\b(fact|decision|resolved|supersede|contract)\b/.test(lower))
            tags.add('knowledge');
        if (tags.size === 0)
            tags.add(sourceModule);
        return [...tags];
    }
    async reflectAndStore(userMessage, assistantResponse) {
        if (this.memoryMode === 'ephemeral')
            return;
        const reflection = await this.extractMemories(userMessage, assistantResponse);
        const conversationId = 'conv_' + Date.now();
        const messageId = 'msg_' + Date.now();
        // Guard against LLM returning non-array values
        for (const memory of (Array.isArray(reflection.memories) ? reflection.memories : [])) {
            try {
                await memoryIndex_1.memoryIndex.storeMemory(this.userId, this.projectId, memory.content, memory.type === 'reflection' ? 'reflection' : 'explicit', memory.importance, memory.tags || [], conversationId, messageId);
                await this.evolveReflectionMemory(memory, memory.importance || 1);
            }
            catch { /* silent — vector store may be unavailable */ }
        }
        for (const goal of (Array.isArray(reflection.goals) ? reflection.goals : [])) {
            try {
                await memoryIndex_1.memoryIndex.storeGoal(this.userId, goal.title, goal.description, goal.priority);
            }
            catch { }
        }
        for (const pref of (Array.isArray(reflection.preferences) ? reflection.preferences : [])) {
            try {
                await memoryIndex_1.memoryIndex.storePreference(this.userId, pref.key, pref.value, pref.category);
            }
            catch { }
        }
        for (const project of (Array.isArray(reflection.projects) ? reflection.projects : [])) {
            try {
                await memoryIndex_1.memoryIndex.storeProject(this.userId, project.name, project.description, project.techStack);
            }
            catch { }
        }
    }
    async extractMemories(userMessage, assistantResponse) {
        const extractionPrompt = `Analyze this conversation and extract structured information. Return JSON only:

{"memories":[{"content":"...","type":"fact|preference|goal|project|general","importance":1-5,"tags":["tag1"]}],"goals":[{"title":"...","description":"...","priority":1-5}],"preferences":[{"key":"...","value":"...","category":"..."}],"projects":[{"name":"...","description":"...","techStack":["..."]}]}

Only include meaningful entries. Focus on facts, preferences, goals, projects about the user.

User: ${userMessage}
Assistant: ${assistantResponse}`;
        try {
            const response = await this.model.generate([{ role: 'user', content: extractionPrompt }], { max_tokens: 1500 });
            const content = response.content.trim().replace(/```json|```/g, '').trim();
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                return JSON.parse(content.substring(start, end + 1));
            }
        }
        catch { /* silent fail */ }
        return { memories: [], goals: [], preferences: [], projects: [] };
    }
    setSystemPrompt(prompt) { this.systemPrompt = prompt; }
    getProjectId() { return this.projectId; }
    getUserId() { return this.userId; }
    getMemoryMode() { return this.memoryMode; }
    clearConversation() { memoryIndex_1.memoryIndex.clearShortTerm(this.userId, this.projectId); }
}
exports.Agent = Agent;
//# sourceMappingURL=agent.js.map