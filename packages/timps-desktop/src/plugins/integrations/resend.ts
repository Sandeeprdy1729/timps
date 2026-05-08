import { IntegrationBase } from './integration-base';

export interface ResendEmail {
  from?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  reply_to?: string[];
  text?: string;
  html?: string;
  react?: any;
  attachments?: Array<{
    filename: string;
    content: string;
    content_type?: string;
  }>;
  headers?: Record<string, string>;
  scheduled_at?: string;
  idempotency_key?: string;
  topic_id?: string;
  tags?: string[];
}

export interface ResendBatchEmail extends ResendEmail {
  email: ResendEmail;
}

export interface ResendTemplate {
  id: string;
  name: string;
  html?: string;
  text?: string;
  from?: string;
  subject?: string;
  reply_to?: string[];
  variables?: Array<{
    key: string;
    type: 'string' | 'number';
    fallback_value?: string;
  }>;
  created_at: string;
}

export interface ResendTemplateVariable {
  key: string;
  type: 'string' | 'number';
  fallback_value?: string;
}

export interface ResendContact {
  email: string;
  first_name?: string;
  last_name?: string;
  unsubscribed?: boolean;
  custom_fields?: Record<string, any>;
  segment_ids?: string[];
  topic_subscriptions?: Array<{
    topic_id: string;
    subscribed: boolean;
  }>;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: 'not_started' | 'pending' | 'verified' | 'failed';
  created_at: string;
  region?: string;
  capabilities?: {
    sending: 'enabled' | 'disabled';
    receiving: 'enabled' | 'disabled';
  };
}

export interface ResendAudience {
  id: string;
  name: string;
}

export interface ResendSegment {
  id: string;
  name: string;
  description?: string;
  contacts_count: number;
  created_at: string;
}

export interface ResendTopic {
  id: string;
  name: string;
  description?: string;
  default_subscription?: 'opt-in' | 'opt-out';
  contacts_count: number;
  created_at: string;
}

export interface ResendApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at?: string;
}

export interface ResendTeamMember {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  created_at: string;
}

export interface ResendAuditLog {
  id: string;
  action: string;
  actor_email: string;
  target_email?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface ResendConfig {
  apiKey: string;
}

export class ResendPlugin extends IntegrationBase {
  private config: ResendConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('Resend', 'resend', 'Transactional email API - emails, contacts, domains, batch sending');
    this.config = {} as ResendConfig;
  }

