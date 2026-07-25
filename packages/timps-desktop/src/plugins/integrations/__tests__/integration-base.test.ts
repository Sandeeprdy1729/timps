import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  IntegrationBase,
  IntegrationRegistry,
  globalRegistry,
  createIntegration,
  type AuthConfig,
  type IntegrationConfig,
} from '../integration-base.js';

class TestIntegration extends IntegrationBase {
  async authenticate(config: AuthConfig): Promise<boolean> {
    this.setAccessToken(config.accessToken || '');
    this.setApiKey(config.apiKey || '');
    return true;
  }

  async testConnection(): Promise<boolean> {
    return this.isAuthenticated();
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    return { action, ...params };
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    return { resource, options };
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.apiKey = null;
    this.config = null;
  }

  public async callApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.apiCall<T>(endpoint, options);
  }

  public async callRetry<T>(fn: () => Promise<T>): Promise<T> {
    return this.withRetry<T>(fn);
  }

  public async callCheckRateLimit(key: string, cost?: number): Promise<boolean> {
    return this.checkRateLimit(key, cost);
  }

  public callCreateRateLimitBucket(key: string, maxTokens?: number, refillRate?: number): void {
    this.createRateLimitBucket(key, maxTokens, refillRate);
  }

  public callEmit(event: string, data: unknown): void {
    this.emit(event, data);
  }
}

