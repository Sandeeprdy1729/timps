import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface NewRelicApplication {
  id: number;
  name: string;
  language: string;
  health_status: string;
  reporting: boolean;
  last_-reported_at: string;
  application_summary: {
    response_time: number;
    throughput: number;
    error_rate: number;
    apdex_score: number;
  };
}

export interface NewRelicMetric {
  name: string;
  values: string[];
  metric_timeslice_values?: Array<{ name: string; values: unknown }>;
}

export interface NewRelicDeployment {
  id: number;
  revision: string;
  changelog: string;
  description: string;
  user: string;
  timestamp: string;
  links: { application: number };
}

export interface NewRelicAlertPolicy {
  id: number;
  name: string;
  conditions: NewRelicAlertCondition[];
  created_at: string;
  updated_at: string;
}

export interface NewRelicAlertCondition {
  id: number;
  name: string;
  type: string;
  enabled: boolean;
  metric: string;
  terms: Array<{ duration: string; operator: string; priority: string; threshold: number; time_function: string }>;
}

export interface NewRelicTransaction {
  name: string;
  calls: number;
  total_call_time: number;
  exclusive_total_call_time: number;
  requests_per_minute: number;
  average_response_time: number;
  transactions_per_minute: number;
}

export interface NewRelicError {
  id: number;
  error_class: string;
  error_message: string;
  seen_at: string;
  last_seen_at: string;
  count: number;
}

export interface NewRelicExternalService {
  hash_id: string;
  name: string;
  calls: number;
  total_exclusive_time: number;
  average_response_time: number;
}

export interface NewRelicComponent {
  id: number;
  name: string;
  component_id: number;
  health_status: string;
}

const MANIFEST: PluginManifest = {
  id: 'newrelic',
  name: 'New Relic',
  version: '1.0.0',
  description: 'New Relic APM integration for monitoring applications, metrics, deployments, and alerts',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['newrelic', 'apm', 'monitoring', 'performance'],
};

const SCOPES = [
  'getApplications',
  'getApplication',
  'getApplicationMetrics',
  'getApplicationHosts',
  'getDeployments',
  'createDeployment',
  'deleteDeployment',
  'getAlertPolicies',
  'createAlertPolicy',
  'updateAlertPolicy',
  'deleteAlertPolicy',
  'getAlertConditions',
  'createAlertCondition',
  'updateAlertCondition',
  'deleteAlertCondition',
  'getTransactions',
  'getTransaction',
  'getErrors',
  'getError',
  'getExternalServices',
  'getServiceMap',
  'getComponents',
  'getComponent',
  'queryMetrics',
  'createIncident',
  'getIncidents',
  'getNrql',
  'getLabels',
  'createLabel',
  'deleteLabel',
];

export default class NewRelicIntegration extends IntegrationBase {
  private apiBase = 'https://api.newrelic.com/v2';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['deployment', 'incident_created', 'alert_triggered', 'alert_resolved'],
      dataModels: ['application', 'metric', 'deployment', 'alert', 'transaction', 'error'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }
    this.setApiKey(config.apiKey);

    try {
      const response = await this.apiCall<{ applications: NewRelicApplication[] }>(
        `${this.apiBase}/applications.json`,
        { headers: { 'X-Api-Key': config.apiKey } }
      );
      return Array.isArray(response.applications);
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.apiCall(`${this.apiBase}/applications.json`, {
        headers: { 'X-Api-Key': this.apiKey },
      });
      return true;
    } catch {
      return false;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return { 'X-Api-Key': this.apiKey || '' };
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.apiKey) throw new Error('Not authenticated');

    const headers = this.getAuthHeaders();

    switch (action) {
      case 'getApplications':
        return this.apiCall<{ applications: NewRelicApplication[] }>(
          `${this.apiBase}/applications.json`,
          { headers }
        );

      case 'getApplication':
        return this.apiCall<{ application: NewRelicApplication }>(
          `${this.apiBase}/applications/${params.applicationId}.json`,
          { headers }
        );

      case 'getApplicationMetrics':
        return this.apiCall<{ metric_data: NewRelicMetric[] }>(
          `${this.apiBase}/applications/${params.applicationId}/metrics.json`,
          { headers }
        );

      case 'getApplicationHosts':
        return this.apiCall<{ application_hosts: unknown[] }>(
          `${this.apiBase}/applications/${params.applicationId}/hosts.json`,
          { headers }
        );

      case 'getDeployments':
        return this.apiCall<{ deployments: NewRelicDeployment[] }>(
          `${this.apiBase}/applications/${params.applicationId}/deployments.json`,
          { headers }
        );

      case 'createDeployment':
        return this.apiCall<{ deployment: NewRelicDeployment }>(
          `${this.apiBase}/applications/${params.applicationId}/deployments.json`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ deployment: params.deployment }),
          }
        );

      case 'getAlertPolicies':
        return this.apiCall<{ policies: NewRelicAlertPolicy[] }>(
          `${this.apiBase}/alerts_policies.json`,
          { headers }
        );

      case 'createAlertPolicy':
        return this.apiCall<{ policy: NewRelicAlertPolicy }>(
          `${this.apiBase}/alerts_policies.json`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ policy: params.policy }),
          }
        );

      case 'getAlertConditions':
        return this.apiCall<{ conditions: NewRelicAlertCondition[] }>(
          `${this.apiBase}/alerts_conditions.json`,
          { headers }
        );

      case 'createAlertCondition':
        return this.apiCall<{ condition: NewRelicAlertCondition }>(
          `${this.apiBase}/alerts_conditions.json`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ condition: params.condition }),
          }
        );

      case 'getTransactions':
        return this.apiCall<{ transactions: NewRelicTransaction[] }>(
          `${this.apiBase}/applications/${params.applicationId}/transactions.json`,
          { headers }
        );

      case 'getErrors':
        return this.apiCall<{ error_events: NewRelicError[] }>(
          `${this.apiBase}/applications/${params.applicationId}/errors.json`,
          { headers }
        );

      case 'getExternalServices':
        return this.apiCall<{ external_services: NewRelicExternalService[] }>(
          `${this.apiBase}/applications/${params.applicationId}/external_services.json`,
          { headers }
        );

      case 'getServiceMap':
        return this.apiCall<{ service_map: unknown }>(
          `${this.apiBase}/applications/${params.applicationId}/service_map.json`,
          { headers }
        );

      case 'getComponents':
        return this.apiCall<{ components: NewRelicComponent[] }>(
          `${this.apiBase}/components.json`,
          { headers }
        );

      case 'queryMetrics':
        return this.apiCall<{ results: unknown }>(
          `${this.apiBase}/nrql.json`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: params.query }),
          }
        );

      case 'getLabels':
        return this.apiCall<{ labels: unknown }>(`${this.apiBase}/labels.json`, {
          headers,
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'applications':
        return this.executeAction('getApplications', options || {});
      case 'deployments':
        return this.executeAction('getDeployments', { applicationId: options?.applicationId });
      case 'alert-policies':
        return this.executeAction('getAlertPolicies', options || {});
      case 'transactions':
        return this.executeAction('getTransactions', { applicationId: options?.applicationId });
      case 'errors':
        return this.executeAction('getErrors', { applicationId: options?.applicationId });
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.apiKey = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createNewRelicIntegration(): NewRelicIntegration {
  return new NewRelicIntegration();
}