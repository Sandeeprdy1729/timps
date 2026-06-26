import type { Provider, ProviderConfig } from './types.js';

export type Runtime = 'node' | 'bun' | 'deno';

export function detectRuntime(): Runtime {
  if (typeof (globalThis as any).Bun !== 'undefined') return 'bun';
  if (typeof (globalThis as any).Deno !== 'undefined') return 'deno';
  return 'node';
}

export function resolveProviderConfig(provider: Provider): ProviderConfig | null {
  if (!provider) return null;

  if (typeof provider === 'string') {
    switch (provider) {
      case 'ollama':
        return { name: 'ollama', baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' };
      case 'openai':
        return { name: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'text-embedding-3-small' };
      case 'anthropic':
        return { name: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514' };
      default:
        return null;
    }
  }

  return {
    name: provider.name,
    apiKey: provider.apiKey,
    model: provider.model ?? defaultModelFor(provider.name),
    baseUrl: provider.baseUrl ?? defaultBaseUrlFor(provider.name),
  };
}

function defaultModelFor(name: string): string {
  switch (name) {
    case 'ollama': return 'nomic-embed-text';
    case 'openai': return 'text-embedding-3-small';
    case 'anthropic': return 'claude-sonnet-4-20250514';
    default: return 'nomic-embed-text';
  }
}

function defaultBaseUrlFor(name: string): string {
  switch (name) {
    case 'ollama': return 'http://localhost:11434';
    case 'openai': return 'https://api.openai.com/v1';
    case 'anthropic': return 'https://api.anthropic.com/v1';
    default: return 'http://localhost:11434';
  }
}
