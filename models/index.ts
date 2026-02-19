import { BaseModel } from './baseModel';
import { OpenAIModel } from './openaiModel';
import { GeminiModel } from './geminiModel';
import { OllamaModel } from './ollamaModel';
import { config } from '../config/env';

export type ModelProvider = 'openai' | 'gemini' | 'ollama';

export function createModel(provider?: ModelProvider): BaseModel {
  const selectedProvider = provider || config.models.defaultProvider;
  
  switch (selectedProvider) {
    case 'openai':
      if (!config.models.openai?.apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      return new OpenAIModel();
    
    case 'gemini':
      if (!config.models.gemini?.apiKey) {
        throw new Error('Gemini API key not configured');
      }
      return new GeminiModel();
    
    case 'ollama':
      return new OllamaModel();
    
    default:
      throw new Error(`Unknown model provider: ${selectedProvider}`);
  }
}

export function createEmbeddingModel(provider: ModelProvider = 'ollama'): BaseModel {
  switch (provider) {
    case 'openai':
      return new OpenAIModel();
    
    case 'gemini':
      return new GeminiModel();
    
    case 'ollama':
      return new OllamaModel('nomic-embed-text'); // embedding model
    
    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}

export { BaseModel } from './baseModel';
export { OpenAIModel } from './openaiModel';
export { GeminiModel } from './geminiModel';
export { OllamaModel } from './ollamaModel';
