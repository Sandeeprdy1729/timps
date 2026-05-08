---
id: hubspot
title: HubSpot CRM Integration
description: Complete guide to integrating TIMPS with HubSpot for CRM and sales automation.
---

# HubSpot CRM Integration

TIMPS integrates with HubSpot for comprehensive CRM functionality.

## Features

- Contact management
- Company tracking
- Deal pipelines
- Ticket management
- Email automation
- Workflow triggers

## Configuration

```bash
HUBSPOT_API_KEY=hub_api_key_here
```

## Usage

### Managing Contacts

```typescript
import { HubSpotIntegration } from '@timps/integrations';

const hubspot = new HubSpotIntegration({
  apiKey: process.env.HUBSPOT_API_KEY,
});

await hubspot.connect();

// Create contact
const contact = await hubspot.createContact({
  email: 'customer@example.com',
  firstName: 'John',
  lastName: 'Doe',
});

// Search contacts
const results = await hubspot.searchContacts({
  property: 'email',
  operator: 'EQ',
  value: 'customer@example.com',
});
```

### Managing Deals

```typescript
const deal = await hubspot.createDeal({
  dealname: 'Enterprise Deal',
  amount: 50000,
  pipeline: 'default',
  dealstage: 'contractsent',
});
```

### Companies

```typescript
const company = await hubspot.createCompany({
  name: 'Acme Corp',
  domain: 'acme.com',
});
```