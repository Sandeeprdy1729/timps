"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIModel = void 0;
const openai_1 = __importDefault(require("openai"));
const baseModel_1 = require("./baseModel");
const env_1 = require("../config/env");
class OpenAIModel extends baseModel_1.BaseModel {
    client;
    constructor(modelName, apiKey, temperature) {
        super(modelName || env_1.config.models.openai?.defaultModel || 'gpt-4-turbo-preview', temperature);
        this.client = new openai_1.default({
            apiKey: apiKey || env_1.config.models.openai?.apiKey || process.env.OPENAI_API_KEY,
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
            max_tokens: options?.max_tokens,
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
            usage: response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            } : undefined,
        };
    }
    async getEmbedding(text) {
        const embeddingModel = env_1.config.embeddings.model;
        const response = await this.client.embeddings.create({
            model: embeddingModel,
            input: text,
        });
        return {
            embedding: response.data[0].embedding,
            usage: {
                promptTokens: response.usage.prompt_tokens,
                totalTokens: response.usage.total_tokens,
            },
        };
    }
}
exports.OpenAIModel = OpenAIModel;
//# sourceMappingURL=openaiModel.js.map