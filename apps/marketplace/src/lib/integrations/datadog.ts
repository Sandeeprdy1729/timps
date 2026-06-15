import { client, v1 } from '@datadog/datadog-api-client';
import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

export class DatadogIntegration extends BaseIntegration {
  constructor(config?: IntegrationConfig) {
    super('datadog', 'Datadog', config);
  }

  private getConfiguration(): client.Configuration {
    return client.createConfiguration({
      authMethods: {
        apiKeyAuth: this.config?.apiKey || '',
        appKeyAuth: this.config?.accessToken || '',
      },
    });
  }

  getApiClient(): Record<string, unknown> {
    return { configured: true };
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      const config = this.getConfiguration();
      const monitorsApi = new v1.MonitorsApi(config);
      await monitorsApi.listMonitors({});
      return { connected: true, label: 'Connected to Datadog' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async listMonitors(): Promise<IntegrationResult> {
    try {
      const monitorsApi = new v1.MonitorsApi(this.getConfiguration());
      const monitors = await monitorsApi.listMonitors({});
      return { success: true, data: monitors };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list monitors' };
    }
  }
}
