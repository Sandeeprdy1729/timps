import { IntegrationBase } from './integration-base';

export interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: 'open' | 'won' | 'lost' | 'deleted';
  probability?: number;
  expected_close_date?: string;
  stage_id?: number;
  pipeline_id?: number;
  org_id?: number;
  person_id?: number;
  user_id?: number;
  lost_reason?: string;
  notes?: string;
  stage_change_time?: string;
  last_activity_date?: string;
  add_time: string;
  update_time: string;
}

export interface PipedrivePerson {
  id: number;
  name: string;
  email?: string[];
  phone?: string[];
  org_id?: number;
  owner_id?: number;
  add_time: string;
  update_time: string;
}

export interface PipedriveOrganization {
  id: number;
  name: string;
  address?: string;
  owner_id?: number;
  add_time: string;
  update_time: string;
}

export interface PipedriveActivity {
  id: number;
  subject: string;
  type: string;
  due_date?: string;
  due_time?: string;
  duration?: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  user_id?: number;
  done: boolean;
  notes?: string;
  add_time: string;
  update_time: string;
}

export interface PipedriveNote {
  id: number;
  content: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  user_id?: number;
  add_time: string;
}

export interface PipedriveProduct {
  id: number;
  name: string;
  code?: string;
  description?: string;
  unit?: string;
  price?: number;
  cost?: number;
  currency: string;
  enabled: boolean;
}

export interface PipedrivePipeline {
  id: number;
  name: string;
  pipeline_id: number;
  stages: Array<{ id: number; name: string }>;
  deals: PipedriveDeal[];
}

export interface PipedriveStage {
  id: number;
  name: string;
  pipeline_id: number;
  deal_probability: number;
  Rotten: boolean;
}

export interface PipedriveUser {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

export interface PipedriveWebhook {
  id: number;
  webhook_url: string;
  owner_id: number;
  event_action: string;
  event_object: string;
  active: boolean;
}

export interface PipedriveFilter {
  id: number;
  name: string;
  conditions: any;
}

export interface PipedriveField {
  id: string;
  name: string;
  field_type: string;
  edit_flag: boolean;
  include_in_all_flag: boolean;
  options?: string[];
}

export interface PipedrivePayment {
  id: number;
  deal_id: number;
  amount: number;
  currency: string;
  payment_date: string;
  payment_type: string;
}

export interface PipedriveOrganizationRelationship {
  id: number;
  organization_id: number;
  related_organization_id: number;
  type: string;
}

export interface PipedriveGoal {
  id: number;
  title: string;
  pipeline_id: number;
  stage_id: number;
  expected_revenue: number;
  target_date: string;
  user_id: number;
}

export interface PipedriveInsight {
  deal_id?: number;
  count: number;
  values: Array<{ count: number; duration_average: number }>;
}

interface PipedriveConfig {
  apiToken: string;
}

export class PipedrivePlugin extends IntegrationBase {
  private config: PipedriveConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('Pipedrive', 'pipedrive', 'CRM integration');
    this.config = {} as PipedriveConfig;
  }

