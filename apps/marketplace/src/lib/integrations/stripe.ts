import Stripe from 'stripe';
import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

export class StripeIntegration extends BaseIntegration {
  private client: Stripe | null = null;

  constructor(config?: IntegrationConfig) {
    super('stripe', 'Stripe', config);
  }

  getApiClient(): Stripe {
    if (!this.client) {
      this.client = new Stripe(this.config?.apiKey || '');
    }
    return this.client;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      const balance = await this.getApiClient().balance.retrieve();
      return { connected: true, label: `Connected - Balance: ${balance.available[0]?.amount || 0} ${balance.available[0]?.currency?.toUpperCase() || ''}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async listCustomers(limit = 10): Promise<IntegrationResult> {
    try {
      const customers = await this.getApiClient().customers.list({ limit });
      return { success: true, data: customers.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list customers' };
    }
  }

  async listProducts(limit = 20): Promise<IntegrationResult> {
    try {
      const products = await this.getApiClient().products.list({ limit });
      return { success: true, data: products.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list products' };
    }
  }

  async listSubscriptions(limit = 20): Promise<IntegrationResult> {
    try {
      const subscriptions = await this.getApiClient().subscriptions.list({ limit });
      return { success: true, data: subscriptions.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to list subscriptions' };
    }
  }
}
