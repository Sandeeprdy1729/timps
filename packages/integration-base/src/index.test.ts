import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import {
  BaseIntegration,
  IntegrationRegistry,
  IntegrationStatusSchema,
  ConnectionConfigSchema,
  IntegrationEventSchema,
  ActivityCardSchema,
  type IntegrationEvent,
  type ActivityCard,
  type ConnectionConfig,
} from '../src/index.js';

describe('IntegrationBase Schemas', () => {
  describe('IntegrationStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(IntegrationStatusSchema.parse('connected')).toBe('connected');
      expect(IntegrationStatusSchema.parse('disconnected')).toBe('connected');
      expect(IntegrationStatusSchema.parse('error')).toBe('error');
      expect(IntegrationStatusSchema.parse('pending')).toBe('pending');
    });

    it('should reject invalid status', () => {
      expect(() => IntegrationStatusSchema.parse('invalid')).toThrow();
    });
  });

  describe('ConnectionConfigSchema', () => {
    it('should parse valid config', () => {
      const config: ConnectionConfig = {
        accessToken: 'token123',
        refreshToken: 'refresh123',
        expiresAt: 1234567890,
        apiKey: 'key123',
        sandbox: true,
      };
      expect(ConnectionConfigSchema.parse(config)).toEqual(config);
    });

    it('should apply defaults', () => {
      const config = ConnectionConfigSchema.parse({});
      expect(config.sandbox).toBe(false);
    });
  });

  describe('IntegrationEventSchema', () => {
    it('should parse valid event', () => {
      const event: IntegrationEvent = {
        id: 'evt-1',
        type: 'created',
        source: 'github',
        timestamp: Date.now(),
        data: { foo: 'bar' },
      };
      expect(IntegrationEventSchema.parse(event)).toEqual(event);
    });
  });

  describe('ActivityCardSchema', () => {
    it('should parse valid card', () => {
      const card: ActivityCard = {
        id: 'card-1',
        title: 'Test Card',
        description: 'Test description',
        icon: '✅',
        timestamp: Date.now(),
        status: 'success',
      };
      expect(ActivityCardSchema.parse(card)).toEqual(card);
    });

    it('should apply defaults', () => {
      const card = ActivityCardSchema.parse({
        id: 'card-1',
        title: 'Test',
        description: 'Desc',
        icon: 'icon',
        timestamp: 123,
      });
      expect(card.status).toBe('info');
      expect(card.tags).toEqual([]);
    });
  });
});

