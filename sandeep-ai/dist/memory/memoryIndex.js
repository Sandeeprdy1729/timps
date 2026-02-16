"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryIndex = exports.MemoryIndex = void 0;
const shortTerm_1 = require("./shortTerm");
const longTerm_1 = require("./longTerm");
const env_1 = require("../config/env");
class MemoryIndex {
    userMemories = new Map();
    longTermStore;
    constructor() {
        this.longTermStore = new longTerm_1.LongTermMemoryStore();
    }
    getOrCreateUserMemory(userId, username) {
        if (!this.userMemories.has(userId)) {
            this.userMemories.set(userId, {
                shortTerm: new shortTerm_1.ShortTermMemoryStore(),
                longTerm: this.longTermStore,
                userId,
                username,
            });
        }
        const userMemory = this.userMemories.get(userId);
        if (username) {
            userMemory.username = username;
        }
        return userMemory;
    }
    async retrieveContext(userId, query) {
        const userMemory = this.getOrCreateUserMemory(userId);
        const [memories, goals, preferences, projects] = await Promise.all([
            userMemory.longTerm.retrieveMemories(userId, query, env_1.config.memory.longTermTopResults),
            userMemory.longTerm.getGoals(userId),
            userMemory.longTerm.getPreferences(userId),
            userMemory.longTerm.getProjects(userId),
        ]);
        return { memories, goals, preferences, projects };
    }
    formatContextForPrompt(context) {
        const parts = [];
        if (context.memories.length > 0) {
            parts.push('## Relevant Memories');
            for (const mem of context.memories) {
                parts.push(`- ${mem.content} (${mem.memory_type})`);
            }
        }
        if (context.goals.length > 0) {
            parts.push('\n## Active Goals');
            for (const goal of context.goals.filter(g => g.status === 'active')) {
                parts.push(`- ${goal.title}${goal.description ? `: ${goal.description}` : ''}`);
            }
        }
        if (context.preferences.length > 0) {
            parts.push('\n## Preferences');
            for (const pref of context.preferences) {
                parts.push(`- ${pref.preference_key}: ${pref.preference_value}`);
            }
        }
        if (context.projects.length > 0) {
            parts.push('\n## Projects');
            for (const proj of context.projects.filter(p => p.status === 'active')) {
                const techStack = proj.tech_stack?.join(', ') || 'N/A';
                parts.push(`- ${proj.name}: ${proj.description || 'No description'} (Tech: ${techStack})`);
            }
        }
        return parts.join('\n');
    }
    addToShortTerm(userId, message) {
        const userMemory = this.getOrCreateUserMemory(userId);
        userMemory.shortTerm.addMessage(message);
    }
    addToShortTermBatch(userId, messages) {
        const userMemory = this.getOrCreateUserMemory(userId);
        userMemory.shortTerm.addMessages(messages);
    }
    getShortTermMessages(userId) {
        const userMemory = this.getOrCreateUserMemory(userId);
        return userMemory.shortTerm.getMessages();
    }
    getShortTermContext(userId) {
        const userMemory = this.getOrCreateUserMemory(userId);
        return userMemory.shortTerm.toContextString();
    }
    clearShortTerm(userId) {
        const userMemory = this.getOrCreateUserMemory(userId);
        userMemory.shortTerm.clear();
    }
    async storeMemory(userId, content, memoryType = 'general', importance = 1, tags = []) {
        const userMemory = this.getOrCreateUserMemory(userId);
        return userMemory.longTerm.storeMemory({
            user_id: userId,
            content,
            memory_type: memoryType,
            importance,
            tags,
        });
    }
    async storeGoal(userId, title, description, priority = 1, targetDate) {
        const userMemory = this.getOrCreateUserMemory(userId);
        return userMemory.longTerm.storeGoal({
            user_id: userId,
            title,
            description,
            status: 'active',
            priority,
            target_date: targetDate,
        });
    }
    async storePreference(userId, key, value, category) {
        const userMemory = this.getOrCreateUserMemory(userId);
        return userMemory.longTerm.storePreference({
            user_id: userId,
            preference_key: key,
            preference_value: value,
            category,
        });
    }
    async storeProject(userId, name, description, techStack, repositoryUrl) {
        const userMemory = this.getOrCreateUserMemory(userId);
        return userMemory.longTerm.storeProject({
            user_id: userId,
            name,
            description,
            status: 'active',
            tech_stack: techStack,
            repository_url: repositoryUrl,
        });
    }
    removeUser(userId) {
        this.userMemories.delete(userId);
    }
}
exports.MemoryIndex = MemoryIndex;
exports.memoryIndex = new MemoryIndex();
//# sourceMappingURL=memoryIndex.js.map