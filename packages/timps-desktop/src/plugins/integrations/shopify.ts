import { IntegrationBase } from './integration-base';

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  handle: string;
  status: string;
  published_scope: string;
  tags: string;
  variants: Array<{
    id: number;
    product_id: number;
    title: string;
    price: string;
    sku: string;
    position: number;
    inventory_policy: string;
    inventory_quantity: number;
    weight: number;
    weight_unit: string;
    price: string;
  }>;
  images: Array<{ id: number; src: string; position: number }>;
  options: Array<{ id: number; name: string; position: number; values: string[] }>;
  created_at: string;
  updated_at: string;
}

export interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    variant_id: number;
    product_id: number;
  }>;
  billing_address: any;
  shipping_address: any;
  customer: any;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  default_address: any;
  addresses: any[];
  orders_count: number;
  total_spent: string;
  tags: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyCollection {
  id: number;
  title: string;
  handle: string;
  description: string;
  body_html: string;
  image: any;
  published_scope: string;
}
export interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
  updated_at: string;
}

export interface ShopifyLocation {
  id: number;
  name: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;
}

export interface ShopifyWebhook {
  id: number;
  address: string;
  topic: string;
  format: string;
  created_at: string;
}

export interface ShopifyScriptTag {
  id: number;
  src: string;
  event: string;
  display_scope: string;
  created_at: string;
}

export interface ShopifyAsset {
  key: string;
  value: string;
  content_type: string;
  size: number;
}

export interface ShopifyBlog {
  id: number;
  title: string;
  handle: string;
  tags: string;
  created_at: string;
}

export interface ShopifyArticle {
  id: number;
  title: string;
  body_html: string;
  author: string;
  blog_id: number;
  created_at: string;
  published_at: string;
}

export interface ShopifyPage {
  id: number;
  title: string;
  body_html: string;
  handle: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyRedirect {
  id: number;
  path: string;
  target: string;
}

export interface ShopifyPriceRule {
  id: number;
  title: string;
  value_type: string;
  value: string;
  allocation_method: string;
  target_selection: string;
  target_type: string;
  starts_at: string;
  ends_at: string;
}

export interface ShopifyDiscountCode {
  id: number;
  code: string;
  price_rule_id: number;
  usage_count: number;
}

export interface ShopifyCarrierService {
  id: number;
  name: string;
  url: string;
  format: string;
  callback_url: string;
}

export interface ShopifyFulfillmentService {
  id: number;
  name: string;
  email: string;
  inventory_management: string;
  callback_url: string;
}

export interface ShopifyMetafield {
  id: number;
  namespace: string;
  key: string;
  value: string;
  value_type: string;
  description: string;
  owner_id: number;
  owner_resource: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifySmartCollection {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  rules: Array<{ column: string; relation: string; condition: string }>;
}

export interface ShopifyGiftCard {
  id: number;
  code: string;
  balance: string;
  customer_id?: number;
  created_at: string;
  expires_at?: string;
}

interface ShopifyConfig {
  shopDomain: string;
  apiKey: string;
  accessToken: string;
}

export class ShopifyPlugin extends IntegrationBase {
  private config: ShopifyConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('Shopify', 'shopify', 'E-commerce platform integration');
    this.config = {} as ShopifyConfig;
  }

  setConfig(shopDomain: string, apiKey: string, accessToken: string): void {
    this.config = { shopDomain, apiKey, accessToken };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    };
  }

