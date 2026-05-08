import { Plugin, PluginManifest, PluginCapabilities } from './types';
import { IntegrationBasePlugin, IntegrationType, IntegrationConfig, IntegrationCapabilities, TriggerDefinition, ActionDefinition, IntegrationEvent, SyncConfig, RateLimitConfig } from './integration-base';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  location?: string;
  attendees?: { email: string; responseStatus?: string }[];
  recurringEventId?: string;
  iCalUID?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: unknown;
}

export interface GoogleCalendarListResponse {
  kind: 'calendar#events';
  etag: string;
  summary: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: GoogleCalendarEvent[];
}

export class GoogleCalendarPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/google-calendar',
    name: 'Google Calendar',
    version: '1.0.0',
    description: 'Google Calendar integration for event management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['google', 'calendar', 'events', 'gcal'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'event-created', name: 'Event Created', description: 'Triggered when a calendar event is created' },
      { id: 'event-updated', name: 'Event Updated', description: 'Triggered when a calendar event is updated' },
      { id: 'event-deleted', name: 'Event Deleted', description: 'Triggered when a calendar event is deleted' },
    ],
    actions: [
      { id: 'create-event', name: 'Create Event', description: 'Create a new calendar event' },
      { id: 'update-event', name: 'Update Event', description: 'Update an existing event' },
      { id: 'delete-event', name: 'Delete Event', description: 'Delete an event' },
      { id: 'list-events', name: 'List Events', description: 'List calendar events' },
    ],
  };

  private baseUrl = 'https://www.googleapis.com/calendar/v3';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async createEvent(calendarId: string, event: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent> {
    return this.apiCall<GoogleCalendarEvent>(`/calendars/${calendarId}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(calendarId: string, eventId: string, event: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent> {
    return this.apiCall<GoogleCalendarEvent>(`/calendars/${calendarId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(event),
    });
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.apiCall(`/calendars/${calendarId}/events/${eventId}`, { method: 'DELETE' });
  }

  async listEvents(calendarId: string, options: { timeMin?: string; timeMax?: string; maxResults?: number } = {}): Promise<GoogleCalendarListResponse> {
    const params = new URLSearchParams();
    if (options.timeMin) params.set('timeMin', options.timeMin);
    if (options.timeMax) params.set('timeMax', options.timeMax);
    if (options.maxResults) params.set('maxResults', options.maxResults.toString());
    params.set('singleEvents', 'true');
    params.set('orderBy', 'startTime');

    return this.apiCall<GoogleCalendarListResponse>(`/calendars/${calendarId}/events?${params.toString()}`);
  }

  async getEvent(calendarId: string, eventId: string): Promise<GoogleCalendarEvent> {
    return this.apiCall<GoogleCalendarEvent>(`/calendars/${calendarId}/events/${eventId}`);
  }

  async listCalendars(): Promise<{ kind: string; etag: string; items: { id: string; summary: string; description?: string; timeZone?: string }[] }> {
    return this.apiCall('/users/me/calendarList');
  }

  buildEventFromPrompt(prompt: string): Partial<GoogleCalendarEvent> {
    const now = new Date();
    const defaultDuration = 60;
    const endTime = new Date(now.getTime() + defaultDuration * 60000);

    return {
      summary: prompt,
      start: { dateTime: now.toISOString() },
      end: { dateTime: endTime.toISOString() },
    };
  }
}

export interface GoogleGmailMessage {
  id: string;
  threadId?: string;
  subject?: string;
  snippet?: string;
  body?: string;
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  date?: string;
  labelIds?: string[];
  raw?: string;
}

export interface GoogleGmailLabel {
  id: string;
  name: string;
  type?: 'system' | 'user';
  messageListVisibility?: 'show' | 'hide';
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export class GoogleGmailPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/google-gmail',
    name: 'Google Gmail',
    version: '1.0.0',
    description: 'Google Gmail integration for email management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['google', 'gmail', 'email', 'mail'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'email-received', name: 'Email Received', description: 'Triggered when a new email is received' },
      { id: 'email-starred', name: 'Email Starred', description: 'Triggered when an email is starred' },
    ],
    actions: [
      { id: 'send-email', name: 'Send Email', description: 'Send an email' },
      { id: 'create-label', name: 'Create Label', description: 'Create a new label' },
      { id: 'add-label', name: 'Add Label', description: 'Add a label to an email' },
      { id: 'mark-read', name: 'Mark Read', description: 'Mark email as read' },
      { id: 'trash-email', name: 'Trash Email', description: 'Move email to trash' },
    ],
  };

  private baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Gmail API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async sendEmail(message: { to: string; subject: string; body: string; cc?: string; bcc?: string }): Promise<{ id: string }> {
    const raw = btoa(
      `From: me\r\nTo: ${message.to}\r\n${message.cc ? `Cc: ${message.cc}\r\n` : ''}${message.bcc ? `Bcc: ${message.bcc}\r\n` : ''}Subject: ${message.subject}\r\n\r\n${message.body}`
    ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return this.apiCall('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw }),
    });
  }

  async listMessages(options: { maxResults?: number; labelIds?: string[]; q?: string } = {}): Promise<{ messages: { id: string; threadId: string }[]; nextPageToken?: string; resultSizeEstimate?: number }> {
    const params = new URLSearchParams();
    if (options.maxResults) params.set('maxResults', options.maxResults.toString());
    if (options.labelIds) params.set('labelIds', options.labelIds.join(','));
    if (options.q) params.set('q', options.q);

    return this.apiCall(`/messages?${params.toString()}`);
  }

  async getMessage(messageId: string): Promise<GoogleGmailMessage> {
    return this.apiCall(`/messages/${messageId}`);
  }

  async getMessageDetail(messageId: string): Promise<{ payload: { headers: { name: string; value: string }[] }; raw?: string }> {
    return this.apiCall(`/messages/${messageId}?format=full`);
  }

  async createLabel(name: string, options: { messageListVisibility?: 'show' | 'hide'; labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide' } = {}): Promise<GoogleGmailLabel> {
    return this.apiCall('/labels', {
      method: 'POST',
      body: JSON.stringify({ name, ...options }),
    });
  }

  async modifyMessage(messageId: string, options: { addLabelIds?: string[]; removeLabelIds?: string[] } = {}): Promise<void> {
    await this.apiCall(`/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async trashMessage(messageId: string): Promise<void> {
    await this.apiCall(`/messages/${messageId}/trash`, { method: 'POST' });
  }

  async untrashMessage(messageId: string): Promise<void> {
    await this.apiCall(`/messages/${messageId}/untrash`, { method: 'POST' });
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.apiCall(`/messages/${messageId}`, { method: 'DELETE' });
  }

  async listLabels(): Promise<{ labels: GoogleGmailLabel[] }> {
    return this.apiCall('/labels');
  }
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  description?: string;
  parents?: string[];
  shared?: boolean;
  createdTime?: string;
  modifiedTime?: string;
  viewedTime?: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  owners?: { emailAddress: string; displayName?: string }[];
  permissions?: unknown[];
  spaces?: string[];
}

export class GoogleDrivePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/google-drive',
    name: 'Google Drive',
    version: '1.0.0',
    description: 'Google Drive integration for file management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['google', 'drive', 'files', 'storage'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'file-created', name: 'File Created', description: 'Triggered when a file is created' },
      { id: 'file-modified', name: 'File Modified', description: 'Triggered when a file is modified' },
      { id: 'file-deleted', name: 'File Deleted', description: 'Triggered when a file is deleted' },
    ],
    actions: [
      { id: 'upload-file', name: 'Upload File', description: 'Upload a file to Drive' },
      { id: 'copy-file', name: 'Copy File', description: 'Copy a file' },
      { id: 'move-file', name: 'Move File', description: 'Move a file to another folder' },
      { id: 'delete-file', name: 'Delete File', description: 'Delete a file' },
      { id: 'share-file', name: 'Share File', description: 'Share a file' },
      { id: 'list-files', name: 'List Files', description: 'List files in Drive' },
    ],
  };

  private baseUrl = 'https://www.googleapis.com/drive/v3';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Drive API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async uploadFile(file: { name: string; mimeType: string; content: Blob; parentId?: string }): Promise<GoogleDriveFile> {
    const metadata = { name: file.name, mimeType: file.mimeType, parents: file.parentId ? [file.parentId] : [] };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file.content);

    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
      body: formData,
    });

    if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
    return response.json() as Promise<GoogleDriveFile>;
  }

  async listFiles(options: { folderId?: string; mimeType?: string; query?: string; pageSize?: number } = {}): Promise<{ files: GoogleDriveFile[]; nextPageToken?: string }> {
    const params = new URLSearchParams();
    params.set('fields', 'files(id,name,mimeType,description,parents,shared,createdTime,modifiedTime,size,webViewLink,owners)');
    if (options.folderId) params.set(`q`, `'${options.folderId}' in parents`);
    if (options.mimeType) params.set(`q`, `mimeType='${options.mimeType}'`);
    if (options.query) params.set('q', options.query);
    if (options.pageSize) params.set('pageSize', options.pageSize.toString());

    return this.apiCall(`/files?${params.toString()}`);
  }

  async getFile(fileId: string): Promise<GoogleDriveFile> {
    return this.apiCall(`/files/${fileId}?fields=id,name,mimeType,description,parents,shared,createdTime,modifiedTime,size,webViewLink,webContentLink,iconLink,thumbnailLink,owners`);
  }

  async copyFile(fileId: string, name: string): Promise<GoogleDriveFile> {
    return this.apiCall(`/files/${fileId}/copy`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateFile(fileId: string, options: { name?: string; parents?: string[] } = {}): Promise<GoogleDriveFile> {
    return this.apiCall(`/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify(options),
    });
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.apiCall(`/files/${fileId}`, { method: 'DELETE' });
  }

  async createFolder(name: string, parentId?: string): Promise<GoogleDriveFile> {
    return this.apiCall('/files', {
      method: 'POST',
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : [],
      }),
    });
  }

  async getFileContent(fileId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
    });

    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
    return response.blob();
  }
}

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status?: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
  parent?: string;
  previous?: string;
}

