import { IntegrationBase } from './integration-base';

export interface WebflowCollection {
  id: string;
  singularName: string;
  pluralName: string;
  slug: string;
  createdOn: string;
  draftItem?: { id: string };
  liveItem?: { id: string };
}

export interface WebflowItem {
  id: string;
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  _draft?: any;
  _live?: any;
  [key: string]: any;
}

export interface WebflowFormSubmission {
  id: string;
  form: {
    id: string;
    name: string;
  };
  submissionData: Record<string, any>;
  createdAt: string;
}

export interface WebflowSite {
  id: string;
  displayName: string;
  slug: string;
  shortName: string;
  database: string;
  permissions: string[];
  createdOn: string;
  lastPublished: string;
  publishStatus: { id: string; name: string };
}

export interface WebflowAsset {
  id: string;
  fileKey: string;
  url: string;
  userId: string;
  createdOn: string;
}

export interface WebflowWebhook {
  _id?: string;
  id: string;
  name: string;
  url: string;
  triggerType: 'form_submission' | 'site_publish' | 'page_created' | 'page_deleted' | 'slide_changed';
  method: 'POST' | 'GET';
  headers?: Record<string, string>;
}

export interface WebflowUser {
  _id: string;
  email: string;
  genericInvite: boolean;
  lastLogin: string;
  name: string;
  roleIds: string[];
  slug: string;
}

export interface WebflowRole {
  _id: string;
  description: string;
  name: string;
  permissions: string[];
}

export interface WebflowEcommerce {
  order: {
    id: string;
    orderId: string;
    createdOn: string;
    completedOn?: string;
    status: string;
    currency: string;
    fulfillmentStatus?: string;
    customer: { id: string; email: string };
    orderItems: Array<{ productId: string; sku: string; name: string; price: number; quantity: number }>;
    shippingAddress?: any;
    billingAddress?: any;
    metadata?: Record<string, any>;
  };
}

interface WebflowConfig {
  siteId: string;
  apiKey: string;
}

