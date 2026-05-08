import { IntegrationBase } from './integration-base';

export interface DocuSignEnvelope {
  envelopeId: string;
  status: 'created' | 'delivered' | 'signed' | 'completed' | 'declined' | 'voided';
  emailSubject?: string;
  message?: string;
  documents?: Array<{ documentId: string; name: string }>;
  recipients?: {
    signers?: Array<{ email: string; name: string; recipientId: string; routingOrder?: string }>;
    carbonCopies?: Array<{ email: string; name: string; recipientId: string; routingOrder?: string }>;
  };
  createdDateTime?: string;
  completedDateTime?: string;
}

export interface DocuSignRecipient {
  recipientId: string;
  email: string;
  name: string;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'completed';
  routingOrder?: string;
  signedDateTime?: string;
  deliveredDateTime?: string;
}

export interface DocuSignDocument {
  documentId: string;
  name: string;
  type: string;
  order?: string;
  documentBase64?: string;
}

export interface DocuSignTemplate {
  templateId: string;
  name: string;
  description?: string;
  shared: boolean;
  recipients: {
    signers: Array<{ roleName: string; roleNameOk: string; routingOrder?: string }>;
  };
}

export interface DocuSignUser {
  userId: string;
  email: string;
  userName: string;
  userType: string;
  isAdmin: boolean;
  isActive: boolean;
}

export interface DocuSignAccount {
  accountId: string;
  accountName: string;
  accountLogo?: string;
  isDefault: boolean;
  envSettings?: any;
  brandingSettings?: any;
}

export interface DocuSignWebhook {
  url: string;
  name: string;
  events: string[];
  configurationType: string;
  active: boolean;
}

export interface DocuSignGroup {
  groupId: string;
  groupName: string;
  groupType: string;
  members?: number;
}

export interface DocuSignBrand {
  brandId: string;
  brandName: string;
  logo: string;
  colors?: string[];
}

export interface DocuSignBulkEnvelope {
  batchId: string;
  status: string;
  batchName?: string;
  batchSize?: number;
  envelopes?: string[];
}

export interface DocuSignConnectLog {
  logId: string;
  accountId: string;
  status: string;
  attempt: number;
  created: string;
  processed: string;
}

interface DocuSignConfig {
  integrationKey: string;
  userId: string;
  accountId: string;
  basePath: string;
  accessToken: string;
}

