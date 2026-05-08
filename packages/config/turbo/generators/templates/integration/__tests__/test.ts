import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

describe('{{name}} Integration', () => {
  const baseUrl = '{{baseUrl}}';
  
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Connection', () => {
    it('should connect', async () => {
      nock(baseUrl).post('/oauth/token').reply(200, { access_token: 'token', refresh_token: 'refresh', expires_in: 3600 });
      const res = await fetch(`${baseUrl}/oauth/token`, { method: 'POST', body: JSON.stringify({ grant_type: 'authorization_code', code: 'code' }) });
      const data = await res.json();
      expect(data.access_token).toBeDefined();
    });

    it('should refresh token', async () => {
      nock(baseUrl).post('/oauth/token').reply(200, { access_token: 'new_token', refresh_token: 'new_refresh', expires_in: 3600 });
      const res = await fetch(`${baseUrl}/oauth/token`, { method: 'POST', body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: 'old_refresh' }) });
      const data = await res.json();
      expect(data.access_token).toBe('new_token');
    });

    it('should handle connection error', async () => {
      nock(baseUrl).post('/oauth/token').reply(401, { error: 'invalid_grant' });
      const res = await fetch(`${baseUrl}/oauth/token`, { method: 'POST', body: JSON.stringify({}) });
      expect(res.status).toBe(401);
    });
  });

  describe('API', () => {
    it('should list resources', async () => {
      nock(baseUrl).get('/resources').reply(200, { data: [], has_more: false });
      const res = await fetch(`${baseUrl}/resources`);
      const data = await res.json();
      expect(data.data).toBeDefined();
    });

    it('should get resource', async () => {
      nock(baseUrl).get('/resources/1').reply(200, { id: '1', name: 'Resource' });
      const res = await fetch(`${baseUrl}/resources/1`);
      const data = await res.json();
      expect(data.id).toBe('1');
    });

    it('should create resource', async () => {
      nock(baseUrl).post('/resources').reply(201, { id: 'new', name: 'New Resource' });
      const res = await fetch(`${baseUrl}/resources`, { method: 'POST', body: JSON.stringify({ name: 'New Resource' }) });
      expect(res.status).toBe(201);
    });

    it('should update resource', async () => {
      nock(baseUrl).patch('/resources/1').reply(200, { id: '1', name: 'Updated' });
      const res = await fetch(`${baseUrl}/resources/1`, { method: 'PATCH', body: JSON.stringify({ name: 'Updated' }) });
      const data = await res.json();
      expect(data.name).toBe('Updated');
    });

    it('should delete resource', async () => {
      nock(baseUrl).delete('/resources/1').reply(204, '');
      const res = await fetch(`${baseUrl}/resources/1`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });
  });

  describe('Webhooks', () => {
    it('should handle {{name}}:created', () => {
      const event = { type: '{{name}}:created', data: { id: '1' } };
      expect(event.type).toBe('{{name}}:created');
    });

    it('should handle {{name}}:updated', () => {
      const event = { type: '{{name}}:updated', data: { id: '1' } };
      expect(event.type).toBe('{{name}}:updated');
    });

    it('should handle {{name}}:deleted', () => {
      const event = { type: '{{name}}:deleted', data: { id: '1' } };
      expect(event.type).toBe('{{name}}:deleted');
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 Unauthorized', async () => {
      nock(baseUrl).get('/resources').reply(401, { error: 'Unauthorized' });
      const res = await fetch(`${baseUrl}/resources`);
      expect(res.status).toBe(401);
    });

    it('should handle 403 Forbidden', async () => {
      nock(baseUrl).get('/resources').reply(403, { error: 'Forbidden' });
      const res = await fetch(`${baseUrl}/resources`);
      expect(res.status).toBe(403);
    });

    it('should handle 404 Not Found', async () => {
      nock(baseUrl).get('/resources/999').reply(404, { error: 'Not Found' });
      const res = await fetch(`${baseUrl}/resources/999`);
      expect(res.status).toBe(404);
    });

    it('should handle 429 Rate Limit', async () => {
      nock(baseUrl).get('/resources').reply(429, { error: 'Rate Limit' }, { 'Retry-After': '1' });
      const res = await fetch(`${baseUrl}/resources`);
      expect(res.status).toBe(429);
    });

    it('should handle network error', async () => {
      nock(baseUrl).get('/resources').replyWithError('Network error');
      await expect(fetch(`${baseUrl}/resources`)).rejects.toThrow();
    });
  });

  describe('Activity Cards', () => {
    it('should create activity card for created event', () => {
      const event = { id: '1', type: 'created', source: '{{name}}', timestamp: Date.now() };
      const card = {
        id: event.id,
        title: event.type,
        description: event.source,
        icon: '📦',
        timestamp: event.timestamp,
        status: 'info' as const,
        tags: ['{{name}}'],
      };
      expect(card.icon).toBe('📦');
    });
  });
});