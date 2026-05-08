import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

describe('IntegrationBase', () => {
  let IntegrationBase: any;
  
  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../integration-base.js');
    IntegrationBase = module.IntegrationBase;
  });

  describe('OAuth Flow', () => {
    it('should handle OAuth token refresh', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .post('/oauth/token')
        .reply(200, {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
        });

      const result = await mockIntegration.apiCall('POST', '/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: 'old_refresh_token',
      });
      
      expect(result).toBeDefined();
    });

    it('should handle OAuth failure gracefully', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .post('/oauth/token')
        .reply(401, { error: 'invalid_grant' });

      await expect(
        mockIntegration.apiCall('POST', '/oauth/token', {})
      ).rejects.toThrow();
    });
  });

  describe('Token Refresh Logic', () => {
    it('should detect expired tokens and refresh', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      let callCount = 0;
      
      nock('https://api.example.com')
        .persist()
        .get('/data')
        .reply(() => {
          callCount++;
          if (callCount === 1) {
            return [401, { error: 'token_expired' }];
          }
          return [200, { data: 'success' }];
        });

      await mockIntegration.apiCall('GET', '/data');
      expect(callCount).toBeGreaterThan(1);
    });

    it('should handle refresh token rotation', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .post('/oauth/token')
        .reply(200, {
          access_token: 'rotated_token',
          refresh_token: 'new_rotated_refresh',
          expires_in: 3600,
        });

      await mockIntegration.apiCall('POST', '/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: 'old_token',
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits with exponential backoff', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      let attempts = 0;
      
      nock('https://api.example.com')
        .get('/rate-limited')
        .reply(() => {
          attempts++;
          if (attempts < 3) {
            return [429, { error: 'rate_limit_exceeded' }, { 'Retry-After': '1' }];
          }
          return [200, { data: 'success' }];
        });

      const start = Date.now();
      await mockIntegration.apiCall('GET', '/rate-limited');
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(2000);
    });

    it('should handle rate limit headers', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .get('/data')
        .reply(200, { data: 'ok' }, {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
          'X-RateLimit-Reset': '1609459200',
        });

      const result = await mockIntegration.apiCall('GET', '/data');
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .get('/data')
        .replyWithError('Network error');

      await expect(
        mockIntegration.apiCall('GET', '/data')
      ).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .get('/data')
        .reply(200, 'not valid json {{{');

      await expect(
        mockIntegration.apiCall('GET', '/data')
      ).rejects.toThrow();
    });

    it('should handle HTTP errors with proper status codes', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .get('/data')
        .reply(500, { error: 'Internal Server Error' });

      await expect(
        mockIntegration.apiCall('GET', '/data')
      ).rejects.toThrow();
    });

    it('should handle authentication failures', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .get('/protected')
        .reply(403, { error: 'Forbidden' });

      await expect(
        mockIntegration.apiCall('GET', '/protected')
      ).rejects.toThrow();
    });

    it('should handle not found errors', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .get('/notfound')
        .reply(404, { error: 'Not Found' });

      await expect(
        mockIntegration.apiCall('GET', '/notfound')
      ).rejects.toThrow();
    });
  });

  describe('Data Models', () => {
    it('should validate response data', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .get('/users')
        .reply(200, {
          users: [
            { id: 1, name: 'John', email: 'john@example.com' },
            { id: 2, name: 'Jane', email: 'jane@example.com' },
          ],
        });

      const result: any = await mockIntegration.apiCall('GET', '/users');
      expect(result.users).toHaveLength(2);
      expect(result.users[0]).toHaveProperty('id');
      expect(result.users[0]).toHaveProperty('name');
      expect(result.users[0]).toHaveProperty('email');
    });

    it('should handle empty responses', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .get('/empty')
        .reply(204);

      const result = await mockIntegration.apiCall('GET', '/empty');
      expect(result).toBeUndefined();
    });
  });

  describe('Request/Response Interceptors', () => {
    it('should add custom headers to requests', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com', {
        reqheaders: {
          'X-Custom-Header': 'custom-value',
          'X-Request-Id': /^[a-f0-9-]+$/,
        },
      })
        .get('/data')
        .reply(200, { success: true });

      const result = await mockIntegration.apiCall('GET', '/data', undefined, {
        'X-Custom-Header': 'custom-value',
      });
      expect(result).toBeDefined();
    });

    it('should handle response headers', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .get('/data')
        .reply(200, { data: 'test' }, {
          'X-Total-Count': '100',
          'X-Page-Number': '1',
        });

      const result: any = await mockIntegration.apiCall('GET', '/data');
      expect(result).toBeDefined();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
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

      const result = await mockIntegration.apiCall('GET', '/retry');
      expect(result).toBeDefined();
      expect(attempts).toBe(3);
    });

    it('should not retry on non-transient errors', async () => {
      const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
      
      nock('https://api.example.com')
        .get('/data')
        .reply(400, { error: 'Bad Request' });

      await expect(
        mockIntegration.apiCall('GET', '/data')
      ).rejects.toThrow();
    });
  });
});

describe('Trigger/Polling Logic', () => {
  it('should poll for changes at intervals', async () => {
    const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
    
    let pollCount = 0;
    
    nock('https://api.example.com')
      .get('/events')
      .reply(() => {
        pollCount++;
        return [200, { events: [{ id: pollCount, type: 'event' }] }];
      });

    const poll = async () => {
      return mockIntegration.apiCall('GET', '/events');
    };

    await poll();
    await poll();
    await poll();
    
    expect(pollCount).toBe(3);
  });

  it('should detect new events from polling', async () => {
    const mockIntegration = new IntegrationBase('test', 'Test Integration', 'test integration');
    
    let previousTimestamp = 0;
    
    const events = [
      { id: 1, timestamp: '2024-01-01T00:00:00Z' },
      { id: 2, timestamp: '2024-01-02T00:00:00Z' },
      { id: 3, timestamp: '2024-01-03T00:00:00Z' },
    ];
    
    nock('https://api.example.com')
      .get('/events')
      .reply(() => {
        const event = events[previousTimestamp];
        previousTimestamp++;
        return [200, { event }];
      });

    for (const event of events) {
      await mockIntegration.apiCall('GET', '/events');
    }
    
    expect(previousTimestamp).toBe(3);
  });
});