  setApiToken(apiToken: string): void {
    this.config = { apiToken };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
    };
  }

  private getBaseUrl(): string {
    return 'https://api.pipedrive.com/v1';
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async getDeals(options?: { limit?: number; status?: string }): Promise<{ data: PipedriveDeal[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ data: PipedriveDeal[] }>('GET', `/deals${query}`);
  }

  async getDeal(dealId: number): Promise<{ data: PipedriveDeal }> {
    return this.apiCall<{ data: PipedriveDeal }>('GET', `/deals/${dealId}`);
  }

  async createDeal(deal: Partial<PipedriveDeal>): Promise<{ data: PipedriveDeal }> {
    return this.apiCall<{ data: PipedriveDeal }>('POST', '/deals', deal);
  }

  async updateDeal(dealId: number, updates: Partial<PipedriveDeal>): Promise<{ data: PipedriveDeal }> {
    return this.apiCall<{ data: PipedriveDeal }>('PUT', `/deals/${dealId}`, updates);
  }

  async deleteDeal(dealId: number): Promise<{ data: { id: number } }> {
    return this.apiCall<{ data: { id: number } }>('DELETE', `/deals/${dealId}`);
  }

  async getDealsForActivity(activityId: number): Promise<{ data: PipedriveDeal[] }> {
    return this.apiCall<{ data: PipedriveDeal[] }>('GET', `/activities/${activityId}/deals`);
  }

  async getPersons(options?: { limit?: number }): Promise<{ data: PipedrivePerson[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ data: PipedrivePerson[] }>('GET', `/persons${params}`);
  }

  async getPerson(personId: number): Promise<{ data: PipedrivePerson }> {
    return this.apiCall<{ data: PipedrivePerson }>('GET', `/persons/${personId}`);
  }

  async createPerson(person: Partial<PipedrivePerson>): Promise<{ data: PipedrivePerson }> {
    return this.apiCall<{ data: PipedrivePerson }>('POST', '/persons', person);
  }

  async updatePerson(personId: number, updates: Partial<PipedrivePerson>): Promise<{ data: PipedrivePerson }> {
    return this.apiCall<{ data: PipedrivePerson }>('PUT', `/persons/${personId}`, updates);
  }

  async deletePerson(personId: number): Promise<{ data: { id: number } }> {
    return this.apiCall<{ data: { id: number } }>('DELETE', `/persons/${personId}`);
  }

  async getOrganizations(options?: { limit?: number }): Promise<{ data: PipedriveOrganization[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ data: PipedriveOrganization[] }>('GET', `/organizations${params}`);
  }

  async getOrganization(orgId: number): Promise<{ data: PipedriveOrganization }> {
    return this.apiCall<{ data: PipedriveOrganization }>('GET', `/organizations/${orgId}`);
  }

  async createOrganization(org: Partial<PipedriveOrganization>): Promise<{ data: PipedriveOrganization }> {
    return this.apiCall<{ data: PipedriveOrganization }>('POST', '/organizations', org);
  }

  async updateOrganization(orgId: number, updates: Partial<PipedriveOrganization>): Promise<{ data: PipedriveOrganization }> {
    return this.apiCall<{ data: PipedriveOrganization }>('PUT', `/organizations/${orgId}`, updates);
  }

  async deleteOrganization(orgId: number): Promise<{ data: { id: number } }> {
    return this.apiCall<{ data: { id: number } }>('DELETE', `/organizations/${orgId}`);
  }

  async getActivities(options?: { limit?: number; type?: string }): Promise<{ data: PipedriveActivity[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.type) params.append('type', options.type);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ data: PipedriveActivity[] }>('GET', `/activities${query}`);
  }

  async getActivity(activityId: number): Promise<{ data: PipedriveActivity }> {
    return this.apiCall<{ data: PipedriveActivity }>('GET', `/activities/${activityId}`);
  }

  async createActivity(activity: Partial<PipedriveActivity>): Promise<{ data: PipedriveActivity }> {
    return this.apiCall<{ data: PipedriveActivity }>('POST', '/activities', activity);
  }

  async updateActivity(activityId: number, updates: Partial<PipedriveActivity>): Promise<{ data: PipedriveActivity }> {
    return this.apiCall<{ data: PipedriveActivity }>('PUT', `/activities/${activityId}`, updates);
  }

  async deleteActivity(activityId: number): Promise<{ data: { id: number } }> {
    return this.apiCall<{ data: { id: number } }>('DELETE', `/activities/${activityId}`);
  }

  async getNotes(options?: { limit?: number }): Promise<{ data: PipedriveNote[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ data: PipedriveNote[] }>('GET', `/notes${params}`);
  }

  async getNote(noteId: number): Promise<{ data: PipedriveNote }> {
    return this.apiCall<{ data: PipedriveNote }>('GET', `/notes/${noteId}`);
  }

  async createNote(note: Partial<PipedriveNote>): Promise<{ data: PipedriveNote }> {
    return this.apiCall<{ data: PipedriveNote }>('POST', '/notes', note);
  }

  async updateNote(noteId: number, updates: Partial<PipedriveNote>): Promise<{ data: PipedriveNote }> {
    return this.apiCall<{ data: PipedriveNote }>('PUT', `/notes/${noteId}`, updates);
  }

  async deleteNote(noteId: number): Promise<{ data: { id: number } }> {
    return this.apiCall<{ data: { id: number } }>('DELETE', `/notes/${noteId}`);
  }

  async getProducts(options?: { limit?: number }): Promise<{ data: PipedriveProduct[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ data: PipedriveProduct[] }>('GET', `/products${params}`);
  }

  async getProduct(productId: number): Promise<{ data: PipedriveProduct }> {
    return this.apiCall<{ data: PipedriveProduct }>('GET', `/products/${productId}`);
  }

  async createProduct(product: Partial<PipedriveProduct>): Promise<{ data: PipedriveProduct }> {
    return this.apiCall<{ data: PipedriveProduct }>('POST', '/products', product);
  }

  async updateProduct(productId: number, updates: Partial<PipedriveProduct>): Promise<{ data: PipedriveProduct }> {
    return this.apiCall<{ data: PipedriveProduct }>('PUT', `/products/${productId}`, updates);
  }

  async deleteProduct(productId: number): Promise<{ data: { id: number } }> {
    return this.apiCall<{ data: { id: number } }>('DELETE', `/products/${productId}`);
  }

  async getPipelines(options?: { limit?: number }): Promise<{ data: PipedrivePipeline[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ data: PipedrivePipeline[] }>('GET', `/pipelines${params}`);
  }

  async getPipeline(pipelineId: number): Promise<{ data: PipedrivePipeline }> {
    return this.apiCall<{ data: PipedrivePipeline }>('GET', `/pipelines/${pipelineId}`);
  }

  async getStages(options?: { pipeline_id?: number }): Promise<{ data: PipedriveStage[] }> {
    const params = options?.pipeline_id ? `?pipeline_id=${options.pipeline_id}` : '';
    return this.apiCall<{ data: PipedriveStage[] }>('GET', `/stages${params}`);
  }

  async getStage(stageId: number): Promise<{ data: PipedriveStage }> {
    return this.apiCall<{ data: PipedriveStage }>('GET', `/stages/${stageId}`);
  }

  async getUsers(): Promise<{ data: PipedriveUser[] }> {
    return this.apiCall<{ data: PipedriveUser[] }>('GET', '/users');
  }

  async getUser(userId: number): Promise<{ data: PipedriveUser }> {
    return this.apiCall<{ data: PipedriveUser }>('GET', `/users/${userId}`);
  }

  async getFilters(): Promise<{ data: PipedriveFilter[] }> {
    return this.apiCall<{ data: PipedriveFilter[] }>('GET', '/filters');
  }

  async getFilter(filterId: number): Promise<{ data: PipedriveFilter }> {
    return this.apiCall<{ data: PipedriveFilter }>('GET', `/filters/${filterId}`);
  }

  async getFields(): Promise<{ data: PipedriveField[] }> {
    return this.apiCall<{ data: PipedriveField[] }>('GET', '/dealFields');
  }

  async webhooksCreate(webhook: { url: string; event_action: string; event_object: string }): Promise<{ data: PipedriveWebhook }> {
    return this.apiCall<{ data: PipedriveWebhook }>('POST', '/webhooks', webhook);
  }

  async webhooksList(): Promise<{ data: PipedriveWebhook[] }> {
    return this.apiCall<{ data: PipedriveWebhook[] }>('GET', '/webhooks');
  }

  async webhooksDelete(webhookId: number): Promise<{ data: { id: number } }> {
    return this.apiCall<{ data: { id: number } }>('DELETE', `/webhooks/${webhookId}`);
  }

  async getDealPayments(dealId: number): Promise<{ data: PipedrivePayment[] }> {
    return this.apiCall<{ data: PipedrivePayment[] }>('GET', `/deals/${dealId}/payments`);
  }

  async addDealPayment(payment: Partial<PipedrivePayment>): Promise<{ data: PipedrivePayment }> {
    return this.apiCall<{ data: PipedrivePayment }>('POST', '/deals/payments', payment);
  }

  async updateDealPayment(paymentId: number, updates: Partial<PipedrivePayment>): Promise<{ data: PipedrivePayment }> {
    return this.apiCall<{ data: PipedrivePayment }>('PUT', `/deals/payments/${paymentId}`, updates);
  }

  async deleteDealPayment(paymentId: number): Promise<{ data: { id: number } }> {
    return this.apiCall<{ data: { id: number } }>('DELETE', `/deals/payments/${paymentId}`);
  }

  async getOrganizationRelationships(orgId: number): Promise<{ data: PipedriveOrganizationRelationship[] }> {
    return this.apiCall<{ data: PipedriveOrganizationRelationship[] }>('GET', `/organizations/${orgId}/relationships`);
  }

  async addOrganizationRelationship(rel: Partial<PipedriveOrganizationRelationship>): Promise<{ data: PipedriveOrganizationRelationship }> {
    return this.apiCall<{ data: PipedriveOrganizationRelationship }>('POST', '/organizationRelationships', rel);
  }

  async deleteOrganizationRelationship(relId: number): Promise<{ data: { id: number } }> {
    return this.apiCall<{ data: { id: number } }>('DELETE', `/organizationRelationships/${relId}`);
  }

  getManifest() {
    return {
      name: 'Pipedrive',
      id: 'pipedrive',
      description: 'CRM integration',
      version: '1.0.0',
      actions: [
        { id: 'get_deals', name: 'Get Deals', description: 'List all deals' },
        { id: 'get_deal', name: 'Get Deal', description: 'Get deal details' },
        { id: 'create_deal', name: 'Create Deal', description: 'Create a new deal' },
        { id: 'update_deal', name: 'Update Deal', description: 'Update deal' },
        { id: 'delete_deal', name: 'Delete Deal', description: 'Delete a deal' },
        { id: 'get_persons', name: 'Get Persons', description: 'List all persons' },
        { id: 'get_person', name: 'Get Person', description: 'Get person details' },
        { id: 'create_person', name: 'Create Person', description: 'Create a new person' },
        { id: 'update_person', name: 'Update Person', description: 'Update person' },
        { id: 'delete_person', name: 'Delete Person', description: 'Delete a person' },
        { id: 'get_organizations', name: 'Get Organizations', description: 'List all organizations' },
        { id: 'get_organization', name: 'Get Organization', description: 'Get organization details' },
        { id: 'create_organization', name: 'Create Organization', description: 'Create a new organization' },
        { id: 'update_organization', name: 'Update Organization', description: 'Update organization' },
        { id: 'delete_organization', name: 'Delete Organization', description: 'Delete an organization' },
        { id: 'get_activities', name: 'Get Activities', description: 'List all activities' },
        { id: 'get_activity', name: 'Get Activity', description: 'Get activity details' },
        { id: 'create_activity', name: 'Create Activity', description: 'Create a new activity' },
        { id: 'update_activity', name: 'Update Activity', description: 'Update activity' },
        { id: 'delete_activity', name: 'Delete Activity', description: 'Delete an activity' },
        { id: 'get_notes', name: 'Get Notes', description: 'List all notes' },
        { id: 'get_note', name: 'Get Note', description: 'Get note details' },
        { id: 'create_note', name: 'Create Note', description: 'Create a new note' },
        { id: 'update_note', name: 'Update Note', description: 'Update a note' },
        { id: 'delete_note', name: 'Delete Note', description: 'Delete a note' },
        { id: 'get_products', name: 'Get Products', description: 'List all products' },
        { id: 'get_product', name: 'Get Product', description: 'Get product details' },
        { id: 'create_product', name: 'Create Product', description: 'Create a new product' },
        { id: 'update_product', name: 'Update Product', description: 'Update product' },
        { id: 'delete_product', name: 'Delete Product', description: 'Delete a product' },
        { id: 'get_pipelines', name: 'Get Pipelines', description: 'List all pipelines' },
        { id: 'get_pipeline', name: 'Get Pipeline', description: 'Get pipeline details' },
        { id: 'get_stages', name: 'Get Stages', description: 'List all stages' },
        { id: 'get_stage', name: 'Get Stage', description: 'Get stage details' },
        { id: 'get_users', name: 'Get Users', description: 'List all users' },
        { id: 'get_user', name: 'Get User', description: 'Get user details' },
        { id: 'get_filters', name: 'Get Filters', description: 'List all filters' },
        { id: 'get_filter', name: 'Get Filter', description: 'Get filter details' },
        { id: 'get_fields', name: 'Get Fields', description: 'List all custom fields' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a webhook' },
        { id: 'list_webhooks', name: 'List Webhooks', description: 'List all webhooks' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete a webhook' },
        { id: 'get_deal_payments', name: 'Get Deal Payments', description: 'List payments for deal' },
        { id: 'add_deal_payment', name: 'Add Deal Payment', description: 'Add payment to deal' },
        { id: 'update_deal_payment', name: 'Update Deal Payment', description: 'Update payment' },
        { id: 'delete_deal_payment', name: 'Delete Deal Payment', description: 'Delete payment' },
        { id: 'get_org_relationships', name: 'Get Org Relationships', description: 'List organization relationships' },
        { id: 'add_org_relationship', name: 'Add Org Relationship', description: 'Add organization relationship' },
        { id: 'delete_org_relationship', name: 'Delete Org Relationship', description: 'Delete organization relationship' },
      ],
      triggers: [
        { id: 'deal_created', name: 'Deal Created', description: 'Triggered when deal is created' },
        { id: 'deal_updated', name: 'Deal Updated', description: 'Triggered when deal is updated' },
        { id: 'deal_deleted', name: 'Deal Deleted', description: 'Triggered when deal is deleted' },
        { id: 'deal_won', name: 'Deal Won', description: 'Triggered when deal is won' },
        { id: 'deal_lost', name: 'Deal Lost', description: 'Triggered when deal is lost' },
        { id: 'person_created', name: 'Person Created', description: 'Triggered when person is created' },
        { id: 'person_updated', name: 'Person Updated', description: 'Triggered when person is updated' },
        { id: 'organization_created', name: 'Organization Created', description: 'Triggered when organization is created' },
        { id: 'activity_created', name: 'Activity Created', description: 'Triggered when activity is created' },
        { id: 'activity_done', name: 'Activity Done', description: 'Triggered when activity is completed' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'apiToken', label: 'API Token', description: 'Your Pipedrive API token', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/deals',
        method: 'GET',
      },
    };
  }
}

export const pipedrivePlugin = new PipedrivePlugin();