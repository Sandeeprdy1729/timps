import { z } from 'zod';

export const IntegrationStatusSchema = z.enum(['connected', 'disconnected', 'error', 'pending']);
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

export const ConnectionConfigSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  apiKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  sandbox: z.boolean().default(false),
});
export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

export const IntegrationEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  source: z.string(),
  timestamp: z.number(),
  data: z.record(z.unknown()).optional(),
  metadata: z.record(z.string()).optional(),
});
export type IntegrationEvent = z.infer<typeof IntegrationEventSchema>;

export const ActivityCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  timestamp: z.number(),
  actionUrl: z.string().optional(),
  status: z.enum(['success', 'warning', 'error', 'info']).default('info'),
  tags: z.array(z.string()).default([]),
});
export type ActivityCard = z.infer<typeof ActivityCardSchema>;

export interface Integration {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly scopes: string[];
  readonly authType: 'oauth2' | 'api-key' | 'webhook' | 'basic';

  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  refresh(): Promise<void>;
  getStatus(): IntegrationStatus;
  getSettingsUI(): Promise<string>;
  createActivityCard(event: IntegrationEvent): ActivityCard;
  setupTriggers(): void;
  handleWebhook(payload: unknown): Promise<void>;
}

export abstract class BaseIntegration implements Integration {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly description: string;
  abstract readonly scopes: string[];
  abstract readonly authType: 'oauth2' | 'api-key' | 'webhook' | 'basic';

  protected status: IntegrationStatus = 'disconnected';
  protected config: ConnectionConfig = {};
  protected eventListeners: Map<string, Function[]> = new Map();

  abstract connect(config: ConnectionConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract refresh(): Promise<void>;
  abstract getSettingsUI(): Promise<string>;
  abstract createActivityCard(event: IntegrationEvent): ActivityCard;
  abstract setupTriggers(): void;
  abstract handleWebhook(payload: unknown): Promise<void>;

  getStatus(): IntegrationStatus {
    return this.status;
  }

  protected setStatus(status: IntegrationStatus): void {
    this.status = status;
  }

  protected setConfig(config: ConnectionConfig): void {
    this.config = config;
  }

  protected getConfig(): ConnectionConfig {
    return this.config;
  }

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  protected emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  }

  protected async apiCall(
    method: string,
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<unknown> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`API call failed: ${response.status} ${JSON.stringify(error)}`);
    }

    if (response.status === 204) {
      return undefined;
    }

    return response.json();
  }

  protected getBaseUrl(): string {
    return this.config.sandbox ? 'https://sandbox-api.example.com' : 'https://api.example.com';
  }

  protected isTokenExpired(): boolean {
    if (!this.config.expiresAt) return false;
    return Date.now() >= this.config.expiresAt * 1000;
  }

  protected calculateExpiry(expiresIn: number): number {
    return Math.floor(Date.now() / 1000) + expiresIn;
  }

  protected validateConfig(config: ConnectionConfig): void {
    if (this.authType === 'oauth2' && !config.accessToken) {
      throw new Error('OAuth2 requires access token');
    }
    if (this.authType === 'api-key' && !config.apiKey) {
      throw new Error('API key required');
    }
  }
}

export class IntegrationRegistry {
  private static integrations = new Map<string, new () => BaseIntegration>();

  static register(name: string, integration: new () => BaseIntegration): void {
    this.integrations.set(name, integration);
  }

  static get(name: string): new () => BaseIntegration | undefined {
    return this.integrations.get(name);
  }

  static getAll(): string[] {
    return Array.from(this.integrations.keys());
  }

  static create(name: string): BaseIntegration {
    const Integration = this.integrations.get(name);
    if (!Integration) {
      throw new Error(`Integration not found: ${name}`);
    }
    return new Integration();
  }
}