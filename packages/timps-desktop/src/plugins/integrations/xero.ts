import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
  Phones?: Array<{ PhoneType: string; PhoneNumber: string }>;
  Addresses?: Array<{ AddressType: string; AddressLine1: string; City: string; PostalCode: string }>;
}

export interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Contact: { ContactID: string };
  Line: XeroLineItem[];
  Status: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  Total: number;
  DueDateString?: string;
}

export interface XeroLineItem {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  AccountCode: string;
}

export interface XeroBill {
  InvoiceID: string;
  Contact: { ContactID: string };
  Line: XeroLineItem[];
  Type: 'ACCPAY';
  Status: string;
}

export interface XeroBankTransaction {
  BankTransactionID: string;
  Type: 'RECEIVE' | 'SPEND';
  Contact: { ContactID: string };
  LineItems: XeroLineItem[];
  Status: string;
  Total: number;
}

export interface XeroAccount {
  AccountID: string;
  Name: string;
  Type: 'BANK' | 'CURRENT' | 'FIXED' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  BankAccountType?: string;
  EnablePaymentsToAccount?: boolean;
  ShowInExpenseClaims?: boolean;
}

export interface XeroTrackingCategory {
  TrackingCategoryID: string;
  Name: string;
  Options: Array<{ TrackingOptionID: string; Name: string }>;
}

export interface XeroEmployee {
  EmployeeID: string;
  FirstName: string;
  LastName: string;
  Email?: string;
}

const MANIFEST: PluginManifest = {
  id: 'xero',
  name: 'Xero',
  version: '1.0.0',
  description: 'Xero accounting integration for invoicing, bills, bank transactions, and contacts',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['xero', 'accounting', 'invoicing', 'finance', 'banking'],
};

const SCOPES = [
  'getContacts', 'createContact', 'updateContact', 'getInvoices', 'createInvoice', 'updateInvoice',
  'getBills', 'createBill', 'updateBill', 'getBankTransactions', 'createBankTransaction',
  'getAccounts', 'createAccount', 'updateAccount', 'getTrackingCategories', 'createTrackingCategory',
  'getEmployees', 'createEmployee', 'getOrganisation', 'getSettings', 'getCurrencies', 'getTaxRates',
  'getRepeatingInvoices', 'getCreditNotes', 'createCreditNote', 'getQuotes', 'createQuote',
  'approveQuote', 'getPrepayments', 'getOverpayments', 'getBankTransfers',
];

export default class XeroIntegration extends IntegrationBase {
  private apiBase = 'https://api.xero.com/api.xro/2.0';
  private tenantId: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['invoice_created', 'invoice_approved', 'invoice_paid', 'contact_created'],
      dataModels: ['contact', 'invoice', 'bill', 'bank_transaction', 'account', 'tracking_category', 'employee'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken || !config.clientId) {
      throw new Error('Access token and tenant ID are required');
    }
    this.setAccessToken(config.accessToken);
    this.tenantId = config.clientId;

    try {
      const org = await this.getOrganisation();
      return !!org.OrganisationID;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken || !this.tenantId) return false;
    try {
      await this.getOrganisation();
      return true;
    } catch { return false; }
  }

  private async getOrganisation(): Promise<{ OrganisationID: string }> {
    return this.apiCall(`${this.apiBase}/Organisation`, {
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Xero-tenant-id': this.tenantId || '' },
    });
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken || !this.tenantId) throw new Error('Not authenticated');
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Xero-tenant-id': this.tenantId, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getContacts':
      case 'createContact':
      case 'updateContact':
        return this.apiCall(`${this.apiBase}/Contacts`, action.includes('get') ? { headers } : { method: 'POST', headers, body: JSON.stringify(params.contact) });
      case 'getInvoices': return this.apiCall(`${this.apiBase}/Invoices`, { headers });
      case 'createInvoice': return this.apiCall(`${this.apiBase}/Invoices`, { method: 'POST', headers, body: JSON.stringify(params.invoice) });
      case 'updateInvoice': return this.apiCall(`${this.apiBase}/Invoices`, { method: 'POST', headers, body: JSON.stringify(params.invoice) });
      case 'getBills': return this.apiCall(`${this.apiBase}/Invoices?Type=ACCPAY`, { headers });
      case 'createBill': return this.apiCall(`${this.apiBase}/Invoices`, { method: 'POST', headers, body: JSON.stringify(params.bill) });
      case 'getBankTransactions': return this.apiCall(`${this.apiBase}/BankTransactions`, { headers });
      case 'createBankTransaction': return this.apiCall(`${this.apiBase}/BankTransactions`, { method: 'POST', headers, body: JSON.stringify(params.transaction) });
      case 'getAccounts': return this.apiCall(`${this.apiBase}/Accounts`, { headers });
      case 'createAccount': return this.apiCall(`${this.apiBase}/Accounts`, { method: 'POST', headers, body: JSON.stringify(params.account) });
      case 'updateAccount': return this.apiCall(`${this.apiBase}/Accounts`, { method: 'POST', headers, body: JSON.stringify(params.account) });
      case 'getTrackingCategories': return this.apiCall(`${this.apiBase}/TrackingCategories`, { headers });
      case 'createTrackingCategory': return this.apiCall(`${this.apiBase}/TrackingCategories`, { method: 'POST', headers, body: JSON.stringify(params.category) });
      case 'getEmployees': return this.apiCall(`${this.apiBase}/Employees`, { headers });
      case 'createEmployee': return this.apiCall(`${this.apiBase}/Employees`, { method: 'POST', headers, body: JSON.stringify(params.employee) });
      case 'getOrganisation': return this.apiCall(`${this.apiBase}/Organisation`, { headers });
      case 'getTaxRates': return this.apiCall(`${this.apiBase}/TaxRates`, { headers });
      case 'getCurrencies': return this.apiCall(`${this.apiBase}/Currencies`, { headers });
      case 'getQuotes': return this.apiCall(`${this.apiBase}/Quotes`, { headers });
      case 'createQuote': return this.apiCall(`${this.apiBase}/Quotes`, { method: 'POST', headers, body: JSON.stringify(params.quote) });
      case 'approveQuote': return this.apiCall(`${this.apiBase}/Quotes/${params.quoteId}`, { method: 'POST', headers, body: JSON.stringify({ Status: 'APPROVED' }) });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'contacts': return this.executeAction('getContacts', options || {});
      case 'invoices': return this.executeAction('getInvoices', options || {});
      case 'bills': return this.executeAction('getBills', options || {});
      case 'accounts': return this.executeAction('getAccounts', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; this.tenantId = null; }

  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createXeroIntegration(): XeroIntegration { return new XeroIntegration(); }