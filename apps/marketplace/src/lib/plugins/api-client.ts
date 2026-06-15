import { BasePlugin, PluginResult, PluginConfig } from './base';

export class ApiClientPlugin extends BasePlugin {
  private client: typeof fetch;

  constructor(config?: PluginConfig) {
    super('api-client', 'API Client', config);
    this.client = fetch;
  }

  getDescription(): string {
    return 'Test and manage REST APIs directly from TIMPS';
  }

  async run(): Promise<PluginResult> {
    try {
      const url = this.config?.params?.url || 'https://jsonplaceholder.typicode.com/posts/1';
      const method = (this.config?.params?.method || 'GET').toUpperCase();
      const headers = this.config?.params?.headers ? JSON.parse(this.config.params.headers) : {};

      const options: RequestInit = { method, headers };
      if (this.config?.params?.body && method !== 'GET') {
        options.body = this.config.params.body;
      }

      const startTime = performance.now();
      const response = await this.client(url, options);
      const duration = performance.now() - startTime;

      const body = await response.text();
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = body.slice(0, 500);
      }

      return {
        success: true,
        output: `${response.status} ${response.statusText} (${duration.toFixed(0)}ms)`,
        data: {
          statusCode: response.status,
          statusText: response.statusText,
          duration: `${duration.toFixed(0)}ms`,
          headers: Object.fromEntries(response.headers.entries()),
          body: parsedBody,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'API request failed' };
    }
  }
}
