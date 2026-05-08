import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  date_created: string;
  type: string;
  status: string;
  featured: boolean;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  sale_price: string;
  manage_stock: boolean;
  stock_quantity: number;
  stock_status: string;
  categories: Array<{ id: number; name: string }>;
  tags: Array<{ id: number; name: string }>;
  images: Array<{ id: number; src: string }>;
}

export interface WooCommerceOrder {
  id: number;
  number: number;
  order_key: string;
  created_via: string;
  status: string;
  currency: string;
  date_created: string;
  total: string;
  subtotal: string;
  customer_id: number;
  customer_note: string;
  billing: WooCommerceAddress;
  shipping: WooCommerceAddress;
  line_items: WooCommerceLineItem[];
}

export interface WooCommerceAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface WooCommerceLineItem {
  id: number;
  product_id: number;
  variation_id: number;
  name: string;
  quantity: number;
  price: number;
}

export interface WooCommerceCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  billing: WooCommerceAddress;
  shipping: WooCommerceAddress;
}

export interface WooCommerceCoupon {
  id: number;
  code: string;
  amount: string;
  discount_type: string;
  description: string;
  date_expires: string;
}

const MANIFEST: PluginManifest = {
  id: 'woocommerce',
  name: 'WooCommerce',
  version: '1.0.0',
  description: 'WooCommerce e-commerce integration for products, orders, and customers',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['woocommerce', 'ecommerce', 'wordpress', 'store'],
};

const SCOPES = [
  'getProducts', 'getProduct', 'createProduct', 'updateProduct', 'deleteProduct', 'batchProducts',
  'getProductCategories', 'getProductCategory', 'createProductCategory', 'updateProductCategory', 'deleteProductCategory',
  'getProductTags', 'getProductTag', 'createProductTag', 'updateProductTag', 'deleteProductTags',
  'getProductReviews', 'getProductReview', 'createProductReview', 'deleteProductReview',
  'getOrders', 'getOrder', 'createOrder', 'updateOrder', 'deleteOrder', 'batchOrders',
  'getOrderNotes', 'createOrderNote', 'deleteOrderNote',
  'getOrderRefunds', 'createOrderRefund', 'deleteOrderRefunds',
  'getCustomers', 'getCustomer', 'createCustomer', 'updateCustomer', 'deleteCustomer', 'batchCustomers',
  'getCoupons', 'getCoupon', 'createCoupon', 'updateCoupon', 'deleteCoupon',
  'getShippingZones', 'getShippingZoneMethods', 'getShippingZoneLocations',
  'getTaxRates', 'getTaxClasses', 'createTaxRate',
  'getWebhooks', 'createWebhook', 'deleteWebhook',
  'getSystemStatus', 'getSystemStatusTools',
  'getSettings', 'getSettingsGeneral', 'getSettingsProducts', 'getSettingsShipping', 'getSettingsPayment',
  'updateSettings', 'batchSettings',
  'getPaymentGateways', 'updatePaymentGateway',
  'getShippingMethods', 'updateShippingMethod',
  'getData', 'getDataCountries', 'getDataContinents', 'getDataCurrencies',
];