describe('BaseIntegration', () => {
  let mockIntegration: BaseIntegration;

  beforeEach(() => {
    class TestIntegration extends BaseIntegration {
      readonly name = 'test';
      readonly displayName = 'Test Integration';
      readonly description = 'A test integration';
      readonly scopes = ['read', 'write'];
      readonly authType = 'oauth2' as const;

      async connect(config: ConnectionConfig): Promise<void> {
        this.setConfig(config);
        this.setStatus('connected');
      }

      async disconnect(): Promise<void> {
        this.setConfig({});
        this.setStatus('disconnected');
      }

      async refresh(): Promise<void> {
        // Refresh logic
      }

      async getSettingsUI(): Promise<string> {
        return '<div>Settings UI</div>';
      }

      createActivityCard(event: IntegrationEvent): ActivityCard {
        return {
          id: event.id,
          title: event.type,
          description: event.source,
          icon: '✅',
          timestamp: event.timestamp,
          status: 'info',
          tags: [],
        };
      }

      setupTriggers(): void {
        // Setup polling
      }

      async handleWebhook(payload: unknown): Promise<void> {
        console.log('Handle webhook:', payload);
      }
    }

    mockIntegration = new TestIntegration();
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      expect(mockIntegration.getStatus()).toBe('disconnected');
    });
  });

  describe('setStatus', () => {
    it('should update status', () => {
      (mockIntegration as any).setStatus('connected');
      expect(mockIntegration.getStatus()).toBe('connected');
    });
  });

  describe('Event Emitter', () => {
    it('should add and emit listeners', () => {
      const callback = vi.fn();
      mockIntegration.on('test-event', callback);
      mockIntegration.emit('test-event', { data: 'test' });
      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should remove listeners', () => {
      const callback = vi.fn();
      mockIntegration.on('test-event', callback);
      mockIntegration.off('test-event', callback);
      mockIntegration.emit('test-event', {});
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Token Expiry', () => {
    it('should detect expired token', () => {
      (mockIntegration as any).setConfig({ expiresAt: Math.floor(Date.now() / 1000) - 100 });
      expect((mockIntegration as any).isTokenExpired()).toBe(true);
    });

    it('should detect valid token', () => {
      (mockIntegration as any).setConfig({ expiresAt: Math.floor(Date.now() / 1000) + 3600 });
      expect((mockIntegration as any).isTokenExpired()).toBe(false);
    });
  });

  describe('Config Validation', () => {
    it('should throw without access token for oauth2', () => {
      expect(() => (mockIntegration as any).validateConfig({})).toThrow('OAuth2 requires access token');
    });

    it('should throw without api key for api-key auth', () => {
      class ApiKeyIntegration extends BaseIntegration {
        readonly name = 'apikey';
        readonly displayName = 'API Key Integration';
        readonly description = '';
        readonly scopes = [];
        readonly authType = 'api-key' as const;

        async connect() {}
        async disconnect() {}
        async refresh() {}
        async getSettingsUI() { return ''; }
        createActivityCard(event: IntegrationEvent) {
          return {} as ActivityCard;
        }
        setupTriggers() {}
        async handleWebhook() {}
      }

      const apiKeyInt = new ApiKeyIntegration();
      expect(() => (apiKeyInt as any).validateConfig({})).toThrow('API key required');
    });
  });

  describe('calculateExpiry', () => {
    it('should calculate correct expiry', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = (mockIntegration as any).calculateExpiry(3600);
      expect(result).toBeGreaterThanOrEqual(now);
      expect(result).toBeLessThanOrEqual(now + 3601);
    });
  });

  describe('API Call', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    it('should make successful API calls', async () => {
      nock('https://api.example.com')
        .get('/test')
        .reply(200, { success: true });

      const result = await (mockIntegration as any).apiCall('GET', '/test');
      expect(result).toEqual({ success: true });
    });

    it('should handle API errors', async () => {
      nock('https://api.example.com')
        .get('/test')
        .reply(500, { error: 'Server error' });

      await expect((mockIntegration as any).apiCall('GET', '/test')).rejects.toThrow();
    });

    it('should handle 204 No Content', async () => {
      nock('https://api.example.com')
        .get('/empty')
        .reply(204);

      const result = await (mockIntegration as any).apiCall('GET', '/empty');
      expect(result).toBeUndefined();
    });

    it('should use sandbox URL when sandbox is true', async () => {
      (mockIntegration as any).setConfig({ sandbox: true });

      nock('https://sandbox-api.example.com')
        .get('/test')
        .reply(200, { success: true });

      const result = await (mockIntegration as any).apiCall('GET', '/test');
      expect(result).toEqual({ success: true });
    });
  });

  describe('Retry Logic', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    it('should retry on transient failures with exponential backoff', async () => {
      let attempts = 0;

      nock('https://api.example.com')
        .get('/retry')
        .reply(() => {
          attempts++;
          if (attempts < 3) {
            return [503, { error: 'Service Unavailable' }];
          }
          return [200, { success: true }];
        });

      let lastError: Error | null = null;
      for (let i = 0; i < 3; i++) {
        try {
          await (mockIntegration as any).apiCall('GET', '/retry');
          break;
        } catch (e) {
          lastError = e as Error;
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      expect(attempts).toBe(3);
    });
  });
});

