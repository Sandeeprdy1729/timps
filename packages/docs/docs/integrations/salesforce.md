---
id: salesforce
title: Salesforce Integration
description: Complete guide to integrating TIMPS with Salesforce for enterprise CRM.
---

# Salesforce Integration

TIMPS integrates with Salesforce for enterprise-grade CRM functionality.

## Configuration

```bash
SALESFORCE_INSTANCE_URL=https://your-instance.salesforce.com
SALESFORCE_USERNAME=admin@example.com
SALESFORCE_PASSWORD=password
SALESFORCE_TOKEN=security-token
```

## Usage

### SOQL Queries

```typescript
import { SalesforceIntegration } from '@timps/integrations';

const sf = new SalesforceIntegration({
  instanceUrl: process.env.SALESFORCE_INSTANCE_URL,
  username: process.env.SALESFORCE_USERNAME,
  password: process.env.SALESFORCE_PASSWORD,
  securityToken: process.env.SALESFORCE_TOKEN,
});

await sf.connect();

// Query contacts
const contacts = await sf.query(`
  SELECT Id, Name, Email 
  FROM Contact 
  WHERE Email != null
`);

// Create record
const contact = await sf.create('Contact', {
  FirstName: 'John',
  LastName: 'Doe',
  Email: 'john@example.com',
});
```

### Describe

```typescript
const fields = await sf.describe('Contact');
```

### Batch Operations

```typescript
await sf.batch(contacts.map(c => ({ method: 'POST', data: c })));
```