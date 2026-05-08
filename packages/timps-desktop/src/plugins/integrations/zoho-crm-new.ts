import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface ZohoCRMLead {
  id: string;
  First_Name: string;
  Last_Name: string;
  Company: string;
  Email: string;
  Phone: string;
  Mobile: string;
  Salutation: string;
  Title: string;
  Lead_Source: string;
  Lead_Status: string;
  Industry: string;
  Annual_Revenue: number;
  Number_of_Employees: string;
  Rating: string;
  Street: string;
  City: string;
  State: string;
  Country: string;
  Zip_Code: string;
  Description: string;
  Owner: { id: string; name: string; email: string };
  Created_Time: string;
  Modified_Time: string;
  Converted: boolean;
  Converted_Contact_ID: string;
  Converted_Account_ID: string;
  Converted_Deal_ID: string;
  Tag: string[];
  Vendor: { id: string; name: string };
}

export interface ZohoCRMContact {
  id: string;
  Salutation: string;
  First_Name: string;
  Last_Name: string;
  Full_Name: string;
  Email: string;
  Phone: string;
  Mobile: string;
  Asst_Phone: string;
  Department: string;
  Title: string;
  Reports_To: { id: string; name: string };
  Lead_Source: string;
  Account_Name: { id: string; name: string };
  Mailing_Street: string;
  Mailing_City: string;
  Mailing_State: string;
  Mailing_Country: string;
  Mailing_Zip: string;
  Other_Street: string;
  Other_City: string;
  Other_State: string;
  Other_Country: string;
  Other_Zip: string;
  Description: string;
  Owner: { id: string; name: string; email: string };
  Created_Time: string;
  Modified_Time: string;
  Tag: string[];
  Other_Phone: string;
  Assistant_Name: string;
  Assistant_Phone: string;
}

export interface ZohoCRMDeal {
  id: string;
  Deal_Name: string;
  Amount: number;
  Currency: string;
  Stage: string;
  Probability: number;
  Expected_Revenue: number;
  Closing_Date: string;
  Type: string;
  Lead_Source: string;
  Next_Step: string;
  Description: string;
  Account_Name: { id: string; name: string };
  Contact_Name: { id: string; name: string };
  Owner: { id: string; name: string; email: string };
  Created_Time: string;
  Modified_Time: string;
  Tag: string[];
  Product_Details: { product: { id: string; name: string }; quantity: number; unit_price: number; total: number }[];
  Campaign_Source: { id: string; name: string };
}

export interface ZohoCRMAccount {
  id: string;
  Account_Name: string;
  Account_Type: string;
  Industry: string;
  Annual_Revenue: number;
  Rating: string;
  Website: string;
  Phone: string;
  Fax: string;
  Billing_Street: string;
  Billing_City: string;
  Billing_State: string;
  Billing_Country: string;
  Billing_Code: string;
  Shipping_Street: string;
  Shipping_City: string;
  Shipping_State: string;
  Shipping_Country: string;
  Shipping_Code: string;
  Owner: { id: string; name: string; email: string };
  Created_Time: string;
  Modified_Time: string;
  Description: string;
  Tag: string[];
  Parent_Account: { id: string; name: string };
 sic_code: string;
  employee_count: string;
}

export interface ZohoCRMTask {
  id: string;
  Subject: string;
  Due_Date: string;
  Status: string;
  Priority: string;
  Reminder: string;
  Description: string;
  Owner: { id: string; name: string; email: string };
  Created_Time: string;
  Modified_Time: string;
  Who_Id: { id: string; name: string; email: string };
  What_Id: { id: string; name: string };
  Activity_Date: string;
  Closed_Time: string;
}

export interface ZohoCRMNote {
  id: string;
  Note_Title: string;
  Note_Content: string;
  Parent: { id: string; module: string; name: string };
  Owner: { id: string; name: string; email: string };
  Created_Time: string;
  Modified_Time: string;
  Attachments: { id: string; file_name: string; size: number; created_time: string }[];
}

