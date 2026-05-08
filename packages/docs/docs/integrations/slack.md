---
sidebar_position: 21
---

# Slack Integration

Connect Slack for real-time notifications and messaging in TIMPS.

## Features

- **Channel Messaging**: Post messages to channels
- **Interactive Messages**: Buttons, menus, modals
- **Reminders**: Set reminders for tasks
- **Webhooks**: Receive events from Slack

## Authentication

### OAuth 2.0

```bash
timps connect slack
```

Navigate to: `https://api.slack.com/apps`

Callback URL: `https://timps.dev/oauth/slack`

## Scopes Required

- `channels:read` - Access channel list
- `chat:write` - Post messages
- `users:read` - Access user info
- `commands` - Slash commands

## Environment Variables

```env
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxx
SLACK_SIGNING_SECRET=your_secret
SLACK_TEAM_ID=T0123456789
```

## Triggers

| Event | Action |
|-------|--------|
| `message.posted` | Create message card |
| `reaction_added` | Create reaction card |
| `member_joined_channel` | Notify new member |

## Code Examples

```typescript
import { Slack } from '@timps/integrations';

const slack = new Slack({ token: process.env.SLACK_BOT_TOKEN });

// Post message
await slack.chat.postMessage({
  channel: 'C0123456789',
  text: 'Deployment complete!',
  blocks: [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Deployment* status' }
    }
  ]
});

// Create reminder
await slack.reminders.add({
  text: 'Review PR',
  time: 'tomorrow 10am',
  channel: 'C0123456789'
});
```

## Interactive Components

### Blocks

```javascript
{
  type: 'actions',
  elements: [
    { type: 'button', text: 'Approve', action_id: 'approve' },
    { type: 'button', text: 'Reject', action_id: 'reject' }
  ]
}
```

### Modals

```javascript
await slack.views.open({
  trigger_id: 'trigger_id',
  view: {
    type: 'modal',
    title: { type: 'plain_text', text: 'Submit' },
    blocks: [...],
    submit: { type: 'plain_text', text: 'Submit' }
  }
});
```