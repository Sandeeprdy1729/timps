# Sanity

Sanity is a headless CMS with real-time content platform.

## Features

- Real-time updates
- Portable text
- Asset pipeline
- Studio customization

## Installation

```bash
npm install @timps/sanity
```

## Usage

### Create Document

```typescript
await agent.tools.createDocument({
  type: 'post',
  title: 'New Post',
  body: [{ _type: 'block', children: [{ _type: 'span', text: 'Content' }] }],
});
```

### Query

```typescript
const posts = await agent.tools.query({
  query: '*[_type == "post"]',
});
```

## API Reference

`timps sanity document` - Manage documents

`timps sanity query` - Query content