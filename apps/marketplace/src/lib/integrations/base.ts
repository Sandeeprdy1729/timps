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

export const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
