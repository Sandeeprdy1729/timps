import { IntegrationBase } from './integration-base';

export interface CloseLead {
  id: string;
  name: string;
  display_name?: string;
  url?: string;
  description?: string;
  status: string;
  status_id?: string;
  account?: {
    id: string;
    name: string;
  };
  contacts?: CloseContact[];
  opportunities?: CloseOpportunity[];
  tasks?: CloseTask[];
  activities?: CloseActivity[];
  custom_fields?: Record<string, any>;
  tags?: string[];
  date_entered?: string;
  date_converted?: string;
  date_updated?: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface CloseContact {
  id: string;
  lead_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  phones?: Array<{ phone: string; type: string }>;
  emails?: Array<{ email: string; type: string }>;
  urls?: Array<{ url: string; type: string }>;
  custom_fields?: Record<string, any>;
  notes?: string;
  tags?: string[];
  date_created?: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface CloseOpportunity {
  id: string;
  lead_id: string;
  name: string;
  status: string;
  status_id?: string;
  value?: {
    amount: number;
    currency: string;
  };
  probability?: number;
  close_date?: string;
  date_won?: string;
  date_lost?: string;
  lead?: {
    id: string;
    name: string;
  };
  contacts?: Array<{ id: string; name: string }>;
  custom_fields?: Record<string, any>;
  note?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface CloseActivity {
  id: string;
  type: 'Call' | 'Email' | 'Meeting' | 'Note' | 'SMS' | 'Task' | 'EmailIn' | 'EmailOut';
  lead_id: string;
  contact_id?: string;
  status?: string;
  direction?: 'inbound' | 'outbound';
  subject?: string;
  body?: string;
  outcome?: string;
  phone?: string;
  from_number?: string;
  to_number?: string;
  duration?: number;
  template_id?: string;
  users?: Array<{ id: string; name: string }>;
  date: string;
  created_at?: string;
  updated_at?: string;
}

export interface CloseTask {
  id: string;
  lead_id: string;
  contact_id?: string;
  subject: string;
  body?: string;
  date_due?: string;
  is_completed: boolean;
  completed_at?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface CloseEmail {
  id: string;
  lead_id: string;
  contact_id?: string;
  subject: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  attachments?: Array<{ id: string; file_name: string; size: number }>;
  template_id?: string;
  group_id?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CloseCall {
  id: string;
  lead_id: string;
  contact_id?: string;
  status: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  recording?: string;
  outcome?: string;
  phone: string;
  users?: Array<{ id: string; name: string }>;
  created_at: string;
  updated_at: string;
}

export interface CloseMeeting {
  id: string;
  lead_id: string;
  contact_id?: string;
  name: string;
  description?: string;
  location?: string;
  start_at: string;
  duration: number;
  outcome?: string;
  attendees?: Array<{ id: string; name: string; email: string }>;
  created_at: string;
  updated_at: string;
}

export interface CloseNote {
  id: string;
  lead_id: string;
  contact_id?: string;
  type: string;
  note: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CloseSMS {
  id: string;
  lead_id: string;
  contact_id?: string;
  status: string;
  direction: 'inbound' | 'outbound';
  body: string;
  from_number: string;
  to_number: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ClosePipeline {
  id: string;
  name: string;
  display_order: number;
  organization_id: string;
  stages: ClosePipelineStage[];
}

export interface ClosePipelineStage {
  id: string;
  name: string;
  display_order: number;
  probability?: number;
  win_rate?: number;
  pipeline_id: string;
}

export interface CloseWebhook {
  id: string;
  url: string;
  events: string[];
  name?: string;
  organization_id: string;
  enabled: boolean;
  created_at: string;
}

export interface CloseSmartView {
  id: string;
  name: string;
  query: any;
  fields?: string[];
  shared_withorganization?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CloseFilter {
  term?: string;
  filters?: any;
  modified_since?: string;
  limit?: number;
  skip?: number;
  sort?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface CloseSearchOptions extends CloseFilter {
  object_type: 'lead' | 'contact' | 'opportunity' | 'activity';
  include_counts?: boolean;
  cursor?: string;
}

interface CloseConfig {
  apiKey: string;
}

export class ClosePlugin extends IntegrationBase {
  private config: CloseConfig;
  private baseHeaders: Record<string, string> = {};

  constructor() {
    super('Close', 'close', 'CRM and sales automation integration');
    this.config = {} as CloseConfig;
    this.baseHeaders = {
      'Content-Type': 'application/json',
    };
  }

  setApiKey(apiKey: string): void {
    this.config = { apiKey };
    this.baseHeaders['Authorization'] = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
  }

  private getBaseUrl(): string {
    return 'https://api.close.com/api/v1';
  }

  async apiCall<T>(method: string, endpoint: string, body?: any, params?: Record<string, string>): Promise<T> {
    let url = `${this.getBaseUrl()}${endpoint}`;
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }
    const options: RequestInit = {
      method,
      headers: {
        ...this.baseHeaders,
        'Content-Type': 'application/json',
      },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'API request failed');
    }
    return response.json();
  }

  async createLead(lead: Partial<CloseLead>): Promise<CloseLead> {
    return this.apiCall<CloseLead>('POST', '/lead', lead);
  }

  async getLead(leadId: string): Promise<CloseLead> {
    return this.apiCall<CloseLead>('GET', `/lead/${leadId}`);
  }

  async updateLead(leadId: string, updates: Partial<CloseLead>): Promise<CloseLead> {
    return this.apiCall<CloseLead>('PUT', `/lead/${leadId}`, updates);
  }

  async deleteLead(leadId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/lead/${leadId}`);
  }

  async listLeads(filter?: CloseFilter): Promise<CloseLead[]> {
    const params: Record<string, string> = {};
    if (filter?.limit) params['_limit'] = filter.limit.toString();
    if (filter?.skip) params['_skip'] = filter.skip.toString();
    if (filter?.sort) params['_sort'] = filter.sort;
    if (filter?.modified_since) params['modified_since'] = filter.modified_since;
    return this.apiCall<CloseLead[]>('GET', '/lead', undefined, params);
  }

  async searchLeads(query: any): Promise<CloseLead[]> {
    return this.apiCall<CloseLead[]>('POST', '/data/search', { ...query, object_type: 'lead' });
  }

  async createContact(leadId: string, contact: Partial<CloseContact>): Promise<CloseContact> {
    return this.apiCall<CloseContact>('POST', `/lead/${leadId}/contact`, contact);
  }

  async getContact(contactId: string): Promise<CloseContact> {
    return this.apiCall<CloseContact>('GET', `/contact/${contactId}`);
  }

  async updateContact(contactId: string, updates: Partial<CloseContact>): Promise<CloseContact> {
    return this.apiCall<CloseContact>('PUT', `/contact/${contactId}`, updates);
  }

  async deleteContact(contactId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/contact/${contactId}`);
  }

  async listContacts(leadId: string): Promise<CloseContact[]> {
    return this.apiCall<CloseContact[]>('GET', `/lead/${leadId}/contact`);
  }

  async searchContacts(query: any): Promise<CloseContact[]> {
    return this.apiCall<CloseContact[]>('POST', '/data/search', { ...query, object_type: 'contact' });
  }

  async createOpportunity(leadId: string, opportunity: Partial<CloseOpportunity>): Promise<CloseOpportunity> {
    return this.apiCall<CloseOpportunity>('POST', `/lead/${leadId}/opportunity`, opportunity);
  }

  async getOpportunity(opportunityId: string): Promise<CloseOpportunity> {
    return this.apiCall<CloseOpportunity>('GET', `/opportunity/${opportunityId}`);
  }

  async updateOpportunity(opportunityId: string, updates: Partial<CloseOpportunity>): Promise<CloseOpportunity> {
    return this.apiCall<CloseOpportunity>('PUT', `/opportunity/${opportunityId}`, updates);
  }

  async deleteOpportunity(opportunityId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/opportunity/${opportunityId}`);
  }

  async listOpportunities(leadId: string): Promise<CloseOpportunity[]> {
    return this.apiCall<CloseOpportunity[]>('GET', `/lead/${leadId}/opportunity`);
  }

  async searchOpportunities(query: any): Promise<CloseOpportunity[]> {
    return this.apiCall<CloseOpportunity[]>('POST', '/data/search', { ...query, object_type: 'opportunity' });
  }

  async createActivity(leadId: string, activity: Partial<CloseActivity>): Promise<CloseActivity> {
    return this.apiCall<CloseActivity>('POST', `/lead/${leadId}/activity`, activity);
  }

  async getActivity(activityId: string): Promise<CloseActivity> {
    return this.apiCall<CloseActivity>('GET', `/activity/${activityId}`);
  }

  async updateActivity(activityId: string, updates: Partial<CloseActivity>): Promise<CloseActivity> {
    return this.apiCall<CloseActivity>('PUT', `/activity/${activityId}`, updates);
  }

  async listActivities(leadId: string, filter?: CloseFilter): Promise<CloseActivity[]> {
    const params: Record<string, string> = {};
    if (filter?.limit) params['_limit'] = filter.limit.toString();
    if (filter?.skip) params['_skip'] = filter.skip.toString();
    return this.apiCall<CloseActivity[]>('GET', `/lead/${leadId}/activity`, undefined, params);
  }

  async searchActivities(query: any): Promise<CloseActivity[]> {
    return this.apiCall<CloseActivity[]>('POST', '/data/search', { ...query, object_type: 'activity' });
  }

  async createTask(leadId: string, task: Partial<CloseTask>): Promise<CloseTask> {
    return this.apiCall<CloseTask>('POST', `/lead/${leadId}/task`, task);
  }

  async getTask(taskId: string): Promise<CloseTask> {
    return this.apiCall<CloseTask>('GET', `/task/${taskId}`);
  }

  async updateTask(taskId: string, updates: Partial<CloseTask>): Promise<CloseTask> {
    return this.apiCall<CloseTask>('PUT', `/task/${taskId}`, updates);
  }

  async completeTask(taskId: string): Promise<CloseTask> {
    return this.apiCall<CloseTask>('PUT', `/task/${taskId}`, { is_completed: true });
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/task/${taskId}`);
  }

  async listTasks(leadId: string): Promise<CloseTask[]> {
    return this.apiCall<CloseTask[]>('GET', `/lead/${leadId}/task`);
  }

  async createCall(leadId: string, call: Partial<CloseCall>): Promise<CloseCall> {
    return this.apiCall<CloseCall>('POST', `/lead/${leadId}/call`, call);
  }

  async createEmail(leadId: string, email: Partial<CloseEmail>): Promise<CloseEmail> {
    return this.apiCall<CloseEmail>('POST', `/lead/${leadId}/email`, email);
  }

  async createMeeting(leadId: string, meeting: Partial<CloseMeeting>): Promise<CloseMeeting> {
    return this.apiCall<CloseMeeting>('POST', `/lead/${leadId}/meeting`, meeting);
  }

  async createNote(leadId: string, note: Partial<CloseNote>): Promise<CloseNote> {
    return this.apiCall<CloseNote>('POST', `/lead/${leadId}/note`, note);
  }

  async createSMS(leadId: string, sms: Partial<CloseSMS>): Promise<CloseSMS> {
    return this.apiCall<CloseSMS>('POST', `/lead/${leadId}/sms`, sms);
  }

  async listPipelines(): Promise<ClosePipeline[]> {
    return this.apiCall<ClosePipeline[]>('GET', '/pipeline');
  }

  async getPipeline(pipelineId: string): Promise<ClosePipeline> {
    return this.apiCall<ClosePipeline>('GET', `/pipeline/${pipelineId}`);
  }

  async createWebhook(webhook: Partial<CloseWebhook>): Promise<CloseWebhook> {
    return this.apiCall<CloseWebhook>('POST', '/webhook', webhook);
  }

  async getWebhook(webhookId: string): Promise<CloseWebhook> {
    return this.apiCall<CloseWebhook>('GET', `/webhook/${webhookId}`);
  }

  async updateWebhook(webhookId: string, updates: Partial<CloseWebhook>): Promise<CloseWebhook> {
    return this.apiCall<CloseWebhook>('PUT', `/webhook/${webhookId}`, updates);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/webhook/${webhookId}`);
  }

  async listWebhooks(): Promise<CloseWebhook[]> {
    return this.apiCall<CloseWebhook[]>('GET', '/webhook');
  }

  async createSmartView(smartView: Partial<CloseSmartView>): Promise<CloseSmartView> {
    return this.apiCall<CloseSmartView>('POST', '/saved-search', smartView);
  }

  async getSmartView(smartViewId: string): Promise<CloseSmartView> {
    return this.apiCall<CloseSmartView>('GET', `/saved-search/${smartViewId}`);
  }

  async updateSmartView(smartViewId: string, updates: Partial<CloseSmartView>): Promise<CloseSmartView> {
    return this.apiCall<CloseSmartView>('PUT', `/saved-search/${smartViewId}`, updates);
  }

  async deleteSmartView(smartViewId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/saved-search/${smartViewId}`);
  }

  async listSmartViews(): Promise<CloseSmartView[]> {
    return this.apiCall<CloseSmartView[]>('GET', '/saved-search');
  }

  async bulkUpdateLeads(leadIds: string[], updates: Partial<CloseLead>): Promise<void> {
    return this.apiCall<void>('POST', '/lead/bulk_update', { ids: leadIds, ...updates });
  }

  async bulkUpdateContacts(contactIds: string[], updates: Partial<CloseContact>): Promise<void> {
    return this.apiCall<void>('POST', '/contact/bulk_update', { ids: contactIds, ...updates });
  }

  async bulkUpdateOpportunities(opportunityIds: string[], updates: Partial<CloseOpportunity>): Promise<void> {
    return this.apiCall<void>('POST', '/opportunity/bulk_update', { ids: opportunityIds, ...updates });
  }

  async createLeadFromLead(leadId: string): Promise<CloseLead> {
    return this.apiCall<CloseLead>('POST', `/lead/${leadId}/clone`, {});
  }

  async createContactFromContact(contactId: string): Promise<CloseContact> {
    return this.apiCall<CloseContact>('POST', `/contact/${contactId}/clone`, {});
  }

  async logEmailActivity(leadId: string, emailData: { from: string; to: string[]; subject: string; body: string }): Promise<CloseActivity> {
    return this.createActivity(leadId, {
      type: 'Email',
      ...emailData as any,
    });
  }

  async logCallActivity(leadId: string, callData: { direction: 'inbound' | 'outbound'; duration: number; phone: string; outcome?: string }): Promise<CloseActivity> {
    return this.createActivity(leadId, {
      type: 'Call',
      ...callData as any,
    });
  }

  getManifest() {
    return {
      name: 'Close',
      id: 'close',
      description: 'CRM and sales automation integration for Close',
      version: '1.0.0',
      actions: [
        { id: 'create_lead', name: 'Create Lead', description: 'Create a new lead' },
        { id: 'get_lead', name: 'Get Lead', description: 'Get lead details by ID' },
        { id: 'update_lead', name: 'Update Lead', description: 'Update lead information' },
        { id: 'delete_lead', name: 'Delete Lead', description: 'Delete a lead' },
        { id: 'list_leads', name: 'List Leads', description: 'List all leads with optional filters' },
        { id: 'search_leads', name: 'Search Leads', description: 'Search leads using advanced filters' },
        { id: 'create_contact', name: 'Create Contact', description: 'Create a new contact for a lead' },
        { id: 'get_contact', name: 'Get Contact', description: 'Get contact details by ID' },
        { id: 'update_contact', name: 'Update Contact', description: 'Update contact information' },
        { id: 'delete_contact', name: 'Delete Contact', description: 'Delete a contact' },
        { id: 'list_contacts', name: 'List Contacts', description: 'List all contacts for a lead' },
        { id: 'search_contacts', name: 'Search Contacts', description: 'Search contacts using advanced filters' },
        { id: 'create_opportunity', name: 'Create Opportunity', description: 'Create a new opportunity for a lead' },
        { id: 'get_opportunity', name: 'Get Opportunity', description: 'Get opportunity details by ID' },
        { id: 'update_opportunity', name: 'Update Opportunity', description: 'Update opportunity information' },
        { id: 'delete_opportunity', name: 'Delete Opportunity', description: 'Delete an opportunity' },
        { id: 'list_opportunities', name: 'List Opportunities', description: 'List all opportunities for a lead' },
        { id: 'search_opportunities', name: 'Search Opportunities', description: 'Search opportunities using advanced filters' },
        { id: 'create_activity', name: 'Create Activity', description: 'Create a new activity for a lead' },
        { id: 'get_activity', name: 'Get Activity', description: 'Get activity details by ID' },
        { id: 'update_activity', name: 'Update Activity', description: 'Update activity information' },
        { id: 'list_activities', name: 'List Activities', description: 'List activities for a lead' },
        { id: 'search_activities', name: 'Search Activities', description: 'Search activities using advanced filters' },
        { id: 'create_task', name: 'Create Task', description: 'Create a new task for a lead' },
        { id: 'get_task', name: 'Get Task', description: 'Get task details by ID' },
        { id: 'update_task', name: 'Update Task', description: 'Update task information' },
        { id: 'complete_task', name: 'Complete Task', description: 'Mark a task as completed' },
        { id: 'delete_task', name: 'Delete Task', description: 'Delete a task' },
        { id: 'list_tasks', name: 'List Tasks', description: 'List tasks for a lead' },
        { id: 'create_call', name: 'Create Call', description: 'Log a call activity for a lead' },
        { id: 'create_email', name: 'Create Email', description: 'Send or log an email for a lead' },
        { id: 'create_meeting', name: 'Create Meeting', description: 'Schedule a meeting for a lead' },
        { id: 'create_note', name: 'Create Note', description: 'Add a note to a lead' },
        { id: 'create_sms', name: 'Create SMS', description: 'Send or log an SMS for a lead' },
        { id: 'list_pipelines', name: 'List Pipelines', description: 'List all sales pipelines' },
        { id: 'get_pipeline', name: 'Get Pipeline', description: 'Get pipeline details by ID' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a new webhook' },
        { id: 'get_webhook', name: 'Get Webhook', description: 'Get webhook details by ID' },
        { id: 'update_webhook', name: 'Update Webhook', description: 'Update webhook settings' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete a webhook' },
        { id: 'list_webhooks', name: 'List Webhooks', description: 'List all webhooks' },
        { id: 'create_smart_view', name: 'Create Smart View', description: 'Create a new saved search (Smart View)' },
        { id: 'get_smart_view', name: 'Get Smart View', description: 'Get Smart View details by ID' },
        { id: 'update_smart_view', name: 'Update Smart View', description: 'Update a Smart View' },
        { id: 'delete_smart_view', name: 'Delete Smart View', description: 'Delete a Smart View' },
        { id: 'list_smart_views', name: 'List Smart Views', description: 'List all Smart Views' },
        { id: 'bulk_update_leads', name: 'Bulk Update Leads', description: 'Update multiple leads at once' },
        { id: 'bulk_update_contacts', name: 'Bulk Update Contacts', description: 'Update multiple contacts at once' },
        { id: 'bulk_update_opportunities', name: 'Bulk Update Opportunities', description: 'Update multiple opportunities at once' },
        { id: 'clone_lead', name: 'Clone Lead', description: 'Create a copy of an existing lead' },
        { id: 'clone_contact', name: 'Clone Contact', description: 'Create a copy of an existing contact' },
        { id: 'log_email_activity', name: 'Log Email Activity', description: 'Log an email interaction as an activity' },
        { id: 'log_call_activity', name: 'Log Call Activity', description: 'Log a phone call as an activity' },
      ],
      triggers: [
        { id: 'lead_created', name: 'Lead Created', description: 'Triggered when a new lead is created' },
        { id: 'lead_updated', name: 'Lead Updated', description: 'Triggered when a lead is updated' },
        { id: 'lead_deleted', name: 'Lead Deleted', description: 'Triggered when a lead is deleted' },
        { id: 'contact_created', name: 'Contact Created', description: 'Triggered when a new contact is created' },
        { id: 'contact_updated', name: 'Contact Updated', description: 'Triggered when a contact is updated' },
        { id: 'opportunity_created', name: 'Opportunity Created', description: 'Triggered when a new opportunity is created' },
        { id: 'opportunity_updated', name: 'Opportunity Updated', description: 'Triggered when an opportunity is updated' },
        { id: 'opportunity_won', name: 'Opportunity Won', description: 'Triggered when an opportunity is marked as won' },
        { id: 'opportunity_lost', name: 'Opportunity Lost', description: 'Triggered when an opportunity is marked as lost' },
        { id: 'task_completed', name: 'Task Completed', description: 'Triggered when a task is completed' },
        { id: 'activity_created', name: 'Activity Created', description: 'Triggered when a new activity is logged' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'apiKey', label: 'API Key', description: 'Your Close API key', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/lead',
        method: 'GET',
      },
    };
  }
}

export const closePlugin = new ClosePlugin();