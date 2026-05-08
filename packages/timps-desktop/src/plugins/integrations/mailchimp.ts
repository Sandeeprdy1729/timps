import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface MailchimpMember {
  id: string;
  email_address: string;
  status: 'subscribed' | 'unsubscribed' | 'pending' | 'cleaned';
  merge_fields: Record<string, string>;
  stats: { open_rate: number; click_rate: number };
}

export interface MailchimpCampaign {
  id: string;
  web_id: number;
  type: 'regular' | 'absplit' | 'rss' | 'auto';
  status: 'save' | 'sending' | 'sent' | 'sending' | 'paused';
  subject_line: string;
  send_time: string;
}

export interface MailchimpList {
  id: string;
  name: string;
  stats: { member_count: number; unsubscribe_count: number };
}

export interface MailchimpTemplate {
  id: number;
  name: string;
  type: 'user' | 'system';
  date_created: string;
}

const MANIFEST: PluginManifest = {
  id: 'mailchimp',
  name: 'Mailchimp',
  version: '1.0.0',
  description: 'Mailchimp email marketing integration for lists, campaigns, and automation',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['mailchimp', 'email', 'marketing', 'newsletter'],
};

const SCOPES = [
  'getLists', 'getList', 'createList', 'updateList', 'deleteList',
  'getMembers', 'addMember', 'updateMember', 'deleteMember', 'batchMembers',
  'getTags', 'addTag',
  'getCampaigns', 'getCampaign', 'createCampaign', 'updateCampaign', 'sendCampaign', 'deleteCampaign',
  'getTemplates', 'getTemplate',
  'getReports', 'getReport',
  'getAutomations', 'getAutomation',
  'getWebhooks', 'createWebhook', 'deleteWebhook',
  'getSegments', 'createSegment',
];

export default class MailchimpIntegration extends IntegrationBase {
  private apiBase = 'https://<dc>.api.mailchimp.com/3.0';
  private dc: string = 'us1';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['member_subscribed', 'member_unsubscribed', 'campaign_sent'],
      dataModels: ['member', 'campaign', 'list', 'template'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('API key is required');
    this.setAccessToken(config.accessToken);
    this.dc = (config.accessToken as string).split('-')[1] || 'us1';
    try {
      const account = await this.apiCall<{ account_id: string }>(`https://${this.dc}.api.mailchimp.com/3.0/`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return !!account.account_id;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`https://${this.dc}.api.mailchimp.com/3.0/`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };
    const base = `https://${this.dc}.api.mailchimp.com/3.0`;

    switch (action) {
      case 'getLists': return this.apiCall<{ lists: MailchimpList[] }>(`${base}/lists`, { headers });
      case 'getList': return this.apiCall<MailchimpList>(`${base}/lists/${params.listId}`, { headers });
      case 'getMembers': return this.apiCall<{ members: MailchimpMember[] }>(`${base}/lists/${params.listId}/members`, { headers });
      case 'addMember': return this.apiCall<MailchimpMember>(`${base}/lists/${params.listId}/members`, { method: 'POST', headers, body: JSON.stringify(params.member) });
      case 'updateMember': return this.apiCall<MailchimpMember>(`${base}/lists/${params.listId}/members/${params.memberId}`, { method: 'PATCH', headers, body: JSON.stringify(params.updates) });
      case 'batchMembers': return this.apiCall(`${base}/lists/${params.listId}/members`, { method: 'POST', headers, body: JSON.stringify({ operations: params.operations }) });
      case 'getCampaigns': return this.apiCall<{ campaigns: MailchimpCampaign[] }>(`${base}/campaigns`, { headers });
      case 'getCampaign': return this.apiCall<MailchimpCampaign>(`${base}/campaigns/${params.campaignId}`, { headers });
      case 'createCampaign': return this.apiCall<MailchimpCampaign>(`${base}/campaigns`, { method: 'POST', headers, body: JSON.stringify(params.campaign) });
      case 'sendCampaign': return this.apiCall(`${base}/campaigns/${params.campaignId}/actions/send`, { method: 'POST', headers });
      case 'getTemplates': return this.apiCall<{ templates: MailchimpTemplate[] }>(`${base}/templates`, { headers });
      case 'getReports': return this.apiCall(`${base}/reports`, { headers });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'lists': return this.executeAction('getLists', options || {});
      case 'members': return this.executeAction('getMembers', { listId: options?.listId });
      case 'campaigns': return this.executeAction('getCampaigns', options || {});
      case 'templates': return this.executeAction('getTemplates', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createMailchimpIntegration(): MailchimpIntegration { return new MailchimpIntegration(); }