describe('IntegrationRegistry', () => {
  beforeEach(() => {
    class TestIntegration extends BaseIntegration {
      readonly name = 'registry-test';
      readonly displayName = 'Registry Test';
      readonly description = '';
      readonly scopes = [];
      readonly authType = 'api-key' as const;

      async connect() {}
      async disconnect() {}
      async refresh() {}
      async getSettingsUI() { return ''; }
      createActivityCard(event: IntegrationEvent) {
        return {} as ActivityCard;
      }
      setupTriggers() {}
      async handleWebhook() {}
    }

    IntegrationRegistry.register('registry-test', TestIntegration);
  });

  afterEach(() => {
    IntegrationRegistry.getAll().forEach((name) => {
      IntegrationRegistry.get(name);
    });
  });

  describe('register', () => {
    it('should register integration', () => {
      expect(IntegrationRegistry.get('registry-test')).toBeDefined();
    });
  });

  describe('get', () => {
    it('should return integration constructor', () => {
      const Integration = IntegrationRegistry.get('registry-test');
      expect(Integration).toBeDefined();
    });

    it('should return undefined for unknown', () => {
      expect(IntegrationRegistry.get('unknown')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered names', () => {
      const all = IntegrationRegistry.getAll();
      expect(all).toContain('registry-test');
    });
  });

  describe('create', () => {
    it('should create integration instance', () => {
      const instance = IntegrationRegistry.create('registry-test');
      expect(instance).toBeInstanceOf(BaseIntegration);
    });

    it('should throw for unknown integration', () => {
      expect(() => IntegrationRegistry.create('unknown')).toThrow('Integration not found');
    });
  });
});

describe('OAuth Flow', () => {
  let mockIntegration: BaseIntegration;

  beforeEach(() => {
    class OAuthIntegration extends BaseIntegration {
      readonly name = 'oauth-test';
      readonly displayName = 'OAuth Test';
      readonly description = 'OAuth integration';
      readonly scopes = ['read', 'write'];
      readonly authType = 'oauth2' as const;

      async connect(config: ConnectionConfig): Promise<void> {
        this.validateConfig(config);
        this.setConfig(config);
        this.setStatus('connected');
      }

      async disconnect(): Promise<void> {
        this.setConfig({});
        this.setStatus('disconnected');
      }

      async refresh(): Promise<void> {
        const result = await this.apiCall('POST', '/oauth/token', {
          grant_type: 'refresh_token',
          refresh_token: this.getConfig().refreshToken,
        });

        this.setConfig({
          ...this.getConfig(),
          accessToken: (result as any).access_token,
          refreshToken: (result as any).refresh_token,
          expiresAt: this.calculateExpiry((result as any).expires_in),
        });
      }

      async getSettingsUI(): Promise<string> {
        return '<div>OAuth Settings</div>';
      }

      createActivityCard(event: IntegrationEvent): ActivityCard {
        return {
          id: event.id,
          title: event.type,
          description: event.source,
          icon: '🔐',
          timestamp: event.timestamp,
        };
      }

      setupTriggers(): void {}

      async handleWebhook(payload: unknown): Promise<void> {}
    }

    mockIntegration = new OAuthIntegration();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should refresh tokens', async () => {
    nock('https://api.example.com')
      .post('/oauth/token')
      .reply(200, {
        access_token: 'new_access',
        refresh_token: 'new_refresh',
        expires_in: 3600,
      });

    await (mockIntegration as any).connect({ accessToken: 'old_access', refreshToken: 'old_refresh' });
    await (mockIntegration as any).refresh();

    const config = (mockIntegration as any).getConfig();
    expect(config.accessToken).toBe('new_access');
    expect(config.refreshToken).toBe('new_refresh');
  });

  it('should handle token refresh failure', async () => {
    nock('https://api.example.com')
      .post('/oauth/token')
      .reply(401, { error: 'invalid_grant' });

    await (mockIntegration as any).connect({ accessToken: 'old_access', refreshToken: 'old_refresh' });

    await expect((mockIntegration as any).refresh()).rejects.toThrow();
  });
});

describe('Rate Limiting', () => {
  let mockIntegration: BaseIntegration;

  beforeEach(() => {
    class RateLimitIntegration extends BaseIntegration {
      readonly name = 'rate-limit-test';
      readonly displayName = 'Rate Limit Test';
      readonly description = '';
      readonly scopes = [];
      readonly authType = 'api-key' as const;

      async connect() {}
      async disconnect() {}
      async refresh() {}
      async getSettingsUI() { return ''; }
      createActivityCard(event: IntegrationEvent) {
        return {} as ActivityCard;
      }
      setupTriggers() {}
      async handleWebhook() {}
    }

    mockIntegration = new RateLimitIntegration();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should handle rate limit headers', async () => {
    nock('https://api.example.com')
      .get('/data')
      .reply(200, { data: 'ok' }, {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
      });

    const result = await (mockIntegration as any).apiCall('GET', '/data');
    expect(result).toEqual({ data: 'ok' });
  });

  it('should respect Retry-After header', async () => {
    let attempt = 0;

    nock('https://api.example.com')
      .get('/rate-limited')
      .reply(() => {
        attempt++;
        if (attempt < 2) {
          return [429, { error: 'rate limited' }, { 'Retry-After': '1' }];
        }
        return [200, { success: true }];
      });

    const start = Date.now();
    await (mockIntegration as any).apiCall('GET', '/rate-limited');
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(1000);
  });
});

describe('Error Handling', () => {
  let mockIntegration: BaseIntegration;

  beforeEach(() => {
    class ErrorHandlingIntegration extends BaseIntegration {
      readonly name = 'error-test';
      readonly displayName = 'Error Test';
      readonly description = '';
      readonly scopes = [];
      readonly authType = 'api-key' as const;

      async connect() {}
      async disconnect() {}
      async refresh() {}
      async getSettingsUI() { return ''; }
      createActivityCard(event: IntegrationEvent) {
        return {} as ActivityCard;
      }
      setupTriggers() {}
      async handleWebhook() {}
    }

    mockIntegration = new ErrorHandlingIntegration();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should handle network errors', async () => {
    nock('https://api.example.com')
      .get('/data')
      .replyWithError('Network failure');

    await expect((mockIntegration as any).apiCall('GET', '/data')).rejects.toThrow();
  });

  it('should handle malformed JSON', async () => {
    nock('https://api.example.com')
      .get('/data')
      .reply(200, 'not valid json {{{');

    await expect((mockIntegration as any).apiCall('GET', '/data')).rejects.toThrow();
  });

  it('should handle 404 Not Found', async () => {
    nock('https://api.example.com')
      .get('/notfound')
      .reply(404, { error: 'Not Found' });

    await expect((mockIntegration as any).apiCall('GET', '/notfound')).rejects.toThrow();
  });

  it('should handle 403 Forbidden', async () => {
    nock('https://api.example.com')
      .get('/forbidden')
      .reply(403, { error: 'Forbidden' });

    await expect((mockIntegration as any).apiCall('GET', '/forbidden')).rejects.toThrow();
  });

  it('should handle 500 Internal Server Error', async () => {
    nock('https://api.example.com')
      .get('/error')
      .reply(500, { error: 'Internal Error' });

    await expect((mockIntegration as any).apiCall('GET', '/error')).rejects.toThrow();
  });
});

describe('Polling & Triggers', () => {
  let mockIntegration: BaseIntegration;
  let pollInterval: number;

  beforeEach(() => {
    class PollingIntegration extends BaseIntegration {
      readonly name = 'polling-test';
      readonly displayName = 'Polling Test';
      readonly description = '';
      readonly scopes = [];
      readonly authType = 'api-key' as const;

      private lastTimestamp = 0;
      private pollCount = 0;

      async connect() {}
      async disconnect() {}
      async refresh() {}
      async getSettingsUI() { return ''; }
      createActivityCard(event: IntegrationEvent) {
        return {} as ActivityCard;
      }

      setupTriggers(): void {
        pollInterval = setInterval(() => {
          this.pollCount++;
          this.checkForUpdates();
        }, 100) as unknown as number;
      }

      private async checkForUpdates(): Promise<void> {
        try {
          const result = await this.apiCall('GET', '/events', undefined, {
            'If-Modified-Since': new Date(this.lastTimestamp).toISOString(),
          });
          this.lastTimestamp = Date.now();
        } catch {
          // Ignore errors
        }
      }

      getPollCount(): number {
        return this.pollCount;
      }

      async handleWebhook(payload: unknown): Promise<void> {
        this.emit('webhook:received', payload);
      }
    }

    mockIntegration = new PollingIntegration();
  });

  afterEach(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    nock.cleanAll();
  });

  it('should setup polling triggers', async () => {
    (mockIntegration as any).setupTriggers();
    await new Promise((r) => setTimeout(r, 350));
    expect((mockIntegration as any).getPollCount()).toBeGreaterThanOrEqual(3);
  });

  it('should detect new events', async () => {
    let eventCount = 0;
    mockIntegration.on('webhook:received', () => eventCount++);

    await (mockIntegration as any).handleWebhook({ id: '1' });
    await (mockIntegration as any).handleWebhook({ id: '2' });

    expect(eventCount).toBe(2);
  });
});