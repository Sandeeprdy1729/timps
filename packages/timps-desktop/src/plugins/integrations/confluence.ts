import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface ConfluencePage {
  id: string;
  type: string;
  title: string;
  space: { key: string };
  body: { storage: { value: string } };
  version: { number: number };
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: string;
}

export interface ConfluenceContent {
  id: string;
  title: string;
  type: string;
}

const MANIFEST: PluginManifest = {
  id: 'confluence',
  name: 'Confluence',
  version: '1.0.0',
  description: 'Confluence collaboration and wiki integration',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['confluence', 'wiki', 'collaboration'],
};

const SCOPES = ['getSpaces', 'getSpace', 'getPages', 'getPage', 'createPage', 'updatePage', 'deletePage', 'getContent', 'searchContent', 'getVersions', 'getLabels'];

export default class ConfluenceIntegration extends IntegrationBase {
  private apiBase = '';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = { actions: SCOPES, triggers: ['page_created', 'page_updated'], dataModels: ['page', 'space'] };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken || !config.clientId) throw new Error('Access token and cloud ID required');
    this.setAccessToken(config.accessToken);
    this.apiBase = `https://${config.clientId}.atlassian.net/wiki/api/v2`;
    try {
      const user = await this.apiCall<{ id: string }>(`${this.apiBase}/users/me`, { headers: { Authorization: `Bearer ${config.accessToken}` } });
      return !!user.id;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/users/me`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };
    switch (action) {
      case 'getSpaces': return this.apiCall<{ results: ConfluenceSpace[] }>(`${this.apiBase}/spaces`, { headers });
      case 'getPages': return this.apiCall<{ results: ConfluencePage[] }>(`${this.apiBase}/pages?spaceId=${params.spaceId}`, { headers });
      case 'getPage': return this.apiCall<ConfluencePage>(`${this.apiBase}/pages/${params.pageId}`, { headers });
      case 'createPage': return this.apiCall<ConfluencePage>(`${this.apiBase}/pages`, { method: 'POST', headers, body: JSON.stringify(params.page) });
      case 'updatePage': return this.apiCall(`${this.apiBase}/pages/${params.pageId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'searchContent': return this.apiCall(`${this.apiBase}/content?title=${params.title}`, { headers });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'spaces': return this.executeAction('getSpaces', options || {});
      case 'pages': return this.executeAction('getPages', { spaceId: options?.spaceId });
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createConfluenceIntegration(): ConfluenceIntegration { return new ConfluenceIntegration(); }