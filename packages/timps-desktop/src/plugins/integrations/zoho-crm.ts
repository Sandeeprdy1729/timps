import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface ZohoCRMContact {
  Owner: { id: string; name: string; email: string };
  Email: string;
  Last_Name: string;
  First_Name: string;
  Full_Name?: string;
  Account_Name?: { id: string; name: string };
  Title?: string;
  Department?: string;
  Phone?: string;
  Mobile?: string;
  Asst_Phone?: string;
  Fax?: string;
  Mailing_Street?: string;
  Mailing_City?: string;
  Mailing_State?: string;
  Mailing_Country?: string;
  Mailing_Zip?: string;
  Description?: string;
  id: string;
  Created_Time?: string;
  Modified_Time?: string;
}

export interface ZohoCRMAccount {
  id: string;
  Name: string;
  Shipping_Street?: string;
  Shipping_City?: string;
  Shipping_State?: string;
  Shipping_Country?: string;
  Shipping_Code?: string;
  Billing_Street?: string;
  Billing_City?: string;
  Billing_State?: string;
  Billing_Country?: string;
  Billing_Code?: string;
  Phone?: string;
  Fax?: string;
  Website?: string;
  Description?: string;
}

export interface ZohoCRMPotential {
  id: string;
  Potential_Name: string;
  Account_Name?: { id: string; name: string };
  Potential_Stage: string;
  Amount?: number;
  Probability?: number;
  Expected_Revenue?: number;
  Close_Date?: string;
  Type?: string;
  Lead_Source?: string;
  Next_Step?: string;
  Description?: string;
}

export interface ZohoCRMLead {
  id: string;
  First_Name: string;
  Last_Name: string;
  Company: string;
  Email: string;
  Phone?: string;
  Mobile?: string;
  Lead_Source?: string;
  Lead_Status?: string;
  Industry?: string;
  Annual_Revenue?: number;
  Number_of_Employees?: string;
  Rating?: string;
  Title?: string;
  Street?: string;
  City?: string;
  State?: string;
  Country?: string;
  Zip_Code?: string;
}

export interface ZohoCRMTask {
  id: string;
  Subject: string;
  Status?: string;
  Priority?: string;
  Due_Date?: string;
  Reminder_Time?: string;
  Description?: string;
  What_Id?: { id: string; name: string };
  Who_Id?: { id: string; name: string };
}

export interface ZohoCRMEvent {
  id: string;
  Subject: string;
  Start_DateTime?: string;
  End_DateTime?: string;
  Venue?: string;
  Description?: string;
  Reminder_Time?: string;
  Participants?: { id: string; name: string; email: string }[];
}

export interface ZohoCRMCampaign {
  id: string;
  Campaign_Name: string;
  Campaign_Status?: string;
  Campaign_Type?: string;
  Start_Date?: string;
  End_Date?: string;
  Expected_Revenue?: number;
  Budget_Cost?: number;
  Actual_Cost?: number;
  Number_of_Leads?: number;
  Description?: string;
}

export interface ZohoCRMUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: { id: string; name: string };
  profile: { id: string; name: string };
  timezone?: string;
  date_format?: string;
  language?: string;
}

export interface ZohoCRMModule {
  name: string;
  label: string;
  plural: string;
}

export interface ZohoCRMCustomView {
  id: string;
  name: string;
  module: string;
  fields: string[];
  criteria?: { field: string; comparator: string; value: string };
  order_by?: { field: string; sort: string };
}

export interface ZohoCRMInventoryItem {
  id: string;
  Product_Name: string;
  Product_Code?: string;
  Unit_Price?: number;
  Qty_in_Stock?: number;
  Qty_Ordered?: number;
  Description?: string;
}

const MANIFEST: PluginManifest = {
  id: 'zoho-crm',
  name: 'Zoho CRM',
  version: '1.0.0',
  description: 'Zoho CRM integration for managing contacts, accounts, deals, leads, and activities',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['zoho', 'crm', 'sales', 'crm'],
};

