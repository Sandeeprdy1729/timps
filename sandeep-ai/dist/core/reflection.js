"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reflection = void 0;
const models_1 = require("../models");
const memoryIndex_1 = require("../memory/memoryIndex");
const curateTier_1 = require("./curateTier");
const provenForge_1 = require("./provenForge");
const governTier_1 = require("./governTier");
const chronosVeil_1 = require("./chronosVeil");
const weaveForge_1 = require("./weaveForge");
const skillWeave_1 = require("./skillWeave");
const atomChain_1 = require("./atomChain");
const policyMetabol_1 = require("./policyMetabol");
const layerForge_1 = require("./layerForge");
const echoForge_1 = require("./echoForge");
const nexusForge_1 = require("./nexusForge");
const synapseMetabolon_1 = require("./synapseMetabolon");
const veilForge_1 = require("./veilForge");
const temporaTree_1 = require("./temporaTree");
const bindWeave_1 = require("./bindWeave");
const aetherWeft_1 = require("./aetherWeft");
const apexSynapse_1 = require("./apexSynapse");
const quaternaryForge_1 = require("./quaternaryForge");
class Reflection {
    model;
    constructor() {
        this.model = (0, models_1.createModel)();
    }
    async analyzeConversation(userId, userMessage, assistantMessage) {
        const prompt = `Analyze this conversation and extract structured knowledge to store in memory.

User: ${userMessage}
Assistant: ${assistantMessage}

Extract and return ONLY a JSON object with this exact structure (no other text):

{
  "memories": [
    {"content": "fact or information to remember", "type": "fact|preference|goal|project|general", "importance": 1-5, "tags": ["tag1"]}
  ],
  "goals": [
    {"title": "goal title", "description": "optional description", "priority": 1-5, "status": "active|completed|cancelled"}
  ],
  "preferences": [
    {"key": "preference_key", "value": "preference_value", "category": "optional category"}
  ],
  "projects": [
    {"name": "project name", "description": "optional description", "status": "active|completed|archived", "techStack": ["tech1", "tech2"]}
  ]
}

Only include entries if there is meaningful information to extract. Be concise but specific.`;
        try {
            const response = await this.model.generate([{ role: 'user', content: prompt }], { max_tokens: 2000 });
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch (error) {
            console.error('Failed to analyze conversation:', error);
        }
        return {
            memories: [],
            goals: [],
            preferences: [],
            projects: [],
        };
    }
    async storeExtractedKnowledge(userId, projectId, knowledge) {
        for (const memory of knowledge.memories) {
            const stored = await memoryIndex_1.memoryIndex.storeMemory(userId, projectId, memory.content, "reflection", memory.importance, memory.tags || [], "reflection-analysis", "llm-extracted");
            // CurateTier: curate each reflected memory into hierarchical tiers
            try {
                const curationInput = {
                    content: memory.content,
                    tags: memory.tags || [],
                    importance: memory.importance,
                    memoryType: memory.type,
                    source: 'reflection',
                    memoryId: stored?.id,
                };
                await curateTier_1.curateTier.curate(curationInput, userId);
                // ProvenForge: versioning
                await provenForge_1.provenForge.forge({ content: memory.content, tags: memory.tags }, 'reflection');
                await this.evolveMemoryLayers(userId, projectId, memory.content, memory.tags || [], memory.importance, 'reflection');
            }
            catch {
                // Evolution layers are best-effort — never block reflection
            }
            // GovernTier: policy-driven governance
            if (governTier_1.governTier.isEnabled()) {
                try {
                    const event = {
                        source_module: 'reflection',
                        content: memory.content,
                        metadata: {
                            importance: memory.importance,
                            type: memory.type,
                            tags: memory.tags || [],
                            retrieval_count: 0,
                        },
                        provenance: 'llm-extracted',
                        user_id: userId,
                        project_id: projectId,
                        event_type: 'memory_reflection',
                    };
                    await governTier_1.governTier.enforce(event, 'reflection');
                }
                catch {
                    // GovernTier is best-effort — never block reflection
                }
            }
        }
        for (const goal of knowledge.goals) {
            await memoryIndex_1.memoryIndex.storeGoal(userId, goal.title, goal.description, goal.priority);
        }
        for (const pref of knowledge.preferences) {
            await memoryIndex_1.memoryIndex.storePreference(userId, pref.key, pref.value, pref.category);
        }
        for (const proj of knowledge.projects) {
            await memoryIndex_1.memoryIndex.storeProject(userId, proj.name, proj.description, proj.techStack || [], undefined);
        }
    }
    async reflectOnSession(userId, projectId, messages) {
        const conversationText = messages
            .map(m => `${m.role}: ${m.content}`)
            .join('\n\n');
        const sessionPrompt = `Review this conversation session and extract important insights to remember:

${conversationText}

Return JSON array:

[{"content": "...", "type": "fact|preference|general", "importance": 1-5, "tags": ["session"]}]
`;
        try {
            const response = await this.model.generate([{ role: 'user', content: sessionPrompt }], { max_tokens: 1000 });
            const jsonMatch = response.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const insights = JSON.parse(jsonMatch[0]);
                for (const insight of insights) {
                    const stored = await memoryIndex_1.memoryIndex.storeMemory(userId, projectId, insight.content, "reflection", insight.importance || 1, insight.tags || [], "session-reflection", "session");
                    // CurateTier: curate session insights into hierarchical tiers
                    try {
                        const curationInput = {
                            content: insight.content,
                            tags: insight.tags || [],
                            importance: insight.importance || 1,
                            memoryType: insight.type || 'general',
                            source: 'reflection',
                            memoryId: stored?.id,
                        };
                        await curateTier_1.curateTier.curate(curationInput, userId);
                        // ProvenForge: versioning
                        await provenForge_1.provenForge.forge({ content: insight.content, tags: insight.tags }, 'reflection_session');
                        await this.evolveMemoryLayers(userId, projectId, insight.content, insight.tags || [], insight.importance || 1, 'reflection_session');
                    }
                    catch {
                        // Evolution layers are best-effort
                    }
                }
            }
        }
        catch (error) {
            console.error('Session reflection failed:', error);
        }
    }
    async evolveMemoryLayers(userId, projectId, content, tags, importance, sourceModule) {
        const outcomeScore = Math.max(0.1, Math.min(1.0, importance / 5));
        const signal = {
            userId,
            projectId,
            content,
            tags,
            confidence: outcomeScore,
            outcomeScore,
            metadata: { importance, source_module: sourceModule },
        };
        await Promise.allSettled([
            chronosVeil_1.chronosVeil.ingestEvent(signal, sourceModule),
            weaveForge_1.weaveForge.weaveSignal(signal, sourceModule, { userId, projectId, outcomeScore }),
            skillWeave_1.skillWeave.evolveAndApply(signal, sourceModule, outcomeScore),
            atomChain_1.atomChain.executeAtomic(signal, sourceModule, importance >= 4 ? 'consolidate' : 'create', outcomeScore),
            policyMetabol_1.policyMetabol.runLoop(signal, sourceModule, outcomeScore),
            layerForge_1.layerForge.forgeCompress(signal, sourceModule, sourceModule),
            echoForge_1.echoForge.runReconstruction(signal, sourceModule, sourceModule),
            echoForge_1.echoForge.forgeHierarchical(signal, sourceModule),
            nexusForge_1.nexusForge.episodicIndexer(signal, sourceModule),
            nexusForge_1.nexusForge.evolutionOracle(signal, { projectId }),
            synapseMetabolon_1.synapseMetabolon.injectEvent(signal, sourceModule),
            veilForge_1.veilForge.projectAndForge(signal, sourceModule),
            temporaTree_1.temporaTree.growTree(signal, sourceModule),
            bindWeave_1.bindWeave.bindEvent(signal, sourceModule),
            aetherWeft_1.aetherWeft.weaveEntry(signal, sourceModule),
            apexSynapse_1.apexSynapse.forgeEvent(signal, sourceModule),
            quaternaryForge_1.quaternaryForge.forgeTyped(signal, sourceModule),
        ]);
    }
}
exports.Reflection = Reflection;
//# sourceMappingURL=reflection.js.map