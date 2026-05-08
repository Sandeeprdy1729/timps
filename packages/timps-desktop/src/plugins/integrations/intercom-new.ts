import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface IntercomUser {
  id: string;
  type: 'user' | 'lead';
  user_id: string;
  email: string;
  phone?: string;
  name?: string;
  avatar?: IntercomAvatar;
  signed_up_at?: number;
  last_seen_at?: number;
  last_request_at?: number;
  created_at: number;
  updated_at: number;
  custom_attributes?: Record<string, unknown>;
  location_data?: IntercomLocationData;
  social_profiles?: IntercomSocialProfiles;
  tags?: IntercomTag[];
  segments?: IntercomSegment[];
  companies?: IntercomCompanyRef[];
  notes?: IntercomNote[];
  conversation_role?: string;
}

export interface IntercomAvatar {
  type: string;
  image_url: string;
}

export interface IntercomLocationData {
  city_name?: string;
  country_name?: string;
  region_name?: string;
  latitude?: number;
  longitude?: number;
}

export interface IntercomSocialProfiles {
  data: Array<{
    type: string;
    url: string;
  }>;
}

export interface IntercomTag {
  id: string;
  name: string;
}

export interface IntercomSegment {
  id: string;
  name: string;
}

export interface IntercomCompanyRef {
  id: string;
  name: string;
}

export interface IntercomNote {
  id: string;
  body: string;
  author_id: string;
  created_at: number;
}

export interface IntercomConversation {
  id: string;
  created_at: number;
  updated_at: number;
  title?: string;
  description?: string;
  state: 'open' | 'closed' | 'snoozed';
  read?: boolean;
  priority?: 'priority' | 'not_priority';
  assignee?: IntercomAssignee;
  contacts: {
    contacts: IntercomContactRef[];
  };
  conversation_parts?: {
    conversation_parts: IntercomConversationPart[];
    total_count: number;
  };
  tags?: IntercomTag[];
  conversation_message?: IntercomConversationMessage;
  source: IntercomConversationSource;
  admin_assignee_id?: string;
  team_assignee_id?: string;
  statistics?: IntercomConversationStats;
}

export interface IntercomAssignee {
  id: string;
  type: 'admin' | 'team';
  name?: string;
  email?: string;
}

export interface IntercomContactRef {
  id: string;
  type: 'user' | 'lead';
  user_id?: string;
  email?: string;
  name?: string;
}

export interface IntercomConversationPart {
  id: string;
  part_type: 'comment' | 'note' | 'assignment' | 'notification' | 'conversation_status_changed';
  body?: string;
  author: IntercomPartAuthor;
  created_at: number;
  updated_at: number;
  attachments?: IntercomAttachment[];
}

export interface IntercomPartAuthor {
  type: 'user' | 'admin' | 'bot';
  id: string;
  name?: string;
  email?: string;
}

export interface IntercomAttachment {
  type: string;
  url: string;
  name: string;
  content_type: string;
  size: number;
}

export interface IntercomConversationMessage {
  type: string;
  id: string;
  author: IntercomPartAuthor;
  body?: string;
  attachments?: IntercomAttachment[];
}

export interface IntercomConversationSource {
  type: 'user' | 'admin' | 'conversation';
  id: string;
  body?: string;
  author?: IntercomPartAuthor;
  delivered_as?: string;
  subject?: string;
  attachments?: IntercomAttachment[];
  metadata?: Record<string, unknown>;
}

export interface IntercomConversationStats {
  time_to_admin_reply?: number;
  time_to_close?: number;
  time_to_first_contact?: number;
  count_reopens?: number;
  count_priority?: number;
  count_not_priority?: number;
}

export interface IntercomArticle {
  id: string;
  type: 'article';
  title: string;
  description?: string;
  body: string;
  author_id: string;
  state: 'draft' | 'published';
  created_at: number;
  updated_at: number;
  published_at?: number;
  url?: string;
  parent_id?: string;
  parent_type?: 'collection' | 'section';
  category_id?: string;
  section_id?: string;
  tags?: IntercomTag[];
  translations?: IntercomArticleTranslation[];
  body_updated_at?: number;
}

export interface IntercomArticleTranslation {
  locale: string;
  title: string;
  body: string;
  description?: string;
}

export interface IntercomCollection {
  id: string;
  name: string;
  description?: string;
  created_at: number;
  updated_at: number;
  url?: string;
  icon?: string;
}

export interface IntercomSection {
  id: string;
  name: string;
  description?: string;
  collection_id: string;
  created_at: number;
  updated_at: number;
  url?: string;
}

