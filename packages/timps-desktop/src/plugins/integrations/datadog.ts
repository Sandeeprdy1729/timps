import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface DatadogMetric {
  metric: string;
  type: string;
  interval?: number;
  points: Array<{ timestamp: number; value: number }>;
  resources?: Array<{ name: string; type: string }>;
}

export interface DatadogMonitor {
  id: number;
  name: string;
  type: string;
  query: string;
  message: string;
  tags: string[];
  options: DatadogMonitorOptions;
  creator: DatadogUser;
  org_id: number;
  modified_at: string;
  created_at: string;
}

export interface DatadogMonitorOptions {
  id?: number;
  notify_audit?: boolean;
  notify_no_data?: boolean;
  no_data_timeframe?: number;
  renotify_interval?: number;
  escalation_message?: string;
  include_tags?: boolean;
  require_full_window?: boolean;
  timeout_h?: number;
  threshold_windows?: { recovery_window: string; trigger_window: string };
  thresholds?: Record<string, number>;
}

export interface DatadogUser {
  handle: string;
  name: string;
  id: number;
  email: string;
  icon_url?: string;
}

export interface DatadogScreenboard {
  id: number;
  title: string;
  description: string;
  widgets: DatadogWidget[];
  template_variables?: DatadogTemplateVariable[];
  read_only?: boolean;
  graph_title?: string;
}

export interface DatadogWidget {
  definition: Record<string, unknown>;
  id: number;
  layout?: { x: number; y: number; width: number; height: number };
}

export interface DatadogTemplateVariable {
  name: string;
  tag?: string;
  prefix?: string;
}

export interface DatadogHost {
  host_name: string;
  lastReportedTime?: number;
  tags?: string[];
  meta?: Record<string, unknown>;
}

export interface DatadogEvent {
  id: number;
  title: string;
  text: string;
  date_happened: number;
  priority: 'normal' | 'low';
  aggregator?: string;
  source_type_name?: string;
  alert_type: 'info' | 'success' | 'warning' | 'error';
  tags?: string[];
  comments?: DatadogComment[];
}

export interface DatadogComment {
  id: number;
  message: string;
  user: DatadogUser;
}

export interface DatadogService {
  name: string;
  version?: string;
  health?: string;
  serviceType?: string;
  contacts?: Array<{ type: string; name: string; contact: string }>;
}

export interface DatadogTag {
  name: string;
  tags?: Array<{ key: string; values: string[] }>;
}

export interface DatadogLog {
  id: string;
  message: string;
  timestamp: number;
  status: 'emergency' | 'alert' | 'critical' | 'error' | 'warning' | 'notice' | 'info' | 'debug';
  service?: string;
  host?: string;
  source?: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
}

export interface DatadogDashboard {
  id: string;
  title: string;
  description?: string;
  widgets: DatadogWidget[];
  layout_type: 'ordered' | 'free';
  is_read_only?: boolean;
  notify_list?: DatadogUser[];
  template_variables?: DatadogTemplateVariable[];
}

const MANIFEST: PluginManifest = {
  id: 'datadog',
  name: 'Datadog',
  version: '1.0.0',
  description: 'Datadog monitoring integration for metrics, logs, events, and alerts',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['datadog', 'monitoring', 'metrics', 'logs', 'apm'],
};

const SCOPES = [
  'postMetrics',
  'getMetrics',
  'queryMetrics',
  'getMonitor',
  'getMonitors',
  'createMonitor',
  'updateMonitor',
  'deleteMonitor',
  'muteMonitor',
  'unmuteMonitor',
  'getScreenboards',
  'getScreenboard',
  'createScreenboard',
  'updateScreenboard',
  'deleteScreenboard',
  'getDashboards',
  'getDashboard',
  'createDashboard',
  'updateDashboard',
  'deleteDashboard',
  'getHosts',
  'getHost',
  'getEvents',
  'postEvent',
  'getEvent',
  'getServices',
  'getService',
  'getTags',
  'postTags',
  'queryLogs',
  'searchLogs',
  'getUser',
  'getUserOrg',
  'getGraphSnapshot',
  'getEmbed',
  'createEmbed',
  'getAPMHosts',
  'getAPMServices',
];

export default class DatadogIntegration extends IntegrationBase {
  private apiBase = 'https://api.datadoghq.com/api';
  private appKey: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['monitor_triggered', 'monitor_resolved', 'event_created', 'deploy_created'],
      dataModels: ['metric', 'monitor', 'screenboard', 'dashboard', 'host', 'event', 'log', 'service', 'tag'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.apiKey || !config.clientSecret) {
      throw new Error('API key and app key (clientSecret) are required');
    }
    this.setApiKey(config.apiKey);
    this.appKey = config.clientSecret;

