---
id: contentful
title: Contentful Integration
description: Complete guide to integrating TIMPS with Contentful for content management.
---

# Contentful Integration

TIMPS integrates with Contentful for headless CMS operations.

## Configuration

```bash
CONTENTFUL_SPACE_ID=your-space-id
CONTENTFUL_ACCESS_TOKEN=your-access-token
CONTENTFUL_MANAGEMENT_TOKEN=your-management-token
```

## Usage

### Entries

```typescript
import { ContentfulIntegration } from '@timps/integrations';

const contentful = new ContentfulIntegration({
  spaceId: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
  managementToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
});

await contentful.connect();

// Get entries
const entries = await contentful.getEntries({
  content_type: 'blogPost',
  limit: 10,
});

// Get entry
const entry = await contentful.getEntry('entry-id');

// Create entry
const newEntry = await contentful.createEntry({
  content_type: 'blogPost',
  fields: {
    title: { 'en-US': 'New Post' },
    body: { 'en-US': 'Content here' },
  },
});

// Update entry
await contentful.updateEntry('entry-id', {
  fields: {
    title: { 'en-US': 'Updated Title' },
  },
});

// Publish entry
await contentful.publishEntry('entry-id');

// Unpublish entry
await contentful.unpublishEntry('entry-id');

// Delete entry
await contentful.deleteEntry('entry-id');
```

### Assets

```typescript
// List assets
const assets = await contentful.getAssets();

// Upload asset
const asset = await contentful.createAsset({
  fields: {
    title: { 'en-US': 'Image' },
    file: {
      'en-US': {
        fileName: 'image.jpg',
        contentType: 'image/jpeg',
      },
    },
  },
});
```

### Content Types

```typescript
// List content types
const contentTypes = await contentful.getContentTypes();

// Get content type
const contentType = await contentful.getContentType('blogPost');

// Create content type
await contentful.createContentType({
  name: 'Product',
  fields: [
    { id: 'name', name: 'Name', type: 'Symbol' },
    { id: 'price', name: 'Price', type: 'Number' },
  ],
});
```