export class GoogleTasksPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/google-tasks',
    name: 'Google Tasks',
    version: '1.0.0',
    description: 'Google Tasks integration for task management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['google', 'tasks', 'todo', 'gtasks'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'task-created', name: 'Task Created', description: 'Triggered when a task is created' },
      { id: 'task-completed', name: 'Task Completed', description: 'Triggered when a task is completed' },
    ],
    actions: [
      { id: 'create-task', name: 'Create Task', description: 'Create a new task' },
      { id: 'update-task', name: 'Update Task', description: 'Update a task' },
      { id: 'delete-task', name: 'Delete Task', description: 'Delete a task' },
      { id: 'complete-task', name: 'Complete Task', description: 'Complete a task' },
    ],
  };

  private baseUrl = 'https://www.googleapis.com/tasks/v1';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Tasks API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listTaskLists(): Promise<{ items: { id: string; title: string; updated: string }[] }> {
    return this.apiCall('/lists');
  }

  async listTasks(tasklistId: string): Promise<{ items: GoogleTask[] }> {
    return this.apiCall(`/lists/${tasklistId}/tasks`);
  }

  async createTask(tasklistId: string, task: Partial<GoogleTask>): Promise<GoogleTask> {
    return this.apiCall(`/lists/${tasklistId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(tasklistId: string, taskId: string, task: Partial<GoogleTask>): Promise<GoogleTask> {
    return this.apiCall(`/lists/${tasklistId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(task),
    });
  }

  async deleteTask(tasklistId: string, taskId: string): Promise<void> {
    await this.apiCall(`/lists/${tasklistId}/tasks/${taskId}`, { method: 'DELETE' });
  }

  async completeTask(tasklistId: string, taskId: string): Promise<GoogleTask> {
    return this.updateTask(tasklistId, taskId, { status: 'completed' });
  }
}

export interface MicrosoftOutlookEvent {
  id: string;
  subject: string;
  body?: { contentType: string; content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  attendees?: { emailAddress: { address: string; name: string }; status: { response: string } }[];
  isOrganizer?: boolean;
  organizer?: { emailAddress: { address: string; name: string } };
  onlineMeeting?: boolean;
  onlineMeetingUrl?: string;
}

export class MicrosoftOutlookPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/microsoft-outlook',
    name: 'Microsoft Outlook',
    version: '1.0.0',
    description: 'Microsoft Outlook integration for email and calendar',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['microsoft', 'outlook', 'calendar', 'email'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'event-created', name: 'Event Created', description: 'Triggered when an event is created' },
      { id: 'email-received', name: 'Email Received', description: 'Triggered when an email is received' },
    ],
    actions: [
      { id: 'send-email', name: 'Send Email', description: 'Send an email' },
      { id: 'create-event', name: 'Create Event', description: 'Create a calendar event' },
      { id: 'list-events', name: 'List Events', description: 'List calendar events' },
    ],
  };

  private baseUrl = 'https://graph.microsoft.com/v1.0';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft Graph API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async sendEmail(message: { to: string; subject: string; body: string; cc?: string }): Promise<{ id: string }> {
    return this.apiCall('/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          toRecipients: [{ emailAddress: { address: message.to } }],
          subject: message.subject,
          body: { contentType: 'text', content: message.body },
          ...(message.cc && { ccRecipients: [{ emailAddress: { address: message.cc } }] }),
        },
      }),
    });
  }

  async listEvents(options: { startDateTime?: string; endDateTime?: string } = {}): Promise<{ value: MicrosoftOutlookEvent[] }> {
    const params = new URLSearchParams();
    if (options.startDateTime) params.set('startDateTime', options.startDateTime);
    if (options.endDateTime) params.set('endDateTime', options.endDateTime);

    return this.apiCall(`/me/events?${params.toString()}`);
  }

  async createEvent(event: Partial<MicrosoftOutlookEvent>): Promise<MicrosoftOutlookEvent> {
    return this.apiCall('/me/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(eventId: string, event: Partial<MicrosoftOutlookEvent>): Promise<MicrosoftOutlookEvent> {
    return this.apiCall(`/me/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(event),
    });
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.apiCall(`/me/events/${eventId}`, { method: 'DELETE' });
  }

  async listMessages(options: { top?: number } = {}): Promise<{ value: { id: string; subject: string; from: { emailAddress: { address: string } }; receivedDateTime: string }[] }> {
    return this.apiCall(`/me/messages?$top=${options.top || 10}`);
  }

  async getMessage(messageId: string): Promise<{ id: string; subject: string; body: { content: string }; from: { emailAddress: { address: string; name: string } }; toRecipients: { emailAddress: { address: string } }[] }> {
    return this.apiCall(`/me/messages/${messageId}`);
  }
}

export interface MicrosoftTeamsChannel {
  id: string;
  displayName: string;
  description?: string;
}

export interface MicrosoftTeamsMessage {
  id: string;
  body: { contentType: string; content: string };
  from: { displayName: string; user?: { id: string } };
  createdDateTime: string;
  attachments?: unknown[];
}

export class MicrosoftTeamsPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/microsoft-teams',
    name: 'Microsoft Teams',
    version: '1.0.0',
    description: 'Microsoft Teams integration for collaboration',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['microsoft', 'teams', 'chat', 'collaboration'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'message-received', name: 'Message Received', description: 'Triggered when a message is received' },
      { id: 'channel-message', name: 'Channel Message', description: 'Triggered when a channel message is posted' },
    ],
    actions: [
      { id: 'send-message', name: 'Send Message', description: 'Send a chat message' },
      { id: 'send-channel-message', name: 'Send Channel Message', description: 'Send a channel message' },
      { id: 'list-channels', name: 'List Channels', description: 'List team channels' },
    ],
  };

  private baseUrl = 'https://graph.microsoft.com/v1.0';
  private accessToken: string | null = null;
  private teamId: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setTeamId(teamId: string): void {
    this.teamId = teamId;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft Teams API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listTeams(): Promise<{ value: { id: string; displayName: string }[] }> {
    return this.apiCall('/me/joinedTeams');
  }

  async listChannels(teamId: string): Promise<{ value: MicrosoftTeamsChannel[] }> {
    return this.apiCall(`/teams/${teamId}/channels`);
  }

  async sendChannelMessage(teamId: string, channelId: string, message: { content: string }): Promise<{ id: string }> {
    return this.apiCall(`/teams/${teamId}/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: message }),
    });
  }

  async listChannelMessages(teamId: string, channelId: string): Promise<{ value: MicrosoftTeamsMessage[] }> {
    return this.apiCall(`/teams/${teamId}/channels/${channelId}/messages`);
  }

  async sendChatMessage(chatId: string, message: { content: string }): Promise<{ id: string }> {
    return this.apiCall(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: message }),
    });
  }

  async createChat(users: string[]): Promise<{ id: string }> {
    return this.apiCall('/me/chats', {
      method: 'POST',
      body: JSON.stringify({
        topic: null,
        members: users.map(email => ({ '@odata.type': '#microsoft.graph.aadUser', email })),
      }),
    });
  }
}

export interface MicrosoftTodoTask {
  id: string;
  title: string;
  body?: { content: string };
  dueDateTime?: { dateTime: string; timeZone: string };
  completedDateTime?: { dateTime: string; timeZone: string };
  priority?: number;
  status?: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred';
  linkedResources?: { webUrl: string }[];
}

export class MicrosoftTodoPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/microsoft-todo',
    name: 'Microsoft To-Do',
    version: '1.0.0',
    description: 'Microsoft To-Do integration for task management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['microsoft', 'todo', 'tasks', 'planning'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-task', name: 'Create Task', description: 'Create a new task' },
      { id: 'update-task', name: 'Update Task', description: 'Update a task' },
      { id: 'delete-task', name: 'Delete Task', description: 'Delete a task' },
      { id: 'complete-task', name: 'Complete Task', description: 'Complete a task' },
      { id: 'list-tasks', name: 'List Tasks', description: 'List all tasks' },
    ],
  };

  private baseUrl = 'https://graph.microsoft.com/v1.0';
  private accessToken: string | null = null;
  private listId: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setListId(listId: string): void {
    this.listId = listId;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft To-Do API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listTodoLists(): Promise<{ value: { id: string; displayName: string }[] }> {
    return this.apiCall('/me/todo/lists');
  }

  async listTasks(listId?: string): Promise<{ value: MicrosoftTodoTask[] }> {
    const lid = listId || this.listId;
    if (!lid) throw new Error('List ID required');
    return this.apiCall(`/me/todo/lists/${lid}/tasks`);
  }

  async createTask(listId: string, task: Partial<MicrosoftTodoTask>): Promise<MicrosoftTodoTask> {
    return this.apiCall(`/me/todo/lists/${listId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(listId: string, taskId: string, task: Partial<MicrosoftTodoTask>): Promise<MicrosoftTodoTask> {
    return this.apiCall(`/me/todo/lists/${listId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(task),
    });
  }

  async deleteTask(listId: string, taskId: string): Promise<void> {
    await this.apiCall(`/me/todo/lists/${listId}/tasks/${taskId}`, { method: 'DELETE' });
  }

  async completeTask(listId: string, taskId: string): Promise<MicrosoftTodoTask> {
    return this.updateTask(listId, taskId, { status: 'completed' });
  }
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  created: number;
  isArchived: boolean;
  name_normalized: string;
  topic?: { value: string; creator: string; last_set: number };
  purpose?: { value: string; creator: string; last_set: number };
  memberCount?: number;
}

export interface SlackMessage {
  type: string;
  subtype?: string;
  ts: string;
  user: string;
  text: string;
  channel: string;
  files?: { id: string; name: string; url_private: string; mimetype: string; size: number }[];
  attachments?: { text: string; image_url?: string; thumb_url?: string }[];
}

