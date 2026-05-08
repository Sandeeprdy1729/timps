import { IntegrationBase } from './integration-base';

export interface SquareCustomer {
  id: string;
  createdAt: string;
  updatedAt: string;
  givenName?: string;
  familyName?: string;
  companyName?: string;
  nickname?: string;
  emailAddress?: string;
  phoneNumber?: string;
  note?: string;
  address?: {
    addressLine1?: string;
    addressLine2?: string;
    locality?: string;
    administrativeDistrictLevel1?: string;
    postalCode?: string;
    country?: string;
  };
  referenceId?: string;
  groupIds?: string[];
  segmentIds?: string[];
}

export interface SquareOrder {
  id: string;
  locationId: string;
  lineItems?: SquareOrderLineItem[];
  fulfillments?: SquareFulfillment[];
  totalMoney?: { amount: number; currency: string };
  createdAt: string;
  updatedAt: string;
  state: 'OPEN' | 'COMPLETED' | 'CANCELED';
}

export interface SquareOrderLineItem {
  uid: string;
  name: string;
  quantity: string;
  basePriceMoney: { amount: number; currency: string };
  totalMoney: { amount: number; currency: string };
}

export interface SquareFulfillment {
  uid?: string;
  type: 'PICKUP' | 'DELIVERY';
  state: 'PROPOSED' | 'RESERVED' | 'PREPARED' | 'COMPLETED' | 'CANCELED';
  pickupDetails?: {
    recipient?: { displayName?: string; phoneNumber?: string; emailAddress?: string };
    expiresAt?: string;
  };
  deliveryDetails?: {
    recipient?: { displayName?: string; phoneNumber?: string; emailAddress?: string; address?: any };
    feeMoney?: { amount: number; currency: string };
  };
}

export interface SquarePayment {
  id: string;
  createdAt: string;
  updatedAt: string;
  locationId: string;
  amountMoney: { amount: number; currency: string };
  status: 'COMPLETED' | 'FAILED' | 'CANCELED' | 'PENDING';
  sourceType: 'CARD' | 'WALLET';
  cardDetails?: { card: { cardBrand: string; last4: string } };
}

export interface SquareCatalogItem {
  id: string;
  type: 'ITEM';
  itemData: {
    name: string;
    description?: string;
    categoryId?: string;
    variations: Array<{ id: string; type: 'ITEM_VARIATION' }>;
  };
}

export interface SquareCatalogVariation {
  id: string;
  type: 'ITEM_VARIATION';
  itemVariationData: {
    itemId: string;
    name: string;
    pricingType: 'FIXED_PRICING' | 'VARIABLE_PRICING';
    priceMoney?: { amount: number; currency: string };
    sku?: string;
    trackInventory?: boolean;
    inventoryAlertType?: 'NONE' | 'LOW_QUANTITY';
    inventoryAlertThreshold?: number;
  };
}

export interface SquareLocation {
  id: string;
  name: string;
  address: {
    addressLine1?: string;
    addressLine2?: string;
    locality?: string;
    administrativeDistrictLevel1?: string;
    postalCode?: string;
    country?: string;
  };
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface SquareInventoryCount {
  catalogObjectId: string;
  state: 'IN_STOCK' | 'SOLD' | 'RETURNED_BY_CUSTOMER' | 'reservedSale';
  locationId: string;
  quantity?: string;
  calculatedAt: string;
}

export interface SquareTeamMember {
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
  givenName?: string;
  familyName?: string;
  emailAddress: string;
  phoneNumber?: string;
  assignedLocations?: {
    assignmentType: 'ALL_CURRENT_AND_FUTURE_LOCATIONS' | 'ALL_CURRENT_LOCATIONS';
    locationIds?: string[];
  };
  createdAt: string;
}

export interface SquareGiftCard {
  id: string;
  type: 'DIGITAL' | 'PHYSICAL';
  state: 'ACTIVE' | 'REDEMPTED' | 'DEACTIVATED';
  balanceMoney: { amount: number; currency: string };
  createdAt: string;
}

export interface SquareWebhook {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  signatureKey?: string;
  apiVersion?: string;
}

interface SquareConfig {
  accessToken: string;
  environment: 'sandbox' | 'production';
}

export class SquarePlugin extends IntegrationBase {
  private config: SquareConfig;
  private baseHeaders: Record<string, string>;
  private locationId: string = '';

