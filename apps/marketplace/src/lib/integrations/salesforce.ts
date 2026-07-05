import { BaseIntegration, IntegrationConfig, IntegrationStatus, IntegrationResult } from './base';

const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+/,
  /^10\.\d+\.\d+\.\d+/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /^192\.168\.\d+\.\d+/,
  /^169\.254\.\d+\.\d+/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^[fF][cCdD]/,
];

function validateUrl(raw: string, label: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`${label}: only http/https URLs are allowed`);
    }
    if (BLOCKED_HOSTS.some((re) => re.test(parsed.hostname))) {
      throw new Error(`${label}: requests to private/internal networks are not allowed`);
    }
    return raw.replace(/\/$/, '');
  } catch (err) {
    if (err instanceof Error && err.message.includes(label)) throw err;
    throw new Error(`${label}: invalid URL "${raw}"`);
  }
}

interface SalesforceAuth {
  accessToken: string;
  instanceUrl: string;
}

export class SalesforceIntegration extends BaseIntegration {
  private auth: SalesforceAuth | null = null;

  constructor(config?: IntegrationConfig) {
    super('salesforce', 'Salesforce', config);
  }

  private async authenticate(): Promise<SalesforceAuth> {
    if (this.auth) return this.auth;

    const [username, password, securityToken] = (this.config?.apiKey || '').split(':');
    const clientId = process.env.SALESFORCE_CLIENT_ID || '';
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET || '';

    if (this.config?.accessToken && this.config?.instanceUrl) {
      const instanceUrl = validateUrl(this.config.instanceUrl, 'Salesforce');
      this.auth = { accessToken: this.config.accessToken, instanceUrl };
      return this.auth;
    }

    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username: username || '',
      password: `${password || ''}${securityToken || ''}`,
    });

    const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Salesforce auth failed: ${response.status}`);
    }

    const data = await response.json() as SalesforceAuth & { access_token: string; instance_url: string };
    const instanceUrl = validateUrl(data.instance_url || data.instanceUrl || '', 'Salesforce');
    this.auth = { accessToken: data.access_token || data.accessToken, instanceUrl };
    return this.auth;
  }

  getApiClient(): Record<string, unknown> {
    return { authenticated: !!this.auth };
  }

  private async request<T>(path: string): Promise<T> {
    const auth = await this.authenticate();
    const response = await fetch(`${auth.instanceUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async testConnection(): Promise<IntegrationStatus> {
    try {
      await this.request<{ identity: string }>('/services/data/v62.0/');
      return { connected: true, label: 'Connected to Salesforce' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { connected: false, label: 'Disconnected', error: message };
    }
  }

  async query(soql: string): Promise<IntegrationResult> {
    try {
      const data = await this.request<{ records: unknown[]; totalSize: number }>(
        `/services/data/v62.0/query?q=${encodeURIComponent(soql)}`
      );
      return { success: true, data: { records: data.records, totalSize: data.totalSize } };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Query failed' };
    }
  }

  async describeObject(objectName: string): Promise<IntegrationResult> {
    try {
      const data = await this.request<{ fields: Array<{ name: string; type: string; label: string }> }>(
        `/services/data/v62.0/sobjects/${objectName}/describe`
      );
      return { success: true, data: data.fields };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Describe failed' };
    }
  }
}
