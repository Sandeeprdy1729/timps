import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface MicrosoftOutlookEvent {
  id: string;
  subject: string;
  body: { contentType: string; content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location: { displayName: string };
  attendees: Array<{ emailAddress: { address: string }; status: { response: string } }>;
}

export interface MicrosoftOutlookMail {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name: string } };
  to: Array<{ emailAddress: { address: string } }>;
  receivedDateTime: string;
  bodyPreview: string;
}

const MANIFEST: PluginManifest = {
  id: 'microsoft-outlook',
  name: 'Microsoft Outlook',
  version: '1.0.0',
  description: 'Microsoft Outlook email and calendar integration',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['microsoft', 'outlook', 'email', 'calendar'],
};

const SCOPES = ['getEvents', 'getEvent', 'createEvent', 'updateEvent', 'deleteEvent', 'getMessages', 'getMessage', 'sendMessage', 'replyToMessage', 'forwardMessage', 'getFolders', 'createFolder', 'getAttachments', 'createAttachment'];

export default class MicrosoftOutlookIntegration extends IntegrationBase {
  private apiBase = 'https://graph.microsoft.com/v1.0';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = { actions: SCOPES, triggers: ['event_created', 'event_updated', 'mail_received'], dataModels: ['event', 'mail', 'folder'] };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);
    try {
      const me = await this.apiCall<{ id: string }>(`${this.apiBase}/me`, { headers: { Authorization: `Bearer ${config.accessToken}` } });
      return !!me.id;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/me`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getEvents': return this.apiCall<{ value: MicrosoftOutlookEvent[] }>(`${this.apiBase}/me/events`, { headers });
      case 'getEvent': return this.apiCall<MicrosoftOutlookEvent>(`${this.apiBase}/me/events/${params.eventId}`, { headers });
      case 'createEvent': return this.apiCall<MicrosoftOutlookEvent>(`${this.apiBase}/me/events`, { method: 'POST', headers, body: JSON.stringify(params.event) });
      case 'updateEvent': return this.apiCall(`${this.apiBase}/me/events/${params.eventId}`, { method: 'PATCH', headers, body: JSON.stringify(params.updates) });
      case 'deleteEvent': return this.apiCall(`${this.apiBase}/me/events/${params.eventId}`, { method: 'DELETE', headers });
      case 'getMessages': return this.apiCall<{ value: MicrosoftOutlookMail[] }>(`${this.apiBase}/me/messages`, { headers });
      case 'getMessage': return this.apiCall<MicrosoftOutlookMail>(`${this.apiBase}/me/messages/${params.messageId}`, { headers });
      case 'sendMessage': return this.apiCall<MicrosoftOutlookMail>(`${this.apiBase}/me/sendMail`, { method: 'POST', headers, body: JSON.stringify({ message: params.message }) });
      case 'replyToMessage': return this.apiCall(`${this.apiBase}/me/messages/${params.messageId}/reply`, { method: 'POST', headers, body: JSON.stringify({ message: params.reply }) });
      case 'getFolders': return this.apiCall(`${this.apiBase}/me/mailFolders`, { headers });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'events': return this.executeAction('getEvents', options || {});
      case 'messages': return this.executeAction('getMessages', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createMicrosoftOutlookIntegration(): MicrosoftOutlookIntegration { return new MicrosoftOutlookIntegration(); }