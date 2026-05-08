import { Plugin, PluginManifest, PluginCapabilities } from './types';

export interface IntegrationConfig {
  id: string;
  name: string;
  type: IntegrationType;
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

export type IntegrationType =
  | 'google'
  | 'microsoft'
  | 'slack'
  | 'discord'
  | 'github'
  | 'gitlab'
  | 'jira'
  | 'linear'
  | 'trello'
  | 'notion'
  | 'obsidian'
  | 'roam'
  | 'todoist'
  | 'raindrop'
  | 'pocket'
  | 'spotify'
  | 'apple'
  | 'asana'
  | 'airtable'
  | 'confluence'
  | 'dropbox'
  | 'evernote'
  | 'figma'
  | 'giphy'
  | 'grafana'
  | 'hubspot'
  | 'intercom'
  | 'mailchimp'
  | 'pagerduty'
  | 'salesforce'
  | 'stripe'
  | 'twilio'
  | 'typeform'
  | 'zendesk'
  | 'zoom';

export interface IntegrationCapabilities {
  triggers: TriggerDefinition[];
  actions: ActionDefinition[];
  resources: ResourceDefinition[];
}

export interface TriggerDefinition {
  id: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export interface ResourceDefinition {
  id: string;
  name: string;
  type: string;
  schema: Record<string, unknown>;
}

export interface IntegrationEvent {
  id: string;
  integration: string;
  type: 'trigger' | 'action' | 'error';
  name: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface IntegrationResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class IntegrationBasePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/integration-base',
    name: 'Integration Base',
    version: '1.0.0',
    description: 'Base interfaces and utilities for all integrations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['integration', 'base', 'interface', 'common'],
  };

  public capabilities: PluginCapabilities = {};

  private registry: Map<IntegrationType, Integration> = new Map();
  private configs: Map<string, IntegrationConfig> = new Map();

  register(type: IntegrationType, integration: Integration): void {
    this.registry.set(type, integration);
  }

  unregister(type: IntegrationType): void {
    this.registry.delete(type);
  }

  get(type: IntegrationType): Integration | null {
    return this.registry.get(type) || null;
  }

  list(): IntegrationType[] {
    return Array.from(this.registry.keys());
  }

  async configure(config: IntegrationConfig): Promise<void> {
    this.configs.set(config.id, config);
    const integration = this.registry.get(config.type);
    if (integration) {
      await integration.initialize(config);
    }
  }

  async disconnect(configId: string): Promise<void> {
    const config = this.configs.get(configId);
    if (config) {
      const integration = this.registry.get(config.type);
      if (integration) {
        await integration.disconnect(config);
      }
      this.configs.delete(configId);
    }
  }

  getConfig(configId: string): IntegrationConfig | undefined {
    return this.configs.get(configId);
  }

  getConfigs(type?: IntegrationType): IntegrationConfig[] {
    return Array.from(this.configs.values()).filter(
      c => !type || c.type === type
    );
  }

  isConnected(configId: string): boolean {
    const config = this.configs.get(configId);
    return config?.enabled || false;
  }

  async refresh(configId: string): Promise<void> {
    const config = this.configs.get(configId);
    if (config && config.auth.refreshToken) {
      const integration = this.registry.get(config.type);
      if (integration) {
        await integration.refreshToken(config);
      }
    }
  }

  validateConfig(config: Partial<IntegrationConfig>): ValidationResult {
    const errors: string[] = [];

    if (!config.name) errors.push('Name is required');
    if (!config.type) errors.push('Type is required');
    if (config.auth?.type === 'oauth2') {
      if (!config.auth.clientId) errors.push('OAuth requires clientId');
      if (!config.auth.clientSecret) errors.push('OAuth requires clientSecret');
    }

    return { valid: errors.length === 0, errors };
  }

  exportConfigs(): string {
    const configs = Array.from(this.configs.values()).map(c => ({
      ...c,
      auth: { ...c.auth, accessToken: undefined, refreshToken: undefined, clientSecret: undefined }
    }));
    return JSON.stringify(configs, null, 2);
  }

  importConfigs(json: string): void {
    const configs = JSON.parse(json) as IntegrationConfig[];
    for (const config of configs) {
      this.configs.set(config.id, config);
    }
  }

