# Freshdesk

Freshdesk is a customer support software.

## Features

- Tickets
- Knowledge base
- Phone
- Chat
- Automation
- Reports

## Installation

```bash
npm install @timps/freshdesk
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { freshdeskPlugin } from '@timps/freshdesk';

const agent = createAgent({
  plugins: [
    freshdeskPlugin({
      domain: 'yourcompany',
      apiKey: process.env.FRESHDESK_API_KEY,
    }),
  ],
});
```

## Usage

### Create Ticket

```typescript
await agent.tools.createTicket({
  subject: 'Support needed',
  description: 'Issue description',
  email: 'user@example.com',
});
```

### List Tickets

```typescript
const tickets = await agent.tools.listTickets();
```

## API Reference

`timps freshdesk ticket` - Manage tickets