"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaModel = void 0;
const baseModel_1 = require("./baseModel");
const env_1 = require("../config/env");
class OllamaModel extends baseModel_1.BaseModel {
    baseUrl;
    constructor(modelName, baseUrl, temperature) {
        super(modelName || env_1.config.models.ollama?.defaultModel || 'llama2', temperature);
        this.baseUrl = baseUrl || env_1.config.models.ollama?.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    }
    async generate(messages, options) {
        const model = options?.model || this.modelName;
        const temperature = options?.temperature ?? this.temperature;
        const ollamaMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            ...(msg.name && { name: msg.name }),
        }));
        const requestBody = {
            model,
            messages: ollamaMessages,
            temperature,
            options: {
                top_p: options?.top_p,
                stop: options?.stop,
            },
            stream: false,
        };
        if (options?.max_tokens) {
            requestBody.options.num_predict = options.max_tokens;
        }
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error: ${error}`);
        }
        const data = await response.json();
        let toolCalls;
        if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
            toolCalls = data.message.tool_calls.map((tc) => ({
                id: tc.id || `call_${Date.now()}`,
                type: 'function',
                function: {
                    name: tc.function.name,
                    arguments: typeof tc.function.arguments === 'string'
                        ? tc.function.arguments
                        : JSON.stringify(tc.function.arguments),
                },
            }));
        }
        return {
            content: data.message?.content || '',
            toolCalls,
            usage: {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count || 0,
                totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
            },
        };
    }
    async getEmbedding(text) {
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'nomic-embed-text',
                prompt: text,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama Embedding API error: ${errorText}`);
        }
        const data = await response.json();
        return {
            embedding: data.embedding || [],
            usage: {
                promptTokens: 0,
                totalTokens: 0,
            },
        };
    }
}
exports.OllamaModel = OllamaModel;
//# sourceMappingURL=ollamaModel.js.map