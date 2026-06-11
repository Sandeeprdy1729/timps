import {
  ConnectionConfig,
  ConnectionState,
  ConnectionStatus,
  ConnectionHealthCheck,
  ReauthTrigger,
  IntegrationCredentialUpdate,
} from './types.js';

export type ConnectionEventType = 
  | 'connection:connected'
  | 'connection:disconnected'
  | 'connection:error'
  | 'connection:expired'
  | 'connection:reauth_required'
  | 'connection:health_check';

export interface ConnectionEvent {
  type: ConnectionEventType;
  connectionId: string;
  integrationId: string;
  timestamp: string;
  data?: any;
}

type EventCallback = (event: ConnectionEvent) => void | Promise<void>;

export class ConnectionManager {
  private connections: Map<string, ConnectionState> = new Map();
  private configs: Map<string, ConnectionConfig> = new Map();
  private eventListeners: Map<ConnectionEventType, Set<EventCallback>> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private reauthQueue: ReauthTrigger[] = [];
  private storageKey = 'timps_connections';
  private idCounter = 0;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.connections = new Map(Object.entries(data.connections || {}));
        this.configs = new Map(Object.entries(data.configs || {}));
      }
    } catch (e) {
      console.error('Failed to load connections from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        connections: Object.fromEntries(this.connections),
        configs: Object.fromEntries(this.configs),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save connections to storage:', e);
    }
  }

  private emit(event: ConnectionEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const callback of listeners) {
        Promise.resolve(callback(event)).catch(console.error);
      }
    }
    const allListeners = this.eventListeners.get('*' as ConnectionEventType);
    if (allListeners) {
      for (const callback of allListeners) {
        Promise.resolve(callback(event)).catch(console.error);
      }
    }
  }

  on(eventType: ConnectionEventType, callback: EventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);
  }

  off(eventType: ConnectionEventType, callback: EventCallback): void {
    this.eventListeners.get(eventType)?.delete(callback);
  }

  async connect(config: ConnectionConfig): Promise<ConnectionState> {
    const connectionId = `${config.integrationId}-${Date.now()}-${++this.idCounter}`;
    const state: ConnectionState = {
      id: connectionId,
      integrationId: config.integrationId,
      integrationName: config.integrationName,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      metadata: {},
    };

    this.connections.set(connectionId, state);
    this.configs.set(connectionId, config);
    this.saveToStorage();

    this.emit({
      type: 'connection:connected',
      connectionId,
      integrationId: config.integrationId,
      timestamp: new Date().toISOString(),
      data: state,
    });

    await this.startHealthCheck(connectionId);

    return state;
  }

  async disconnect(connectionId: string): Promise<void> {
    const state = this.connections.get(connectionId);
    if (!state) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    this.stopHealthCheck(connectionId);
    this.connections.delete(connectionId);
    this.configs.delete(connectionId);
    this.saveToStorage();

    this.emit({
      type: 'connection:disconnected',
      connectionId,
      integrationId: state.integrationId,
      timestamp: new Date().toISOString(),
      data: state,
    });
  }

  getConnection(connectionId: string): ConnectionState | undefined {
    return this.connections.get(connectionId);
  }

  getConnectionsByIntegration(integrationId: string): ConnectionState[] {
    const result: ConnectionState[] = [];
    for (const state of this.connections.values()) {
      if (state.integrationId === integrationId) {
        result.push(state);
      }
    }
    return result;
  }

  getAllConnections(): ConnectionState[] {
    return Array.from(this.connections.values());
  }

  getConfig(connectionId: string): ConnectionConfig | undefined {
    return this.configs.get(connectionId);
  }

  async updateCredentials(connectionId: string, credentials: Record<string, string>): Promise<void> {
    const config = this.configs.get(connectionId);
    if (!config) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    config.credentials = { ...config.credentials, ...credentials };
    this.saveToStorage();
  }

  async testConnection(connectionId: string): Promise<boolean> {
    const state = this.connections.get(connectionId);
    const config = this.configs.get(connectionId);
    
    if (!state || !config) {
      return false;
    }

    try {
      const response = await fetch(`${this.getTestEndpoint(config.integrationId)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(config),
      });
      
      const healthy = response.ok;
      
      state.lastError = healthy ? undefined : `HTTP ${response.status}`;
      state.status = healthy ? 'connected' : 'error';
      this.saveToStorage();

      this.emit({
        type: 'connection:health_check',
        connectionId,
        integrationId: state.integrationId,
        timestamp: new Date().toISOString(),
        data: { healthy, status: response.status },
      });

      return healthy;
    } catch (error) {
      state.status = 'error';
      state.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.saveToStorage();

      this.emit({
        type: 'connection:error',
        connectionId,
        integrationId: state.integrationId,
        timestamp: new Date().toISOString(),
        data: { error: state.lastError },
      });

      return false;
    }
  }

  private getTestEndpoint(integrationId: string): string {
    const endpoints: Record<string, string> = {
      'google-calendar': 'https://www.googleapis.com/calendar/v3',
      'google-gmail': 'https://gmail.googleapis.com/gmail/v1',
      'slack': 'https://slack.com/api/',
      'github': 'https://api.github.com',
      'notion': 'https://api.notion.com/v1',
      'jira': '/api/v2',
      'linear': 'https://api.linear.app/graphql',
      'todoist': 'https://api.todoist.com',
      'spotify': 'https://api.spotify.com/v1',
      'stripe': 'https://api.stripe.com/v1',
    };
    return endpoints[integrationId] || '';
  }

  private getAuthHeaders(config: ConnectionConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (config.authType) {
      case 'api_key':
        headers['Authorization'] = `Bearer ${config.credentials.apiKey || ''}`;
        break;
      case 'oauth2':
        headers['Authorization'] = `Bearer ${config.credentials.accessToken || ''}`;
        break;
      case 'basic':
        const auth = Buffer.from(`${config.credentials.username}:${config.credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
        break;
    }

    return headers;
  }

  async startHealthCheck(connectionId: string, intervalMs = 60000): Promise<void> {
    this.stopHealthCheck(connectionId);

    const interval = setInterval(async () => {
      await this.testConnection(connectionId);
    }, intervalMs);

    this.healthCheckIntervals.set(connectionId, interval);
    await this.testConnection(connectionId);
  }

  stopHealthCheck(connectionId: string): void {
    const interval = this.healthCheckIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(connectionId);
    }
  }

  async checkAndReauth(): Promise<void> {
    const now = new Date().toISOString();

    for (const [connectionId, state] of this.connections) {
      if (state.status === 'expired' || state.expiresAt && state.expiresAt < now) {
        const trigger: ReauthTrigger = {
          connectionId,
          reason: 'expired',
          triggeredAt: now,
          status: 'pending',
        };

        this.reauthQueue.push(trigger);
        state.status = 'expired';

        this.emit({
          type: 'connection:reauth_required',
          connectionId,
          integrationId: state.integrationId,
          timestamp: now,
          data: trigger,
        });
      }
    }

    this.saveToStorage();
  }

  getReauthQueue(): ReauthTrigger[] {
    return [...this.reauthQueue];
  }

  completeReauth(connectionId: string, newCredentials: Record<string, string>): void {
    const state = this.connections.get(connectionId);
    const config = this.configs.get(connectionId);
    const queueIndex = this.reauthQueue.findIndex(t => t.connectionId === connectionId);

    if (state && config) {
      config.credentials = { ...config.credentials, ...newCredentials };
      state.status = 'connected';
      state.lastError = undefined;
      state.expiresAt = undefined;

      if (queueIndex >= 0) {
        this.reauthQueue[queueIndex].status = 'completed';
      }

      this.saveToStorage();

      this.emit({
        type: 'connection:connected',
        connectionId,
        integrationId: state.integrationId,
        timestamp: new Date().toISOString(),
        data: state,
      });
    }
  }

  getHealthStatus(connectionId: string): ConnectionHealthCheck | undefined {
    const state = this.connections.get(connectionId);
    if (!state) return undefined;

    return {
      connectionId,
      healthy: state.status === 'connected',
      lastChecked: state.lastSyncAt || state.connectedAt || new Date().toISOString(),
      error: state.lastError,
    };
  }

  updateLastSync(connectionId: string): void {
    const state = this.connections.get(connectionId);
    if (state) {
      state.lastSyncAt = new Date().toISOString();
      this.saveToStorage();
    }
  }

  destroy(): void {
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
    this.connections.clear();
    this.configs.clear();
    this.eventListeners.clear();
  }
}

export const connectionManager = new ConnectionManager();

export type { ConnectionConfig, ConnectionState, ConnectionStatus, ConnectionHealthCheck, ReauthTrigger, IntegrationCredentialUpdate };