export class DocuSignPlugin extends IntegrationBase {
  private config: DocuSignConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('DocuSign', 'docusign', 'Electronic signature integration');
    this.config = {} as DocuSignConfig;
  }

  setConfig(integrationKey: string, userId: string, accountId: string, basePath: string, accessToken: string): void {
    this.config = { integrationKey, userId, accountId, basePath, accessToken };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  private getBaseUrl(): string {
    return this.config.basePath || 'https://demo.docusign.net/restapi/v2.1';
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async getAccount(): Promise<{ accounts: DocuSignAccount[] }> {
    return this.apiCall<{ accounts: DocuSignAccount[] }>('GET', `/restapi/v2.1/accounts`);
  }

  async listEnvelopes(options?: { fromDate?: string; toDate?: string; status?: string }): Promise<{ envelopes: DocuSignEnvelope[] }> {
    const params = new URLSearchParams();
    if (options?.fromDate) params.append('from_date', options.fromDate);
    if (options?.toDate) params.append('to_date', options.toDate);
    if (options?.status) params.append('status', options.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ envelopes: DocuSignEnvelope[] }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes${query}`);
  }

  async getEnvelope(envelopeId: string): Promise<{ envelope: DocuSignEnvelope }> {
    return this.apiCall<{ envelope: DocuSignEnvelope }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}`);
  }

  async createEnvelope(envelope: { emailSubject?: string; documents?: DocuSignDocument[]; recipients?: any; status?: string }): Promise<{ envelopeId: string }> {
    return this.apiCall<{ envelopeId: string }>('POST', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes`, envelope);
  }

  async sendEnvelope(envelope: { emailSubject?: string; documents?: DocuSignDocument[]; recipients?: any }): Promise<{ envelopeId: string }> {
    return this.createEnvelope({ ...envelope, status: 'sent' });
  }

  async createDraft(envelope: { emailSubject?: string; documents?: DocuSignDocument[]; recipients?: any }): Promise<{ envelopeId: string }> {
    return this.createEnvelope({ ...envelope, status: 'created' });
  }

  async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
    return this.apiCall<void>('PUT', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}`, { status: 'voided', voidedReason: reason });
  }

  async deleteEnvelope(envelopeId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}`);
  }

  async resendEnvelope(envelopeId: string): Promise<void> {
    return this.apiCall<void>('PUT', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}/resend`, {});
  }

  async getEnvelopeRecipients(envelopeId: string): Promise<{ signers: DocuSignRecipient[] }> {
    return this.apiCall<{ signers: DocuSignRecipient[] }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}/recipients`);
  }

  async addRecipient(envelopeId: string, recipient: DocuSignRecipient): Promise<{ recipientId: string }> {
    return this.apiCall<{ recipientId: string }>('PUT', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}/recipients`, { signers: [recipient] });
  }

  async voidRecipient(envelopeId: string, recipientId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}/recipients/${recipientId}`);
  }

  async getEnvelopeDocuments(envelopeId: string): Promise<{ envelopeId: string; name: string }[]> {
    return this.apiCall<any>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}/documents`);
  }

  async getDocument(envelopeId: string, documentId: string): Promise<Blob> {
    const url = `${this.getBaseUrl()}/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}/documents/${documentId}`;
    const response = await fetch(url, { method: 'GET', headers: this.baseHeaders });
    return response.blob();
  }

  async downloadDocuments(envelopeId: string): Promise<Blob> {
    return this.getDocument(envelopeId, 'combined');
  }

  async listTemplates(): Promise<{ envelopeTemplates: DocuSignTemplate[] }> {
    return this.apiCall<{ envelopeTemplates: DocuSignTemplate[] }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/templates`);
  }

  async getTemplate(templateId: string): Promise<{ template: DocuSignTemplate }> {
    return this.apiCall<{ template: DocuSignTemplate }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/templates/${templateId}`);
  }

  async createTemplate(template: { name: string; description?: string; documents?: DocuSignDocument[]; recipients?: any }): Promise<{ templateId: string }> {
    return this.apiCall<{ templateId: string }>('POST', `/restapi/v2.1/accounts/${this.config.accountId}/templates`, template);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/restapi/v2.1/accounts/${this.config.accountId}/templates/${templateId}`);
  }

  async createEnvelopeFromTemplate(templateId: string, recipients: any): Promise<{ envelopeId: string }> {
    return this.apiCall<{ envelopeId: string }>('POST', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes`, {
      templateId,
      templateRoles: recipients,
      status: 'sent',
    });
  }

  async listUsers(): Promise<<{ users: DocuSignUser[] }> {
    return this.apiCall<{ users: DocuSignUser[] }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/users`);
  }

  async getUser(userId: string): Promise<{ user: DocuSignUser }> {
    return this.apiCall<{ user: DocuSignUser }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/users/${userId}`);
  }

  async listGroups(): Promise<{ groups: DocuSignGroup[] }> {
    return this.apiCall<{ groups: DocuSignGroup[] }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/groups`);
  }

  async getGroup(groupId: string): Promise<{ group: DocuSignGroup }> {
    return this.apiCall<{ group: DocuSignGroup }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/groups/${groupId}`);
  }

  async listBrands(): Promise<{ brands: DocuSignBrand[] }> {
    return this.apiCall<{ brands: DocuSignBrand[] }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/brands`);
  }

  async getBrand(brandId: string): Promise<{ brand: DocuSignBrand }> {
    return this.apiCall<{ brand: DocuSignBrand }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/brands/${brandId}`);
  }

  async listWebhooks(): Promise<{ webhooks: DocuSignWebhook[] }> {
    return this.apiCall<{ webhooks: DocuSignWebhook[] }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/connect/webhooks`);
  }

  async createWebhook(webhook: { url: string; name: string; events: string[]; configurationType?: string; active?: boolean }): Promise<any> {
    return this.apiCall<any>('POST', `/restapi/v2.1/accounts/${this.config.accountId}/connect/webhooks`, webhook);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/restapi/v2.1/accounts/${this.config.accountId}/connect/webhooks/${webhookId}`);
  }

  async listConnectLogs(): Promise<{ logs: DocuSignConnectLog[] }> {
    return this.apiCall<{ logs: DocuSignConnectLog[] }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/connect/logs`);
  }

  async getConnectLog(logId: string): Promise<{ log: DocuSignConnectLog }> {
    return this.apiCall<{ log: DocuSignConnectLog }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/connect/logs/${logId}`);
  }

  async createBulkEnvelope(batchName: string, recipients: any[]): Promise<{ batchId: string }> {
    return this.apiCall<{ batchId: string }>('POST', `/restapi/v2.1/accounts/${this.config.accountId}/bulk_envelopes`, {
      batchName,
      recipients,
    });
  }

  async getBulkEnvelope(batchId: string): Promise<{ batch: DocuSignBulkEnvelope }> {
    return this.apiCall<{ batch: DocuSignBulkEnvelope }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/bulk_envelopes/${batchId}`);
  }

  async listBulkEnvelopes(): Promise<{ batches: DocuSignBulkEnvelope[] }> {
    return this.apiCall<{ batches: DocuSignBulkEnvelope[] }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/bulk_envelopes`);
  }

  async getSigningUrl(envelopeId: string, recipientEmail: string, recipientName: string): Promise<{ url: string }> {
    return this.apiCall<{ url: string }>('POST', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}/views/recipient`, {
      returnUrl: 'complete',
      authenticationMethod: 'email',
      email: recipientEmail,
      userName: recipientName,
    });
  }

  async getRecipientView(envelopeId: string, recipientEmail: string, recipientName: string): Promise<{ url: string }> {
    return this.getSigningUrl(envelopeId, recipientEmail, recipientName);
  }

  async getEnvelopeAuditEvents(envelopeId: string): Promise<{ auditEvents: any[] }> {
    return this.apiCall<{ auditEvents: any[] }>('GET', `/restapi/v2.1/accounts/${this.config.accountId}/envelopes/${envelopeId}/audit_events`);
  }

  getManifest() {
    return {
      name: 'DocuSign',
      id: 'docusign',
      description: 'Electronic signature integration',
      version: '1.0.0',
      actions: [
        { id: 'get_account', name: 'Get Account', description: 'Get account details' },
        { id: 'list_envelopes', name: 'List Envelopes', description: 'List all envelopes' },
        { id: 'get_envelope', name: 'Get Envelope', description: 'Get envelope details' },
        { id: 'create_envelope', name: 'Create Envelope', description: 'Create a new envelope' },
        { id: 'send_envelope', name: 'Send Envelope', description: 'Send an envelope' },
        { id: 'create_draft', name: 'Create Draft', description: 'Create a draft envelope' },
        { id: 'void_envelope', name: 'Void Envelope', description: 'Void an envelope' },
        { id: 'delete_envelope', name: 'Delete Envelope', description: 'Delete an envelope' },
        { id: 'resend_envelope', name: 'Resend Envelope', description: 'Resend an envelope' },
        { id: 'get_recipients', name: 'Get Recipients', description: 'Get envelope recipients' },
        { id: 'add_recipient', name: 'Add Recipient', description: 'Add recipient to envelope' },
        { id: 'void_recipient', name: 'Void Recipient', description: 'Remove recipient from envelope' },
        { id: 'list_documents', name: 'List Documents', description: 'List envelope documents' },
        { id: 'get_document', name: 'Get Document', description: 'Get a document' },
        { id: 'download_documents', name: 'Download Documents', description: 'Download all documents' },
        { id: 'list_templates', name: 'List Templates', description: 'List all templates' },
        { id: 'get_template', name: 'Get Template', description: 'Get template details' },
        { id: 'create_template', name: 'Create Template', description: 'Create a new template' },
        { id: 'delete_template', name: 'Delete Template', description: 'Delete a template' },
        { id: 'send_from_template', name: 'Send from Template', description: 'Send envelope from template' },
        { id: 'list_users', name: 'List Users', description: 'List all users' },
        { id: 'get_user', name: 'Get User', description: 'Get user details' },
        { id: 'list_groups', name: 'List Groups', description: 'List all groups' },
        { id: 'get_group', name: 'Get Group', description: 'Get group details' },
        { id: 'list_brands', name: 'List Brands', description: 'List all brands' },
        { id: 'get_brand', name: 'Get Brand', description: 'Get brand details' },
        { id: 'list_webhooks', name: 'List Webhooks', description: 'List all webhooks' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a new webhook' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete a webhook' },
        { id: 'list_connect_logs', name: 'List Connect Logs', description: 'List connect logs' },
        { id: 'get_connect_log', name: 'Get Connect Log', description: 'Get connect log details' },
        { id: 'create_bulk_envelope', name: 'Create Bulk Envelope', description: 'Create bulk envelope' },
        { id: 'get_bulk_envelope', name: 'Get Bulk Envelope', description: 'Get bulk envelope details' },
        { id: 'list_bulk_envelopes', name: 'List Bulk Envelopes', description: 'List bulk envelopes' },
        { id: 'get_signing_url', name: 'Get Signing Url', description: 'Get signing URL' },
        { id: 'get_audit_events', name: 'Get Audit Events', description: 'Get audit events for envelope' },
      ],
      triggers: [
        { id: 'envelope_created', name: 'Envelope Created', description: 'Triggered when envelope is created' },
        { id: 'envelope_sent', name: 'Envelope Sent', description: 'Triggered when envelope is sent' },
        { id: 'envelope_delivered', name: 'Envelope Delivered', description: 'Triggered when envelope is delivered' },
        { id: 'envelope_completed', name: 'Envelope Completed', description: 'Triggered when envelope is completed' },
        { id: 'envelope_declined', name: 'Envelope Declined', description: 'Triggered when envelope is declined' },
        { id: 'envelope_voided', name: 'Envelope Voided', description: 'Triggered when envelope is voided' },
        { id: 'recipient_signed', name: 'Recipient Signed', description: 'Triggered when recipient signs' },
        { id: 'recipient_completed', name: 'Recipient Completed', description: 'Triggered when recipient completes' },
      ],
      auth: {
        type: 'oauth2',
        fields: [
          { name: 'integrationKey', label: 'Integration Key', description: 'Your DocuSign Integration Key', required: true },
          { name: 'userId', label: 'User ID', description: 'Your DocuSign User ID', required: true },
          { name: 'accountId', label: 'Account ID', description: 'Your DocuSign Account ID', required: true },
          { name: 'basePath', label: 'Base Path', description: 'DocuSign base path', required: true },
          { name: 'accessToken', label: 'Access Token', description: 'Your OAuth access token', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/restapi/v2.1/accounts',
        method: 'GET',
      },
    };
  }
}

export const docusignPlugin = new DocuSignPlugin();