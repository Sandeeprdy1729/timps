import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface AmazonProduct {
  asin: string;
  title: string;
  brand: string;
  feature: string[];
  images: string[];
  price: { amount: string; currency: string };
  availability: string;
}

export interface AmazonOrder {
  amazonOrderId: string;
  sellerOrderId: string;
  purchaseDate: string;
  lastUpdateDate: string;
  orderStatus: string;
  fulfillmentChannel: string;
  salesChannel: string;
  orderChannel: string;
  shipServiceLevel: string;
  orderTotal: { amount: string; currency: string };
}

export interface AmazonInventory {
  sellerSku: string;
  fnsku: string;
  asin: string;
  condition: string;
  quantity: string;
  inventroyDetails: string;
}

export interface AmazonFeed {
  feedId: string;
  feedType: string;
  marketplaceIds: string[];
  status: string;
  createdTime: string;
}

const MANIFEST: PluginManifest = {
  id: 'amazon-selling',
  name: 'Amazon Selling Partner API',
  version: '1.0.0',
  description: 'Amazon Selling Partner API integration for inventory, orders, and products',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['amazon', 'selling', 'ecommerce', 'spapi'],
};

const SCOPES = [
  'getOrders', 'getOrder', 'updateOrderItems', 'getOrderAddresses', 'getOrderBuyerInfo', 'getOrderItems', 'getOrderItemsBuyerInfo',
  'getInventorySummaries', 'getInventoryDetails', 'getInventoryItems', 'updateInventory', 'adjustInventory', 'listInventorySupply',
  'getProducts', 'getProduct', 'getProductPricing', 'getProductCategories', 'getProductOffers', 'getCatalogItem',
  'getFeeds', 'createFeed', 'getFeed', 'cancelFeed', 'getFeedDocument', 'createFeedDocument',
  'getReports', 'createReport', 'getReport', 'cancelReport',
  'getFbaInventory', 'getInventoryAging', 'getInventoryAgingSummary',
  'getInboundShipments', 'createInboundShipment', 'updateInboundShipment', 'getInboundShipmentItems',
  'getOutboundShipments', 'createOutboundShipment', 'updateOutboundShipment', 'getOutboundShipmentItems',
  'getNotifications', 'createNotification', 'getNotification', 'deleteNotification',
  'getFinancialEvents', 'getPlacementEvents', 'getRemovalEvents',
  'getAmazonParticipantDetails', 'getAmazonParticipantProfile',
  'getSellerProfile', 'getMarketplaceParticipation', 'getMarketplaces',
  'getServiceStatus', 'getAuthorizationCode',
];

export default class AmazonSellingIntegration extends IntegrationBase {
  private apiBase = 'https://sellingpartnerapi-na.amazon.com';
  private marketplaceId: string = 'ATVPDKIKX0DER';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['order_created', 'order_shipped', 'inventory_updated'],
      dataModels: ['order', 'product', 'inventory', 'feed', 'report', 'shipment'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken || !config.clientId) {
      throw new Error('Access token and client ID required');
    }
    this.setAccessToken(config.accessToken);
    try {
      return true;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    return this.isAuthenticated();
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getOrders':
        return this.apiCall(`${this.apiBase}/orders/v0/orders`, { headers });
      case 'getOrder':
        return this.apiCall(`${this.apiBase}/orders/v0/orders/${params.orderId}`, { headers });
      case 'getOrderItems':
        return this.apiCall(`${this.apiBase}/orders/v0/orders/${params.orderId}/orderItems`, { headers });
      case 'getInventorySummaries':
        return this.apiCall(`${this.apiBase}/inventory/summaries`, { headers });
      case 'getProducts':
        return this.apiCall(`${this.apiBase}/catalog/v0/items`, { headers });
      case 'getProductPricing':
        return this.apiCall(`${this.apiBase}/pricing/v0/items/${params.asin}/offers`, { headers });
      case 'getFeeds':
        return this.apiCall(`${this.apiBase}/feeds/v1/feeds`, { headers });
      case 'createFeed':
        return this.apiCall(`${this.apiBase}/feeds/v1/feeds`, { method: 'POST', headers, body: JSON.stringify(params.feed) });
      case 'getReports':
        return this.apiCall(`${this.apiBase}/reports/v1/reports`, { headers });
      case 'createReport':
        return this.apiCall(`${this.apiBase}/reports/v1/reports`, { method: 'POST', headers, body: JSON.stringify(params.report) });
      case 'getInboundShipments':
        return this.apiCall(`${this.apiBase}/inbound/v0/shipments`, { headers });
      case 'createInboundShipment':
        return this.apiCall(`${this.apiBase}/inbound/v0/shipments`, { method: 'POST', headers, body: JSON.stringify(params.shipment) });
      case 'getOutboundShipments':
        return this.apiCall(`${this.apiBase}/outbound/v0/shipments`, { headers });
      case 'getFinancialEvents':
        return this.apiCall(`${this.apiBase}/finances/v0/orders/${params.orderId}/financialEvents`, { headers });
      case 'getNotifications':
        return this.apiCall(`${this.apiBase}/notifications/v1/notifications`, { headers });
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'orders': return this.executeAction('getOrders', options || {});
      case 'products': return this.executeAction('getProducts', options || {});
      case 'inventory': return this.executeAction('getInventorySummaries', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createAmazonSellingIntegration(): AmazonSellingIntegration { return new AmazonSellingIntegration(); }