  constructor() {
    super('Square', 'square', 'Payment and POS integration');
    this.config = { environment: 'sandbox' } as SquareConfig;
  }

  setConfig(accessToken: string, environment: 'sandbox' | 'production' = 'sandbox'): void {
    this.config = { accessToken, environment };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Square-Version': '2024-01-18',
    };
  }

  private getBaseUrl(): string {
    const base = this.config.environment === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.square.com';
    return `${base}/v2`;
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async getLocations(): Promise<{ locations: SquareLocation[] }> {
    const result = await this.apiCall<{ locations: SquareLocation[] }>('GET', '/locations');
    if (result.locations.length > 0) {
      this.locationId = result.locations[0].id;
    }
    return result;
  }

  async getLocation(locationId?: string): Promise<SquareLocation> {
    const id = locationId || this.locationId;
    return this.apiCall<SquareLocation>('GET', `/locations/${id}`);
  }

  async createCustomer(customer: Partial<SquareCustomer>): Promise<SquareCustomer> {
    return this.apiCall<SquareCustomer>('POST', '/customers', customer);
  }

  async searchCustomers(query?: { filter?: any; sort?: any }): Promise<{ customers: SquareCustomer[] }> {
    return this.apiCall<{ customers: SquareCustomer[] }>('POST', '/customers/search', query || {});
  }

  async getCustomer(customerId: string): Promise<SquareCustomer> {
    return this.apiCall<SquareCustomer>('GET', `/customers/${customerId}`);
  }

  async updateCustomer(customerId: string, updates: Partial<SquareCustomer>): Promise<SquareCustomer> {
    return this.apiCall<SquareCustomer>('PUT', `/customers/${customerId}`, updates);
  }

  async deleteCustomer(customerId: string): Promise<{ customer: { id: string } }> {
    return this.apiCall<{ customer: { id: string } }>('DELETE', `/customers/${customerId}`);
  }

  async createOrder(order: { locationId: string; lineItems?: any[]; fulfillments?: any[] }): Promise<{ order: SquareOrder }> {
    return this.apiCall<{ order: SquareOrder }>('POST', '/orders', order);
  }

  async searchOrders(query?: { locationIds?: string[]; state?: string[] }): Promise<{ orders: SquareOrder[] }> {
    return this.apiCall<{ orders: SquareOrder[] }>('POST', '/orders/search', query || {});
  }

  async getOrder(orderId: string): Promise<{ order: SquareOrder }> {
    return this.apiCall<{ order: SquareOrder }>('GET', `/orders/${orderId}`);
  }

  async updateOrder(orderId: string, updates: Partial<SquareOrder>): Promise<{ order: SquareOrder }> {
    return this.apiCall<{ order: SquareOrder }>('PUT', `/orders/${orderId}`, updates);
  }

  async cancelOrder(orderId: string): Promise<{ order: SquareOrder }> {
    return this.updateOrder(orderId, { state: 'CANCELED' } as any);
  }

  async createPayment(payment: { sourceId: string; amountMoney: { amount: number; currency: string }; locationId?: string; idempotencyKey: string }): Promise<{ payment: SquarePayment }> {
    return this.apiCall<{ payment: SquarePayment }>('POST', '/payments', payment);
  }

  async getPayment(paymentId: string): Promise<{ payment: SquarePayment }> {
    return this.apiCall<{ payment: SquarePayment }>('GET', `/payments/${paymentId}`);
  }

  async listPayments(options?: { locationId?: string; beginTime?: string; endTime?: string }): Promise<{ payments: SquarePayment[] }> {
    const params = new URLSearchParams();
    if (options?.locationId) params.append('location_id', options.locationId);
    if (options?.beginTime) params.append('begin_time', options.beginTime);
    if (options?.endTime) params.append('end_time', options.endTime);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ payments: SquarePayment[] }>('GET', `/payments${query}`);
  }

