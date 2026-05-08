# Zoom

Zoom provides video conferencing and webinar platform.

## Features

- Video meetings
- Webinars
- Recording
- Breakout rooms
- Virtual backgrounds
- SDK integration

## Installation

```bash
npm install @timps/zoom
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { zoomPlugin } from '@timps/zoom';

const agent = createAgent({
  plugins: [
    zoomPlugin({
      accountId: process.env.ZOOM_ACCOUNT_ID,
      clientId: process.env.ZOOM_CLIENT_ID,
      clientSecret: process.env.ZOOM_CLIENT_SECRET,
    }),
  ],
});
```

## Usage

### Create Meeting

```typescript
const meeting = await agent.tools.createMeeting({
  topic: 'Team Standup',
  type: 2, // Scheduled
  startTime: '2024-01-01T09:00:00Z',
  duration: 30,
});
```

### Join Meeting

```typescript
await agent.tools.joinMeeting({
  meetingId: '123456789',
  password: 'abc123',
});
```

### List Recordings

```typescript
const recordings = await agent.tools.listRecordings({
  hostId: 'host@example.com',
});
```

## API Reference

`timps zoom meeting` - Manage meetings

`timps zoom recording` - Manage recordings

`timps zoom user` - Manage users