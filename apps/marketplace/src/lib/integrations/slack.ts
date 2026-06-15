import { WebClient } from '@slack/web-api';
import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

export class SlackIntegration extends BaseIntegration {
  private client: WebClient | null = null;

  constructor(config?: IntegrationConfig) {
    super('slack', 'Slack', config);
  }

  getApiClient(): WebClient {
    if (!this.client) {
      this.client = new WebClient(this.config?.accessToken || this.config?.apiKey);
    }
    return this.client;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      const result = await this.getApiClient().auth.test();
      return { connected: true, label: `Connected to ${result.team || 'Slack'}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async sendMessage(channel: string, text: string): Promise<IntegrationResult> {
    try {
      const result = await this.getApiClient().chat.postMessage({ channel, text });
      return { success: true, data: result };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to send message' };
    }
  }

  async listChannels(limit = 100): Promise<IntegrationResult> {
    try {
      const result = await this.getApiClient().conversations.list({ limit });
      return { success: true, data: result.channels };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list channels' };
    }
  }

  async getChannelHistory(channel: string, limit = 50): Promise<IntegrationResult> {
    try {
      const result = await this.getApiClient().conversations.history({ channel, limit });
      return { success: true, data: result.messages };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get history' };
    }
  }
}