export class WebflowPlugin extends IntegrationBase {
  private config: WebflowConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('Webflow', 'webflow', 'Website builder and CMS integration');
    this.config = {} as WebflowConfig;
  }

  setConfig(siteId: string, apiKey: string): void {
    this.config = { siteId, apiKey };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    };
  }

  private getBaseUrl(): string {
    return `https://api.webflow.com/v3/sites/${this.config.siteId}`;
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async listCollections(): Promise<{ collections: WebflowCollection[] }> {
    return this.apiCall<{ collections: WebflowCollection[] }>('GET', '/collections');
  }

  async getCollection(collectionId: string): Promise<WebflowCollection> {
    return this.apiCall<WebflowCollection>('GET', `/collections/${collectionId}`);
  }

  async listItems(collectionId: string, options?: { limit?: number; offset?: number }): Promise<{ items: WebflowItem[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ items: WebflowItem[] }>('GET', `/collections/${collectionId}/items${query}`);
  }

  async getItem(collectionId: string, itemId: string): Promise<WebflowItem> {
    return this.apiCall<WebflowItem>('GET', `/collections/${collectionId}/items/${itemId}`);
  }

  async createItem(collectionId: string, item: Partial<WebflowItem>): Promise<WebflowItem> {
    return this.apiCall<WebflowItem>('POST', `/collections/${collectionId}/items`, { fieldData: item });
  }

  async updateItem(collectionId: string, itemId: string, updates: Partial<WebflowItem>): Promise<WebflowItem> {
    return this.apiCall<WebflowItem>('PATCH', `/collections/${collectionId}/items/${itemId}`, { fieldData: updates });
  }

  async deleteItem(collectionId: string, itemId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/collections/${collectionId}/items/${itemId}`);
  }

  async publishItem(collectionId: string, itemId: string): Promise<void> {
    return this.apiCall<void>('POST', `/collections/${collectionId}/items/${itemId}/publish`);
  }

  async unpublishItem(collectionId: string, itemId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/collections/${collectionId}/items/${itemId}/live`);
  }

  async listFormSubmissions(options?: { limit?: number; offset?: number }): Promise<{ formSubmissions: WebflowFormSubmission[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ formSubmissions: WebflowFormSubmission[] }>('GET', `/forms/submissions${query}`);
  }

  async getFormSubmission(submissionId: string): Promise<WebflowFormSubmission> {
    return this.apiCall<WebflowFormSubmission>('GET', `/forms/submissions/${submissionId}`);
  }

  async listAssets(options?: { limit?: number }): Promise<{ assets: WebflowAsset[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ assets: WebflowAsset[] }>('GET', `/assets${params}`);
  }

  async uploadAsset(file: Buffer, fileName: string, contentType: string): Promise<WebflowAsset> {
    const formData = new FormData();
    formData.append('file', new Blob([file]), fileName);
    const url = `${this.getBaseUrl()}/assets`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': this.baseHeaders['Authorization'] },
      body: formData,
    });
    return response.json();
  }

  async deleteAsset(assetId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/assets/${assetId}`);
  }

  async listWebhooks(): Promise<{ webhooks: WebflowWebhook[] }> {
    return this.apiCall<{ webhooks: WebflowWebhook[] }>('GET', '/webhooks');
  }

  async createWebhook(webhook: Partial<WebflowWebhook>): Promise<WebflowWebhook> {
    return this.apiCall<WebflowWebhook>('POST', '/webhooks', webhook);
  }

  async getWebhook(webhookId: string): Promise<WebflowWebhook> {
    return this.apiCall<WebflowWebhook>('GET', `/webhooks/${webhookId}`);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/webhooks/${webhookId}`);
  }

  async testWebhook(webhookId: string): Promise<{ status: string }> {
    return this.apiCall<{ status: string }>('POST', `/webhooks/${webhookId}/test`);
  }

  async publishSite(): Promise<{ publishStatus: { id: string } }> {
    return this.apiCall<{ publishStatus: { id: string } }>('POST', '/publish');
  }

  async cloneSite(name: string): Promise<{ newSiteId: string }> {
    return this.apiCall<{ newSiteId: string }>('POST', '/clone', { name });
  }

  async getSite(): Promise<WebflowSite> {
    return this.apiCall<WebflowSite>('GET', '');
  }

  async updateSite(updates: Partial<WebflowSite>): Promise<WebflowSite> {
    return this.apiCall<WebflowSite>('PATCH', '', updates);
  }

  async listCustomCodeSections(): Promise<{ sections: any[] }> {
    return this.apiCall<{ sections: any[] }>('GET', '/custom_code');
  }

  async getCustomCodeSection(sectionId: string): Promise<any> {
    return this.apiCall<any>('GET', `/custom_code/${sectionId}`);
  }

  async createCustomCodeSection(section: any): Promise<any> {
    return this.apiCall<any>('POST', '/custom_code', section);
  }

  async updateCustomCodeSection(sectionId: string, updates: any): Promise<any> {
    return this.apiCall<any>('PATCH', `/custom_code/${sectionId}`, updates);
  }

  async deleteCustomCodeSection(sectionId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/custom_code/${sectionId}`);
  }

  getManifest() {
    return {
      name: 'Webflow',
      id: 'webflow',
      description: 'Website builder and CMS integration',
      version: '1.0.0',
      actions: [
        { id: 'list_collections', name: 'List Collections', description: 'List all collections in the site' },
        { id: 'get_collection', name: 'Get Collection', description: 'Get collection details' },
        { id: 'list_items', name: 'List Items', description: 'List all items in a collection' },
        { id: 'get_item', name: 'Get Item', description: 'Get item details' },
        { id: 'create_item', name: 'Create Item', description: 'Create a new item in a collection' },
        { id: 'update_item', name: 'Update Item', description: 'Update an existing item' },
        { id: 'delete_item', name: 'Delete Item', description: 'Delete an item' },
        { id: 'publish_item', name: 'Publish Item', description: 'Publish an item to live' },
        { id: 'unpublish_item', name: 'Unpublish Item', description: 'Remove item from live' },
        { id: 'list_form_submissions', name: 'List Form Submissions', description: 'List all form submissions' },
        { id: 'get_form_submission', name: 'Get Form Submission', description: 'Get form submission details' },
        { id: 'list_assets', name: 'List Assets', description: 'List all uploaded assets' },
        { id: 'upload_asset', name: 'Upload Asset', description: 'Upload a new asset file' },
        { id: 'delete_asset', name: 'Delete Asset', description: 'Delete an asset' },
        { id: 'list_webhooks', name: 'List Webhooks', description: 'List all webhooks' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a new webhook' },
        { id: 'get_webhook', name: 'Get Webhook', description: 'Get webhook details' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete a webhook' },
        { id: 'test_webhook', name: 'Test Webhook', description: 'Send a test webhook request' },
        { id: 'publish_site', name: 'Publish Site', description: 'Publish the entire site' },
        { id: 'clone_site', name: 'Clone Site', description: 'Clone the site to a new site' },
        { id: 'get_site', name: 'Get Site', description: 'Get site details' },
        { id: 'update_site', name: 'Update Site', description: 'Update site settings' },
        { id: 'list_custom_code', name: 'List Custom Code', description: 'List custom code sections' },
        { id: 'get_custom_code', name: 'Get Custom Code', description: 'Get custom code section' },
        { id: 'create_custom_code', name: 'Create Custom Code', description: 'Create custom code section' },
        { id: 'update_custom_code', name: 'Update Custom Code', description: 'Update custom code' },
        { id: 'delete_custom_code', name: 'Delete Custom Code', description: 'Delete custom code section' },
      ],
      triggers: [
        { id: 'form_submitted', name: 'Form Submitted', description: 'Triggered when a form is submitted' },
        { id: 'site_published', name: 'Site Published', description: 'Triggered when the site is published' },
        { id: 'item_created', name: 'Item Created', description: 'Triggered when a new item is created' },
        { id: 'item_updated', name: 'Item Updated', description: 'Triggered when an item is updated' },
        { id: 'item_deleted', name: 'Item Deleted', description: 'Triggered when an item is deleted' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'siteId', label: 'Site ID', description: 'Your Webflow Site ID', required: true },
          { name: 'apiKey', label: 'API Key', description: 'Your Webflow API key', required: true },
        ],
      },
      connectionTest: {
        endpoint: '',
        method: 'GET',
      },
    };
  }
}

export const webflowPlugin = new WebflowPlugin();