export class SlackPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/slack',
    name: 'Slack',
    version: '1.0.0',
    description: 'Slack integration for team communication',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['slack', 'chat', 'communication', 'team'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'message-posted', name: 'Message Posted', description: 'Triggered when a message is posted' },
      { id: 'reaction-added', name: 'Reaction Added', description: 'Triggered when a reaction is added' },
    ],
    actions: [
      { id: 'send-message', name: 'Send Message', description: 'Send a message to a channel' },
      { id: 'post-ephemeral', name: 'Post Ephemeral', description: 'Post an ephemeral message' },
      { id: 'update-message', name: 'Update Message', description: 'Update a message' },
      { id: 'delete-message', name: 'Delete Message', description: 'Delete a message' },
      { id: 'add-reaction', name: 'Add Reaction', description: 'Add a reaction to a message' },
      { id: 'list-channels', name: 'List Channels', description: 'List all channels' },
    ],
  };

  private baseUrl = 'https://slack.com/api';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json() as T & { ok: boolean; error?: string };
    if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
    return data;
  }

  async listChannels(): Promise<{ channels: SlackChannel[] }> {
    return this.apiCall('/conversations.list');
  }

  async listDirectMessages(): Promise<{ channels: SlackChannel[] }> {
    return this.apiCall('/conversations.list?types=im');
  }

  async postMessage(channel: string, text: string, options: { threadTs?: string; attachments?: unknown[] } = {}): Promise<{ ts: string; channel: string }> {
    return this.apiCall('/chat.postMessage', {
      method: 'POST',
      body: JSON.stringify({ channel, text, ...options }),
    });
  }

  async postEphemeral(channel: string, user: string, text: string): Promise<{ channel: string; ts: string }> {
    return this.apiCall('/chat.postEphemeral', {
      method: 'POST',
      body: JSON.stringify({ channel, user, text }),
    });
  }

  async updateMessage(channel: string, ts: string, text: string): Promise<{ ts: string; channel: string }> {
    return this.apiCall('/chat.update', {
      method: 'POST',
      body: JSON.stringify({ channel, ts, text }),
    });
  }

  async deleteMessage(channel: string, ts: string): Promise<{ ok: boolean }> {
    return this.apiCall('/chat.delete', {
      method: 'POST',
      body: JSON.stringify({ channel, ts }),
    });
  }

  async addReaction(channel: string, ts: string, emoji: string): Promise<{ ok: boolean }> {
    return this.apiCall('/reactions.add', {
      method: 'POST',
      body: JSON.stringify({ channel, ts, name: emoji }),
    });
  }

  async removeReaction(channel: string, ts: string, emoji: string): Promise<{ ok: boolean }> {
    return this.apiCall('/reactions.remove', {
      method: 'POST',
      body: JSON.stringify({ channel, ts, name: emoji }),
    });
  }

  async getUserInfo(userId: string): Promise<{ id: string; name: string; real_name: string; profile: { email: string; image_72: string } }> {
    return this.apiCall(`/users.info?user=${userId}`);
  }

  async getChannelInfo(channelId: string): Promise<SlackChannel> {
    return this.apiCall(`/conversations.info?channel=${channelId}`);
  }

  async replyInThread(channel: string, threadTs: string, text: string): Promise<{ ts: string }> {
    return this.postMessage(channel, text, { threadTs });
  }
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  splash?: string;
  ownerId?: string;
  region?: string;
  unavailable?: boolean;
}

export interface DiscordChannel {
  id: string;
  type: number;
  guildId?: string;
  name: string;
  position?: number;
  parentId?: string;
  topic?: string;
}

export interface DiscordMessage {
  id: string;
  channelId: string;
  author: { id: string; username: string; discriminator: string; avatar?: string };
  content: string;
  timestamp: string;
  editedTimestamp?: string;
  attachments?: { id: string; filename: string; size: number; url: string }[];
  embeds?: unknown[];
}

export class DiscordPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/discord',
    name: 'Discord',
    version: '1.0.0',
    description: 'Discord integration for community communication',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['discord', 'chat', 'community', 'guild'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'message-created', name: 'Message Created', description: 'Triggered when a message is sent' },
      { id: 'reaction-added', name: 'Reaction Added', description: 'Triggered when a reaction is added' },
    ],
    actions: [
      { id: 'send-message', name: 'Send Message', description: 'Send a message to a channel' },
      { id: 'edit-message', name: 'Edit Message', description: 'Edit a message' },
      { id: 'delete-message', name: 'Delete Message', description: 'Delete a message' },
      { id: 'add-reaction', name: 'Add Reaction', description: 'Add a reaction to a message' },
      { id: 'list-guilds', name: 'List Guilds', description: 'List all guilds' },
      { id: 'list-channels', name: 'List Channels', description: 'List channels in a guild' },
    ],
  };

  private baseUrl = 'https://discord.com/api/v10';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listGuilds(): Promise<{ id: string; name: string; icon?: string }[]> {
    return this.apiCall('/users/@me/guilds');
  }

  async getGuild(guildId: string): Promise<DiscordGuild> {
    return this.apiCall(`/guilds/${guildId}`);
  }

  async listChannels(guildId: string): Promise<DiscordChannel[]> {
    return this.apiCall(`/guilds/${guildId}/channels`);
  }

  async sendMessage(channelId: string, content: string, options: { embed?: unknown; tts?: boolean } = {}): Promise<DiscordMessage> {
    return this.apiCall(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, ...options }),
    });
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<DiscordMessage> {
    return this.apiCall(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await this.apiCall(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' });
  }

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    await this.apiCall(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, { method: 'PUT' });
  }

  async removeReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    await this.apiCall(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, { method: 'DELETE' });
  }

  async createChannel(guildId: string, channel: { name: string; type: number; topic?: string }): Promise<DiscordChannel> {
    return this.apiCall(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: JSON.stringify(channel),
    });
  }
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  user: { login: string; avatar_url: string };
  assignees?: { login: string }[];
  labels: { name: string; color: string }[];
  milestone?: { number: number; title: string };
  comments: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  pullRequest?: { url: string };
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: string;
  user: { login: string; avatar_url: string };
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  merged: boolean;
  mergedAt?: string;
  mergeable: boolean;
  comments: number;
  reviewComments: number;
}

export interface GitHubCommit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  author: { login: string; avatar_url: string } | null;
}

