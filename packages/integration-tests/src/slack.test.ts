import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

describe('Slack Integration - Full Test Suite', () => {
  const baseUrl = 'https://slack.com/api';
  
  beforeEach(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());

  interface SlackChannel { id: string; name: string; is_channel: boolean; is_group: boolean; is_im: boolean; created: number; }
  interface SlackUser { id: string; name: string; real_name: string; profile: { status_text: string; status_emoji: string; }; is_admin: boolean; is_owner: boolean; }
  interface SlackMessage { type: string; channel: string; user: string; text: string; ts: string; files?: { name: string; }[]; }
  interface SlackReaction { name: string; count: number; users: string[]; }
  interface SlackFile { id: string; name: string; title: string; filetype: string; size: number; url_private: string; }
  interface SlackComment { id: string; file: { id: string }; comment: string; user: string; ts: string; }
  interface SlackWebhook { id: string; url: string; channel: string; creator: string; }
  interface SlackScheduledMessage { id: string; channel_id: string; text: string; post_at: number; }
  interface SlackRemoteFile { id: string; title: string; external_url: string; alt_text: string; }

  const mockChannel: SlackChannel = { id: 'C1', name: 'general', is_channel: true, is_group: false, is_im: false, created: 1609459200 };
  const mockUser: SlackUser = { id: 'U1', name: 'testuser', real_name: 'Test User', profile: { status_text: '', status_emoji: '' }, is_admin: false, is_owner: false };
  const mockMessage: SlackMessage = { type: 'message', channel: 'C1', user: 'U1', text: 'Hello', ts: '1234567890.123456' };

  describe('Conversations API', () => {
    it('should list channels', async () => {
      nock(baseUrl).get('/conversations.list').query(true).reply(200, { ok: true, channels: [mockChannel] });
      const res = await fetch(`${baseUrl}/conversations.list?types=public_channel,private_channel`);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.channels).toHaveLength(1);
    });

    it('should create channel', async () => {
      const channel = { id: 'C2', name: 'new-channel', is_channel: true };
      nock(baseUrl).post('/conversations.create').reply(200, { ok: true, channel });
      const res = await fetch(`${baseUrl}/conversations.create`, { method: 'POST', body: JSON.stringify({ name: 'new-channel' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should invite users to channel', async () => {
      nock(baseUrl).post('/conversations.invite').reply(200, { ok: true, channel: mockChannel });
      const res = await fetch(`${baseUrl}/conversations.invite`, { method: 'POST', body: JSON.stringify({ channel: 'C1', users: 'U1,U2' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should join channel', async () => {
      nock(baseUrl).post('/conversations.join').reply(200, { ok: true, channel: mockChannel });
      const res = await fetch(`${baseUrl}/conversations.join`, { method: 'POST', body: JSON.stringify({ channel: 'C1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should leave channel', async () => {
      nock(baseUrl).post('/conversations.leave').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/conversations.leave`, { method: 'POST', body: JSON.stringify({ channel: 'C1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should archive channel', async () => {
      nock(baseUrl).post('/conversations.archive').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/conversations.archive`, { method: 'POST', body: JSON.stringify({ channel: 'C1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should unarchive channel', async () => {
      nock(baseUrl).post('/conversations.unarchive').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/conversations.unarchive`, { method: 'POST', body: JSON.stringify({ channel: 'C1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should rename channel', async () => {
      const renamed = { ...mockChannel, name: 'renamed-channel' };
      nock(baseUrl).post('/conversations.rename').reply(200, { ok: true, channel: renamed });
      const res = await fetch(`${baseUrl}/conversations.rename`, { method: 'POST', body: JSON.stringify({ channel: 'C1', name: 'renamed-channel' }) });
      const data = await res.json();
      expect(data.channel.name).toBe('renamed-channel');
    });

    it('should set channel topic', async () => {
      nock(baseUrl).post('/conversations.setTopic').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/conversations.setTopic`, { method: 'POST', body: JSON.stringify({ channel: 'C1', topic: 'New Topic' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should set channel purpose', async () => {
      nock(baseUrl).post('/conversations.setPurpose').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/conversations.setPurpose`, { method: 'POST', body: JSON.stringify({ channel: 'C1', purpose: 'New Purpose' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should get channel history', async () => {
      nock(baseUrl).get('/conversations.history').query(true).reply(200, { ok: true, messages: [mockMessage] });
      const res = await fetch(`${baseUrl}/conversations.history?channel=C1`);
      const data = await res.json();
      expect(data.messages).toHaveLength(1);
    });

    it('should get channel info', async () => {
      nock(baseUrl).get('/conversations.info').query(true).reply(200, { ok: true, channel: mockChannel });
      const res = await fetch(`${baseUrl}/conversations.info?channel=C1`);
      const data = await res.json();
      expect(data.channel.id).toBe('C1');
    });

    it('should list members in channel', async () => {
      nock(baseUrl).get('/conversations.members').query(true).reply(200, { ok: true, members: ['U1', 'U2'] });
      const res = await fetch(`${baseUrl}/conversations.members?channel=C1`);
      const data = await res.json();
      expect(data.members).toHaveLength(2);
    });

    it('should handle invalid auth', async () => {
      nock(baseUrl).get('/conversations.list').reply(200, { ok: false, error: 'invalid_auth' });
      const res = await fetch(`${baseUrl}/conversations.list`);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });

    it('should handle channel not found', async () => {
      nock(baseUrl).get('/conversations.info').query(true).reply(200, { ok: false, error: 'channel_not_found' });
      const res = await fetch(`${baseUrl}/conversations.info?channel=C999`);
      const data = await res.json();
      expect(data.error).toBe('channel_not_found');
    });
  });

  describe('Chat API', () => {
    it('should post message', async () => {
      const msg: SlackMessage = { ...mockMessage, ts: '1234567890.123456' };
      nock(baseUrl).post('/chat.postMessage').reply(200, { ok: true, ts: '1234567890.123456', message: msg });
      const res = await fetch(`${baseUrl}/chat.postMessage`, { method: 'POST', body: JSON.stringify({ channel: 'C1', text: 'Hello', username: 'bot', icon_emoji: ':robot_face:' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should update message', async () => {
      nock(baseUrl).post('/chat.update').reply(200, { ok: true, ts: '1234567890.123456', channel: 'C1' });
      const res = await fetch(`${baseUrl}/chat.update`, { method: 'POST', body: JSON.stringify({ channel: 'C1', ts: '1234567890.123456', text: 'Updated text' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should delete message', async () => {
      nock(baseUrl).post('/chat.delete').reply(200, { ok: true, ts: '1234567890.123456', channel: 'C1' });
      const res = await fetch(`${baseUrl}/chat.delete`, { method: 'POST', body: JSON.stringify({ channel: 'C1', ts: '1234567890.123456' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should post ephemeral message', async () => {
      nock(baseUrl).post('/chat.postEphemeral').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/chat.postEphemeral`, { method: 'POST', body: JSON.stringify({ channel: 'C1', user: 'U1', text: 'Secret message' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should schedule message', async () => {
      const scheduled: SlackScheduledMessage = { id: 'sched123', channel_id: 'C1', text: 'Scheduled', post_at: 1609459200 };
      nock(baseUrl).post('/chat.scheduleMessage').reply(200, { ok: true, scheduled_message: scheduled });
      const res = await fetch(`${baseUrl}/chat.scheduleMessage`, { method: 'POST', body: JSON.stringify({ channel: 'C1', text: 'Scheduled', post_at: 1609459200 }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should delete scheduled message', async () => {
      nock(baseUrl).post('/chat.deleteScheduledMessage').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/chat.deleteScheduledMessage`, { method: 'POST', body: JSON.stringify({ channel: 'C1', scheduled_message_id: 'sched123' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should get permalink', async () => {
      const permalink = { ok: true, permalink: 'https://slack.com/archives/C1/p1234567890' };
      nock(baseUrl).get('/chat.getPermalink').query(true).reply(200, permalink);
      const res = await fetch(`${baseUrl}/chat.getPermalink?channel=C1&message_ts=1234567890.123456`);
      const data = await res.json();
      expect(data.permalink).toBeDefined();
    });

    it('should mark message as read', async () => {
      nock(baseUrl).post('/chat.meMessage').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/chat.meMessage`, { method: 'POST', body: JSON.stringify({ channel: 'C1', text: 'text' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Users API', () => {
    it('should list users', async () => {
      nock(baseUrl).get('/users.list').query(true).reply(200, { ok: true, members: [mockUser] });
      const res = await fetch(`${baseUrl}/users.list`);
      const data = await res.json();
      expect(data.members).toHaveLength(1);
    });

    it('should get user info', async () => {
      nock(baseUrl).get('/users.info').query(true).reply(200, { ok: true, user: mockUser });
      const res = await fetch(`${baseUrl}/users.info?user=U1`);
      const data = await res.json();
      expect(data.user.name).toBe('testuser');
    });

    it('should get user by email', async () => {
      nock(baseUrl).get('/users.lookupByEmail').query(true).reply(200, { ok: true, user: mockUser });
      const res = await fetch(`${baseUrl}/users.lookupByEmail?email=test@example.com`);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should set user active status', async () => {
      nock(baseUrl).post('/users.setActive').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/users.setActive`, { method: 'POST', body: JSON.stringify({ user: 'U1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should get user presence', async () => {
      nock(baseUrl).get('/users.getPresence').query(true).reply(200, { ok: true, presence: 'active' });
      const res = await fetch(`${baseUrl}/users.getPresence?user=U1`);
      const data = await res.json();
      expect(data.presence).toBe('active');
    });

    it('should set user status', async () => {
      nock(baseUrl).post('/users.profile.set').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/users.profile.set`, { method: 'POST', body: JSON.stringify({ profile: { status_text: 'In a meeting', status_emoji: ':calendar:' } }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should get user profile', async () => {
      nock(baseUrl).get('/users.profile.get').reply(200, { ok: true, profile: { status_text: '', status_emoji: '' } });
      const res = await fetch(`${baseUrl}/users.profile.get`);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should delete user status', async () => {
      nock(baseUrl).post('/users.profile.set').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/users.profile.set`, { method: 'POST', body: JSON.stringify({ profile: { status_text: '', status_emoji: '' } }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Reactions API', () => {
    it('should add reaction', async () => {
      nock(baseUrl).post('/reactions.add').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/reactions.add`, { method: 'POST', body: JSON.stringify({ channel: 'C1', timestamp: '1234567890.123456', name: 'thumbsup' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should remove reaction', async () => {
      nock(baseUrl).post('/reactions.remove').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/reactions.remove`, { method: 'POST', body: JSON.stringify({ channel: 'C1', timestamp: '1234567890.123456', name: 'thumbsup' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should list reactions', async () => {
      const reactions: SlackReaction[] = [{ name: 'thumbsup', count: 2, users: ['U1', 'U2'] }];
      nock(baseUrl).get('/reactions.list').query(true).reply(200, { ok: true, items: [{ type: 'message', channel: 'C1', message: mockMessage, reactions }] });
      const res = await fetch(`${baseUrl}/reactions.list`);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Files API', () => {
    it('should list files', async () => {
      const file: SlackFile = { id: 'F1', name: 'test.txt', title: 'Test', filetype: 'text', size: 1000, url_private: 'https://files.slack.com/test.txt' };
      nock(baseUrl).get('/files.list').query(true).reply(200, { ok: true, files: [file] });
      const res = await fetch(`${baseUrl}/files.list`);
      const data = await res.json();
      expect(data.files).toHaveLength(1);
    });

    it('should get file info', async () => {
      const file: SlackFile = { id: 'F1', name: 'test.txt', title: 'Test', filetype: 'text', size: 1000, url_private: 'https://files.slack.com/test.txt' };
      nock(baseUrl).get('/files.info').query(true).reply(200, { ok: true, file });
      const res = await fetch(`${baseUrl}/files.info?file=F1`);
      const data = await res.json();
      expect(data.file.name).toBe('test.txt');
    });

    it('should upload file', async () => {
      const file: SlackFile = { id: 'F1', name: 'test.txt', title: 'Test', filetype: 'text', size: 1000, url_private: 'https://files.slack.com/test.txt' };
      nock(baseUrl).post('/files.upload').reply(200, { ok: true, file });
      const res = await fetch(`${baseUrl}/files.upload`, { method: 'POST', body: JSON.stringify({ channels: 'C1', content: 'test content', filename: 'test.txt' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should delete file', async () => {
      nock(baseUrl).post('/files.delete').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/files.delete`, { method: 'POST', body: JSON.stringify({ file: 'F1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should revoke file public URL', async () => {
      nock(baseUrl).post('/files.revokePublicURL').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/files.revokePublicURL`, { method: 'POST', body: JSON.stringify({ file: 'F1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should share file public URL', async () => {
      nock(baseUrl).post('/files.sharedPublicURL').reply(200, { ok: true, file: { url_private: 'https://files.slack.com/test.txt', url_public: 'https://slack-files.com/test.txt' } });
      const res = await fetch(`${baseUrl}/files.sharedPublicURL`, { method: 'POST', body: JSON.stringify({ file: 'F1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should send file to channel', async () => {
      nock(baseUrl).post('/files.sharedPublicURL').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/files.sharedPublicURL`, { method: 'POST', body: JSON.stringify({ file: 'F1', channels: 'C1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Comments API', () => {
    it('should add comment', async () => {
      const comment: SlackComment = { id: 'com1', file: { id: 'F1' }, comment: 'Comment', user: 'U1', ts: '1234567890.123456' };
      nock(baseUrl).post('/files.comments.add').reply(200, { ok: true, comment });
      const res = await fetch(`${baseUrl}/files.comments.add`, { method: 'POST', body: JSON.stringify({ file: 'F1', comment: 'Comment' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should delete comment', async () => {
      nock(baseUrl).post('/files.comments.delete').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/files.comments.delete`, { method: 'POST', body: JSON.stringify({ file: 'F1', id: 'com1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Reminders API', () => {
    it('should list reminders', async () => {
      const reminders = [{ id: 'R1', text: 'Reminder', time: 1609459200, complete: false }];
      nock(baseUrl).get('/reminders.list').reply(200, { ok: true, reminders });
      const res = await fetch(`${baseUrl}/reminders.list`);
      const data = await res.json();
      expect(data.reminders).toHaveLength(1);
    });

    it('should add reminder', async () => {
      const reminder = { id: 'R1', text: 'Reminder', time: 1609459200 };
      nock(baseUrl).post('/reminders.add').reply(200, { ok: true, reminder });
      const res = await fetch(`${baseUrl}/reminders.add`, { method: 'POST', body: JSON.stringify({ text: 'Reminder', time: 1609459200, channel: 'C1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should complete reminder', async () => {
      nock(baseUrl).post('/reminders.complete').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/reminders.complete`, { method: 'POST', body: JSON.stringify({ reminder: 'R1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should delete reminder', async () => {
      nock(baseUrl).post('/reminders.delete').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/reminders.delete`, { method: 'POST', body: JSON.stringify({ reminder: 'R1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Stars API', () => {
    it('should list stars', async () => {
      nock(baseUrl).get('/stars.list').query(true).reply(200, { ok: true, items: [] });
      const res = await fetch(`${baseUrl}/stars.list`);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should add star', async () => {
      nock(baseUrl).post('/stars.add').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/stars.add`, { method: 'POST', body: JSON.stringify({ file: 'F1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should remove star', async () => {
      nock(baseUrl).post('/stars.remove').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/stars.remove`, { method: 'POST', body: JSON.stringify({ file: 'F1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Pins API', () => {
    it('should list pins', async () => {
      nock(baseUrl).get('/pins.list').query(true).reply(200, { ok: true, items: [] });
      const res = await fetch(`${baseUrl}/pins.list?channel=C1`);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should add pin', async () => {
      nock(baseUrl).post('/pins.add').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/pins.add`, { method: 'POST', body: JSON.stringify({ channel: 'C1', file: 'F1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should remove pin', async () => {
      nock(baseUrl).post('/pins.remove').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/pins.remove`, { method: 'POST', body: JSON.stringify({ channel: 'C1', file: 'F1' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Team API', () => {
    it('should get team info', async () => {
      const team = { id: 'T1', name: 'Test Team', domain: 'testteam', email_domain: 'example.com' };
      nock(baseUrl).get('/team.info').reply(200, { ok: true, team });
      const res = await fetch(`${baseUrl}/team.info`);
      const data = await res.json();
      expect(data.team.name).toBe('Test Team');
    });

    it('should get team access logs', async () => {
      const logs = [{ user_id: 'U1', ip: '192.168.1.1', timestamp: 1609459200, action: 'login' }];
      nock(baseUrl).get('/team.accessLogs').reply(200, { ok: true, logs });
      const res = await fetch(`${baseUrl}/team.accessLogs`);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should get team billable info', async () => {
      nock(baseUrl).get('/team.billableInfo').query(true).reply(200, { ok: true, billable: true });
      const res = await fetch(`${baseUrl}/team.billableInfo?user=U1`);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should get team logins', async () => {
      nock(baseUrl).get('/team.loginLogs').query(true).reply(200, { ok: true, logins: [] });
      const res = await fetch(`${baseUrl}/team.loginLogs?count=100`);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Bots API', () => {
    it('should get bot info', async () => {
      const bot = { id: 'B1', name: 'Bot', app_id: 'A1', icons: { image_36: 'icon.png' } };
      nock(baseUrl).get('/bots.info').query(true).reply(200, { ok: true, bot });
      const res = await fetch(`${baseUrl}/bots.info?bot=B1`);
      const data = await res.json();
      expect(data.bot.name).toBe('Bot');
    });
  });

  describe('Apps API', () => {
    it('should get installed apps', async () => {
      const apps = [{ app_id: 'A1', name: 'App', icons: {} }];
      nock(baseUrl).get('/apps.connections').reply(200, { ok: true, apps, url: 'wss://example.com' });
      const res = await fetch(`${baseUrl}/apps.connections`);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should open a URL for a user', async () => {
      nock(baseUrl).get('/apps.permissions.resources.list').reply(200, { ok: true, resources: [] });
      const res = await fetch(`${baseUrl}/apps.permissions.resources.list`);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should check permissions for a resource', async () => {
      const res = nock(baseUrl).get('/apps.permissions.resources.list').reply(200, { ok: true, resources: [] });
      const response = await fetch(`${baseUrl}/apps.permissions.resources.list`);
      const data = await response.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Dialog API', () => {
    it('should open dialog', async () => {
      nock(baseUrl).post('/dialog.open').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/dialog.open`, { method: 'POST', body: JSON.stringify({ trigger_id: 'trigger', dialog: { title: 'Dialog', elements: [] } }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Views API', () => {
    it('should push view', async () => {
      const view = { id: 'V1', root_id: 'root', type: 'modal' };
      nock(baseUrl).post('/views.publish').reply(200, { ok: true, view });
      const res = await fetch(`${baseUrl}/views.push`, { method: 'POST', body: JSON.stringify({ trigger_id: 'trigger', view: { type: 'modal' } }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should publish home', async () => {
      nock(baseUrl).post('/views.publish').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/views.publish`, { method: 'POST', body: JSON.stringify({ user_id: 'U1', view: { type: 'home' } }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should update view', async () => {
      nock(baseUrl).post('/views.update').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/views.update`, { method: 'POST', body: JSON.stringify({ view_id: 'V1', view: { type: 'modal' } }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should open home tab', async () => {
      nock(baseUrl).post('/views.publish').reply(200, { ok: true });
      const res = await fetch(`${baseUrl}/views.publish`, { method: 'POST', body: JSON.stringify({ user_id: 'U1', view: { type: 'home' } }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Shortcuts API', () => {
    it('should handle global shortcut', () => {
      const payload = { type: 'shortcut', callback_id: 'shortcut', action_ts: '1234567890.123456' };
      expect(payload.type).toBe('shortcut');
    });

    it('should handle message shortcut', () => {
      const payload = { type: 'message_action', callback_id: 'message_shortcut', message: mockMessage };
      expect(payload.type).toBe('message_action');
    });

    it('should handle block action', () => {
      const payload = { type: 'block_actions', actions: [{ type: 'button', action_id: 'btn' }], container: { type: 'message', message_ts: '1234567890.123456' };
      expect(payload.type).toBe('block_actions');
    });

    it('should handle view submission', () => {
      const payload = { type: 'view_submission', view: { type: 'modal' }, callback_id: 'form' };
      expect(payload.type).toBe('view_submission');
    });

    it('should handle view closed', () => {
      const payload = { type: 'view_closed', view: { type: 'modal' }, callback_id: 'form' };
      expect(payload.type).toBe('view_closed');
    });
  });

  describe('Webhooks API', () => {
    it('should process incoming webhook', () => {
      const payload = { type: 'url_verification', challenge: 'challenge_token' };
      expect(payload.type).toBe('url_verification');
    });

    it('should handle event callback', () => {
      const payload = { type: 'event_callback', event: { type: 'message', channel: 'C1', text: 'test' }, event_id: 'evt1', event_time: 1609459200 };
      expect(payload.type).toBe('event_callback');
    });

    it('should handle app mention', () => {
      const payload = { type: 'event_callback', event: { type: 'app_mention', channel: 'C1', user: 'U1', text: '<@U1> test', ts: '1234567890.123456' };
      expect(payload.event.type).toBe('app_mention');
    });

    it('should handle member joined channel', () => {
      const payload = { type: 'event_callback', event: { type: 'member_joined_channel', channel: 'C1', user: 'U1', is_invite: true } };
      expect(payload.event.type).toBe('member_joined_channel');
    });

    it('should handle member left channel', () => {
      const payload = { type: 'event_callback', event: { type: 'member_left_channel', channel: 'C1', user: 'U1' } };
      expect(payload.event.type).toBe('member_left_channel');
    });

    it('should handle pin added', () => {
      const payload = { type: 'event_callback', event: { type: 'pin_added', channel_id: 'C1', user: 'U1' } };
      expect(payload.event.type).toBe('pin_added');
    });

    it('should handle reaction added', () => {
      const payload = { type: 'event_callback', event: { type: 'reaction_added', item: { type: 'message', channel: 'C1', ts: '1234567890.123456' }, reaction: 'thumbsup' };
      expect(payload.event.type).toBe('reaction_added');
    });
  });

  describe('OAuth API', () => {
    it('should handle oauth verification', async () => {
      const data = { ok: true, access_token: 'xoxb-xxx', team: { id: 'T1' } };
      expect(data.ok).toBe(true);
    });

    it('should revoke token', async () => {
      nock('https://slack.com').post('/oauth.revoke').reply(200, { ok: true });
      const res = await fetch('https://slack.com/oauth.revoke', { method: 'POST', body: JSON.stringify({ token: 'xoxb-xxx' }) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit (429)', async () => {
      nock(baseUrl).get('/conversations.list').reply(429, { ok: false, error: 'ratelimited' }, { 'Retry-After': '1' });
      const res = await fetch(`${baseUrl}/conversations.list`);
      expect(res.status).toBe(429);
    });

    it('should respect Retry-After header', async () => {
      const result = { 'Retry-After': '1' };
      expect(result['Retry-After']).toBe('1');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid_auth', async () => {
      nock(baseUrl).get('/users.list').reply(200, { ok: false, error: 'invalid_auth' });
      const res = await fetch(`${baseUrl}/users.list`);
      const data = await res.json();
      expect(data.error).toBe('invalid_auth');
    });

    it('should handle token_expired', async () => {
      nock(baseUrl).get('/users.list').reply(200, { ok: false, error: 'token_expired' });
      const res = await fetch(`${baseUrl}/users.list`);
      const data = await res.json();
      expect(data.error).toBe('token_expired');
    });

    it('should handle channel_not_found', async () => {
      nock(baseUrl).get('/conversations.info').query(true).reply(200, { ok: false, error: 'channel_not_found' });
      const res = await fetch(`${baseUrl}/conversations.info?channel=C999`);
      const data = await res.json();
      expect(data.error).toBe('channel_not_found');
    });

    it('should handle message_not_found', async () => {
      nock(baseUrl).post('/chat.update').reply(200, { ok: false, error: 'message_not_found' });
      const res = await fetch(`${baseUrl}/chat.update`, { method: 'POST', body: JSON.stringify({ channel: 'C1', ts: 'invalid' }) });
      const data = await res.json();
      expect(data.error).toBe('message_not_found');
    });

    it('should handle file_not_found', async () => {
      nock(baseUrl).get('/files.info').query(true).reply(200, { ok: false, error: 'file_not_found' });
      const res = await fetch(`${baseUrl}/files.info?file=F999`);
      const data = await res.json();
      expect(data.error).toBe('file_not_found');
    });

    it('should handle user_not_found', async () => {
      nock(baseUrl).get('/users.info').query(true).reply(200, { ok: false, user_not_found: '' });
      const res = await fetch(`${baseUrl}/users.info?user=U999`);
      const data = await res.json();
      expect(data.user_not_found).toBeDefined();
    });

    it('should handle is_archived', async () => {
      nock(baseUrl).post('/chat.postMessage').reply(200, { ok: false, error: 'is_archived' });
      const res = await fetch(`${baseUrl}/chat.postMessage`, { method: 'POST', body: JSON.stringify({ channel: 'C1' }) });
      const data = await res.json();
      expect(data.error).toBe('is_archived');
    });

    it('should handle restricted_action', async () => {
      nock(baseUrl).post('/conversations.create').reply(200, { ok: false, error: 'restricted_action' });
      const res = await fetch(`${baseUrl}/conversations.create`, { method: 'POST', body: JSON.stringify({ name: 'channel' }) });
      const data = await res.json();
      expect(data.error).toBe('restricted_action');
    });

    it('should handle missing scope', async () => {
      nock(baseUrl).get('/files.list').reply(200, { ok: false, error: 'missing_scope', needed: 'files:read' });
      const res = await fetch(`${baseUrl}/files.list`);
      const data = await res.json();
      expect(data.error).toBe('missing_scope');
    });

    it('should handle permission_denied', async () => {
      nock(baseUrl).post('/files.delete').reply(200, { ok: false, error: 'permission_denied' });
      const res = await fetch(`${baseUrl}/files.delete`, { method: 'POST', body: JSON.stringify({ file: 'F1' }) });
      const data = await res.json();
      expect(data.error).toBe('permission_denied');
    });
  }), describe('Web API', () => {
    it('should handle URL verification', () => {
      const request = { type: 'url_verification', challenge: 'test_challenge' };
      expect(request.challenge).toBe('test_challenge');
    });

    it('should parse event callback', () => {
      const event = { type: 'event_callback', event: { type: 'message', channel: 'C1', user: 'U1', text: 'Hello', ts: '1234567890.123456' } };
      expect(event.event.type).toBe('message');
    });

    it('should handle callback_id', () => {
      const payload = { type: 'block_actions', callback_id: 'action_id', actions: [{ action_id: 'btn', type: 'button' }] };
      expect(payload.callback_id).toBe('action_id');
    });

    it('should handle submission', () => {
      const payload = { type: 'view_submission', view: { state: {} }, private_metadata: 'data' };
      expect(payload.type).toBe('view_submission');
    });
  });
});