const SCOPES = [
  'getContacts',
  'getContact',
  'createContact',
  'updateContact',
  'deleteContact',
  'getAccounts',
  'getAccount',
  'createAccount',
  'updateAccount',
  'deleteAccount',
  'getPotentials',
  'getPotential',
  'createPotential',
  'updatePotential',
  'deletePotential',
  'getLeads',
  'getLead',
  'createLead',
  'updateLead',
  'deleteLead',
  'convertLead',
  'getTasks',
  'getTask',
  'createTask',
  'updateTask',
  'deleteTask',
  'getEvents',
  'getEvent',
  'createEvent',
  'updateEvent',
  'deleteEvent',
  'getCampaigns',
  'getCampaign',
  'createCampaign',
  'updateCampaign',
  'deleteCampaign',
  'getUsers',
  'getUser',
  'getModules',
  'getRecords',
  'createRecord',
  'updateRecord',
  'deleteRecord',
  'searchRecords',
  'uploadPhoto',
  'deletePhoto',
  'getAttachments',
  'uploadAttachment',
  'deleteAttachment',
  'getTags',
  'createTag',
  'deleteTag',
];

export default class ZohoCRMIntegration extends IntegrationBase {
  private apiBase = 'https://www.zohoapis.com/crm/v2';
  private orgId: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['contact_created', 'contact_updated', 'account_created', 'deal_created', 'lead_created', 'lead_converted', 'task_completed'],
      dataModels: ['contact', 'account', 'potential', 'lead', 'task', 'event', 'campaign', 'user', 'module'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken || !config.clientId) {
      throw new Error('Access token and client ID are required');
    }
    this.setAccessToken(config.accessToken);
    this.orgId = config.clientId;

