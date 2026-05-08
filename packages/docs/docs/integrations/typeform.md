---
id: typeform
title: Typeform Integration
description: Complete guide to integrating TIMPS with Typeform for forms and surveys.
---

# Typeform Integration

TIMPS integrates with Typeform for forms and survey management.

## Configuration

```bash
TYPEFORM_ACCESS_TOKEN=your-access-token
TYPEFORM_FORM_ID=your-form-id
```

## Usage

### Forms

```typescript
import { TypeformIntegration } from '@timps/integrations';

const typeform = new TypeformIntegration({
  accessToken: process.env.TYPEFORM_ACCESS_TOKEN,
});

await typeform.connect();

// List forms
const forms = await typeform.listForms();

// Get form
const form = await typeform.getForm('form-id');

// Create form
const form = await typeform.createForm({
  title: 'Survey',
  fields: [
    {
      title: 'What is your name?',
      type: 'short_text',
      ref: 'name',
    },
    {
      title: 'How would you rate us?',
      type: 'rating',
      ref: 'rating',
    },
  ],
});
```

### Responses

```typescript
// Get responses
const responses = await typeform.getResponses('form-id');

// Get specific response
const response = await typeform.getResponse('form-id', 'response-id');
```

### Webhooks

```typescript
// Create webhook
await typeform.createWebhook('form-id', {
  url: 'https://example.com/webhook',
  enabled: true,
});

// Delete webhook
await typeform.deleteWebhook('form-id');
```