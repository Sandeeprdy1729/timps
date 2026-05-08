import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface PagerDutyIncident {
  id: string;
  incident_number: number;
  title: string;
  status: 'triggered' | 'acknowledged' | 'resolved';
  urgency: 'high' | 'low';
  service: { summary: string };
  created_at: string;
}

export interface PagerDutyService {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  escalation_policy: { summary: string };
}

export interface PagerDutyUser {
  id: string;
  name: string;
  email: string;
}

export interface PagerDutySchedule {
  id: string;
  name: string;
  time_zone: string;
}

const MANIFEST: PluginManifest = {
  id: 'pagerduty',
  name: 'PagerDuty',
  version: '1.0.0',
  description: 'PagerDuty incident management integration',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['pagerduty', 'incident', 'oncall', 'alerting'],
};

const SCOPES = [
  'getIncidents', 'getIncident', 'createIncident', 'updateIncident', 'resolveIncident', 'acknowledgeIncident',
  'getServices', 'getService', 'createService', 'updateService',
  'getUsers', 'getUser', 'createUser', 'updateUser',
  'getSchedules', 'getSchedule', 'createSchedule',
  'getEscalationPolicies', 'getEscalationPolicy', 'createEscalationPolicy',
  'getExtensions', 'createExtension',
  'getBusinessRULES', 'createBusinessRule',
  'getAutomationActions', 'triggerAction',
  'getPriorities', 'getPriority',
  'getChangeEvents', 'createChangeEvent',
];

export default class PagerDutyIntegration extends IntegrationBase {
  private apiBase = 'https://api.pagerduty.com/v2';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['incident_triggered', 'incident_acknowledged', 'incident_resolved'],
      dataModels: ['incident', 'service', 'user', 'schedule'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('API key is required');
    this.setAccessToken(config.accessToken);
    try {
      const me = await this.apiCall<{ user: { id: string } }>(`${this.apiBase}/users/me`, {
        headers: { Authorization: `Token token=${config.accessToken}`, 'Content-Type': 'application/json' },
      });
      return !!me.user?.id;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/users/me`, { headers: { Authorization: `Token token=${this.accessToken}` } });
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: `Token token=${this.accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' };

    switch (action) {
      case 'getIncidents': return this.apiCall<{ incidents: PagerDutyIncident[] }>(`${this.apiBase}/incidents`, { headers });
      case 'getIncident': return this.apiCall<PagerDutyIncident>(`${this.apiBase}/incidents/${params.incidentId}`, { headers });
      case 'createIncident': return this.apiCall<PagerDutyIncident>(`${this.apiBase}/incidents`, { method: 'POST', headers, body: JSON.stringify(params.incident) });
      case 'updateIncident': return this.apiCall(`${this.apiBase}/incidents/${params.incidentId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'acknowledgeIncident': return this.apiCall(`${this.apiBase}/incidents/${params.incidentId}`, { method: 'PUT', headers, body: JSON.stringify({ type: 'incident', incident: { type: 'incident_reference', status: 'acknowledged' } }) });
      case 'resolveIncident': return this.apiCall(`${this.apiBase}/incidents/${params.incidentId}`, { method: 'PUT', headers, body: JSON.stringify({ type: 'incident', incident: { type: 'incident_reference', status: 'resolved' } }) });
      case 'getServices': return this.apiCall<{ services: PagerDutyService[] }>(`${this.apiBase}/services`, { headers });
      case 'getService': return this.apiCall<PagerDutyService>(`${this.apiBase}/services/${params.serviceId}`, { headers });
      case 'createService': return this.apiCall<PagerDutyService>(`${this.apiBase}/services`, { method: 'POST', headers, body: JSON.stringify(params.service) });
      case 'getUsers': return this.apiCall<{ users: PagerDutyUser[] }>(`${this.apiBase}/users`, { headers });
      case 'getUser': return this.apiCall<PagerDutyUser>(`${this.apiBase}/users/${params.userId}`, { headers });
      case 'getSchedules': return this.apiCall<{ schedules: PagerDutySchedule[] }>(`${this.apiBase}/schedules`, { headers });
      case 'getSchedule': return this.apiCall<PagerDutySchedule>(`${this.apiBase}/schedules/${params.scheduleId}`, { headers });
      case 'getEscalationPolicies': return this.apiCall(`${this.apiBase}/escalation_policies`, { headers });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'incidents': return this.executeAction('getIncidents', options || {});
      case 'services': return this.executeAction('getServices', options || {});
      case 'users': return this.executeAction('getUsers', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createPagerDutyIntegration(): PagerDutyIntegration { return new PagerDutyIntegration(); }