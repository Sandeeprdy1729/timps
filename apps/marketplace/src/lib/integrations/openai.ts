import OpenAI from 'openai';
import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

export class OpenAIIntegration extends BaseIntegration {
  private client: OpenAI | null = null;

  constructor(config?: IntegrationConfig) {
    super('openai', 'OpenAI', config);
  }

  getApiClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.config?.apiKey });
    }
    return this.client;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      const models = await this.getApiClient().models.list();
      return { connected: true, label: `Connected - ${models.data.length} models available` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async generateCompletion(prompt: string, model = 'gpt-4o'): Promise<IntegrationResult> {
    try {
      const response = await this.getApiClient().chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
      });
      return { success: true, data: response.choices[0]?.message?.content || '' };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Completion failed' };
    }
  }

  async generateCode(prompt: string): Promise<IntegrationResult> {
    return this.generateCompletion(
      `Generate production-ready code for the following request. Return only the code with no explanation:\n\n${prompt}`,
      'gpt-4o'
    );
  }

  async reviewCode(code: string): Promise<IntegrationResult> {
    return this.generateCompletion(
      `Review the following code for bugs, security issues, and best practices. Provide a structured review:\n\n${code}`,
      'gpt-4o'
    );
  }
}
