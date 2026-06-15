import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

export class JiraIntegration extends BaseIntegration {
  private baseUrl: string;

  constructor(config?: IntegrationConfig) {
    super('jira', 'Jira', config);
    this.baseUrl = (config?.instanceUrl || 'https://your-domain.atlassian.net').replace(/\/$/, '');
  }

  private getAuth(): string {
    if (this.config?.apiKey) return this.config.apiKey;
    if (this.config?.accessToken) return this.config.accessToken;
    return '';
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Basic ${Buffer.from(this.getAuth()).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  getApiClient(): Record<string, unknown> {
    return { baseUrl: this.baseUrl };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira API error: ${response.status} ${text}`);
    }
    return response.json() as Promise<T>;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      const data = await this.request<{ displayName: string }>('/rest/api/3/myself');
      return { connected: true, label: `Connected as ${data.displayName}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async listProjects(): Promise<IntegrationResult> {
    try {
      const data = await this.request<{ values: Array<{ id: string; key: string; name: string }> }>('/rest/api/3/project/search');
      return { success: true, data: data.values };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list projects' };
    }
  }

  async createIssue(projectKey: string, summary: string, issueType = 'Task', description?: string): Promise<IntegrationResult> {
    try {
      const body: Record<string, unknown> = {
        fields: {
          project: { key: projectKey },
          summary,
          issuetype: { name: issueType },
        },
      };
      if (description) {
        (body.fields as Record<string, unknown>).description = {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }],
        };
      }
      const data = await this.request<{ id: string; key: string }>('/rest/api/3/issue', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create issue' };
    }
  }

  async searchIssues(jql: string): Promise<IntegrationResult> {
    try {
      const data = await this.request<{ issues: Array<{ id: string; key: string; fields: Record<string, unknown> }> }>(
        `/rest/api/3/search?jql=${encodeURIComponent(jql)}`
      );
      return { success: true, data: data.issues };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to search issues' };
    }
  }
}
