# Strapi

Strapi is an open-source headless CMS.

## Features

- Content management
- Custom content types
- GraphQL/REST API
- User management

## Installation

```bash
npm install @timps/strapi
```

## Usage

### Create Entry

```typescript
await agent.tools.createEntry({
  collection: 'articles',
  data: { title: 'Hello', content: 'World' },
});
```

### Query

```typescript
const articles = await agent.tools.query({
  endpoint: '/api/articles',
});
```

## API Reference

`timps strapi entry` - Manage entries

`timps strapi query` - Query API