"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterModel = void 0;
const openai_1 = __importDefault(require("openai"));
const baseModel_1 = require("./baseModel");
const env_1 = require("../config/env");
// OpenRouter is OpenAI-compatible — same SDK, different baseURL + headers
class OpenRouterModel extends baseModel_1.BaseModel {
    client;
    constructor(modelName, temperature) {
        super(modelName || env_1.config.models.openrouter?.defaultModel || 'anthropic/claude-3.5-haiku', temperature);
        this.client = new openai_1.default({
            apiKey: env_1.config.models.openrouter?.apiKey || process.env.OPENROUTER_API_KEY || '',
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/Sandeeprdy1729/timps',
                'X-Title': 'TIMPs',
            },
        });
    }
    async generate(messages, options) {
        const model = options?.model || this.modelName;
        const temperature = options?.temperature ?? this.temperature;
        const openaiMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            name: msg.name,
            tool_calls: msg.tool_calls,
            tool_call_id: msg.tool_call_id,
        }));
        const requestOptions = {
            model,
            messages: openaiMessages,
            temperature,
            max_tokens: options?.max_tokens || 4096,
            top_p: options?.top_p,
            tools: options?.tools,
            tool_choice: options?.tool_choice,
            stop: options?.stop,
        };
        const response = await this.client.chat.completions.create(requestOptions);
        const choice = response.choices[0];
        let toolCalls;
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            toolCalls = choice.message.tool_calls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                },
            }));
        }
        return {
            content: choice.message.content || '',
            toolCalls,
            usage: response.usage
                ? {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens,
                }
                : undefined,
        };
    }
    // OpenRouter doesn't provide embeddings — fall back to Ollama's nomic-embed-text
    async getEmbedding(_text) {
        throw new Error('OpenRouter does not support embeddings. ' +
            'Keep EMBEDDINGS_PROVIDER=ollama and ensure Ollama is running for memory search.');
    }
}
exports.OpenRouterModel = OpenRouterModel;
//# sourceMappingURL=openRouterModel.js.map