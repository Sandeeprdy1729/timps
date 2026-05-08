---
id: webflow
title: Webflow Integration
description: Complete guide to integrating TIMPS with Webflow for CMS and e-commerce.
---

# Webflow Integration

TIMPS integrates with Webflow for CMS and ecommerce operations.

## Configuration

```bash
WEBFLOW_ACCESS_TOKEN=your-access-token
WEBFLOW_SITE_ID=your-site-id
```

## Usage

### Sites

```typescript
import { WebflowIntegration } from '@timps/integrations';

const webflow = new WebflowIntegration({
  accessToken: process.env.WEBFLOW_ACCESS_TOKEN,
});

await webflow.connect();

// List sites
const sites = await webflow.listSites();

// Get site
const site = await webflow.getSite('site-id');
```

### Collections

```typescript
// List collections
const collections = await webflow.listCollections('site-id');

// Get collection
const collection = await webflow.getCollection('collection-id');

// List collection items
const items = await webflow.listItems('collection-id');
```

### Items

```typescript
// Get item
const item = await webflow.getItem('collection-id', 'item-id');

// Create item
const newItem = await webflow.createItem('collection-id', {
  name: { field_id: 'value' },
});

// Update item
await webflow.updateItem('collection-id', 'item-id', {
  name: { field_id: 'new-value' },
});

// Delete item
await webflow.deleteItem('collection-id', 'item-id');
```

### Ecommerce

```typescript
// List products
const products = await webflow.listProducts();

// Get product
const product = await webflow.getProduct('product-id');

// Create product
await webflow.createProduct({
  name: 'New Product',
  price: 9.99,
});
```