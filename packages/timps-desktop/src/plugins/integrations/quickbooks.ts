import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface QuickBooksInvoice {
  Id: string;
  DocNumber: string;
  CustomerRef: { value: string; name?: string };
  line: QuickBooksLine[];
  balance: number;
  totalAmt: number;
  dueDate?: string;
  docStatus?: QuickBooksDocumentStatus;
}

export interface QuickBooksLine {
  Id?: string;
  Amount: number;
  Description?: string;
  DetailType: 'SalesItemLineDetail' | 'DiscountLineDetail';
  SalesItemLineDetail?: { ItemRef: { value: string } };
}

export interface QuickBooksDocumentStatus {
  value: string;
}

export interface QuickBooksCustomer {
  Id: string;
  DisplayName: string;
  companyName?: string;
  primaryEmailAddr?: QuickBooksEmailAddress;
  primaryPhone?: QuickBooksPhoneNumber;
  addresses?: QuickBooksAddress[];
}

export interface QuickBooksEmailAddress {
  Address: string;
}

export interface QuickBooksPhoneNumber {
  FreeFormNumber: string;
}

export interface QuickBooksAddress {
  Line1: string;
  City: string;
  CountrySubDivisionCode: string;
  PostalCode: string;
}

export interface QuickBooksVendor {
  Id: string;
  DisplayName: string;
  companyName?: string;
  email?: QuickBooksEmailAddress;
}

export interface QuickBooksItem {
  Id: string;
  Name: string;
  Type: 'Inventory' | 'NonInventory' | 'Service';
  qtyOnHand?: number;
  unitPrice?: number;
  incomeAccountRef?: { value: string };
}

export interface QuickBooksAccount {
  Id: string;
  Name: string;
  AccountType: 'Bank' | 'Credit Card' | 'Other Current Asset' | 'Fixed Asset' | 'Equity' | 'Income' | 'Other Income' | 'Expense' | 'Other Expense';
  currentBalance?: number;
}

export interface QuickBooksPayment {
  Id: string;
  CustomerRef: { value: string };
  TotalAmt: number;
  privateNote?: string;
}

export interface QuickBooksBill {
  Id: string;
  VendorRef: { value: string };
  line: QuickBooksBillLine[];
  dueDate?: string;
  balance: number;
}

export interface QuickBooksBillLine {
  Amount: number;
  Description?: string;
  DetailType: 'ItemBasedExpenseLineDetail' | 'AccountBasedExpenseLineDetail';
}

export interface PurchaseOrder {
  Id: string;
  VendorRef: { value: string };
  line: QuickBooksBillLine[];
  totalAmt: number;
}

const MANIFEST: PluginManifest = {
  id: 'quickbooks',
  name: 'QuickBooks Online',
  version: '1.0.0',
  description: 'QuickBooks Online integration for invoicing, accounting, and financial management',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['quickbooks', 'accounting', 'invoicing', 'finance'],
};

const SCOPES = [
  'getInvoice',
  'getInvoices',
  'createInvoice',
  'updateInvoice',
  'deleteInvoice',
  'sendInvoice',
  'getCustomer',
  'getCustomers',
  'createCustomer',
  'updateCustomer',
  'deleteCustomer',
  'getVendor',
  'getVendors',
  'createVendor',
  'updateVendor',
  'deleteVendor',
  'getItem',
  'getItems',
  'createItem',
  'updateItem',
  'deleteItem',
  'getAccount',
  'getAccounts',
  'getPayment',
  'getPayments',
  'createPayment',
  'getBill',
  'getBills',
  'createBill',
  'updateBill',
  'deleteBill',
  'getPurchaseOrder',
  'getPurchaseOrders',
  'createPurchaseOrder',
  'getEstimate',
  'getEstimates',
  'createEstimate',
  'updateEstimate',
  'createEstimate',
  'sendEstimate',
  'getCompanyInfo',
  'getReports',
  'queryData',
];

export default class QuickBooksIntegration extends IntegrationBase {
  private apiBase = 'https://quickbooks.api.intuit.com/v3';
  private realmId: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['invoice_created', 'invoice_sent', 'invoice_paid', 'customer_created'],
      dataModels: ['invoice', 'customer', 'vendor', 'item', 'account', 'payment', 'bill'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken || !config.clientId) {
      throw new Error('Access token and realm ID are required');
    }
    this.setAccessToken(config.accessToken);
    this.realmId = config.clientId;

