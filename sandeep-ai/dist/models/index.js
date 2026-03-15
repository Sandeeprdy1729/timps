"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterModel = exports.OllamaModel = exports.GeminiModel = exports.OpenAIModel = exports.BaseModel = void 0;
exports.createModel = createModel;
exports.createEmbeddingModel = createEmbeddingModel;
const openaiModel_1 = require("./openaiModel");
const geminiModel_1 = require("./geminiModel");
const ollamaModel_1 = require("./ollamaModel");
const openRouterModel_1 = require("./openRouterModel");
const env_1 = require("../config/env");
function createModel(provider) {
    const selectedProvider = provider || env_1.config.models.defaultProvider;
    switch (selectedProvider) {
        case 'openai':
            if (!env_1.config.models.openai?.apiKey)
                throw new Error('OpenAI API key not configured');
            return new openaiModel_1.OpenAIModel();
        case 'gemini':
            if (!env_1.config.models.gemini?.apiKey)
                throw new Error('Gemini API key not configured');
            return new geminiModel_1.GeminiModel();
        case 'ollama':
            return new ollamaModel_1.OllamaModel();
        case 'openrouter':
            if (!env_1.config.models.openrouter?.apiKey)
                throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env');
            return new openRouterModel_1.OpenRouterModel();
        default:
            throw new Error(`Unknown model provider: ${selectedProvider}`);
    }
}
function createEmbeddingModel(provider = 'ollama') {
    // Embeddings always use Ollama's nomic-embed-text regardless of chat provider
    // OpenRouter does not offer an embeddings API
    switch (provider) {
        case 'openai':
            return new openaiModel_1.OpenAIModel();
        case 'gemini':
            return new geminiModel_1.GeminiModel();
        case 'openrouter':
        case 'ollama':
        default:
            return new ollamaModel_1.OllamaModel('nomic-embed-text');
    }
}
var baseModel_1 = require("./baseModel");
Object.defineProperty(exports, "BaseModel", { enumerable: true, get: function () { return baseModel_1.BaseModel; } });
var openaiModel_2 = require("./openaiModel");
Object.defineProperty(exports, "OpenAIModel", { enumerable: true, get: function () { return openaiModel_2.OpenAIModel; } });
var geminiModel_2 = require("./geminiModel");
Object.defineProperty(exports, "GeminiModel", { enumerable: true, get: function () { return geminiModel_2.GeminiModel; } });
var ollamaModel_2 = require("./ollamaModel");
Object.defineProperty(exports, "OllamaModel", { enumerable: true, get: function () { return ollamaModel_2.OllamaModel; } });
var openRouterModel_2 = require("./openRouterModel");
Object.defineProperty(exports, "OpenRouterModel", { enumerable: true, get: function () { return openRouterModel_2.OpenRouterModel; } });
//# sourceMappingURL=index.js.map