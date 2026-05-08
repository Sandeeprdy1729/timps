# Pipedrive

Pipedrive is a CRM for sales teams.

## Features

- Deals
- Contacts
- Organizations
- Activities
- Products
- Analytics

## Installation

```bash
npm install @timps/pipedrive
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { pipedrivePlugin } from '@timps/pipedrive';

const agent = createAgent({
  plugins: [
    pipedrivePlugin({
      apiToken: process.env.PIPEDRIVE_API_TOKEN,
    }),
  ],
});
```

## Usage

### Create Deal

```typescript
await agent.tools.createDeal({
  title: 'New Deal',
  value: 10000,
  currency: 'USD',
});
```

### Add Activity

```typescript
await agent.tools.addActivity({
  subject: 'Call client',
  type: 'call',
  dealId: '123',
});
```

## API Reference

`timps pipedrive deal` - Manage deals

`timps pipedrive activity` - Manage activities