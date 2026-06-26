import { describe, it, expect, vi, beforeAll } from 'vitest';

describe('@timps/sdk', () => {
  describe('runtime detection', () => {
    it('detects node runtime', async () => {
      const { detectRuntime } = await import('./defaults.js');
      expect(detectRuntime()).toBe('node');
    });
  });

  describe('provider config resolution', () => {
    it('resolves null provider', async () => {
      const { resolveProviderConfig } = await import('./defaults.js');
      expect(resolveProviderConfig(null)).toBeNull();
    });

    it('resolves undefined provider', async () => {
      const { resolveProviderConfig } = await import('./defaults.js');
      expect(resolveProviderConfig(undefined)).toBeNull();
    });

    it('resolves ollama shorthand', async () => {
      const { resolveProviderConfig } = await import('./defaults.js');
      const config = resolveProviderConfig('ollama');
      expect(config).toEqual({
        name: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'nomic-embed-text',
      });
    });

    it('resolves openai shorthand', async () => {
      const { resolveProviderConfig } = await import('./defaults.js');
      const config = resolveProviderConfig('openai');
      expect(config).toEqual({
        name: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'text-embedding-3-small',
      });
    });

    it('resolves anthropic shorthand', async () => {
      const { resolveProviderConfig } = await import('./defaults.js');
      const config = resolveProviderConfig('anthropic');
      expect(config).toEqual({
        name: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-sonnet-4-20250514',
      });
    });

    it('resolves custom provider config with overrides', async () => {
      const { resolveProviderConfig } = await import('./defaults.js');
      const config = resolveProviderConfig({
        name: 'ollama',
        apiKey: 'sk-test',
        model: 'llama3',
        baseUrl: 'http://custom:11434',
      });
      expect(config).toEqual({
        name: 'ollama',
        apiKey: 'sk-test',
        model: 'llama3',
        baseUrl: 'http://custom:11434',
      });
    });
  });

  describe('types', () => {
    it('exports Memory interface', async () => {
      const sdk = await import('./index.js');
      expect(sdk).toHaveProperty('createMemory');
      expect(typeof sdk.createMemory).toBe('function');
    });
  });

  describe('MemoryClient with InMemoryBackend (no memory-core)', () => {
    it('throws when used before initialization', async () => {
      const { MemoryClient } = await import('./MemoryClient.js');
      const client = new MemoryClient({ projectPath: '/tmp/test-sdk' });
      expect(() => (client as any).engine).toThrow('not initialized');
    });
  });
});
