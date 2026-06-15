import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

interface SentryIssue {
  id: string;
  title: string;
  level: string;
  status: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
}

export class SentryIntegration extends BaseIntegration {
  private baseUrl = 'https://sentry.io/api/0';

  constructor(config?: IntegrationConfig) {
    super('sentry', 'Sentry', config);
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config?.accessToken || this.config?.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  getApiClient(): Record<string, unknown> {
    return { baseUrl: this.baseUrl };
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { headers: this.getHeaders() });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sentry API error: ${response.status} ${text}`);
    }
    return response.json() as Promise<T>;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      const data = await this.request<[unknown]>('/projects/');
      return { connected: true, label: `Connected - ${Array.isArray(data) ? data.length : 0} projects` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async listProjects(): Promise<IntegrationResult> {
    try {
      const data = await this.request<Array<{ id: string; slug: string; name: string; platform: string }>>('/projects/');
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list projects' };
    }
  }

  async listIssues(orgSlug: string, projectSlug: string): Promise<IntegrationResult> {
    try {
      const data = await this.request<SentryIssue[]>(`/projects/${orgSlug}/${projectSlug}/issues/`);
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list issues' };
    }
  }
}
