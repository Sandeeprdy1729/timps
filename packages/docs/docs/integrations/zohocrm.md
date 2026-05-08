# Zoho CRM

Zoho CRM is a cloud-based CRM platform.

## Features

- Leads
- Deals
- Contacts
- Analytics

## Installation

```bash
npm install @timps/zohocrm
```

## Usage

### Create Lead

```typescript
await agent.tools.createLead({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
});
```

### Update Deal

```typescript
await agent.tools.updateDeal({
  dealId: 'deal_123',
  stage: 'Negotiation',
});
```

## API Reference

`timps zohocrm lead` - Manage leads

`timps zohocrm deal` - Manage deals