    try {
      const company = await this.getCompanyInfo();
      return !!company.CompanyName;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken || !this.realmId) return false;
    try {
      await this.getCompanyInfo();
      return true;
    } catch {
      return false;
    }
  }

  private async getCompanyInfo(): Promise<{ CompanyName: string }> {
    return this.apiCall(`${this.apiBase}/company/${this.realmId}/companyinfo/${this.realmId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
    });
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken || !this.realmId) throw new Error('Not authenticated');

    const endpoint = `${this.apiBase}/company/${this.realmId}`;
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getInvoices':
        return this.apiCall<{ Invoice: QuickBooksInvoice[] }>(`${endpoint}/query`, {
          headers,
        });

      case 'getInvoice':
        return this.apiCall<QuickBooksInvoice>(`${endpoint}/invoice/${params.invoiceId}`, {
          headers,
        });

      case 'createInvoice':
        return this.apiCall<QuickBooksInvoice>(`${endpoint}/invoice`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.invoice),
        });

      case 'updateInvoice':
        return this.apiCall<QuickBooksInvoice>(`${endpoint}/invoice`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.invoice),
        });

      case 'sendInvoice':
        return this.apiCall(`${endpoint}/invoice/${params.invoiceId}/send?sendTo=${params.email}`, {
          method: 'POST',
          headers,
        });

      case 'getCustomers':
        return this.apiCall<{ Customer: QuickBooksCustomer[] }>(`${endpoint}/query`, {
          headers,
        });

      case 'getCustomer':
        return this.apiCall<QuickBooksCustomer>(`${endpoint}/customer/${params.customerId}`, {
          headers,
        });

      case 'createCustomer':
        return this.apiCall<QuickBooksCustomer>(`${endpoint}/customer`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.customer),
        });

      case 'updateCustomer':
        return this.apiCall<QuickBooksCustomer>(`${endpoint}/customer`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.customer),
        });

      case 'getVendors':
        return this.apiCall<{ Vendor: QuickBooksVendor[] }>(`${endpoint}/query`, {
          headers,
        });

      case 'getVendor':
        return this.apiCall<QuickBooksVendor>(`${endpoint}/vendor/${params.vendorId}`, {
          headers,
        });

      case 'createVendor':
        return this.apiCall<QuickBooksVendor>(`${endpoint}/vendor`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.vendor),
        });

      case 'getItems':
        return this.apiCall<{ Item: QuickBooksItem[] }>(`${endpoint}/query`, {
          headers,
        });

      case 'getItem':
        return this.apiCall<QuickBooksItem>(`${endpoint}/item/${params.itemId}`, {
          headers,
        });

      case 'createItem':
        return this.apiCall<QuickBooksItem>(`${endpoint}/item`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.item),
        });

      case 'getAccounts':
        return this.apiCall<{ Account: QuickBooksAccount[] }>(`${endpoint}/query`, {
          headers,
        });

      case 'getPayments':
        return this.apiCall<{ Payment: QuickBooksPayment[] }>(`${endpoint}/query`, {
          headers,
        });

      case 'createPayment':
        return this.apiCall<QuickBooksPayment>(`${endpoint}/payment`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.payment),
        });

      case 'getBills':
        return this.apiCall<{ Bill: QuickBooksBill[] }>(`${endpoint}/query`, {
          headers,
        });

      case 'getBill':
        return this.apiCall<QuickBooksBill>(`${endpoint}/bill/${params.billId}`, {
          headers,
        });

      case 'createBill':
        return this.apiCall<QuickBooksBill>(`${endpoint}/bill`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.bill),
        });

      case 'getPurchaseOrders':
        return this.apiCall<{ PurchaseOrder: PurchaseOrder[] }>(`${endpoint}/query`, {
          headers,
        });

      case 'getPurchaseOrder':
        return this.apiCall<PurchaseOrder>(`${endpoint}/purchaseorder/${params.poId}`, {
          headers,
        });

      case 'getPurchaseOrders':
        return this.apiCall<PurchaseOrder>(`${endpoint}/purchaseorder`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.purchaseorder),
        });

      case 'queryData':
        return this.apiCall(`${endpoint}/query`, {
          method: 'GET',
          headers,
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'invoices':
        return this.executeAction('getInvoices', options || {});
      case 'customers':
        return this.executeAction('getCustomers', options || {});
      case 'vendors':
        return this.executeAction('getVendors', options || {});
      case 'items':
        return this.executeAction('getItems', options || {});
      case 'accounts':
        return this.executeAction('getAccounts', options || {});
      case 'payments':
        return this.executeAction('getPayments', options || {});
      case 'bills':
        return this.executeAction('getBills', options || {});
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.realmId = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createQuickBooksIntegration(): QuickBooksIntegration {
  return new QuickBooksIntegration();
}