export class GitHubPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/github',
    name: 'GitHub',
    version: '1.0.0',
    description: 'GitHub integration for version control and collaboration',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['github', 'git', 'version-control', 'collaboration'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'issue-created', name: 'Issue Created', description: 'Triggered when an issue is created' },
      { id: 'issue-closed', name: 'Issue Closed', description: 'Triggered when an issue is closed' },
      { id: 'pr-opened', name: 'PR Opened', description: 'Triggered when a pull request is opened' },
      { id: 'pr-merged', name: 'PR Merged', description: 'Triggered when a pull request is merged' },
    ],
    actions: [
      { id: 'create-issue', name: 'Create Issue', description: 'Create a new issue' },
      { id: 'close-issue', name: 'Close Issue', description: 'Close an issue' },
      { id: 'create-pr', name: 'Create Pull Request', description: 'Create a pull request' },
      { id: 'merge-pr', name: 'Merge Pull Request', description: 'Merge a pull request' },
      { id: 'list-issues', name: 'List Issues', description: 'List repository issues' },
      { id: 'list-prs', name: 'List Pull Requests', description: 'List pull requests' },
      { id: 'create-gist', name: 'Create Gist', description: 'Create a gist' },
    ],
  };

  private baseUrl = 'https://api.github.com';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listIssues(owner: string, repo: string, options: { state?: 'open' | 'closed' | 'all'; labels?: string } = {}): Promise<GitHubIssue[]> {
    const params = new URLSearchParams();
    if (options.state) params.set('state', options.state);
    if (options.labels) params.set('labels', options.labels);

    const data = await this.apiCall<{ items: GitHubIssue[] }>(`/repos/${owner}/${repo}/issues?${params.toString()}`);
    return data.items;
  }

  async createIssue(owner: string, repo: string, issue: { title: string; body?: string; labels?: string[]; assignees?: string[] }): Promise<GitHubIssue> {
    return this.apiCall(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify(issue),
    });
  }

  async updateIssue(owner: string, repo: string, issueNumber: number, issue: { title?: string; body?: string; state?: 'open' | 'closed' }): Promise<GitHubIssue> {
    return this.apiCall(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      body: JSON.stringify(issue),
    });
  }

  async listPullRequests(owner: string, repo: string, options: { state?: 'open' | 'closed' | 'all' } = {}): Promise<GitHubPullRequest[]> {
    const params = new URLSearchParams();
    if (options.state) params.set('state', options.state);

    return this.apiCall(`/repos/${owner}/${repo}/pulls?${params.toString()}`);
  }

  async createPullRequest(owner: string, repo: string, pr: { title: string; body?: string; head: string; base: string }): Promise<GitHubPullRequest> {
    return this.apiCall(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify(pr),
    });
  }

  async mergePullRequest(owner: string, repo: string, prNumber: number, options: { commitTitle?: string; mergeMethod?: 'merge' | 'squash' | 'rebase' } = {}): Promise<{ sha: string; merged: boolean }> {
    return this.apiCall(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify(options),
    });
  }

  async listCommits(owner: string, repo: string, options: { sha?: string; path?: string; perPage?: number } = {}): Promise<GitHubCommit[]> {
    const params = new URLSearchParams();
    if (options.sha) params.set('sha', options.sha);
    if (options.path) params.set('path', options.path);
    if (options.perPage) params.set('per_page', options.perPage.toString());

    return this.apiCall(`/repos/${owner}/${repo}/commits?${params.toString()}`);
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<{ content: string; encoding: string; sha: string }> {
    const data = await this.apiCall<{ content: string; encoding: string; sha: string }>(`/repos/${owner}/${repo}/contents/${path}`);
    return data;
  }

  async createFile(owner: string, repo: string, path: string, content: string, message: string, branch: string = 'main'): Promise<{ content: unknown; commit: unknown }> {
    const encoded = btoa(content);
    return this.apiCall(`/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: encoded, branch }),
    });
  }

  async createGist(gist: { description?: string; public: boolean; files: Record<string, { content: string }> }): Promise<{ id: string; url: string }> {
    return this.apiCall('/gists', {
      method: 'POST',
      body: JSON.stringify(gist),
    });
  }

  async listRepositories(): Promise<{ id: number; name: string; fullName: string; private: boolean; htmlUrl: string }[]> {
    return this.apiCall('/user/repos');
  }

  async getRepository(owner: string, repo: string): Promise<{ id: number; name: string; fullName: string; description?: string; stargazersCount: number; forksCount: number; openIssues: number }> {
    return this.apiCall(`/repos/${owner}/${repo}`);
  }
}

export interface GitLabIssue {
  id: number;
  iid: number;
  projectId: number;
  title: string;
  description?: string;
  state: 'opened' | 'closed';
  author: { username: string; avatarUrl: string };
  labels: string[];
  milestone?: { id: number; title: string };
  dueDate?: string;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  projectId: number;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description?: string;
  state: 'opened' | 'merged' | 'closed';
  author: { username: string; avatarUrl: string };
  webUrl: string;
  mergedBy?: { username: string };
  mergedAt?: string;
  squash: boolean;
}

export class GitLabPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/gitlab',
    name: 'GitLab',
    version: '1.0.0',
    description: 'GitLab integration for version control and DevOps',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['gitlab', 'git', 'devops', 'ci-cd'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'issue-created', name: 'Issue Created', description: 'Triggered when an issue is created' },
      { id: 'mr-opened', name: 'MR Opened', description: 'Triggered when a merge request is opened' },
      { id: 'mr-merged', name: 'MR Merged', description: 'Triggered when a merge request is merged' },
    ],
    actions: [
      { id: 'create-issue', name: 'Create Issue', description: 'Create a new issue' },
      { id: 'close-issue', name: 'Close Issue', description: 'Close an issue' },
      { id: 'create-mr', name: 'Create Merge Request', description: 'Create a merge request' },
      { id: 'accept-mr', name: 'Accept Merge Request', description: 'Accept a merge request' },
      { id: 'list-issues', name: 'List Issues', description: 'List project issues' },
      { id: 'list-mrs', name: 'List Merge Requests', description: 'List merge requests' },
    ],
  };

  private baseUrl: string = 'https://gitlab.com/api/v4';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'PRIVATE-TOKEN': this.accessToken,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitLab API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listProjects(options: { membership?: boolean; minAccessLevel?: number } = {}): Promise<{ id: number; name: string; path: string; webUrl: string }[]> {
    const params = new URLSearchParams();
    if (options.membership) params.set('membership', 'true');
    if (options.minAccessLevel) params.set('min_access_level', options.minAccessLevel.toString());

    return this.apiCall(`/projects?${params.toString()}`);
  }

  async listIssues(projectId: number, options: { state?: 'opened' | 'closed' } = {}): Promise<GitLabIssue[]> {
    const params = new URLSearchParams();
    if (options.state) params.set('state', options.state);

    return this.apiCall(`/projects/${projectId}/issues?${params.toString()}`);
  }

  async createIssue(projectId: number, issue: { title: string; description?: string; labels?: string; dueDate?: string }): Promise<GitLabIssue> {
    return this.apiCall(`/projects/${projectId}/issues`, {
      method: 'POST',
      body: JSON.stringify(issue),
    });
  }

  async updateIssue(projectId: number, issueIid: number, issue: { title?: string; description?: string; state?: 'opened' | 'closed' }): Promise<GitLabIssue> {
    return this.apiCall(`/projects/${projectId}/issues/${issueIid}`, {
      method: 'PATCH',
      body: JSON.stringify(issue),
    });
  }

  async listMergeRequests(projectId: number, options: { state?: 'opened' | 'merged' | 'closed' } = {}): Promise<GitLabMergeRequest[]> {
    const params = new URLSearchParams();
    if (options.state) params.set('state', options.state);

    return this.apiCall(`/projects/${projectId}/merge_requests?${params.toString()}`);
  }

  async createMergeRequest(projectId: number, mr: { title: string; description?: string; sourceBranch: string; targetBranch: string }): Promise<GitLabMergeRequest> {
    return this.apiCall(`/projects/${projectId}/merge_requests`, {
      method: 'POST',
      body: JSON.stringify(mr),
    });
  }

  async acceptMergeRequest(projectId: number, mrIid: number, options: { shouldRemoveSourceBranch?: boolean; squash?: boolean } = {}): Promise<GitLabMergeRequest> {
    return this.apiCall(`/projects/${projectId}/merge_requests/${mrIid}/merge`, {
      method: 'PUT',
      body: JSON.stringify(options),
    });
  }

  async listCommits(projectId: number, options: { refName?: string; perPage?: number } = {}): Promise<{ id: string; shortId: string; title: string; authorName: string; createdAt: string }[]> {
    const params = new URLSearchParams();
    if (options.refName) params.set('ref_name', options.refName);
    if (options.perPage) params.set('per_page', options.perPage.toString());

    return this.apiCall(`/projects/${projectId}/repository/commits?${params.toString()}`);
  }

  async getFile(projectId: number, filePath: string, ref: string = 'main'): Promise<{ fileName: string; content: string; encoding: string }> {
    const encoded = encodeURIComponent(filePath);
    return this.apiCall(`/projects/${projectId}/repository/files/${encoded}?ref=${ref}`);
  }

  async createFile(projectId: number, filePath: string, content: string, commitMessage: string, branch: string = 'main'): Promise<{ filePath: string; branch: string }> {
    const encoded = encodeURIComponent(filePath);
    const encodedContent = btoa(content);
    return this.apiCall(`/projects/${projectId}/repository/files/${encoded}`, {
      method: 'POST',
      body: JSON.stringify({ branch, commitMessage, content: encodedContent }),
    });
  }
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: { name: string; iconUrl?: string };
    status: { name: string; statusCategory: { key: string; colorName: string } };
    priority?: { name: string; iconUrl?: string };
    assignee?: { displayName: string; emailAddress?: string };
    reporter?: { displayName: string };
    created: string;
    updated: string;
    duedate?: string;
    labels: string[];
    components?: { name: string }[];
    fixVersions?: { name: string }[];
    resolution?: { name: string };
    resolutiondate?: string;
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  lead?: { displayName: string };
  issueTypes: { name: string }[];
}

export class JiraPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/jira',
    name: 'Jira',
    version: '1.0.0',
    description: 'Jira integration for project management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['jira', 'project-management', 'issues', 'agile'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'issue-created', name: 'Issue Created', description: 'Triggered when an issue is created' },
      { id: 'issue-updated', name: 'Issue Updated', description: 'Triggered when an issue is updated' },
      { id: 'issue-closed', name: 'Issue Closed', description: 'Triggered when an issue is closed' },
    ],
    actions: [
      { id: 'create-issue', name: 'Create Issue', description: 'Create a new issue' },
      { id: 'update-issue', name: 'Update Issue', description: 'Update an issue' },
      { id: 'transition-issue', name: 'Transition Issue', description: 'Transition an issue to a new status' },
      { id: 'add-comment', name: 'Add Comment', description: 'Add a comment to an issue' },
      { id: 'list-issues', name: 'List Issues', description: 'List project issues' },
    ],
  };

  private baseUrl: string = '';
  private accessToken: string | null = null;
  private email: string | null = null;

  setCredentials(baseUrl: string, email: string, apiToken: string): void {
    this.baseUrl = baseUrl;
    this.email = email;
    this.accessToken = apiToken;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken || !this.email) throw new Error('Not authenticated');
    if (!this.baseUrl) throw new Error('Jira base URL not configured');

    const credentials = btoa(`${this.email}:${this.accessToken}`);

    const response = await fetch(`${this.baseUrl}/rest/api/3${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listProjects(): Promise<JiraProject[]> {
    return this.apiCall('/project');
  }

  async listIssues(jql: string, options: { maxResults?: number; startAt?: number } = {}): Promise<{ issues: JiraIssue[]; total: number; startAt: number }> {
    const params = new URLSearchParams();
    params.set('jql', jql);
    params.set('maxResults', (options.maxResults || 50).toString());
    params.set('startAt', (options.startAt || 0).toString());
    params.set('fields', 'summary,description,issuetype,status,priority,assignee,reporter,created,updated,duedate,labels,components,fixVersions,resolution,resolutiondate');

    return this.apiCall(`/search?${params.toString()}`);
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    return this.apiCall(`/issue/${issueKey}?fields=summary,description,issuetype,status,priority,assignee,reporter,created,updated,duedate,labels,components,fixVersions,resolution,resolutiondate`);
  }

  async createIssue(issue: { projectKey: string; summary: string; description?: string; issuetype?: string; priority?: string }): Promise<{ key: string; id: string }> {
    return this.apiCall('/issue', {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          project: { key: issue.projectKey },
          summary: issue.summary,
          description: issue.description ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: issue.description }] }] } : undefined,
          issuetype: { name: issue.issuetype || 'Task' },
          priority: issue.priority ? { name: issue.priority } : undefined,
        },
      }),
    });
  }

  async updateIssue(issueKey: string, fields: { summary?: string; description?: string }): Promise<void> {
    await this.apiCall(`/issue/${issueKey}`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    });
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.apiCall(`/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
  }

  async listTransitions(issueKey: string): Promise<{ transitions: { id: string; name: string; to: { name: string } }[] }> {
    return this.apiCall(`/issue/${issueKey}/transitions`);
  }

  async addComment(issueKey: string, comment: string): Promise<{ id: string }> {
    return this.apiCall(`/issue/${issueKey}/comment`, {
      method: 'POST',
      body: JSON.stringify({
        body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }] },
      }),
    });
  }

  async getTransitions(): Promise<{ transitions: { id: string; name: string; to: { name: string } }[] }> {
    return this.apiCall('/transitions');
  }
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: { name: string; type: string };
  priority: number;
  assignee?: { name: string; email: string };
  labels: { name: string; color: string }[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export class LinearPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/linear',
    name: 'Linear',
    version: '1.0.0',
    description: 'Linear integration for issue tracking',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['linear', 'issues', 'tracking', 'productivity'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'issue-created', name: 'Issue Created', description: 'Triggered when an issue is created' },
      { id: 'issue-completed', name: 'Issue Completed', description: 'Triggered when an issue is completed' },
    ],
    actions: [
      { id: 'create-issue', name: 'Create Issue', description: 'Create a new issue' },
      { id: 'update-issue', name: 'Update Issue', description: 'Update an issue' },
      { id: 'archive-issue', name: 'Archive Issue', description: 'Archive an issue' },
      { id: 'list-issues', name: 'List Issues', description: 'List issues' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': this.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Linear API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { data?: T; errors?: { message: string }[] };
    if (data.errors) throw new Error(`Linear GraphQL error: ${data.errors[0]?.message}`);
    return data.data as T;
  }

  async listTeams(): Promise<LinearTeam[]> {
    const result = await this.apiCall<{ teams: { nodes: LinearTeam[] } }>(`
      query { teams { nodes { id name key } } }
    `);
    return result.teams.nodes;
  }

  async listIssues(options: { teamId?: string; assigneeId?: string; first?: number } = {}): Promise<LinearIssue[]> {
    const filter: Record<string, unknown> = {};
    if (options.teamId) filter.team = { id: { eq: options.teamId } };
    if (options.assigneeId) filter.assignee = { id: { eq: options.assigneeId } };

    const result = await this.apiCall<{ issues: { nodes: LinearIssue[] } }>(`
      query($filter: IssueFilterInput, $first: Int) {
        issues(filter: $filter, first: $first) {
          nodes {
            id identifier title description state { name type } priority assignee { name email } labels { name color } dueDate createdAt updatedAt completedAt
          }
        }
      }
    `, { filter, first: options.first || 50 });
    return result.issues.nodes;
  }

  async createIssue(issue: { teamId: string; title: string; description?: string; priority?: number; assigneeId?: string }): Promise<{ id: string; identifier: string }> {
    const result = await this.apiCall<{ issueCreate: { success: boolean; issue: { id: string; identifier: string } } }>(`
      mutation($input: IssueCreateInput!) {
        issueCreate(input: $input) { success issue { id identifier } }
      }
    `, { input: issue });
    return result.issueCreate.issue;
  }

  async updateIssue(issueId: string, data: { title?: string; description?: string; priority?: number; stateId?: string }): Promise<void> {
    await this.apiCall(`
      mutation($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) { success }
      }
    `, { id: issueId, input: data });
  }

  async archiveIssue(issueId: string): Promise<void> {
    await this.apiCall(`
      mutation($id: String!) {
        issueArchive(id: $id) { success }
      }
    `, { id: issueId });
  }
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  closed: boolean;
  idBoard: string;
  idList: string;
  idMembers?: string[];
  labels: { id: string; name: string; color: string }[];
  due?: string;
  dueComplete: boolean;
  dateLastActivity: string;
  shortUrl: string;
  url: string;
}

export interface TrelloList {
  id: string;
  name: string;
  idBoard: string;
  pos: number;
  closed: boolean;
}

export interface TrelloBoard {
  id: string;
  name: string;
  desc?: string;
  closed: boolean;
  url: string;
  shortUrl: string;
}

export class TrelloPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/trello',
    name: 'Trello',
    version: '1.0.0',
    description: 'Trello integration for project management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['trello', 'project-management', 'kanban', 'boards'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'card-created', name: 'Card Created', description: 'Triggered when a card is created' },
      { id: 'card-moved', name: 'Card Moved', description: 'Triggered when a card is moved' },
    ],
    actions: [
      { id: 'create-card', name: 'Create Card', description: 'Create a new card' },
      { id: 'update-card', name: 'Update Card', description: 'Update a card' },
      { id: 'move-card', name: 'Move Card', description: 'Move a card to another list' },
      { id: 'delete-card', name: 'Delete Card', description: 'Delete a card' },
      { id: 'create-board', name: 'Create Board', description: 'Create a new board' },
      { id: 'list-boards', name: 'List Boards', description: 'List all boards' },
    ],
  };

  private baseUrl = 'https://api.trello.com/1';
  private apiKey: string | null = null;
  private accessToken: string | null = null;

  setCredentials(apiKey: string, accessToken: string): void {
    this.apiKey = apiKey;
    this.accessToken = accessToken;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiKey || !this.accessToken) throw new Error('Not authenticated');

    const params = new URLSearchParams({ key: this.apiKey, token: this.accessToken });
    const url = `${this.baseUrl}${endpoint}?${params.toString()}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Trello API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listBoards(): Promise<TrelloBoard[]> {
    return this.apiCall('/members/me/boards');
  }

  async getBoard(boardId: string): Promise<TrelloBoard & { lists: TrelloList[] }> {
    return this.apiCall(`/boards/${boardId}?lists=all`);
  }

  async createBoard(board: { name: string; desc?: string }): Promise<TrelloBoard> {
    return this.apiCall('/boards', {
      method: 'POST',
      body: JSON.stringify(board),
    });
  }

  async listCards(boardId: string): Promise<TrelloCard[]> {
    return this.apiCall(`/boards/${boardId}/cards`);
  }

  async listCardsInList(listId: string): Promise<TrelloCard[]> {
    return this.apiCall(`/lists/${listId}/cards`);
  }

  async createCard(card: { idList: string; name: string; desc?: string; due?: string; idMembers?: string[] }): Promise<TrelloCard> {
    return this.apiCall('/cards', {
      method: 'POST',
      body: JSON.stringify(card),
    });
  }

  async updateCard(cardId: string, card: { name?: string; desc?: string; due?: string; dueComplete?: boolean }): Promise<TrelloCard> {
    return this.apiCall(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify(card),
    });
  }

  async moveCard(cardId: string, idList: string): Promise<TrelloCard> {
    return this.apiCall(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify({ idList }),
    });
  }

  async deleteCard(cardId: string): Promise<void> {
    await this.apiCall(`/cards/${cardId}`, { method: 'DELETE' });
  }

  async createList(boardId: string, name: string): Promise<TrelloList> {
    return this.apiCall(`/boards/${boardId}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async archiveList(listId: string): Promise<TrelloList> {
    return this.apiCall(`/lists/${listId}/closed`, {
      method: 'PUT',
      body: JSON.stringify({ value: 'true' }),
    });
  }
}

export interface NotionPage {
  id: string;
  createdTime: string;
  lastEditedTime: string;
  createdBy: { id: string; name: string };
  lastEditedBy: { id: string; name: string };
  cover?: { type: string; external?: { url: string }; file?: { url: string } };
  icon?: { emoji: string; external?: { url: string } };
  parent: { type: string; pageId?: string; workspaceId?: string };
  properties?: Record<string, unknown>;
  archived: boolean;
}

export interface NotionDatabase {
  id: string;
  createdTime: string;
  lastEditedTime: string;
  title: { type: string; title: { plainText: string }[] }[];
  properties: Record<string, unknown>;
}

export class NotionPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/notion',
    name: 'Notion',
    version: '1.0.0',
    description: 'Notion integration for workspace management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['notion', 'workspace', 'notes', 'knowledge'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'page-created', name: 'Page Created', description: 'Triggered when a page is created' },
      { id: 'page-updated', name: 'Page Updated', description: 'Triggered when a page is updated' },
    ],
    actions: [
      { id: 'create-page', name: 'Create Page', description: 'Create a new page' },
      { id: 'update-page', name: 'Update Page', description: 'Update page content' },
      { id: 'append-blocks', name: 'Append Blocks', description: 'Append blocks to a page' },
      { id: 'list-databases', name: 'List Databases', description: 'List databases' },
      { id: 'query-database', name: 'Query Database', description: 'Query a database' },
    ],
  };

  private baseUrl = 'https://api.notion.com/v1';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listPages(): Promise<{ results: NotionPage[] }> {
    return this.apiCall('/search?filter=page');
  }

  async listDatabases(): Promise<{ results: NotionDatabase[] }> {
    return this.apiCall('/search?filter=database');
  }

  async getPage(pageId: string): Promise<NotionPage> {
    return this.apiCall(`/pages/${pageId}`);
  }

  async createPage(page: { parentId?: string; databaseId?: string; properties?: Record<string, unknown>; children?: unknown[] }): Promise<NotionPage> {
    const parent = page.parentId ? { pageId: page.parentId } : { databaseId: page.databaseId };
    return this.apiCall('/pages', {
      method: 'POST',
      body: JSON.stringify({ parent, properties: page.properties, children: page.children }),
    });
  }

  async updatePage(pageId: string, properties: Record<string, unknown>): Promise<NotionPage> {
    return this.apiCall(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  }

  async getBlockChildren(blockId: string): Promise<{ results: unknown[] }> {
    return this.apiCall(`/blocks/${blockId}/children`);
  }

  async appendBlocks(blockId: string, children: unknown[]): Promise<{ results: unknown[] }> {
    return this.apiCall(`/blocks/${blockId}/children`, {
      method: 'PATCH',
      body: JSON.stringify({ children }),
    });
  }

  async createDatabase(parentId: string, database: { title: unknown[]; properties: Record<string, unknown> }): Promise<NotionDatabase> {
    return this.apiCall('/databases', {
      method: 'POST',
      body: JSON.stringify({ parent: { pageId: parentId }, ...database }),
    });
  }

  async queryDatabase(databaseId: string, filter?: unknown, sorts?: unknown[]): Promise<{ results: unknown[] }> {
    return this.apiCall(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({ filter, sorts }),
    });
  }
}

export interface ObsidianVault {
  id: string;
  name: string;
  path: string;
}

export interface ObsidianNote {
  path: string;
  name: string;
  extension: string;
  content: string;
  links?: { path: string; text: string }[];
  frontmatter?: Record<string, unknown>;
  tags?: string[];
  aliases?: string[];
}

export class ObsidianPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/obsidian',
    name: 'Obsidian',
    version: '1.0.0',
    description: 'Obsidian integration for knowledge management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['obsidian', 'notes', 'knowledge', 'markdown'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'note-created', name: 'Note Created', description: 'Triggered when a note is created' },
      { id: 'note-modified', name: 'Note Modified', description: 'Triggered when a note is modified' },
    ],
    actions: [
      { id: 'create-note', name: 'Create Note', description: 'Create a new note' },
      { id: 'update-note', name: 'Update Note', description: 'Update note content' },
      { id: 'read-note', name: 'Read Note', description: 'Read a note' },
      { id: 'search-notes', name: 'Search Notes', description: 'Search notes' },
      { id: 'create-link', name: 'Create Link', description: 'Create a link between notes' },
    ],
  };

  private vaultPath: string | null = null;

  setVaultPath(path: string): void {
    this.vaultPath = path;
  }

  private parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontmatterRegex);

    if (match) {
      const lines = match[1].split('\n');
      const frontmatter: Record<string, unknown> = {};

      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
          const value = valueParts.join(':').trim();
          frontmatter[key.trim()] = value.startsWith('[') ? JSON.parse(value) : value.replace(/^["']|["']$/g, '');
        }
      }

      return { frontmatter, body: content.slice(match[0].length) };
    }

    return { frontmatter: {}, body: content };
  }

  private extractLinks(content: string): { path: string; text: string }[] {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const links: { path: string; text: string }[] = [];
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const linkText = match[1];
      const pipeIndex = linkText.indexOf('|');
      const path = pipeIndex >= 0 ? linkText.substring(0, pipeIndex) : linkText;
      const text = pipeIndex >= 0 ? linkText.substring(pipeIndex + 1) : linkText;
      links.push({ path: path.trim(), text: text.trim() });
    }

    return links;
  }

  private extractTags(content: string): string[] {
    const tagRegex = /#[\w-]+/g;
    const tags: string[] = [];
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[0].slice(1));
    }

    return tags;
  }
}

export interface TodoistTask {
  id: string;
  projectId: string;
  content: string;
  description?: string;
  isCompleted: boolean;
  priority: number;
  due?: { string: string; timezone?: string; isRecurring: boolean };
  sectionId?: string;
  labels?: string[];
  assigerId?: string;
  commentCount: number;
}

export interface TodoistProject {
  id: string;
  name: string;
  parentId?: string;
  color: string;
  isInboxProject: boolean;
  isTeamInbox: boolean;
}

export class TodoistPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/todoist',
    name: 'Todoist',
    version: '1.0.0',
    description: 'Todoist integration for task management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['todoist', 'tasks', 'todo', 'productivity'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'task-created', name: 'Task Created', description: 'Triggered when a task is created' },
      { id: 'task-completed', name: 'Task Completed', description: 'Triggered when a task is completed' },
    ],
    actions: [
      { id: 'create-task', name: 'Create Task', description: 'Create a new task' },
      { id: 'update-task', name: 'Update Task', description: 'Update a task' },
      { id: 'complete-task', name: 'Complete Task', description: 'Complete a task' },
      { id: 'delete-task', name: 'Delete Task', description: 'Delete a task' },
      { id: 'list-projects', name: 'List Projects', description: 'List all projects' },
    ],
  };

  private baseUrl = 'https://api.todoist.com/rest/v2';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Todoist API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listProjects(): Promise<TodoistProject[]> {
    return this.apiCall('/projects');
  }

  async getProject(projectId: string): Promise<TodoistProject> {
    return this.apiCall(`/projects/${projectId}`);
  }

  async createProject(project: { name: string; color?: string; parentId?: string }): Promise<TodoistProject> {
    return this.apiCall('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async listTasks(options: { projectId?: string; label?: string } = {}): Promise<TodoistTask[]> {
    const params = new URLSearchParams();
    if (options.projectId) params.set('project_id', options.projectId);
    if (options.label) params.set('label', options.label);

    return this.apiCall(`/tasks?${params.toString()}`);
  }

  async getTask(taskId: string): Promise<TodoistTask> {
    return this.apiCall(`/tasks/${taskId}`);
  }

  async createTask(task: { content: string; projectId?: string; description?: string; priority?: number; due?: { string: string } }): Promise<TodoistTask> {
    return this.apiCall('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(taskId: string, task: { content?: string; description?: string; priority?: number; due?: { string: string } }): Promise<TodoistTask> {
    return this.apiCall(`/tasks/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async completeTask(taskId: string): Promise<void> {
    await this.apiCall(`/tasks/${taskId}/close`, { method: 'POST' });
  }

  async reopenTask(taskId: string): Promise<void> {
    await this.apiCall(`/tasks/${taskId}/reopen`, { method: 'POST' });
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.apiCall(`/tasks/${taskId}`, { method: 'DELETE' });
  }
}

export interface RaindropBookmark {
  id: string;
  title: string;
  link: string;
  description?: string;
  tags: string[];
  created: string;
  updated: string;
  cover?: string;
  excerpt?: { title: string; text: string };
}

export interface RaindropCollection {
  id: string;
  title: string;
  count: number;
  sort: number;
}

export class RaindropPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/raindrop',
    name: 'Raindrop',
    version: '1.0.0',
    description: 'Raindrop integration for bookmark management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['raindrop', 'bookmarks', 'favorites', 'collection'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-bookmark', name: 'Create Bookmark', description: 'Create a new bookmark' },
      { id: 'update-bookmark', name: 'Update Bookmark', description: 'Update a bookmark' },
      { id: 'delete-bookmark', name: 'Delete Bookmark', description: 'Delete a bookmark' },
      { id: 'list-collections', name: 'List Collections', description: 'List all collections' },
      { id: 'list-bookmarks', name: 'List Bookmarks', description: 'List bookmarks in a collection' },
    ],
  };

  private baseUrl = 'https://api.raindrop.io/v1';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Raindrop API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listCollections(): Promise<{ items: RaindropCollection[] }> {
    return this.apiCall('/collections');
  }

  async getCollection(collectionId: string): Promise<RaindropCollection & { bookmarks: RaindropBookmark[] }> {
    return this.apiCall(`/collections/${collectionId}`);
  }

  async createBookmark(bookmark: { title: string; link: string; description?: string; tags?: string[]; collectionId?: string }): Promise<RaindropBookmark> {
    return this.apiCall('/bookmarks', {
      method: 'POST',
      body: JSON.stringify(bookmark),
    });
  }

  async updateBookmark(bookmarkId: string, bookmark: { title?: string; description?: string; tags?: string[] }): Promise<RaindropBookmark> {
    return this.apiCall(`/bookmarks/${bookmarkId}`, {
      method: 'PUT',
      body: JSON.stringify(bookmark),
    });
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    await this.apiCall(`/bookmarks/${bookmarkId}`, { method: 'DELETE' });
  }

  async searchBookmarks(query: string): Promise<{ items: RaindropBookmark[] }> {
    return this.apiCall(`/bookmarks?search=${encodeURIComponent(query)}`);
  }
}

