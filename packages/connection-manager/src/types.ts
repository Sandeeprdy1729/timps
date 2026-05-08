export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'expired' | 'pending';

export interface ConnectionConfig {
  integrationId: string;
  integrationName: string;
  authType: 'api_key' | 'oauth2' | 'basic' | 'custom';
  credentials: Record<string, string>;
  settings?: Record<string, any>;
}

export interface ConnectionState {
  id: string;
  integrationId: string;
  integrationName: string;
  status: ConnectionStatus;
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface ConnectionHealthCheck {
  connectionId: string;
  healthy: boolean;
  latency?: number;
  lastChecked: string;
  error?: string;
}

export interface ReauthTrigger {
  connectionId: string;
  reason: 'expired' | 'error' | 'manual';
  triggeredAt: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface IntegrationCredentialUpdate {
  connectionId: string;
  field: string;
  value: string;
  updatedAt: string;
}