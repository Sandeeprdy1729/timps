"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
const models_1 = require("../models");
const memoryIndex_1 = require("../memory/memoryIndex");
const tools_1 = require("../tools");
const DEFAULT_SYSTEM_PROMPT = `You are Sandeep AI – A persistent cognitive partner that remembers, evolves, and builds with your user.

You have access to the following tools:
- file_operations: Read, write, list, create, and delete files on the filesystem
- web_search: Search the web for current information
- web_fetch: Fetch content from specific URLs

Use these tools whenever you need to:
- Access or modify files
- Get up-to-date information
- Fetch content from websites

After each conversation, reflect on what you learned about the user and store important information in your memory.`;
class Agent {
    userId;
    username;
    systemPrompt;
    model;
    maxIterations;
    toolDefinitions;
    constructor(config) {
        this.userId = config.userId;
        this.username = config.username;
        this.systemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        this.model = (0, models_1.createModel)(config.modelProvider || 'ollama');
        this.maxIterations = config.maxIterations || 10;
        const internalTools = (0, tools_1.getToolDefinitions)();
        this.toolDefinitions = internalTools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));
    }
    async run(userMessage) {
        memoryIndex_1.memoryIndex.addToShortTerm(this.userId, {
            role: 'user',
            content: userMessage,
        });
        const context = await memoryIndex_1.memoryIndex.retrieveContext(this.userId, userMessage);
        const contextString = memoryIndex_1.memoryIndex.formatContextForPrompt(context);
        let messages = this.buildMessages(userMessage, contextString);
        let iterations = 0;
        let toolResults = [];
        while (iterations < this.maxIterations) {
            iterations++;
            const response = await this.model.generate(messages, {
                tools: this.toolDefinitions,
            });
            memoryIndex_1.memoryIndex.addToShortTerm(this.userId, {
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
                };
            }
            for (const toolCall of response.toolCalls) {
                const result = await this.executeToolCall(toolCall);
                toolResults.push(result);
                messages.push({
                    role: 'assistant',
                    content: '',
                    tool_calls: [toolCall],
                });
                messages.push({
                    role: 'tool',
                    content: result.result,
                    tool_call_id: toolCall.id,
                });
            }
        }
        return {
            content: 'I reached the maximum number of iterations. Let me summarize what I found:',
            toolResults,
            iterations,
            memoryStored: false,
        };
    }
    buildMessages(userMessage, contextString) {
        const systemContent = this.systemPrompt +
            (contextString ? `\n\n### User Context\n${contextString}` : '') +
            `\n\n### Recent Conversation\n${memoryIndex_1.memoryIndex.getShortTermContext(this.userId)}`;
        return [
            { role: 'system', content: systemContent },
            { role: 'user', content: userMessage },
        ];
    }
    async executeToolCall(toolCall) {
        const tool = (0, tools_1.getToolByName)(toolCall.function.name);
        if (!tool) {
            return {
                toolCallId: toolCall.id,
                result: '',
                error: `Unknown tool: ${toolCall.function.name}`,
            };
        }
        try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await tool.execute(args);
            return {
                toolCallId: toolCall.id,
                result,
            };
        }
        catch (error) {
            return {
                toolCallId: toolCall.id,
                result: '',
                error: error.message,
            };
        }
    }
    async reflectAndStore(userMessage, assistantResponse) {
        const reflection = await this.extractMemories(userMessage, assistantResponse);
        for (const memory of reflection.memories) {
            await memoryIndex_1.memoryIndex.storeMemory(this.userId, memory.content, memory.type, memory.importance, memory.tags);
        }
        for (const goal of reflection.goals) {
            await memoryIndex_1.memoryIndex.storeGoal(this.userId, goal.title, goal.description, goal.priority);
        }
        for (const pref of reflection.preferences) {
            await memoryIndex_1.memoryIndex.storePreference(this.userId, pref.key, pref.value, pref.category);
        }
        for (const project of reflection.projects) {
            await memoryIndex_1.memoryIndex.storeProject(this.userId, project.name, project.description, project.techStack);
        }
    }
    async extractMemories(userMessage, assistantResponse) {
        const extractionPrompt = `Analyze this conversation and extract structured information. Return a JSON object with the following structure:

{
  "memories": [{"content": "...", "type": "fact|preference|goal|project|general", "importance": 1-5, "tags": ["tag1", "tag2"]}],
  "goals": [{"title": "...", "description": "...", "priority": 1-5}],
  "preferences": [{"key": "...", "value": "...", "category": "..."}],
  "projects": [{"name": "...", "description": "...", "techStack": ["..."]}]
}

Only include entries if they contain meaningful information. Focus on:
- Facts about the user (name, interests, skills)
- User preferences and likes/dislikes
- Goals the user mentions
- Projects the user is working on
- Any important information worth remembering

Conversation:
User: ${userMessage}
Assistant: ${assistantResponse}`;
        try {
            const response = await this.model.generate([{ role: 'user', content: extractionPrompt }], { max_tokens: 2000 });
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch (error) {
            console.error('Failed to extract memories:', error);
        }
        return {
            memories: [],
            goals: [],
            preferences: [],
            projects: [],
        };
    }
    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
    }
    clearConversation() {
        memoryIndex_1.memoryIndex.clearShortTerm(this.userId);
    }
}
exports.Agent = Agent;
//# sourceMappingURL=agent.js.map