export interface IntercomTeam {
  id: string;
  name: string;
  admin_ids: string[];
  description?: string;
  auto_assign?: boolean;
  assignment_priority?: 'round_robin' | 'load_balance' | 'fixed';
}

export interface IntercomAdmin {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'agent' | 'developer';
  avatar?: IntercomAvatar;
  created_at: number;
  last_seen_at?: number;
}

export interface IntercomWebhook {
  id: string;
  url: string;
  topics: string[];
  active: boolean;
  created_at: number;
  updated_at?: number;
}

export type IntercomWebhookTopic =
  | 'conversation.user.created'
  | 'conversation.user.replied'
  | 'conversation.admin.created'
  | 'conversation.admin.replied'
  | 'conversation.admin.closed'
  | 'conversation.priority.changed'
  | 'conversation.status.changed'
  | 'conversation.admin.assigned'
  | 'conversation.team.assigned'
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'event.created'
  | 'article.published'
  | 'article.created'
  | 'article.updated';

export interface IntercomSegmentDetail {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  count: number;
  rules?: IntercomSegmentRule[];
}

export interface IntercomSegmentRule {
  field: string;
  operator: string;
  value: string | number | boolean;
}

export interface IntercomTagDetail {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface IntercomCompany {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  custom_attributes?: Record<string, unknown>;
  monthly_spend?: number;
  session_count?: number;
  user_count?: number;
  tags?: IntercomTag[];
  segments?: IntercomSegment[];
}

export interface IntercomDataAttribute {
  id: string;
  name: string;
  description?: string;
  data_type: 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'object';
  model: 'user' | 'company';
  options?: string[];
  encoding?: string;
  archived?: boolean;
}

export interface IntercomEvent {
  id: string;
  event_name: string;
  created_at: number;
  user_id?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface IntercomCount {
  type: string;
  count: number;
}

export interface IntercomSearchRequest {
  query: string;
  pagination?: {
    per_page?: number;
    starting_after?: string;
  };
}

export interface IntercomConversationReply {
  message_type: 'comment' | 'note';
  type: 'user' | 'admin';
  admin_id?: string;
  body?: string;
  attachment_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface IntercomConversationSearch {
  query: {
    field: string;
    operator: string;
    value: string;
  }[];
  pagination?: {
    per_page?: number;
    starting_after?: string;
  };
}

export interface IntercomPluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  keywords: string[];
  actions?: Array<{ id: string; name: string; description: string }>;
  triggers?: Array<{ id: string; name: string; description: string }>;
  auth?: {
    type: string;
    fields: Array<{ name: string; label: string; description: string; required?: boolean }>;
  };
  settings?: Array<{ name: string; label: string; type: string; default?: unknown; options?: string[] }>;
  connectionTest?: { endpoint: string; method: string };
}

interface IntercomConfig {
  accessToken: string;
  timeout?: number;
  maxRetries?: number;
}

export class IntercomPlugin extends IntegrationBase {
  private config: IntercomConfig;
  private apiBase: string;

  constructor() {
    super('intercom', 'Intercom', 'Intercom customer messaging integration for users, conversations, articles, teams, and webhooks');
    this.config = { accessToken: '' };
    this.apiBase = 'https://api.intercom.io/v10';
  }

  setConfig(accessToken: string, timeout?: number, maxRetries?: number): void {
    this.config = { accessToken, timeout, maxRetries };
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.apiBase}${endpoint}`, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Intercom API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('Access token is required');
    }

    this.setConfig(config.accessToken);
    return this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    if (!this.config.accessToken) return false;

    try {
      const result = await this.makeRequest<{ id: string }>('/me');
      return !!result.id;
    } catch {
      return false;
    }
  }

  async getMe(): Promise<IntercomAdmin> {
    return this.makeRequest<IntercomAdmin>('/me');
  }

  async getUsers(options?: {
    page?: number;
    perPage?: number;
  }): Promise<{ data: IntercomUser[]; pages?: unknown }> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.perPage) params.append('per_page', options.perPage.toString());

    return this.makeRequest<{ data: IntercomUser[] }>(`/contacts?${params}`);
  }

  async getUser(userId: string): Promise<IntercomUser> {
    return this.makeRequest<IntercomUser>(`/contacts/${userId}`);
  }

  async createUser(user: Partial<IntercomUser>): Promise<IntercomUser> {
    return this.makeRequest<IntercomUser>('/contacts', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async updateUser(userId: string, updates: Partial<IntercomUser>): Promise<IntercomUser> {
    return this.makeRequest<IntercomUser>(`/contacts/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(userId: string): Promise<{ id: string }> {
    return this.makeRequest<{ id: string }>(`/contacts/${userId}`, {
      method: 'DELETE',
    });
  }