  private getBaseUrl(): string {
    return `https://${this.config.shopDomain}/admin/api/2024-01`;
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}.json`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async getProducts(options?: { limit?: number; status?: string }): Promise<{ products: ShopifyProduct[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ products: ShopifyProduct[] }>('GET', `/products${query}`);
  }

  async getProduct(productId: number): Promise<{ product: ShopifyProduct }> {
    return this.apiCall<{ product: ShopifyProduct }>('GET', `/products/${productId}`);
  }

  async createProduct(product: Partial<ShopifyProduct>): Promise<{ product: ShopifyProduct }> {
    return this.apiCall<{ product: ShopifyProduct }>('POST', '/products', { product });
  }

  async updateProduct(productId: number, updates: Partial<ShopifyProduct>): Promise<{ product: ShopifyProduct }> {
    return this.apiCall<{ product: ShopifyProduct }>('PUT', `/products/${productId}`, { product: updates });
  }

  async deleteProduct(productId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/products/${productId}`);
  }

  async getOrders(options?: { status?: string; limit?: number }): Promise<{ orders: ShopifyOrder[] }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ orders: ShopifyOrder[] }>('GET', `/orders${query}`);
  }

  async getOrder(orderId: number): Promise<{ order: ShopifyOrder }> {
    return this.apiCall<{ order: ShopifyOrder }>('GET', `/orders/${orderId}`);
  }

  async createOrder(order: Partial<ShopifyOrder>): Promise<{ order: ShopifyOrder }> {
    return this.apiCall<{ order: ShopifyOrder }>('POST', '/orders', { order });
  }

  async updateOrder(orderId: number, updates: Partial<ShopifyOrder>): Promise<{ order: ShopifyOrder }> {
    return this.apiCall<{ order: ShopifyOrder }>('PUT', `/orders/${orderId}`, { order: updates });
  }

  async cancelOrder(orderId: number): Promise<{ order: ShopifyOrder }> {
    return this.apiCall<{ order: ShopifyOrder }>('POST', `/orders/${orderId}/cancel`);
  }

  async closeOrder(orderId: number): Promise<{ order: ShopifyOrder }> {
    return this.apiCall<{ order: ShopifyOrder }>('POST', `/orders/${orderId}/close`);
  }

  async getCustomers(options?: { limit?: number }): Promise<{ customers: ShopifyCustomer[] }> {
    const params = options?.limit ? `?limit=${options.limit}` : '';
    return this.apiCall<{ customers: ShopifyCustomer[] }>('GET', `/customers${params}`);
  }

  async getCustomer(customerId: number): Promise<{ customer: ShopifyCustomer }> {
    return this.apiCall<{ customer: ShopifyCustomer }>('GET', `/customers/${customerId}`);
  }

  async createCustomer(customer: Partial<ShopifyCustomer>): Promise<{ customer: ShopifyCustomer }> {
    return this.apiCall<{ customer: ShopifyCustomer }>('POST', '/customers', { customer });
  }

  async updateCustomer(customerId: number, updates: Partial<ShopifyCustomer>): Promise<{ customer: ShopifyCustomer }> {
    return this.apiCall<{ customer: ShopifyCustomer }>('PUT', `/customers/${customerId}`, { customer: updates });
  }

  async deleteCustomer(customerId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/customers/${customerId}`);
  }

  async searchCustomers(query: string): Promise<{ customers: ShopifyCustomer[] }> {
    return this.apiCall<{ customers: ShopifyCustomer[] }>('GET', `/customers/search.json?query=${query}`);
  }

  async getCollections(): Promise<{ custom_collections: ShopifyCollection[] }> {
    return this.apiCall<{ custom_collections: ShopifyCollection[] }>('GET', '/custom_collections');
  }

  async getCollection(collectionId: number): Promise<{ custom_collection: ShopifyCollection }> {
    return this.apiCall<{ custom_collection: ShopifyCollection }>('GET', `/custom_collections/${collectionId}`);
  }

  async createCollection(collection: Partial<ShopifyCollection>): Promise<{ custom_collection: ShopifyCollection }> {
    return this.apiCall<{ custom_collection: ShopifyCollection }>('POST', '/custom_collections', { custom_collection: collection });
  }

  async updateCollection(collectionId: number, updates: Partial<ShopifyCollection>): Promise<{ custom_collection: ShopifyCollection }> {
    return this.apiCall<{ custom_collection: ShopifyCollection }>('PUT', `/custom_collections/${collectionId}`, { custom_collection: updates });
  }

  async deleteCollection(collectionId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/custom_collections/${collectionId}`);
  }

  async getInventoryLevels(inventoryItemIds: number[]): Promise<{ inventory_levels: ShopifyInventoryLevel[] }> {
    return this.apiCall<{ inventory_levels: ShopifyInventoryLevel[] }>('GET', `/inventory_levels.json?inventory_item_ids=${inventoryItemIds.join(',')}`);
  }

  async adjustInventory(inventoryItemId: number, locationId: number, adjustment: number): Promise<void> {
    return this.apiCall<void>('POST', '/inventory_levels/adjust', { location_id: locationId, inventory_item_id: inventoryItemId, available_adjustment: adjustment });
  }

  async setInventory(inventoryItemId: number, locationId: number, quantity: number): Promise<void> {
    return this.apiCall<void>('POST', '/inventory_levels/set', { location_id: locationId, inventory_item_id: inventoryItemId, available: quantity });
  }

  async getLocations(): Promise<{ locations: ShopifyLocation[] }> {
    return this.apiCall<{ locations: ShopifyLocation[] }>('GET', '/locations');
  }

  async getLocation(locationId: number): Promise<{ location: ShopifyLocation }> {
    return this.apiCall<{ location: ShopifyLocation }>('GET', `/locations/${locationId}`);
  }

  async getWebhooks(): Promise<{ webhooks: ShopifyWebhook[] }> {
    return this.apiCall<{ webhooks: ShopifyWebhook[] }>('GET', '/webhooks');
  }

  async createWebhook(webhook: { address: string; topic: string; format?: string }): Promise<{ webhook: ShopifyWebhook }> {
    return this.apiCall<{ webhook: ShopifyWebhook }>('POST', '/webhooks', { webhook });
  }

  async deleteWebhook(webhookId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/webhooks/${webhookId}`);
  }

  async getScriptTags(): Promise<{ script_tags: ShopifyScriptTag[] }> {
    return this.apiCall<{ script_tags: ShopifyScriptTag[] }>('GET', '/script_tags');
  }

  async createScriptTag(scriptTag: { src: string; event?: string; display_scope?: string }): Promise<{ script_tag: ShopifyScriptTag }> {
    return this.apiCall<{ script_tag: ShopifyScriptTag }>('POST', '/script_tags', { script_tag: scriptTag });
  }

  async deleteScriptTag(scriptTagId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/script_tags/${scriptTagId}`);
  }

  async getAssets(themeId: number): Promise<{ assets: ShopifyAsset[] }> {
    return this.apiCall<{ assets: ShopifyAsset[] }>('GET', `/themes/${themeId}/assets`);
  }

  async updateAsset(themeId: number, asset: { key: string; value: string }): Promise<{ asset: ShopifyAsset }> {
    return this.apiCall<{ asset: ShopifyAsset }>('PUT', `/themes/${themeId}/assets`, { asset });
  }

  async getBlogs(): Promise<{ blogs: ShopifyBlog[] }> {
    return this.apiCall<{ blogs: ShopifyBlog[] }>('GET', '/blogs');
  }

  async createBlog(blog: { title: string; handle?: string }): Promise<{ blog: ShopifyBlog }> {
    return this.apiCall<{ blog: ShopifyBlog }>('POST', '/blogs', { blog });
  }

  async getArticles(blogId: number): Promise<{ articles: ShopifyArticle[] }> {
    return this.apiCall<{ articles: ShopifyArticle[] }>('GET', `/blogs/${blogId}/articles`);
  }

  async createArticle(blogId: number, article: { title: string; body_html: string; author?: string }): Promise<{ article: ShopifyArticle }> {
    return this.apiCall<{ article: ShopifyArticle }>('POST', `/blogs/${blogId}/articles`, { article });
  }

  async getPages(): Promise<{ pages: ShopifyPage[] }> {
    return this.apiCall<{ pages: ShopifyPage[] }>('GET', '/pages');
  }

  async getPage(pageId: number): Promise<{ page: ShopifyPage }> {
    return this.apiCall<{ page: ShopifyPage }>('GET', `/pages/${pageId}`);
  }

  async createPage(page: { title: string; body_html: string; handle?: string }): Promise<{ page: ShopifyPage }> {
    return this.apiCall<{ page: ShopifyPage }>('POST', '/pages', { page });
  }

  async updatePage(pageId: number, updates: Partial<ShopifyPage>): Promise<{ page: ShopifyPage }> {
    return this.apiCall<{ page: ShopifyPage }>('PUT', `/pages/${pageId}`, { page: updates });
  }

  async deletePage(pageId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/pages/${pageId}`);
  }

  async getRedirects(): Promise<{ redirects: ShopifyRedirect[] }> {
    return this.apiCall<{ redirects: ShopifyRedirect[] }>('GET', '/redirects');
  }

  async createRedirect(redirect: { path: string; target: string }): Promise<{ redirect: ShopifyRedirect }> {
    return this.apiCall<{ redirect: ShopifyRedirect }>('POST', '/redirects', { redirect });
  }

  async deleteRedirect(redirectId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/redirects/${redirectId}`);
  }

  async getPriceRules(): Promise<{ price_rules: ShopifyPriceRule[] }> {
    return this.apiCall<{ price_rules: ShopifyPriceRule[] }>('GET', '/price_rules');
  }

  async createPriceRule(priceRule: Partial<ShopifyPriceRule>): Promise<{ price_rule: ShopifyPriceRule }> {
    return this.apiCall<{ price_rule: ShopifyPriceRule }>('POST', '/price_rules', { price_rule: priceRule });
  }

  async getDiscountCodes(priceRuleId: number): Promise<{ discount_codes: ShopifyDiscountCode[] }> {
    return this.apiCall<{ discount_codes: ShopifyDiscountCode[] }>('GET', `/price_rules/${priceRuleId}/discount_codes`);
  }

  async createDiscountCode(priceRuleId: number, code: { code: string }): Promise<{ discount_code: ShopifyDiscountCode }> {
    return this.apiCall<{ discount_code: ShopifyDiscountCode }>('POST', `/price_rules/${priceRuleId}/discount_codes`, { discount_code: code });
  }

  async getMetafields(ownerResource: string, ownerId: number): Promise<{ metafields: ShopifyMetafield[] }> {
    return this.apiCall<{ metafields: ShopifyMetafield[] }>('GET', `/metafields.json?owner_resource=${ownerResource}&owner_id=${ownerId}`);
  }

  async createMetafield(metafield: Partial<ShopifyMetafield>): Promise<{ metafield: ShopifyMetafield }> {
    return this.apiCall<{ metafield: ShopifyMetafield }>('POST', '/metafields', { metafield });
  }

  async updateMetafield(metafieldId: number, updates: Partial<ShopifyMetafield>): Promise<{ metafield: ShopifyMetafield }> {
    return this.apiCall<{ metafield: ShopifyMetafield }>('PUT', `/metafields/${metafieldId}`, { metafield: updates });
  }

  async deleteMetafield(metafieldId: number): Promise<void> {
    return this.apiCall<void>('DELETE', `/metafields/${metafieldId}`);
  }

  async getSmartCollections(): Promise<{ smart_collections: ShopifySmartCollection[] }> {
    return this.apiCall<{ smart_collections: ShopifySmartCollection[] }>('GET', '/smart_collections');
  }

  async createSmartCollection(collection: { title: string; rules?: any[] }): Promise<{ smart_collection: ShopifySmartCollection }> {
    return this.apiCall<{ smart_collection: ShopifySmartCollection }>('POST', '/smart_collections', { smart_collection: collection });
  }

  async getGiftCards(options?: { status?: string; limit?: number }): Promise<{ gift_cards: ShopifyGiftCard[] }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ gift_cards: ShopifyGiftCard[] }>('GET', `/gift_cards${query}`);
  }

  async createGiftCard(giftCard: { code: string; message?: string; value?: number }): Promise<{ gift_card: ShopifyGiftCard }> {
    return this.apiCall<{ gift_card: ShopifyGiftCard }>('POST', '/gift_cards', { gift_card: giftCard });
  }

  async getCarrierServices(): Promise<{ carrier_services: ShopifyCarrierService[] }> {
    return this.apiCall<{ carrier_services: ShopifyCarrierService[] }>('GET', '/carrier_services');
  }

  async createCarrierService(service: { name: string; url: string; format: string }): Promise<{ carrier_service: ShopifyCarrierService }> {
    return this.apiCall<{ carrier_service: ShopifyCarrierService }>('POST', '/carrier_services', { carrier_service: service });
  }

  async getFulfillmentServices(): Promise<{ fulfillment_services: ShopifyFulfillmentService[] }> {
    return this.apiCall<{ fulfillment_services: ShopifyFulfillmentService[] }>('GET', '/fulfillment_services');
  }

  async createFulfillmentService(service: { name: string; email?: string; inventory_management?: string }): Promise<{ fulfillment_service: ShopifyFulfillmentService }> {
    return this.apiCall<{ fulfillment_service: ShopifyFulfillmentService }>('POST', '/fulfillment_services', { fulfillment_service: service });
  }

  getManifest() {
    return {
      name: 'Shopify',
      id: 'shopify',
      description: 'E-commerce platform integration',
      version: '1.0.0',
      actions: [
        { id: 'get_products', name: 'Get Products', description: 'List all products' },
        { id: 'get_product', name: 'Get Product', description: 'Get product details' },
        { id: 'create_product', name: 'Create Product', description: 'Create a new product' },
        { id: 'update_product', name: 'Update Product', description: 'Update product' },
        { id: 'delete_product', name: 'Delete Product', description: 'Delete a product' },
        { id: 'get_orders', name: 'Get Orders', description: 'List all orders' },
        { id: 'get_order', name: 'Get Order', description: 'Get order details' },
        { id: 'create_order', name: 'Create Order', description: 'Create a new order' },
        { id: 'update_order', name: 'Update Order', description: 'Update order' },
        { id: 'cancel_order', name: 'Cancel Order', description: 'Cancel an order' },
        { id: 'close_order', name: 'Close Order', description: 'Close an order' },
        { id: 'get_customers', name: 'Get Customers', description: 'List all customers' },
        { id: 'get_customer', name: 'Get Customer', description: 'Get customer details' },
        { id: 'create_customer', name: 'Create Customer', description: 'Create a new customer' },
        { id: 'update_customer', name: 'Update Customer', description: 'Update customer' },
        { id: 'delete_customer', name: 'Delete Customer', description: 'Delete a customer' },
        { id: 'search_customers', name: 'Search Customers', description: 'Search customers' },
        { id: 'get_collections', name: 'Get Collections', description: 'List all collections' },
        { id: 'get_collection', name: 'Get Collection', description: 'Get collection details' },
        { id: 'create_collection', name: 'Create Collection', description: 'Create a new collection' },
        { id: 'update_collection', name: 'Update Collection', description: 'Update collection' },
        { id: 'delete_collection', name: 'Delete Collection', description: 'Delete a collection' },
        { id: 'get_inventory_levels', name: 'Get Inventory Levels', description: 'Get inventory levels' },
        { id: 'adjust_inventory', name: 'Adjust Inventory', description: 'Adjust inventory quantity' },
        { id: 'set_inventory', name: 'Set Inventory', description: 'Set inventory quantity' },
        { id: 'get_locations', name: 'Get Locations', description: 'List all locations' },
        { id: 'get_location', name: 'Get Location', description: 'Get location details' },
        { id: 'get_webhooks', name: 'Get Webhooks', description: 'List all webhooks' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a webhook' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete a webhook' },
        { id: 'get_script_tags', name: 'Get Script Tags', description: 'List script tags' },
        { id: 'create_script_tag', name: 'Create Script Tag', description: 'Create script tag' },
        { id: 'delete_script_tag', name: 'Delete Script Tag', description: 'Delete script tag' },
        { id: 'get_assets', name: 'Get Assets', description: 'Get theme assets' },
        { id: 'update_asset', name: 'Update Asset', description: 'Update theme asset' },
        { id: 'get_blogs', name: 'Get Blogs', description: 'List all blogs' },
        { id: 'create_blog', name: 'Create Blog', description: 'Create a blog' },
        { id: 'get_articles', name: 'Get Articles', description: 'List articles' },
        { id: 'create_article', name: 'Create Article', description: 'Create an article' },
        { id: 'get_pages', name: 'Get Pages', description: 'List all pages' },
        { id: 'get_page', name: 'Get Page', description: 'Get page details' },
        { id: 'create_page', name: 'Create Page', description: 'Create a page' },
        { id: 'update_page', name: 'Update Page', description: 'Update a page' },
        { id: 'delete_page', name: 'Delete Page', description: 'Delete a page' },
        { id: 'get_redirects', name: 'Get Redirects', description: 'List all redirects' },
        { id: 'create_redirect', name: 'Create Redirect', description: 'Create a redirect' },
        { id: 'delete_redirect', name: 'Delete Redirect', description: 'Delete a redirect' },
        { id: 'get_price_rules', name: 'Get Price Rules', description: 'List price rules' },
        { id: 'create_price_rule', name: 'Create Price Rule', description: 'Create a price rule' },
        { id: 'get_discount_codes', name: 'Get Discount Codes', description: 'List discount codes' },
        { id: 'create_discount_code', name: 'Create Discount Code', description: 'Create discount code' },
        { id: 'get_metafields', name: 'Get Metafields', description: 'List metafields' },
        { id: 'create_metafield', name: 'Create Metafield', description: 'Create a metafield' },
        { id: 'update_metafield', name: 'Update Metafield', description: 'Update metafield' },
        { id: 'delete_metafield', name: 'Delete Metafield', description: 'Delete metafield' },
        { id: 'get_smart_collections', name: 'Get Smart Collections', description: 'List smart collections' },
        { id: 'create_smart_collection', name: 'Create Smart Collection', description: 'Create smart collection' },
        { id: 'get_gift_cards', name: 'Get Gift Cards', description: 'List gift cards' },
        { id: 'create_gift_card', name: 'Create Gift Card', description: 'Create gift card' },
        { id: 'get_carrier_services', name: 'Get Carrier Services', description: 'List carrier services' },
        { id: 'create_carrier_service', name: 'Create Carrier Service', description: 'Create carrier service' },
        { id: 'get_fulfillment_services', name: 'Get Fulfillment Services', description: 'List fulfillment services' },
        { id: 'create_fulfillment_service', name: 'Create Fulfillment Service', description: 'Create fulfillment service' },
      ],
      triggers: [
        { id: 'product_created', name: 'Product Created', description: 'Triggered when product is created' },
        { id: 'product_updated', name: 'Product Updated', description: 'Triggered when product is updated' },
        { id: 'product_deleted', name: 'Product Deleted', description: 'Triggered when product is deleted' },
        { id: 'order_created', name: 'Order Created', description: 'Triggered when order is created' },
        { id: 'order_updated', name: 'Order Updated', description: 'Triggered when order is updated' },
        { id: 'order_paid', name: 'Order Paid', description: 'Triggered when order is paid' },
        { id: 'order_fulfilled', name: 'Order Fulfilled', description: 'Triggered when order is fulfilled' },
        { id: 'customer_created', name: 'Customer Created', description: 'Triggered when customer is created' },
        { id: 'customer_updated', name: 'Customer Updated', description: 'Triggered when customer is updated' },
        { id: 'refund_created', name: 'Refund Created', description: 'Triggered when refund is created' },
        { id: 'collection_created', name: 'Collection Created', description: 'Triggered when collection is created' },
        { id: 'collection_updated', name: 'Collection Updated', description: 'Triggered when collection is updated' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'shopDomain', label: 'Shop Domain', description: 'Your Shopify shop domain (e.g., mystore.myshopify.com)', required: true },
          { name: 'apiKey', label: 'API Key', description: 'Your Shopify API key', required: true },
          { name: 'accessToken', label: 'Access Token', description: 'Your Shopify access token', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/products',
        method: 'GET',
      },
    };
  }
}

export const shopifyPlugin = new ShopifyPlugin();