  async refundPayment(paymentId: string, amount: { amount: number; currency: string }, idempotencyKey: string): Promise<{ refund: any }> {
    return this.apiCall<{ refund: any }>('POST', '/refunds', { paymentId, amountMoney: amount, idempotencyKey });
  }

  async listCatalog(): Promise<{ objects: SquareCatalogItem[] }> {
    return this.apiCall<{ objects: SquareCatalogItem[] }>('GET', '/catalog/list');
  }

  async createCatalogItem(item: Partial<SquareCatalogItem>): Promise<{ object: SquareCatalogItem }> {
    return this.apiCall<{ object: SquareCatalogItem }>('POST', '/catalog/object', item as any);
  }

  async updateCatalogItem(itemId: string, item: Partial<SquareCatalogItem>): Promise<{ object: SquareCatalogItem }> {
    return this.apiCall<{ object: SquareCatalogItem }>('POST', '/catalog/object', { id: itemId, ...item } as any);
  }

  async deleteCatalogItem(itemId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/catalog/object/${itemId}`);
  }

  async upsertCatalogItem(item: any): Promise<{ object: any }> {
    return this.apiCall<{ object: any }>('POST', '/catalog/object', item);
  }

  async getInventoryCounts(catalogObjectIds: string[], locationIds?: string[]): Promise<{ counts: SquareInventoryCount[] }> {
    return this.apiCall<{ counts: SquareInventoryCount[] }>('POST', '/inventory/counts/batch-retrieve', { catalogObjectIds, locationIds });
  }

  async adjustInventory(catalogObjectId: string, locationId: string, quantity: string, occurredAt?: string): Promise<void> {
    return this.apiCall<void>('POST', '/inventory/adjustments', { catalogObjectId, locationId, quantity, occurredAt });
  }

  async getTeamMembers(): Promise<{ teamMembers: SquareTeamMember[] }> {
    return this.apiCall<{ teamMembers: SquareTeamMember[] }>('GET', '/team-members');
  }

  async createTeamMember(member: Partial<SquareTeamMember>): Promise<{ teamMember: SquareTeamMember }> {
    return this.apiCall<{ teamMember: SquareTeamMember }>('POST', '/team-members', member);
  }

  async getTeamMember(memberId: string): Promise<{ teamMember: SquareTeamMember }> {
    return this.apiCall<{ teamMember: SquareTeamMember }>('GET', `/team-members/${memberId}`);
  }

  async updateTeamMember(memberId: string, updates: Partial<SquareTeamMember>): Promise<{ teamMember: SquareTeamMember }> {
    return this.apiCall<{ teamMember: SquareTeamMember }>('PUT', `/team-members/${memberId}`, updates);
  }

  async listGiftCards(options?: { type?: 'DIGITAL' | 'PHYSICAL'; state?: string }): Promise<{ giftCards: SquareGiftCard[] }> {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    if (options?.state) params.append('state', options.state);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ giftCards: SquareGiftCard[] }>('GET', `/gift-cards${query}`);
  }

  async createGiftCard(giftCard: { type: 'DIGITAL' | 'PHYSICAL'; locationId?: string }): Promise<{ giftCard: SquareGiftCard }> {
    return this.apiCall<{ giftCard: SquareGiftCard }>('POST', '/gift-cards', giftCard);
  }

  async createWebhook(webhook: { name: string; url: string; eventTypes: string[] }): Promise<{ webhook: SquareWebhook }> {
    return this.apiCall<{ webhook: SquareWebhook }>('POST', '/webhooks', webhook);
  }

  async listWebhooks(): Promise<{ webhooks: SquareWebhook[] }> {
    return this.apiCall<{ webhooks: SquareWebhook[] }>('GET', '/webhooks');
  }

  getManifest() {
    return {
      name: 'Square',
      id: 'square',
      description: 'Payment and POS integration',
      version: '1.0.0',
      actions: [
        { id: 'get_locations', name: 'Get Locations', description: 'List all locations' },
        { id: 'get_location', name: 'Get Location', description: 'Get location details' },
        { id: 'create_customer', name: 'Create Customer', description: 'Create a new customer' },
        { id: 'search_customers', name: 'Search Customers', description: 'Search customers' },
        { id: 'get_customer', name: 'Get Customer', description: 'Get customer details' },
        { id: 'update_customer', name: 'Update Customer', description: 'Update customer' },
        { id: 'delete_customer', name: 'Delete Customer', description: 'Delete a customer' },
        { id: 'create_order', name: 'Create Order', description: 'Create a new order' },
        { id: 'search_orders', name: 'Search Orders', description: 'Search orders' },
        { id: 'get_order', name: 'Get Order', description: 'Get order details' },
        { id: 'update_order', name: 'Update Order', description: 'Update order' },
        { id: 'cancel_order', name: 'Cancel Order', description: 'Cancel an order' },
        { id: 'create_payment', name: 'Create Payment', description: 'Process a payment' },
        { id: 'get_payment', name: 'Get Payment', description: 'Get payment details' },
        { id: 'list_payments', name: 'List Payments', description: 'List payments' },
        { id: 'refund_payment', name: 'Refund Payment', description: 'Refund a payment' },
        { id: 'list_catalog', name: 'List Catalog', description: 'List catalog items' },
        { id: 'create_catalog_item', name: 'Create Catalog Item', description: 'Create catalog item' },
        { id: 'update_catalog_item', name: 'Update Catalog Item', description: 'Update catalog item' },
        { id: 'delete_catalog_item', name: 'Delete Catalog Item', description: 'Delete catalog item' },
        { id: 'upsert_catalog_item', name: 'Upsert Catalog Item', description: 'Create or update catalog item' },
        { id: 'get_inventory_counts', name: 'Get Inventory Counts', description: 'Get inventory counts' },
        { id: 'adjust_inventory', name: 'Adjust Inventory', description: 'Adjust inventory quantity' },
        { id: 'get_team_members', name: 'Get Team Members', description: 'List team members' },
        { id: 'create_team_member', name: 'Create Team Member', description: 'Create a team member' },
        { id: 'get_team_member', name: 'Get Team Member', description: 'Get team member details' },
        { id: 'update_team_member', name: 'Update Team Member', description: 'Update team member' },
        { id: 'list_gift_cards', name: 'List Gift Cards', description: 'List gift cards' },
        { id: 'create_gift_card', name: 'Create Gift Card', description: 'Create a gift card' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a webhook' },
        { id: 'list_webhooks', name: 'List Webhooks', description: 'List webhooks' },
      ],
      triggers: [
        { id: 'payment_completed', name: 'Payment Completed', description: 'Triggered when payment completes' },
        { id: 'payment_failed', name: 'Payment Failed', description: 'Triggered when payment fails' },
        { id: 'order_created', name: 'Order Created', description: 'Triggered when order is created' },
        { id: 'order_updated', name: 'Order Updated', description: 'Triggered when order is updated' },
        { id: 'order_completed', name: 'Order Completed', description: 'Triggered when order is completed' },
        { id: 'customer_created', name: 'Customer Created', description: 'Triggered when customer is created' },
        { id: 'customer_updated', name: 'Customer Updated', description: 'Triggered when customer is updated' },
        { id: 'inventory_updated', name: 'Inventory Updated', description: 'Triggered when inventory changes' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'accessToken', label: 'Access Token', description: 'Your Square Access Token', required: true },
          { name: 'environment', label: 'Environment', description: 'sandbox or production', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/locations',
        method: 'GET',
      },
    };
  }
}

export const squarePlugin = new SquarePlugin();