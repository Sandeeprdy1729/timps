import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

interface VercelDeployment {
  id: string;
  name: string;
  url: string;
  state: string;
  createdAt: number;
}

export class VercelIntegration extends BaseIntegration {
  private baseUrl = 'https://api.vercel.com';

  constructor(config?: IntegrationConfig) {
    super('vercel', 'Vercel', config);
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config?.accessToken || this.config?.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  getApiClient(): Record<string, unknown> {
    return { baseUrl: this.baseUrl, token: this.config?.accessToken };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Vercel API error: ${response.status} ${text}`);
    }
    return response.json() as Promise<T>;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      const user = await this.request<{ user: { name: string } }>('/v2/user');
      return { connected: true, label: `Connected as ${user.user.name}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async listDeployments(limit = 20): Promise<IntegrationResult> {
    try {
      const data = await this.request<{ deployments: VercelDeployment[] }>(`/v6/deployments?limit=${limit}`);
      return { success: true, data: data.deployments };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list deployments' };
    }
  }

  async getDeployment(id: string): Promise<IntegrationResult> {
    try {
      const data = await this.request<VercelDeployment>(`/v13/deployments/${id}`);
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get deployment' };
    }
  }

  async getProjects(): Promise<IntegrationResult> {
    try {
      const data = await this.request<{ projects: Array<{ id: string; name: string }> }>('/v9/projects');
      return { success: true, data: data.projects };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list projects' };
    }
  }
}