  async searchUsers(request: IntercomSearchRequest): Promise<{ data: IntercomUser[] }> {
    return this.makeRequest<{ data: IntercomUser[] }>('/contacts/search', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getUserByEmail(email: string): Promise<IntercomUser> {
    return this.makeRequest<IntercomUser>(`/contacts/search`, {
      method: 'POST',
      body: JSON.stringify({
        query: { field: 'email', operator: '=', value: email }
      }),
    });
  }

  async getUserTags(userId: string): Promise<{ data: IntercomTag[] }> {
    return this.makeRequest<{ data: IntercomTag[] }>(`/contacts/${userId}/tags`);
  }

  async tagUser(userId: string, tagId: string): Promise<IntercomTag> {
    return this.makeRequest<IntercomTag>(`/contacts/${userId}/tag`, {
      method: 'POST',
      body: JSON.stringify({ id: tagId }),
    });
  }

  async untagUser(userId: string, tagId: string): Promise<{ id: string }> {
    return this.makeRequest<{ id: string }>(`/contacts/${userId}/untag`, {
      method: 'POST',
      body: JSON.stringify({ id: tagId }),
    });
  }

  async getUserSegments(userId: string): Promise<{ data: IntercomSegment[] }> {
    return this.makeRequest<{ data: IntercomSegment[] }>(`/contacts/${userId}/segments`);
  }

  async getUserCompanies(userId: string): Promise<{ data: IntercomCompany[] }> {
    return this.makeRequest<{ data: IntercomCompany[] }>(`/contacts/${userId}/companies`);
  }

  async getUserNotes(userId: string): Promise<{ data: IntercomNote[] }> {
    return this.makeRequest<{ data: IntercomNote[] }>(`/contacts/${userId}/notes`);
  }

  async createNote(userId: string, body: string): Promise<IntercomNote> {
    return this.makeRequest<IntercomNote>(`/contacts/${userId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  async getConversations(options?: {
    page?: number;
    perPage?: number;
    open?: boolean;
    closed?: boolean;
  }): Promise<{ conversations: IntercomConversation[]; pages?: unknown }> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.perPage) params.append('per_page', options.perPage.toString());
    if (options?.open !== undefined) params.append('open', options.open.toString());
    if (options?.closed !== undefined) params.append('closed', options.closed.toString());

    return this.makeRequest<{ conversations: IntercomConversation[] }>(`/conversations?${params}`);
  }

  async getConversation(conversationId: string): Promise<IntercomConversation> {
    return this.makeRequest<IntercomConversation>(`/conversations/${conversationId}`);
  }

  async createConversation(conversation: {
    from: { type: 'user' | 'admin'; email?: string; user_id?: string };
    body?: string;
    subject?: string;
  }): Promise<IntercomConversation> {
    return this.makeRequest<IntercomConversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify(conversation),
    });
  }

  async replyConversation(conversationId: string, reply: IntercomConversationReply): Promise<{ conversation_parts: IntercomConversationPart[] }> {
    return this.makeRequest<{ conversation_parts: IntercomConversationPart[] }>(`/conversations/${conversationId}/reply`, {
      method: 'POST',
      body: JSON.stringify(reply),
    });
  }

  async closeConversation(conversationId: string, adminId: string): Promise<IntercomConversation> {
    return this.makeRequest<IntercomConversation>(`/conversations/${conversationId}/parts`, {
      method: 'POST',
      body: JSON.stringify({
        message_type: 'close',
        type: 'admin',
        admin_id: adminId,
      }),
    });
  }

  async snoozeConversation(conversationId: string, snoozeUntil: number): Promise<IntercomConversation> {
    return this.makeRequest<IntercomConversation>(`/conversations/${conversationId}`, {
      method: 'PUT',
      body: JSON.stringify({
        state: 'snoozed',
        snoozed_until: snoozeUntil,
      }),
    });
  }

  async reopenConversation(conversationId: string): Promise<IntercomConversation> {
    return this.makeRequest<IntercomConversation>(`/conversations/${conversationId}/parts`, {
      method: 'POST',
      body: JSON.stringify({
        message_type: 'reopen',
        type: 'admin',
      }),
    });
  }

  async assignConversation(conversationId: string, adminId: string): Promise<IntercomConversation> {
    return this.makeRequest<IntercomConversation>(`/conversations/${conversationId}/parts`, {
      method: 'POST',
      body: JSON.stringify({
        message_type: 'assignment',
        type: 'admin',
        admin_id: adminId,
      }),
    });
  }

  async searchConversations(search: IntercomConversationSearch): Promise<{ conversations: IntercomConversation[] }> {
    return this.makeRequest<{ conversations: IntercomConversation[] }>('/conversations/search', {
      method: 'POST',
      body: JSON.stringify(search),
    });
  }

  async getConversationParts(conversationId: string): Promise<{ conversation_parts: IntercomConversationPart[]; total_count: number }> {
    return this.makeRequest<{ conversation_parts: IntercomConversationPart[]; total_count: number }>(`/conversations/${conversationId}/parts`);
  }

  async getArticles(options?: { page?: number; perPage?: number }): Promise<{ data: IntercomArticle[] }> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.perPage) params.append('per_page', options.perPage.toString());

    return this.makeRequest<{ data: IntercomArticle[] }>(`/articles?${params}`);
  }

  async getArticle(articleId: string): Promise<IntercomArticle> {
    return this.makeRequest<IntercomArticle>(`/articles/${articleId}`);
  }

  async createArticle(article: Partial<IntercomArticle>): Promise<IntercomArticle> {
    return this.makeRequest<IntercomArticle>('/articles', {
      method: 'POST',
      body: JSON.stringify(article),
    });
  }

  async updateArticle(articleId: string, updates: Partial<IntercomArticle>): Promise<IntercomArticle> {
    return this.makeRequest<IntercomArticle>(`/articles/${articleId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteArticle(articleId: string): Promise<{ id: string }> {
    return this.makeRequest<{ id: string }>(`/articles/${articleId}`, {
      method: 'DELETE',
    });
  }

  async publishArticle(articleId: string): Promise<IntercomArticle> {
    return this.makeRequest<IntercomArticle>(`/articles/${articleId}/publish`, {
      method: 'POST',
    });
  }

  async archiveArticle(articleId: string): Promise<IntercomArticle> {
    return this.makeRequest<IntercomArticle>(`/articles/${articleId}`, {
      method: 'PUT',
      body: JSON.stringify({ state: 'archived' }),
    });
  }

  async getCollections(): Promise<{ data: IntercomCollection[] }> {
    return this.makeRequest<{ data: IntercomCollection[] }>('/collections');
  }

  async getCollection(collectionId: string): Promise<IntercomCollection> {
    return this.makeRequest<IntercomCollection>(`/collections/${collectionId}`);
  }

  async createCollection(collection: Partial<IntercomCollection>): Promise<IntercomCollection> {
    return this.makeRequest<IntercomCollection>('/collections', {
      method: 'POST',
      body: JSON.stringify(collection),
    });
  }

  async getSections(collectionId: string): Promise<{ data: IntercomSection[] }> {
    return this.makeRequest<{ data: IntercomSection[] }>(`/collections/${collectionId}/sections`);
  }

  async getTeams(): Promise<{ data: IntercomTeam[] }> {
    return this.makeRequest<{ data: IntercomTeam[] }>('/teams');
  }

  async getTeam(teamId: string): Promise<IntercomTeam> {
    return this.makeRequest<IntercomTeam>(`/teams/${teamId}`);
  }

  async createTeam(team: Partial<IntercomTeam>): Promise<IntercomTeam> {
    return this.makeRequest<IntercomTeam>('/teams', {
      method: 'POST',
      body: JSON.stringify(team),
    });
  }

  async updateTeam(teamId: string, updates: Partial<IntercomTeam>): Promise<IntercomTeam> {
    return this.makeRequest<IntercomTeam>(`/teams/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTeam(teamId: string): Promise<{ id: string }> {
    return this.makeRequest<{ id: string }>(`/teams/${teamId}`, {
      method: 'DELETE',
    });
  }

  async getAdmins(): Promise<{ data: IntercomAdmin[] }> {
    return this.makeRequest<{ data: IntercomAdmin[] }>('/admins');
  }

  async getAdmin(adminId: string): Promise<IntercomAdmin> {
    return this.makeRequest<IntercomAdmin>(`/admins/${adminId}`);
  }

  async getWebhooks(): Promise<{ data: IntercomWebhook[] }> {
    return this.makeRequest<{ data: IntercomWebhook[] }>('/webhooks');
  }

  async getWebhook(webhookId: string): Promise<IntercomWebhook> {
    return this.makeRequest<IntercomWebhook>(`/webhooks/${webhookId}`);
  }

  async createWebhook(webhook: {
    url: string;
    topics: IntercomWebhookTopic[];
  }): Promise<IntercomWebhook> {
    return this.makeRequest<IntercomWebhook>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(webhook),
    });
  }

  async updateWebhook(webhookId: string, updates: {
    url?: string;
    topics?: IntercomWebhookTopic[];
    active?: boolean;
  }): Promise<IntercomWebhook> {
    return this.makeRequest<IntercomWebhook>(`/webhooks/${webhookId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteWebhook(webhookId: string): Promise<{ id: string }> {
    return this.makeRequest<{ id: string }>(`/webhooks/${webhookId}`, {
      method: 'DELETE',
    });
  }

  async getSegments(): Promise<{ data: IntercomSegmentDetail[] }> {
    return this.makeRequest<{ data: IntercomSegmentDetail[] }>('/segments');
  }

  async getSegment(segmentId: string): Promise<IntercomSegmentDetail> {
    return this.makeRequest<IntercomSegmentDetail>(`/segments/${segmentId}`);
  }

  async getTags(): Promise<{ data: IntercomTagDetail[] }> {
    return this.makeRequest<{ data: IntercomTagDetail[] }>('/tags');
  }

  async getTag(tagId: string): Promise<IntercomTagDetail> {
    return this.makeRequest<IntercomTagDetail>(`/tags/${tagId}`);
  }

  async createTag(name: string): Promise<IntercomTagDetail> {
    return this.makeRequest<IntercomTagDetail>('/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateTag(tagId: string, name: string): Promise<IntercomTagDetail> {
    return this.makeRequest<IntercomTagDetail>(`/tags/${tagId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async deleteTag(tagId: string): Promise<{ id: string }> {
    return this.makeRequest<{ id: string }>(`/tags/${tagId}`, {
      method: 'DELETE',
    });
  }

  async getCompanies(options?: { page?: number; perPage?: number }): Promise<{ data: IntercomCompany[] }> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.perPage) params.append('per_page', options.perPage.toString());

    return this.makeRequest<{ data: IntercomCompany[] }>(`/companies?${params}`);
  }

  async getCompany(companyId: string): Promise<IntercomCompany> {
    return this.makeRequest<IntercomCompany>(`/companies/${companyId}`);
  }

  async createCompany(company: Partial<IntercomCompany>): Promise<IntercomCompany> {
    return this.makeRequest<IntercomCompany>('/companies', {
      method: 'POST',
      body: JSON.stringify(company),
    });
  }

  async updateCompany(companyId: string, updates: Partial<IntercomCompany>): Promise<IntercomCompany> {
    return this.makeRequest<IntercomCompany>(`/companies/${companyId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteCompany(companyId: string): Promise<{ id: string }> {
    return this.makeRequest<{ id: string }>(`/companies/${companyId}`, {
      method: 'DELETE',
    });
  }

  async getCompanyUsers(companyId: string): Promise<{ data: IntercomUser[] }> {
    return this.makeRequest<{ data: IntercomUser[] }>(`/companies/${companyId}/contacts`);
  }

  async getDataAttributes(type?: 'user' | 'company'): Promise<{ data: IntercomDataAttribute[] }> {
    const endpoint = type ? `/data_attributes?model=${type}` : '/data_attributes';
    return this.makeRequest<{ data: IntercomDataAttribute[] }>(endpoint);
  }

  async createDataAttribute(attr: {
    name: string;
    data_type: IntercomDataAttribute['data_type'];
    model: 'user' | 'company';
    options?: string[];
    description?: string;
  }): Promise<IntercomDataAttribute> {
    return this.makeRequest<IntercomDataAttribute>('/data_attributes', {
      method: 'POST',
      body: JSON.stringify(attr),
    });
  }

  async getCounts(): Promise<{
    conversation: { open: number; closed: number };
    user: { registered: number; anonymous: number };
    company: number;
  }> {
    return this.makeRequest<{
      conversation: { open: number; closed: number };
      user: { registered: number; anonymous: number };
      company: number;
    }>('/counts');
  }

  async trackEvent(eventName: string, userId?: string, email?: string, metadata?: Record<string, unknown>): Promise<{ event: string }> {
    return this.makeRequest<{ event: string }>('/events', {
      method: 'POST',
      body: JSON.stringify({
        event_name: eventName,
        user_id: userId,
        email,
        created_at: Math.floor(Date.now() / 1000),
        metadata,
      }),
    });
  }

  async getEvents(userId?: string, email?: string): Promise<{ events: IntercomEvent[] }> {
    const endpoint = userId ? `/events?user_id=${userId}` : `/events?email=${encodeURIComponent(email || '')}`;
    return this.makeRequest<{ events: IntercomEvent[] }>(endpoint);
  }

  async bulkUsers(users: Array<{
    user_id?: string;
    email?: string;
    custom_attributes?: Record<string, unknown>;
  }>): Promise<{ data: { id: string; type: string }[] }> {
    return this.makeRequest<{ data: { id: string; type: string }[] }>('/bulk/contacts', {
      method: 'POST',
      body: JSON.stringify({
        items: users.map(u => ({ type: 'user', ...u })),
      }),
    });
  }

  async bulkEvents(events: Array<{
    event_name: string;
    created_at: number;
    user_id?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }>): Promise<{ events: string[] }> {
    return this.makeRequest<{ events: string[] }>('/bulk/events', {
      method: 'POST',
      body: JSON.stringify({ items: events }),
    });
  }

  async uploadAttachment(url: string): Promise<{ id: string; url: string }> {
    return this.makeRequest<{ id: string; url: string }>('/attachments', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  cleanup(): void {
    this.config = { accessToken: '' };
  }

  getManifest(): IntercomPluginManifest {
    return {
      id: 'intercom',
      name: 'Intercom',
      version: '2.0.0',
      description: 'Intercom customer messaging integration for users, conversations, articles, teams, and webhooks',
      author: 'TIMPS Team',
      main: 'intercom-new.js',
      keywords: ['intercom', 'messaging', 'customer', 'support', 'chat', 'helpdesk'],
      actions: [
        { id: 'get_me', name: 'Get Current Admin', description: 'Get current admin profile' },
        { id: 'get_users', name: 'Get Users', description: 'List all users/contacts' },
        { id: 'get_user', name: 'Get User', description: 'Get specific user by ID' },
        { id: 'create_user', name: 'Create User', description: 'Create a new user' },
        { id: 'update_user', name: 'Update User', description: 'Update existing user' },
        { id: 'delete_user', name: 'Delete User', description: 'Delete a user' },
        { id: 'search_users', name: 'Search Users', description: 'Search users by query' },
        { id: 'get_user_by_email', name: 'Get User By Email', description: 'Get user by email address' },
        { id: 'get_user_tags', name: 'Get User Tags', description: 'Get tags for user' },
        { id: 'tag_user', name: 'Tag User', description: 'Add tag to user' },
        { id: 'untag_user', name: 'Untag User', description: 'Remove tag from user' },
        { id: 'get_user_segments', name: 'Get User Segments', description: 'Get segments for user' },
        { id: 'get_user_companies', name: 'Get User Companies', description: 'Get companies for user' },
        { id: 'get_user_notes', name: 'Get User Notes', description: 'Get notes for user' },
        { id: 'create_note', name: 'Create Note', description: 'Add note to user' },
        { id: 'get_conversations', name: 'Get Conversations', description: 'List all conversations' },
        { id: 'get_conversation', name: 'Get Conversation', description: 'Get specific conversation' },
        { id: 'create_conversation', name: 'Create Conversation', description: 'Create new conversation' },
        { id: 'reply_conversation', name: 'Reply Conversation', description: 'Reply to conversation' },
        { id: 'close_conversation', name: 'Close Conversation', description: 'Close conversation' },
        { id: 'snooze_conversation', name: 'Snooze Conversation', description: 'Snooze conversation until timestamp' },
        { id: 'reopen_conversation', name: 'Reopen Conversation', description: 'Reopen closed conversation' },
        { id: 'assign_conversation', name: 'Assign Conversation', description: 'Assign conversation to admin' },
        { id: 'search_conversations', name: 'Search Conversations', description: 'Search conversations' },
        { id: 'get_conversation_parts', name: 'Get Conversation Parts', description: 'Get parts of conversation' },
        { id: 'get_articles', name: 'Get Articles', description: 'List all help center articles' },
        { id: 'get_article', name: 'Get Article', description: 'Get specific article' },
        { id: 'create_article', name: 'Create Article', description: 'Create new article' },
        { id: 'update_article', name: 'Update Article', description: 'Update article' },
        { id: 'delete_article', name: 'Delete Article', description: 'Delete article' },
        { id: 'publish_article', name: 'Publish Article', description: 'Publish article' },
        { id: 'get_collections', name: 'Get Collections', description: 'List help center collections' },
        { id: 'get_sections', name: 'Get Sections', description: 'Get sections in collection' },
        { id: 'get_teams', name: 'Get Teams', description: 'List all teams' },
        { id: 'get_team', name: 'Get Team', description: 'Get specific team' },
        { id: 'create_team', name: 'Create Team', description: 'Create new team' },
        { id: 'update_team', name: 'Update Team', description: 'Update team' },
        { id: 'delete_team', name: 'Delete Team', description: 'Delete team' },
        { id: 'get_admins', name: 'Get Admins', description: 'List all admins' },
        { id: 'get_webhooks', name: 'Get Webhooks', description: 'List all webhooks' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create new webhook' },
        { id: 'update_webhook', name: 'Update Webhook', description: 'Update webhook' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete webhook' },
        { id: 'get_segments', name: 'Get Segments', description: 'List all segments' },
        { id: 'get_tags', name: 'Get Tags', description: 'List all tags' },
        { id: 'create_tag', name: 'Create Tag', description: 'Create new tag' },
        { id: 'delete_tag', name: 'Delete Tag', description: 'Delete tag' },
        { id: 'get_companies', name: 'Get Companies', description: 'List all companies' },
        { id: 'get_company', name: 'Get Company', description: 'Get specific company' },
        { id: 'create_company', name: 'Create Company', description: 'Create new company' },
        { id: 'update_company', name: 'Update Company', description: 'Update company' },
        { id: 'delete_company', name: 'Delete Company', description: 'Delete company' },
        { id: 'get_data_attributes', name: 'Get Data Attributes', description: 'List custom attributes' },
        { id: 'create_data_attribute', name: 'Create Data Attribute', description: 'Create custom attribute' },
        { id: 'get_counts', name: 'Get Counts', description: 'Get various counts' },
        { id: 'track_event', name: 'Track Event', description: 'Track user event' },
        { id: 'bulk_users', name: 'Bulk Users', description: 'Create/update users in bulk' },
        { id: 'bulk_events', name: 'Bulk Events', description: 'Track events in bulk' },
        { id: 'test_connection', name: 'Test Connection', description: 'Test Intercom connection' },
      ],
      triggers: [
        { id: 'conversation_created', name: 'Conversation Created', description: 'Triggered when new conversation is created' },
        { id: 'conversation_closed', name: 'Conversation Closed', description: 'Triggered when conversation is closed' },
        { id: 'conversation_replied', name: 'Conversation Replied', description: 'Triggered when user or admin replies' },
        { id: 'conversation_assigned', name: 'Conversation Assigned', description: 'Triggered when conversation is assigned' },
        { id: 'user_created', name: 'User Created', description: 'Triggered when new user is created' },
        { id: 'user_updated', name: 'User Updated', description: 'Triggered when user is updated' },
        { id: 'event_created', name: 'Event Created', description: 'Triggered when custom event is tracked' },
        { id: 'article_published', name: 'Article Published', description: 'Triggered when help center article is published' },
      ],
      auth: {
        type: 'bearer',
        fields: [
          { name: 'accessToken', label: 'Access Token', description: 'Your Intercom access token', required: true },
        ],
      },
      settings: [
        { name: 'timeout', label: 'Request Timeout', type: 'number', default: 30000 },
        { name: 'maxRetries', label: 'Max Retries', type: 'number', default: 3 },
      ],
      connectionTest: { endpoint: '/me', method: 'GET' },
    };
  }

  executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    switch (action) {
      case 'get_me': return this.getMe();
      case 'get_users': return this.getUsers(params as any);
      case 'get_user': return this.getUser(params.userId as string);
      case 'create_user': return this.createUser(params.user as any);
      case 'update_user': return this.updateUser(params.userId as string, params.updates as any);
      case 'delete_user': return this.deleteUser(params.userId as string);
      case 'search_users': return this.searchUsers(params.request as any);
      case 'get_user_by_email': return this.getUserByEmail(params.email as string);
      case 'get_user_tags': return this.getUserTags(params.userId as string);
      case 'tag_user': return this.tagUser(params.userId as string, params.tagId as string);
      case 'untag_user': return this.untagUser(params.userId as string, params.tagId as string);
      case 'get_user_segments': return this.getUserSegments(params.userId as string);
      case 'get_user_companies': return this.getUserCompanies(params.userId as string);
      case 'get_user_notes': return this.getUserNotes(params.userId as string);
      case 'create_note': return this.createNote(params.userId as string, params.body as string);
      case 'get_conversations': return this.getConversations(params as any);
      case 'get_conversation': return this.getConversation(params.conversationId as string);
      case 'create_conversation': return this.createConversation(params.conversation as any);
      case 'reply_conversation': return this.replyConversation(params.conversationId as string, params.reply as any);
      case 'close_conversation': return this.closeConversation(params.conversationId as string, params.adminId as string);
      case 'snooze_conversation': return this.snoozeConversation(params.conversationId as string, params.snoozeUntil as number);
      case 'reopen_conversation': return this.reopenConversation(params.conversationId as string);
      case 'assign_conversation': return this.assignConversation(params.conversationId as string, params.adminId as string);
      case 'search_conversations': return this.searchConversations(params.search as any);
      case 'get_conversation_parts': return this.getConversationParts(params.conversationId as string);
      case 'get_articles': return this.getArticles(params as any);
      case 'get_article': return this.getArticle(params.articleId as string);
      case 'create_article': return this.createArticle(params.article as any);
      case 'update_article': return this.updateArticle(params.articleId as string, params.updates as any);
      case 'delete_article': return this.deleteArticle(params.articleId as string);
      case 'publish_article': return this.publishArticle(params.articleId as string);
      case 'get_collections': return this.getCollections();
      case 'get_collection': return this.getCollection(params.collectionId as string);
      case 'create_collection': return this.createCollection(params.collection as any);
      case 'get_sections': return this.getSections(params.collectionId as string);
      case 'get_teams': return this.getTeams();
      case 'get_team': return this.getTeam(params.teamId as string);
      case 'create_team': return this.createTeam(params.team as any);
      case 'update_team': return this.updateTeam(params.teamId as string, params.updates as any);
      case 'delete_team': return this.deleteTeam(params.teamId as string);
      case 'get_admins': return this.getAdmins();
      case 'get_admin': return this.getAdmin(params.adminId as string);
      case 'get_webhooks': return this.getWebhooks();
      case 'get_webhook': return this.getWebhook(params.webhookId as string);
      case 'create_webhook': return this.createWebhook(params.webhook as any);
      case 'update_webhook': return this.updateWebhook(params.webhookId as string, params.updates as any);
      case 'delete_webhook': return this.deleteWebhook(params.webhookId as string);
      case 'get_segments': return this.getSegments();
      case 'get_segment': return this.getSegment(params.segmentId as string);
      case 'get_tags': return this.getTags();
      case 'get_tag': return this.getTag(params.tagId as string);
      case 'create_tag': return this.createTag(params.name as string);
      case 'update_tag': return this.updateTag(params.tagId as string, params.name as string);
      case 'delete_tag': return this.deleteTag(params.tagId as string);
      case 'get_companies': return this.getCompanies(params as any);
      case 'get_company': return this.getCompany(params.companyId as string);
      case 'create_company': return this.createCompany(params.company as any);
      case 'update_company': return this.updateCompany(params.companyId as string, params.updates as any);
      case 'delete_company': return this.deleteCompany(params.companyId as string);
      case 'get_company_users': return this.getCompanyUsers(params.companyId as string);
      case 'get_data_attributes': return this.getDataAttributes(params.type as any);
      case 'create_data_attribute': return this.createDataAttribute(params.attribute as any);
      case 'get_counts': return this.getCounts();
      case 'track_event': return this.trackEvent(params.eventName as string, params.userId as string, params.email as string, params.metadata as any);
      case 'get_events': return this.getEvents(params.userId as string, params.email as string);
      case 'bulk_users': return this.bulkUsers(params.users as any);
      case 'bulk_events': return this.bulkEvents(params.events as any);
      case 'upload_attachment': return this.uploadAttachment(params.url as string);
      case 'test_connection': return this.testConnection();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'me': return this.getMe();
      case 'users': return this.getUsers(options as any);
      case 'user': return this.getUser(options?.userId as string);
      case 'conversations': return this.getConversations(options as any);
      case 'conversation': return this.getConversation(options?.conversationId as string);
      case 'articles': return this.getArticles(options as any);
      case 'article': return this.getArticle(options?.articleId as string);
      case 'collections': return this.getCollections();
      case 'collection': return this.getCollection(options?.collectionId as string);
      case 'sections': return this.getSections(options?.collectionId as string);
      case 'teams': return this.getTeams();
      case 'team': return this.getTeam(options?.teamId as string);
      case 'admins': return this.getAdmins();
      case 'admin': return this.getAdmin(options?.adminId as string);
      case 'webhooks': return this.getWebhooks();
      case 'webhook': return this.getWebhook(options?.webhookId as string);
      case 'segments': return this.getSegments();
      case 'segment': return this.getSegment(options?.segmentId as string);
      case 'tags': return this.getTags();
      case 'tag': return this.getTag(options?.tagId as string);
      case 'companies': return this.getCompanies(options as any);
      case 'company': return this.getCompany(options?.companyId as string);
      case 'company_users': return this.getCompanyUsers(options?.companyId as string);
      case 'data_attributes': return this.getDataAttributes(options?.type as any);
      case 'counts': return this.getCounts();
      case 'events': return this.getEvents(options?.userId as string, options?.email as string);
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
}

export const intercomPlugin = new IntercomPlugin();