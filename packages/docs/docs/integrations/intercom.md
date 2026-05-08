--- 
id: intercom 
title: Intercom Integration 
description: Complete guide to integrating TIMPS with Intercom for customer messaging.
---

# Intercom Integration

TIMPS integrates with Intercom for customer communication and support.

## Configuration

```bash
INTERCOM_API_KEY=your-api-key
```

## Usage

### Managing Contacts

```typescript
import { IntercomIntegration } from '@timps/integrations';

const intercom = new IntercomIntegration({
  apiKey: process.env.INTERCOM_API_KEY,
});

await intercom.connect();

// List contacts
const contacts = await intercom.listContacts();

// Create contact
const contact = await intercom.createContact({
  email: 'customer@example.com',
  name: 'John Doe',
});
```

### Conversations

```typescript
// List conversations
const conversations = await intercom.listConversations();

// Reply to conversation
await intercom.reply('conv_id', {
  type: 'user',
  message_type: 'comment',
  body: 'Reply message',
});
```

### Articles

```typescript
// Create article
const article = await intercom.createArticle({
  title: 'Help Article',
  body: 'Content here',
});
```