  getSupportedTypes(): IntegrationType[] {
    return Array.from(this.registry.keys());
  }

  getCapabilities(type: IntegrationType): IntegrationCapabilities | null {
    const integration = this.registry.get(type);
    return integration?.getCapabilities() || null;
  }
}

export interface Integration {
  initialize(config: IntegrationConfig): Promise<void>;
  disconnect(config: IntegrationConfig): Promise<void>;
  refreshToken(config: IntegrationConfig): Promise<void>;
  testConnection(config: IntegrationConfig): Promise<boolean>;
  getCapabilities(): IntegrationCapabilities;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class OAuthManagerPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/oauth-manager',
    name: 'OAuth Manager',
    version: '1.0.0',
    description: 'Unified OAuth 2.0 and PKCE flow management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['oauth', 'pkce', 'auth', 'token'],
  };

  public capabilities: PluginCapabilities = {};

  private providers: Map<string, OAuthProvider> = new Map();
  private tokens: Map<string, TokenStore> = new Map();

  registerProvider(provider: OAuthProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  getProvider(providerId: string): OAuthProvider | null {
    return this.providers.get(providerId) || null;
  }

  async generateAuthUrl(
    providerId: string,
    options: AuthUrlOptions
  ): Promise<string> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider not found: ${providerId}`);

    const state = this.generateState();
    const codeVerifier = options.pkce ? this.generateCodeVerifier() : undefined;
    const codeChallenge = codeVerifier ? await this.generateCodeChallenge(codeVerifier) : undefined;

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: options.redirectUri,
      response_type: 'code',
      scope: options.scopes?.join(' ') || provider.defaultScopes?.join(' ') || '',
      state,
      ...(codeChallenge && { code_challenge: codeChallenge, code_challenge_method: 'S256' })
    });

    if (options.extraParams) {
      for (const [key, value] of Object.entries(options.extraParams)) {
        params.set(key, value);
      }
    }

    if (codeVerifier) {
      this.storeCodeVerifier(state, codeVerifier);
    }

    return `${provider.authUrl}?${params.toString()}`;
  }

  async exchangeCode(
    providerId: string,
    code: string,
    redirectUri: string
  ): Promise<TokenResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider not found: ${providerId}`);

