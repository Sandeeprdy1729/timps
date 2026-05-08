import { Plugin, PluginManifest, PluginCapabilities } from '../types';

export interface IntegrationConfig {
  id: string;
  name: string;
  type: string;
  auth: AuthConfig;
  settings?: Record<string, unknown>;
  enabled?: boolean;
  lastSync?: number;
}

export interface AuthConfig {
  type: 'oauth2' | 'apiKey' | 'basic' | 'bearer';
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
  apiKey?: string;
  username?: string;
  password?: string;
}

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
}

export interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
  enabled?: boolean;
}

export interface SyncJob {
  id: string;
  name: string;
  source: string;
  target: string;
  direction: 'source-to-target' | 'target-to-source' | 'bidirectional';
  schedule?: string;
  status: 'idle' | 'syncing' | 'paused' | 'error';
  lastSync?: number;
}

export interface IntegrationEvent {
  id: string;
  type: string;
  source: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export abstract class IntegrationBase implements Plugin {
  public manifest: PluginManifest;
  public capabilities: PluginCapabilities = {};
  protected accessToken: string | null = null;
  protected apiKey: string | null = null;
  protected config: IntegrationConfig | null = null;
  protected listeners: Map<string, Function[]> = new Map();
  protected rateLimits: Map<string, { tokens: number; lastRefill: number }> = new Map();
  protected retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  };

  constructor(id: string, name: string, version: string, description: string, keywords: string[]) {
    this.manifest = {
      id,
      name,
      version,
      description,
      author: 'TIMPS Team',
      main: 'index.js',
      keywords,
    };
  }

  abstract authenticate(config: AuthConfig): Promise<boolean>;
  abstract testConnection(): Promise<boolean>;
  abstract executeAction(action: string, params: Record<string, unknown>): Promise<unknown>;
  abstract fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown>;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  setConfig(config: IntegrationConfig): void {
    this.config = config;
    if (config.auth.accessToken) {
      this.setAccessToken(config.auth.accessToken);
    }
    if (config.auth.apiKey) {
      this.setApiKey(config.auth.apiKey);
    }
  }

  getConfig(): IntegrationConfig | null {
    return this.config;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null || this.apiKey !== null;
  }

  protected async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.accessToken) {
      if (this.config?.auth.type === 'bearer') {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      } else {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
    }

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    return headers;
  }

  protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelay;

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.retryConfig.maxRetries - 1) {
          await this.sleep(delay);
          delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelay);
        }
      }
    }

    throw lastError;
  }

  protected async checkRateLimit(key: string, cost: number = 1): Promise<boolean> {
    const bucket = this.rateLimits.get(key);
    if (!bucket) return true;

    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const refillAmount = (timePassed / 1000) * 10;

    bucket.tokens = Math.min(bucket.tokens + refillAmount, 100);
    bucket.lastRefill = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }

    return false;
  }

  protected createRateLimitBucket(key: string, maxTokens: number = 100, refillRate: number = 10): void {
    this.rateLimits.set(key, {
      tokens: maxTokens,
      lastRefill: Date.now(),
    });
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  protected emit(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error) {
          console.error(`Event listener error for ${event}:`, error);
        }
      }
    }
  }

  validateConfig(config: Partial<IntegrationConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.name) errors.push('Name is required');
    if (!config.type) errors.push('Type is required');
    if (config.auth?.type === 'oauth2') {
      if (!config.auth.clientId) errors.push('OAuth requires clientId');
    }

    return { valid: errors.length === 0, errors };
  }

  getStatus(): { authenticated: boolean; config: boolean; rateLimits: string[] } {
    return {
      authenticated: this.isAuthenticated(),
      config: this.config !== null,
      rateLimits: Array.from(this.rateLimits.keys()),
    };
  }

  getHealth(): { status: 'healthy' | 'degraded' | 'down'; latency?: number } {
    return { status: 'healthy' };
  }

  abstract cleanup(): Promise<void>;
}

export interface IntegrationManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  keywords: string[];
}

export interface IntegrationOptions {
  auth?: AuthConfig;
  settings?: Record<string, unknown>;
  webhook?: WebhookConfig;
  retry?: Partial<RetryConfig>;
}

export function createIntegration(
  manifest: IntegrationManifest,
  options: IntegrationOptions = {}
): IntegrationBase {
  const integration = new (class extends IntegrationBase {
    async authenticate(config: AuthConfig): Promise<boolean> {
      this.setAccessToken(config.accessToken || '');
      this.setApiKey(config.apiKey || '');
      return this.testConnection();
    }

    async testConnection(): Promise<boolean> {
      return this.isAuthenticated();
    }

    async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
      console.log(`Executing action: ${action}`, params);
      return { success: true };
    }

    async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
      console.log(`Fetching data: ${resource}`, options);
      return [];
    }

    async cleanup(): Promise<void> {
      this.accessToken = null;
      this.apiKey = null;
      this.config = null;
    }
  })(manifest.id, manifest.name, manifest.version, manifest.description, manifest.keywords);

  if (options.retry) {
    integration.retryConfig = { ...integration.retryConfig, ...options.retry };
  }

  return integration;
}

export class IntegrationRegistry {
  private integrations: Map<string, IntegrationBase> = new Map();
  private connections: Map<string, IntegrationConfig> = new Map();

  register(name: string, integration: IntegrationBase): void {
    this.integrations.set(name, integration);
  }

  unregister(name: string): boolean {
    return this.integrations.delete(name);
  }

  get(name: string): IntegrationBase | undefined {
    return this.integrations.get(name);
  }

  list(): string[] {
    return Array.from(this.integrations.keys());
  }

  async connect(name: string, config: IntegrationConfig): Promise<boolean> {
    const integration = this.integrations.get(name);
    if (!integration) return false;

    await integration.authenticate(config.auth);
    this.connections.set(config.id, config);
    return true;
  }

  async disconnect(connectionId: string): Promise<boolean> {
    const config = this.connections.get(connectionId);
    if (!config) return false;

    const integration = this.integrations.get(config.type);
    if (integration) {
      await integration.cleanup();
    }

    this.connections.delete(connectionId);
    return true;
  }

  getConnection(connectionId: string): IntegrationConfig | undefined {
    return this.connections.get(connectionId);
  }

  getConnections(): IntegrationConfig[] {
    return Array.from(this.connections.values());
  }

  getIntegrationsByType(type: string): IntegrationBase[] {
    return Array.from(this.integrations.values()).filter(i => i.manifest.id.includes(type));
  }
}

export const globalRegistry = new IntegrationRegistry();
export default globalRegistry;