// ── Model Factory ──
import type { ModelProvider, ProviderName } from '../types.js';
import { loadConfig, getApiKey } from '../config.js';
import { createClaudeProvider } from './claude.js';
import { createOpenAIProvider, createOpenRouterProvider } from './openai.js';
import { createGeminiProvider } from './gemini.js';
import { createOllamaProvider } from './ollama.js';
import { HybridProvider } from './hybrid.js';

export function createProvider(provider?: ProviderName, model?: string): ModelProvider {
  const config = loadConfig();
  const name = provider || config.defaultProvider;

  switch (name) {
    case 'claude': {
      const key = getApiKey(config, 'claude');
      if (!key) throw new Error('Missing Anthropic API key. Set ANTHROPIC_API_KEY or run timps --config');
      return createClaudeProvider(key, model || config.defaultModel);
    }
    case 'openai': {
      const key = getApiKey(config, 'openai');
      if (!key) throw new Error('Missing OpenAI API key. Set OPENAI_API_KEY or run timps --config');
      return createOpenAIProvider({ apiKey: key, model: model || config.defaultModel });
    }
    case 'gemini': {
      const key = getApiKey(config, 'gemini');
      if (!key) throw new Error('Missing Gemini API key. Set GEMINI_API_KEY or run timps --config');
      return createGeminiProvider(key, model || config.defaultModel);
    }
    case 'ollama': {
      return createOllamaProvider(config.ollamaUrl, model || config.defaultModel);
    }
    case 'openrouter': {
      const key = getApiKey(config, 'openrouter');
      if (!key) throw new Error('Missing OpenRouter API key. Set OPENROUTER_API_KEY or run timps --config');
      return createOpenRouterProvider(key, model || config.defaultModel);
    }
    case 'opencode': {
      // OpenCode runs locally via Ollama
      const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
      return createOllamaProvider(ollamaUrl, model || config.defaultModel || 'qwen2.5-coder:latest');
    }
    case 'timps':
    case 'timps-coder': {
      // TIMPs custom coding model via Ollama
      const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
      const timpsModel = model || config.defaultModel || 'sandeeprdy1729/timps-coder';
      return createOllamaProvider(ollamaUrl, timpsModel);
    }
    case 'hybrid': {
      const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
      const fastP = createOllamaProvider(ollamaUrl, 'qwen2.5-coder:latest');
      let heavyP: ModelProvider;
      
      const key = getApiKey(config, 'claude');
      if (key) {
        heavyP = createClaudeProvider(key, model || config.defaultModel);
      } else {
        const oApiKey = getApiKey(config, 'openai');
        if (oApiKey) {
           heavyP = createOpenAIProvider({ apiKey: oApiKey, model: model || config.defaultModel });
        } else {
           throw new Error('Hybrid mode requires a valid Claude or OpenAI key as the heavy provider.');
        }
      }
      return new HybridProvider(fastP, heavyP);
    }
    default:
      throw new Error(`Unknown provider: ${name}. Use: claude, openai, gemini, ollama, openrouter, opencode, timps, hybrid`);
  }
}

export const POPULAR_MODELS: Record<string, string[]> = {
  claude: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-opus-4-20250514'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4-turbo'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  ollama: ['qwen2.5-coder:7b', 'deepseek-r1:7b', 'codellama:13b', 'llama3.1:8b', 'mistral:7b'],
  openrouter: ['anthropic/claude-sonnet-4-20250514', 'google/gemini-2.5-flash', 'meta-llama/llama-3.1-405b-instruct'],
  opencode: ['qwen2.5-coder:latest', 'llama3.1:8b', 'mistral:latest', 'gemma3:1b', 'llama3.2:latest'],
  timps: ['sandeeprdy1729/timps-coder', 'sandeeprdy1729/timps-coder:latest'],
  hybrid: ['auto']
};

export { createClaudeProvider } from './claude.js';
export { createOpenAIProvider, createOpenRouterProvider } from './openai.js';
export { createGeminiProvider } from './gemini.js';
export { createOllamaProvider } from './ollama.js';