export interface PocketArticle {
  itemId: string;
  resolvedId: string;
  givenUrl: string;
  resolvedUrl: string;
  title: string;
  excerpt: string;
  host: string;
  timeAdded: string;
  timeRead?: string;
  favorite: string;
  status: 'unread' | 'archive' | 'delete';
  wordCount: number;
}

export class PocketPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/pocket',
    name: 'Pocket',
    version: '1.0.0',
    description: 'Pocket integration for reading list management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['pocket', 'read-later', 'articles', 'bookmarks'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'article-added', name: 'Article Added', description: 'Triggered when an article is added' },
      { id: 'article-archived', name: 'Article Archived', description: 'Triggered when an article is archived' },
    ],
    actions: [
      { id: 'add-article', name: 'Add Article', description: 'Add a new article' },
      { id: 'archive-article', name: 'Archive Article', description: 'Archive an article' },
      { id: 'delete-article', name: 'Delete Article', description: 'Delete an article' },
      { id: 'list-articles', name: 'List Articles', description: 'List articles' },
    ],
  };

  private consumerKey: string | null = null;
  private accessToken: string | null = null;

  setCredentials(consumerKey: string, accessToken: string): void {
    this.consumerKey = consumerKey;
    this.accessToken = accessToken;
  }

  private async apiCall<T>(endpoint: string, data: Record<string, unknown>): Promise<T> {
    if (!this.consumerKey || !this.accessToken) throw new Error('Not authenticated');

    const response = await fetch('https://getpocket.com/v3' + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Accept': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: this.consumerKey,
        access_token: this.accessToken,
        ...data,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pocket API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async addArticle(url: string, options: { title?: string; tags?: string[] } = {}): Promise<{ item: { itemId: string } }> {
    return this.apiCall('/add', { url, title: options.title, tags: options.tags });
  }

  async listArticles(options: { state?: 'unread' | 'archive' | 'all'; count?: number } = {}): Promise<{ list: Record<string, PocketArticle> }> {
    return this.apiCall('/get', {
      state: options.state || 'unread',
      count: options.count || 30,
      detailType: 'complete',
    });
  }

  async archiveArticle(itemId: string): Promise<void> {
    await this.apiCall('/archive', { item: itemId });
  }

  async unarchiveArticle(itemId: string): Promise<void> {
    await this.apiCall('/unarchive', { item: itemId });
  }

  async deleteArticle(itemId: string): Promise<void> {
    await this.apiCall('/delete', { item: itemId });
  }

  async favoriteArticle(itemId: string): Promise<void> {
    await this.apiCall('/favorite', { item: itemId });
  }
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  durationMs: number;
  uri: string;
  previewUrl?: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  owner: { displayName: string };
  images: { url: string }[];
  tracks: { total: number };
}

export class SpotifyPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/spotify',
    name: 'Spotify',
    version: '1.0.0',
    description: 'Spotify integration for music playback',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['spotify', 'music', 'player', 'playlist'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'track-playing', name: 'Track Playing', description: 'Triggered when a track starts playing' },
      { id: 'track-paused', name: 'Track Paused', description: 'Triggered when playback is paused' },
    ],
    actions: [
      { id: 'play-track', name: 'Play Track', description: 'Play a track' },
      { id: 'pause-playback', name: 'Pause Playback', description: 'Pause playback' },
      { id: 'create-playlist', name: 'Create Playlist', description: 'Create a new playlist' },
      { id: 'add-to-playlist', name: 'Add to Playlist', description: 'Add track to playlist' },
      { id: 'search-tracks', name: 'Search Tracks', description: 'Search for tracks' },
    ],
  };

  private baseUrl = 'https://api.spotify.com/v1';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Spotify API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async getCurrentPlayback(): Promise<{ isPlaying: boolean; item: SpotifyTrack; progressMs: number } | null> {
    return this.apiCall('/me/player/currently-playing');
  }

  async searchTracks(query: string, options: { limit?: number } = {}): Promise<{ tracks: { items: SpotifyTrack[] } }> {
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('type', 'track');
    if (options.limit) params.set('limit', options.limit.toString());

    return this.apiCall(`/search?${params.toString()}`);
  }

  async getTrack(trackId: string): Promise<SpotifyTrack> {
    return this.apiCall(`/tracks/${trackId}`);
  }

  async listPlaylists(): Promise<{ items: SpotifyPlaylist[] }> {
    return this.apiCall('/me/playlists');
  }

  async createPlaylist(playlist: { name: string; description?: string }): Promise<SpotifyPlaylist> {
    return this.apiCall('/me/playlists', {
      method: 'POST',
      body: JSON.stringify(playlist),
    });
  }

  async addToPlaylist(playlistId: string, trackUris: string[]): Promise<void> {
    await this.apiCall(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: trackUris }),
    });
  }

  async pausePlayback(): Promise<void> {
    await this.apiCall('/me/player/pause', { method: 'PUT' });
  }

  async playTrack(contextUri?: string, trackUri?: string): Promise<void> {
    const body: Record<string, unknown> = {};
    if (contextUri) body.contextUri = contextUri;
    if (trackUri) body.uris = [trackUri];

    await this.apiCall('/me/player/play', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async getUserProfile(): Promise<{ id: string; displayName: string; email: string }> {
    return this.apiCall('/me');
  }
}

export interface AppleReminder {
  id: string;
  title: string;
  notes?: string;
  dueDate?: string;
  priority: number;
  completed: boolean;
  listId: string;
}

export interface AppleReminderList {
  id: string;
  name: string;
  color?: string;
}

export class AppleRemindersPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/apple-reminders',
    name: 'Apple Reminders',
    version: '1.0.0',
    description: 'Apple Reminders integration for task management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['apple', 'reminders', 'tasks', 'ios'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'reminder-created', name: 'Reminder Created', description: 'Triggered when a reminder is created' },
      { id: 'reminder-completed', name: 'Reminder Completed', description: 'Triggered when a reminder is completed' },
    ],
    actions: [
      { id: 'create-reminder', name: 'Create Reminder', description: 'Create a new reminder' },
      { id: 'complete-reminder', name: 'Complete Reminder', description: 'Complete a reminder' },
      { id: 'delete-reminder', name: 'Delete Reminder', description: 'Delete a reminder' },
      { id: 'list-reminders', name: 'List Reminders', description: 'List reminders' },
    ],
  };
}

export interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  completed: boolean;
  dueOn?: string;
  dueAt?: string;
  assignee?: { gid: string; name: string };
  memberships: { section: { name: string } }[];
}

export interface AsanaProject {
  gid: string;
  name: string;
  notes?: string;
  workspace: { gid: string; name: string };
}

export class AsanaPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/asana',
    name: 'Asana',
    version: '1.0.0',
    description: 'Asana integration for project management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['asana', 'project', 'tasks', 'management'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'task-created', name: 'Task Created', description: 'Triggered when a task is created' },
      { id: 'task-completed', name: 'Task Completed', description: 'Triggered when a task is completed' },
    ],
    actions: [
      { id: 'create-task', name: 'Create Task', description: 'Create a new task' },
      { id: 'update-task', name: 'Update Task', description: 'Update a task' },
      { id: 'complete-task', name: 'Complete Task', description: 'Complete a task' },
      { id: 'list-tasks', name: 'List Tasks', description: 'List tasks' },
    ],
  };

  private baseUrl = 'https://app.asana.com/api/1.0';
  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Asana API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { data: T };
    return data.data;
  }

  async listProjects(): Promise<AsanaProject[]> {
    return this.apiCall('/projects');
  }

  async listTasks(projectId: string): Promise<AsanaTask[]> {
    return this.apiCall(`/projects/${projectId}/tasks?opt_fields=name,notes,completed,dueOn,dueAt,assignee,memberships.section.name`);
  }

  async createTask(task: { name: string; notes?: string; projects: string[]; assignee?: string }): Promise<AsanaTask> {
    return this.apiCall('/tasks', {
      method: 'POST',
      body: JSON.stringify({ data: task }),
    });
  }

  async updateTask(taskId: string, task: { name?: string; notes?: string; completed?: boolean }): Promise<AsanaTask> {
    return this.apiCall(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ data: task }),
    });
  }
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

