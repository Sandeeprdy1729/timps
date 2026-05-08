import { IntegrationBase } from './integration-base';

export interface SendGridEmail {
  personalizations: Array<{
    to: Array<{ email: string; name?: string }>;
    cc?: Array<{ email: string; name?: string }>;
    bcc?: Array<{ email: string; name?: string }>;
    subject?: string;
    headers?: Record<string, string>;
    custom_args?: Record<string, string>;
    dynamic_template_data?: Record<string, any>;
    send_at?: number;
  }>;
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  reply_to_list?: Array<{ email: string; name?: string }>;
  subject?: string;
  content?: Array<{ type: string; value: string }>;
  template_id?: string;
  headers?: Record<string, string>;
  custom_args?: Record<string, string>;
  send_at?: number;
  batch_id?: string;
  asm?: {
    group_id: number;
    groups_to_display?: number[];
  };
  mail_settings?: {
    sandbox_mode?: { enable: boolean };
    bypass_list_management?: { enable: boolean };
    bypass_spam_check?: { enable: boolean };
    bypass_bounce_check?: { enable: boolean };
    bypass_footer?: { enable: boolean };
  };
  tracking_settings?: {
    click_tracking?: { enable: boolean; enable_text: boolean };
    open_tracking?: { enable: boolean; substitution_tag?: string };
    subscription_tracking?: { enable: boolean; html_content?: string; text_content?: string };
    google_analytics?: { enable: boolean; utm_source?: string; utm_medium?: string; utm_term?: string; utm_content?: string; utm_campaign?: string };
  };
}

export interface SendGridContact {
  id?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  alternate_emails?: string[];
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  state_province_region?: string;
  postal_code?: string;
  country?: string;
  phone_number?: string;
  whatsapp_opt_in?: boolean;
  list_ids?: string[];
  column_ids?: string[];
  custom_fields?: Record<string, any>;
}

export interface SendGridList {
  id: string;
  name: string;
  contact_count: number;
}

export interface SendGridTemplate {
  id: string;
  name: string;
  generation: 'dynamic' | 'legacy';
  type: 'transactional' | 'marketing';
  active: number;
  updated_at: string;
}

export interface SendGridTemplateVersion {
  id: string;
  template_id: string;
  subject: string;
  name: string;
  html_content: string;
  plain_content: string;
  editor_type?: string;
  test_data?: string;
  active?: number;
 修?: string;
}

export interface SendGridSender {
  id: number;
  nickname: string;
  from_email: string;
  from_name?: string;
  reply_to?: string;
  reply_to_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  verified?: { status: boolean };
  locked?: boolean;
  created_on?: string;
}

export interface SendGridStats {
  date: string;
  stats: Array<{
    type: string;
    metrics: Record<string, number>;
  }>;
}

export interface SendGridGlobalStats {
  date: string;
  blocks: number;
  bounces: number;
  clicks: number;
  deferred: number;
  delivered: number;
  drops: number;
  opens: number;
  processed: number;
  requests: number;
  spam_reports: number;
  unique_clicks: number;
  unique_opens: number;
  unsubscribes: number;
}

export interface SendGridApiKey {
  api_key_id: string;
  name: string;
  api_key: string;
  api_key_id2?: string;
  scope?: string[];
  last_used_at?: string;
  created_at?: string;
}

export interface SendGridWebhookSettings {
  url: string;
  validate?: boolean;
  grouping?: 'by_subject';
  channel?: string;
  ephemeral?: boolean;
  open_proxy?: { url: string; auth_method?: string; auth_username?: string };
}

export interface SendGridEvent {
  email: string;
  timestamp: number;
  event: 'processed' | 'deferred' | 'delivered' | 'bounced' | 'open' | 'click' | 'spam_report' | 'unsubscribe' | 'group_unsubscribe' | 'group_resubscribe';
  msg?: any;
  sg_event_id?: string;
  sg_message_id?: string;
}

interface SendGridConfig {
  apiKey: string;
}