export interface ZohoCRMUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: { id: string; name: string };
  profile: { id: string; name: string };
  timezone: string;
  locale: string;
  date_format: string;
  time_format: string;
  is_online: boolean;
  country: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  mobile: string;
}

export interface ZohoCRMModule {
  name: string;
  label: string;
  plural_label: string;
  id: string;
  global_search_supported: boolean;
  kanban_view_supported: boolean;
  builder_enabled: boolean;
}

export interface ZohoCRMField {
  id: string;
  name: string;
  label: string;
  type: string;
  length: number;
  required: boolean;
  read_only: boolean;
  default_value: string;
  picklist_values: { display_value: string; actual_value: string }[];
  related_to: { name: string; id: string }[];
}

export interface ZohoCRMCustomView {
  id: string;
  name: string;
  module: string;
  fields: string[];
  sort_field: string;
  sort_order: string;
  favorites: boolean;
  default: boolean;
  system_name: string;
}

export interface ZohoCRMAttachment {
  id: string;
  file_name: string;
  content_type: string;
  size: number;
  parent_id: string;
  parent_module: string;
  created_time: string;
  modified_time: string;
}

export interface ZohoCRMTag {
  id: string;
  name: string;
  color: string;
  module: string;
}

export interface ZohoCRMSalesOrder {
  id: string;
  Subject: string;
  Deal_Name: { id: string; name: string };
  Account_Name: { id: string; name: string };
  Contact_Name: { id: string; name: string };
  Due_Date: string;
  Enquiry_Source: string;
  Customer_Type: string;
  Billing_Street: string;
  Billing_City: string;
  Billing_Country: string;
  Shipping_Street: string;
  Shipping_City: string;
  Shipping_Country: string;
  Terms_and_Conditions: string;
  Description: string;
  Owner: { id: string; name: string };
  Product_Details: { product: { id: string; name: string }; quantity: number; unit_price: number; total: number; discount: number }[];
  Sub_Total: number;
  Tax: number;
  Adjustment: number;
  Grand_Total: number;
}

export interface ZohoCRMCampaign {
  id: string;
  Name: string;
  Status: string;
  Type: string;
  Start_Date: string;
  End_Date: string;
  Budget: number;
  Expected_Revenue: number;
  Actual_Cost: number;
  Response_Count: number;
  Conversion_Rate: number;
  Description: string;
  Owner: { id: string; name: string };
  Created_Time: string;
  Modified_Time: string;
}

export interface ZohoCRMPipeline {
  id: string;
  name: string;
  display_name: string;
  is_default: boolean;
  deals_pipeline: {
    id: string;
    name: string;
    display_name: string;
    is_default: boolean;
    stages: { id: string; name: string; sequence_number: number; display_value: string }[];
  }[];
}

export interface ZohoCRMReport {
  id: string;
  name: string;
  type: string;
  subtype: string;
  module: string;
  created_by: { id: string; name: string };
  modified_by: { id: string; name: string };
  created_time: string;
  modified_time: string;
}

export interface ZohoCRMEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  html_body: string;
  module: string;
  folder_name: string;
  is_default: boolean;
  created_by: { id: string; name: string };
}

export interface ZohoCRMBulkOperation {
  id: string;
  operation: string;
  module: string;
  status: string;
  created_by: { id: string; name: string };
  created_time: string;
  result: { success_count: number; failed_count: number };
}

const MANIFEST: PluginManifest = {
  id: 'zoho-crm-new',
  name: 'Zoho CRM (Enhanced)',
  version: '2.0.0',
  description: 'Enhanced Zoho CRM integration with deep features for leads, contacts, deals, accounts, tasks, and notes',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['zoho', 'crm', 'sales', 'leads', 'contacts', 'deals', 'accounts', 'tasks', 'notes'],
};

