import { IntegrationBase } from './integration-base';

export interface FreshdeskTicket {
  id: number;
  subject: string;
  description: string;
  description_text: string;
  priority: number;
  status: number;
  requester_id: number;
  responder_id?: number;
  assigned_to?: number;
  company_id?: number;
  product_id?: number;
  group_id?: number;
  email_config_id?: number;
  ticket_type: string;
  category?: string;
  sub_category?: string;
  item_category?: string;
  custom_fields?: Record<string, any>;
  due_by: string;
  first_response_due_by?: string;
  first_response_status?: number;
  is_escalated: boolean;
  escalate_to?: number;
  description_html?: string;
  tags: string[];
  attachments: any[];
  created_at: string;
  updated_at: string;
}

export interface FreshdeskContact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  avatar?: any;
  active: boolean;
  deleted: boolean;
  email_auth_id?: number;
  customer_id?: number;
  exchange_id?: string;
  contact_account_id?: number;
  company_id?: number;
  custom_fields?: Record<string, any>;
  tags: string[];
  other_companies?: number[];
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface FreshdeskAgent {
  id: number;
  user_id: number;
  signature?: string;
  group_ids: number[];
  role_ids: number[];
  department_ids?: number[];
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FreshdeskCompany {
  id: number;
  name: string;
  description?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface FreshdeskConversation {
  id: number;
  ticket_id: number;
  user_id: number;
  source: number;
  body_text: string;
  body: string;
  attachments: any[];
  incoming: boolean;
  private: boolean;
  created_at: string;
  updated_at: string;
}

export interface FreshdeskTimeEntry {
  id: number;
  ticket_id: number;
  notes?: string;
  time_spent: number;
  timer_running: boolean;
  started_at: string;
  created_at: string;
  updated_at: string;
}

export interface FreshdeskSatisfactionRating {
  id: number;
  ticket_id: number;
  user_id: number;
  rating: 'extremely_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'extremely_dissatisfied';
  feedback_comment?: string;
  created_at: string;
}

export interface FreshdeskTicketField {
  id: number;
  name: string;
  label: string;
  placeholder?: string;
  field_type: 'paragraph' | 'text' | 'dropdown' | 'hidden' | 'date' | 'boolean' | 'currency' | 'numeric' | 'decimal' | 'percent' | 'url' | 'email';
  description?: string;
  default: boolean;
  required: boolean;
  position: number;
  choices?: Array<{ id: number; value: string }>;
  nested_dropdown?: any[];
  date_format?: string;
  allow_future_dates?: boolean;
  created_at: string;
  updated_at: string;
}

export interface FreshdeskTicketFilter {
  requester_id?: number;
  requester_email?: string;
  priority?: number;
  status?: number;
  ticket_type?: string;
  tags?: string[];
  created_since?: string;
  updated_since?: string;
  companies?: number[];
}

export interface FreshdeskListFilter {
  include?: string;
  exclude?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

interface FreshdeskConfig {
  domain: string;
  apiKey: string;
}

export class FreshdeskPlugin extends IntegrationBase {
  private config: FreshdeskConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('Freshdesk', 'freshdesk', 'Customer support and helpdesk integration');
    this.config = {} as FreshdeskConfig;
    this.baseHeaders = {
      'Content-Type': 'application/json',
    };
  }

  setConfig(domain: string, apiKey: string): void {
    this.config = { domain, apiKey };
    this.baseHeaders['Authorization'] = `Basic ${Buffer.from(`${apiKey}:X`).toString('base64')}`;
  }

  private getBaseUrl(): string {
    return `https://${this.config.domain}.freshdesk.com/api/v2`;
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async createTicket(ticket: Partial<FreshdeskTicket>): Promise<FreshdeskTicket> {
    return this.apiCall<FreshdeskTicket>('POST', '/tickets', ticket);
  }

  async getTicket(ticketId: number): Promise<FreshdeskTicket> {
    return this.apiCall<FreshdeskTicket>('GET', `/tickets/${ticketId}`);
  }

  async listTickets(filter?: FreshdeskTicketFilter): Promise<FreshdeskTicket[]> {
    const params = new URLSearchParams();
    if (filter?.priority) params.append('priority', filter.priority.toString());
    if (filter?.status) params.append('status', filter.status.toString());
    if (filter?.ticket_type) params.append('ticket_type', filter.ticket_type);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<FreshdeskTicket[]>('GET', `/tickets${query}`);
  }

  async updateTicket(ticketId: number, updates: Partial<FreshdeskTicket>): Promise<FreshdeskTicket> {
    return this.apiCall<FreshdeskTicket>('PUT', `/tickets/${ticketId}`, updates);
  }

  async deleteTicket(ticketId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/tickets/${ticketId}`);
  }

  async restoreTicket(ticketId: number): Promise<FreshdeskTicket> {
    return this.apiCall<FreshdeskTicket>('PUT', `/tickets/${ticketId}/restore`);
  }

  async pickTicket(ticketId: number, responderId?: number): Promise<FreshdeskTicket> {
    const endpoint = responderId ? `/tickets/${ticketId}/pick?responder_id=${responderId}` : `/tickets/${ticketId}/pick`;
    return this.apiCall<FreshdeskTicket>('PUT', endpoint);
  }

  async assignTicket(ticketId: number, responderId: number): Promise<FreshdeskTicket> {
    return this.apiCall<FreshdeskTicket>('PUT', `/tickets/${ticketId}/assign?responder_id=${responderId}`);
  }

  async bulkUpdateTickets(ticketIds: number[], updates: Partial<FreshdeskTicket>): Promise<void> {
    return this.apiCall<void>('PUT', '/tickets/bulk_update', { tickets: ticketIds.map(id => ({ id, ...updates })) });
  }

  async bulkDeleteTickets(ticketIds: number[]): Promise<void> {
    return this.apiCall<void>('PUT', '/tickets/bulk_update', { ids: ticketIds });
  }

  async createOutboundEmail(ticketId: number, email: string, subject: string, body: string): Promise<void> {
    return this.apiCall<void>('POST', `/tickets/${ticketId}/outbound_email`, { email, subject, body });
  }

  async forwardTicket(ticketId: number, email: string, subject: string, body: string): Promise<void> {
    return this.apiCall<void>('POST', `/tickets/${ticketId}/forward`, { email, subject, body });
  }

  async mergeTickets(fromTicketId: number, toTicketId: number): Promise<FreshdeskTicket> {
    return this.apiCall<FreshdeskTicket>('POST', '/tickets/merge', { from_ticket_id: fromTicketId, to_ticket_id: toTicketId });
  }

  async listTicketFields(): Promise<FreshdeskTicketField[]> {
    return this.apiCall<FreshdeskTicketField[]>('GET', '/ticket_fields');
  }

  async createTicketReply(ticketId: number, body: string, attachments?: any[]): Promise<FreshdeskConversation> {
    return this.apiCall<FreshdeskConversation>('POST', `/tickets/${ticketId}/reply`, { body, attachments });
  }

  async createTicketNote(ticketId: number, body: string, attachments?: any[], privateNote = true): Promise<FreshdeskConversation> {
    return this.apiCall<FreshdeskConversation>('POST', `/tickets/${ticketId}/notes`, { body, attachments, private: privateNote });
  }

  async listTicketConversations(ticketId: number): Promise<FreshdeskConversation[]> {
    return this.apiCall<FreshdeskConversation[]>('GET', `/tickets/${ticketId}/conversations`);
  }

  async updateConversation(conversationId: number, updates: Partial<FreshdeskConversation>): Promise<FreshdeskConversation> {
    return this.apiCall<FreshdeskConversation>('PUT', `/conversations/${conversationId}`, updates);
  }

  async deleteConversation(conversationId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/conversations/${conversationId}`);
  }

  async createContact(contact: Partial<FreshdeskContact>): Promise<FreshdeskContact> {
    return this.apiCall<FreshdeskContact>('POST', '/contacts', contact);
  }

  async getContact(contactId: number): Promise<FreshdeskContact> {
    return this.apiCall<FreshdeskContact>('GET', `/contacts/${contactId}`);
  }

  async listContacts(filter?: FreshdeskListFilter): Promise<FreshdeskContact[]> {
    const params = new URLSearchParams();
    if (filter?.page) params.append('page', filter.page.toString());
    if (filter?.per_page) params.append('per_page', filter.per_page.toString());
    if (filter?.sort) params.append('sort_by', filter.sort);
    if (filter?.order) params.append('sort_order', filter.order);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<FreshdeskContact[]>('GET', `/contacts${query}`);
  }

  async updateContact(contactId: number, updates: Partial<FreshdeskContact>): Promise<FreshdeskContact> {
    return this.apiCall<FreshdeskContact>('PUT', `/contacts/${contactId}`, updates);
  }

  async deleteContact(contactId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/contacts/${contactId}`);
  }

  async permanentlyDeleteContact(contactId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/contacts/${contactId}/hard_delete`);
  }

  async restoreContact(contactId: number): Promise<FreshdeskContact> {
    return this.apiCall<FreshdeskContact>('PUT', `/contacts/${contactId}/restore`);
  }

  async makeAgent(contactId: number): Promise<FreshdeskAgent> {
    return this.apiCall<FreshdeskAgent>('PUT', `/contacts/${contactId}/make_agent`);
  }

  async sendInvite(contactId: number): Promise<void> {
    return this.apiCall<void>('POST', `/contacts/${contactId}/send_invite`);
  }

  async searchContacts(term: string): Promise<FreshdeskContact[]> {
    return this.apiCall<FreshdeskContact[]>('GET', `/contacts/autocomplete?term=${term}`);
  }

  async mergeContacts(fromContactId: number, toContactId: number): Promise<FreshdeskContact> {
    return this.apiCall<FreshdeskContact>('POST', '/contacts/merge', { from_contact_id: fromContactId, to_contact_id: toContactId });
  }

  async listContactFields() {
    return this.apiCall<any[]>('GET', '/contact_fields');
  }

  async createCompany(company: Partial<FreshdeskCompany>): Promise<FreshdeskCompany> {
    return this.apiCall<FreshdeskCompany>('POST', '/companies', company);
  }

  async getCompany(companyId: number): Promise<FreshdeskCompany> {
    return this.apiCall<FreshdeskCompany>('GET', `/companies/${companyId}`);
  }

  async listCompanies(filter?: FreshdeskListFilter): Promise<FreshdeskCompany[]> {
    const params = new URLSearchParams();
    if (filter?.page) params.append('page', filter.page.toString());
    if (filter?.per_page) params.append('per_page', filter.per_page.toString());
    if (filter?.sort) params.append('sort_by', filter.sort);
    if (filter?.order) params.append('sort_order', filter.order);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<FreshdeskCompany[]>('GET', `/companies${query}`);
  }

  async updateCompany(companyId: number, updates: Partial<FreshdeskCompany>): Promise<FreshdeskCompany> {
    return this.apiCall<FreshdeskCompany>('PUT', `/companies/${companyId}`, updates);
  }

  async deleteCompany(companyId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/companies/${companyId}`);
  }

  async searchCompanies(name: string): Promise<FreshdeskCompany[]> {
    return this.apiCall<FreshdeskCompany[]>('GET', `/companies/autocomplete?name=${name}`);
  }

  async createAgent(agent: Partial<FreshdeskAgent>): Promise<FreshdeskAgent> {
    return this.apiCall<FreshdeskAgent>('POST', '/agents', agent);
  }

  async getAgent(agentId: number): Promise<FreshdeskAgent> {
    return this.apiCall<FreshdeskAgent>('GET', `/agents/${agentId}`);
  }

  async listAgents(): Promise<FreshdeskAgent[]> {
    return this.apiCall<FreshdeskAgent[]>('GET', '/agents');
  }

  async getCurrentAgent(): Promise<FreshdeskAgent> {
    return this.apiCall<FreshdeskAgent>('GET', '/agents/me');
  }

  async bulkCreateAgents(agents: Partial<FreshdeskAgent>[]): Promise<FreshdeskAgent[]> {
    return this.apiCall<FreshdeskAgent[]>('POST', '/agents/bulk', { agents });
  }

  async searchAgents(term: string): Promise<FreshdeskAgent[]> {
    return this.apiCall<FreshdeskAgent[]>('GET', `/agents/autocomplete?term=${term}`);
  }

  async createTicketTimeEntry(ticketId: number, timeEntry: Partial<FreshdeskTimeEntry>): Promise<FreshdeskTimeEntry> {
    return this.apiCall<FreshdeskTimeEntry>('POST', `/tickets/${ticketId}/time_entries`, timeEntry);
  }

  async listTicketTimeEntries(ticketId: number): Promise<FreshdeskTimeEntry[]> {
    return this.apiCall<FreshdeskTimeEntry[]>('GET', `/tickets/${ticketId}/time_entries`);
  }

  async createSatisfactionRating(ticketId: number, rating: string, comment?: string): Promise<FreshdeskSatisfactionRating> {
    return this.apiCall<FreshdeskSatisfactionRating>('POST', `/tickets/${ticketId}/satisfaction_ratings`, { rating, feedback_comment: comment });
  }

  async listSatisfactionRatings(ticketId: number): Promise<FreshdeskSatisfactionRating[]> {
    return this.apiCall<FreshdeskSatisfactionRating[]>('GET', `/tickets/${ticketId}/satisfaction_ratings`);
  }

  getManifest() {
    return {
      name: 'Freshdesk',
      id: 'freshdesk',
      description: 'Customer support and helpdesk integration for Freshdesk',
      version: '1.0.0',
      actions: [
        { id: 'create_ticket', name: 'Create Ticket', description: 'Create a new support ticket' },
        { id: 'get_ticket', name: 'Get Ticket', description: 'Get ticket details by ID' },
        { id: 'list_tickets', name: 'List Tickets', description: 'List all tickets with optional filters' },
        { id: 'update_ticket', name: 'Update Ticket', description: 'Update an existing ticket' },
        { id: 'delete_ticket', name: 'Delete Ticket', description: 'Delete a ticket' },
        { id: 'restore_ticket', name: 'Restore Ticket', description: 'Restore a deleted ticket' },
        { id: 'pick_ticket', name: 'Pick Ticket', description: 'Pick up a ticket for processing' },
        { id: 'assign_ticket', name: 'Assign Ticket', description: 'Assign a ticket to an agent' },
        { id: 'bulk_update_tickets', name: 'Bulk Update Tickets', description: 'Update multiple tickets at once' },
        { id: 'bulk_delete_tickets', name: 'Bulk Delete Tickets', description: 'Delete multiple tickets at once' },
        { id: 'create_outbound_email', name: 'Create Outbound Email', description: 'Create an outbound email from a ticket' },
        { id: 'forward_ticket', name: 'Forward Ticket', description: 'Forward a ticket via email' },
        { id: 'merge_tickets', name: 'Merge Tickets', description: 'Merge two tickets together' },
        { id: 'list_ticket_fields', name: 'List Ticket Fields', description: 'Get all ticket field definitions' },
        { id: 'create_reply', name: 'Create Reply', description: 'Reply to a ticket' },
        { id: 'create_note', name: 'Create Note', description: 'Add an internal note to a ticket' },
        { id: 'list_conversations', name: 'List Conversations', description: 'Get all conversations for a ticket' },
        { id: 'update_conversation', name: 'Update Conversation', description: 'Update a conversation' },
        { id: 'delete_conversation', name: 'Delete Conversation', description: 'Delete a conversation' },
        { id: 'create_contact', name: 'Create Contact', description: 'Create a new contact' },
        { id: 'get_contact', name: 'Get Contact', description: 'Get contact details by ID' },
        { id: 'list_contacts', name: 'List Contacts', description: 'List all contacts' },
        { id: 'update_contact', name: 'Update Contact', description: 'Update a contact' },
        { id: 'delete_contact', name: 'Delete Contact', description: 'Soft delete a contact' },
        { id: 'permanent_delete_contact', name: 'Permanent Delete Contact', description: 'Permanently delete a contact' },
        { id: 'restore_contact', name: 'Restore Contact', description: 'Restore a deleted contact' },
        { id: 'make_agent', name: 'Make Agent', description: 'Convert a contact to an agent' },
        { id: 'send_invite', name: 'Send Invite', description: 'Send an invitation email to a contact' },
        { id: 'search_contacts', name: 'Search Contacts', description: 'Search contacts by keyword' },
        { id: 'merge_contacts', name: 'Merge Contacts', description: 'Merge two contacts' },
        { id: 'list_contact_fields', name: 'List Contact Fields', description: 'Get all contact field definitions' },
        { id: 'create_company', name: 'Create Company', description: 'Create a new company' },
        { id: 'get_company', name: 'Get Company', description: 'Get company details by ID' },
        { id: 'list_companies', name: 'List Companies', description: 'List all companies' },
        { id: 'update_company', name: 'Update Company', description: 'Update a company' },
        { id: 'delete_company', name: 'Delete Company', description: 'Delete a company' },
        { id: 'search_companies', name: 'Search Companies', description: 'Search companies by name' },
        { id: 'create_agent', name: 'Create Agent', description: 'Create a new agent' },
        { id: 'get_agent', name: 'Get Agent', description: 'Get agent details by ID' },
        { id: 'list_agents', name: 'List Agents', description: 'List all agents' },
        { id: 'get_current_agent', name: 'Get Current Agent', description: 'Get current authenticated agent' },
        { id: 'bulk_create_agents', name: 'Bulk Create Agents', description: 'Create multiple agents at once' },
        { id: 'search_agents', name: 'Search Agents', description: 'Search agents by keyword' },
        { id: 'create_time_entry', name: 'Create Time Entry', description: 'Log time spent on a ticket' },
        { id: 'list_time_entries', name: 'List Time Entries', description: 'Get all time entries for a ticket' },
        { id: 'create_satisfaction_rating', name: 'Create Satisfaction Rating', description: 'Submit customer satisfaction rating' },
        { id: 'list_satisfaction_ratings', name: 'List Satisfaction Ratings', description: 'Get satisfaction ratings for a ticket' },
      ],
      triggers: [
        { id: 'ticket_created', name: 'Ticket Created', description: 'Triggered when a new ticket is created' },
        { id: 'ticket_updated', name: 'Ticket Updated', description: 'Triggered when a ticket is updated' },
        { id: 'ticket_deleted', name: 'Ticket Deleted', description: 'Triggered when a ticket is deleted' },
        { id: 'ticket_assigned', name: 'Ticket Assigned', description: 'Triggered when a ticket is assigned to an agent' },
        { id: 'ticket_closed', name: 'Ticket Closed', description: 'Triggered when a ticket is closed' },
        { id: 'ticket_escalated', name: 'Ticket Escalated', description: 'Triggered when a ticket is escalated' },
        { id: 'contact_created', name: 'Contact Created', description: 'Triggered when a new contact is created' },
        { id: 'contact_updated', name: 'Contact Updated', description: 'Triggered when a contact is updated' },
        { id: 'company_created', name: 'Company Created', description: 'Triggered when a new company is created' },
        { id: 'company_updated', name: 'Company Updated', description: 'Triggered when a company is updated' },
        { id: 'agent_created', name: 'Agent Created', description: 'Triggered when a new agent is created' },
        { id: 'conversation_added', name: 'Conversation Added', description: 'Triggered when a new conversation is added to a ticket' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'domain', label: 'Freshdesk Domain', description: 'Your Freshdesk subdomain (e.g., company.freshdesk.com)', required: true },
          { name: 'apiKey', label: 'API Key', description: 'Your Freshdesk API key', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/tickets',
        method: 'GET',
      },
    };
  }
}

export const freshdeskPlugin = new FreshdeskPlugin();