export interface AirtableTable {
  id: string;
  name: string;
  fields: { name: string; type: string }[];
}

export interface AirtableBase {
  id: string;
  name: string;
}

export class AirtablePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/airtable',
    name: 'Airtable',
    version: '1.0.0',
    description: 'Airtable integration for database management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['airtable', 'database', 'records', 'spreadsheet'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-record', name: 'Create Record', description: 'Create a new record' },
      { id: 'update-record', name: 'Update Record', description: 'Update a record' },
      { id: 'delete-record', name: 'Delete Record', description: 'Delete a record' },
      { id: 'list-records', name: 'List Records', description: 'List records' },
      { id: 'list-bases', name: 'List Bases', description: 'List all bases' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(baseUrl: string, endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Airtable API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listBases(): Promise<{ bases: AirtableBase[] }> {
    return this.apiCall('https://api.airtable.com/v0', '/meta/bases');
  }

  async listTables(baseId: string): Promise<{ tables: AirtableTable[] }> {
    return this.apiCall(`https://api.airtable.com/v0/meta/bases/${baseId}`, '/tables');
  }

  async listRecords(baseId: string, tableName: string, options: { maxRecords?: number; view?: string } = {}): Promise<{ records: AirtableRecord[] }> {
    const params = new URLSearchParams();
    if (options.maxRecords) params.set('maxRecords', options.maxRecords.toString());
    if (options.view) params.set('view', options.view);

    return this.apiCall(`https://api.airtable.com/v0/${baseId}`, `/${encodeURIComponent(tableName)}?${params.toString()}`);
  }

  async createRecord(baseId: string, tableName: string, fields: Record<string, unknown>): Promise<{ id: string }> {
    const result = await this.apiCall<{ records: { id: string }[] }>(`https://api.airtable.com/v0/${baseId}`, `/${encodeURIComponent(tableName)}`, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
    return result.records[0];
  }

  async updateRecord(baseId: string, tableName: string, recordId: string, fields: Record<string, unknown>): Promise<{ id: string }> {
    const result = await this.apiCall<{ records: { id: string }[] }>(`https://api.airtable.com/v0/${baseId}`, `/${encodeURIComponent(tableName)}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    });
    return result.records[0];
  }

  async deleteRecord(baseId: string, tableName: string, recordId: string): Promise<{ id: string; deleted: boolean }> {
    return this.apiCall(`https://api.airtable.com/v0/${baseId}`, `/${encodeURIComponent(tableName)}/${recordId}`, { method: 'DELETE' });
  }
}

export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  space?: { key: string };
  authorId: string;
  createdAt: string;
  version: { number: number; message?: string };
  body?: { storage: { value: string } };
}

export class ConfluencePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/confluence',
    name: 'Confluence',
    version: '1.0.0',
    description: 'Confluence integration for team collaboration',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['confluence', 'wiki', 'documentation', 'team'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-page', name: 'Create Page', description: 'Create a new page' },
      { id: 'update-page', name: 'Update Page', description: 'Update a page' },
      { id: 'list-pages', name: 'List Pages', description: 'List pages in a space' },
    ],
  };

  private baseUrl: string = '';
  private accessToken: string | null = null;
  private email: string | null = null;

  setCredentials(baseUrl: string, email: string, apiToken: string): void {
    this.baseUrl = baseUrl;
    this.email = email;
    this.accessToken = apiToken;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken || !this.email) throw new Error('Not authenticated');

    const credentials = btoa(`${this.email}:${this.accessToken}`);

    const response = await fetch(`${this.baseUrl}/wiki/api/v2${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Confluence API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listPages(spaceKey: string): Promise<ConfluencePage[]> {
    return this.apiCall(`/spaces/${spaceKey}/pages`);
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    return this.apiCall(`/pages/${pageId}`);
  }

  async createPage(page: { spaceId: string; title: string; content?: string; status?: string }): Promise<ConfluencePage> {
    return this.apiCall('/pages', {
      method: 'POST',
      body: JSON.stringify({
        spaceId: page.spaceId,
        status: page.status || 'current',
        title: page.title,
        body: page.content ? { representation: 'storage', value: page.content } : undefined,
      }),
    });
  }

  async updatePage(pageId: string, page: { title?: string; content?: string }): Promise<ConfluencePage> {
    return this.apiCall(`/pages/${pageId}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: pageId,
        title: page.title,
        body: page.content ? { representation: 'storage', value: page.content } : undefined,
      }),
    });
  }
}

