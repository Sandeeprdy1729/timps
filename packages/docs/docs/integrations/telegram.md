---
id: telegram
title: Telegram Integration
description: Complete guide to integrating TIMPS with Telegram for bot messaging.
---

# Telegram Integration

TIMPS integrates with Telegram for bot-based messaging.

## Configuration

```bash
TELEGRAM_BOT_TOKEN=your-bot-token
```

## Usage

### Messages

```typescript
import { TelegramIntegration } from '@timps/integrations';

const telegram = new TelegramIntegration({
  botToken: process.env.TELEGRAM_BOT_TOKEN,
});

await telegram.connect();

// Send message
await telegram.sendMessage({
  chat_id: 'chat-id',
  text: 'Hello!',
});

// Send with keyboard
await telegram.sendMessage({
  chat_id: 'chat-id',
  text: 'Choose:',
  reply_markup: {
    inline_keyboard: [[{ text: 'Button', callback_data: 'action' }]],
  },
});
```

### Webhooks

```typescript
// Set webhook
await telegram.setWebhook('https://your-domain.com/webhook');

// Handle updates
app.post('/webhook', async (req, res) => {
  const update = req.body;
  // Process update
  res.send('OK');
});
```