import { LinearClient } from '@linear/sdk';
import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

export class LinearIntegration extends BaseIntegration {
  private client: LinearClient | null = null;

  constructor(config?: IntegrationConfig) {
    super('linear', 'Linear', config);
  }

  getApiClient(): LinearClient {
    if (!this.client) {
      this.client = new LinearClient({ apiKey: this.config?.apiKey });
    }
    return this.client;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      const viewer = await this.getApiClient().viewer;
      return { connected: true, label: `Connected as ${viewer.name}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async listTeams(): Promise<IntegrationResult> {
    try {
      const teams = await this.getApiClient().teams();
      return { success: true, data: teams.nodes };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list teams' };
    }
  }

  async createIssue(teamId: string, title: string, description?: string): Promise<IntegrationResult> {
    try {
      const issue = await this.getApiClient().createIssue({ teamId, title, description });
      return { success: true, data: issue };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create issue' };
    }
  }

  async listIssues(teamId: string): Promise<IntegrationResult> {
    try {
      const team = await this.getApiClient().team(teamId);
      const issues = await team.issues();
      return { success: true, data: issues.nodes };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list issues' };
    }
  }
}
