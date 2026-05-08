# Zendesk

Zendesk is a customer service platform.

## Features

- Tickets
- Macros
- SLAs
- Chat
- Voice
- Guide

## Installation

```bash
npm install @timps/zendesk
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { zendeskPlugin } from '@timps/zendesk';

const agent = createAgent({
  plugins: [
    zendeskPlugin({
      subdomain: 'yourcompany',
      apiToken: process.env.ZENDESK_API_TOKEN,
    }),
  ],
});
```

## Usage

### Create Ticket

```typescript
await agent.tools.createTicket({
  subject: 'Help needed',
  description: 'Issue description',
  requester: 'user@example.com',
});
```

### List Tickets

```typescript
const tickets = await agent.tools.listTickets({
  status: 'open',
});
```

## API Reference

`timps zendesk ticket` - Manage tickets