# DatoCMS

DatoCMS is a headless CMS for digital content.

## Features

- Content management
- Media library
- GraphQL API
- Localization

## Installation

```bash
npm install @timps/datocms
```

## Usage

### Get Item

```typescript
const item = await agent.tools.getItem({
  id: 'item_123',
});
```

### List Items

```typescript
const items = await agent.tools.listItems({
  type: 'article',
});
```

## API Reference

`timps datacms item` - Get item

`timps datacms list` - List items