    try {
      const validate = await this.apiCall<{ errors?: string[] }>(
        `${this.apiBase}/v1/validate`,
        { headers: this.getAuthHeaders() }
      );
      return !validate.errors;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey || !this.appKey) return false;
    try {
      await this.apiCall(`${this.apiBase}/v1/validate`, {
        headers: this.getAuthHeaders(),
      });
      return true;
    } catch {
      return false;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'DD-API-KEY': this.apiKey || '',
      'DD-APPLICATION-KEY': this.appKey || '',
      'Content-Type': 'application/json',
    };
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.apiKey || !this.appKey) throw new Error('Not authenticated');

    const headers = this.getAuthHeaders();

    switch (action) {
      case 'postMetrics':
        return this.apiCall<{ status: string }>(`${this.apiBase}/v1/series`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ series: params.series as DatadogMetric[] }),
        });

      case 'queryMetrics':
        return this.apiCall<{ series: Array<{ metric: string; pointlist: Array<[number, number]> }> }>(
          `${this.apiBase}/v1/query`,
          {
            method: 'GET',
            headers,
          }
        );

      case 'getMonitors':
        return this.apiCall<{ monitors: DatadogMonitor[] }>(`${this.apiBase}/v1/monitor`, {
          headers,
        });

      case 'getMonitor':
        return this.apiCall<DatadogMonitor>(`${this.apiBase}/v1/monitor/${params.monitorId}`, {
          headers,
        });

      case 'createMonitor':
        return this.apiCall<DatadogMonitor>(`${this.apiBase}/v1/monitor`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.monitor),
        });

      case 'updateMonitor':
        return this.apiCall<DatadogMonitor>(
          `${this.apiBase}/v1/monitor/${params.monitorId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(params.monitor),
          }
        );

      case 'deleteMonitor':
        return this.apiCall<{ message: string }>(
          `${this.apiBase}/v1/monitor/${params.monitorId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'muteMonitor':
        return this.apiCall<DatadogMonitor>(
          `${this.apiBase}/v1/monitor/${params.monitorId}/mute`,
          {
            method: 'POST',
            headers,
          }
        );

      case 'unmuteMonitor':
        return this.apiCall<DatadogMonitor>(
          `${this.apiBase}/v1/monitor/${params.monitorId}/unmute`,
          {
            method: 'POST',
            headers,
          }
        );

      case 'getDashboards':
        return this.apiCall<{ dashboards: DatadogDashboard[] }>(
          `${this.apiBase}/v1/dashboard`,
          { headers }
        );

      case 'getDashboard':
        return this.apiCall<DatadogDashboard>(
          `${this.apiBase}/v1/dashboard/${params.dashboardId}`,
          { headers }
        );

      case 'createDashboard':
        return this.apiCall<DatadogDashboard>(`${this.apiBase}/v1/dashboard`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.dashboard),
        });

      case 'updateDashboard':
        return this.apiCall<DatadogDashboard>(
          `${this.apiBase}/v1/dashboard/${params.dashboardId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(params.dashboard),
          }
        );

      case 'deleteDashboard':
        return this.apiCall<{ message: string }>(
          `${this.apiBase}/v1/dashboard/${params.dashboardId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getScreenboards':
        return this.apiCall<{ screens: DatadogScreenboard[] }>(
          `${this.apiBase}/v1/screen`,
          { headers }
        );

      case 'getScreenboard':
        return this.apiCall<DatadogScreenboard>(
          `${this.apiBase}/v1/screen/${params.screenboardId}`,
          { headers }
        );

      case 'createScreenboard':
        return this.apiCall<DatadogScreenboard>(`${this.apiBase}/v1/screen`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.screenboard),
        });

      case 'getHosts':
        return this.apiCall<{ hosts: DatadogHost[] }>(`${this.apiBase}/v1/hosts`, {
          headers,
        });

      case 'getHost':
        return this.apiCall<DatadogHost>(
          `${this.apiBase}/v1/hosts/${params.hostName}`,
          { headers }
        );

      case 'getEvents':
        return this.apiCall<{ events: DatadogEvent[] }>(`${this.apiBase}/v1/events`, {
          headers,
        });

      case 'postEvent':
        return this.apiCall<DatadogEvent>(`${this.apiBase}/v1/events`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.event),
        });

      case 'getEvent':
        return this.apiCall<DatadogEvent>(`${this.apiBase}/v1/events/${params.eventId}`, {
          headers,
        });

      case 'getServices':
        return this.apiCall<{ services: DatadogService[] }>(`${this.apiBase}/v1/service`, {
          headers,
        });

      case 'getTags':
        return this.apiCall<{ tags: DatadogTag[] }>(`${this.apiBase}/v1/tags`, { headers });

      case 'postTags':
        return this.apiCall<{ message: string }>(`${this.apiBase}/v1/tags/${params.hostName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tags: params.tags }),
        });

      case 'queryLogs':
        return this.apiCall<{ logs: DatadogLog[] }>(`${this.apiBase}/v1/logs-archive/config`, {
          headers,
        });

      case 'searchLogs':
        return this.apiCall<{ logs: DatadogLog[] }>(`${this.apiBase}/v1/logs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: params.query }),
        });

      case 'getUser':
        return this.apiCall<DatadogUser>(`${this.apiBase}/v1/user`, { headers });

      case 'getGraphSnapshot':
        return this.apiCall<{ snapshot_data: string }>(
          `${this.apiBase}/v1/snapshot`,
          { headers }
        );

      case 'getAPMHosts':
        return this.apiCall<{ hosts: string[] }>(`${this.apiBase}/v1/apm/hosts`, {
          headers,
        });

      case 'getAPMServices':
        return this.apiCall<{ services: Array<{ name: string; language: string }> }>(
          `${this.apiBase}/v1/apm/services`,
          { headers }
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'metrics':
        return this.executeAction('getMetrics', options || {});
      case 'monitors':
        return this.executeAction('getMonitors', options || {});
      case 'dashboards':
        return this.executeAction('getDashboards', options || {});
      case 'hosts':
        return this.executeAction('getHosts', options || {});
      case 'events':
        return this.executeAction('getEvents', options || {});
      case 'services':
        return this.executeAction('getServices', options || {});
      case 'tags':
        return this.executeAction('getTags', options || {});
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.apiKey = null;
    this.appKey = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createDatadogIntegration(): DatadogIntegration {
  return new DatadogIntegration();
}