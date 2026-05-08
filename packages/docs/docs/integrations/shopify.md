---
id: shopify
title: Shopify Integration
description: Complete guide to integrating TIMPS with Shopify for e-commerce.
---

# Shopify Integration

TIMPS integrates with Shopify for e-commerce operations.

## Configuration

```bash
SHOPIFY_SHOP_NAME=your-shop
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_API_VERSION=2024-01
```

## Usage

### Products

```typescript
import { ShopifyIntegration } from '@timps/integrations';

const shopify = new ShopifyIntegration({
  shopName: process.env.SHOPIFY_SHOP_NAME,
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
});

await shopify.connect();

// List products
const products = await shopify.listProducts();

// Get product
const product = await shopify.getProduct('1');

// Create product
const newProduct = await shopify.createProduct({
  title: 'New Product',
  body_html: '<p>Description</p>',
  vendor: 'TIMPS',
  product_type: 'Digital',
  variants: [{
    price: '9.99',
    sku: 'SKU001',
  }],
});

// Update product
await shopify.updateProduct('1', {
  title: 'Updated Product',
});

// Delete product
await shopify.deleteProduct('1');
```

### Orders

```typescript
// List orders
const orders = await shopify.listOrders({ status: 'any' });

// Get order
const order = await shopify.getOrder('1');

// Close order
await shopify.closeOrder('1');
```

### Collections

```typescript
// List collections
const collections = await shopify.listCollections();

// Create collection
const collection = await shopify.createCollection({
  title: 'New Collection',
  body_html: '<p>Description</p>',
});
```

### Customers

```typescript
// List customers
const customers = await shopify.listCustomers();

// Create customer
const customer = await shopify.createCustomer({
  email: 'customer@example.com',
  first_name: 'John',
  last_name: 'Doe',
});
```

### Inventory

```typescript
// Adjust inventory
await shopify.adjustInventory({
  inventory_item_id: '1',
  available_adjustment: 10,
});
```