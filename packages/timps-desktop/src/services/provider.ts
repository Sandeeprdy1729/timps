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
    name: 'claude',
    label: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-4-5',
    url: 'https://api.anthropic.com',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    url: 'https://generativelanguage.googleapis.com',
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
    name: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'anthropic/claude-sonnet-4-5',
    url: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    isLocal: false,
  },
  {
    name: 'groq',
    label: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com',
    requiresKey: true,
    isLocal: false,
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
      claude: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      groq: 'GROQ_API_KEY',
    };
    const key = keyMap[name];
    return key ? localStorage.getItem(key) : null;
  }
}

export const providerService = new ProviderService();