function makeFetchMock(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('IntegrationBase', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should set manifest from 5 constructor params', () => {
      const integration = new TestIntegration('gh', 'GitHub', '1.0.0', 'GitHub integration', ['vcs']);
      expect(integration.manifest.id).toBe('gh');
      expect(integration.manifest.name).toBe('GitHub');
      expect(integration.manifest.version).toBe('1.0.0');
      expect(integration.manifest.description).toBe('GitHub integration');
      expect(integration.manifest.keywords).toEqual(['vcs']);
    });

    it('should default capabilities to empty object', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      expect(integration.capabilities).toEqual({});
    });
  });

  describe('authentication', () => {
    it('should not be authenticated by default', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      expect(integration.isAuthenticated()).toBe(false);
    });

    it('should be authenticated after setAccessToken', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      integration.setAccessToken('tok_abc');
      expect(integration.isAuthenticated()).toBe(true);
    });

    it('should be authenticated after setApiKey', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      integration.setApiKey('key_123');
      expect(integration.isAuthenticated()).toBe(true);
    });

    it('should call authenticate via subclass', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const result = await integration.authenticate({ type: 'oauth2', accessToken: 'tok' });
      expect(result).toBe(true);
      expect(integration.isAuthenticated()).toBe(true);
    });
  });

  describe('config', () => {
    it('should set and get config', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const config: IntegrationConfig = {
        id: 'cfg1',
        name: 'My Config',
        type: 'github',
        auth: { type: 'oauth2', accessToken: 'tok_xyz' },
      };
      integration.setConfig(config);
      expect(integration.getConfig()).toBe(config);
      expect(integration.isAuthenticated()).toBe(true);
    });

    it('should return null config initially', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      expect(integration.getConfig()).toBeNull();
    });

    it('should set apiKey from config.auth.apiKey', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      integration.setConfig({
        id: 'c1',
        name: 'C',
        type: 'test',
        auth: { type: 'apiKey', apiKey: 'ak_123' },
      });
      expect(integration.isAuthenticated()).toBe(true);
    });
  });

  describe('apiCall', () => {
    it('should call fetch with endpoint and merge auth headers', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      integration.setAccessToken('tok_abc');

      global.fetch = makeFetchMock(200, { ok: true });

      await integration.callApi('https://api.example.com/data');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (global.fetch as any).mock.calls[0];
      expect(url).toBe('https://api.example.com/data');
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer tok_abc',
      });
    });

    it('should merge custom headers via options', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      global.fetch = makeFetchMock(200, {});

      await integration.callApi('https://api.example.com/x', {
        headers: { 'X-Custom': 'val' },
      });

      const [, init] = (global.fetch as any).mock.calls[0];
      expect(init.headers).toMatchObject({ 'X-Custom': 'val' });
    });

    it('should set X-API-Key when apiKey is set', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      integration.setApiKey('ak_123');
      global.fetch = makeFetchMock(200, {});

      await integration.callApi('https://api.example.com/x');

      const [, init] = (global.fetch as any).mock.calls[0];
      expect(init.headers).toMatchObject({ 'X-API-Key': 'ak_123' });
    });

    it('should throw on non-ok response', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      global.fetch = makeFetchMock(500, { error: 'Internal Server Error' });

      await expect(integration.callApi('https://api.example.com/fail')).rejects.toThrow(
        'API error: 500',
      );
    });

    it('should throw on 404', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      global.fetch = makeFetchMock(404, { error: 'Not Found' });

      await expect(integration.callApi('https://api.example.com/missing')).rejects.toThrow(
        'API error: 404',
      );
    });

    it('should throw on 403', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      global.fetch = makeFetchMock(403, { error: 'Forbidden' });

      await expect(integration.callApi('https://api.example.com/denied')).rejects.toThrow(
        'API error: 403',
      );
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const fn = vi.fn().mockResolvedValue('ok');

      const result = await integration.callRetry(fn);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      vi.spyOn(integration as any, 'sleep').mockResolvedValue(undefined);
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('recovered');

      const result = await integration.callRetry(fn);
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting retries', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      vi.spyOn(integration as any, 'sleep').mockResolvedValue(undefined);
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      await expect(integration.callRetry(fn)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('rate limiting', () => {
    it('should allow calls when no bucket is configured', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      expect(await integration.callCheckRateLimit('api')).toBe(true);
    });

    it('should allow calls when bucket has tokens', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      integration.callCreateRateLimitBucket('api', 100, 10);
      expect(await integration.callCheckRateLimit('api', 1)).toBe(true);
    });

    it('should track bucket in getStatus', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      integration.callCreateRateLimitBucket('api');
      const status = integration.getStatus();
      expect(status.rateLimits).toContain('api');
    });
  });

  describe('events', () => {
    it('should register and call listeners', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const handler = vi.fn();
      integration.on('test-event', handler);
      integration.callEmit('test-event', { data: 42 });
      expect(handler).toHaveBeenCalledWith({ data: 42 });
    });

    it('should unregister listeners with off', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const handler = vi.fn();
      integration.on('ev', handler);
      integration.off('ev', handler);
      integration.callEmit('ev', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not throw on listener errors', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      integration.on('ev', () => { throw new Error('listener crash'); });
      expect(() => integration.callEmit('ev', {})).not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('validateConfig', () => {
    it('should reject config without name', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const result = integration.validateConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should reject config without type', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const result = integration.validateConfig({ name: 'X' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Type is required');
    });

    it('should reject OAuth config without clientId', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const result = integration.validateConfig({
        name: 'X',
        type: 'oauth2',
        auth: { type: 'oauth2' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('OAuth requires clientId');
    });

    it('should accept valid config', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const result = integration.validateConfig({
        name: 'X',
        type: 'github',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getStatus', () => {
    it('should report unauthenticated when no credentials', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const status = integration.getStatus();
      expect(status.authenticated).toBe(false);
      expect(status.config).toBe(false);
      expect(status.rateLimits).toEqual([]);
    });

    it('should report authenticated and configured', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      integration.setAccessToken('tok');
      integration.setConfig({
        id: 'c1',
        name: 'C',
        type: 'test',
        auth: { type: 'bearer', accessToken: 'tok' },
      });
      const status = integration.getStatus();
      expect(status.authenticated).toBe(true);
      expect(status.config).toBe(true);
    });
  });

  describe('getHealth', () => {
    it('should return healthy by default', () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      expect(integration.getHealth().status).toBe('healthy');
    });
  });

  describe('cleanup', () => {
    it('should clear credentials', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      integration.setAccessToken('tok');
      integration.setApiKey('key');
      expect(integration.isAuthenticated()).toBe(true);
      await integration.cleanup();
      expect(integration.isAuthenticated()).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return true when authenticated', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      integration.setAccessToken('tok');
      expect(await integration.testConnection()).toBe(true);
    });
  });

  describe('fetchData', () => {
    it('should return resource and options', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const result = await integration.fetchData('users', { limit: 10 });
      expect(result).toEqual({ resource: 'users', options: { limit: 10 } });
    });
  });

  describe('executeAction', () => {
    it('should return action and params', async () => {
      const integration = new TestIntegration('t', 'T', '0.1', 'test', []);
      const result = await integration.executeAction('create', { name: 'test' });
      expect(result).toEqual({ action: 'create', name: 'test' });
    });
  });
});

