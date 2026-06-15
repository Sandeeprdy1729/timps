export interface IntegrationConfig {
  apiKey?: string;
  accessToken?: string;
  instanceUrl?: string;
  organization?: string;
}

export interface IntegrationStatus {
  connected: boolean;
  label: string;
  error?: string;
}

export interface IntegrationResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export abstract class BaseIntegration {
  constructor(
    public readonly id: string,
    public readonly name: string,
    protected config?: IntegrationConfig
  ) {}

  setConfig(config: IntegrationConfig): void {
    this.config = config;
  }

  abstract testConnection(): Promise<IntegrationStatus>;
  abstract getApiClient(): unknown;
}