export class DropboxPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/dropbox',
    name: 'Dropbox',
    version: '1.0.0',
    description: 'Dropbox integration for cloud storage',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['dropbox', 'cloud', 'storage', 'files'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'upload-file', name: 'Upload File', description: 'Upload a file' },
      { id: 'download-file', name: 'Download File', description: 'Download a file' },
      { id: 'list-files', name: 'List Files', description: 'List files' },
      { id: 'delete-file', name: 'Delete File', description: 'Delete a file' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const response = await fetch('https://content.dropboxapi.com/2' + endpoint, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify(options.headers?.['Dropbox-API-Arg'] || {}),
        'Content-Type': 'application/octet-stream',
      },
    });

    if (!response.ok) throw new Error(`Dropbox API error: ${response.status}`);
    return response.json() as Promise<T>;
  }
}

export class EvernotePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/evernote',
    name: 'Evernote',
    version: '1.0.0',
    description: 'Evernote integration for note-taking',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['evernote', 'notes', 'notebook', 'knowledge'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-note', name: 'Create Note', description: 'Create a new note' },
      { id: 'update-note', name: 'Update Note', description: 'Update a note' },
      { id: 'list-notes', name: 'List Notes', description: 'List notes' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class FigmaPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/figma',
    name: 'Figma',
    version: '1.0.0',
    description: 'Figma integration for design collaboration',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['figma', 'design', 'ui', 'prototype'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'get-file', name: 'Get File', description: 'Get a Figma file' },
      { id: 'get-nodes', name: 'Get Nodes', description: 'Get specific nodes' },
      { id: 'list-comments', name: 'List Comments', description: 'List file comments' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class GiphyPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/giphy',
    name: 'GIPHY',
    version: '1.0.0',
    description: 'GIPHY integration for GIF search',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['giphy', 'gif', 'animation', 'search'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'search-gifs', name: 'Search GIFs', description: 'Search for GIFs' },
      { id: 'trending-gifs', name: 'Trending GIFs', description: 'Get trending GIFs' },
    ],
  };

  private apiKey: string | null = null;

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
}

export class GrafanaPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/grafana',
    name: 'Grafana',
    version: '1.0.0',
    description: 'Grafana integration for observability',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['grafana', 'metrics', 'dashboard', 'observability'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'query-metrics', name: 'Query Metrics', description: 'Query metrics data' },
      { id: 'list-dashboards', name: 'List Dashboards', description: 'List dashboards' },
    ],
  };

  private baseUrl: string = '';
  private accessToken: string | null = null;

  setCredentials(baseUrl: string, accessToken: string): void {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }
}

export class HubSpotPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/hubspot',
    name: 'HubSpot',
    version: '1.0.0',
    description: 'HubSpot integration for CRM',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['hubspot', 'crm', 'contacts', 'sales'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-contact', name: 'Create Contact', description: 'Create a contact' },
      { id: 'update-contact', name: 'Update Contact', description: 'Update a contact' },
      { id: 'list-contacts', name: 'List Contacts', description: 'List contacts' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class IntercomPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/intercom',
    name: 'Intercom',
    version: '1.0.0',
    description: 'Intercom integration for customer messaging',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['intercom', 'messaging', 'customer', 'support'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-user', name: 'Create User', description: 'Create a user' },
      { id: 'send-message', name: 'Send Message', description: 'Send a message' },
      { id: 'list-conversations', name: 'List Conversations', description: 'List conversations' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class MailchimpPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/mailchimp',
    name: 'Mailchimp',
    version: '1.0.0',
    description: 'Mailchimp integration for email marketing',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['mailchimp', 'email', 'marketing', 'campaigns'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'add-subscriber', name: 'Add Subscriber', description: 'Add a subscriber' },
      { id: 'create-campaign', name: 'Create Campaign', description: 'Create a campaign' },
      { id: 'send-campaign', name: 'Send Campaign', description: 'Send a campaign' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class PagerDutyPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/pagerduty',
    name: 'PagerDuty',
    version: '1.0.0',
    description: 'PagerDuty integration for incident management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['pagerduty', 'incidents', 'on-call', 'alerts'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'trigger-incident', name: 'Trigger Incident', description: 'Trigger an incident' },
      { id: 'acknowledge-incident', name: 'Acknowledge Incident', description: 'Acknowledge an incident' },
      { id: 'resolve-incident', name: 'Resolve Incident', description: 'Resolve an incident' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class SalesforcePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/salesforce',
    name: 'Salesforce',
    version: '1.0.0',
    description: 'Salesforce integration for CRM',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['salesforce', 'crm', 'sales', 'leads'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-lead', name: 'Create Lead', description: 'Create a lead' },
      { id: 'update-lead', name: 'Update Lead', description: 'Update a lead' },
      { id: 'query-records', name: 'Query Records', description: 'SOQL query' },
    ],
  };

  private accessToken: string | null = null;
  private instanceUrl: string | null = null;

  setCredentials(instanceUrl: string, accessToken: string): void {
    this.instanceUrl = instanceUrl;
    this.accessToken = accessToken;
  }
}

export class StripePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/stripe',
    name: 'Stripe',
    version: '1.0.0',
    description: 'Stripe integration for payments',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['stripe', 'payments', 'billing', 'invoices'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-customer', name: 'Create Customer', description: 'Create a customer' },
      { id: 'create-charge', name: 'Create Charge', description: 'Create a charge' },
      { id: 'create-invoice', name: 'Create Invoice', description: 'Create an invoice' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class TwilioPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/twilio',
    name: 'Twilio',
    version: '1.0.0',
    description: 'Twilio integration for messaging and voice',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['twilio', 'sms', 'voice', 'phone'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'send-sms', name: 'Send SMS', description: 'Send an SMS' },
      { id: 'make-call', name: 'Make Call', description: 'Make a voice call' },
    ],
  };

  private accountSid: string | null = null;
  private authToken: string | null = null;

  setCredentials(accountSid: string, authToken: string): void {
    this.accountSid = accountSid;
    this.authToken = authToken;
  }
}

export class TypeformPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/typeform',
    name: 'Typeform',
    version: '1.0.0',
    description: 'Typeform integration for forms and surveys',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['typeform', 'forms', 'surveys', 'responses'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'form-submitted', name: 'Form Submitted', description: 'Triggered when a form is submitted' },
    ],
    actions: [
      { id: 'create-form', name: 'Create Form', description: 'Create a form' },
      { id: 'list-responses', name: 'List Responses', description: 'List form responses' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class ZendeskPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/zendesk',
    name: 'Zendesk',
    version: '1.0.0',
    description: 'Zendesk integration for customer support',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['zendesk', 'support', 'tickets', 'helpdesk'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-ticket', name: 'Create Ticket', description: 'Create a ticket' },
      { id: 'update-ticket', name: 'Update Ticket', description: 'Update a ticket' },
      { id: 'list-tickets', name: 'List Tickets', description: 'List tickets' },
    ],
  };

  private subdomain: string = '';
  private accessToken: string | null = null;
  private email: string | null = null;

  setCredentials(subdomain: string, email: string, accessToken: string): void {
    this.subdomain = subdomain;
    this.email = email;
    this.accessToken = accessToken;
  }
}

export class ZoomPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/zoom',
    name: 'Zoom',
    version: '1.0.0',
    description: 'Zoom integration for video conferencing',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['zoom', 'video', 'conference', 'meetings'],
  };

  public capabilities: PluginCapabilities = {
    triggers: [
      { id: 'meeting-started', name: 'Meeting Started', description: 'Triggered when a meeting starts' },
      { id: 'meeting-ended', name: 'Meeting Ended', description: 'Triggered when a meeting ends' },
    ],
    actions: [
      { id: 'create-meeting', name: 'Create Meeting', description: 'Create a meeting' },
      { id: 'list-meetings', name: 'List Meetings', description: 'List meetings' },
      { id: 'delete-meeting', name: 'Delete Meeting', description: 'Delete a meeting' },
    ],
  };

  private accessToken: string | null = null;

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class RoamResearchPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/roam',
    name: 'Roam Research',
    version: '1.0.0',
    description: 'Roam Research integration for knowledge management',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['roam', 'research', 'notes', 'knowledge'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-block', name: 'Create Block', description: 'Create a block' },
      { id: 'update-block', name: 'Update Block', description: 'Update a block' },
      { id: 'query-graph', name: 'Query Graph', description: 'Query graph data' },
    ],
  };

  private graphName: string = '';
  private apiToken: string | null = null;

  setCredentials(graphName: string, apiToken: string): void {
    this.graphName = graphName;
    this.apiToken = apiToken;
  }
}

export const INTEGRATION_PLUGINS: Plugin[] = [
  new GoogleCalendarPlugin(),
  new GoogleGmailPlugin(),
  new GoogleDrivePlugin(),
  new GoogleTasksPlugin(),
  new MicrosoftOutlookPlugin(),
  new MicrosoftTeamsPlugin(),
  new MicrosoftTodoPlugin(),
  new SlackPlugin(),
  new DiscordPlugin(),
  new GitHubPlugin(),
  new GitLabPlugin(),
  new JiraPlugin(),
  new LinearPlugin(),
  new TrelloPlugin(),
  new NotionPlugin(),
  new ObsidianPlugin(),
  new TodoistPlugin(),
  new RaindropPlugin(),
  new PocketPlugin(),
  new SpotifyPlugin(),
  new AppleRemindersPlugin(),
  new AsanaPlugin(),
  new AirtablePlugin(),
  new ConfluencePlugin(),
  new DropboxPlugin(),
  new EvernotePlugin(),
  new FigmaPlugin(),
  new GiphyPlugin(),
  new GrafanaPlugin(),
  new HubSpotPlugin(),
  new IntercomPlugin(),
  new MailchimpPlugin(),
  new PagerDutyPlugin(),
  new SalesforcePlugin(),
  new StripePlugin(),
  new TwilioPlugin(),
  new TypeformPlugin(),
  new ZendeskPlugin(),
  new ZoomPlugin(),
  new RoamResearchPlugin(),
];