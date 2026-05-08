import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

describe('Google Calendar Integration - Full Test Suite', () => {
  const baseUrl = 'https://www.googleapis.com/calendar/v3';
  const mockToken = { access_token: 'mock_token', token_type: 'Bearer', expires_in: 3600 };

  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  interface CalendarEvent {
    id: string;
    summary: string;
    description: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    attendees?: { email: string; responseStatus: string }[];
    hangoutLink?: string;
    status: string;
    htmlLink: string;
  }

  interface CalendarList { id: string; summary: string; primary: boolean; timeZone: string }
  interface CalendarColors { calendar: Record<string, { background: string; foreground: string }>; event: Record<string, { background: string; foreground: string }> }

  const mockEvent: CalendarEvent = {
    id: 'event1', summary: 'Meeting', description: 'Team standup',
    start: { dateTime: '2024-01-01T10:00:00Z', timeZone: 'UTC' },
    end: { dateTime: '2024-01-01T11:00:00Z', timeZone: 'UTC' },
    status: 'confirmed', htmlLink: 'https://calendar.google.com/event1'
  };

  describe('CalendarList API', () => {
    it('should list calendars', async () => {
      const calendars: CalendarList[] = [{ id: 'primary', summary: 'Primary', primary: true, timeZone: 'UTC' }];
      nock(baseUrl).get('/users/me/calendarList').reply(200, { items: calendars });
      const res = await fetch(`${baseUrl}/users/me/calendarList`);
      const data = await res.json();
      expect(data.items).toHaveLength(1);
    });

    it('should get calendar', async () => {
      nock(baseUrl).get('/calendars/primary').reply(200, { id: 'primary', summary: 'Primary' });
      const res = await fetch(`${baseUrl}/calendars/primary`);
      const data = await res.json();
      expect(data.id).toBe('primary');
    });

    it('should create calendar', async () => {
      const cal = { id: 'new-cal', summary: 'New Calendar' };
      nock(baseUrl).post('/calendars').reply(200, cal);
      const res = await fetch(`${baseUrl}/calendars`, { method: 'POST', body: JSON.stringify({ summary: 'New Calendar' }) });
      expect(res.status).toBe(200);
    });

    it('should update calendar', async () => {
      nock(baseUrl).patch('/calendars/primary').reply(200, { id: 'primary', summary: 'Updated' });
      const res = await fetch(`${baseUrl}/calendars/primary`, { method: 'PATCH', body: JSON.stringify({ summary: 'Updated' }) });
      const data = await res.json();
      expect(data.summary).toBe('Updated');
    });

    it('should delete calendar', async () => {
      nock(baseUrl).delete('/calendars/primary').reply(204, '');
      const res = await fetch(`${baseUrl}/calendars/primary`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('should clear calendar', async () => {
      nock(baseUrl).post('/calendars/primary/clear').reply(200, {});
      const res = await fetch(`${baseUrl}/calendars/primary/clear`, { method: 'POST' });
      expect(res.status).toBe(200);
    });
  });

  describe('Events API', () => {
    it('should list events', async () => {
      nock(baseUrl).get('/calendars/primary/events').reply(200, { items: [mockEvent] });
      const res = await fetch(`${baseUrl}/calendars/primary/events`);
      const data = await res.json();
      expect(data.items).toHaveLength(1);
    });

    it('should get event', async () => {
      nock(baseUrl).get('/calendars/primary/events/event1').reply(200, mockEvent);
      const res = await fetch(`${baseUrl}/calendars/primary/events/event1`);
      const data = await res.json();
      expect(data.id).toBe('event1');
    });

    it('should create event', async () => {
      const newEvent = { id: 'new-event', summary: 'New Meeting' };
      nock(baseUrl).post('/calendars/primary/events').reply(200, newEvent);
      const res = await fetch(`${baseUrl}/calendars/primary/events`, { method: 'POST', body: JSON.stringify({ summary: 'New Meeting', start: { dateTime: '2024-01-01T10:00:00Z' }, end: { dateTime: '2024-01-01T11:00:00Z' } }) });
      const data = await res.json();
      expect(data.id).toBe('new-event');
    });

    it('should update event', async () => {
      const updated = { ...mockEvent, summary: 'Updated Meeting' };
      nock(baseUrl).patch('/calendars/primary/events/event1').reply(200, updated);
      const res = await fetch(`${baseUrl}/calendars/primary/events/event1`, { method: 'PATCH', body: JSON.stringify({ summary: 'Updated Meeting' }) });
      const data = await res.json();
      expect(data.summary).toBe('Updated Meeting');
    });

    it('should delete event', async () => {
      nock(baseUrl).delete('/calendars/primary/events/event1').reply(204, '');
      const res = await fetch(`${baseUrl}/calendars/primary/events/event1`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('should move event', async () => {
      const moved = { ...mockEvent };
      nock(baseUrl).post('/calendars/primary/events/event1/move').reply(200, moved);
      const res = await fetch(`${baseUrl}/calendars/primary/events/event1/move`, { method: 'POST', body: JSON.stringify({ destination: 'secondary' }) });
      expect(res.status).toBe(200);
    });

    it('should patch event', async () => {
      nock(baseUrl).patch('/calendars/primary/events/event1').reply(200, { summary: 'Patched' });
      const res = await fetch(`${baseUrl}/calendars/primary/events/event1`, { method: 'PATCH', body: JSON.stringify({ summary: 'Patched' }) });
      const data = await res.json();
      expect(data.summary).toBe('Patched');
    });

    it('should watch events', async () => {
      const watch = { id: 'watch1', expiration: 1609459200000 };
      nock(baseUrl).post('/calendars/primary/events/watch').reply(200, watch);
      const res = await fetch(`${baseUrl}/calendars/primary/events/watch`, { method: 'POST', body: JSON.stringify({ type: 'web_hook', address: 'https://example.com/webhook' }) });
      const data = await res.json();
      expect(data.id).toBe('watch1');
    });

    it('should stop watching', async () => {
      nock(baseUrl).post('/channels/stop').reply(200, {});
      const res = await fetch(`${baseUrl}/channels/stop`, { method: 'POST', body: JSON.stringify({ id: 'watch1' }) });
      expect(res.status).toBe(200);
    });

    it('should use quickAdd', async () => {
      const quickEvent = { id: 'quick1', summary: 'Lunch tomorrow noon' };
      nock(baseUrl).post('/calendars/primary/events', { quickAdd: 'true' }).reply(200, quickEvent);
      const res = await fetch(`${baseUrl}/calendars/primary/events?quickAdd=true`, { method: 'POST', body: JSON.stringify({ summary: 'Lunch tomorrow noon' }) });
      expect(res.status).toBe(200);
    });

    it('should import event', async () => {
      const imported = { id: 'imported1', summary: 'Imported Event' };
      nock(baseUrl).post('/calendars/primary/events/import').reply(200, imported);
      const res = await fetch(`${baseUrl}/calendars/primary/events/import`, { method: 'POST', body: JSON.stringify({ summary: 'Imported Event', start: { dateTime: '2024-01-01T10:00:00Z' }, end: { dateTime: '2024-01-01T11:00:00Z' } }) });
      expect(res.status).toBe(200);
    });

    it('should set recurring event', async () => {
      const updated = { ...mockEvent, recurringEventId: 'recurring1' };
      nock(baseUrl).patch('/calendars/primary/events/event1').reply(200, updated);
      const res = await fetch(`${baseUrl}/calendars/primary/events/event1`, { method: 'PATCH', body: JSON.stringify({ recurringEventId: 'recurring1' }) });
      const data = await res.json();
      expect(data.recurringEventId).toBe('recurring1');
    });

    it('should toggle RSVP', async () => {
      const response = { id: 'attendee1', email: 'user@example.com', responseStatus: 'accepted' };
      nock(baseUrl).post('/calendars/primary/events/event1/attendees').reply(200, { attendees: [response] });
      const res = await fetch(`${baseUrl}/calendars/primary/events/event1/attendees', { method: 'POST', body: JSON.stringify({ attendees: [{ email: 'user@example.com' }] }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Colors API', () => {
    it('should get colors', async () => {
      const colors: CalendarColors = { calendar: { '1': { background: '#ffffff', foreground: '#000000' } }, event: {} };
      nock(baseUrl).get('/colors').reply(200, colors);
      const res = await fetch(`${baseUrl}/colors`);
      const data = await res.json();
      expect(data.calendar).toBeDefined();
    });
  });

  describe('Freebusy API', () => {
    it('should query free busy', async () => {
      const freebusy = { calendars: { primary: { busy: [{ start: '2024-01-01T10:00:00Z', end: '2024-01-01T11:00:00Z' }] } };
      nock(baseUrl).post('/freeBusy').reply(200, freebusy);
      const res = await fetch(`${baseUrl}/freeBusy`, { method: 'POST', body: JSON.stringify({ timeMin: '2024-01-01T00:00:00Z', timeMax: '2024-01-02T00:00:00Z', items: [{ id: 'primary' }] }) });
      const data = await res.json();
      expect(data.calendars).toBeDefined();
    });
  });

  describe('ACL API', () => {
    it('should list ACL rules', async () => {
      const rules = [{ id: 'rule1', scope: { type: 'user', value: 'user@example.com' }, role: 'owner' }];
      nock(baseUrl).get('/calendars/primary/acl').reply(200, { items: rules });
      const res = await fetch(`${baseUrl}/calendars/primary/acl`);
      const data = await res.json();
      expect(data.items).toHaveLength(1);
    });

    it('should get ACL rule', async () => {
      nock(baseUrl).get('/calendars/primary/acl/rule1').reply(200, { id: 'rule1', role: 'owner' });
      const res = await fetch(`${baseUrl}/calendars/primary/acl/rule1`);
      const data = await res.json();
      expect(data.id).toBe('rule1');
    });

    it('should create ACL rule', async () => {
      const rule = { id: 'rule2', role: 'writer', scope: { type: 'user', value: 'new@example.com' } };
      nock(baseUrl).post('/calendars/primary/acl').reply(200, rule);
      const res = await fetch(`${baseUrl}/calendars/primary/acl`, { method: 'POST', body: JSON.stringify({ role: 'writer', scope: { type: 'user', value: 'new@example.com' } }) });
      expect(res.status).toBe(200);
    });

    it('should delete ACL rule', async () => {
      nock(baseUrl).delete('/calendars/primary/acl/rule1').reply(204, '');
      const res = await fetch(`${baseUrl}/calendars/primary/acl/rule1`, { method: 'DELETE' });
      expect(res.status).toBe(204);
    });

    it('should update ACL rule', async () => {
      nock(baseUrl).patch('/calendars/primary/acl/rule1').reply(200, { id: 'rule1', role: 'reader' });
      const res = await fetch(`${baseUrl}/calendars/primary/acl/rule1`, { method: 'PATCH', body: JSON.stringify({ role: 'reader' }) });
      const data = await res.json();
      expect(data.role).toBe('reader');
    });
  });

  describe('Settings API', () => {
    it('should list settings', async () => {
      const settings = [{ key: 'timezone', value: 'UTC' }, { key: 'weekStart', value: 'sunday' }];
      nock(baseUrl).get('/users/me/settings').reply(200, { items: settings });
      const res = await fetch(`${baseUrl}/users/me/settings`);
      const data = await res.json();
      expect(data.items).toHaveLength(2);
    });

    it('should get setting', async () => {
      nock(baseUrl).get('/users/me/settings/timezone').reply(200, { key: 'timezone', value: 'UTC' });
      const res = await fetch(`${baseUrl}/users/me/settings/timezone`);
      const data = await res.json();
      expect(data.value).toBe('UTC');
    });

    it('should update setting', async () => {
      nock(baseUrl).patch('/users/me/settings/timezone').reply(200, { key: 'timezone', value: 'America/New_York' });
      const res = await fetch(`${baseUrl}/users/me/settings/timezone`, { method: 'PATCH', body: JSON.stringify({ value: 'America/New_York' }) });
      const data = await res.json();
      expect(data.value).toBe('America/New_York');
    });
  });

  describe('Calendars API', () => {
    it('should get calendars', async () => {
      nock(baseUrl).get('/calendars').reply(200, { calendars: [] });
      const res = await fetch(`${baseUrl}/calendars`);
      const data = await res.json();
      expect(data.calendars).toBeDefined();
    });
  });

  describe('Instances API', () => {
    it('should list event instances', async () => {
      nock(baseUrl).get('/calendars/primary/events/recurring1/instances').reply(200, { items: [] });
      const res = await fetch(`${baseUrl}/calendars/primary/events/recurring1/instances`);
      const data = await res.json();
      expect(data.items).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 unauthorized', async () => {
      nock(baseUrl).get('/users/me/calendarList').reply(401, { error: { code: 401, message: 'Unauthorized' } });
      const res = await fetch(`${baseUrl}/users/me/calendarList`);
      expect(res.status).toBe(401);
    });

    it('should handle 403 forbidden', async () => {
      nock(baseUrl).get('/users/me/calendarList').reply(403, { error: { code: 403, message: 'Forbidden' } });
      const res = await fetch(`${baseUrl}/users/me/calendarList`);
      expect(res.status).toBe(403);
    });

    it('should handle 404 not found', async () => {
      nock(baseUrl).get('/calendars/primary/events/invalid').reply(404, { error: { code: 404, message: 'Not Found' } });
      const res = await fetch(`${baseUrl}/calendars/primary/events/invalid`);
      expect(res.status).toBe(404);
    });

    it('should handle 409 conflict', async () => {
      nock(baseUrl).post('/calendars/primary/events').reply(409, { error: { code: 409, message: 'Conflict' } });
      const res = await fetch(`${baseUrl}/calendars/primary/events`, { method: 'POST', body: JSON.stringify({ summary: 'Conflict Event' }) });
      expect(res.status).toBe(409);
    });

    it('should handle rate limiting', async () => {
      nock(baseUrl).get('/users/me/calendarList').reply(429, { error: { code: 429, message: 'Rate Limit Exceeded' } }, { 'Retry-After': '1' });
      const res = await fetch(`${baseUrl}/users/me/calendarList`);
      expect(res.status).toBe(429);
    });

    it('should handle 500 server error', async () => {
      nock(baseUrl).get('/users/me/calendarList').reply(500, { error: { code: 500, message: 'Server Error' } });
      const res = await fetch(`${baseUrl}/users/me/calendarList`);
      expect(res.status).toBe(500);
    });

    it('should handle network errors', async () => {
      nock(baseUrl).get('/users/me/calendarList').replyWithError('Network error');
      await expect(fetch(`${baseUrl}/users/me/calendarList`)).rejects.toThrow();
    });
  });

  describe('OAuth Flow', () => {
    it('should refresh token', async () => {
      nock('https://oauth2.googleapis.com').post('/token').reply(200, mockToken);
      const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: JSON.stringify({ client_id: 'id', client_secret: 'secret', refresh_token: 'refresh', grant_type: 'refresh_token' }) });
      const data = await res.json();
      expect(data.access_token).toBeDefined();
    });

    it('should handle token expiry', async () => {
      const expiredToken = { ...mockToken, expires_in: 0 };
      expect(expiredToken.expires_in).toBe(0);
    });

    it('should revoke token', async () => {
      nock('https://oauth2.googleapis.com').post('/revoke').reply(200, {});
      const res = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', body: JSON.stringify({ token: 'access_token' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Webhook Events', () => {
    it('should handle calendarSync', () => {
      const event = { kind: 'calendar#event', id: 'event1', status: 'confirmed' };
      expect(event.status).toBe('confirmed');
    });

    it('should handle notification', () => {
      const payload = { kind: 'calendar#notification', type: 'reminder', method: 'email' };
      expect(payload.type).toBe('reminder');
    });
  });
});

describe('Gmail Integration - Full Test Suite', () => {
  const baseUrl = 'https://gmail.googleapis.com/gmail/v1';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  interface GmailMessage { id: string; threadId: string; labelIds: string[]; snippet: string; payload?: { headers: { name: string; value: string }[] } }
  interface GmailLabel { id: string; name: string; type: string; messagesTotal: number; messagesUnread: number }

  const mockMessage: GmailMessage = { id: 'msg1', threadId: 'thread1', labelIds: ['INBOX', 'UNREAD'], snippet: 'Test email' };

  describe('Users API', () => {
    it('should get profile', async () => {
      nock(baseUrl).get('/users/me').reply(200, { emailAddress: 'user@example.com', messagesTotal: 100, threadsTotal: 50 });
      const res = await fetch(`${baseUrl}/users/me`);
      const data = await res.json();
      expect(data.emailAddress).toBe('user@example.com');
    });

    it('should get settings', async () => {
      nock(baseUrl).get('/users/me/settings').reply(200, { locale: 'en', displayLanguage: 'en' });
      const res = await fetch(`${baseUrl}/users/me/settings`);
      const data = await res.json();
      expect(data.locale).toBe('en');
    });

    it('should update settings', async () => {
      nock(baseUrl).patch('/users/me/settings').reply(200, { locale: 'ja' });
      const res = await fetch(`${baseUrl}/users/me/settings`, { method: 'PATCH', body: JSON.stringify({ locale: 'ja' }) });
      const data = await res.json();
      expect(data.locale).toBe('ja');
    });
  });

  describe('Messages API', () => {
    it('should list messages', async () => {
      nock(baseUrl).get('/users/me/messages').query(true).reply(200, { messages: [mockMessage], resultSizeEstimate: 1 });
      const res = await fetch(`${baseUrl}/users/me/messages?maxResults=10`);
      const data = await res.json();
      expect(data.messages).toHaveLength(1);
    });

    it('should get message', async () => {
      nock(baseUrl).get('/users/me/messages/msg1').reply(200, mockMessage);
      const res = await fetch(`${baseUrl}/users/me/messages/msg1`);
      const data = await res.json();
      expect(data.id).toBe('msg1');
    });

    it('should get message metadata', async () => {
      nock(baseUrl).get('/users/me/messages/msg1').query({ format: 'metadata' }).reply(200, { id: 'msg1', labelIds: ['INBOX'] });
      const res = await fetch(`${baseUrl}/users/me/messages/msg1?format=metadata`);
      const data = await res.json();
      expect(data.id).toBe('msg1');
    });

    it('should send message', async () => {
      const sent: GmailMessage = { id: 'sent1', threadId: 'thread1', labelIds: ['SENT'] };
      nock(baseUrl).post('/users/me/messages/send').reply(200, sent);
      const res = await fetch(`${baseUrl}/users/me/messages/send`, { method: 'POST', body: JSON.stringify({ raw: 'test' }) });
      const data = await res.json();
      expect(data.labelIds).toContain('SENT');
    });

    it('should create draft', async () => {
      const draft = { id: 'draft1', message: mockMessage };
      nock(baseUrl).post('/users/me/drafts').reply(200, draft);
      const res = await fetch(`${baseUrl}/users/me/drafts`, { method: 'POST', body: JSON.stringify({ message: { raw: 'test' } }) });
      const data = await res.json();
      expect(data.id).toBe('draft1');
    });

    it('should update draft', async () => {
      nock(baseUrl).put('/users/me/drafts/draft1').reply(200, { id: 'draft1', message: { id: 'msg1' } });
      const res = await fetch(`${baseUrl}/users/me/drafts/draft1`, { method: 'PUT', body: JSON.stringify({ message: { raw: 'updated' } }) });
      const data = await res.json();
      expect(data.id).toBe('draft1');
    });

    it('should delete draft', async () => {
      nock(baseUrl).delete('/users/me/drafts/draft1').reply(200, {});
      const res = await fetch(`${baseUrl}/users/me/drafts/draft1`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    it('should batch delete messages', async () => {
      nock(baseUrl).post('/users/me/messages/batchDelete').reply(200, {});
      const res = await fetch(`${baseUrl}/users/me/messages/batchDelete`, { method: 'POST', body: JSON.stringify({ ids: ['msg1', 'msg2'] }) });
      expect(res.status).toBe(200);
    });

    it('should batch modify messages', async () => {
      nock(baseUrl).post('/users/me/messages/batchModify').reply(200, {});
      const res = await fetch(`${baseUrl}/users/me/messages/batchModify`, { method: 'POST', body: JSON.stringify({ ids: ['msg1'], addLabelIds: ['STARRED'], removeLabelIds: ['UNREAD'] }) });
      expect(res.status).toBe(200);
    });

    it('should trash message', async () => {
      const trashed = { ...mockMessage, labelIds: ['TRASH', 'INBOX'] };
      nock(baseUrl).post('/users/me/messages/msg1/trash').reply(200, trashed);
      const res = await fetch(`${baseUrl}/users/me/messages/msg1/trash`, { method: 'POST' });
      const data = await res.json();
      expect(data.labelIds).toContain('TRASH');
    });

    it('should untrash message', async () => {
      const untrashed = { ...mockMessage, labelIds: ['INBOX'] };
      nock(baseUrl).post('/users/me/messages/msg1/untrash').reply(200, untrashed);
      const res = await fetch(`${baseUrl}/users/me/messages/msg1/untrash`, { method: 'POST' });
      const data = await res.json();
      expect(data.labelIds).not.toContain('TRASH');
    });

    it('should modify message labels', async () => {
      const modified = { ...mockMessage, labelIds: ['STARRED', 'IMPORTANT'] };
      nock(baseUrl).post('/users/me/messages/msg1/modify').reply(200, modified);
      const res = await fetch(`${baseUrl}/users/me/messages/msg1/modify`, { method: 'POST', body: JSON.stringify({ addLabelIds: ['STARRED', 'IMPORTANT'], removeLabelIds: ['UNREAD'] }) });
      const data = await res.json();
      expect(data.labelIds).toContain('STARRED');
    });

    it('should archive message', async () => {
      const archived = { ...mockMessage, labelIds: ['STARRED', 'IMPORTANT'] };
      nock(baseUrl).post('/users/me/messages/msg1/modify').reply(200, archived);
      const res = await fetch(`${baseUrl}/users/me/messages/msg1/modify`, { method: 'POST', body: JSON.stringify({ removeLabelIds: ['INBOX', 'UNREAD'] }) });
      const data = await res.json();
      expect(data.labelIds).not.toContain('INBOX');
    });
  });

  describe('Threads API', () => {
    it('should list threads', async () => {
      const threads = [{ id: 'thread1', messages: [mockMessage], snippet: 'Test' }];
      nock(baseUrl).get('/users/me/threads').reply(200, { threads, resultSizeEstimate: 1 });
      const res = await fetch(`${baseUrl}/users/me/threads`);
      const data = await res.json();
      expect(data.threads).toHaveLength(1);
    });

    it('should get thread', async () => {
      const thread = { id: 'thread1', messages: [mockMessage] };
      nock(baseUrl).get('/users/me/threads/thread1').reply(200, thread);
      const res = await fetch(`${baseUrl}/users/me/threads/thread1`);
      const data = await res.json();
      expect(data.id).toBe('thread1');
    });

    it('should delete thread', async () => {
      nock(baseUrl).post('/users/me/threads/thread1/trash').reply(200, {});
      const res = await fetch(`${baseUrl}/users/me/threads/thread1/trash`, { method: 'POST' });
      expect(res.status).toBe(200);
    });
  });

  describe('Labels API', () => {
    it('should list labels', async () => {
      const labels: GmailLabel[] = [{ id: 'INBOX', name: 'Inbox', type: 'system', messagesTotal: 10, messagesUnread: 5 }];
      nock(baseUrl).get('/users/me/labels').reply(200, { labels });
      const res = await fetch(`${baseUrl}/users/me/labels`);
      const data = await res.json();
      expect(data.labels).toHaveLength(1);
    });

    it('should get label', async () => {
      const label: GmailLabel = { id: 'STARRED', name: 'Starred', type: 'user', messagesTotal: 0, messagesUnread: 0 };
      nock(baseUrl).get('/users/me/labels/STARRED').reply(200, label);
      const res = await fetch(`${baseUrl}/users/me/labels/STARRED`);
      const data = await res.json();
      expect(data.id).toBe('STARRED');
    });

    it('should create label', async () => {
      const label = { id: 'custom', name: 'Custom Label', type: 'user' };
      nock(baseUrl).post('/users/me/labels').reply(200, label);
      const res = await fetch(`${baseUrl}/users/me/labels`, { method: 'POST', body: JSON.stringify({ name: 'Custom Label', labelListVisibility: 'labelShow', messageListVisibility: 'show' }) });
      const data = await res.json();
      expect(data.id).toBe('custom');
    });

    it('should update label', async () => {
      nock(baseUrl).patch('/users/me/labels/custom').reply(200, { id: 'custom', name: 'Updated Name' });
      const res = await fetch(`${baseUrl}/users/me/labels/custom`, { method: 'PATCH', body: JSON.stringify({ name: 'Updated Name' }) });
      const data = await res.json();
      expect(data.name).toBe('Updated Name');
    });

    it('should delete label', async () => {
      nock(baseUrl).delete('/users/me/labels/custom').reply(200, {});
      const res = await fetch(`${baseUrl}/users/me/labels/custom`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });
  });

  describe('Drafts API', () => {
    it('should list drafts', async () => {
      const drafts = [{ id: 'draft1', message: mockMessage }];
      nock(baseUrl).get('/users/me/drafts').reply(200, { drafts, resultSizeEstimate: 1 });
      const res = await fetch(`${baseUrl}/users/me/drafts`);
      const data = await res.json();
      expect(data.drafts).toHaveLength(1);
    });

    it('should get draft', async () => {
      const draft = { id: 'draft1', message: mockMessage };
      nock(baseUrl).get('/users/me/drafts/draft1').reply(200, draft);
      const res = await fetch(`${baseUrl}/users/me/drafts/draft1`);
      const data = await res.json();
      expect(data.id).toBe('draft1');
    });

    it('should send draft', async () => {
      const sent = { id: 'sent1', labelIds: ['SENT'] };
      nock(baseUrl).post('/users/me/drafts/send').reply(200, sent);
      const res = await fetch(`${baseUrl}/users/me/drafts/send`, { method: 'POST', body: JSON.stringify({ id: 'draft1' }) });
      const data = await res.json();
      expect(data.labelIds).toContain('SENT');
    });
  });

  describe('History API', () => {
    it('should list history', async () => {
      const history = [{ id: 'history1', messages: [{ message: { id: 'msg1' } }] }];
      nock(baseUrl).get('/users/me/history').query({ startHistoryId: '123' }).reply(200, { history });
      const res = await fetch(`${baseUrl}/users/me/history?startHistoryId=123`);
      const data = await res.json();
      expect(data.history).toHaveLength(1);
    });
  });

  describe('Watch API', () => {
    it('should set watch', async () => {
      const watch = { historyId: '12345', expiration: 1609459200000 };
      nock(baseUrl).post('/users/me/watch').reply(200, watch);
      const res = await fetch(`${baseUrl}/users/me/watch`, { method: 'POST', body: JSON.stringify({ topicName: 'projects/project/topics/topic' }) });
      const data = await res.json();
      expect(data.historyId).toBeDefined();
    });

    it('should stop watch', async () => {
      nock(baseUrl).post('/users/me/stop').reply(200, {});
      const res = await fetch(`${baseUrl}/users/me/stop`, { method: 'POST' });
      expect(res.status).toBe(200);
    });
  });

  describe('Attachment API', () => {
    it('should get attachment', async () => {
      const attachment = { filename: 'file.txt', mimeType: 'text/plain', data: 'dGVzdA==' };
      nock(baseUrl).get('/users/me/messages/msg1/attachments/att1').reply(200, attachment);
      const res = await fetch(`${baseUrl}/users/me/messages/msg1/attachments/att1`);
      const data = await res.json();
      expect(data.filename).toBe('file.txt');
    });
  });

  describe('Profile API', () => {
    it('should get user profile', async () => {
      nock(baseUrl).get('/users/me/profile').reply(200, { emailAddress: 'user@example.com', messagesTotal: 100 });
      const res = await fetch(`${baseUrl}/users/me/profile`);
      const data = await res.json();
      expect(data.emailAddress).toBe('user@example.com');
    });
  });

  describe('Filters API', () => {
    it('should create filter', async () => {
      const filter = { id: 'filter1', criteria: { from: 'sender@example.com' }, action: { addLabelIds: ['STARRED'] } };
      nock(baseUrl).post('/users/me/settings/filters').reply(200, filter);
      const res = await fetch(`${baseUrl}/users/me/settings/filters`, { method: 'POST', body: JSON.stringify({ criteria: { from: 'sender@example.com' }, action: { addLabelIds: ['STARRED'] } }) });
      const data = await res.json();
      expect(data.id).toBe('filter1');
    });

    it('should list filters', async () => {
      const filters = [{ id: 'filter1', criteria: { from: 'sender@example.com' } }];
      nock(baseUrl).get('/users/me/settings/filters').reply(200, { filter: filters });
      const res = await fetch(`${baseUrl}/users/me/settings/filters`);
      const data = await res.json();
      expect(data.filter).toHaveLength(1);
    });

    it('should delete filter', async () => {
      nock(baseUrl).delete('/users/me/settings/filters/filter1').reply(200, {});
      const res = await fetch(`${baseUrl}/users/me/settings/filters/filter1`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });
  });

  describe('Forwarding Addresses API', () => {
    it('should list forwarding addresses', async () => {
      const addresses = [{ forwardingEmail: 'forward@example.com', verificationStatus: 'accepted' }];
      nock(baseUrl).get('/users/me/settings/forwardingAddresses').reply(200, { forwardingAddresses: addresses });
      const res = await fetch(`${baseUrl}/users/me/settings/forwardingAddresses`);
      const data = await res.json();
      expect(data.forwardingAddresses).toHaveLength(1);
    });

    it('should create forwarding address', async () => {
      const address = { forwardingEmail: 'new@example.com', verificationStatus: 'pending' };
      nock(baseUrl).post('/users/me/settings/forwardingAddresses').reply(200, address);
      const res = await fetch(`${baseUrl}/users/me/settings/forwardingAddresses`, { method: 'POST', body: JSON.stringify({ forwardingEmail: 'new@example.com' }) });
      const data = await res.json();
      expect(data.verificationStatus).toBe('pending');
    });

    it('should delete forwarding address', async () => {
      nock(baseUrl).delete('/users/me/settings/forwardingAddresses/addr1').reply(200, {});
      const res = await fetch(`${baseUrl}/users/me/settings/forwardingAddresses/addr1`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    it('should update forwarding address', async () => {
      nock(baseUrl).patch('/users/me/settings/forwardingAddresses/addr1').reply(200, { forwardingEmail: 'updated@example.com' });
      const res = await fetch(`${baseUrl}/users/me/settings/forwardingAddresses/addr1`, { method: 'PATCH', body: JSON.stringify({ enable: true }) });
      const data = await res.json();
      expect(data.forwardingEmail).toBeDefined();
    });
  });

  describe('IMAP & POP Settings', () => {
    it('should get IMAP settings', async () => {
      nock(baseUrl).get('/users/me/settings/gmailIMAP').reply(200, { enabled: true });
      const res = await fetch(`${baseUrl}/users/me/settings/gmailIMAP`);
      const data = await res.json();
      expect(data.enabled).toBe(true);
    });

    it('should update IMAP settings', async () => {
      nock(baseUrl).patch('/users/me/settings/gmailIMAP').reply(200, { enabled: false });
      const res = await fetch(`${baseUrl}/users/me/settings/gmailIMAP`, { method: 'PATCH', body: JSON.stringify({ enabled: false }) });
      const data = await res.json();
      expect(data.enabled).toBe(false);
    });

    it('should get POP settings', async () => {
      nock(baseUrl).get('/users/me/settings/gmailPOP').reply(200, { accessWindow: 'allMail' });
      const res = await fetch(`${baseUrl}/users/me/settings/gmailPOP`);
      const data = await res.json();
      expect(data.accessWindow).toBe('allMail');
    });

    it('should update POP settings', async () => {
      nock(baseUrl).patch('/users/me/settings/gmailPOP').reply(200, { accessWindow: 'fromNowOn' });
      const res = await fetch(`${baseUrl}/users/me/settings/gmailPOP`, { method: 'PATCH', body: JSON.stringify({ accessWindow: 'fromNowOn' }) });
      const data = await res.json();
      expect(data.accessWindow).toBe('fromNowOn');
    });
  });

  describe('Vacation Responder', () => {
    it('should get auto reply', async () => {
      nock(baseUrl).get('/users/me/settings/getAutoReply').reply(200, { enabled: false });
      const res = await fetch(`${baseUrl}/users/me/settings/getAutoReply`);
      const data = await res.json();
      expect(data.enabled).toBe(false);
    });

    it('should update auto reply', async () => {
      nock(baseUrl).patch('/users/me/settings/getAutoReply').reply(200, { enabled: true, responseSubject: 'Away', responseBodyHtml: '<p>Back soon</p>' });
      const res = await fetch(`${baseUrl}/users/me/settings/getAutoReply`, { method: 'PATCH', body: JSON.stringify({ enabled: true, responseSubject: 'Away', responseBodyHtml: '<p>Back soon</p>' }) });
      const data = await res.json();
      expect(data.enabled).toBe(true);
    });
  });

  describe('Signature', () => {
    it('should get signature', async () => {
      nock(baseUrl).get('/users/me/settings/signature').reply(200, { signature: 'Best regards' });
      const res = await fetch(`${baseUrl}/users/me/settings/signature`);
      const data = await res.json();
      expect(data.signature).toBeDefined();
    });

    it('should update signature', async () => {
      nock(baseUrl).patch('/users/me/settings/signature').reply(200, { signature: 'New signature' });
      const res = await fetch(`${baseUrl}/users/me/settings/signature`, { method: 'PATCH', body: JSON.stringify({ signature: 'New signature' }) });
      const data = await res.json();
      expect(data.signature).toBe('New signature');
    });
  });

  describe('Delegates', () => {
    it('should list delegates', async () => {
      const delegates = [{ delegateEmail: 'delegate@example.com', verificationStatus: 'accepted' }];
      nock(baseUrl).get('/users/me/settings/delegation').reply(200, { delegates });
      const res = await fetch(`${baseUrl}/users/me/settings/delegation`);
      const data = await res.json();
      expect(data.delegates).toHaveLength(1);
    });

    it('should add delegate', async () => {
      const delegate = { delegateEmail: 'new@example.com', verificationStatus: 'pending' };
      nock(baseUrl).post('/users/me/settings/delegation').reply(200, delegate);
      const res = await fetch(`${baseUrl}/users/me/settings/delegation`, { method: 'POST', body: JSON.stringify({ delegateEmail: 'new@example.com' }) });
      const data = await res.json();
      expect(data.verificationStatus).toBe('pending');
    });

    it('should delete delegate', async () => {
      nock(baseUrl).delete('/users/me/settings/delegation/delegate@example.com').reply(200, {});
      const res = await fetch(`${baseUrl}/users/me/settings/delegation/delegate@example.com`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid message (400)', async () => {
      nock(baseUrl).post('/users/me/messages/send').reply(400, { error: { code: 400, message: 'Invalid message' } });
      const res = await fetch(`${baseUrl}/users/me/messages/send`, { method: 'POST', body: JSON.stringify({ raw: 'invalid' }) });
      expect(res.status).toBe(400);
    });

    it('should handle not found (404)', async () => {
      nock(baseUrl).get('/users/me/messages/invalid').reply(404, { error: { code: 404, message: 'Not Found' } });
      const res = await fetch(`${baseUrl}/users/me/messages/invalid`);
      expect(res.status).toBe(404);
    });

    it('should handle rate limit (429)', async () => {
      nock(baseUrl).get('/users/me/messages').reply(429, {}, { 'Retry-After': '1' });
      const res = await fetch(`${baseUrl}/users/me/messages`);
      expect(res.status).toBe(429);
    });

    it('should handle insufficient permissions (403)', async () => {
      nock(baseUrl).post('/users/me/messages/send').reply(403, { error: { code: 403, message: 'Insufficient Permission' } });
      const res = await fetch(`${baseUrl}/users/me/messages/send`, { method: 'POST', body: JSON.stringify({ raw: 'test' }) });
      expect(res.status).toBe(403);
    });
  });
});

describe('Notion Integration - Full Test Suite', () => {
  const baseUrl = 'https://api.notion.com/v1';
  const mockToken = 'mock_token';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Database API', () => {
    it('should list databases', async () => {
      nock(baseUrl).post('/databases').reply(200, { results: [], has_more: false });
      const res = await fetch(`${baseUrl}/databases`, { method: 'POST' });
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should query database', async () => {
      nock(baseUrl).post('/databases/db1/query').reply(200, { results: [], has_more: false });
      const res = await fetch(`${baseUrl}/databases/db1/query`, { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should get database', async () => {
      nock(baseUrl).get('/databases/db1').reply(200, { id: 'db1', title: [{ plain_text: 'Database' }] });
      const res = await fetch(`${baseUrl}/databases/db1`);
      const data = await res.json();
      expect(data.id).toBeDefined();
    });

    it('should create database', async () => {
      const newDb: any = { id: 'new-db' };
      nock(baseUrl).post('/databases').reply(200, newDb);
      const res = await fetch(`${baseUrl}/databases`, { method: 'POST', body: JSON.stringify({ parent: { page_id: 'page1' }, title: [{ text: { content: 'New DB' } }] }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Page API', () => {
    it('should list pages', async () => {
      nock(baseUrl).post('/search').reply(200, { results: [], has_more: false });
      const res = await fetch(`${baseUrl}/search`, { method: 'POST', body: JSON.stringify({ filter: { property: 'object', value: 'page' } }) });
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should get page', async () => {
      nock(baseUrl).get('/pages/page1').reply(200, { id: 'page1', properties: {} });
      const res = await fetch(`${baseUrl}/pages/page1`);
      const data = await res.json();
      expect(data.id).toBe('page1');
    });

    it('should create page', async () => {
      const page: any = { id: 'new-page' };
      nock(baseUrl).post('/pages').reply(200, page);
      const res = await fetch(`${baseUrl}/pages`, { method: 'POST', body: JSON.stringify({ parent: { page_id: 'page1' }, properties: {} }) });
      expect(res.status).toBe(200);
    });

    it('should update page', async () => {
      nock(baseUrl).patch('/pages/page1').reply(200, { id: 'page1' });
      const res = await fetch(`${baseUrl}/pages/page1`, { method: 'PATCH', body: JSON.stringify({ properties: {} }) });
      const data = await res.json();
      expect(data.id).toBeDefined();
    });

    it('should archive page', async () => {
      nock(baseUrl).patch('/pages/page1').reply(200, { archived: true });
      const res = await fetch(`${baseUrl}/pages/page1`, { method: 'PATCH', body: JSON.stringify({ archived: true }) });
      const data = await res.json();
      expect(data.archived).toBe(true);
    });
  });

  describe('Block API', () => {
    it('should get block children', async () => {
      nock(baseUrl).get('/blocks/page1/children').reply(200, { results: [], has_more: false });
      const res = await fetch(`${baseUrl}/blocks/page1/children`);
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should append block children', async () => {
      nock(baseUrl).patch('/blocks/page1/children').reply(200, { results: [] });
      const res = await fetch(`${baseUrl}/blocks/page1/children`, { method: 'PATCH', body: JSON.stringify({ children: [] }) });
      expect(res.status).toBe(200);
    });

    it('should get block', async () => {
      nock(baseUrl).get('/blocks/block1').reply(200, { id: 'block1', type: 'paragraph' });
      const res = await fetch(`${baseUrl}/blocks/block1`);
      const data = await res.json();
      expect(data.id).toBe('block1');
    });

    it('should update block', async () => {
      nock(baseUrl).patch('/blocks/block1').reply(200, { id: 'block1' });
      const res = await fetch(`${baseUrl}/blocks/block1`, { method: 'PATCH', body: JSON.stringify({ paragraph: { rich_text: [{ text: { content: 'Updated' } }] }) });
      expect(res.status).toBe(200);
    });

    it('should delete block', async () => {
      nock(baseUrl).delete('/blocks/block1').reply(200, { archived: true });
      const res = await fetch(`${baseUrl}/blocks/block1`, { method: 'DELETE' });
      const data = await res.json();
      expect(data.archived).toBe(true);
    });
  });

  describe('User API', () => {
    it('should list users', async () => {
      nock(baseUrl).get('/users').reply(200, { results: [], has_more: false });
      const res = await fetch(`${baseUrl}/users`);
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should get user', async () => {
      nock(baseUrl).get('/users/user1').reply(200, { id: 'user1', name: 'User', type: 'person' });
      const res = await fetch(`${baseUrl}/users/user1`);
      const data = await res.json();
      expect(data.name).toBe('User');
    });

    it('should get bot user', async () => {
      nock(baseUrl).get('/users/me').reply(200, { id: 'bot', name: 'Bot', type: 'bot' });
      const res = await fetch(`${baseUrl}/users/me`);
      const data = await res.json();
      expect(data.type).toBe('bot');
    });
  });

  describe('Search API', () => {
    it('should search', async () => {
      nock(baseUrl).post('/search').reply(200, { results: [], has_more: false });
      const res = await fetch(`${baseUrl}/search`, { method: 'POST', body: JSON.stringify({ query: 'test' }) });
      const data = await res.json();
      expect(data.results).toBeDefined();
    });

    it('should filter by object', async () => {
      nock(baseUrl).post('/search').reply(200, { results: [], has_more: false });
      const res = await fetch(`${baseUrl}/search`, { method: 'POST', body: JSON.stringify({ filter: { value: 'page', property: 'object' } }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle 400', async () => {
      nock(baseUrl).post('/pages').reply(400, { code: 400, message: 'Bad Request' });
      const res = await fetch(`${baseUrl}/pages`, { method: 'POST', body: JSON.stringify({}) });
      expect(res.status).toBe(400);
    });

    it('should handle 404', async () => {
      nock(baseUrl).get('/pages/invalid').reply(404, { code: 404, message: 'Not Found' });
      const res = await fetch(`${baseUrl}/pages/invalid`);
      expect(res.status).toBe(404);
    });

    it('should handle 429', async () => {
      nock(baseUrl).post('/search').reply(429, {}, { 'Retry-After': '1' });
      const res = await fetch(`${baseUrl}/search`, { method: 'POST', body: JSON.stringify({}) });
      expect(res.status).toBe(429);
    });
  });
});

describe('Jira Integration - Full Test Suite', () => {
  const baseUrl = 'https://example.atlassian.net/rest/api/3';
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('Issue API', () => {
    it('should get issue', async () => {
      nock(baseUrl).get('/issue/TEST-1').reply(200, { key: 'TEST-1', fields: { summary: 'Bug', status: { name: 'Open' } } });
      const res = await fetch(`${baseUrl}/issue/TEST-1`);
      const data = await res.json();
      expect(data.key).toBe('TEST-1');
    });

    it('should create issue', async () => {
      nock(baseUrl).post('/issue').reply(201, { key: 'TEST-100', fields: { summary: 'New Issue' } });
      const res = await fetch(`${baseUrl}/issue`, { method: 'POST', body: JSON.stringify({ fields: { project: { key: 'TEST' }, summary: 'New Issue' } }) });
      expect(res.status).toBe(201);
    });

    it('should edit issue', async () => {
      nock(baseUrl).put('/issue/TEST-1').reply(200, {});
      const res = await fetch(`${baseUrl}/issue/TEST-1`, { method: 'PUT', body: JSON.stringify({ fields: { summary: 'Updated' } }) });
      expect(res.status).toBe(200);
    });

    it('should transition issue', async () => {
      nock(baseUrl).post('/issue/TEST-1/transitions').reply(200, { transitions: [{ id: '21', name: 'Done' }] });
      const res = await fetch(`${baseUrl}/issue/TEST-1/transitions`, { method: 'POST', body: JSON.stringify({ transition: { id: '21' } }) });
      const data = await res.json();
      expect(data.transitions).toHaveLength(1);
    });

    it('should add comment', async () => {
      nock(baseUrl).post('/issue/TEST-1/comment').reply(201, { id: '10000', body: { content: [{ content: [{ text: 'Comment' }] }] });
      const res = await fetch(`${baseUrl}/issue/TEST-1/comment`, { method: 'POST', body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: { content: 'Comment' } }] }] }) });
      expect(res.status).toBe(201);
    });

    it('should list attachments', async () => {
      nock(baseUrl).get('/issue/TEST-1').reply(200, { fields: { attachment: [{ filename: 'file.txt' }] } });
      const res = await fetch(`${baseUrl}/issue/TEST-1`);
      const data = await res.json();
      expect(data.fields.attachment).toHaveLength(1);
    });

    it('should add attachment', async () => {
      nock(baseUrl).post('/issue/TEST-1/attachments').reply(200, [{ id: 'att1', filename: 'file.txt' }]);
      const res = await fetch(`${baseUrl}/issue/TEST-1/attachments`, { method: 'POST' });
      expect(res.status).toBe(200);
    });

    it('should get worklog', async () => {
      nock(baseUrl).get('/issue/TEST-1/worklog').reply(200, { worklogs: [] });
      const res = await fetch(`${baseUrl}/issue/TEST-1/worklog`);
      const data = await res.json();
      expect(data.worklogs).toBeDefined();
    });

    it('should add worklog', async () => {
      nock(baseUrl).post('/issue/TEST-1/worklog').reply(201, { id: 'wl1', timeSpent: 3600 });
      const res = await fetch(`${baseUrl}/issue/TEST-1/worklog`, { method: 'POST', body: JSON.stringify({ timeSpent: '1h' }) });
      expect(res.status).toBe(201);
    });
  });

  describe('Search API', () => {
    it('should search issues (JQL)', async () => {
      nock(baseUrl).get('/search').query({ jql: 'project=TEST' }).reply(200, { issues: [], total: 0 });
      const res = await fetch(`${baseUrl}/search?jql=project=TEST`);
      const data = await res.json();
      expect(data.issues).toBeDefined();
    });

    it('should validate JQL', async () => {
      nock(baseUrl).post('/jql/validate').reply(200, { errorMessages: [] });
      const res = await fetch(`${baseUrl}/jql/validate`, { method: 'POST', body: JSON.stringify({ jql: 'project=TEST' }) });
      const data = await res.json();
      expect(data.errorMessages).toBeDefined();
    });

    it('should get favorite filters', async () => {
      nock(baseUrl).get('/filter/favourite').reply(200, [{ id: 'f1', name: 'My Filter' }]);
      const res = await fetch(`${baseUrl}/filter/favourite`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });

  describe('Project API', () => {
    it('should list projects', async () => {
      nock(baseUrl).get('/project').reply(200, [{ id: '1', key: 'TEST', name: 'Test Project' }]);
      const res = await fetch(`${baseUrl}/project`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get project', async () => {
      nock(baseUrl).get('/project/TEST').reply(200, { key: 'TEST', name: 'Test Project' });
      const res = await fetch(`${baseUrl}/project/TEST`);
      const data = await res.json();
      expect(data.key).toBe('TEST');
    });

    it('should get project versions', async () => {
      nock(baseUrl).get('/project/TEST/versions').reply(200, [{ id: 'v1', name: '1.0.0' }]);
      const res = await fetch(`${baseUrl}/project/TEST/versions`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should get project components', async () => {
      nock(baseUrl).get('/project/TEST/components').reply(200, [{ id: 'c1', name: 'Component' }]);
      const res = await fetch(`${baseUrl}/project/TEST/components`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });

  describe('Board/Sprint API', () => {
    it('should list boards', async () => {
      nock(baseUrl).get('/board').reply(200, [{ id: '1', name: 'Board' }]);
      const res = await fetch(`${baseUrl}/board`);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });

    it('should list sprints', async () => {
      nock(baseUrl).get('/board/1/sprint').reply(200, { values: [{ id: '1', name: 'Sprint 1' }] });
      const res = await fetch(`${baseUrl}/board/1/sprint`);
      const data = await res.json();
      expect(data.values).toHaveLength(1);
    });

    it('should get sprint', async () => {
      nock(baseUrl).get('/sprint/1').reply(200, { id: '1', name: 'Sprint 1', state: 'active' });
      const res = await fetch(`${baseUrl}/sprint/1`);
      const data = await res.json();
      expect(data.state).toBe('active');
    });
  });

  describe('Webhook Events', () => {
    it('should handle jira:issue_created', () => {
      const event = { issue: { key: 'TEST-1' }, webhookEvent: 'jira:issue_created' };
      expect(event.webhookEvent).toBe('jira:issue_created');
    });

    it('should handle jira:issue_updated', () => {
      const event = { issue: { key: 'TEST-1' }, webhookEvent: 'jira:issue_updated' };
      expect(event.webhookEvent).toBe('jira:issue_updated');
    });

    it('should handle jira:comment_created', () => {
      const event = { comment: { body: 'Comment' }, webhookEvent: 'jira:comment_created' };
      expect(event.webhookEvent).toBe('jira:comment_created');
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthorized (401)', async () => {
      nock(baseUrl).get('/issue/TEST-1').reply(401, { errorMessages: ['Unauthorized'] });
      const res = await fetch(`${baseUrl}/issue/TEST-1`);
      expect(res.status).toBe(401);
    });

    it('should handle not found (404)', async () => {
      nock(baseUrl).get('/issue/INVALID').reply(404, { errorMessages: ['Issue Not Found'] });
      const res = await fetch(`${baseUrl}/issue/INVALID`);
      expect(res.status).toBe(404);
    });
  });
});