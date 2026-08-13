/**
 * TIMPS Desktop - Provider service
 * Service for managing LLM providers.
 */

import { api } from '../api';
import type { SemanticEntry } from '../api';

export interface Provider {
  name: string;
  label: string;
  defaultModel: string;
  url: string;
  requiresKey: boolean;
  isLocal: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    name: 'ollama',
    label: 'Ollama (local)',
    defaultModel: 'qwen2.5-coder:7b',
    url: 'http://localhost:11434',
    requiresKey: false,
    isLocal: true,
  },
  {
    name: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o',
    url: 'https://api.openai.com/v1',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'anthropic',
    label: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-4-5',
    url: 'https://api.anthropic.com',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'xai',
    label: 'xAI (Grok)',
    defaultModel: 'grok-2',
    url: 'https://api.x.ai/v1',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    url: 'https://api.deepseek.com/v1',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'mistral',
    label: 'Mistral',
    defaultModel: 'mistral-large-latest',
    url: 'https://api.mistral.ai/v1',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'openrouter/auto',
    url: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'groq',
    label: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'together',
    label: 'Together AI',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    url: 'https://api.together.xyz/v1',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'fireworks',
    label: 'Fireworks AI',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    url: 'https://api.fireworks.ai/inference/v1',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'perplexity',
    label: 'Perplexity',
    defaultModel: 'sonar',
    url: 'https://api.perplexity.ai',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'lmstudio',
    label: 'LM Studio (local)',
    defaultModel: 'local-model',
    url: 'http://localhost:1234/v1',
    requiresKey: false,
    isLocal: true,
  },
  {
    name: 'jan',
    label: 'Jan (local)',
    defaultModel: 'local-model',
    url: 'http://localhost:1337/v1',
    requiresKey: false,
    isLocal: true,
  },
  {
    name: 'vllm',
    label: 'vLLM (local)',
    defaultModel: 'local-model',
    url: 'http://localhost:8000/v1',
    requiresKey: false,
    isLocal: true,
  },
];

export class ProviderService {
  private currentProvider: string;
  private currentModel: string;

  constructor() {
    this.currentProvider = localStorage.getItem('timps:provider') || 'ollama';
    this.currentModel = localStorage.getItem('timps:model') || this.getProvider()?.defaultModel || 'gpt-4o';
  }

  getProvider(name?: string): Provider | undefined {
    return PROVIDERS.find(p => p.name === (name || this.currentProvider));
  }

  getAllProviders(): Provider[] {
    return PROVIDERS;
  }

  getLocalProviders(): Provider[] {
    return PROVIDERS.filter(p => p.isLocal);
  }

  getCloudProviders(): Provider[] {
    return PROVIDERS.filter(p => !p.isLocal);
  }

  setProvider(name: string): void {
    const provider = this.getProvider(name);
    if (!provider) {
      throw new Error(`Unknown provider: ${name}`);
    }
    this.currentProvider = name;
    this.currentModel = provider.defaultModel;
    localStorage.setItem('timps:provider', name);
    localStorage.setItem('timps:model', this.currentModel);
  }

  setModel(model: string): void {
    this.currentModel = model;
    localStorage.setItem('timps:model', model);
  }

  getCurrentProvider(): string {
    return this.currentProvider;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  requiresApiKey(provider?: string): boolean {
    return this.getProvider(provider)?.requiresKey || false;
  }

  getApiKey(provider?: string): string | null {
    const name = provider || this.currentProvider;
    const keyMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      xai: 'XAI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      mistral: 'MISTRAL_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      groq: 'GROQ_API_KEY',
      together: 'TOGETHER_API_KEY',
      fireworks: 'FIREWORKS_API_KEY',
      perplexity: 'PERPLEXITY_API_KEY',
    };
    const key = keyMap[name];
    return key ? localStorage.getItem(key) : null;
  }
}

export const providerService = new ProviderService();