# Calendly

Calendly is an online scheduling tool.

## Features

- Meeting scheduling
- Event types
- Webhooks
- Team scheduling

## Installation

```bash
npm install @timps/calendly
```

## Usage

### Schedule Meeting

```typescript
await agent.tools.scheduleMeeting({
  inviteeEmail: 'user@example.com',
  eventType: '30min',
});
```

### List Events

```typescript
const events = await agent.tools.listEvents();
```

## API Reference

`timps calendly schedule` - Schedule meeting

`timps calendly events` - List events