describe('IntegrationRegistry', () => {
  it('should register and list integrations', () => {
    const registry = new IntegrationRegistry();
    const integration = new TestIntegration('gh', 'GitHub', '1.0.0', 'GitHub', ['vcs']);
    registry.register('github', integration);
    expect(registry.list()).toContain('github');
  });

  it('should get registered integration', () => {
    const registry = new IntegrationRegistry();
    const integration = new TestIntegration('gh', 'GitHub', '1.0.0', 'GitHub', ['vcs']);
    registry.register('github', integration);
    expect(registry.get('github')).toBe(integration);
  });

  it('should unregister integration', () => {
    const registry = new IntegrationRegistry();
    registry.register('github', new TestIntegration('gh', 'GitHub', '1.0.0', 'GitHub', ['vcs']));
    expect(registry.unregister('github')).toBe(true);
    expect(registry.get('github')).toBeUndefined();
  });

  it('should return false when unregistering non-existent', () => {
    const registry = new IntegrationRegistry();
    expect(registry.unregister('nope')).toBe(false);
  });

  it('should connect and disconnect', async () => {
    const registry = new IntegrationRegistry();
    const integration = new TestIntegration('gh', 'GitHub', '1.0.0', 'GitHub', ['vcs']);
    registry.register('github', integration);

    const config: IntegrationConfig = {
      id: 'conn1',
      name: 'My GitHub',
      type: 'github',
      auth: { type: 'oauth2', accessToken: 'tok' },
    };

    const connected = await registry.connect('github', config);
    expect(connected).toBe(true);
    expect(registry.getConnection('conn1')).toBe(config);
    expect(registry.getConnections()).toHaveLength(1);

    const disconnected = await registry.disconnect('conn1');
    expect(disconnected).toBe(true);
    expect(registry.getConnection('conn1')).toBeUndefined();
  });

  it('should return false when connecting non-existent integration', async () => {
    const registry = new IntegrationRegistry();
    const result = await registry.connect('nope', {
      id: 'c1', name: 'C', type: 'nope', auth: { type: 'apiKey', apiKey: 'k' },
    });
    expect(result).toBe(false);
  });

  it('should return false when disconnecting non-existent connection', async () => {
    const registry = new IntegrationRegistry();
    expect(await registry.disconnect('nope')).toBe(false);
  });

  it('should find integrations by type', () => {
    const registry = new IntegrationRegistry();
    registry.register('gh', new TestIntegration('github-tool', 'GH', '1.0.0', '', []));
    registry.register('sl', new TestIntegration('slack-app', 'SL', '1.0.0', '', []));
    const results = registry.getIntegrationsByType('github');
    expect(results).toHaveLength(1);
    expect(results[0].manifest.id).toBe('github-tool');
  });
});

describe('createIntegration', () => {
  it('should create a concrete IntegrationBase from manifest', () => {
    const integration = createIntegration({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      description: 'A test integration',
      author: 'Test',
      main: 'index.js',
      keywords: ['test'],
    });

    expect(integration.manifest.id).toBe('test');
    expect(integration.manifest.name).toBe('Test');
  });

  it('should apply custom retry config', () => {
    const integration = createIntegration(
      { id: 't', name: 'T', version: '0.1', description: '', author: '', main: '', keywords: [] },
      { retry: { maxRetries: 5 } },
    );
    expect((integration as any).retryConfig.maxRetries).toBe(5);
  });

  it('should authenticate via setAccessToken', async () => {
    const integration = createIntegration({
      id: 't', name: 'T', version: '0.1', description: '', author: '', main: '', keywords: [],
    });
    const result = await integration.authenticate({ type: 'bearer', accessToken: 'tok' });
    expect(result).toBe(true);
    expect(integration.isAuthenticated()).toBe(true);
  });
});

describe('globalRegistry singleton', () => {
  it('should be an instance of IntegrationRegistry', () => {
    expect(globalRegistry).toBeInstanceOf(IntegrationRegistry);
  });
});