const SCOPES = [
  'Leads.read', 'Leads.write', 'Leads.delete',
  'Contacts.read', 'Contacts.write', 'Contacts.delete',
  'Deals.read', 'Deals.write', 'Deals.delete',
  'Accounts.read', 'Accounts.write', 'Accounts.delete',
  'Tasks.read', 'Tasks.write', 'Tasks.delete',
  'Notes.read', 'Notes.write', 'Notes.delete',
  'Users.read', 'Modules.read', 'Fields.read',
  'CustomViews.read', 'Attachments.read', 'Attachments.write',
  'Tags.read', 'Tags.write', 'SalesOrders.read',
  'SalesOrders.write', 'Campaigns.read', 'Campaigns.write',
  'Pipelines.read', 'Reports.read', 'EmailTemplates.read',
];

export class ZohoCRMNewIntegration extends IntegrationBase {
  private apiBase = 'https://www.zohoapis.com/crm/v2';
  private orgId: string | null = null;
  private dc: string = 'com';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: [
        'lead.created', 'lead.updated', 'lead.deleted', 'lead.converted',
        'contact.created', 'contact.updated', 'contact.deleted',
        'deal.created', 'deal.updated', 'deal.deleted', 'deal.stage_changed',
        'account.created', 'account.updated', 'account.deleted',
        'task.created', 'task.updated', 'task.completed', 'task.deleted',
        'note.created', 'note.updated', 'note.deleted',
      ],
      dataModels: ['lead', 'contact', 'deal', 'account', 'task', 'note', 'user', 'module', 'field', 'customView', 'salesOrder', 'campaign', 'pipeline', 'report', 'emailTemplate'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);

    if (config.clientId) this.orgId = config.clientId;
    if (config.scopes?.length) {
      const dcScope = config.scopes.find(s => s.startsWith('dc:'));
      if (dcScope) {
        this.dc = dcScope.replace('dc:', '');
      }
    }
    this.apiBase = `https://www.zohoapis.${this.dc}/crm/v2`;

