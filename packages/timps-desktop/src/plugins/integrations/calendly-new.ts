import { IntegrationBase } from './integration-base';

export interface CalendlyEvent {
  uri: string;
  name: string;
  status: 'active' | 'cancelled';
  startTime: string;
  endTime: string;
  eventType: string;
  location?: { type: string; location?: string };
  inviteesCounter: { total: number; active: number; limit?: number };
  createdAt: string;
  updatedAt: string;
}

export interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  questionsAndAnswers?: Array<{ question: string; answer: string }>;
  timezone?: string;
  event: string;
  cancellation?: { reason: string; cancelledBy: string; cancelledAt: string };
  noShow?: string;
  paid?: boolean;
  payments?: Array<{ amount: number; currency: string; status: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: 'active' | 'cancelled';
  startTime: string;
  endTime: string;
  eventType: string;
  location?: { type: string; location?: string };
  invitees: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendlyWebhook {
  uri: string;
  url: string;
  state: 'active' | 'inactive';
  events: string[];
  scope: string;
  organization: string;
  creator: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  schedulingUrl: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  slug: string;
  status: 'active' | 'cancelled';
  color: string;
  description: string;
  descriptionPlainText: string;
  duration: number;
  internalNote: string;
  location?: { type: string; location?: string };
  poolingType: string;
  schedulingUrl: string;
  available: boolean;
  showEventDetails: boolean;
  inviteeRequirements: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendlyLocation {
  type: string;
  location?: string;
  joinUrl?: string;
  instructions?: string;
}

export interface CalendlyQuestion {
  name: string;
  answer: string;
}

export interface CalendlyTracking {
  utmCampaign?: string;
  utmSource?: string;
  utmMedium?: string;
  utmContent?: string;
  utmTerm?: string;
}

interface CalendlyConfig {
  apiKey: string;
}

export class CalendlyPlugin extends IntegrationBase {
  private config: CalendlyConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('Calendly', 'Calendly', 'Scheduling and meeting integration');
    this.config = {} as CalendlyConfig;
  }

  setApiKey(apiKey: string): void {
    this.config = { apiKey };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  private getBaseUrl(): string {
    return 'https://api.calendly.com/v2';
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async getCurrentUser(): Promise<CalendlyUser> {
    return this.apiCall<CalendlyUser>('GET', '/users/me');
  }

  async listEventTypes(): Promise<{ collection: CalendlyEventType[] }> {
    return this.apiCall<{ collection: CalendlyEventType[] }>('GET', '/event_types');
  }

  async getEventType(eventTypeUri: string): Promise<CalendlyEventType> {
    const id = eventTypeUri.split('/').pop();
    return this.apiCall<CalendlyEventType>('GET', `/event_types/${id}`);
  }

  async listEvents(options?: { maxStartTime?: string; minStartTime?: string; status?: string }): Promise<{ collection: CalendlyEvent[] }> {
    const params = new URLSearchParams();
    if (options?.maxStartTime) params.append('max_start_time', options.maxStartTime);
    if (options?.minStartTime) params.append('min_start_time', options.minStartTime);
    if (options?.status) params.append('status', options.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ collection: CalendlyEvent[] }>('GET', `/scheduled_events${query}`);
  }

  async getEvent(eventUri: string): Promise<CalendlyScheduledEvent> {
    const id = eventUri.split('/').pop();
    return this.apiCall<CalendlyScheduledEvent>('GET', `/scheduled_events/${id}`);
  }

  async cancelEvent(eventUri: string, reason: string): Promise<void> {
    const id = eventUri.split('/').pop();
    return this.apiCall<void>('POST', `/scheduled_events/${id}/cancellation`, { reason });
  }

  async invitees(eventUri: string, options?: { status?: string }): Promise<{ collection: CalendlyInvitee[] }> {
    const eventId = eventUri.split('/').pop();
    const params = options?.status ? `?status=${options.status}` : '';
    return this.apiCall<{ collection: CalendlyInvitee[] }>('GET', `/scheduled_events/${eventId}/invitees${params}`);
  }

  async listInvitees(options?: { maxStartTime?: string; minStartTime?: string }): Promise<{ collection: CalendlyInvitee[] }> {
    const params = new URLSearchParams();
    if (options?.maxStartTime) params.append('max_start_time', options.maxStartTime);
    if (options?.minStartTime) params.append('min_start_time', options.minStartTime);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ collection: CalendlyInvitee[] }>('GET', `/invitees${query}`);
  }

  async getInvitee(inviteeUri: string): Promise<CalendlyInvitee> {
    const id = inviteeUri.split('/').pop();
    return this.apiCall<CalendlyInvitee>('GET', `/invitees/${id}`);
  }

  async cancelInvitee(inviteeUri: string, reason: string): Promise<void> {
    const id = inviteeUri.split('/').pop();
    return this.apiCall<void>('POST', `/invitees/${id}/cancellation`, { reason });
  }

  async listWebhooks(): Promise<{ collection: CalendlyWebhook[] }> {
    return this.apiCall<{ collection: CalendlyWebhook[] }>('GET', '/webhook_subscriptions');
  }

  async createWebhook(webhook: { url: string; events: string[]; organization?: string; scope?: string }): Promise<CalendlyWebhook> {
    return this.apiCall<CalendlyWebhook>('POST', '/webhook_subscriptions', webhook);
  }

  async getWebhook(webhookUri: string): Promise<CalendlyWebhook> {
    const id = webhookUri.split('/').pop();
    return this.apiCall<CalendlyWebhook>('GET', `/webhook_subscriptions/${id}`);
  }

  async updateWebhook(webhookUri: string, updates: { url?: string; state?: 'active' | 'inactive' }): Promise<CalendlyWebhook> {
    const id = webhookUri.split('/').pop();
    return this.apiCall<CalendlyWebhook>('PATCH', `/webhook_subscriptions/${id}`, updates);
  }

  async deleteWebhook(webhookUri: string): Promise<void> {
    const id = webhookUri.split('/').pop();
    return this.apiCall<void>('DELETE', `/webhook_subscriptions/${id}`);
  }

  async listUsers(): Promise<{ collection: CalendlyUser[] }> {
    return this.apiCall<{ collection: CalendlyUser[] }>('GET', '/users');
  }

  async getUser(userUri: string): Promise<CalendlyUser> {
    const id = userUri.split('/').pop();
    return this.apiCall<CalendlyUser>('GET', `/users/${id}`);
  }

  async scheduleMeeting(eventTypeUri: string, inviteeEmail: string, inviteeName: string, startTime: string, timezone?: string, questions?: CalendlyQuestion[], location?: CalendlyLocation, tracking?: CalendlyTracking): Promise<CalendlyScheduledEvent> {
    const eventTypeId = eventTypeUri.split('/').pop();
    return this.apiCall<CalendlyScheduledEvent>('POST', '/scheduled_events', {
      event_type: eventTypeUri,
      start_time: startTime,
      invitee: { email: inviteeEmail, name: inviteeName, questions_and_answers: questions },
      timezone,
      location,
      tracking,
    });
  }

  async getEventTypesByUUID(uuid: string): Promise<CalendlyEventType> {
    return this.apiCall<CalendlyEventType>('GET', `/event_types/${uuid}`);
  }

  async getSingleUseScheduledEvent(eventUri: string): Promise<CalendlyScheduledEvent> {
    const id = eventUri.split('/').pop();
    return this.apiCall<CalendlyScheduledEvent>('GET', `/scheduled_events/${id}`);
  }

  getManifest() {
    return {
      name: 'Calendly',
      id: 'calendly',
      description: 'Scheduling and meeting integration',
      version: '1.0.0',
      actions: [
        { id: 'get_current_user', name: 'Get Current User', description: 'Get current authenticated user' },
        { id: 'list_event_types', name: 'List Event Types', description: 'List all event types' },
        { id: 'get_event_type', name: 'Get Event Type', description: 'Get event type details' },
        { id: 'list_events', name: 'List Events', description: 'List scheduled events' },
        { id: 'get_event', name: 'Get Event', description: 'Get scheduled event details' },
        { id: 'cancel_event', name: 'Cancel Event', description: 'Cancel a scheduled event' },
        { id: 'invitees', name: 'Get Invitees', description: 'Get invitees for an event' },
        { id: 'list_invitees', name: 'List Invitees', description: 'List all invitees' },
        { id: 'get_invitee', name: 'Get Invitee', description: 'Get invitee details' },
        { id: 'cancel_invitee', name: 'Cancel Invitee', description: 'Cancel an invitee' },
        { id: 'list_webhooks', name: 'List Webhooks', description: 'List all webhooks' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a new webhook' },
        { id: 'get_webhook', name: 'Get Webhook', description: 'Get webhook details' },
        { id: 'update_webhook', name: 'Update Webhook', description: 'Update webhook settings' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete a webhook' },
        { id: 'list_users', name: 'List Users', description: 'List all team members' },
        { id: 'get_user', name: 'Get User', description: 'Get user details' },
        { id: 'schedule_meeting', name: 'Schedule Meeting', description: 'Schedule a new meeting' },
      ],
      triggers: [
        { id: 'invitee_created', name: 'Invitee Created', description: 'Triggered when a new invitee is created' },
        { id: 'invitee_cancelled', name: 'Invitee Cancelled', description: 'Triggered when an invitee cancels' },
        { id: 'invitee_no_show', name: 'Invitee No Show', description: 'Triggered when an invitee is marked as no-show' },
        { id: 'routing_submission', name: 'Routing Submission', description: 'Triggered when a routing form is submitted' },
        { id: 'event_scheduled', name: 'Event Scheduled', description: 'Triggered when an event is scheduled' },
        { id: 'event_cancelled', name: 'Event Cancelled', description: 'Triggered when an event is cancelled' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'apiKey', label: 'API Key', description: 'Your Calendly API key', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/users/me',
        method: 'GET',
      },
    };
  }
}

export const calendlyPlugin = new CalendlyPlugin();