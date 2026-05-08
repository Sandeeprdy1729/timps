---
id: google-workspace
title: Google Workspace Integration
description: Complete guide to integrating TIMPS with Google Workspace.
---

# Google Workspace Integration

TIMPS integrates with Google Workspace for email, calendar, drive, and docs.

## Configuration

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

## Usage

### Gmail

```typescript
import { GoogleIntegration } from '@timps/integrations';

const google = new GoogleIntegration({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

await google.connect();

// Send email
await google.gmail.send({
  to: 'recipient@example.com',
  subject: 'Hello',
  body: 'Message content',
});

// List messages
const messages = await google.gmail.listMessages({ maxResults: 10 });

// Get message
const message = await google.gmail.getMessage('msg-id');
```

### Google Calendar

```typescript
// List events
const events = await google.calendar.listEvents({
  timeMin: new Date().toISOString(),
  maxResults: 10,
});

// Create event
await google.calendar.createEvent({
  summary: 'Meeting',
  description: 'Team sync',
  start: { dateTime: '2024-01-15T10:00:00Z' },
  end: { dateTime: '2024-01-15T11:00:00Z' },
});
```

### Google Drive

```typescript
// List files
const files = await google.drive.listFiles({ pageSize: 10 });

// Create folder
await google.drive.createFolder('New Folder');

// Upload file
await google.drive.uploadFile({
  name: 'document.txt',
  content: 'file content',
  parent: 'folder-id',
});
```

### Google Docs

```typescript
// Create document
const doc = await google.docs.create({
  title: 'New Document',
});

// Update document
await google.docs.updateContent('doc-id', 'New content');
```