# Mailchimp

Mailchimp is an email marketing platform.

## Features

- Email campaigns
- Audiences
- Automation
- Analytics

## Installation

```bash
npm install @timps/mailchimp
```

## Usage

### Add Subscriber

```typescript
await agent.tools.addSubscriber({
  email: 'user@example.com',
  listId: 'list_123',
});
```

### Send Campaign

```typescript
await agent.tools.sendCampaign({
  campaignId: 'campaign_123',
});
```

## API Reference

`timps mailchimp subscriber` - Manage subscribers

`timps mailchimp campaign` - Manage campaigns