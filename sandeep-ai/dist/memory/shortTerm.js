"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortTermMemoryStore = void 0;
const env_1 = require("../config/env");
class ShortTermMemoryStore {
    messages = [];
    tokenCount = 0;
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    addMessage(message) {
        const messageTokens = this.estimateTokens(message.content);
        while (this.tokenCount + messageTokens > env_1.config.memory.shortTermTokenLimit ||
            this.messages.length >= env_1.config.memory.shortTermMaxMessages) {
            const removed = this.messages.shift();
            if (removed) {
                this.tokenCount -= this.estimateTokens(removed.content);
            }
        }
        this.messages.push(message);
        this.tokenCount += messageTokens;
    }
    addMessages(messages) {
        for (const msg of messages) {
            this.addMessage(msg);
        }
    }
    getMessages() {
        return [...this.messages];
    }
    getLastMessages(count) {
        return this.messages.slice(-count);
    }
    getSystemMessages() {
        return this.messages.filter(m => m.role === 'system');
    }
    getUserMessages() {
        return this.messages.filter(m => m.role === 'user');
    }
    getAssistantMessages() {
        return this.messages.filter(m => m.role === 'assistant');
    }
    getConversations() {
        const conversations = [];
        let currentUser = '';
        for (const msg of this.messages) {
            if (msg.role === 'user') {
                currentUser = msg.content;
            }
            else if (msg.role === 'assistant' && currentUser) {
                conversations.push({ user: currentUser, assistant: msg.content });
                currentUser = '';
            }
        }
        return conversations;
    }
    clear() {
        this.messages = [];
        this.tokenCount = 0;
    }
    getTokenCount() {
        return this.tokenCount;
    }
    toContextString() {
        const recentMessages = this.getLastMessages(env_1.config.memory.shortTermMaxMessages);
        return recentMessages
            .map(m => `${m.role}: ${m.content}`)
            .join('\n\n');
    }
}
exports.ShortTermMemoryStore = ShortTermMemoryStore;
//# sourceMappingURL=shortTerm.js.map