  setApiKey(apiKey: string): void {
    this.config = { apiKey };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  private getBaseUrl(): string {
    return 'https://api.resend.com';
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async sendEmail(email: ResendEmail): Promise<{ id: string; object: string }> {
    return this.apiCall<{ id: string; object: string }>('POST', '/emails', email);
  }

  async sendBatchEmails(emails: ResendEmail[]): Promise<{ data: Array<{ id: string }> }> {
    return this.apiCall<{ data: Array<{ id: string }> }>('POST', '/emails/batch', emails);
  }

  async getEmail(emailId: string): Promise<any> {
    return this.apiCall<any>('GET', `/emails/${emailId}`);
  }

  async cancelScheduledEmail(emailId: string): Promise<any> {
    return this.apiCall<any>('POST', `/emails/${emailId}/cancel`);
  }

  async listEmails(options?: { limit?: number; send_after?: number }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.send_after) params.append('send_after', options.send_after.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<any>('GET', `/emails${query}`);
  }

  async createTemplate(template: {
    name: string;
    html?: string;
    text?: string;
    from?: string;
    subject?: string;
    reply_to?: string[];
    variables?: ResendTemplateVariable[];
  }): Promise<ResendTemplate> {
    return this.apiCall<ResendTemplate>('POST', '/templates', template);
  }

  async getTemplate(templateId: string): Promise<ResendTemplate> {
    return this.apiCall<ResendTemplate>('GET', `/templates/${templateId}`);
  }

  async updateTemplate(templateId: string, updates: Partial<{
    name: string;
    html: string;
    text: string;
    subject: string;
    reply_to: string[];
  }>): Promise<ResendTemplate> {
    return this.apiCall<ResendTemplate>('PATCH', `/templates/${templateId}`, updates);
  }

  async deleteTemplate(templateId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.apiCall<{ id: string; object: string; deleted: boolean }>('DELETE', `/templates/${templateId}`);
  }

  async listTemplates(options?: { limit?: number }): Promise<{ data: ResendTemplate[]; has_more: boolean }> {
    const query = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ data: ResendTemplate[]; has_more: boolean }>(`GET`, `/templates${query}`);
  }

  async publishTemplate(templateId: string): Promise<ResendTemplate> {
    return this.apiCall<ResendTemplate>('POST', `/templates/${templateId}/publish`);
  }

  async duplicateTemplate(templateId: string, name: string): Promise<ResendTemplate> {
    return this.apiCall<ResendTemplate>('POST', `/templates/${templateId}/duplicate`, { name });
  }

  async createContact(contact: ResendContact): Promise<{ id: string; object: string }> {
    return this.apiCall<{ id: string; object: string }>('POST', '/contacts', contact);
  }

  async getContact(contactId: string): Promise<ResendContact & { id: string; created_at: string; object: string }> {
    return this.apiCall<ResendContact & { id: string; created_at: string; object: string }>('GET', `/contacts/${contactId}`);
  }

  async updateContact(contactId: string, updates: Partial<ResendContact>): Promise<ResendContact & { id: string; object: string }> {
    return this.apiCall<ResendContact & { id: string; object: string }>('PATCH', `/contacts/${contactId}`, updates);
  }

  async deleteContact(contactId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.apiCall<{ id: string; object: string; deleted: boolean }>('DELETE', `/contacts/${contactId}`);
  }

  async listContacts(options?: { limit?: number; segment_id?: string }): Promise<{ data: any[]; has_more: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.segment_id) params.append('segment_id', options.segment_id);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ data: any[]; has_more: boolean }>('GET', `/contacts${query}`);
  }

  async createContactsBatch(contacts: ResendContact[]): Promise<{ data: any[] }> {
    return this.apiCall<{ data: any[] }>('POST', '/contacts/batch', { contacts });
  }

  async createDomain(domain: { name: string; region?: string }): Promise<ResendDomain> {
    return this.apiCall<ResendDomain>('POST', '/domains', domain);
  }

  async getDomain(domainId: string): Promise<ResendDomain> {
    return this.apiCall<ResendDomain>('GET', `/domains/${domainId}`);
  }

  async deleteDomain(domainId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.apiCall<{ id: string; object: string; deleted: boolean }>('DELETE', `/domains/${domainId}`);
  }

  async verifyDomain(domainId: string): Promise<ResendDomain> {
    return this.apiCall<ResendDomain>('POST', `/domains/${domainId}/verify`);
  }

  async listDomains(): Promise<{ data: ResendDomain[]; has_more: boolean }> {
    return this.apiCall<{ data: ResendDomain[]; has_more: boolean }>('GET', '/domains');
  }

  async getDomainRecords(domainId: string): Promise<any> {
    return this.apiCall<any>('GET', `/domains/${domainId}/records`);
  }

  async createAudience(name: string): Promise<ResendAudience> {
    return this.apiCall<ResendAudience>('POST', '/audiences', { name });
  }

  async getAudience(audienceId: string): Promise<ResendAudience> {
    return this.apiCall<ResendAudience>('GET', `/audiences/${audienceId}`);
  }

  async updateAudience(audienceId: string, name: string): Promise<ResendAudience> {
    return this.apiCall<ResendAudience>('PATCH', `/audiences/${audienceId}`, { name });
  }

  async deleteAudience(audienceId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.apiCall<{ id: string; object: string; deleted: boolean }>('DELETE', `/audiences/${audienceId}`);
  }

  async listAudiences(): Promise<{ data: ResendAudience[]; has_more: boolean }> {
    return this.apiCall<{ data: ResendAudience[]; has_more: boolean }>('GET', '/audiences');
  }

  async addContactToAudience(audienceId: string, contactId: string): Promise<any> {
    return this.apiCall<any>('POST', `/audiences/${audienceId}/contacts`, { contact_ids: [contactId] });
  }

  async createSegment(segment: { name: string; description?: string; query?: any }): Promise<ResendSegment> {
    return this.apiCall<ResendSegment>('POST', '/segments', segment);
  }

  async getSegment(segmentId: string): Promise<ResendSegment> {
    return this.apiCall<ResendSegment>('GET', `/segments/${segmentId}`);
  }

  async updateSegment(segmentId: string, updates: { name?: string; description?: string }): Promise<ResendSegment> {
    return this.apiCall<ResendSegment>('PATCH', `/segments/${segmentId}`, updates);
  }

  async deleteSegment(segmentId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.apiCall<{ id: string; object: string; deleted: boolean }>('DELETE', `/segments/${segmentId}`);
  }

  async listSegments(): Promise<{ data: ResendSegment[]; has_more: boolean }> {
    return this.apiCall<{ data: ResendSegment[]; has_more: boolean }>('GET', '/segments');
  }

  async createTopic(topic: {
    name: string;
    description?: string;
    default_subscription?: 'opt-in' | 'opt-out';
  }): Promise<ResendTopic> {
    return this.apiCall<ResendTopic>('POST', '/topics', topic);
  }

  async getTopic(topicId: string): Promise<ResendTopic> {
    return this.apiCall<ResendTopic>('GET', `/topics/${topicId}`);
  }

  async updateTopic(topicId: string, updates: { name?: string; description?: string }): Promise<ResendTopic> {
    return this.apiCall<ResendTopic>('PATCH', `/topics/${topicId}`, updates);
  }

  async deleteTopic(topicId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.apiCall<{ id: string; object: string; deleted: boolean }>('DELETE', `/topics/${topicId}`);
  }

  async listTopics(): Promise<{ data: ResendTopic[]; has_more: boolean }> {
    return this.apiCall<{ data: ResendTopic[]; has_more: boolean }>('GET', '/topics');
  }

  async subscribeContactToTopic(contactId: string, topicId: string): Promise<any> {
    return this.apiCall<any>('POST', `/contacts/${contactId}/topics/subscribe`, { topic_id: topicId });
  }

  async unsubscribeContactFromTopic(contactId: string, topicId: string): Promise<any> {
    return this.apiCall<any>('POST', `/contacts/${contactId}/topics/unsubscribe`, { topic_id: topicId });
  }

  async createApiKey(name: string, permissions?: { emails: string; domains: string; contacts: string }): Promise<{ id: string; key: string; name: string; created_at: string }> {
    return this.apiCall<{ id: string; key: string; name: string; created_at: string }>('POST', '/api-keys', { name, permissions });
  }

  async listApiKeys(): Promise<{ data: ResendApiKey[]; has_more: boolean }> {
    return this.apiCall<{ data: ResendApiKey[]; has_more: boolean }>('GET', '/api-keys');
  }

  async getApiKey(keyId: string): Promise<ResendApiKey> {
    return this.apiCall<ResendApiKey>('GET', `/api-keys/${keyId}`);
  }

  async deleteApiKey(keyId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.apiCall<{ id: string; object: string; deleted: boolean }>('DELETE', `/api-keys/${keyId}`);
  }

  async listTeamMembers(): Promise<{ data: ResendTeamMember[]; has_more: boolean }> {
    return this.apiCall<{ data: ResendTeamMember[]; has_more: boolean }>('GET', '/team');
  }

  async inviteTeamMember(email: string, role: 'owner' | 'member'): Promise<{ id: string; email: string; role: string; object: string }> {
    return this.apiCall<{ id: string; email: string; role: string; object: string }>('POST', '/team/invite', { email, role });
  }

  async removeTeamMember(memberId: string): Promise<{ id: string; object: string; deleted: boolean }> {
    return this.apiCall<{ id: string; object: string; deleted: boolean }>('DELETE', `/team/${memberId}`);
  }

  async listAuditLogs(options?: { limit?: number }): Promise<{ data: ResendAuditLog[]; has_more: boolean }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ data: ResendAuditLog[]; has_more: boolean }>('GET', `/audit-logs${params}`);
  }

  getManifest() {
    return {
      name: 'Resend',
      id: 'resend',
      description: 'Transactional email API - emails, contacts, domains, batch sending',
      version: '1.0.0',
      actions: [
        { id: 'send_email', name: 'Send Email', description: 'Send a single email' },
        { id: 'send_batch_emails', name: 'Send Batch Emails', description: 'Send up to 100 emails in one call' },
        { id: 'get_email', name: 'Get Email', description: 'Get email details by ID' },
        { id: 'cancel_scheduled_email', name: 'Cancel Scheduled Email', description: 'Cancel a scheduled email' },
        { id: 'list_emails', name: 'List Emails', description: 'List sent emails' },
        { id: 'create_template', name: 'Create Template', description: 'Create an email template' },
        { id: 'get_template', name: 'Get Template', description: 'Get template details' },
        { id: 'update_template', name: 'Update Template', description: 'Update a template' },
        { id: 'delete_template', name: 'Delete Template', description: 'Delete a template' },
        { id: 'list_templates', name: 'List Templates', description: 'List all templates' },
        { id: 'publish_template', name: 'Publish Template', description: 'Publish a template' },
        { id: 'duplicate_template', name: 'Duplicate Template', description: 'Duplicate a template' },
        { id: 'create_contact', name: 'Create Contact', description: 'Create a new contact' },
        { id: 'get_contact', name: 'Get Contact', description: 'Get contact details' },
        { id: 'update_contact', name: 'Update Contact', description: 'Update a contact' },
        { id: 'delete_contact', name: 'Delete Contact', description: 'Delete a contact' },
        { id: 'list_contacts', name: 'List Contacts', description: 'List all contacts' },
        { id: 'create_contacts_batch', name: 'Create Contacts Batch', description: 'Create multiple contacts' },
        { id: 'create_domain', name: 'Create Domain', description: 'Add a sending domain' },
        { id: 'get_domain', name: 'Get Domain', description: 'Get domain details' },
        { id: 'delete_domain', name: 'Delete Domain', description: 'Delete a domain' },
        { id: 'verify_domain', name: 'Verify Domain', description: 'Verify domain ownership' },
        { id: 'list_domains', name: 'List Domains', description: 'List all domains' },
        { id: 'get_domain_records', name: 'Get Domain Records', description: 'Get DNS records for domain' },
        { id: 'create_audience', name: 'Create Audience', description: 'Create an audience' },
        { id: 'get_audience', name: 'Get Audience', description: 'Get audience details' },
        { id: 'update_audience', name: 'Update Audience', description: 'Update an audience' },
        { id: 'delete_audience', name: 'Delete Audience', description: 'Delete an audience' },
        { id: 'list_audiences', name: 'List Audiences', description: 'List all audiences' },
        { id: 'add_contact_to_audience', name: 'Add Contact to Audience', description: 'Add contact to audience' },
        { id: 'create_segment', name: 'Create Segment', description: 'Create a segment' },
        { id: 'get_segment', name: 'Get Segment', description: 'Get segment details' },
        { id: 'update_segment', name: 'Update Segment', description: 'Update a segment' },
        { id: 'delete_segment', name: 'Delete Segment', description: 'Delete a segment' },
        { id: 'list_segments', name: 'List Segments', description: 'List all segments' },
        { id: 'create_topic', name: 'Create Topic', description: 'Create a topic' },
        { id: 'get_topic', name: 'Get Topic', description: 'Get topic details' },
        { id: 'update_topic', name: 'Update Topic', description: 'Update a topic' },
        { id: 'delete_topic', name: 'Delete Topic', description: 'Delete a topic' },
        { id: 'list_topics', name: 'List Topics', description: 'List all topics' },
        { id: 'subscribe_contact_to_topic', name: 'Subscribe Contact to Topic', description: 'Subscribe contact to topic' },
        { id: 'unsubscribe_contact_from_topic', name: 'Unsubscribe Contact from Topic', description: 'Unsubscribe contact from topic' },
        { id: 'create_api_key', name: 'Create API Key', description: 'Create an API key' },
        { id: 'list_api_keys', name: 'List API Keys', description: 'List all API keys' },
        { id: 'get_api_key', name: 'Get API Key', description: 'Get API key details' },
        { id: 'delete_api_key', name: 'Delete API Key', description: 'Delete an API key' },
        { id: 'list_team_members', name: 'List Team Members', description: 'List team members' },
        { id: 'invite_team_member', name: 'Invite Team Member', description: 'Invite a team member' },
        { id: 'remove_team_member', name: 'Remove Team Member', description: 'Remove a team member' },
        { id: 'list_audit_logs', name: 'List Audit Logs', description: 'List audit logs' },
      ],
      triggers: [],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'apiKey', label: 'API Key', description: 'Your Resend API key (re_...)', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/me',
        method: 'GET',
      },
    };
  }
}

export const resendPlugin = new ResendPlugin();