export default class WooCommerceIntegration extends IntegrationBase {
  private apiBase = '';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['product_created', 'product_updated', 'order_created', 'order_updated', 'customer_created'],
      dataModels: ['product', 'order', 'customer', 'coupon', 'category', 'review'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken || !config.clientId) {
      throw new Error('Consumer key and secret required');
    }
    this.setAccessToken(config.accessToken);
    this.apiBase = `https://${config.clientId}/wp-json/wc/v3`;
    try { return true; } catch { return false; }
  }

  async testConnection(): Promise<boolean> { return this.isAuthenticated(); }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { 'Authorization': `Basic ${Buffer.from(`${params.consumerKey}:${params.consumerSecret}`).toString('base64')}`, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getProducts':
        return this.apiCall<{ products: WooCommerceProduct[] }>(`${this.apiBase}/products`, { headers });
      case 'getProduct':
        return this.apiCall<WooCommerceProduct>(`${this.apiBase}/products/${params.productId}`, { headers });
      case 'createProduct':
        return this.apiCall<WooCommerceProduct>(`${this.apiBase}/products`, { method: 'POST', headers, body: JSON.stringify(params.product) });
      case 'updateProduct':
        return this.apiCall<WooCommerceProduct>(`${this.apiBase}/products/${params.productId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'deleteProduct':
        return this.apiCall(`${this.apiBase}/products/${params.productId}`, { method: 'DELETE', headers });
      case 'batchProducts':
        return this.apiCall(`${this.apiBase}/products/batch`, { method: 'POST', headers, body: JSON.stringify(params.batch) });
      case 'getProductCategories':
        return this.apiCall(`${this.apiBase}/products/categories`, { headers });
      case 'createProductCategory':
        return this.apiCall(`${this.apiBase}/products/categories`, { method: 'POST', headers, body: JSON.stringify(params.category) });
      case 'getOrders':
        return this.apiCall<{ orders: WooCommerceOrder[] }>(`${this.apiBase}/orders`, { headers });
      case 'getOrder':
        return this.apiCall<WooCommerceOrder>(`${this.apiBase}/orders/${params.orderId}`, { headers });
      case 'createOrder':
        return this.apiCall<WooCommerceOrder>(`${this.apiBase}/orders`, { method: 'POST', headers, body: JSON.stringify(params.order) });
      case 'updateOrder':
        return this.apiCall<WooCommerceOrder>(`${this.apiBase}/orders/${params.orderId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'deleteOrder':
        return this.apiCall(`${this.apiBase}/orders/${params.orderId}`, { method: 'DELETE', headers });
      case 'getOrderNotes':
        return this.apiCall(`${this.apiBase}/orders/${params.orderId}/notes`, { headers });
      case 'createOrderNote':
        return this.apiCall(`${this.apiBase}/orders/${params.orderId}/notes`, { method: 'POST', headers, body: JSON.stringify(params.note) });
      case 'getCustomers':
        return this.apiCall<{ customers: WooCommerceCustomer[] }>(`${this.apiBase}/customers`, { headers });
      case 'getCustomer':
        return this.apiCall<WooCommerceCustomer>(`${this.apiBase}/customers/${params.customerId}`, { headers });
      case 'createCustomer':
        return this.apiCall<WooCommerceCustomer>(`${this.apiBase}/customers`, { method: 'POST', headers, body: JSON.stringify(params.customer) });
      case 'updateCustomer':
        return this.apiCall<WooCommerceCustomer>(`${this.apiBase}/customers/${params.customerId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'deleteCustomer':
        return this.apiCall(`${this.apiBase}/customers/${params.customerId}`, { method: 'DELETE', headers });
      case 'getCoupons':
        return this.apiCall<{ coupons: WooCommerceCoupon[] }>(`${this.apiBase}/coupons`, { headers });
      case 'createCoupon':
        return this.apiCall<WooCommerceCoupon>(`${this.apiBase}/coupons`, { method: 'POST', headers, body: JSON.stringify(params.coupon) });
      case 'getWebhooks':
        return this.apiCall(`${this.apiBase}/webhooks`, { headers });
      case 'createWebhook':
        return this.apiCall(`${this.apiBase}/webhooks`, { method: 'POST', headers, body: JSON.stringify(params.webhook) });
      case 'getShippingZones':
        return this.apiCall(`${this.apiBase}/shipping/zones`, { headers });
      case 'getTaxRates':
        return this.apiCall(`${this.apiBase}/taxes/classes`, { headers });
      case 'getPaymentGateways':
        return this.apiCall(`${this.apiBase}/payment_gateways`, { headers });
      case 'updatePaymentGateway':
        return this.apiCall(`${this.apiBase}/payment_gateways/${params.gatewayId}`, { method: 'POST', headers, body: JSON.stringify(params.updates) });
      case 'getSystemStatus':
        return this.apiCall(`${this.apiBase}/system_status`, { headers });
      case 'getSettings':
        return this.apiCall(`${this.apiBase}/settings`, { headers });
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'products': return this.executeAction('getProducts', options || {});
      case 'orders': return this.executeAction('getOrders', options || {});
      case 'customers': return this.executeAction('getCustomers', options || {});
      case 'coupons': return this.executeAction('getCoupons', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createWooCommerceIntegration(): WooCommerceIntegration { return new WooCommerceIntegration(); }