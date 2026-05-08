# Mixpanel

Mixpanel is a product analytics platform.

## Features

- Event tracking
- User profiles
- Cohorts
- Funnels
- A/B testing
- Export

## Installation

```bash
npm install @timps/mixpanel
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { mixpanelPlugin } from '@timps/mixpanel';

const agent = createAgent({
  plugins: [
    mixpanelPlugin({
      token: process.env.MIXPANEL_TOKEN,
    }),
  ],
});
```

## Usage

### Track Event

```typescript
await agent.tools.trackEvent({
  event: 'Button Click',
  properties: { buttonId: 'submit' },
});
```

### Set Profile

```typescript
await agent.tools.setProfile({
  userId: '123',
  properties: { plan: 'pro' },
});
```

## API Reference

`timps mixpanel track` - Track events

`timps mixpanel profile` - Manage profiles