import type { ModelProvider, ProviderName } from '../config/types.js';
import { loadConfig, getApiKey } from '../config/config.js';
import { createClaudeProvider } from './claude.js';
import { createOpenAIProvider, createOpenRouterProvider, createDeepSeekProvider, createGroqProvider } from './openai.js';
import { createGeminiProvider } from './gemini.js';
import { createOllamaProvider, listOllamaModels, isCodeModel } from './ollama.js';
import { ProviderMesh, getProviderMesh } from './providerMesh.js';

export { createOllamaProvider, listOllamaModels, isCodeModel };
export { createClaudeProvider } from './claude.js';
export { createOpenAIProvider, createOpenRouterProvider, createDeepSeekProvider, createGroqProvider } from './openai.js';
export { createGeminiProvider } from './gemini.js';
export { ProviderMesh, getProviderMesh };

export function createProvider(provider?: ProviderName, model?: string): ModelProvider {
  const config = loadConfig();
  const name: ProviderName = provider || config.defaultProvider;

  switch (name) {
    case 'claude': {
      const key = getApiKey(config, 'claude');
      if (!key) throw new Error('Missing ANTHROPIC_API_KEY. Run: timps --setup');
      return createClaudeProvider(key, model || config.defaultModel);
    }
    case 'openai': {
      const key = getApiKey(config, 'openai');
      if (!key) throw new Error('Missing OPENAI_API_KEY. Run: timps --setup');
      return createOpenAIProvider({ apiKey: key, model: model || config.defaultModel });
    }
    case 'gemini': {
      const key = getApiKey(config, 'gemini');
      if (!key) throw new Error('Missing GEMINI_API_KEY. Run: timps --setup');
      return createGeminiProvider(key, model || config.defaultModel);
    }
    case 'ollama': {
      const resolvedModel = model || config.defaultModel || 'llama3.2:1b';
      return createOllamaProvider(config.ollamaUrl, resolvedModel);
    }
    case 'openrouter': {
      const key = getApiKey(config, 'openrouter');
      if (!key) throw new Error('Missing OPENROUTER_API_KEY. Run: timps --setup');
      return createOpenRouterProvider(key, model || config.defaultModel);
    }
    case 'deepseek': {
      const key = getApiKey(config, 'deepseek');
      if (!key) throw new Error('Missing DEEPSEEK_API_KEY. Run: timps --setup');
      return createDeepSeekProvider(key, model || config.defaultModel);
    }
    case 'groq': {
      const key = getApiKey(config, 'groq');
      if (!key) throw new Error('Missing GROQ_API_KEY. Run: timps --setup');
      return createGroqProvider(key, model || config.defaultModel);
    }
    case 'hybrid': {
      const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
      return createOllamaProvider(ollamaUrl, model || config.defaultModel || 'llama3.2:1b');
    }
    default:
      throw new Error(`Unknown provider: ${name}. Valid: claude, openai, gemini, ollama, openrouter, deepseek, groq`);
  }
}