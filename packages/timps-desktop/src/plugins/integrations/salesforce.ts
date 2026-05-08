import { IntegrationBase } from './integration-base';

export interface SalesforceAccount {
  id: string;
  name: string;
  type?: string;
  phone?: string;
  website?: string;
  industry?: string;
  billingCity?: string;
  billingState?: string;
  billingCountry?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCountry?: string;
  description?: string;
  owner?: { id: string; name: string };
}

export interface SalesforceContact {
  id: string;
  firstName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  account?: { id: string; name: string };
  owner?: { id: string; name: string };
  mailingCity?: string;
  mailingState?: string;
  mailingCountry?: string;
}

export interface SalesforceLead {
  id: string;
  firstName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  status: string;
  rating?: string;
  industry?: string;
  owner?: { id: string; name: string };
}

export interface SalesforceOpportunity {
  id: string;
  name: string;
  amount?: number;
  closeDate?: string;
  stageName: string;
  probability?: number;
  type?: string;
  leadSource?: string;
  account?: { id: string; name: string };
  contact?: { id: string; name: string };
  owner?: { id: string; name: string };
}

export interface SalesforceTask {
  id: string;
  subject: string;
  status: string;
  priority: string;
  dueDate?: string;
  description?: string;
  whoId?: string;
  whatId?: string;
  owner?: { id: string; name: string };
}

export interface SalesforceEvent {
  id: string;
  subject: string;
  startDateTime?: string;
  endDateTime?: string;
  location?: string;
  description?: string;
  whoId?: string;
  whatId?: string;
  owner?: { id: string; name: string };
}

export interface SalesforceCampaign {
  id: string;
  name: string;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  budgetedCost?: number;
  actualCost?: number;
  expectedRevenue?: number;
  numberOfLeads?: number;
  numberOfConvertedLeads?: number;
  numberOfContacts?: number;
  numberOfResponses?: number;
  owner?: { id: string; name: string };
}

export interface SalesforceCase {
  id: string;
  caseNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  origin: string;
  type?: string;
  contact?: { id: string; name: string };
  account?: { id: string; name: string };
  owner?: { id: string; name: string };
}

export interface SalesforceContract {
  id: string;
  contractNumber: string;
  account?: { id: string; name: string };
  startDate?: string;
  endDate?: string;
  status?: string;
  totalContractValue?: number;
  owner?: { id: string; name: string };
}

export interface SalesforceSolution {
  id: string;
  solutionNumber: string;
  title: string;
  status: string;
  solutionName: string;
  body?: string;
  owner?: { id: string; name: string };
}

export interface SalesforceProduct {
  id: string;
  name: string;
  productCode?: string;
  description?: string;
  family?: string;
  isActive: boolean;
}

export interface SalesforcePricebookEntry {
  id: string;
  product2?: { id: string; name: string };
  unitPrice: number;
  useStandardPrice: boolean;
  isActive: boolean;
}

export interface SalesforceOrder {
  id: string;
  orderNumber: string;
  account?: { id: string; name: string };
  effectiveDate?: string;
  status: string;
  type?: string;
  totalAmount?: number;
}

export interface SalesforceUser {
  id: string;
  username: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  profile?: { id: string; name: string };
  role?: { id: string; name: string };
}

export interface SalesforceCustomField {
  id: string;
  name: string;
  label: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  picklistValues?: string[];
  defaultValue?: string;
}

export interface SalesforceListView {
  id: string;
  name: string;
  soqlQuery: string;
}

export interface SalesforceReport {
  id: string;
  name: string;
  description?: string;
  reportType: string;
  folder?: { id: string; name: string };
}

export interface SalesforceDashboard {
  id: string;
  title: string;
  description?: string;
  dashboardType: string;
  folder?: { id: string; name: string };
}

export interface SalesforceFlow {
  id: string;
  apiName: string;
  label: string;
  status: string;
  processType: string;
}

export interface SalesforceApexClass {
  id: string;
  name: string;
  apiVersion: string;
  status: string;
  body?: string;
}

export interface SalesforceApexTrigger {
  id: string;
  name: string;
  apiVersion: string;
  status: string;
  body?: string;
}

export interface SalesforceEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  htmlBody?: string;
  isActive: boolean;
  folder?: { id: string; name: string };
}

export interface SalesforceContentDocument {
  id: string;
  title: string;
  LatestPublishedVersion?: { id: string; versionNumber: string };
}

export interface SalesforceContentVersion {
  id: string;
  title: string;
  versionNumber: string;
  pathOnClient?: string;
  contentBody?: string;
}

