"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiModel = void 0;
const baseModel_1 = require("./baseModel");
const env_1 = require("../config/env");
class GeminiModel extends baseModel_1.BaseModel {
    apiKey;
    baseUrl;
    constructor(modelName, apiKey, temperature) {
        super(modelName || env_1.config.models.gemini?.defaultModel || 'gemini-pro', temperature);
        this.apiKey = apiKey || env_1.config.models.gemini?.apiKey || process.env.GEMINI_API_KEY || '';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    }
    async generate(messages, options) {
        const model = options?.model || this.modelName;
        const temperature = options?.temperature ?? this.temperature;
        const contents = this.convertMessagesToContents(messages);
        const requestBody = {
            contents,
            generationConfig: {
                temperature,
                maxOutputTokens: options?.max_tokens,
                topP: options?.top_p,
                stopSequences: options?.stop,
            },
        };
        if (options?.tools) {
            requestBody.tools = this.convertTools(options.tools);
        }
        const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${error}`);
        }
        const data = await response.json();
        let content = '';
        let toolCalls;
        if (data.candidates?.[0]?.content?.parts) {
            for (const part of data.candidates[0].content.parts) {
                if (part.text) {
                    content += part.text;
                }
                if (part.functionCall) {
                    toolCalls = [{
                            id: `call_${Date.now()}`,
                            type: 'function',
                            function: {
                                name: part.functionCall.name,
                                arguments: JSON.stringify(part.functionCall.args || {}),
                            },
                        }];
                }
            }
        }
        return {
            content,
            toolCalls,
            usage: {
                promptTokens: data.usageMetadata?.promptTokenCount || 0,
                completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata?.totalTokenCount || 0,
            },
        };
    }
    async getEmbedding(text) {
        const url = `${this.baseUrl}/models/embedding-001:embedContent?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: {
                    role: 'user',
                    parts: [{ text }],
                },
                taskType: 'SEMANTIC_SIMILARITY',
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini Embedding API error: ${error}`);
        }
        const data = await response.json();
        return {
            embedding: data.embedding?.values || [],
            usage: {
                promptTokens: data.usageMetadata?.totalTokenCount || 0,
                totalTokens: data.usageMetadata?.totalTokenCount || 0,
            },
        };
    }
    convertMessagesToContents(messages) {
        const contents = [];
        for (const msg of messages) {
            if (msg.role === 'system') {
                contents.push({
                    role: 'system',
                    parts: [{ text: msg.content }],
                });
            }
            else if (msg.role === 'user') {
                contents.push({
                    role: 'user',
                    parts: [{ text: msg.content }],
                });
            }
            else if (msg.role === 'assistant') {
                const part = {};
                if (msg.content) {
                    part.text = msg.content;
                }
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    for (const tc of msg.tool_calls) {
                        const args = JSON.parse(tc.function.arguments);
                        part.functionCall = {
                            name: tc.function.name,
                            args,
                        };
                    }
                }
                if (Object.keys(part).length > 0) {
                    contents.push({
                        role: 'model',
                        parts: [part],
                    });
                }
            }
        }
        return contents;
    }
    convertTools(tools) {
        return tools.map(tool => ({
            functionDeclarations: [tool.function],
        }));
    }
}
exports.GeminiModel = GeminiModel;
//# sourceMappingURL=geminiModel.js.map