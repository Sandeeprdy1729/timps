import { Client } from '@notionhq/client';
import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

export class NotionIntegration extends BaseIntegration {
  private client: Client | null = null;

  constructor(config?: IntegrationConfig) {
    super('notion', 'Notion', config);
  }

  getApiClient(): Client {
    if (!this.client) {
      this.client = new Client({ auth: this.config?.apiKey || this.config?.accessToken });
    }
    return this.client;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      const me = await this.getApiClient().users.me({});
      return { connected: true, label: `Connected as ${me.name}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async listDatabases(): Promise<IntegrationResult> {
    try {
      const response = await this.getApiClient().search({
        filter: { property: 'object', value: 'page' },
      });
      return { success: true, data: response.results };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list databases' };
    }
  }

  async createPage(databaseId: string, title: string, properties?: Record<string, unknown>): Promise<IntegrationResult> {
    try {
      const page = await this.getApiClient().pages.create({
        parent: { database_id: databaseId },
        properties: {
          title: { title: [{ text: { content: title } }] },
          ...properties,
        },
      });
      return { success: true, data: page };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create page' };
    }
  }

  async getDatabase(databaseId: string): Promise<IntegrationResult> {
    try {
      const response = await this.getApiClient().databases.retrieve({ database_id: databaseId });
      return { success: true, data: response };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get database' };
    }
  }
}
