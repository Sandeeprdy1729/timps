import { BaseModel } from './baseModel';
import { OpenAIModel } from './openaiModel';
import { GeminiModel } from './geminiModel';
import { OllamaModel } from './ollamaModel';
import { OpenRouterModel } from './openRouterModel';
import { config } from '../config/env';

export type ModelProvider = 'openai' | 'gemini' | 'ollama' | 'openrouter';

export function createModel(provider?: ModelProvider): BaseModel {
  const selectedProvider = provider || config.models.defaultProvider;
  
  switch (selectedProvider) {
    case 'openai':
      if (!config.models.openai?.apiKey) throw new Error('OpenAI API key not configured');
      return new OpenAIModel();

    case 'gemini':
      if (!config.models.gemini?.apiKey) throw new Error('Gemini API key not configured');
      return new GeminiModel();

    case 'ollama':
      return new OllamaModel();

    case 'openrouter':
      if (!config.models.openrouter?.apiKey) throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env');
      return new OpenRouterModel();

    default:
      throw new Error(`Unknown model provider: ${selectedProvider}`);
  }
}

export function createEmbeddingModel(provider: ModelProvider = 'ollama'): BaseModel {
  // Embeddings always use Ollama's nomic-embed-text regardless of chat provider
  // OpenRouter does not offer an embeddings API
  switch (provider) {
    case 'openai':
      return new OpenAIModel();
    case 'gemini':
      return new GeminiModel();
    case 'openrouter':
    case 'ollama':
    default:
      return new OllamaModel('nomic-embed-text');
  }
}

export { BaseModel } from './baseModel';
export { OpenAIModel } from './openaiModel';
export { GeminiModel } from './geminiModel';
export { OllamaModel } from './ollamaModel';
export { OpenRouterModel } from './openRouterModel';