    const params = new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const codeVerifier = this.getCodeVerifier(code);
    if (codeVerifier) {
      params.set('code_verifier', codeVerifier);
    }

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  async refreshToken(providerId: string, refreshToken: string): Promise<TokenResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider not found: ${providerId}`);

    const params = new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  async revokeToken(providerId: string, token: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider?.revokeUrl) return;

    await fetch(provider.revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString()
    });
  }

  storeToken(configId: string, tokens: TokenResponse): void {
    this.tokens.set(configId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
      tokenType: tokens.token_type,
      scope: tokens.scope
    });
  }

  getToken(configId: string): TokenResponse | null {
    const store = this.tokens.get(configId);
    if (!store) return null;

    if (store.expiresAt && Date.now() > store.expiresAt - 60000) {
      return null;
    }

    return {
      access_token: store.accessToken || '',
      token_type: store.tokenType || 'Bearer',
      expires_in: store.expiresAt ? Math.floor((store.expiresAt - Date.now()) / 1000) : undefined,
      refresh_token: store.refreshToken,
      scope: store.scope
    };
  }

  clearToken(configId: string): void {
    this.tokens.delete(configId);
  }

  async getValidToken(configId: string, providerId: string): Promise<string | null> {
    const token = this.getToken(configId);
    if (!token) return null;

    if (token.expires_in && Date.now() > (Date.now() + (token.expires_in - 60) * 1000)) {
      const refreshed = await this.refreshToken(providerId, token.refresh_token!);
      this.storeToken(configId, refreshed);
      return refreshed.access_token;
    }

    return token.access_token;
  }

  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  private base64UrlEncode(array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < array.length; i++) {
      binary += String.fromCharCode(array[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private storeCodeVerifier(state: string, verifier: string): void {
    sessionStorage.setItem(`oauth_verifier_${state}`, verifier);
  }

  private getCodeVerifier(state: string): string | null {
    const verifier = sessionStorage.getItem(`oauth_verifier_${state}`);
    sessionStorage.removeItem(`oauth_verifier_${state}`);
    return verifier;
  }

  createProvider(config: OAuthProviderConfig): OAuthProvider {
    return {
      id: config.id,
      name: config.name,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authUrl: config.authUrl,
      tokenUrl: config.tokenUrl,
      revokeUrl: config.revokeUrl,
      defaultScopes: config.defaultScopes,
      tokenEndpointAuthMethod: config.tokenEndpointAuthMethod,
    };
  }
}

export interface OAuthProvider {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  defaultScopes?: string[];
  tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post';
}

export interface OAuthProviderConfig {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  defaultScopes?: string[];
  tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post';
}

export interface AuthUrlOptions {
  redirectUri: string;
  scopes?: string[];
  state?: string;
  pkce?: boolean;
  extraParams?: Record<string, string>;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface TokenStore {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

export class WebhookPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/webhook',
    name: 'Webhook Manager',
    version: '1.0.0',
    description: 'Manage webhooks for integrations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['webhook', 'event', 'trigger', 'callback'],
  };

  public capabilities: PluginCapabilities = {};

  private handlers: Map<string, WebhookHandler> = new Map();
  private endpoints: Map<string, WebhookEndpoint> = new Map();

  register(event: string, handler: WebhookHandler): void {
    this.handlers.set(event, handler);
  }

  unregister(event: string): void {
    this.handlers.delete(event);
  }

  createEndpoint(config: EndpointConfig): WebhookEndpoint {
    const endpoint: WebhookEndpoint = {
      id: this.generateId(),
      url: config.url,
      events: config.events,
      secret: config.secret || this.generateSecret(),
      active: true,
      createdAt: Date.now(),
      lastTriggered: undefined
    };
    this.endpoints.set(endpoint.id, endpoint);
    return endpoint;
  }

  deleteEndpoint(endpointId: string): void {
    this.endpoints.delete(endpointId);
  }

  getEndpoint(endpointId: string): WebhookEndpoint | null {
    return this.endpoints.get(endpointId) || null;
  }

  listEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  async trigger(event: string, data: Record<string, unknown>): Promise<void> {
    const handler = this.handlers.get(event);
    if (handler) {
      await handler(data);
    }
  }

  verifySignature(payload: string, signature: string, secret: string): boolean {
    const encoder = new TextEncoder();
    const key = encoder.encode(secret);
    const data = encoder.encode(payload);
    return false;
  }

  private generateId(): string {
    return 'wh_' + Math.random().toString(36).slice(2);
  }

  private generateSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }
}

export type WebhookHandler = (data: Record<string, unknown>) => Promise<void>;

export interface EndpointConfig {
  url: string;
  events: string[];
  secret?: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: number;
  lastTriggered?: number;
}

export class SyncEnginePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/sync-engine',
    name: 'Sync Engine',
    version: '1.0.0',
    description: 'Bidirectional sync between integrations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['sync', 'bidirectional', 'two-way', 'mirror'],
  };

  public capabilities: PluginCapabilities = {};

  private syncConfigs: Map<string, SyncConfig> = new Map();
  private syncStatus: Map<string, SyncState> = new Map();

  createSync(config: SyncConfig): string {
    const id = 'sync_' + Math.random().toString(36).slice(2);
    this.syncConfigs.set(id, config);
    this.syncStatus.set(id, {
      status: 'idle',
      lastSync: undefined,
      pendingChanges: 0,
      conflicts: []
    });
    return id;
  }

  deleteSync(syncId: string): void {
    this.syncConfigs.delete(syncId);
    this.syncStatus.delete(syncId);
  }

  async startSync(syncId: string): Promise<void> {
    const config = this.syncConfigs.get(syncId);
    if (!config) throw new Error('Sync not found');

    this.updateStatus(syncId, { status: 'syncing' });

    try {
      const sourceData = await this.fetchSource(config.source);
      const targetData = await this.fetchTarget(config.target);

      const changes = this.calculateChanges(sourceData, targetData, config.direction);

      for (const change of changes) {
        await this.applyChange(change);
      }

      this.updateStatus(syncId, {
        status: 'idle',
        lastSync: Date.now(),
        pendingChanges: 0
      });
    } catch (error) {
      this.updateStatus(syncId, {
        status: 'error',
        error: (error as Error).message
      });
    }
  }

  pauseSync(syncId: string): void {
    this.updateStatus(syncId, { status: 'paused' });
  }

  resumeSync(syncId: string): void {
    this.updateStatus(syncId, { status: 'idle' });
  }

  getStatus(syncId: string): SyncState | null {
    return this.syncStatus.get(syncId) || null;
  }

  listSyncs(): SyncConfig[] {
    return Array.from(this.syncConfigs.values());
  }

  private async fetchSource(source: SyncSource): Promise<SyncData> {
    return { items: [], cursor: undefined };
  }

  private async fetchTarget(target: SyncTarget): Promise<SyncData> {
    return { items: [], cursor: undefined };
  }

  private calculateChanges(
    source: SyncData,
    target: SyncData,
    direction: 'source-to-target' | 'target-to-source' | 'bidirectional'
  ): SyncChange[] {
    return [];
  }

  private async applyChange(change: SyncChange): Promise<void> {}

  private updateStatus(syncId: string, update: Partial<SyncState>): void {
    const current = this.syncStatus.get(syncId);
    if (current) {
      this.syncStatus.set(syncId, { ...current, ...update });
    }
  }
}

export interface SyncConfig {
  id: string;
  name: string;
  source: SyncSource;
  target: SyncTarget;
  direction: 'source-to-target' | 'target-to-source' | 'bidirectional';
  schedule?: string;
  filters?: SyncFilter[];
}

export interface SyncSource {
  type: IntegrationType;
  query?: Record<string, unknown>;
}

export interface SyncTarget {
  type: IntegrationType;
  mapping?: FieldMapping[];
}

export interface FieldMapping {
  source: string;
  target: string;
  transform?: (value: unknown) => unknown;
}

export interface SyncFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains';
  value: unknown;
}

export interface SyncData {
  items: SyncItem[];
  cursor?: string;
}

export interface SyncItem {
  id: string;
  data: Record<string, unknown>;
  modifiedAt: number;
}

export interface SyncChange {
  type: 'create' | 'update' | 'delete';
  sourceId: string;
  targetId?: string;
  data: Record<string, unknown>;
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'paused' | 'error';
  lastSync?: number;
  pendingChanges: number;
  conflicts: SyncConflict[];
  error?: string;
}

export interface SyncConflict {
  sourceId: string;
  targetId: string;
  sourceData: Record<string, unknown>;
  targetData: Record<string, unknown>;
  resolved?: 'source' | 'target' | 'merge';
}

export class RateLimiterPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/rate-limiter',
    name: 'Rate Limiter',
    version: '1.0.0',
    description: 'Rate limiting for API calls',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['rate', 'limit', 'throttle', 'api'],
  };

  public capabilities: PluginCapabilities = {};

  private limits: Map<string, RateLimitBucket> = new Map();

  createBucket(key: string, config: RateLimitConfig): void {
    this.limits.set(key, {
      tokens: config.maxTokens,
      maxTokens: config.maxTokens,
      refillRate: config.refillRate,
      lastRefill: Date.now()
    });
  }

  async acquire(key: string, cost: number = 1): Promise<boolean> {
    const bucket = this.limits.get(key);
    if (!bucket) return true;

    this.refill(bucket);

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }

    return false;
  }

  waitFor(key: string, cost: number = 1): Promise<void> {
    return new Promise((resolve) => {
      const check = async () => {
        if (await this.acquire(key, cost)) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  getRemaining(key: string): number {
    const bucket = this.limits.get(key);
    return bucket ? Math.floor(bucket.tokens) : 0;
  }

  reset(key: string): void {
    const bucket = this.limits.get(key);
    if (bucket) {
      bucket.tokens = bucket.maxTokens;
    }
  }

  private refill(bucket: RateLimitBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refills = Math.floor(elapsed * bucket.refillRate / 1000);
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + refills);
    bucket.lastRefill = now;
  }
}

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
}

export interface RateLimitBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number;
  lastRefill: number;
}