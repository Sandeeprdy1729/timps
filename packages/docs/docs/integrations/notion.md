---
id: notion
title: Notion Integration
description: Complete guide to integrating TIMPS with Notion for documentation and knowledge management.
---

# Notion Integration

TIMPS integrates with Notion for documentation and knowledge base management.

## Configuration

```bash
NOTION_API_KEY=secret_xxxx
NOTION_DATABASE_ID=db_xxxx
```

## Usage

### Connecting

```typescript
import { NotionIntegration } from '@timps/integrations';

const notion = new NotionIntegration({
  apiKey: process.env.NOTION_API_KEY,
  databaseId: process.env.NOTION_DATABASE_ID,
});
```

### Query Database

```typescript
const pages = await notion.query({
  property: 'Status',
  status: { equals: 'In Progress' },
});
```

### Create Page

```typescript
const page = await notion.createPage({
  title: 'New Document',
  content: 'Page content here',
});
```

### Search

```typescript
const results = await notion.search({
  query: 'documentation',
  filter: { property: 'object', value: 'page' },
});
```