interface SalesforceConfig {
  instanceUrl: string;
  accessToken: string;
}

export class SalesforcePlugin extends IntegrationBase {
  private config: SalesforceConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('Salesforce', 'salesforce', 'CRM integration');
    this.config = {} as SalesforceConfig;
  }

  setConfig(instanceUrl: string, accessToken: string): void {
    this.config = { instanceUrl, accessToken };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  private getBaseUrl(): string {
    return `${this.config.instanceUrl}/services/data/v59.0`;
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async query<T>(soql: string): Promise<{ totalSize: number; done: boolean; records: T[] }> {
    return this.apiCall<{ totalSize: number; done: boolean; records: T[] }>('GET', `/query?q=${encodeURIComponent(soql)}`);
  }

  async search<T>(sosl: string): Promise<{ searchRecords: T[] }> {
    return this.apiCall<{ searchRecords: T[] }>('GET', `/search?q=${encodeURIComponent(sosl)}`);
  }

  async getAccounts(options?: { limit?: number }): Promise<{ records: SalesforceAccount[] }> {
    const query = `SELECT Id, Name, Type, Phone, Website, Industry FROM Account${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceAccount>(query);
  }

  async getAccount(accountId: string): Promise<SalesforceAccount> {
    const query = `SELECT Id, Name, Type, Phone, Website, Industry, Description FROM Account WHERE Id = '${accountId}'`;
    const result = await this.query<SalesforceAccount>(query);
    return result.records[0];
  }

  async createAccount(account: Partial<SalesforceAccount>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/Account', account);
  }

  async updateAccount(accountId: string, updates: Partial<SalesforceAccount>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('PATCH', `/sobjects/Account/${accountId}`, updates);
  }

  async deleteAccount(accountId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/sobjects/Account/${accountId}`);
  }

  async getContacts(options?: { limit?: number }): Promise<{ records: SalesforceContact[] }> {
    const query = `SELECT Id, FirstName, LastName, Email, Phone, Title FROM Contact${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceContact>(query);
  }

  async getContact(contactId: string): Promise<SalesforceContact> {
    const query = `SELECT Id, FirstName, LastName, Email, Phone, Title FROM Contact WHERE Id = '${contactId}'`;
    const result = await this.query<SalesforceContact>(query);
    return result.records[0];
  }

  async createContact(contact: Partial<SalesforceContact>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/Contact', contact);
  }

  async updateContact(contactId: string, updates: Partial<SalesforceContact>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('PATCH', `/sobjects/Contact/${contactId}`, updates);
  }

  async deleteContact(contactId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/sobjects/Contact/${contactId}`);
  }

  async getLeads(options?: { limit?: number }): Promise<{ records: SalesforceLead[] }> {
    const query = `SELECT Id, FirstName, LastName, Email, Phone, Company, Status FROM Lead${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceLead>(query);
  }

  async getLead(leadId: string): Promise<SalesforceLead> {
    const query = `SELECT Id, FirstName, LastName, Email, Phone, Company, Status FROM Lead WHERE Id = '${leadId}'`;
    const result = await this.query<SalesforceLead>(query);
    return result.records[0];
  }

  async createLead(lead: Partial<SalesforceLead>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/Lead', lead);
  }

  async updateLead(leadId: string, updates: Partial<SalesforceLead>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('PATCH', `/sobjects/Lead/${leadId}`, updates);
  }

  async deleteLead(leadId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/sobjects/Lead/${leadId}`);
  }

  async convertLead(leadId: string, accountId?: string, contactId?: string): Promise<any> {
    return this.apiCall<any>('POST', '/sobjects/Lead/convert', { leadId, accountId, contactId });
  }

  async getOpportunities(options?: { limit?: number }): Promise<{ records: SalesforceOpportunity[] }> {
    const query = `SELECT Id, Name, Amount, CloseDate, StageName, Probability FROM Opportunity${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceOpportunity>(query);
  }

  async getOpportunity(opportunityId: string): Promise<SalesforceOpportunity> {
    const query = `SELECT Id, Name, Amount, CloseDate, StageName, Probability FROM Opportunity WHERE Id = '${opportunityId}'`;
    const result = await this.query<SalesforceOpportunity>(query);
    return result.records[0];
  }

  async createOpportunity(opportunity: Partial<SalesforceOpportunity>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/Opportunity', opportunity);
  }

  async updateOpportunity(opportunityId: string, updates: Partial<SalesforceOpportunity>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('PATCH', `/sobjects/Opportunity/${opportunityId}`, updates);
  }

  async deleteOpportunity(opportunityId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/sobjects/Opportunity/${opportunityId}`);
  }

  async getTasks(options?: { limit?: number }): Promise<{ records: SalesforceTask[] }> {
    const query = `SELECT Id, Subject, Status, Priority, DueDate FROM Task${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceTask>(query);
  }

  async createTask(task: Partial<SalesforceTask>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/Task', task);
  }

  async updateTask(taskId: string, updates: Partial<SalesforceTask>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('PATCH', `/sobjects/Task/${taskId}`, updates);
  }

  async completeTask(taskId: string): Promise<void> {
    return this.updateTask(taskId, { status: 'Completed' } as any);
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/sobjects/Task/${taskId}`);
  }

  async getEvents(options?: { limit?: number }): Promise<{ records: SalesforceEvent[] }> {
    const query = `SELECT Id, Subject, StartDateTime, EndDateTime, Location FROM Event${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceEvent>(query);
  }

  async createEvent(event: Partial<SalesforceEvent>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/Event', event);
  }

  async getCampaigns(options?: { limit?: number }): Promise<{ records: SalesforceCampaign[] }> {
    const query = `SELECT Id, Name, Type, Status, StartDate, EndDate FROM Campaign${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceCampaign>(query);
  }

  async createCampaign(campaign: Partial<SalesforceCampaign>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/Campaign', campaign);
  }

  async getCases(options?: { limit?: number }): Promise<{ records: SalesforceCase[] }> {
    const query = `SELECT Id, CaseNumber, Subject, Status, Priority FROM Case${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceCase>(query);
  }

  async createCase(caseData: Partial<SalesforceCase>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/Case', caseData);
  }

  async updateCase(caseId: string, updates: Partial<SalesforceCase>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('PATCH', `/sobjects/Case/${caseId}`, updates);
  }

  async getContracts(options?: { limit?: number }): Promise<{ records: SalesforceContract[] }> {
    const query = `SELECT Id, ContractNumber, Status, StartDate, EndDate FROM Contract${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceContract>(query);
  }

  async createContract(contract: Partial<SalesforceContract>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/Contract', contract);
  }

  async getSolutions(options?: { limit?: number }): Promise<{ records: SalesforceSolution[] }> {
    const query = `SELECT Id, SolutionNumber, Title, Status FROM Solution${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceSolution>(query);
  }

  async getProducts(options?: { limit?: number }): Promise<{ records: SalesforceProduct[] }> {
    const query = `SELECT Id, Name, ProductCode, Description, Family FROM Product2${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceProduct>(query);
  }

  async getOrders(options?: { limit?: number }): Promise<{ records: SalesforceOrder[] }> {
    const query = `SELECT Id, OrderNumber, Status, EffectiveDate, TotalAmount FROM Order${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceOrder>(query);
  }

  async getUsers(options?: { limit?: number }): Promise<{ records: SalesforceUser[] }> {
    const query = `SELECT Id, Username, Name, Email, IsActive FROM User${options?.limit ? ` LIMIT ${options.limit}` : ''}`;
    return this.query<SalesforceUser>(query);
  }

  async getUser(userId: string): Promise<SalesforceUser> {
    const query = `SELECT Id, Username, Name, Email, IsActive FROM User WHERE Id = '${userId}'`;
    const result = await this.query<SalesforceUser>(query);
    return result.records[0];
  }

  async getCustomFields(objectType: string): Promise<{ fields: SalesforceCustomField[] }> {
    return this.apiCall<{ fields: SalesforceCustomField[] }>('GET', `/sobjects/${objectType}/describe`);
  }

  async describeSObject(objectType: string): Promise<any> {
    return this.apiCall<any>('GET', `/sobjects/${objectType}/describe`);
  }

  async getListViews(objectType: string): Promise<{ listViews: SalesforceListView[] }> {
    return this.apiCall<{ listViews: SalesforceListView[] }>('GET', `/sobjects/${objectType}/listviews`);
  }

  async executeListView(objectType: string, listViewId: string): Promise<any> {
    return this.apiCall<any>('GET', `/sobjects/${objectType}/listviews/${listViewId}/results`);
  }

  async getReports(options?: { limit?: number }): Promise<{ reports: SalesforceReport[] }> {
    return this.apiCall<{ reports: SalesforceReport[] }>('GET', '/analytics/reports', { limit: options?.limit || 50 });
  }

  async runReport(reportId: string): Promise<any> {
    return this.apiCall<any>('GET', `/analytics/reports/${reportId}`);
  }

  async getDashboards(options?: { limit?: number }): Promise<{ dashboards: SalesforceDashboard[] }> {
    return this.apiCall<{ dashboards: SalesforceDashboard[] }>('GET', '/analytics/dashboards', { limit: options?.limit || 50 });
  }

  async getFlows(): Promise<{ flows: SalesforceFlow[] }> {
    return this.apiCall<{ flows: SalesforceFlow[] }>('GET', '/flow');
  }

  async getApexClasses(options?: { limit?: number }): Promise<{ apexClasses: SalesforceApexClass[] }> {
    return this.apiCall<{ apexClasses: SalesforceApexClass[] }>('GET', '/tooling/apexClasses', { limit: options?.limit || 50 });
  }

  async executeApex(apex: string): Promise<any> {
    return this.apiCall<any>('POST', '/tooling/executeAnonymous', { Script: apex });
  }

  async getApexTriggers(): Promise<{ triggers: SalesforceApexTrigger[] }> {
    return this.apiCall<{ triggers: SalesforceApexTrigger[] }>('GET', '/tooling/sObjects/ApexTrigger');
  }

  async getEmailTemplates(): Promise<{ emailTemplates: SalesforceEmailTemplate[] }> {
    return this.apiCall<{ emailTemplates: SalesforceEmailTemplate[] }>('GET', '/sobjects/EmailTemplate');
  }

  async createEmailTemplate(template: Partial<SalesforceEmailTemplate>): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/EmailTemplate', template);
  }

  async sendEmail(templateId: string, targetId: string, whatId?: string): Promise<void> {
    return this.apiCall<void>('POST', '/actions/email/send', {
      contextId: targetId,
      emailTemplateId: templateId,
      whatId,
    });
  }

  async getContentDocuments(options?: { limit?: number }): Promise<{ documents: SalesforceContentDocument[] }> {
    return this.apiCall<{ documents: SalesforceContentDocument[] }>('GET', '/sobjects/ContentDocument', { limit: options?.limit || 50 });
  }

  async createContentVersion(version: { Title: string; PathOnClient: string; VersionData: string }): Promise<{ id: string; success: boolean }> {
    return this.apiCall<{ id: string; success: boolean }>('POST', '/sobjects/ContentVersion', version);
  }

  async describe(): Promise<{ sobjects: any[] }> {
    return this.apiCall<{ sobjects: any[] }>('GET', '/sobjects');
  }

  getManifest() {
    return {
      name: 'Salesforce',
      id: 'salesforce',
      description: 'CRM integration',
      version: '1.0.0',
      actions: [
        { id: 'get_accounts', name: 'Get Accounts', description: 'List all accounts' },
        { id: 'get_account', name: 'Get Account', description: 'Get account details' },
        { id: 'create_account', name: 'Create Account', description: 'Create a new account' },
        { id: 'update_account', name: 'Update Account', description: 'Update account' },
        { id: 'delete_account', name: 'Delete Account', description: 'Delete an account' },
        { id: 'get_contacts', name: 'Get Contacts', description: 'List all contacts' },
        { id: 'get_contact', name: 'Get Contact', description: 'Get contact details' },
        { id: 'create_contact', name: 'Create Contact', description: 'Create a new contact' },
        { id: 'update_contact', name: 'Update Contact', description: 'Update contact' },
        { id: 'delete_contact', name: 'Delete Contact', description: 'Delete a contact' },
        { id: 'get_leads', name: 'Get Leads', description: 'List all leads' },
        { id: 'get_lead', name: 'Get Lead', description: 'Get lead details' },
        { id: 'create_lead', name: 'Create Lead', description: 'Create a new lead' },
        { id: 'update_lead', name: 'Update Lead', description: 'Update lead' },
        { id: 'delete_lead', name: 'Delete Lead', description: 'Delete a lead' },
        { id: 'convert_lead', name: 'Convert Lead', description: 'Convert lead to contact/account' },
        { id: 'get_opportunities', name: 'Get Opportunities', description: 'List all opportunities' },
        { id: 'get_opportunity', name: 'Get Opportunity', description: 'Get opportunity details' },
        { id: 'create_opportunity', name: 'Create Opportunity', description: 'Create a new opportunity' },
        { id: 'update_opportunity', name: 'Update Opportunity', description: 'Update opportunity' },
        { id: 'delete_opportunity', name: 'Delete Opportunity', description: 'Delete an opportunity' },
        { id: 'get_tasks', name: 'Get Tasks', description: 'List all tasks' },
        { id: 'create_task', name: 'Create Task', description: 'Create a new task' },
        { id: 'update_task', name: 'Update Task', description: 'Update task' },
        { id: 'complete_task', name: 'Complete Task', description: 'Mark task as completed' },
        { id: 'delete_task', name: 'Delete Task', description: 'Delete a task' },
        { id: 'get_events', name: 'Get Events', description: 'List all events' },
        { id: 'create_event', name: 'Create Event', description: 'Create a new event' },
        { id: 'get_campaigns', name: 'Get Campaigns', description: 'List all campaigns' },
        { id: 'create_campaign', name: 'Create Campaign', description: 'Create a new campaign' },
        { id: 'get_cases', name: 'Get Cases', description: 'List all cases' },
        { id: 'create_case', name: 'Create Case', description: 'Create a new case' },
        { id: 'update_case', name: 'Update Case', description: 'Update case' },
        { id: 'get_contracts', name: 'Get Contracts', description: 'List all contracts' },
        { id: 'create_contract', name: 'Create Contract', description: 'Create a new contract' },
        { id: 'get_solutions', name: 'Get Solutions', description: 'List all solutions' },
        { id: 'get_products', name: 'Get Products', description: 'List all products' },
        { id: 'get_orders', name: 'Get Orders', description: 'List all orders' },
        { id: 'get_users', name: 'Get Users', description: 'List all users' },
        { id: 'get_user', name: 'Get User', description: 'Get user details' },
        { id: 'get_custom_fields', name: 'Get Custom Fields', description: 'Get custom field definitions' },
        { id: 'describe_object', name: 'Describe Object', description: 'Describe object metadata' },
        { id: 'get_list_views', name: 'Get List Views', description: 'List all list views' },
        { id: 'execute_list_view', name: 'Execute List View', description: 'Execute list view query' },
        { id: 'get_reports', name: 'Get Reports', description: 'List all reports' },
        { id: 'run_report', name: 'Run Report', description: 'Run a report' },
        { id: 'get_dashboards', name: 'Get Dashboards', description: 'List all dashboards' },
        { id: 'get_flows', name: 'Get Flows', description: 'List all flows' },
        { id: 'get_apex_classes', name: 'Get Apex Classes', description: 'List all Apex classes' },
        { id: 'execute_apex', name: 'Execute Apex', description: 'Execute anonymous Apex' },
        { id: 'get_apex_triggers', name: 'Get Apex Triggers', description: 'List all Apex triggers' },
        { id: 'get_email_templates', name: 'Get Email Templates', description: 'List all email templates' },
        { id: 'create_email_template', name: 'Create Email Template', description: 'Create an email template' },
        { id: 'send_email', name: 'Send Email', description: 'Send an email' },
        { id: 'get_documents', name: 'Get Documents', description: 'List all documents' },
        { id: 'upload_content', name: 'Upload Content', description: 'Upload content' },
        { id: 'describe_global', name: 'Describe Global', description: 'Describe all objects' },
      ],
      triggers: [
        { id: 'account_created', name: 'Account Created', description: 'Triggered when account is created' },
        { id: 'account_updated', name: 'Account Updated', description: 'Triggered when account is updated' },
        { id: 'contact_created', name: 'Contact Created', description: 'Triggered when contact is created' },
        { id: 'lead_created', name: 'Lead Created', description: 'Triggered when lead is created' },
        { id: 'lead_converted', name: 'Lead Converted', description: 'Triggered when lead is converted' },
        { id: 'opportunity_created', name: 'Opportunity Created', description: 'Triggered when opportunity is created' },
        { id: 'opportunity_won', name: 'Opportunity Won', description: 'Triggered when opportunity is won' },
        { id: 'case_created', name: 'Case Created', description: 'Triggered when case is created' },
        { id: 'task_completed', name: 'Task Completed', description: 'Triggered when task is completed' },
        { id: 'event_created', name: 'Event Created', description: 'Triggered when event is created' },
      ],
      auth: {
        type: 'oauth2',
        fields: [
          { name: 'instanceUrl', label: 'Instance URL', description: 'Your Salesforce instance URL', required: true },
          { name: 'accessToken', label: 'Access Token', description: 'Your OAuth access token', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/query?q=SELECT+Id+FROM+Account+LIMIT+1',
        method: 'GET',
      },
    };
  }
}

export const salesforcePlugin = new SalesforcePlugin();