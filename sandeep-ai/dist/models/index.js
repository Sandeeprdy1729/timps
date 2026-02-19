"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaModel = exports.GeminiModel = exports.OpenAIModel = exports.BaseModel = void 0;
exports.createModel = createModel;
exports.createEmbeddingModel = createEmbeddingModel;
const openaiModel_1 = require("./openaiModel");
const geminiModel_1 = require("./geminiModel");
const ollamaModel_1 = require("./ollamaModel");
const env_1 = require("../config/env");
function createModel(provider) {
    const selectedProvider = provider || env_1.config.models.defaultProvider;
    switch (selectedProvider) {
        case 'openai':
            if (!env_1.config.models.openai?.apiKey) {
                throw new Error('OpenAI API key not configured');
            }
            return new openaiModel_1.OpenAIModel();
        case 'gemini':
            if (!env_1.config.models.gemini?.apiKey) {
                throw new Error('Gemini API key not configured');
            }
            return new geminiModel_1.GeminiModel();
        case 'ollama':
            return new ollamaModel_1.OllamaModel();
        default:
            throw new Error(`Unknown model provider: ${selectedProvider}`);
    }
}
function createEmbeddingModel(provider = 'ollama') {
    switch (provider) {
        case 'openai':
            return new openaiModel_1.OpenAIModel();
        case 'gemini':
            return new geminiModel_1.GeminiModel();
        case 'ollama':
            return new ollamaModel_1.OllamaModel('nomic-embed-text'); // embedding model
        default:
            throw new Error(`Unknown embedding provider: ${provider}`);
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
//# sourceMappingURL=index.js.map