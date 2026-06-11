import { ConnectionManager, ConnectionConfig } from '../src/index';

const mockStorage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  },
  writable: true,
});

const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
globalThis.fetch = mockFetch as any;

function makeConfig(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    integrationId: 'github',
    integrationName: 'GitHub',
    authType: 'oauth2',
    credentials: { accessToken: 'gho_test123' },
    ...overrides,
  };
}

describe('ConnectionManager', () => {
  let mgr: ConnectionManager;

  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    mgr = new ConnectionManager();
  });

  afterEach(() => {
    mgr.destroy();
  });

  describe('connect', () => {
    it('creates a connection and returns a state', async () => {
      const state = await mgr.connect(makeConfig());
      expect(state.id).toBeTruthy();
      expect(state.integrationId).toBe('github');
      expect(state.status).toBe('connected');
      expect(state.connectedAt).toBeTruthy();
    });

    it('emits a connection:connected event', async () => {
      const events: string[] = [];
      mgr.on('connection:connected', (e) => { events.push(e.type); });
      await mgr.connect(makeConfig());
      expect(events).toContain('connection:connected');
    });
  });

  describe('getConnection', () => {
    it('returns undefined for unknown id', () => {
      expect(mgr.getConnection('nope')).toBeUndefined();
    });

    it('returns the connection after connect', async () => {
      const state = await mgr.connect(makeConfig());
      expect(mgr.getConnection(state.id)).toBeDefined();
    });
  });

  describe('getAllConnections', () => {
    it('returns all connections', async () => {
      await mgr.connect(makeConfig({ integrationId: 'github' }));
      await mgr.connect(makeConfig({ integrationId: 'slack' }));
      expect(mgr.getAllConnections()).toHaveLength(2);
    });
  });

  describe('getConnectionsByIntegration', () => {
    it('filters by integrationId', async () => {
      await mgr.connect(makeConfig({ integrationId: 'github' }));
      await new Promise(r => setTimeout(r, 5));
      await mgr.connect(makeConfig({ integrationId: 'slack' }));
      await new Promise(r => setTimeout(r, 5));
      await mgr.connect(makeConfig({ integrationId: 'github' }));
      expect(mgr.getConnectionsByIntegration('github')).toHaveLength(2);
      expect(mgr.getConnectionsByIntegration('slack')).toHaveLength(1);
    });
  });

  describe('disconnect', () => {
    it('removes the connection', async () => {
      const state = await mgr.connect(makeConfig());
      await mgr.disconnect(state.id);
      expect(mgr.getConnection(state.id)).toBeUndefined();
    });

    it('throws for unknown connection', async () => {
      await expect(mgr.disconnect('nope')).rejects.toThrow('not found');
    });

    it('emits connection:disconnected', async () => {
      const events: string[] = [];
      mgr.on('connection:disconnected', (e) => { events.push(e.type); });
      const state = await mgr.connect(makeConfig());
      await mgr.disconnect(state.id);
      expect(events).toContain('connection:disconnected');
    });
  });

  describe('updateCredentials', () => {
    it('merges credentials', async () => {
      const state = await mgr.connect(makeConfig({
        credentials: { accessToken: 'old' },
      }));
      await mgr.updateCredentials(state.id, { refreshToken: 'new' });
      const config = mgr.getConfig(state.id);
      expect(config!.credentials.accessToken).toBe('old');
      expect(config!.credentials.refreshToken).toBe('new');
    });
  });

  describe('getHealthStatus', () => {
    it('returns undefined for unknown connection', () => {
      expect(mgr.getHealthStatus('nope')).toBeUndefined();
    });

    it('returns health info for existing connection', async () => {
      const state = await mgr.connect(makeConfig());
      const health = mgr.getHealthStatus(state.id);
      expect(health).toBeDefined();
      expect(health!.connectionId).toBe(state.id);
      expect(health!.healthy).toBe(true);
    });
  });

  describe('updateLastSync', () => {
    it('updates lastSyncAt', async () => {
      const state = await mgr.connect(makeConfig());
      mgr.updateLastSync(state.id);
      const updated = mgr.getConnection(state.id);
      expect(updated!.lastSyncAt).toBeTruthy();
    });
  });

  describe('checkAndReauth', () => {
    it('marks expired connections and adds to reauth queue', async () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      const state = await mgr.connect(makeConfig());
      mgr.getConnection(state.id)!.expiresAt = past;
      mgr.getConnection(state.id)!.status = 'expired';
      await mgr.checkAndReauth();
      const queue = mgr.getReauthQueue();
      expect(queue.length).toBeGreaterThanOrEqual(1);
      expect(queue[0].status).toBe('pending');
    });
  });

  describe('completeReauth', () => {
    it('restores connection after reauth', async () => {
      const state = await mgr.connect(makeConfig());
      mgr.getConnection(state.id)!.status = 'expired';
      mgr.completeReauth(state.id, { accessToken: 'new_token' });
      expect(mgr.getConnection(state.id)!.status).toBe('connected');
      expect(mgr.getConfig(state.id)!.credentials.accessToken).toBe('new_token');
    });
  });

  describe('event listener lifecycle', () => {
    it('off() removes a listener', async () => {
      const events: string[] = [];
      const cb = (e: any) => { events.push(e.type); };
      mgr.on('connection:connected', cb);
      await mgr.connect(makeConfig());
      expect(events).toHaveLength(1);
      mgr.off('connection:connected', cb);
      await mgr.connect(makeConfig({ integrationId: 'slack' }));
      expect(events).toHaveLength(1);
    });
  });
});
