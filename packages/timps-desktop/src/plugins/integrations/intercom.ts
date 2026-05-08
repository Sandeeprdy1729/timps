import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface IntercomUser {
  id: string;
  type: 'user' | 'lead';
  user_id: string;
  email: string;
  phone: string | null;
  name: string;
  first_seen_at: number;
  last_seen_at: number;
  custom_attributes: Record<string, unknown>;
  location_data: Record<string, unknown>;
}

export interface IntercomConversation {
  id: string;
  created_at: number;
  updated_at: number;
  title: string | null;
  state: 'open' | 'closed';
  read: boolean;
  priority: 'priority' | 'not_priority';
  contacts: { contacts: IntercomContact[] };
}

export interface IntercomContact {
  id: string;
  type: 'user' | 'lead';
  user_id: string;
  email: string;
}

export interface IntercomArticle {
  id: string;
  title: string;
  description: string;
  body: string;
  author_id: string;
  state: 'draft' | 'published';
  created_at: number;
  updated_at: number;
}

export interface IntercomTeam {
  id: string;
  name: string;
  admin_ids: string[];
}

const MANIFEST: PluginManifest = {
  id: 'intercom',
  name: 'Intercom',
  version: '1.0.0',
  description: 'Intercom customer messaging integration for users, conversations, and articles',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['intercom', 'messaging', 'customer', 'support'],
};

const SCOPES = [
  'getUsers', 'getUser', 'createUser', 'updateUser', 'deleteUser', 'searchUsers',
  'getConversations', 'getConversation', 'createConversation', 'replyConversation', 'closeConversation',
  'getContacts', 'getContact',
  'getArticles', 'getArticle', 'createArticle', 'updateArticle', 'deleteArticle',
  'getTeams', 'getTeam',
  'getSegments', 'getSegment',
  'getCounts', 'getAdminCounts',
  'getNotes', 'createNote',
  'getDataAttributes', 'createDataAttribute',
  'getWebhooks', 'createWebhook', 'deleteWebhook',
  'getEvents', 'createEvent',
  'uploadAttachment',
];

export default class IntercomIntegration extends IntegrationBase {
  private apiBase = 'https://api.intercom.io/v10';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['user_created', 'conversation_created', 'conversation_closed'],
      dataModels: ['user', 'conversation', 'article', 'team', 'segment'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);
    try {
      const me = await this.apiCall<{ id: string }>(`${this.apiBase}/me`, {
        headers: { Authorization: `Bearer ${config.accessToken}`, 'Accept': 'application/json' },
      });
      return !!me.id;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/me`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

    switch (action) {
      case 'getUsers': return this.apiCall<{ data: IntercomUser[] }>(`${this.apiBase}/contacts`, { headers });
      case 'getUser': return this.apiCall<IntercomUser>(`${this.apiBase}/contacts/${params.userId}`, { headers });
      case 'createUser': return this.apiCall<IntercomUser>(`${this.apiBase}/contacts`, { method: 'POST', headers, body: JSON.stringify(params.user) });
      case 'updateUser': return this.apiCall<IntercomUser>(`${this.apiBase}/contacts/${params.userId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'deleteUser': return this.apiCall(`${this.apiBase}/contacts/${params.userId}`, { method: 'DELETE', headers });
      case 'searchUsers': return this.apiCall<{ data: IntercomUser[] }>(`${this.apiBase}/contacts/search`, { method: 'POST', headers, body: JSON.stringify(params.query) });
      case 'getConversations': return this.apiCall<{ conversations: IntercomConversation[] }>(`${this.apiBase}/conversations`, { headers });
      case 'getConversation': return this.apiCall<IntercomConversation>(`${this.apiBase}/conversations/${params.conversationId}`, { headers });
      case 'createConversation': return this.apiCall<IntercomConversation>(`${this.apiBase}/conversations`, { method: 'POST', headers, body: JSON.stringify(params.conversation) });
      case 'replyConversation': return this.apiCall(`${this.apiBase}/conversations/${params.conversationId}/reply`, { method: 'POST', headers, body: JSON.stringify(params.reply) });
      case 'closeConversation': return this.apiCall(`${this.apiBase}/conversations/${params.conversationId}/parts`, { method: 'POST', headers, body: JSON.stringify({ message_type: 'close', type: 'admin', admin_id: params.adminId }) });
      case 'getArticles': return this.apiCall<{ data: IntercomArticle[] }>(`${this.apiBase}/articles`, { headers });
      case 'getArticle': return this.apiCall<IntercomArticle>(`${this.apiBase}/articles/${params.articleId}`, { headers });
      case 'createArticle': return this.apiCall<IntercomArticle>(`${this.apiBase}/articles`, { method: 'POST', headers, body: JSON.stringify(params.article) });
      case 'getTeams': return this.apiCall<{ data: IntercomTeam[] }>(`${this.apiBase}/teams`, { headers });
      case 'getSegments': return this.apiCall(`${this.apiBase}/segments`, { headers });
      case 'getCounts': return this.apiCall(`${this.apiBase}/counts`, { headers });
      case 'getNotes': return this.apiCall(`${this.apiBase}/notes`, { headers });
      case 'createEvent': return this.apiCall(`${this.apiBase}/events`, { method: 'POST', headers, body: JSON.stringify(params.event) });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'users': return this.executeAction('getUsers', options || {});
      case 'conversations': return this.executeAction('getConversations', options || {});
      case 'articles': return this.executeAction('getArticles', options || {});
      case 'teams': return this.executeAction('getTeams', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createIntercomIntegration(): IntercomIntegration { return new IntercomIntegration(); }