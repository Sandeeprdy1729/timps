import { IntegrationBase } from './integration-base';

export interface HubSpotContact {
  id: string;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotCompany {
  id: string;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotDeal {
  id: string;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotTicket {
  id: string;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotEngagement {
  id: string;
  engagement: {
    type: string;
    timestamp: number;
    ownerId: string;
  };
  metadata: any;
}

export interface HubSpotEmail {
  id: string;
  properties: Record<string, string>;
}

export interface HubSpotMeeting {
  id: string;
  properties: Record<string, string>;
  startTime: number;
  endTime: number;
}

export interface HubSpotCall {
  id: string;
  properties: Record<string, string>;
}

export interface HubSpotNote {
  id: string;
  properties: Record<string, string>;
}

export interface HubSpotTask {
  id: string;
  properties: Record<string, string>;
}

export interface HubSpotLineItem {
  id: string;
  properties: Record<string, string>;
}

export interface HubSpotProduct {
  id: string;
  properties: Record<string, string>;
}

export interface HubSpotQuote {
  id: string;
  properties: Record<string, string>;
}

export interface HubSpotForm {
  id: string;
  name: string;
  formFieldGroups: any[];
}

export interface HubSpotWorkflow {
  id: string;
  name: string;
  enabled: boolean;
  enrollment: {
    enrollmentStatus: string;
  };
}

export interface HubSpotList {
  objectId: string;
  name: string;
  size: number;
}

export interface HubSpotOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  active: boolean;
}

export interface HubSpotPipeline {
  id: string;
  label: string;
  displayOrder: number;
  stages: Array<{ id: string; label: string; displayOrder: number }>;
}

export interface HubSpotContent {
  id: string;
  properties: Record<string, string>;
  childIds?: string[];
}

export interface HubSpotBlogPost extends HubSpotContent {
  postBody: string;
  postSummary: string;
}

export interface HubSpotLandingPage extends HubSpotContent {
  metaDescription: string;
}

export interface HubSpotWebhook {
  id: string;
  url: string;
  webhookType: string;
  events: string[];
  active: boolean;
}

export interface HubSpotCustomObject {
  id: string;
  properties: Record<string, string>;
}

export interface HubSpotFile {
  id: string;
  name: string;
  size: number;
  url: string;
  type: string;
}

export interface HubSpotFolder {
  id: string;
  name: string;
  path: string;
  parentId?: string;
}

interface HubSpotConfig {
  apiKey: string;
  accessToken?: string;
}

export class HubSpotPlugin extends IntegrationBase {
  private config: HubSpotConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('HubSpot', 'hubspot', 'CRM and marketing automation integration');
    this.config = {} as HubSpotConfig;
  }

  setApiKey(apiKey: string): void {
    this.config = { apiKey };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  setAccessToken(accessToken: string): void {
    this.config = { accessToken };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  private getBaseUrl(): string {
    return 'https://api.hubapi.com';
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async getContacts(options?: { limit?: number; property?: string }): Promise<{ results: HubSpotContact[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.property) params.append('properties', options.property);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ results: HubSpotContact[] }>('GET', `/crm/v3/objects/contacts${query}`);
  }

  async getContact(contactId: string): Promise<{ results: HubSpotContact[] }> {
    return this.apiCall<{ results: HubSpotContact[] }>('GET', `/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,company`);
  }

  async createContact(properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/crm/v3/objects/contacts', { properties });
  }

  async updateContact(contactId: string, properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('PATCH', `/crm/v3/objects/contacts/${contactId}`, { properties });
  }

  async deleteContact(contactId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/crm/v3/objects/contacts/${contactId}`);
  }

  async searchContacts(query: string): Promise<{ results: HubSpotContact[] }> {
    return this.apiCall<{ results: HubSpotContact[] }>('POST', '/crm/v3/objects/contacts/search', {
      filterGroups: [{
        filters: [{
          propertyName: 'firstname',
          operator: 'CONTAINS_TOKEN',
          value: query,
        }],
      }],
    });
  }

  async getCompanies(options?: { limit?: number }): Promise<{ results: HubSpotCompany[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ results: HubSpotCompany[] }>('GET', `/crm/v3/objects/companies${params}`);
  }

  async getCompany(companyId: string): Promise<{ results: HubSpotCompany[] }> {
    return this.apiCall<{ results: HubSpotCompany[] }>('GET', `/crm/v3/objects/companies/${companyId}?properties=name,domain,description`);
  }

  async createCompany(properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/crm/v3/objects/companies', { properties });
  }

  async updateCompany(companyId: string, properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('PATCH', `/crm/v3/objects/companies/${companyId}`, { properties });
  }

  async deleteCompany(companyId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/crm/v3/objects/companies/${companyId}`);
  }

  async getDeals(options?: { limit?: number }): Promise<{ results: HubSpotDeal[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ results: HubSpotDeal[] }>('GET', `/crm/v3/objects/deals${params}`);
  }

  async getDeal(dealId: string): Promise<{ results: HubSpotDeal[] }> {
    return this.apiCall<{ results: HubSpotDeal[] }>('GET', `/crm/v3/objects/deals/${dealId}?properties=dealname,amount,dealstage,closedate,pipeline`);
  }

  async createDeal(properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/crm/v3/objects/deals', { properties });
  }

  async updateDeal(dealId: string, properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('PATCH', `/crm/v3/objects/deals/${dealId}`, { properties });
  }

  async deleteDeal(dealId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/crm/v3/objects/deals/${dealId}`);
  }

  async getTickets(options?: { limit?: number }): Promise<{ results: HubSpotTicket[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ results: HubSpotTicket[] }>('GET', `/crm/v3/objects/tickets${params}`);
  }

  async createTicket(properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/crm/v3/objects/tickets', { properties });
  }

  async getLineItems(options?: { limit?: number }): Promise<{ results: HubSpotLineItem[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ results: HubSpotLineItem[] }>('GET', `/crm/v3/objects/line_items${params}`);
  }

  async createLineItem(properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/crm/v3/objects/line_items', { properties });
  }

  async getProducts(options?: { limit?: number }): Promise<{ results: HubSpotProduct[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ results: HubSpotProduct[] }>('GET', `/crm/v3/objects/products${params}`);
  }

  async createProduct(properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/crm/v3/objects/products', { properties });
  }

  async createQuote(properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/crm/v3/objects/quotes', { properties });
  }

  async getEngagements(options?: { limit?: number }): Promise<{ results: HubSpotEngagement[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ results: HubSpotEngagement[] }>('GET', `/engagements/v1/engagement${params}`);
  }

  async createEngagement(engagement: { type: string; metadata: any; associations?: any }): Promise<{ engagementId: string }> {
    return this.apiCall<{ engagementId: string }>('POST', '/engagements/v1/engagement', engagement);
  }

  async createEmail(email: { from: string; to: string; subject: string; body: string }): Promise<{ id: string }> {
    return this.createEngagement({
      type: 'EMAIL',
      metadata: { from: email.from, to: email.to, subject: email.subject, body: email.body },
    });
  }

  async createMeeting(meeting: { title: string; startTime: number; endTime: number; body?: string }): Promise<{ id: string }> {
    return this.createEngagement({
      type: 'MEETING',
      metadata: meeting,
    });
  }

  async createCall(call: { callTitle: string; body?: string; outcome: string }): Promise<{ id: string }> {
    return this.createEngagement({
      type: 'CALL',
      metadata: call,
    });
  }

  async createNote(note: { body: string }): Promise<{ id: string }> {
    return this.createEngagement({
      type: 'NOTE',
      metadata: note,
    });
  }

  async createTask(task: { subject: string; body?: string; dueDate?: number }): Promise<{ id: string }> {
    return this.createEngagement({
      type: 'TASK',
      metadata: task,
    });
  }

  async getOwners(): Promise<{ results: HubSpotOwner[] }> {
    return this.apiCall<{ results: HubSpotOwner[] }>('GET', '/crm/v3/owners');
  }

  async getOwner(ownerId: string): Promise<{ results: HubSpotOwner[] }> {
    return this.apiCall<{ results: HubSpotOwner[] }>('GET', `/crm/v3/owners/${ownerId}`);
  }

  async getPipelines(objectType: string): Promise<{ results: HubSpotPipeline[] }> {
    return this.apiCall<{ results: HubSpotPipeline[] }>('GET', `/crm/v3/pipelines/${objectType}`);
  }

  async getLists(options?: { limit?: number }): Promise<{ lists: HubSpotList[] }> {
    return this.apiCall<{ lists: HubSpotList[] }>('GET', '/contacts/v1/lists', { count: options?.limit || 100 });
  }

  async getList(listId: string): Promise<HubSpotList> {
    return this.apiCall<HubSpotList>('GET', `/contacts/v1/lists/${listId}`);
  }

  async createList(name: string, objectType: string): Promise<{ listId: string }> {
    return this.apiCall<{ listId: string }>('POST', '/contacts/v1/lists', { name, objectType });
  }

  async addContactToList(listId: string, contactId: string): Promise<void> {
    return this.apiCall<void>('PUT', `/contacts/v1/lists/${listId}/add`, { vid: [parseInt(contactId)] });
  }

  async getForms(options?: { limit?: number }): Promise<{ results: HubSpotForm[] }> {
    return this.apiCall<{ results: HubSpotForm[] }>('GET', '/marketing/v3/forms', { limit: options?.limit || 100 });
  }

  async getForm(formId: string): Promise<HubSpotForm> {
    return this.apiCall<HubSpotForm>('GET', `/marketing/v3/forms/${formId}`);
  }

  async submitForm(formId: string, fields: Record<string, string>): Promise<{ inlineResponse: number }> {
    return this.apiCall<{ inlineResponse: number }>('POST', `/marketing/v3/forms/submissions/${formId}`, { fields });
  }

  async getWorkflows(): Promise<{ results: HubSpotWorkflow[] }> {
    return this.apiCall<{ results: HubSpotWorkflow[] }>('automation/v3/workflows');
  }

  async getWorkflow(workflowId: string): Promise<HubSpotWorkflow> {
    return this.apiCall<HubSpotWorkflow>('GET', `/automation/v3/workflows/${workflowId}`);
  }

  async enrollContactInWorkflow(workflowId: string, contactId: string): Promise<void> {
    return this.apiCall<void>('POST', `/automation/v3/workflows/${workflowId}/enrollments/contacts/${contactId}`);
  }

  async getBlogPosts(options?: { limit?: number }): Promise<{ results: HubSpotBlogPost[] }> {
    return this.apiCall<{ results: HubSpotBlogPost[] }>('cms/v3/blogs/posts', { limit: options?.limit || 100 });
  }

  async getBlogPost(blogPostId: string): Promise<HubSpotBlogPost> {
    return this.apiCall<HubSpotBlogPost>('GET', `/cms/v3/blogs/posts/${blogPostId}`);
  }

  async createBlogPost(properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/cms/v3/blogs/posts', { properties });
  }

  async updateBlogPost(blogPostId: string, properties: Record<string, string>): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('PATCH', `/cms/v3/blogs/posts/${blogPostId}`, { properties });
  }

  async deleteBlogPost(blogPostId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/cms/v3/blogs/posts/${blogPostId}`);
  }

  async getLandingPages(options?: { limit?: number }): Promise<{ results: HubSpotLandingPage[] }> {
    return this.apiCall<{ results: HubSpotLandingPage[] }>('cms/v3/pages/landing', { limit: options?.limit || 100 });
  }

  async getLandingPage(landingPageId: string): Promise<HubSpotLandingPage> {
    return this.apiCall<HubSpotLandingPage>('GET', `/cms/v3/pages/landing/${landingPageId}`);
  }

  async getWebhooks(): Promise<{ webhookId: string }[]> {
    return this.apiCall<any>('GET', '/webhooks/v1/webhooks');
  }

  async createWebhook(webhook: { url: string; webhookType: string; events: string[] }): Promise<{ webhookId: string }> {
    return this.apiCall<{ webhookId: string }>('POST', '/webhooks/v1/webhooks', {
      subscriptionDetails: {
        ...webhook,
      },
    });
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/webhooks/v1/webhooks/${webhookId}`);
  }

  async getFiles(): Promise<{ results: HubSpotFile[] }> {
    return this.apiCall<{ results: HubSpotFile[] }>('files/v3/files');
  }

  async uploadFile(file: Blob, fileName: string, folderId?: string): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', fileName);
    if (folderId) formData.append('folderId', folderId);
    const url = `${this.getBaseUrl()}/files/v3/files`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': this.baseHeaders['Authorization'] },
      body: formData,
    });
    return response.json();
  }

  async deleteFile(fileId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/files/v3/files/${fileId}`);
  }

  async getFolders(options?: { limit?: number }): Promise<{ results: HubSpotFolder[] }> {
    return this.apiCall<{ results: HubSpotFolder[] }>('files/v3/folders', { limit: options?.limit || 100 });
  }

  async createFolder(name: string, parentId?: string): Promise<{ id: string }> {
    return this.apiCall<{ id: string }>('POST', '/files/v3/folders', { name, parentFolderId: parentId });
  }

  async deleteFolder(folderId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/files/v3/folders/${folderId}`);
  }

  async createAssociate(fromObjectType: string, fromObjectId: string, toObjectType: string, toObjectId: string): Promise<void> {
    return this.apiCall<void>('PUT', `/crm/v3/objects/${fromObjectType}/${fromObjectId}/${toObjectType}/${toObjectId}`);
  }

  getManifest() {
    return {
      name: 'HubSpot',
      id: 'hubspot',
      description: 'CRM and marketing automation integration',
      version: '1.0.0',
      actions: [
        { id: 'get_contacts', name: 'Get Contacts', description: 'List all contacts' },
        { id: 'get_contact', name: 'Get Contact', description: 'Get contact details' },
        { id: 'create_contact', name: 'Create Contact', description: 'Create a new contact' },
        { id: 'update_contact', name: 'Update Contact', description: 'Update contact properties' },
        { id: 'delete_contact', name: 'Delete Contact', description: 'Delete a contact' },
        { id: 'search_contacts', name: 'Search Contacts', description: 'Search contacts' },
        { id: 'get_companies', name: 'Get Companies', description: 'List all companies' },
        { id: 'get_company', name: 'Get Company', description: 'Get company details' },
        { id: 'create_company', name: 'Create Company', description: 'Create a new company' },
        { id: 'update_company', name: 'Update Company', description: 'Update company' },
        { id: 'delete_company', name: 'Delete Company', description: 'Delete a company' },
        { id: 'get_deals', name: 'Get Deals', description: 'List all deals' },
        { id: 'get_deal', name: 'Get Deal', description: 'Get deal details' },
        { id: 'create_deal', name: 'Create Deal', description: 'Create a new deal' },
        { id: 'update_deal', name: 'Update Deal', description: 'Update deal' },
        { id: 'delete_deal', name: 'Delete Deal', description: 'Delete a deal' },
        { id: 'get_tickets', name: 'Get Tickets', description: 'List all tickets' },
        { id: 'create_ticket', name: 'Create Ticket', description: 'Create a new ticket' },
        { id: 'get_line_items', name: 'Get Line Items', description: 'List all line items' },
        { id: 'create_line_item', name: 'Create Line Item', description: 'Create a new line item' },
        { id: 'get_products', name: 'Get Products', description: 'List all products' },
        { id: 'create_product', name: 'Create Product', description: 'Create a new product' },
        { id: 'create_quote', name: 'Create Quote', description: 'Create a new quote' },
        { id: 'get_engagements', name: 'Get Engagements', description: 'List all engagements' },
        { id: 'create_engagement', name: 'Create Engagement', description: 'Create a new engagement' },
        { id: 'create_email', name: 'Create Email', description: 'Send an email' },
        { id: 'create_meeting', name: 'Create Meeting', description: 'Schedule a meeting' },
        { id: 'create_call', name: 'Create Call', description: 'Log a call' },
        { id: 'create_note', name: 'Create Note', description: 'Create a note' },
        { id: 'create_task', name: 'Create Task', description: 'Create a task' },
        { id: 'get_owners', name: 'Get Owners', description: 'List all owners' },
        { id: 'get_owner', name: 'Get Owner', description: 'Get owner details' },
        { id: 'get_pipelines', name: 'Get Pipelines', description: 'List all pipelines' },
        { id: 'get_lists', name: 'Get Lists', description: 'List all lists' },
        { id: 'get_list', name: 'Get List', description: 'Get list details' },
        { id: 'create_list', name: 'Create List', description: 'Create a new list' },
        { id: 'add_to_list', name: 'Add to List', description: 'Add contact to list' },
        { id: 'get_forms', name: 'Get Forms', description: 'List all forms' },
        { id: 'get_form', name: 'Get Form', description: 'Get form details' },
        { id: 'submit_form', name: 'Submit Form', description: 'Submit form data' },
        { id: 'get_workflows', name: 'Get Workflows', description: 'List all workflows' },
        { id: 'get_workflow', name: 'Get Workflow', description: 'Get workflow details' },
        { id: 'enroll_in_workflow', name: 'Enroll in Workflow', description: 'Enroll contact in workflow' },
        { id: 'get_blog_posts', name: 'Get Blog Posts', description: 'List all blog posts' },
        { id: 'get_blog_post', name: 'Get Blog Post', description: 'Get blog post details' },
        { id: 'create_blog_post', name: 'Create Blog Post', description: 'Create a new blog post' },
        { id: 'update_blog_post', name: 'Update Blog Post', description: 'Update blog post' },
        { id: 'delete_blog_post', name: 'Delete Blog Post', description: 'Delete a blog post' },
        { id: 'get_landing_pages', name: 'Get Landing Pages', description: 'List all landing pages' },
        { id: 'get_landing_page', name: 'Get Landing Page', description: 'Get landing page details' },
        { id: 'get_webhooks', name: 'Get Webhooks', description: 'List all webhooks' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a webhook' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete a webhook' },
        { id: 'get_files', name: 'Get Files', description: 'List all files' },
        { id: 'upload_file', name: 'Upload File', description: 'Upload a file' },
        { id: 'delete_file', name: 'Delete File', description: 'Delete a file' },
        { id: 'get_folders', name: 'Get Folders', description: 'List all folders' },
        { id: 'create_folder', name: 'Create Folder', description: 'Create a folder' },
        { id: 'delete_folder', name: 'Delete Folder', description: 'Delete a folder' },
        { id: 'create_associate', name: 'Create Associate', description: 'Associate two records' },
      ],
      triggers: [
        { id: 'contact_created', name: 'Contact Created', description: 'Triggered when contact is created' },
        { id: 'contact_updated', name: 'Contact Updated', description: 'Triggered when contact is updated' },
        { id: 'company_created', name: 'Company Created', description: 'Triggered when company is created' },
        { id: 'deal_created', name: 'Deal Created', description: 'Triggered when deal is created' },
        { id: 'deal_won', name: 'Deal Won', description: 'Triggered when deal is won' },
        { id: 'ticket_created', name: 'Ticket Created', description: 'Triggered when ticket is created' },
        { id: 'form_submitted', name: 'Form Submitted', description: 'Triggered when form is submitted' },
        { id: 'meeting_booked', name: 'Meeting Booked', description: 'Triggered when meeting is booked' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'apiKey', label: 'API Key', description: 'Your HubSpot API key', required: true },
          { name: 'accessToken', label: 'Access Token', description: 'Your OAuth access token (optional)', required: false },
        ],
      },
      connectionTest: {
        endpoint: '/crm/v3/objects/contacts',
        method: 'GET',
      },
    };
  }
}

export const hubspotPlugin = new HubSpotPlugin();