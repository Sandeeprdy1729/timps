"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reflection = void 0;
const models_1 = require("../models");
const memoryIndex_1 = require("../memory/memoryIndex");
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
    async storeExtractedKnowledge(userId, knowledge) {
        for (const memory of knowledge.memories) {
            await memoryIndex_1.memoryIndex.storeMemory(userId, memory.content, memory.type, memory.importance, memory.tags);
        }
        for (const goal of knowledge.goals) {
            await memoryIndex_1.memoryIndex.storeGoal(userId, goal.title, goal.description, goal.priority);
        }
        for (const pref of knowledge.preferences) {
            await memoryIndex_1.memoryIndex.storePreference(userId, pref.key, pref.value, pref.category);
        }
        for (const project of knowledge.projects) {
            await memoryIndex_1.memoryIndex.storeProject(userId, project.name, project.description, project.techStack);
        }
    }
    async reflectOnSession(userId, messages) {
        const conversationText = messages
            .map(m => `${m.role}: ${m.content}`)
            .join('\n\n');
        const sessionPrompt = `Review this conversation session and extract important insights to remember:

${conversationText}

Return a JSON array of important things to remember from this session:

[{"content": "important insight", "type": "fact|preference|general", "importance": 1-5, "tags": ["session"]}]

Focus on:
- Key information the user shared
- Tasks or goals mentioned
- User preferences revealed
- Important context`;
        try {
            const response = await this.model.generate([{ role: 'user', content: sessionPrompt }], { max_tokens: 1000 });
            const jsonMatch = response.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const insights = JSON.parse(jsonMatch[0]);
                for (const insight of insights) {
                    await memoryIndex_1.memoryIndex.storeMemory(userId, insight.content, insight.type, insight.importance, insight.tags);
                }
            }
        }
        catch (error) {
            console.error('Session reflection failed:', error);
        }
    }
}
exports.Reflection = Reflection;
//# sourceMappingURL=reflection.js.map