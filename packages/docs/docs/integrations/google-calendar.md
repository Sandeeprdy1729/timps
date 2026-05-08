---
sidebar_position: 25
---

# Google Calendar Integration

Connect Google Calendar for event management and scheduling.

## Features

- **Event CRUD**: Create, read, update, delete calendar events
- **Multiple Calendars**: Manage multiple calendars
- **Attendees**: Manage event attendees and responses
- **Reminders**: Set up email/popup reminders
- **Real-time Sync**: Webhooks for instant updates

## Authentication

### OAuth 2.0

```bash
timps connect google-calendar
```

## Scopes Required

- `https://www.googleapis.com/auth/calendar` - Manage calendars
- `https://www.googleapis.com/auth/calendar.events` - Manage events
- `https://www.googleapis.com/auth/calendar.readonly` - Read-only access

## Environment Variables

```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=secret
```

## Triggers

| Event | Action |
|-------|--------|
| `event.created` | Create activity card |
| `event.starting` | Send reminder |
| `event.updated` | Update card |
| `event.ended` | Log completion |

## Code Examples

```typescript
const calendar = new GoogleCalendar({ token });

// Create event
const event = await calendar.createEvent({
  summary: 'Meeting',
  start: { dateTime: '2024-01-01T10:00:00Z' },
  end: { dateTime: '2024-01-01T11:00:00Z' },
  attendees: [{ email: 'user@example.com' }],
});

// List events
const events = await calendar.listEvents({
  timeMin: new Date().toISOString(),
  maxResults: 10,
});
```

## Settings

- Default calendar selection
- Notification preferences
- Timezone settings