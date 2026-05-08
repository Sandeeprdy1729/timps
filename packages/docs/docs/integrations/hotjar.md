# Hotjar

Hotjar provides heatmaps and session recordings.

## Features

- Heatmaps
- Session recordings
- Surveys
- Feedback
- Incoming requests

## Installation

```bash
npm install @timps/hotjar
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { hotjarPlugin } from '@timps/hotjar';

const agent = createAgent({
  plugins: [
    hotjarPlugin({
      siteId: process.env.HOTJAR_SITE_ID,
      apiToken: process.env.HOTJAR_API_TOKEN,
    }),
  ],
});
```

## Usage

### Identify User

```typescript
await agent.tools.hotjarIdentify({
  userId: '123',
  email: 'user@example.com',
});
```

### Track Event

```typescript
await agent.tools.hotjarEvent({
  event: 'form_submit',
});
```

## API Reference

`timps hotjar identify` - Identify user

`timps hotjar event` - Track event