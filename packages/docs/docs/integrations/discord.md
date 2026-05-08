# Discord

Discord is a communication platform with API for bots and integrations.

## Features

- Text channels
- Voice channels
- Webhooks
- Bots
- Slash commands
- Custom emojis

## Installation

```bash
npm install @timps/discord
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { discordPlugin } from '@timps/discord';

const agent = createAgent({
  plugins: [
    discordPlugin({
      botToken: process.env.DISCORD_BOT_TOKEN,
    }),
  ],
});
```

## Usage

### Send Message

```typescript
await agent.tools.sendDiscordMessage({
  channelId: '123456789',
  content: 'Hello from TIMPS!',
});
```

### Send Embed

```typescript
await agent.tools.sendDiscordEmbed({
  channelId: '123456789',
  embed: {
    title: 'New Update',
    description: 'Version 2.0 is available',
    color: 0x3b82f6,
  },
});
```

### Create Thread

```typescript
await agent.tools.createDiscordThread({
  channelId: '123456789',
  name: 'Discussion',
  messageId: 'msg123',
});
```

## API Reference

`timps discord message` - Send message

`timps discord embed` - Send embed

`timps discord channel` - Manage channels