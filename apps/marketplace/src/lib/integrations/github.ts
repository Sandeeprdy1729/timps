import { Octokit } from '@octokit/rest';
import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

export class GitHubIntegration extends BaseIntegration {
  private client: Octokit | null = null;

  constructor(config?: IntegrationConfig) {
    super('github', 'GitHub', config);
  }

  getApiClient(): Octokit {
    if (!this.client) {
      this.client = new Octokit({
        auth: this.config?.accessToken || this.config?.apiKey,
      });
    }
    return this.client;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      const { data } = await this.getApiClient().users.getAuthenticated();
      return { connected: true, label: `Connected as ${data.login}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async getUser(): Promise<IntegrationResult> {
    try {
      const { data } = await this.getApiClient().users.getAuthenticated();
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get user' };
    }
  }

  async getRepo(owner: string, repo: string): Promise<IntegrationResult> {
    try {
      const { data } = await this.getApiClient().repos.get({ owner, repo });
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get repo' };
    }
  }

  async listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<IntegrationResult> {
    try {
      const { data } = await this.getApiClient().issues.listForRepo({ owner, repo, state });
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list issues' };
    }
  }

  async createIssue(owner: string, repo: string, title: string, body?: string): Promise<IntegrationResult> {
    try {
      const { data } = await this.getApiClient().issues.create({ owner, repo, title, body });
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create issue' };
    }
  }

  async listPRs(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<IntegrationResult> {
    try {
      const { data } = await this.getApiClient().pulls.list({ owner, repo, state });
      return { success: true, data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list PRs' };
    }
  }
}