export class SendGridPlugin extends IntegrationBase {
  private config: SendGridConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('SendGrid', 'sendgrid', 'Email delivery and marketing integration');
    this.config = {} as SendGridConfig;
  }

  setApiKey(apiKey: string): void {
    this.config = { apiKey };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  private getBaseUrl(): string {
    return 'https://api.sendgrid.com/v3';
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async sendEmail(email: SendGridEmail): Promise<{ message: string }> {
    return this.apiCall<{ message: string }>('POST', '/mail/send', email);
  }

  async sendBulkEmails(emails: SendGridEmail[]): Promise<void> {
    for (const email of emails) {
      await this.sendEmail(email);
    }
  }

  async createContact(contact: SendGridContact): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/marketing/contacts', { contacts: [contact] });
  }

  async createContacts(contacts: SendGridContact[]): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/marketing/contacts', { contacts });
  }

  async getContact(email: string): Promise<SendGridContact> {
    return this.apiCall<SendGridContact>('GET', `/marketing/contacts/${encodeURIComponent(email)}`);
  }

  async updateContact(email: string, contact: Partial<SendGridContact>): Promise<void> {
    return this.apiCall<void>('PATCH', `/marketing/contacts/${encodeURIComponent(email)}`, contact);
  }

  async deleteContact(email: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/marketing/contacts/${encodeURIComponent(email)}`);
  }

  async listContacts(options?: { page_size?: number; page_token?: string }): Promise<{ result: SendGridContact[]; pagination?: { page_token: string } }> {
    const params = new URLSearchParams();
    if (options?.page_size) params.append('page_size', options.page_size.toString());
    if (options?.page_token) params.append('page_token', options.page_token);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ result: SendGridContact[]; pagination?: { page_token: string } }>('GET', `/marketing/contacts${query}`);
  }

  async createList(name: string): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/marketing/lists', { name });
  }

  async getList(listId: string): Promise<SendGridList> {
    return this.apiCall<SendGridList>('GET', `/marketing/lists/${listId}`);
  }

  async updateList(listId: string, name: string): Promise<SendGridList> {
    return this.apiCall<SendGridList>('PATCH', `/marketing/lists/${listId}`, { name });
  }

  async deleteList(listId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/marketing/lists/${listId}`);
  }

  async listLists(): Promise<{ result: SendGridList[] }> {
    return this.apiCall<{ result: SendGridList[] }>('GET', '/marketing/lists');
  }

  async addToList(listId: string, contactIds: string[]): Promise<void> {
    return this.apiCall<void>('POST', `/marketing/lists/${listId}/contacts`, { contact_ids: contactIds });
  }

  async removeFromList(listId: string, contactIds: string[]): Promise<void> {
    return this.apiCall<void>('DELETE', `/marketing/lists/${listId}/contacts`, { contact_ids: contactIds });
  }

  async listContactsInList(listId: string, options?: { page_size?: number }): Promise<{ result: SendGridContact[] }> {
    const params = options?.page_size ? `?page_size=${options.page_size}` : '';
    return this.apiCall<{ result: SendGridContact[] }>('GET', `/marketing/lists/${listId}/contacts${params}`);
  }

  async createTemplate(template: Partial<SendGridTemplate>): Promise<SendGridTemplate> {
    return this.apiCall<SendGridTemplate>('POST', '/templates', template);
  }

  async getTemplate(templateId: string): Promise<SendGridTemplate> {
    return this.apiCall<SendGridTemplate>('GET', `/templates/${templateId}`);
  }

  async updateTemplate(templateId: string, updates: Partial<SendGridTemplate>): Promise<SendGridTemplate> {
    return this.apiCall<SendGridTemplate>('PATCH', `/templates/${templateId}`, updates);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/templates/${templateId}`);
  }

  async listTemplates(type?: string): Promise<{ result: SendGridTemplate[] }> {
    const query = type ? `?generations=${type}` : '';
    return this.apiCall<{ result: SendGridTemplate[] }>('GET', `/templates${query}`);
  }

  async createTemplateVersion(templateId: string, version: Partial<SendGridTemplateVersion>): Promise<SendGridTemplateVersion> {
    return this.apiCall<SendGridTemplateVersion>('POST', `/templates/${templateId}/versions`, version);
  }

  async getTemplateVersion(templateId: string, versionId: string): Promise<SendGridTemplateVersion> {
    return this.apiCall<SendGridTemplateVersion>('GET', `/templates/${templateId}/versions/${versionId}`);
  }

  async updateTemplateVersion(templateId: string, versionId: string, updates: Partial<SendGridTemplateVersion>): Promise<SendGridTemplateVersion> {
    return this.apiCall<SendGridTemplateVersion>('PATCH', `/templates/${templateId}/versions/${versionId}`, updates);
  }

  async deleteTemplateVersion(templateId: string, versionId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/templates/${templateId}/versions/${versionId}`);
  }

  async activateTemplateVersion(templateId: string, versionId: string): Promise<void> {
    return this.apiCall<void>('PATCH', `/templates/${templateId}/versions/${versionId}`, { active: 1 });
  }

  async createSender(sender: Partial<SendGridSender>): Promise<SendGridSender> {
    return this.apiCall<SendGridSender>('POST', '/senders', sender as any);
  }

  async getSender(senderId: number): Promise<SendGridSender> {
    return this.apiCall<SendGridSender>('GET', `/senders/${senderId}`);
  }

  async updateSender(senderId: number, updates: Partial<SendGridSender>): Promise<SendGridSender> {
    return this.apiCall<SendGridSender>('PATCH', `/senders/${senderId}`, updates as any);
  }

  async deleteSender(senderId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/senders/${senderId}`);
  }

  async verifySender(senderId: number): Promise<void> {
    return this.apiCall<void>('POST', `/senders/${senderId}/resend_verification`);
  }

  async listSenders(): Promise<{ result: SendGridSender[] }> {
    return this.apiCall<{ result: SendGridSender[] }>('GET', '/senders');
  }

  async createApiKey(name: string, scopes?: string[]): Promise<SendGridApiKey> {
    return this.apiCall<SendGridApiKey>('POST', '/api_keys', { name, scopes });
  }

  async getApiKey(apiKeyId: string): Promise<Omit<SendGridApiKey, 'api_key'>> {
    return this.apiCall<Omit<SendGridApiKey, 'api_key'>>('GET', `/api_keys/${apiKeyId}`);
  }

  async updateApiKey(apiKeyId: string, updates: { name?: string; scopes?: string[] }): Promise<Omit<SendGridApiKey, 'api_key'>> {
    return this.apiCall<Omit<SendGridApiKey, 'api_key'>>('PATCH', `/api_keys/${apiKeyId}`, updates);
  }

  async deleteApiKey(apiKeyId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/api_keys/${apiKeyId}`);
  }

  async listApiKeys(): Promise<{ result: SendGridApiKey[] }> {
    return this.apiCall<{ result: SendGridApiKey[] }>('GET', '/api_keys');
  }

  async getGlobalStats(startDate: string, endDate: string): Promise<SendGridGlobalStats[]> {
    return this.apiCall<SendGridGlobalStats[]>('GET', `/stats/global?start_date=${startDate}&end_date=${endDate}`);
  }

  async getCategoryStats(startDate: string, endDate: string): Promise<SendGridStats[]> {
    return this.apiCall<SendGridStats[]>('GET', `/categories/stats?start_date=${startDate}&end_date=${endDate}`);
  }

  async getSubuserStats(startDate: string, endDate: string, subuser?: string): Promise<SendGridStats[]> {
    const query = subuser ? `?start_date=${startDate}&end_date=${endDate}&subuser=${subuser}` : `?start_date=${startDate}&end_date=${endDate}`;
    return this.apiCall<SendGridStats[]>('GET', `/subusers/stats${query}`);
  }

  async getDeviceStats(startDate: string, endDate: string): Promise<SendGridStats[]> {
    return this.apiCall<SendGridStats[]>('GET', `/devices/stats?start_date=${startDate}&end_date=${endDate}`);
  }

  async getCountryStats(startDate: string, endDate: string): Promise<SendGridStats[]> {
    return this.apiCall<SendGridStats[]>('GET', `/geo/stats?start_date=${startDate}&end_date=${endDate}`);
  }

  async getBrowserStats(startDate: string, endDate: string): Promise<SendGridStats[]> {
    return this.apiCall<SendGridStats[]>('GET', `/browsers/stats?start_date=${startDate}&end_date=${endDate}`);
  }

  async getClientStats(startDate: string, endDate: string): Promise<SendGridStats[]> {
    return this.apiCall<SendGridStats[]>('GET', `/clients/stats?start_date=${startDate}&end_date=${endDate}`);
  }

  getManifest() {
    return {
      name: 'SendGrid',
      id: 'sendgrid',
      description: 'Email delivery and marketing integration',
      version: '1.0.0',
      actions: [
        { id: 'send_email', name: 'Send Email', description: 'Send a single email' },
        { id: 'send_bulk_emails', name: 'Send Bulk Emails', description: 'Send multiple emails' },
        { id: 'create_contact', name: 'Create Contact', description: 'Create a new contact' },
        { id: 'create_contacts', name: 'Create Multiple Contacts', description: 'Create multiple contacts at once' },
        { id: 'get_contact', name: 'Get Contact', description: 'Get contact by email' },
        { id: 'update_contact', name: 'Update Contact', description: 'Update contact information' },
        { id: 'delete_contact', name: 'Delete Contact', description: 'Delete a contact' },
        { id: 'list_contacts', name: 'List Contacts', description: 'List all contacts' },
        { id: 'create_list', name: 'Create List', description: 'Create a new contact list' },
        { id: 'get_list', name: 'Get List', description: 'Get list details' },
        { id: 'update_list', name: 'Update List', description: 'Update a list' },
        { id: 'delete_list', name: 'Delete List', description: 'Delete a list' },
        { id: 'list_lists', name: 'List Lists', description: 'List all lists' },
        { id: 'add_to_list', name: 'Add to List', description: 'Add contacts to a list' },
        { id: 'remove_from_list', name: 'Remove from List', description: 'Remove contacts from a list' },
        { id: 'list_contacts_in_list', name: 'List Contacts in List', description: 'Get contacts in a list' },
        { id: 'create_template', name: 'Create Template', description: 'Create an email template' },
        { id: 'get_template', name: 'Get Template', description: 'Get template details' },
        { id: 'update_template', name: 'Update Template', description: 'Update a template' },
        { id: 'delete_template', name: 'Delete Template', description: 'Delete a template' },
        { id: 'list_templates', name: 'List Templates', description: 'List all templates' },
        { id: 'create_template_version', name: 'Create Template Version', description: 'Create a new template version' },
        { id: 'get_template_version', name: 'Get Template Version', description: 'Get version details' },
        { id: 'update_template_version', name: 'Update Template Version', description: 'Update a template version' },
        { id: 'delete_template_version', name: 'Delete Template Version', description: 'Delete a template version' },
        { id: 'activate_template_version', name: 'Activate Template Version', description: 'Activate a template version' },
        { id: 'create_sender', name: 'Create Sender', description: 'Create a sender identity' },
        { id: 'get_sender', name: 'Get Sender', description: 'Get sender details' },
        { id: 'update_sender', name: 'Update Sender', description: 'Update a sender' },
        { id: 'delete_sender', name: 'Delete Sender', description: 'Delete a sender' },
        { id: 'verify_sender', name: 'Verify Sender', description: 'Resend sender verification' },
        { id: 'list_senders', name: 'List Senders', description: 'List all senders' },
        { id: 'create_api_key', name: 'Create API Key', description: 'Create an API key' },
        { id: 'get_api_key', name: 'Get API Key', description: 'Get API key details' },
        { id: 'update_api_key', name: 'Update API Key', description: 'Update an API key' },
        { id: 'delete_api_key', name: 'Delete API Key', description: 'Delete an API key' },
        { id: 'list_api_keys', name: 'List API Keys', description: 'List all API keys' },
        { id: 'get_global_stats', name: 'Get Global Stats', description: 'Get global email statistics' },
        { id: 'get_category_stats', name: 'Get Category Stats', description: 'Get statistics by category' },
        { id: 'get_subuser_stats', name: 'Get Subuser Stats', description: 'Get subuser statistics' },
        { id: 'get_device_stats', name: 'Get Device Stats', description: 'Get device statistics' },
        { id: 'get_country_stats', name: 'Get Country Stats', description: 'Get country statistics' },
        { id: 'get_browser_stats', name: 'Get Browser Stats', description: 'Get browser statistics' },
        { id: 'get_client_stats', name: 'Get Client Stats', description: 'Get client statistics' },
      ],
      triggers: [
        { id: 'email_delivered', name: 'Email Delivered', description: 'Triggered when an email is delivered' },
        { id: 'email_bounced', name: 'Email Bounced', description: 'Triggered when an email bounces' },
        { id: 'email_opened', name: 'Email Opened', description: 'Triggered when a recipient opens an email' },
        { id: 'email_clicked', name: 'Email Clicked', description: 'Triggered when a recipient clicks a link' },
        { id: 'email_spam_reported', name: 'Email Spam Reported', description: 'Triggered when a recipient marks as spam' },
        { id: 'email_unsubscribed', name: 'Email Unsubscribed', description: 'Triggered when a recipient unsubscribes' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'apiKey', label: 'API Key', description: 'Your SendGrid API key', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/api_keys',
        method: 'GET',
      },
    };
  }
}

export const sendgridPlugin = new SendGridPlugin();