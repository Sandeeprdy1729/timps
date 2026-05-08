import { IntegrationBase } from './integration-base';

export interface ZendeskTicket {
  id: number;
  subject: string;
  description: string;
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  type: 'problem' | 'incident' | 'task' | 'question';
  requester_id: number;
  assignee_id?: number;
  organization_id?: number;
  group_id?: number;
  due_at?: string;
  tags: string[];
  custom_fields?: Array<{ id: number; value: any }>;
  created_at: string;
  updated_at: string;
}

export interface ZendeskUser {
  id: number;
  name: string;
  email: string;
  active: boolean;
  alias?: string;
  details?: string;
  notes?: string;
  role: 'end-user' | 'agent' | 'admin';
  organization_id?: number;
  tags?: string[];
  photo?: { url: string; content_type: string; size: number };
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface ZendeskOrganization {
  id: number;
  name: string;
  details?: string;
  notes?: string;
  domain_names: string[];
  organization_fields?: Record<string, any>;
}

export interface ZendeskGroup {
  id: number;
  name: string;
  description: string;
  default: boolean;
}

export interface ZendeskTicketField {
  id: number;
  system_id: number;
  title: string;
  description: string;
  position: number;
  active: boolean;
  required: boolean;
  type: 'text' | 'textarea' | 'date' | 'integer' | 'decimal' | 'regexp' | 'multiselect' | 'dropdown' | 'checkbox' | 'radio';
  options_for_type?: { options: Array<{ name: string; value: string }> };
}

export interface ZendeskMacro {
  id: number;
  title: string;
  description: string;
  active: boolean;
  actions: Array<{ field: string; value: any }>;
}

export interface ZendeskSatisfaction {
  id: number;
  ticket_id: number;
  created_at: string;
  updated_at: string;
  score: 'good' | 'bad';
  requester_id: number;
  assignee_id?: number;
  comment?: string;
}

export interface ZendeskView {
  id: number;
  title: string;
  description: string;
  active: boolean;
  conditions: any;
  execution: any;
  sorting: string;
}

export interface ZendeskWebhook {
  id: string;
  name: string;
  endpoint: string;
  http_method: string;
  status: 'active' | 'inactive';
  requests: Array<{ url: string }>;
}

export interface ZendeskSidebarApp {
  id: string;
  name: string;
  location: 'ticket_sidebar' | 'new_ticket_sidebar' | 'user_sidebar' | 'organization_sidebar' | 'portal_sidebar' | 'agent_interface' | 'modal' | 'nav_bar';
  default: boolean;
}

export interface ZendeskTag {
  name: string;
  count: number;
}

export interface ZendeskTrigger {
  id: number;
  name: string;
  actions: Array<{ field: string; value: any }>;
  conditions: any;
  enabled: boolean;
}

export interface ZendeskAutomation {
  id: number;
  title: string;
  conditions: any;
  actions: Array<{ field: string; value: any }>;
  enabled: boolean;
}

export interface ZendeskDynamicContent {
  id: number;
  name: string;
  placeholder: string;
  default: boolean;
  active: boolean;
  variants: Array<{ id: number; content: string; locale: string; active: boolean }>;
}

export interface ZendeskJobStatus {
  id: string;
  url: string;
  status: 'queued' | 'working' | 'failed' | 'completed';
  progress: number;
  total: number;
  result?: any;
}

interface ZendeskConfig {
  instanceUrl: string;
  email: string;
  apiToken: string;
}

export class ZendeskPlugin extends IntegrationBase {
  private config: ZendeskConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('Zendesk', 'zendesk', 'Customer support and helpdesk integration');
    this.config = {} as ZendeskConfig;
  }

