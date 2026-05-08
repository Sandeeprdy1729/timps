import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface CalendlyEvent {
  uri: string;
  name: string;
  status: 'active' | 'cancelled';
  start_time: string;
  end_time: string;
  event_type: string;
  location?: CalendlyLocation;
  invitees_counter: { total: number; active: number; limit: location };
}

export interface CalendlyLocation {
  type: string;
  location?: string;
  join_url?: string;
}

export interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: 'active' | 'cancelled';
  created_at: string;
  questions_and_answers?: Array<{ question: string; answer: string }>;
}

export interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  scheduling_url: string;
  timezone: string;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  slug: string;
  duration: number;
  scheduling_url: string;
  description_plain: string;
}

export interface CalendlyWebhook {
  uri: string;
  url: string;
  state: 'active' | 'cancelled';
  events: string[];
}

const MANIFEST: PluginManifest = {
  id: 'calendly',
  name: 'Calendly',
  version: '1.0.0',
  description: 'Calendly integration for scheduling, events, and booking management',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['calendly', 'scheduling', 'booking', 'calendar'],
};

const SCOPES = [
  'getCurrentUser', 'getUser', 'getEventTypes', 'getEventType', 'getScheduledEvents', 'getEvent', 'cancelEvent',
  'getInvitees', 'getInvitee', 'cancelInvitee', 'getWebhooks', 'createWebhook', 'cancelWebhook', 'getLocations',
  'getPipelines', 'getPipelines', 'createPipelines', 'getActivity', 'getWebhookPayload', 'getRoutingForms',
];

export default class CalendlyIntegration extends IntegrationBase {
  private apiBase = 'https://api.calendly.com/v2';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['invitee.created', 'invitee.canceled', 'routing_form_submission'],
      dataModels: ['event', 'invitee', 'user', 'event_type', 'webhook'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);
    try {
      const user = await this.apiCall<CalendlyUser>(`${this.apiBase}/users/me`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return !!user.uri;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/users/me`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getCurrentUser': return this.apiCall<CalendlyUser>(`${this.apiBase}/users/me`, { headers });
      case 'getUser': return this.apiCall<CalendlyUser>(`${this.apiBase}/users/${params.userUuid}`, { headers });
      case 'getEventTypes': return this.apiCall<{ collection: CalendlyEventType[] }>(`${this.apiBase}/event_types?user=${params.userUuid}`, { headers });
      case 'getEventType': return this.apiCall<CalendlyEventType>(`${this.apiBase}/event_types/${params.eventTypeUuid}`, { headers });
      case 'getScheduledEvents': return this.apiCall<{ collection: CalendlyEvent[] }>(`${this.apiBase}/scheduled_events?user=${params.userUuid}`, { headers });
      case 'getEvent': return this.apiCall<CalendlyEvent>(`${this.apiBase}/scheduled_events/${params.eventUuid}`, { headers });
      case 'cancelEvent': return this.apiCall(`${this.apiBase}/scheduled_events/${params.eventUuid}/cancellation`, {
        method: 'POST', headers, body: JSON.stringify({ reason: params.reason }) });
      case 'getInvitees': return this.apiCall<{ collection: CalendlyInvitee[] }>(`${this.apiBase}/invitees?event=${params.eventUuid}`, { headers });
      case 'getInvitee': return this.apiCall<CalendlyInvitee>(`${this.apiBase}/invitees/${params.inviteeUuid}`, { headers });
      case 'getWebhooks': return this.apiCall<{ collection: CalendlyWebhook[] }>(`${this.apiBase}/webhook_subscriptions`, { headers });
      case 'createWebhook': return this.apiCall<CalendlyWebhook>(`${this.apiBase}/webhook_subscriptions`, {
        method: 'POST', headers, body: JSON.stringify({ url: params.url, events: params.events, organization: params.organization, scope: params.scope }) });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'events': return this.executeAction('getScheduledEvents', options || {});
      case 'event_types': return this.executeAction('getEventTypes', options || {});
      case 'users': return this.executeAction('getCurrentUser', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }

  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createCalendlyIntegration(): CalendlyIntegration { return new CalendlyIntegration(); }