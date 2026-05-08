# Resend

Resend is a developer-first email API that makes it easy to send emails.

## Features

- Transactional emails
- Email templates
- Bounce handling
- Open/click tracking
- Webhook support

## Installation

```bash
npm install @timps/resend
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { resendPlugin } from '@timps/resend';

const agent = createAgent({
  plugins: [
    resendPlugin({
      apiKey: process.env.RESEND_API_KEY,
    }),
  ],
});
```

## Usage

### Send Email

```typescript
await agent.tools.sendEmail({
  from: 'noreply@yourdomain.com',
  to: 'user@example.com',
  subject: 'Welcome',
  html: '<h1>Welcome!</h1>',
});
```

### Send Template

```typescript
await agent.tools.sendTemplate({
  templateId: 'template_xxx',
  to: 'user@example.com',
  data: { name: 'John' },
});
```

### Batch Send

```typescript
await agent.tools.batchSend({
  emails: [
    { to: 'user1@example.com', subject: 'Email 1' },
    { to: 'user2@example.com', subject: 'Email 2' },
  ],
});
```

## API Reference

`timps email resend` - Send email via Resend

`timps email template` - Send templated email

`timps email batch` - Batch send emails

`timps email stats` - View email statistics