    return this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      const response = await this.apiCall<{ users: ZohoCRMUser[] }>(`${this.apiBase}/users`, {
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      });
      return !!response?.users;
    } catch {
      return false;
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = this.getHeaders();

    switch (action) {
      case 'Leads.read':
        return this.getLeads(params);
      case 'Leads.write':
        return this.createLead(params.lead as Partial<ZohoCRMLead>);
      case 'Leads.delete':
        return this.deleteLead(params.leadId as string);

      case 'Contacts.read':
        return this.getContacts(params);
      case 'Contacts.write':
        return this.createContact(params.contact as Partial<ZohoCRMContact>);
      case 'Contacts.delete':
        return this.deleteContact(params.contactId as string);

      case 'Deals.read':
        return this.getDeals(params);
      case 'Deals.write':
        return this.createDeal(params.deal as Partial<ZohoCRMDeal>);
      case 'Deals.delete':
        return this.deleteDeal(params.dealId as string);

      case 'Accounts.read':
        return this.getAccounts(params);
      case 'Accounts.write':
        return this.createAccount(params.account as Partial<ZohoCRMAccount>);
      case 'Accounts.delete':
        return this.deleteAccount(params.accountId as string);

      case 'Tasks.read':
        return this.getTasks(params);
      case 'Tasks.write':
        return this.createTask(params.task as Partial<ZohoCRMTask>);
      case 'Tasks.delete':
        return this.deleteTask(params.taskId as string);

      case 'Notes.read':
        return this.getNotes(params);
      case 'Notes.write':
        return this.createNote(params.note as Partial<ZohoCRMNote>);
      case 'Notes.delete':
        return this.deleteNote(params.noteId as string);

      case 'Users.read':
        return this.getUsers(params);
      case 'Modules.read':
        return this.getModules();
      case 'Fields.read':
        return this.getFields(params.moduleName as string);
      case 'CustomViews.read':
        return this.getCustomViews(params.moduleName as string);
      case 'Attachments.read':
        return this.getAttachments(params.parentId as string, params.parentModule as string);
      case 'Attachments.write':
        return this.uploadAttachment(params);
      case 'Tags.read':
        return this.getTags(params.moduleName as string);
      case 'Tags.write':
        return this.createTag(params.moduleName as string, params.tagName as string);
      case 'SalesOrders.read':
        return this.getSalesOrders(params);
      case 'Campaigns.read':
        return this.getCampaigns(params);
      case 'Pipelines.read':
        return this.getPipelines();
      case 'Reports.read':
        return this.getReports(params);
      case 'EmailTemplates.read':
        return this.getEmailTemplates(params.moduleName as string);

      case 'convertLead':
        return this.convertLead(params.leadId as string, params.data as Record<string, unknown>);

      case 'searchRecords':
        return this.searchRecords(params.module as string, params.criteria as string, params.page as number, params.perPage as number);

      case 'bulkOperation':
        return this.bulkOperation(params);

      case 'getRelatedRecords':
        return this.getRelatedRecords(params.recordId as string, params.relatedModule as string, params.params as Record<string, unknown>);

      case 'updateRecord':
        return this.updateRecord(params.module as string, params.recordId as string, params.data as Record<string, unknown>);

      case 'getRecord':
        return this.getRecord(params.module as string, params.recordId as string);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async getLeads(params: Record<string, unknown>): Promise<{ data: ZohoCRMLead[]; info: { page: number; per_page: number; count: number; more_records: boolean } }> {
    const { page = 1, perPage = 20, fields, criteria, sortOrder, sortBy } = params;
    let endpoint = `${this.apiBase}/Leads?page=${page}&per_page=${perPage}`;
    if (fields) endpoint += `&fields=${fields}`;
    if (criteria) endpoint += `&criteria=${criteria}`;
    if (sortBy) endpoint += `&sort_by=${sortBy}`;
    if (sortOrder) endpoint += `&sort_order=${sortOrder}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  private async createLead(lead: Partial<ZohoCRMLead>): Promise<{ data: { code: string; details: { id: string } }[] }> {
    return this.apiCall(`${this.apiBase}/Leads`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ data: [lead] }),
    });
  }

  private async deleteLead(leadId: string): Promise<{ data: { code: string; details: { id: string } }[] }> {
    return this.apiCall(`${this.apiBase}/Leads/${leadId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }

  async convertLead(leadId: string, data: Record<string, unknown>): Promise<{ data: { Contacts: string; Potentials: string; Accounts: string }[] }> {
    return this.apiCall(`${this.apiBase}/Leads/${leadId}/actions/convert`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ data: [data] }),
    });
  }

  async getRecord(module: string, recordId: string): Promise<{ data: unknown[] }> {
    return this.apiCall(`${this.apiBase}/${module}/${recordId}`, {
      headers: this.getHeaders(),
    });
  }

  async updateRecord(module: string, recordId: string, data: Record<string, unknown>): Promise<{ data: unknown[] }> {
    return this.apiCall(`${this.apiBase}/${module}/${recordId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ data: [data] }),
    });
  }

  private async getContacts(params: Record<string, unknown>): Promise<{ data: ZohoCRMContact[]; info: { page: number; per_page: number; count: number; more_records: boolean } }> {
    const { page = 1, perPage = 20, fields, criteria, sortOrder, sortBy, accountId } = params;
    let endpoint = `${this.apiBase}/Contacts?page=${page}&per_page=${perPage}`;
    if (fields) endpoint += `&fields=${fields}`;
    if (criteria) endpoint += `&criteria=${criteria}`;
    if (sortBy) endpoint += `&sort_by=${sortBy}`;
    if (sortOrder) endpoint += `&sort_order=${sortOrder}`;
    if (accountId) endpoint += `&Account_Name=${accountId}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  private async createContact(contact: Partial<ZohoCRMContact>): Promise<{ data: { code: string; details: { id: string } }[] }> {
    return this.apiCall(`${this.apiBase}/Contacts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ data: [contact] }),
    });
  }

  private async deleteContact(contactId: string): Promise<{ data: { code: string }[] }> {
    return this.apiCall(`${this.apiBase}/Contacts/${contactId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }

  private async getDeals(params: Record<string, unknown>): Promise<{ data: ZohoCRMDeal[]; info: { page: number; per_page: number; count: number; more_records: boolean } }> {
    const { page = 1, perPage = 20, fields, criteria, sortOrder, sortBy, stage, pipeline } = params;
    let endpoint = `${this.apiBase}/Deals?page=${page}&per_page=${perPage}`;
    if (fields) endpoint += `&fields=${fields}`;
    if (criteria) endpoint += `&criteria=${criteria}`;
    if (sortBy) endpoint += `&sort_by=${sortBy}`;
    if (sortOrder) endpoint += `&sort_order=${sortOrder}`;
    if (stage) endpoint += `&Stage=${stage}`;
    if (pipeline) endpoint += `&pipeline=${pipeline}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  private async createDeal(deal: Partial<ZohoCRMDeal>): Promise<{ data: { code: string; details: { id: string } }[] }> {
    return this.apiCall(`${this.apiBase}/Deals`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ data: [deal] }),
    });
  }

  private async deleteDeal(dealId: string): Promise<{ data: { code: string }[] }> {
    return this.apiCall(`${this.apiBase}/Deals/${dealId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }

  private async getAccounts(params: Record<string, unknown>): Promise<{ data: ZohoCRMAccount[]; info: { page: number; per_page: number; count: number; more_records: boolean } }> {
    const { page = 1, perPage = 20, fields, criteria, sortOrder, sortBy, type, industry } = params;
    let endpoint = `${this.apiBase}/Accounts?page=${page}&per_page=${perPage}`;
    if (fields) endpoint += `&fields=${fields}`;
    if (criteria) endpoint += `&criteria=${criteria}`;
    if (sortBy) endpoint += `&sort_by=${sortBy}`;
    if (sortOrder) endpoint += `&sort_order=${sortOrder}`;
    if (type) endpoint += `&Account_Type=${type}`;
    if (industry) endpoint += `&Industry=${industry}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  private async createAccount(account: Partial<ZohoCRMAccount>): Promise<{ data: { code: string; details: { id: string } }[] }> {
    return this.apiCall(`${this.apiBase}/Accounts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ data: [account] }),
    });
  }

  private async deleteAccount(accountId: string): Promise<{ data: { code: string }[] }> {
    return this.apiCall(`${this.apiBase}/Accounts/${accountId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }

  private async getTasks(params: Record<string, unknown>): Promise<{ data: ZohoCRMTask[]; info: { page: number; per_page: number; count: number; more_records: boolean } }> {
    const { page = 1, perPage = 20, fields, criteria, sortOrder, sortBy, status, priority, dueDate } = params;
    let endpoint = `${this.apiBase}/Tasks?page=${page}&per_page=${perPage}`;
    if (fields) endpoint += `&fields=${fields}`;
    if (criteria) endpoint += `&criteria=${criteria}`;
    if (sortBy) endpoint += `&sort_by=${sortBy}`;
    if (sortOrder) endpoint += `&sort_order=${sortOrder}`;
    if (status) endpoint += `&Status=${status}`;
    if (priority) endpoint += `&Priority=${priority}`;
    if (dueDate) endpoint += `&Due_Date=${dueDate}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  private async createTask(task: Partial<ZohoCRMTask>): Promise<{ data: { code: string; details: { id: string } }[] }> {
    return this.apiCall(`${this.apiBase}/Tasks`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ data: [task] }),
    });
  }

  private async deleteTask(taskId: string): Promise<{ data: { code: string }[] }> {
    return this.apiCall(`${this.apiBase}/Tasks/${taskId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }

  private async getNotes(params: Record<string, unknown>): Promise<{ data: ZohoCRMNote[]; info: { page: number; per_page: number; count: number; more_records: boolean } }> {
    const { page = 1, perPage = 20, parentId, parentModule } = params;
    let endpoint = `${this.apiBase}/Notes?page=${page}&per_page=${perPage}`;
    if (parentId && parentModule) endpoint += `&parent_id=${parentId}&parent_module=${parentModule}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  private async createNote(note: Partial<ZohoCRMNote>): Promise<{ data: { code: string; details: { id: string } }[] }> {
    return this.apiCall(`${this.apiBase}/Notes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ data: [note] }),
    });
  }

  private async deleteNote(noteId: string): Promise<{ data: { code: string }[] }> {
    return this.apiCall(`${this.apiBase}/Notes/${noteId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
  }

  private async getUsers(params: Record<string, unknown>): Promise<{ users: ZohoCRMUser[] }> {
    const { page = 1, perPage = 20, type } = params;
    let endpoint = `${this.apiBase}/users?page=${page}&per_page=${perPage}`;
    if (type) endpoint += `&type=${type}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  async getModules(): Promise<{ modules: ZohoCRMModule[] }> {
    return this.apiCall(`${this.apiBase}/settings/modules`, {
      headers: this.getHeaders(),
    });
  }

  async getFields(moduleName: string): Promise<{ fields: ZohoCRMField[] }> {
    return this.apiCall(`${this.apiBase}/settings/modules/${moduleName}/fields`, {
      headers: this.getHeaders(),
    });
  }

  async getCustomViews(moduleName: string): Promise<{ custom_views: ZohoCRMCustomView[] }> {
    return this.apiCall(`${this.apiBase}/settings/modules/${moduleName}/custom_views`, {
      headers: this.getHeaders(),
    });
  }

  async getAttachments(parentId: string, parentModule: string): Promise<{ data: ZohoCRMAttachment[] }> {
    return this.apiCall(`${this.apiBase}/${parentModule}/${parentId}/attachments`, {
      headers: this.getHeaders(),
    });
  }

  private async uploadAttachment(params: Record<string, unknown>): Promise<{ data: { code: string; details: { id: string } }[] }> {
    const { parentId, parentModule, fileUrl, fileName } = params;
    return this.apiCall(`${this.apiBase}/${parentModule}/${parentId}/attachments`, {
      method: 'POST',
      headers: { ...this.getHeaders(), 'Content-Type': 'multipart/form-data' },
      body: JSON.stringify({ file_url: fileUrl, file_name: fileName }),
    });
  }

  async getTags(moduleName: string): Promise<{ tags: ZohoCRMTag[] }> {
    return this.apiCall(`${this.apiBase}/${moduleName}/tags`, {
      headers: this.getHeaders(),
    });
  }

  async createTag(moduleName: string, tagName: string): Promise<{ tags: { id: string; name: string }[] }> {
    return this.apiCall(`${this.apiBase}/${moduleName}/tags`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ tags: [{ name: tagName }] }),
    });
  }

  private async getSalesOrders(params: Record<string, unknown>): Promise<{ data: ZohoCRMSalesOrder[]; info: { page: number; per_page: number; count: number; more_records: boolean } }> {
    const { page = 1, perPage = 20, fields, criteria } = params;
    let endpoint = `${this.apiBase}/Sales_Orders?page=${page}&per_page=${perPage}`;
    if (fields) endpoint += `&fields=${fields}`;
    if (criteria) endpoint += `&criteria=${criteria}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  private async getCampaigns(params: Record<string, unknown>): Promise<{ data: ZohoCRMCampaign[]; info: { page: number; per_page: number; count: number; more_records: boolean } }> {
    const { page = 1, perPage = 20, fields, status, type } = params;
    let endpoint = `${this.apiBase}/Campaigns?page=${page}&per_page=${perPage}`;
    if (fields) endpoint += `&fields=${fields}`;
    if (status) endpoint += `&Status=${status}`;
    if (type) endpoint += `&Type=${type}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  async getPipelines(): Promise<{ pipelines: ZohoCRMPipeline[] }> {
    return this.apiCall(`${this.apiBase}/pipelines`, {
      headers: this.getHeaders(),
    });
  }

  private async getReports(params: Record<string, unknown>): Promise<{ reports: ZohoCRMReport[] }> {
    const { module } = params;
    let endpoint = `${this.apiBase}/reports`;
    if (module) endpoint += `?module=${module}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  async getEmailTemplates(moduleName?: string): Promise<{ email_templates: ZohoCRMEmailTemplate[] }> {
    let endpoint = `${this.apiBase}/email_templates`;
    if (moduleName) endpoint += `?module=${moduleName}`;
    return this.apiCall(endpoint, { headers: this.getHeaders() });
  }

  async searchRecords(module: string, criteria: string, page = 1, perPage = 20): Promise<{ data: unknown[]; info: { page: number; per_page: number; count: number; more_records: boolean } }> {
    return this.apiCall(`${this.apiBase}/${module}/search?criteria=${encodeURIComponent(criteria)}&page=${page}&per_page=${perPage}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
  }

  async getRelatedRecords(recordId: string, relatedModule: string, params: Record<string, unknown> = {}): Promise<{ data: unknown[] }> {
    const { page = 1, perPage = 20 } = params;
    return this.apiCall(`${this.apiBase}/${relatedModule}/${recordId}/related_records?page=${page}&per_page=${perPage}`, {
      headers: this.getHeaders(),
    });
  }

  async bulkOperation(params: Record<string, unknown>): Promise<{ data: ZohoCRMBulkOperation }> {
    const { operation, module, data, ids } = params;
    const payload: Record<string, unknown> = {
      data: operation === 'update' ? data : undefined,
      ids: operation === 'delete' ? ids : undefined,
    };
    return this.apiCall(`${this.apiBase}/${module}/bulk`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...payload, operation }),
    });
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    const params = { ...options };
    switch (resource) {
      case 'leads': return this.getLeads(params);
      case 'contacts': return this.getContacts(params);
      case 'deals': return this.getDeals(params);
      case 'accounts': return this.getAccounts(params);
      case 'tasks': return this.getTasks(params);
      case 'notes': return this.getNotes(params);
      case 'users': return this.getUsers(params);
      case 'modules': return this.getModules();
      case 'pipelines': return this.getPipelines();
      case 'campaigns': return this.getCampaigns(params);
      case 'salesorders': return this.getSalesOrders(params);
      case 'reports': return this.getReports(params);
      case 'email_templates': return this.getEmailTemplates();
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.orgId = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }

  getManifest(): PluginManifest {
    return MANIFEST;
  }

  getActions(): { id: string; name: string; description: string; params?: Record<string, unknown> }[] {
    return [
      { id: 'Leads.read', name: 'Get Leads', description: 'Retrieve leads with filtering and pagination' },
      { id: 'Leads.write', name: 'Create Lead', description: 'Create a new lead' },
      { id: 'Leads.delete', name: 'Delete Lead', description: 'Delete a lead' },
      { id: 'convertLead', name: 'Convert Lead', description: 'Convert lead to contact/account/deal' },
      { id: 'Contacts.read', name: 'Get Contacts', description: 'Retrieve contacts with filtering' },
      { id: 'Contacts.write', name: 'Create Contact', description: 'Create a new contact' },
      { id: 'Contacts.delete', name: 'Delete Contact', description: 'Delete a contact' },
      { id: 'Deals.read', name: 'Get Deals', description: 'Retrieve deals with pipeline filtering' },
      { id: 'Deals.write', name: 'Create Deal', description: 'Create a new deal' },
      { id: 'Deals.delete', name: 'Delete Deal', description: 'Delete a deal' },
      { id: 'Accounts.read', name: 'Get Accounts', description: 'Retrieve accounts with filtering' },
      { id: 'Accounts.write', name: 'Create Account', description: 'Create a new account' },
      { id: 'Accounts.delete', name: 'Delete Account', description: 'Delete an account' },
      { id: 'Tasks.read', name: 'Get Tasks', description: 'Retrieve tasks with filtering' },
      { id: 'Tasks.write', name: 'Create Task', description: 'Create a new task' },
      { id: 'Tasks.delete', name: 'Delete Task', description: 'Delete a task' },
      { id: 'Notes.read', name: 'Get Notes', description: 'Retrieve notes for a record' },
      { id: 'Notes.write', name: 'Create Note', description: 'Create a new note' },
      { id: 'Notes.delete', name: 'Delete Note', description: 'Delete a note' },
      { id: 'Users.read', name: 'Get Users', description: 'Retrieve CRM users' },
      { id: 'Modules.read', name: 'Get Modules', description: 'List available modules' },
      { id: 'Fields.read', name: 'Get Fields', description: 'Get field metadata for a module' },
      { id: 'CustomViews.read', name: 'Get Custom Views', description: 'List custom views for a module' },
      { id: 'Attachments.read', name: 'Get Attachments', description: 'Retrieve attachments for a record' },
      { id: 'Attachments.write', name: 'Upload Attachment', description: 'Upload attachment to a record' },
      { id: 'Tags.read', name: 'Get Tags', description: 'List tags for a module' },
      { id: 'Tags.write', name: 'Create Tag', description: 'Create a new tag' },
      { id: 'SalesOrders.read', name: 'Get Sales Orders', description: 'Retrieve sales orders' },
      { id: 'Campaigns.read', name: 'Get Campaigns', description: 'List marketing campaigns' },
      { id: 'Pipelines.read', name: 'Get Pipelines', description: 'Get deal pipeline configurations' },
      { id: 'Reports.read', name: 'Get Reports', description: 'List analytics reports' },
      { id: 'EmailTemplates.read', name: 'Get Email Templates', description: 'List email templates' },
      { id: 'searchRecords', name: 'Search Records', description: 'Search records using criteria' },
      { id: 'bulkOperation', name: 'Bulk Operation', description: 'Bulk create/update/delete records' },
      { id: 'getRelatedRecords', name: 'Get Related Records', description: 'Get related records for an entity' },
      { id: 'getRecord', name: 'Get Record', description: 'Get a single record by ID' },
      { id: 'updateRecord', name: 'Update Record', description: 'Update a record by ID' },
    ];
  }

  getTriggers(): { id: string; name: string; description: string }[] {
    return [
      { id: 'lead.created', name: 'Lead Created', description: 'Triggered when a new lead is created' },
      { id: 'lead.updated', name: 'Lead Updated', description: 'Triggered when a lead is updated' },
      { id: 'lead.deleted', name: 'Lead Deleted', description: 'Triggered when a lead is deleted' },
      { id: 'lead.converted', name: 'Lead Converted', description: 'Triggered when a lead is converted' },
      { id: 'contact.created', name: 'Contact Created', description: 'Triggered when a new contact is created' },
      { id: 'contact.updated', name: 'Contact Updated', description: 'Triggered when a contact is updated' },
      { id: 'contact.deleted', name: 'Contact Deleted', description: 'Triggered when a contact is deleted' },
      { id: 'deal.created', name: 'Deal Created', description: 'Triggered when a new deal is created' },
      { id: 'deal.updated', name: 'Deal Updated', description: 'Triggered when a deal is updated' },
      { id: 'deal.deleted', name: 'Deal Deleted', description: 'Triggered when a deal is deleted' },
      { id: 'deal.stage_changed', name: 'Deal Stage Changed', description: 'Triggered when deal stage moves' },
      { id: 'account.created', name: 'Account Created', description: 'Triggered when a new account is created' },
      { id: 'account.updated', name: 'Account Updated', description: 'Triggered when an account is updated' },
      { id: 'account.deleted', name: 'Account Deleted', description: 'Triggered when an account is deleted' },
      { id: 'task.created', name: 'Task Created', description: 'Triggered when a new task is created' },
      { id: 'task.updated', name: 'Task Updated', description: 'Triggered when a task is updated' },
      { id: 'task.completed', name: 'Task Completed', description: 'Triggered when a task is completed' },
      { id: 'task.deleted', name: 'Task Deleted', description: 'Triggered when a task is deleted' },
      { id: 'note.created', name: 'Note Created', description: 'Triggered when a note is created' },
      { id: 'note.updated', name: 'Note Updated', description: 'Triggered when a note is updated' },
      { id: 'note.deleted', name: 'Note Deleted', description: 'Triggered when a note is deleted' },
    ];
  }
}

export const zohoCRMNewPlugin = new ZohoCRMNewIntegration();
export default zohoCRMNewPlugin;