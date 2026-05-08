import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

describe('Shopify - Advanced Operations', () => {
  const baseUrl = 'https://shop.myshopify.com/admin/api/2024-01';

  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Products', () => {
    it('should create product with variants', async () => {
      nock(baseUrl).post('/products.json').reply(201, {
        product: { id: 1, variants: [{ id: 1 }] }
      });
      const res = await fetch(`${baseUrl}/products.json`, {
        method: 'POST',
        body: JSON.stringify({
          product: {
            title: 'Product',
            variants: [{ price: '9.99', sku: 'SKU1' }, { price: '19.99', sku: 'SKU2' }]
          }
        })
      });
      const data = await res.json();
      expect(data.product.variants).toHaveLength(2);
    });

    it('should create product with images', async () => {
      nock(baseUrl).post('/products.json').reply(201, {
        product: { id: 1, images: [{ id: 1 }] }
      });
      const res = await fetch(`${baseUrl}/products.json`, {
        method: 'POST',
        body: JSON.stringify({
          product: {
            title: 'Product',
            images: [{ src: 'https://example.com/image.jpg' }]
          }
        })
      });
      expect(res.status).toBe(201);
    });

    it('should create product with tags', async () => {
      nock(baseUrl).post('/products.json').reply(201, { product: { id: 1 } });
      const res = await fetch(`${baseUrl}/products.json`, {
        method: 'POST',
        body: JSON.stringify({
          product: { title: 'Product', tags: 'tag1, tag2' }
        })
      });
      expect(res.status).toBe(201);
    });

    it('should create product with options', async () => {
      nock(baseUrl).post('/products.json').reply(201, {
        product: { id: 1, options: [{ name: 'Size' }, { name: 'Color' }] }
      });
      const res = await fetch(`${baseUrl}/products.json`, {
        method: 'POST',
        body: JSON.stringify({
          product: {
            title: 'Product',
            options: [{ name: 'Size', values: ['S', 'M'] }, { name: 'Color', values: ['Red'] }]
          }
        })
      });
      expect(res.status).toBe(201);
    });

    it('should update product status', async () => {
      nock(baseUrl).put('/products/1.json').reply(200, {
        product: { id: 1, status: 'active' }
      });
      const res = await fetch(`${baseUrl}/products/1.json`, {
        method: 'PUT',
        body: JSON.stringify({ product: { status: 'active' } })
      });
      const data = await res.json();
      expect(data.product.status).toBe('active');
    });

    it('should add product to collection', async () => {
      nock(baseUrl).put('/collects.json').reply(201, { collect: { id: 1 } });
      const res = await fetch(`${baseUrl}/collects.json`, {
        method: 'POST',
        body: JSON.stringify({ collect: { product_id: 1, collection_id: 1 } })
      });
      expect(res.status).toBe(201);
    });

    it('should create product feed', async () => {
      nock(baseUrl).get('/product_listings.json').reply(200, { product_listings: [] });
      const res = await fetch(`${baseUrl}/product_listings.json`);
      expect(res.status).toBe(200);
    });
  });

  describe('Inventory', () => {
    it('should adjust inventory at location', async () => {
      nock(baseUrl).post('/inventory_levels/adjust.json').reply(200, {
        inventory_item_id: 1,
        available: 15
      });
      const res = await fetch(`${baseUrl}/inventory_levels/adjust.json`, {
        method: 'POST',
        body: JSON.stringify({
          inventory_item_id: 1,
          location_id: 1,
          available_adjustment: 5
        })
      });
      expect(res.status).toBe(200);
    });

    it('should set inventory at location', async () => {
      nock(baseUrl).post('/inventory_levels/set.json').reply(200, {
        inventory_item_id: 1,
        available: 10
      });
      const res = await fetch(`${baseUrl}/inventory_levels/set.json`, {
        method: 'POST',
        body: JSON.stringify({
          inventory_item_id: 1,
          location_id: 1,
          available: 10
        })
      });
      expect(res.status).toBe(200);
    });

    it('should get inventory levels', async () => {
      nock(baseUrl).get('/inventory_levels.json').query(true).reply(200, { inventory_levels: [] });
      const res = await fetch(`${baseUrl}/inventory_levels.json?inventory_item_ids=1`);
      expect(res.status).toBe(200);
    });

    it('should get locations', async () => {
      nock(baseUrl).get('/locations.json').reply(200, { locations: [] });
      const res = await fetch(`${baseUrl}/locations.json`);
      expect(res.status).toBe(200);
    });

    it('should get location by ID', async () => {
      nock(baseUrl).get('/locations/1.json').reply(200, { location: { id: 1 } });
      const res = await fetch(`${baseUrl}/locations/1.json`);
      expect(res.status).toBe(200);
    });
  });

  describe('Orders', () => {
    it('should create order', async () => {
      nock(baseUrl).post('/orders.json').reply(201, {
        order: { id: 1, name: '#1001' }
      });
      const res = await fetch(`${baseUrl}/orders.json`, {
        method: 'POST',
        body: JSON.stringify({
          order: {
            line_items: [{ variant_id: 1, quantity: 1 }],
            email: 'customer@example.com'
          }
        })
      });
      expect(res.status).toBe(201);
    });

    it('should create fulfillment', async () => {
      nock(baseUrl).post('/orders/1/fulfillments.json').reply(201, {
        fulfillment: { id: 1, status: 'success' }
      });
      const res = await fetch(`${baseUrl}/orders/1/fulfillments.json`, {
        method: 'POST',
        body: JSON.stringify({
          fulfillment: { location_id: 1, line_items: [{ id: 1, quantity: 1 }] }
        })
      });
      expect(res.status).toBe(201);
    });

    it('should create refund', async () => {
      nock(baseUrl).post('/orders/1/refunds.json').reply(201, {
        refund: { id: 1 }
      });
      const res = await fetch(`${baseUrl}/orders/1/refunds.json`, {
        method: 'POST',
        body: JSON.stringify({
          refund: { note: 'Reason', line_items: [] }
        })
      });
      expect(res.status).toBe(201);
    });

    it('should update order', async () => {
      nock(baseUrl).put('/orders/1.json').reply(200, { order: { id: 1, note: 'Updated' } });
      const res = await fetch(`${baseUrl}/orders/1.json`, {
        method: 'PUT',
        body: JSON.stringify({ order: { note: 'Updated' } })
      });
      expect(res.status).toBe(200);
    });

    it('should get order transactions', async () => {
      nock(baseUrl).get('/orders/1/transactions.json').reply(200, { transactions: [] });
      const res = await fetch(`${baseUrl}/orders/1/transactions.json`);
      expect(res.status).toBe(200);
    });

    it('should get order risks', async () => {
      nock(baseUrl).get('/orders/1/risks.json').reply(200, { risks: [] });
      const res = await fetch(`${baseUrl}/orders/1/risks.json`);
      expect(res.status).toBe(200);
    });

    it('should cancel order', async () => {
      nock(baseUrl).post('/orders/1/cancel.json').reply(200, { order: { id: 1, cancel_reason: 'customer' } });
      const res = await fetch(`${baseUrl}/orders/1/cancel.json`, {
        method: 'POST',
        body: JSON.stringify({ cancel_reason: 'customer' })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Customers', () => {
    it('should create customer with address', async () => {
      nock(baseUrl).post('/customers.json').reply(201, {
        customer: { id: 1, addresses: [] }
      });
      const res = await fetch(`${baseUrl}/customers.json`, {
        method: 'POST',
        body: JSON.stringify({
          customer: {
            email: 'test@example.com',
            addresses: [{ address1: '123 Main St', city: 'NYC' }]
          }
        })
      });
      expect(res.status).toBe(201);
    });

    it('should create customer with tags', async () => {
      nock(baseUrl).post('/customers.json').reply(201, { customer: { id: 1 } });
      const res = await fetch(`${baseUrl}/customers.json`, {
        method: 'POST',
        body: JSON.stringify({ customer: { email: 'test@example.com', tags: 'vip' } })
      });
      expect(res.status).toBe(201);
    });

    it('should update customer', async () => {
      nock(baseUrl).put('/customers/1.json').reply(200, {
        customer: { id: 1, first_name: 'Updated' }
      });
      const res = await fetch(`${baseUrl}/customers/1.json`, {
        method: 'PUT',
        body: JSON.stringify({ customer: { first_name: 'Updated' } })
      });
      expect(res.status).toBe(200);
    });

    it('should get customer orders', async () => {
      nock(baseUrl).get('/customers/1/orders.json').reply(200, { orders: [] });
      const res = await fetch(`${baseUrl}/customers/1/orders.json`);
      expect(res.status).toBe(200);
    });
  });

  describe('Shop', () => {
    it('should get shop', async () => {
      nock(baseUrl).get('/shop.json').reply(200, { shop: { id: 1, name: 'My Shop' } });
      const res = await fetch(`${baseUrl}/shop.json`);
      expect(res.status).toBe(200);
    });
  });

  describe('Webhooks', () => {
    it('should list webhooks', async () => {
      nock(baseUrl).get('/webhooks.json').reply(200, { webhooks: [] });
      const res = await fetch(`${baseUrl}/webhooks.json`);
      expect(res.status).toBe(200);
    });

    it('should create webhook', async () => {
      nock(baseUrl).post('/webhooks.json').reply(201, { webhook: { id: 1 } });
      const res = await fetch(`${baseUrl}/webhooks.json`, {
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            topic: 'orders/create',
            address: 'https://example.com/webhook',
            format: 'json'
          }
        })
      });
      expect(res.status).toBe(201);
    });
  });

  describe('Draft Orders', () => {
    it('should create draft order', async () => {
      nock(baseUrl).post('/draft_orders.json').reply(201, {
        draft_order: { id: 1 }
      });
      const res = await fetch(`${baseUrl}/draft_orders.json`, {
        method: 'POST',
        body: JSON.stringify({ draft_order: { line_items: [] } })
      });
      expect(res.status).toBe(201);
    });

    it('should send draft order invoice', async () => {
      nock(baseUrl).post('/draft_orders/1/send_invoice.json').reply(200, {});
      const res = await fetch(`${baseUrl}/draft_orders/1/send_invoice.json`, {
        method: 'POST',
        body: JSON.stringify({ draft_order: { email: 'customer@example.com' } })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Price Rules', () => {
    it('should create price rule', async () => {
      nock(baseUrl).post('/price_rules.json').reply(201, {
        price_rule: { id: 1 }
      });
      const res = await fetch(`${baseUrl}/price_rules.json`, {
        method: 'POST',
        body: JSON.stringify({
          price_rule: {
            title: 'SALE',
            value_type: 'percentage',
            value: '-10.0'
          }
        })
      });
      expect(res.status).toBe(201);
    });

    it('should create discount code', async () => {
      nock(baseUrl).post('/price_rules/1/discount_codes.json').reply(201, {
        discount_code: { id: 1, code: 'SAVE10' }
      });
      const res = await fetch(`${baseUrl}/price_rules/1/discount_codes.json`, {
        method: 'POST',
        body: JSON.stringify({
          discount_code: { code: 'SAVE10' }
        })
      });
      expect(res.status).toBe(201);
    });
  });

  describe('Metafields', () => {
    it('should create metafield', async () => {
      nock(baseUrl).post('/metafields.json').reply(201, {
        metafield: { id: 1, key: 'size', value: 'large' }
      });
      const res = await fetch(`${baseUrl}/metafields.json`, {
        method: 'POST',
        body: JSON.stringify({
          metafield: {
            namespace: 'custom',
            key: 'size',
            value: 'large',
            value_type: 'string'
          }
        })
      });
      expect(res.status).toBe(201);
    });

    it('should get metafields', async () => {
      nock(baseUrl).get('/metafields.json').reply(200, { metafields: [] });
      const res = await fetch(`${baseUrl}/metafields.json`);
      expect(res.status).toBe(200);
    });
  });
});

describe('Notion - Advanced Operations', () => {
  const baseUrl = 'https://api.notion.com/v1';

  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Databases', () => {
    it('should query database with filter', async () => {
      nock(baseUrl).post('/databases/db1/query').reply(200, {
        results: [],
        next_cursor: 'cursor'
      });
      const res = await fetch(`${baseUrl}/databases/db1/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            property: 'Status',
            status: { equals: 'Done' }
          }
        })
      });
      expect(res.status).toBe(200);
    });

    it('should query database with sorts', async () => {
      nock(baseUrl).post('/databases/db1/query').reply(200, { results: [] });
      const res = await fetch(`${baseUrl}/databases/db1/query`, {
        method: 'POST',
        body: JSON.stringify({
          sorts: [{ property: 'Name', direction: 'ascending' }]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should query with pagination', async () => {
      nock(baseUrl).post('/databases/db1/query').reply(200, {
        results: [],
        next_cursor: 'next'
      });
      const res = await fetch(`${baseUrl}/databases/db1/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 10, start_cursor: 'cursor' })
      });
      expect(res.status).toBe(200);
    });

    it('should create database', async () => {
      nock(baseUrl).post('/databases').reply(200, { id: 'db1' });
      const res = await fetch(`${baseUrl}/databases`, {
        method: 'POST',
        body: JSON.stringify({
          parent: { page_id: 'page1' },
          title: [{ type: 'text', text: { content: 'Database' } }],
          properties: {
            Name: { title: {} },
            Tags: { multi_select: { options: [] } }
          }
        })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Blocks', () => {
    it('should append children', async () => {
      nock(baseUrl).patch('/blocks/page1').reply(200, { results: [] });
      const res = await fetch(`${baseUrl}/blocks/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [
            { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: 'Text' } }] } }
          ]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should get block children', async () => {
      nock(baseUrl).get('/blocks/page1/children').reply(200, { results: [] });
      const res = await fetch(`${baseUrl}/blocks/page1/children`);
      expect(res.status).toBe(200);
    });

    it('should update block', async () => {
      nock(baseUrl).patch('/blocks/block1').reply(200, { id: 'block1' });
      const res = await fetch(`${baseUrl}/blocks/block1`, {
        method: 'PATCH',
        body: JSON.stringify({
          paragraph: { rich_text: [{ text: { content: 'Updated' } }] }
        })
      });
      expect(res.status).toBe(200);
    });

    it('should delete block', async () => {
      nock(baseUrl).delete('/blocks/block1').reply(200, {});
      const res = await fetch(`${baseUrl}/blocks/block1`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);
    });

    it('should add paragraph block', async () => {
      nock(baseUrl).patch('/blocks/page1').reply(200, {});
      const res = await fetch(`${baseUrl}/blocks/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [{ object: 'block', type: 'paragraph', paragraph: {} }]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should add heading block', async () => {
      nock(baseUrl).patch('/blocks/page1').reply(200, {});
      const res = await fetch(`${baseUrl}/blocks/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [{ object: 'block', type: 'heading_1', heading_1: {} }]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should add to-do block', async () => {
      nock(baseUrl).patch('/blocks/page1').reply(200, {});
      const res = await fetch(`${baseUrl}/blocks/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [{ object: 'block', type: 'to_do', to_do: {} }]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should add image block', async () => {
      nock(baseUrl).patch('/blocks/page1').reply(200, {});
      const res = await fetch(`${baseUrl}/blocks/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [{ object: 'block', type: 'image', image: { type: 'external', external: { url: 'https://example.com/img.png' } } }]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should add video block', async () => {
      nock(baseUrl).patch('/blocks/page1').reply(200, {});
      const res = await fetch(`${baseUrl}/blocks/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [{ object: 'block', type: 'video', video: { type: 'external', external: { url: 'https://example.com/vid.mp4' } } }]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should add code block', async () => {
      nock(baseUrl).patch('/blocks/page1').reply(200, {});
      const res = await fetch(`${baseUrl}/blocks/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [{ object: 'block', type: 'code', code: { language: 'javascript', rich_text: [] } }]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should add callout block', async () => {
      nock(baseUrl).patch('/blocks/page1').reply(200, {});
      const res = await fetch(`${baseUrl}/blocks/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [{ object: 'block', type: 'callout', callout: {} }]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should add toggle block', async () => {
      nock(baseUrl).patch('/blocks/page1').reply(200, {});
      const res = await fetch(`${baseUrl}/blocks/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [{ object: 'block', type: 'toggle', toggle: {} }]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should add embed block', async () => {
      nock(baseUrl).patch('/blocks/page1').reply(200, {});
      const res = await fetch(`${baseUrl}/blocks/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          children: [{ object: 'block', type: 'embed', embed: { url: 'https://example.com' } }]
        })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Pages', () => {
    it('should get page properties', async () => {
      nock(baseUrl).get('/pages/page1').reply(200, { properties: {} });
      const res = await fetch(`${baseUrl}/pages/page1`);
      expect(res.status).toBe(200);
    });

    it('should update page property', async () => {
      nock(baseUrl).patch('/pages/page1').reply(200, { id: 'page1' });
      const res = await fetch(`${baseUrl}/pages/page1`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: { Name: { title: [{ text: { content: 'Updated' } }] }
        })
      });
      expect(res.status).toBe(200);
    });

    it('should archive page', async () => {
      nock(baseUrl).patch('/pages/page1').reply(200, { archived: true });
      const res = await fetch(`${baseUrl}/pages/page1`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: true })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Users', () => {
    it('should get bot', async () => {
      nock(baseUrl).get('/users/me').reply(200, { id: 'user1', type: 'bot' });
      const res = await fetch(`${baseUrl}/users/me`);
      expect(res.status).toBe(200);
    });

    it('should list all users', async () => {
      nock(baseUrl).get('/users').reply(200, { results: [] });
      const res = await fetch(`${baseUrl}/users`);
      expect(res.status).toBe(200);
    });
  });
});

describe('Stripe - Advanced Operations', () => {
  const baseUrl = 'https://api.stripe.com/v1';

  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Payment Intents', () => {
    it('should create payment intent', async () => {
      nock(baseUrl).post('/payment_intents').reply(200, { id: 'pi_1', status: 'requires_payment_method' });
      const res = await fetch(`${baseUrl}/payment_intents`, {
        method: 'POST',
        body: JSON.stringify({ amount: 1000, currency: 'usd' })
      });
      expect(res.status).toBe(200);
    });

    it('should confirm payment intent', async () => {
      nock(baseUrl).post('/payment_intents/pi_1/confirm').reply(200, { id: 'pi_1', status: 'succeeded' });
      const res = await fetch(`${baseUrl}/payment_intents/pi_1/confirm`, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
    });

    it('should capture payment intent', async () => {
      nock(baseUrl).post('/payment_intents/pi_1/capture').reply(200, { id: 'pi_1', status: 'succeeded' });
      const res = await fetch(`${baseUrl}/payment_intents/pi_1/capture`, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
    });

    it('should cancel payment intent', async () => {
      nock(baseUrl).post('/payment_intents/pi_1/cancel').reply(200, { id: 'pi_1', status: 'canceled' });
      const res = await fetch(`${baseUrl}/payment_intents/pi_1/cancel`, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Setup Intents', () => {
    it('should create setup intent', async () => {
      nock(baseUrl).post('/setup_intents').reply(200, { id: 'seti_1' });
      const res = await fetch(`${baseUrl}/setup_intents`, {
        method: 'POST',
        body: JSON.stringify({ payment_method_types: ['card'] })
      });
      expect(res.status).toBe(200);
    });

    it('should confirm setup intent', async () => {
      nock(baseUrl).post('/setup_intents/seti_1/confirm').reply(200, { id: 'seti_1' });
      const res = await fetch(`${baseUrl}/setup_intents/seti_1/confirm`, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Customers', () => {
    it('should create customer with metadata', async () => {
      nock(baseUrl).post('/customers').reply(200, { id: 'cus_1', metadata: { foo: 'bar' } });
      const res = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', metadata: { foo: 'bar' } })
      });
      expect(res.status).toBe(200);
    });

    it('should list customerbalance transactions', async () => {
      nock(baseUrl).get('/customers/cus_1/balance_transactions').reply(200, { data: [] });
      const res = await fetch(`${baseUrl}/customers/cus_1/balance_transactions`);
      expect(res.status).toBe(200);
    });

    it('should create customer cash balance', async () => {
      nock(baseUrl).post('/customers/cus_1/cash_balance').reply(200, { available: [] });
      const res = await fetch(`${baseUrl}/customers/cus_1/cash_balance`, {
        method: 'POST',
        body: JSON.stringify({ settings: { reconciliation_mode: 'automatic' } })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Subscriptions', () => {
    it('should create subscription item', async () => {
      nock(baseUrl).post('/subscription_items').reply(200, { id: 'si_1' });
      const res = await fetch(`${baseUrl}/subscription_items`, {
        method: 'POST',
        body: JSON.stringify({ subscription: 'sub_1', price: 'price_1', quantity: 1 })
      });
      expect(res.status).toBe(200);
    });

    it('should update subscription item', async () => {
      nock(baseUrl).post('/subscription_items/si_1').reply(200, { id: 'si_1' });
      const res = await fetch(`${baseUrl}/subscription_items/si_1`, {
        method: 'POST',
        body: JSON.stringify({ quantity: 2 })
      });
      expect(res.status).toBe(200);
    });

    it('should delete subscription item', async () => {
      nock(baseUrl).delete('/subscription_items/si_1').reply(200, { id: 'si_1' });
      const res = await fetch(`${baseUrl}/subscription_items/si_1`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Prices', () => {
    it('should create price', async () => {
      nock(baseUrl).post('/prices').reply(200, { id: 'price_1' });
      const res = await fetch(`${baseUrl}/prices`, {
        method: 'POST',
        body: JSON.stringify({ unit_amount: 1000, currency: 'usd', recurring: { interval: 'month' }, product: 'prod_1' })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Products', () => {
    it('should create product', async () => {
      nock(baseUrl).post('/products').reply(200, { id: 'prod_1' });
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Product' })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Tax Rates', () => {
    it('should create tax rate', async () => {
      nock(baseUrl).post('/tax_rates').reply(200, { id: 'txr_1' });
      const res = await fetch(`${baseUrl}/tax_rates`, {
        method: 'POST',
        body: JSON.stringify({ display_name: 'VAT', percentage: 20, inclusive: false })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Balance', () => {
    it('should get balance', async () => {
      nock(baseUrl).get('/balance').reply(200, { available: [], pending: [] });
      const res = await fetch(`${baseUrl}/balance`);
      expect(res.status).toBe(200);
    });

    it('should get balance transactions', async () => {
      nock(baseUrl).get('/balance_transactions').reply(200, { data: [] });
      const res = await fetch(`${baseUrl}/balance_transactions`);
      expect(res.status).toBe(200);
    });
  });
});

describe('OpenAI - Advanced Operations', () => {
  const baseUrl = 'https://api.openai.com/v1';

  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Chat Completions', () => {
    it('should create chat completion with functions', async () => {
      nock(baseUrl).post('/chat/completions').reply(200, {
        choices: [{ message: { function_call: { name: 'fn', arguments: '{}' } } }]
      });
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hi' }],
          functions: [{ name: 'fn', parameters: { type: 'object' } }]
        })
      });
      expect(res.status).toBe(200);
    });

    it('should create streaming chat', async () => {
      nock(baseUrl).post('/chat/completions').reply(200, {
        choices: [{ delta: {} }]
      });
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hi' }],
          stream: true
        })
      });
      expect(res.status).toBe(200);
    });

    it('should use temperature', async () => {
      nock(baseUrl).post('/chat/completions').reply(200, { choices: [] });
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4', messages: [], temperature: 0.7 })
      });
      expect(res.status).toBe(200);
    });

    it('should use max tokens', async () => {
      nock(baseUrl).post('/chat/completions').reply(200, { choices: [] });
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4', messages: [], max_tokens: 100 })
      });
      expect(res.status).toBe(200);
    });

    it('should use stop sequences', async () => {
      nock(baseUrl).post('/chat/completions').reply(200, { choices: [] });
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4', messages: [], stop: ['END'] })
      });
      expect(res.status).toBe(200);
    });

    it('should use presence penalty', async () => {
      nock(baseUrl).post('/chat/completions').reply(200, { choices: [] });
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4', messages: [], presence_penalty: 0.5 })
      });
      expect(res.status).toBe(200);
    });

    it('should use frequency penalty', async () => {
      nock(baseUrl).post('/chat/completions').reply(200, { choices: [] });
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4', messages: [], frequency_penalty: 0.5 })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Images', () => {
    it('should create image with size', async () => {
      nock(baseUrl).post('/images/generations').reply(200, {
        data: [{ url: 'https://example.com/img.png' }]
      });
      const res = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Cat', size: '1024x1024', n: 1 })
      });
      expect(res.status).toBe(200);
    });

    it('should create image variation', async () => {
      nock(baseUrl).post('/images/variations').reply(200, { data: [] });
      const res = await fetch(`${baseUrl}/images/variations`, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
    });

    it('should edit image', async () => {
      nock(baseUrl).post('/images/edits').reply(200, { data: [] });
      const res = await fetch(`${baseUrl}/images/edits`, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Embeddings', () => {
    it('should create embedding', async () => {
      nock(baseUrl).post('/embeddings').reply(200, {
        data: [{ embedding: new Array(1536).fill(0) }]
      });
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        body: JSON.stringify({ model: 'text-embedding-ada-002', input: 'Text' })
      });
      expect(res.status).toBe(200);
    });

    it('should use encoding format', async () => {
      nock(baseUrl).post('/embeddings').reply(200, { data: [] });
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        body: JSON.stringify({ model: 'text-embedding-ada-002', input: 'Text', encoding_format: 'base64' })
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Files', () => {
    it('should list files', async () => {
      nock(baseUrl).get('/files').reply(200, { data: [] });
      const res = await fetch(`${baseUrl}/files`);
      expect(res.status).toBe(200);
    });

    it('should upload file', async () => {
      nock(baseUrl).post('/files').reply(200, { id: 'file_1' });
      const res = await fetch(`${baseUrl}/files`, {
        method: 'POST'
      });
      expect(res.status).toBe(200);
    });

    it('should delete file', async () => {
      nock(baseUrl).delete('/files/file_1').reply(200, {});
      const res = await fetch(`${baseUrl}/files/file_1`, {
        method: 'DELETE'
      });
      expect(res.status).toBe(200);
    });

    it('should get file content', async () => {
      nock(baseUrl).get('/files/file_1/content').reply(200, 'content');
      const res = await fetch(`${baseUrl}/files/file_1/content`);
      expect(res.status).toBe(200);
    });
  });
});