    try {
      const user = await this.apiCall<ZohoCRMUser>(`${this.apiBase}/users`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return !!user;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/users`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (action) {
      case 'getContacts':
        return this.apiCall<{ data: ZohoCRMContact[] }>(`${this.apiBase}/Contacts`, {
          headers,
        });

      case 'getContact':
        return this.apiCall<{ data: ZohoCRMContact[] }>(`${this.apiBase}/Contacts/${params.contactId}`, {
          headers,
        });

      case 'createContact':
        return this.apiCall<{ data: ZohoCRMContact[] }>(`${this.apiBase}/Contacts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: [params.contact] }),
        });

      case 'updateContact':
        return this.apiCall<{ data: ZohoCRMContact[] }>(`${this.apiBase}/Contacts/${params.contactId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ data: [params.updates] }),
        });

      case 'deleteContact':
        return this.apiCall<{ data: { code: string; details: { id: string } }[] }>(
          `${this.apiBase}/Contacts/${params.contactId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getAccounts':
        return this.apiCall<{ data: ZohoCRMAccount[] }>(`${this.apiBase}/Accounts`, {
          headers,
        });

      case 'getAccount':
        return this.apiCall<{ data: ZohoCRMAccount[] }>(
          `${this.apiBase}/Accounts/${params.accountId}`,
          { headers }
        );

      case 'createAccount':
        return this.apiCall<{ data: ZohoCRMAccount[] }>(`${this.apiBase}/Accounts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: [params.account] }),
        });

      case 'updateAccount':
        return this.apiCall<{ data: ZohoCRMAccount[] }>(
          `${this.apiBase}/Accounts/${params.accountId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ data: [params.updates] }),
          }
        );

      case 'deleteAccount':
        return this.apiCall<{ data: { code: string }[] }>(
          `${this.apiBase}/Accounts/${params.accountId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getPotentials':
        return this.apiCall<{ data: ZohoCRMPotential[] }>(`${this.apiBase}/Potentials`, {
          headers,
        });

      case 'getPotential':
        return this.apiCall<{ data: ZohoCRMPotential[] }>(
          `${this.apiBase}/Potentials/${params.potentialId}`,
          { headers }
        );

      case 'createPotential':
        return this.apiCall<{ data: ZohoCRMPotential[] }>(`${this.apiBase}/Potentials`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: [params.potential] }),
        });

      case 'updatePotential':
        return this.apiCall<{ data: ZohoCRMPotential[] }>(
          `${this.apiBase}/Potentials/${params.potentialId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ data: [params.updates] }),
          }
        );

      case 'deletePotential':
        return this.apiCall<{ data: { code: string }[] }>(
          `${this.apiBase}/Potentials/${params.potentialId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getLeads':
        return this.apiCall<{ data: ZohoCRMLead[] }>(`${this.apiBase}/Leads`, { headers });

      case 'getLead':
        return this.apiCall<{ data: ZohoCRMLead[] }>(`${this.apiBase}/Leads/${params.leadId}`, {
          headers,
        });

      case 'createLead':
        return this.apiCall<{ data: ZohoCRMLead[] }>(`${this.apiBase}/Leads`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: [params.lead] }),
        });

      case 'updateLead':
        return this.apiCall<{ data: ZohoCRMLead[] }>(`${this.apiBase}/Leads/${params.leadId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ data: [params.updates] }),
        });

      case 'deleteLead':
        return this.apiCall<{ data: { code: string }[] }>(`${this.apiBase}/Leads/${params.leadId}`, {
          method: 'DELETE',
          headers,
        });

      case 'convertLead':
        return this.apiCall<{ data: { Contacts: string; Potentials: string; Accounts: string }[] }>(
          `${this.apiBase}/Leads/${params.leadId}/actions/convert`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ data: [params.data] }),
          }
        );

      case 'getTasks':
        return this.apiCall<{ data: ZohoCRMTask[] }>(`${this.apiBase}/Tasks`, { headers });

      case 'getTask':
        return this.apiCall<{ data: ZohoCRMTask[] }>(`${this.apiBase}/Tasks/${params.taskId}`, {
          headers,
        });

      case 'createTask':
        return this.apiCall<{ data: ZohoCRMTask[] }>(`${this.apiBase}/Tasks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: [params.task] }),
        });

      case 'updateTask':
        return this.apiCall<{ data: ZohoCRMTask[] }>(`${this.apiBase}/Tasks/${params.taskId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ data: [params.updates] }),
        });

      case 'deleteTask':
        return this.apiCall<{ data: { code: string }[] }>(
          `${this.apiBase}/Tasks/${params.taskId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getEvents':
        return this.apiCall<{ data: ZohoCRMEvent[] }>(`${this.apiBase}/Events`, { headers });

      case 'getEvent':
        return this.apiCall<{ data: ZohoCRMEvent[] }>(
          `${this.apiBase}/Events/${params.eventId}`,
          { headers }
        );

      case 'createEvent':
        return this.apiCall<{ data: ZohoCRMEvent[] }>(`${this.apiBase}/Events`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: [params.event] }),
        });

      case 'getCampaigns':
        return this.apiCall<{ data: ZohoCRMCampaign[] }>(`${this.apiBase}/Campaigns`, {
          headers,
        });

      case 'getCampaign':
        return this.apiCall<{ data: ZohoCRMCampaign[] }>(
          `${this.apiBase}/Campaigns/${params.campaignId}`,
          { headers }
        );

      case 'createCampaign':
        return this.apiCall<{ data: ZohoCRMCampaign[] }>(`${this.apiBase}/Campaigns`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: [params.campaign] }),
        });

      case 'getUsers':
        return this.apiCall<{ users: ZohoCRMUser[] }>(`${this.apiBase}/users`, { headers });

      case 'getModules':
        return this.apiCall<{ modules: ZohoCRMModule[] }>(`${this.apiBase}/settings/modules`, {
          headers,
        });

      case 'searchRecords':
        return this.apiCall<{ data: unknown[] }>(`${this.apiBase}/${params.module}/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ criteria: params.criteria }),
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'contacts':
        return this.executeAction('getContacts', options || {});
      case 'accounts':
        return this.executeAction('getAccounts', options || {});
      case 'potentials':
        return this.executeAction('getPotentials', options || {});
      case 'leads':
        return this.executeAction('getLeads', options || {});
      case 'tasks':
        return this.executeAction('getTasks', options || {});
      case 'campaigns':
        return this.executeAction('getCampaigns', options || {});
      case 'users':
        return this.executeAction('getUsers', options || {});
      case 'modules':
        return this.executeAction('getModules', options || {});
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.orgId = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createZohoCRMIntegration(): ZohoCRMIntegration {
  return new ZohoCRMIntegration();
}