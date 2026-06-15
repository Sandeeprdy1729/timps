import { Client } from '@hubspot/api-client';
import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

export class HubSpotIntegration extends BaseIntegration {
  private client: Client | null = null;

  constructor(config?: IntegrationConfig) {
    super('hubspot', 'HubSpot', config);
  }

  getApiClient(): Client {
    if (!this.client) {
      this.client = new Client({ accessToken: this.config?.accessToken || this.config?.apiKey || '' });
    }
    return this.client;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      await this.getApiClient().crm.contacts.basicApi.getPage(1);
      return { connected: true, label: 'Connected to HubSpot' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async listContacts(limit = 20): Promise<IntegrationResult> {
    try {
      const response = await this.getApiClient().crm.contacts.basicApi.getPage(limit);
      return { success: true, data: response.results };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list contacts' };
    }
  }

  async listDeals(limit = 20): Promise<IntegrationResult> {
    try {
      const response = await this.getApiClient().crm.deals.basicApi.getPage(limit);
      return { success: true, data: response.results };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list deals' };
    }
  }
}