  setConfig(instanceUrl: string, email: string, apiToken: string): void {
    const auth = Buffer.from(`${email}/token:${apiToken}`).toString('base64');
    this.config = { instanceUrl, email, apiToken };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    };
  }

  private getBaseUrl(): string {
    return `${this.config.instanceUrl}/api/v2`;
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async getTickets(options?: { status?: string; page?: number }): Promise<{ tickets: ZendeskTicket[] }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.page) params.append('page', options.page.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ tickets: ZendeskTicket[] }>('GET', `/tickets.json${query}`);
  }

  async getTicket(ticketId: number): Promise<{ ticket: ZendeskTicket }> {
    return this.apiCall<{ ticket: ZendeskTicket }>('GET', `/tickets/${ticketId}.json`);
  }

  async createTicket(ticket: Partial<ZendeskTicket>): Promise<{ ticket: ZendeskTicket }> {
    return this.apiCall<{ ticket: ZendeskTicket }>('POST', '/tickets.json', { ticket });
  }

  async createTickets(tickets: Partial<ZendeskTicket>[]): Promise<{ job: ZendeskJobStatus }> {
    return this.apiCall<{ job: ZendeskJobStatus }>('POST', '/tickets/create_many.json', { tickets });
  }

  async updateTicket(ticketId: number, updates: Partial<ZendeskTicket>): Promise<{ ticket: ZendeskTicket }> {
    return this.apiCall<{ ticket: ZendeskTicket }>('PUT', `/tickets/${ticketId}.json`, { ticket: updates });
  }

  async deleteTicket(ticketId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/tickets/${ticketId}.json`);
  }

  async bulkDeleteTickets(ticketIds: number[]): Promise<{ job: ZendeskJobStatus }> {
    return this.apiCall<{ job: ZendeskJobStatus }>('DELETE', '/tickets/destroy_many.json', { ids: ticketIds });
  }

  async listTicketComments(ticketId: number): Promise<{ comments: any[] }> {
    return this.apiCall<{ comments: any[] }>('GET', `/tickets/${ticketId}/comments.json`);
  }

  async addTicketComment(ticketId: number, comment: string, isPublic = true): Promise<any> {
    return this.updateTicket(ticketId, { description: comment } as any);
  }

  async listTicketAuditEvents(ticketId: number): Promise<{ audits: any[] }> {
    return this.apiCall<{ audits: any[] }>('GET', `/tickets/${ticketId}/audits.json`);
  }

  async getUsers(options?: { role?: string }): Promise<{ users: ZendeskUser[] }> {
    const params = options?.role ? `?role=${options.role}` : '';
    return this.apiCall<{ users: ZendeskUser[] }>('GET', `/users.json${params}`);
  }

  async getUser(userId: number): Promise<{ user: ZendeskUser }> {
    return this.apiCall<{ user: ZendeskUser }>('GET', `/users/${userId}.json`);
  }

  async createUser(user: Partial<ZendeskUser>): Promise<{ user: ZendeskUser }> {
    return this.apiCall<{ user: ZendeskUser }>('POST', '/users.json', { user });
  }

  async updateUser(userId: number, updates: Partial<ZendeskUser>): Promise<{ user: ZendeskUser }> {
    return this.apiCall<{ user: ZendeskUser }>('PUT', `/users/${userId}.json`, { user: updates });
  }

  async deleteUser(userId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/users/${userId}.json`);
  }

  async showUserIdentities(userId: number): Promise<{ identities: any[] }> {
    return this.apiCall<{ identities: any[] }>('GET', `/users/${userId}/identities.json`);
  }

  async addUserIdentity(userId: number, identity: { type: string; value: string }): Promise<any> {
    return this.apiCall<any>('POST', `/users/${userId}/identities.json`, { identity });
  }

  async getOrganizations(options?: { page?: number }): Promise<{ organizations: ZendeskOrganization[] }> {
    const params = options?.page ? `?page=${options.page}` : '';
    return this.apiCall<{ organizations: ZendeskOrganization[] }>('GET', `/organizations.json${params}`);
  }

  async getOrganization(orgId: number): Promise<{ organization: ZendeskOrganization }> {
    return this.apiCall<{ organization: ZendeskOrganization }>('GET', `/organizations/${orgId}.json`);
  }

  async createOrganization(org: Partial<ZendeskOrganization>): Promise<{ organization: ZendeskOrganization }> {
    return this.apiCall<{ organization: ZendeskOrganization }>('POST', '/organizations.json', { organization: org });
  }

  async updateOrganization(orgId: number, updates: Partial<ZendeskOrganization>): Promise<{ organization: ZendeskOrganization }> {
    return this.apiCall<{ organization: ZendeskOrganization }>('PUT', `/organizations/${orgId}.json`, { organization: updates });
  }

  async deleteOrganization(orgId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/organizations/${orgId}.json`);
  }

  async getOrganizationMemberships(userId: number): Promise<{ memberships: any[] }> {
    return this.apiCall<{ memberships: any[] }>('GET', `/users/${userId}/organization_memberships.json`);
  }

  async listGroups(): Promise<{ groups: ZendeskGroup[] }> {
    return this.apiCall<{ groups: ZendeskGroup[] }>('GET', '/groups.json');
  }

  async getGroup(groupId: number): Promise<{ group: ZendeskGroup }> {
    return this.apiCall<{ group: ZendeskGroup }>('GET', `/groups/${groupId}.json`);
  }

  async createGroup(group: Partial<ZendeskGroup>): Promise<{ group: ZendeskGroup }> {
    return this.apiCall<{ group: ZendeskGroup }>('POST', '/groups.json', { group });
  }

  async updateGroup(groupId: number, updates: Partial<ZendeskGroup>): Promise<{ group: ZendeskGroup }> {
    return this.apiCall<{ group: ZendeskGroup }>('PUT', `/groups/${groupId}.json`, { group: updates });
  }

  async deleteGroup(groupId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/groups/${groupId}.json`);
  }

  async listTicketFields(): Promise<{ ticket_fields: ZendeskTicketField[] }> {
    return this.apiCall<{ ticket_fields: ZendeskTicketField[] }>('GET', '/ticket_fields.json');
  }

  async getTicketField(fieldId: number): Promise<{ ticket_field: ZendeskTicketField }> {
    return this.apiCall<{ ticket_field: ZendeskTicketField }>('GET', `/ticket_fields/${fieldId}.json`);
  }

  async createTicketField(field: Partial<ZendeskTicketField>): Promise<{ ticket_field: ZendeskTicketField }> {
    return this.apiCall<{ ticket_field: ZendeskTicketField }>('POST', '/ticket_fields.json', { ticket_field: field });
  }

  async updateTicketField(fieldId: number, updates: Partial<ZendeskTicketField>): Promise<{ ticket_field: ZendeskTicketField }> {
    return this.apiCall<{ ticket_field: ZendeskTicketField }>('PUT', `/ticket_fields/${fieldId}.json`, { ticket_field: updates });
  }

  async listMacros(): Promise<{ macros: ZendeskMacro[] }> {
    return this.apiCall<{ macros: ZendeskMacro[] }>('GET', '/macros.json');
  }

  async getMacro(macroId: number): Promise<{ macro: ZendeskMacro }> {
    return this.apiCall<{ macro: ZendeskMacro }>('GET', `/macros/${macroId}.json`);
  }

  async createMacro(macro: Partial<ZendeskMacro>): Promise<{ macro: ZendeskMacro }> {
    return this.apiCall<{ macro: ZendeskMacro }>('POST', '/macros.json', { macro });
  }

  async updateMacro(macroId: number, updates: Partial<ZendeskMacro>): Promise<{ macro: ZendeskMacro }> {
    return this.apiCall<{ macro: ZendeskMacro }>('PUT', `/macros/${macroId}.json`, { macro: updates });
  }

  async executeMacro(macroId: number, ticketId: number): Promise<any> {
    return this.apiCall<any>('POST', `/macros/${macroId}/apply.json`, { ticket_id: ticketId });
  }

  async listSatisfactionRatings(ticketId: number): Promise<{ satisfaction: ZendeskSatisfaction[] }> {
    return this.apiCall<{ satisfaction: ZendeskSatisfaction[] }>('GET', `/tickets/${ticketId}/satisfaction.json`);
  }

  async listViews(): Promise<{ views: ZendeskView[] }> {
    return this.apiCall<{ views: ZendeskView[] }>('GET', '/views.json');
  }

  async getView(viewId: number): Promise<{ view: ZendeskView }> {
    return this.apiCall<{ view: ZendeskView }>('GET', `/views/${viewId}.json`);
  }

  async executeView(viewId: number): Promise<any> {
    return this.apiCall<any>('POST', `/views/${viewId}/execute.json`);
  }

  async listWebhooks(): Promise<{ webhooks: ZendeskWebhook[] }> {
    return this.apiCall<{ webhooks: ZendeskWebhook[] }>('GET', '/webhooks.json');
  }

  async createWebhook(webhook: Partial<ZendeskWebhook>): Promise<{ webhook: ZendeskWebhook }> {
    return this.apiCall<{ webhook: ZendeskWebhook }>('POST', '/webhooks.json', { webhook });
  }

  async updateWebhook(webhookId: string, updates: Partial<ZendeskWebhook>): Promise<{ webhook: ZendeskWebhook }> {
    return this.apiCall<{ webhook: ZendeskWebhook }>('PUT', `/webhooks/${webhookId}.json`, { webhook: updates });
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/webhooks/${webhookId}.json`);
  }

  async listTags(): Promise<{ tags: ZendeskTag[] }> {
    return this.apiCall<{ tags: ZendeskTag[] }>('GET', '/tags.json');
  }

  async listTriggers(): Promise<{ triggers: ZendeskTrigger[] }> {
    return this.apiCall<{ triggers: ZendeskTrigger[] }>('GET', '/triggers.json');
  }

  async getTrigger(triggerId: number): Promise<{ trigger: ZendeskTrigger }> {
    return this.apiCall<{ trigger: ZendeskTrigger }>('GET', `/triggers/${triggerId}.json`);
  }

  async listAutomations(): Promise<{ automations: ZendeskAutomation[] }> {
    return this.apiCall<{ automations: ZendeskAutomation[] }>('GET', '/automations.json');
  }

  async getAutomation(automationId: number): Promise<{ automation: ZendeskAutomation }> {
    return this.apiCall<{ automation: ZendeskAutomation }>('GET', `/automations/${automationId}.json`);
  }

  async listDynamicContent(): Promise<{ id: number; name: string; placeholder: string }[]> {
    return this.apiCall<any>('GET', '/dynamic_content/items.json');
  }

  async getDynamicContent(itemId: number): Promise<any> {
    return this.apiCall<any>('GET', `/dynamic_content/items/${itemId}.json`);
  }

  getManifest() {
    return {
      name: 'Zendesk',
      id: 'zendesk',
      description: 'Customer support and helpdesk integration',
      version: '1.0.0',
      actions: [
        { id: 'get_tickets', name: 'Get Tickets', description: 'List all tickets' },
        { id: 'get_ticket', name: 'Get Ticket', description: 'Get ticket details' },
        { id: 'create_ticket', name: 'Create Ticket', description: 'Create a new ticket' },
        { id: 'create_tickets', name: 'Create Tickets', description: 'Create multiple tickets' },
        { id: 'update_ticket', name: 'Update Ticket', description: 'Update a ticket' },
        { id: 'delete_ticket', name: 'Delete Ticket', description: 'Delete a ticket' },
        { id: 'bulk_delete_tickets', name: 'Bulk Delete Tickets', description: 'Delete multiple tickets' },
        { id: 'list_comments', name: 'List Comments', description: 'Get ticket comments' },
        { id: 'add_comment', name: 'Add Comment', description: 'Add comment to ticket' },
        { id: 'list_audits', name: 'List Audits', description: 'Get ticket audit events' },
        { id: 'get_users', name: 'Get Users', description: 'List all users' },
        { id: 'get_user', name: 'Get User', description: 'Get user details' },
        { id: 'create_user', name: 'Create User', description: 'Create a new user' },
        { id: 'update_user', name: 'Update User', description: 'Update user' },
        { id: 'delete_user', name: 'Delete User', description: 'Delete a user' },
        { id: 'list_identities', name: 'List Identities', description: 'Get user identities' },
        { id: 'add_identity', name: 'Add Identity', description: 'Add identity to user' },
        { id: 'get_organizations', name: 'Get Organizations', description: 'List all organizations' },
        { id: 'get_organization', name: 'Get Organization', description: 'Get organization details' },
        { id: 'create_organization', name: 'Create Organization', description: 'Create a new organization' },
        { id: 'update_organization', name: 'Update Organization', description: 'Update organization' },
        { id: 'delete_organization', name: 'Delete Organization', description: 'Delete an organization' },
        { id: 'list_memberships', name: 'List Memberships', description: 'List organization memberships' },
        { id: 'list_groups', name: 'List Groups', description: 'List all groups' },
        { id: 'get_group', name: 'Get Group', description: 'Get group details' },
        { id: 'create_group', name: 'Create Group', description: 'Create a new group' },
        { id: 'update_group', name: 'Update Group', description: 'Update group' },
        { id: 'delete_group', name: 'Delete Group', description: 'Delete a group' },
        { id: 'list_ticket_fields', name: 'List Ticket Fields', description: 'List all ticket fields' },
        { id: 'get_ticket_field', name: 'Get Ticket Field', description: 'Get ticket field details' },
        { id: 'create_ticket_field', name: 'Create Ticket Field', description: 'Create a new ticket field' },
        { id: 'update_ticket_field', name: 'Update Ticket Field', description: 'Update ticket field' },
        { id: 'list_macros', name: 'List Macros', description: 'List all macros' },
        { id: 'get_macro', name: 'Get Macro', description: 'Get macro details' },
        { id: 'create_macro', name: 'Create Macro', description: 'Create a new macro' },
        { id: 'update_macro', name: 'Update Macro', description: 'Update macro' },
        { id: 'execute_macro', name: 'Execute Macro', description: 'Apply macro to ticket' },
        { id: 'list_satisfaction', name: 'List Satisfaction', description: 'Get satisfaction ratings' },
        { id: 'list_views', name: 'List Views', description: 'List all views' },
        { id: 'get_view', name: 'Get View', description: 'Get view details' },
        { id: 'execute_view', name: 'Execute View', description: 'Execute view to get results' },
        { id: 'list_webhooks', name: 'List Webhooks', description: 'List all webhooks' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a new webhook' },
        { id: 'update_webhook', name: 'Update Webhook', description: 'Update webhook' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete a webhook' },
        { id: 'list_tags', name: 'List Tags', description: 'List all tags' },
        { id: 'list_triggers', name: 'List Triggers', description: 'List all triggers' },
        { id: 'list_automations', name: 'List Automations', description: 'List all automations' },
        { id: 'list_dynamic_content', name: 'List Dynamic Content', description: 'List dynamic content' },
      ],
      triggers: [
        { id: 'ticket_created', name: 'Ticket Created', description: 'Triggered when ticket is created' },
        { id: 'ticket_updated', name: 'Ticket Updated', description: 'Triggered when ticket is updated' },
        { id: 'ticket_assigned', name: 'Ticket Assigned', description: 'Triggered when ticket is assigned' },
        { id: 'ticket_solved', name: 'Ticket Solved', description: 'Triggered when ticket is solved' },
        { id: 'ticket_closed', name: 'Ticket Closed', description: 'Triggered when ticket is closed' },
        { id: 'user_created', name: 'User Created', description: 'Triggered when user is created' },
        { id: 'user_updated', name: 'User Updated', description: 'Triggered when user is updated' },
        { id: 'organization_created', name: 'Organization Created', description: 'Triggered when organization is created' },
      ],
      auth: {
        type: 'basic',
        fields: [
          { name: 'instanceUrl', label: 'Instance URL', description: 'Your Zendesk instance URL', required: true },
          { name: 'email', label: 'Email', description: 'Your Zendesk email', required: true },
          { name: 'apiToken', label: 'API Token', description: 'Your Zendesk API token', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/tickets.json',
        method: 'GET',
      },
    };
  }
}

export const zendeskPlugin = new ZendeskPlugin();