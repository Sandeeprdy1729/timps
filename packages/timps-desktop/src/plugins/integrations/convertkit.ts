import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-best.js';

export interface ConvertKitSubscriber {
  id: number;
  email_address: string;
  first_name?: string;
  state: 'active' | 'unsubscribed' | 'bounced' | 'unconfirmed';
  created_at: string;
  tags?: ConvertKitTag[];
  fields?: Record<string, string>;
}

export interface ConvertKitTag {
  id: number;
  name: string;
}

export interface ConvertKitForm {
  id: number;
  name: string;
  created_at: string;
  type: 'hosted' | 'embedded';
}

export interface ConvertKitSequence {
  id: number;
  name: string;
  courses_count: number;
}

export interface ConvertKitBroadcast {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'sending' | 'sent';
  emails_sent?: number;
  scheduled_for?: string;
}

export interface ConvertKitCourse {
  id: number;
  name: string;
  description: string;
  posts_count: number;
}

export interface ConvertKitCustomField {
  id: number;
  label: string;
  key: string;
  type: 'text' | 'number' | 'date';
}

const MANIFEST: PluginManifest = {
  id: 'convertkit',
  name: 'ConvertKit',
  version: '1.0.0',
  description: 'ConvertKit email marketing integration for subscribers, forms, and broadcasts',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['convertkit', 'email', 'marketing', 'newsletter'],
};

const SCOPES = [
  'getSubscribers', 'createSubscriber', 'updateSubscriber', 'unsubscribe', 'addTag', 'removeTag', 'getTags', 'getForms',
  'createForm', 'getSequences', 'getSequence', 'addSubscriberToSequence', 'removeSubscriberFromSequence', 'getBroadcasts', 'createBroadcast',
  'updateBroadcast', 'deleteBroadcast', 'getCourses', 'getCourse', 'getCustomFields', 'createCustomField', 'updateCustomField', 'getLinks', 'getWebhooks', 'createWebhook', 'deleteWebhook',
];

export default class ConvertKitIntegration extends IntegrationBest {
  private apiBase = 'https://api.convertkit.com/v3';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['subscriber_added', 'subscriber_unsubscribed', 'subscriber_bounced', 'broadcast_sent', 'form_submitted'],
      dataModels: ['subscriber', 'form', 'sequence', 'broadcast', 'course', 'custom_field'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.apiKey || !config.clientSecret) {
      throw new Error('API key and secret are required');
    }
    this.setApiKey(config.apiKey);
    this.setAccessToken(config.clientSecret);

    try {
      const account = await this.apiCall<{ id: string }>(`${this.apiBase}/account`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.clientSecret}` },
      });
      return !!account.id;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/account`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getSubscribers': return this.apiCall<{ subscribers: ConvertKitSubscriber[] }>(`${this.apiBase}/subscribers`, { headers });
      case 'createSubscriber': return this.apiCall<ConvertKitSubscriber>(`${this.apiBase}/subscribers`, { method: 'POST', headers, body: JSON.stringify(params.subscriber) });
      case 'updateSubscriber': return this.apiCall<ConvertKitSubscriber>(`${this.apiBase}/subscribers/${params.subscriberId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'unsubscribe': return this.apiCall(`${this.apiBase}/unsubscribe`, { method: 'POST', headers, body: JSON.stringify({ email: params.email }) });
      case 'addTag': return this.apiCall(`${this.apiBase}/tags`, { method: 'POST', headers, body: JSON.stringify({ email: params.email, tag_id: params.tagId }) });
      case 'removeTag': return this.apiCall(`${this.apiBase}/subscribers/${params.subscriberId}/tags/${params.tagId}`, { method: 'DELETE', headers });
      case 'getTags': return this.apiCall<{ tags: ConvertKitTag[] }>(`${this.apiBase}/tags`, { headers });
      case 'getForms': return this.apiCall<{ forms: ConvertKitForm[] }>(`${this.apiBase}/forms`, { headers });
      case 'createForm': return this.apiCall<ConvertKitForm>(`${this.apiBase}/forms`, { method: 'POST', headers, body: JSON.stringify(params.form) });
      case 'getSequences': return this.apiCall<{ api_sequenes: ConvertKitSequence[] }>(`${this.apiBase}/sequences`, { headers });
      case 'getSequence': return this.apiCall<ConvertKitSequence>(`${this.apiBase}/sequences/${params.sequenceId}`, { headers });
      case 'addSubscriberToSequence': return this.apiCall(`${this.apiBase}/sequences/${params.sequenceId}/subscribe`, { method: 'POST', headers, body: JSON.stringify(params.subscriber) });
      case 'getBroadcasts': return this.apiCall<{ broadcasts: ConvertKitBroadcast[] }>(`${this.apiBase}/broadcasts`, { headers });
      case 'createBroadcast': return this.apiCall<ConvertKitBroadcast>(`${this.apiBase}/broadcasts`, { method: 'POST', headers, body: JSON.stringify(params.broadcast) });
      case 'updateBroadcast': return this.apiCall<ConvertKitBroadcast>(`${this.apiBase}/broadcasts/${params.broadcastId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'getCourses': return this.apiCall<{ courses: ConvertKitCourse[] }>(`${this.apiBase}/courses`, { headers });
      case 'getCustomFields': return this.apiCall<{ custom_fields: ConvertKitCustomField[] }>(`${this.apiBase}/custom_fields`, { headers });
      case 'createCustomField': return this.apiCall<ConvertKitCustomField>(`${this.apiBase}/custom_fields`, { method: 'POST', headers, body: JSON.stringify(params.field) });
      case 'getLinks': return this.apiCall(`${this.apiBase}/links`, { headers });
      case 'getWebhooks': return this.apiCall(`${this.apiBase}/webhooks`, { headers });
      case 'createWebhook': return this.apiCall(`${this.apiBase}/webhooks`, { method: 'POST', headers, body: JSON.stringify(params.webhook) });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'subscribers': return this.executeAction('getSubscribers', options || {});
      case 'forms': return this.executeAction('getForms', options || {});
      case 'sequences': return this.executeAction('getSequences', options || {});
      case 'broadcasts': return this.executeAction('getBroadcasts', options || {});
      case 'courses': return this.executeAction('getCourses', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; this.apiKey = null; }

  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createConvertKitIntegration(): ConvertKitIntegration { return new ConvertKitIntegration(); }