import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface DatadogMetric {
  metric: string;
  type: string;
  interval?: number;
  points: Array<{ timestamp: number; value: number }>;
  resources?: Array<{ name: string; type: string }>;
  tags?: string[];
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
  state?: DatadogMonitorState;
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
  grouping?: string;
  evaluation_window?: { day_start?: string; hour_start?: number; day_end?: string; hour_end?: number };
  new_group_delay?: number;
  validate_uptime?: boolean;
  min_location?: number;
}

export interface DatadogMonitorState {
  monitor_id: number;
  monitor_name: string;
  status: DatadogMonitorStatus;
  monitor_url: string;
  touched_at: number;
  triggered_at?: number;
  resolved_at?: number;
}

export type DatadogMonitorStatus = 'OK' | 'ALERT' | 'WARN' | 'UNKNOWN' | 'NO DATA';

export interface DatadogUser {
  handle: string;
  name: string;
  id: number;
  email: string;
  icon_url?: string;
  disabled?: boolean;
  role?: string;
  verified?: boolean;
}

export interface DatadogHost {
  host_name: string;
  lastReportedTime?: number;
  tags?: string[];
  meta?: Record<string, unknown>;
  metrics?: Record<string, number>;
  source?: string;
  cloud_provider?: string;
  aws_instance_id?: string;
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
  device_name?: string;
  host?: string;
  aggregation_key?: string;
  related_event_ids?: number[];
}

export interface DatadogComment {
  id: number;
  message: string;
  user: DatadogUser;
  created_at?: string;
}

export interface DatadogLog {
  id: string;
  message: string;
  timestamp: number;
  status: DatadogLogStatus;
  service?: string;
  host?: string;
  source?: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
  _index?: string;
  _score?: number;
}

export type DatadogLogStatus = 'emergency' | 'alert' | 'critical' | 'error' | 'warning' | 'notice' | 'info' | 'debug';

export interface DatadogService {
  name: string;
  version?: string;
  health?: string;
  serviceType?: string;
  contacts?: Array<{ type: string; name: string; contact: string }>;
  language?: string;
  run_in_first_container?: boolean;
}

export interface DatadogTag {
  name: string;
  tags?: Array<{ key: string; values: string[] }>;
  count?: number;
}

export interface DatadogIncident {
  id: string;
  title: string;
  status: 'triggered' | 'active' | 'stable' | 'resolved';
  severity: 'sev1' | 'sev2' | 'sev3' | 'sev4' | 'sev5';
  date: number;
  date_ended?: number;
  date_declared_started?: number;
  commander?: DatadogUser;
  summary?: string;
  fields?: Array<{ name: string; value: string }>;
  attachment_ids?: string[];
  children_ids?: string[];
  root_cause?: string;
}

export interface DatadogSLO {
  id: string;
  name: string;
  description?: string;
  type: string;
  thresholds: Array<{ target: number; timeframe: string; warning?: number }>;
  query?: string;
  monitor_ids?: number[];
  service?: string;
}

export interface DatadogAPIService {
  id: string;
  name: string;
  description?: string;
  language: string;
  tier?: string;
  team?: string;
}

export interface DatadogTrace {
  trace_id: string;
  start: number;
  duration: number;
  services: Array<{ name: string; type: string }>;
  spans: DatadogSpan[];
  root_span?: DatadogSpan;
}

export interface DatadogSpan {
  span_id: string;
  trace_id: string;
  parent_id?: string;
  name: string;
  resource: string;
  service: string;
  type: string;
  start: number;
  duration: number;
  error?: number;
  meta?: Record<string, string>;
  metrics?: Record<string, number>;
  tags?: Record<string, string>;
}

export interface DatadogMetricQuery {
  query: string;
  from: number;
  to: number;
  index?: string;
}

export interface DatadogLogQuery {
  query: string;
  from: number;
  to: number;
  limit?: number;
  sort?: 'asc' | 'desc';
  archive?: string;
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
  created_at?: string;
  modified_at?: string;
}

export interface DatadogWidget {
  definition: Record<string, unknown>;
  id: number;
  layout?: { x: number; y: number; width: number; height: number };
  title?: string;
  type?: string;
}

export interface DatadogTemplateVariable {
  name: string;
  tag?: string;
  prefix?: string;
  defaults?: string[];
}

export interface DatadogSettings {
  site?: string;
  apiVersion?: 'v1' | 'v2';
  timeout?: number;
  maxRetries?: number;
  compressPayload?: boolean;
  enableRetryOn5xx?: boolean;
  customHeaders?: Record<string, string>;
}

export interface DatadogActivityCard {
  id: string;
  type: 'metric' | 'monitor' | 'incident' | 'log' | 'event';
  title: string;
  description: string;
  timestamp: number;
  severity?: string;
  status?: string;
  source?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  link?: string;
}

interface DatadogConfig {
  apiKey: string;
  appKey: string;
  site?: string;
  settings?: DatadogSettings;
}

export class DatadogPlugin extends IntegrationBase {
  private config: DatadogConfig;
  private apiBase: string;
  private site: string;

  constructor() {
    super('datadog', 'Datadog', 'DevOps monitoring integration for metrics, logs, APM, and alerts');
    this.config = { apiKey: '', appKey: '' };
    this.site = 'datadoghq.com';
    this.apiBase = `https://api.${this.site}`;
  }

  setConfig(apiKey: string, appKey: string, site?: string): void {
    this.config = { apiKey, appKey, site };
    if (site) {
      this.site = site;
      this.apiBase = `https://api.${site}`;
    }
  }

  setSettings(settings: DatadogSettings): void {
    this.config.settings = settings;
    if (settings.site) {
      this.site = settings.site;
      this.apiBase = `https://api.${settings.site}`;
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'DD-API-KEY': this.config.apiKey,
      'DD-APPLICATION-KEY': this.config.appKey,
      'Content-Type': 'application/json',
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Datadog API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.apiKey || !config.clientSecret) {
      throw new Error('API key and app key are required');
    }

    this.setConfig(config.apiKey, config.clientSecret);
    return this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    if (!this.config.apiKey || !this.config.appKey) return false;

    try {
      const result = await this.makeRequest<{ errors?: string[] }>('/v1/validate');
      return !result.errors;
    } catch {
      return false;
    }
  }

  async getMetrics(query?: string, from?: number, to?: number): Promise<{ metrics: DatadogMetric[] }> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (from) params.append('from', from.toString());
    if (to) params.append('to', to.toString());

    return this.makeRequest<{ metrics: DatadogMetric[] }>(`/v1/query?${params}`);
  }

  async getMonitors(options?: { group?: string; tags?: string; monitor_tags?: string }): Promise<{ monitors: DatadogMonitor[] }> {
    const params = new URLSearchParams();
    if (options?.group) params.append('group', options.group);
    if (options?.tags) params.append('tags', options.tags);
    if (options?.monitor_tags) params.append('monitor_tags', options.monitor_tags);

    return this.makeRequest<{ monitors: DatadogMonitor[] }>(`/v1/monitor?${params}`);
  }

  async getMonitor(monitorId: number): Promise<DatadogMonitor> {
    return this.makeRequest<DatadogMonitor>(`/v1/monitor/${monitorId}`);
  }

  async getMonitorStates(): Promise<{ monitors: DatadogMonitorState[] }> {
    return this.makeRequest<{ monitors: DatadogMonitorState[] }>('/v1/monitor/status');
  }

  async createMonitor(monitor: Partial<DatadogMonitor>): Promise<DatadogMonitor> {
    return this.makeRequest<DatadogMonitor>('/v1/monitor', {
      method: 'POST',
      body: JSON.stringify(monitor),
    });
  }

  async updateMonitor(monitorId: number, monitor: Partial<DatadogMonitor>): Promise<DatadogMonitor> {
    return this.makeRequest<DatadogMonitor>(`/v1/monitor/${monitorId}`, {
      method: 'PUT',
      body: JSON.stringify(monitor),
    });
  }

  async deleteMonitor(monitorId: number): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/v1/monitor/${monitorId}`, {
      method: 'DELETE',
    });
  }

  async muteMonitor(monitorId: number, message?: string): Promise<DatadogMonitor> {
    return this.makeRequest<DatadogMonitor>(`/v1/monitor/${monitorId}/mute`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async unmuteMonitor(monitorId: number): Promise<DatadogMonitor> {
    return this.makeRequest<DatadogMonitor>(`/v1/monitor/${monitorId}/unmute`, {
      method: 'POST',
    });
  }

  async getHosts(options?: { filter?: string }): Promise<{ totalCount: number; hosts: DatadogHost[] }> {
    const params = new URLSearchParams();
    if (options?.filter) params.append('filter', options.filter);

    return this.makeRequest<{ totalCount: number; hosts: DatadogHost[] }>(`/v1/hosts?${params}`);
  }

  async getHost(hostName: string): Promise<DatadogHost> {
    return this.makeRequest<DatadogHost>(`/v1/hosts/${hostName}`);
  }

  async getEvents(options?: {
    start?: number;
    end?: number;
    priority?: string;
    tags?: string;
    sources?: string;
    unaggregated?: boolean;
  }): Promise<{ events: DatadogEvent[] }> {
    const params = new URLSearchParams();
    if (options?.start) params.append('start', options.start.toString());
    if (options?.end) params.append('end', options.end.toString());
    if (options?.priority) params.append('priority', options.priority);
    if (options?.tags) params.append('tags', options.tags);
    if (options?.sources) params.append('sources', options.sources);
    if (options?.unaggregated) params.append('unaggregated', 'true');

    return this.makeRequest<{ events: DatadogEvent[] }>(`/v1/events?${params}`);
  }

  async createEvent(event: { title: string; text: string; priority?: string; tags?: string[]; alert_type?: string }): Promise<DatadogEvent> {
    return this.makeRequest<DatadogEvent>('/v1/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async getEvent(eventId: number): Promise<DatadogEvent> {
    return this.makeRequest<DatadogEvent>(`/v1/events/${eventId}`);
  }

  async queryLogs(query: DatadogLogQuery): Promise<{ logs: DatadogLog[]; meta: { page: { before_cursor?: string; after_cursor?: string } } }> {
    return this.makeRequest<{ logs: DatadogLog[]; meta: { page: { before_cursor?: string; after_cursor?: string } } }>('/v2/logs/events/search', {
      method: 'POST',
      body: JSON.stringify({
        query: query.query,
        from: query.from,
        to: query.to,
        limit: query.limit || 100,
        sort: query.sort || 'desc',
      }),
    });
  }

  async aggregateLogs(query: string, from: number, to: number, aggregation: string): Promise<{ data: Array<{ key: string; value: number }> }> {
    return this.makeRequest<{ data: Array<{ key: string; value: number }> }>('/v2/logs/aggregates', {
      method: 'POST',
      body: JSON.stringify({
        query,
        from,
        to,
        aggregator: aggregation,
      }),
    });
  }

  async getServices(): Promise<{ services: DatadogService[] }> {
    return this.makeRequest<{ services: DatadogService[] }>('/v1/service');
  }

  async getAPIServices(): Promise<{ services: DatadogAPIService[] }> {
    return this.makeRequest<{ services: DatadogAPIService[] }>('/v2/apm/services');
  }

  async getAPMHosts(from: number): Promise<{ hosts: string[] }> {
    return this.makeRequest<{ hosts: string[] }>(`/v1/apm/hosts?from=${from}`);
  }

  async getTraces(service?: string, from?: number, to?: number): Promise<{ traces: DatadogTrace[] }> {
    const params = new URLSearchParams();
    if (service) params.append('service', service);
    if (from) params.append('start', from.toString());
    if (to) params.append('end', to.toString());

    return this.makeRequest<{ traces: DatadogTrace[] }>(`/v0.4/traces?${params}`);
  }

  async getIncidents(options?: { status?: string; severity?: string }): Promise<{ incidents: DatadogIncident[] }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.severity) params.append('severity', options.severity);

    return this.makeRequest<{ incidents: DatadogIncident[] }>(`/v2/incidents?${params}`);
  }

  async getSLOs(service?: string): Promise<{ slo: DatadogSLO[] }> {
    const params = new URLSearchParams();
    if (service) params.append('service', service);

    return this.makeRequest<{ slo: DatadogSLO[] }>(`/v2/slo?${params}`);
  }

  async getDashboards(): Promise<{ dashboards: DatadogDashboard[] }> {
    return this.makeRequest<{ dashboards: DatadogDashboard[] }>('/v1/dashboard');
  }

  async getDashboard(dashboardId: string): Promise<DatadogDashboard> {
    return this.makeRequest<DatadogDashboard>(`/v1/dashboard/${dashboardId}`);
  }

  async getTags(hostName?: string): Promise<{ tags: DatadogTag[] }> {
    const endpoint = hostName ? `/v1/tags/hosts/${hostName}` : '/v1/tags';
    return this.makeRequest<{ tags: DatadogTag[] }>(endpoint);
  }

  async postMetric(series: DatadogMetric[]): Promise<{ status: string }> {
    return this.makeRequest<{ status: string }>('/v1/series', {
      method: 'POST',
      body: JSON.stringify({ series }),
    });
  }

  async getGraphSnapshot(query: string, from: number, to: number): Promise<{ snapshot_data: string }> {
    const params = new URLSearchParams();
    params.append('metric_query', query);
    params.append('start', from.toString());
    params.append('end', to.toString());

    return this.makeRequest<{ snapshot_data: string }>(`/v1/snapshot?${params}`);
  }

  async getActivityCards(from: number, to: number, types?: string[]): Promise<{ cards: DatadogActivityCard[] }> {
    const events = await this.getEvents({ start: from, end: to });

    const cards: DatadogActivityCard[] = events.events.map(event => ({
      id: `event-${event.id}`,
      type: 'event',
      title: event.title,
      description: event.text,
      timestamp: event.date_happened * 1000,
      severity: event.alert_type,
      status: event.priority,
      source: event.source_type_name,
      tags: event.tags,
      link: `https://app.${this.site}/event/${event.id}`,
    }));

    if (!types || types.includes('monitor')) {
      const monitors = await this.getMonitors();
      const states = await this.getMonitorStates();
      for (const state of states.monitors) {
        if (state.triggered_at && state.triggered_at * 1000 >= from && state.triggered_at * 1000 <= to) {
          cards.push({
            id: `monitor-${state.monitor_id}`,
            type: 'monitor',
            title: state.monitor_name,
            description: `Status: ${state.status}`,
            timestamp: state.triggered_at * 1000,
            status: state.status,
            link: state.monitor_url,
          });
        }
      }
    }

    return { cards: cards.sort((a, b) => b.timestamp - a.timestamp) };
  }

  async cleanup(): Promise<void> {
    this.config = { apiKey: '', appKey: '', site: this.site };
  }

  getManifest(): PluginManifest {
    return {
      id: 'datadog',
      name: 'Datadog',
      version: '2.0.0',
      description: 'DevOps monitoring integration for metrics, logs, APM, incidents, and alerts',
      author: 'TIMPS Team',
      main: 'datadog-new.js',
      keywords: ['datadog', 'monitoring', 'metrics', 'logs', 'apm', 'devops', 'alerting'],
      actions: [
        { id: 'get_metrics', name: 'Get Metrics', description: 'Query metrics from Datadog' },
        { id: 'get_monitors', name: 'Get Monitors', description: 'List all monitors' },
        { id: 'get_monitor', name: 'Get Monitor', description: 'Get specific monitor details' },
        { id: 'create_monitor', name: 'Create Monitor', description: 'Create a new monitor' },
        { id: 'update_monitor', name: 'Update Monitor', description: 'Update an existing monitor' },
        { id: 'delete_monitor', name: 'Delete Monitor', description: 'Delete a monitor' },
        { id: 'mute_monitor', name: 'Mute Monitor', description: 'Mute a monitor' },
        { id: 'unmute_monitor', name: 'Unmute Monitor', description: 'Unmute a monitor' },
        { id: 'get_hosts', name: 'Get Hosts', description: 'List all hosts' },
        { id: 'get_host', name: 'Get Host', description: 'Get host details' },
        { id: 'get_events', name: 'Get Events', description: 'List events' },
        { id: 'create_event', name: 'Create Event', description: 'Create a new event' },
        { id: 'query_logs', name: 'Query Logs', description: 'Search and filter logs' },
        { id: 'aggregate_logs', name: 'Aggregate Logs', description: 'Aggregate log data' },
        { id: 'get_services', name: 'Get Services', description: 'List all services' },
        { id: 'get_traces', name: 'Get Traces', description: 'Retrieve APM traces' },
        { id: 'get_incidents', name: 'Get Incidents', description: 'List incidents' },
        { id: 'get_slos', name: 'Get SLOs', description: 'List service level objectives' },
        { id: 'get_dashboards', name: 'Get Dashboards', description: 'List dashboards' },
        { id: 'get_tags', name: 'Get Tags', description: 'List all tags' },
        { id: 'post_metric', name: 'Post Metric', description: 'Submit a metric data point' },
        { id: 'get_graph_snapshot', name: 'Get Graph Snapshot', description: 'Generate a graph snapshot' },
        { id: 'get_activity_cards', name: 'Get Activity Cards', description: 'Get activity timeline' },
        { id: 'test_connection', name: 'Test Connection', description: 'Test Datadog connection' },
      ],
      triggers: [
        { id: 'monitor_triggered', name: 'Monitor Triggered', description: 'Triggered when a monitor goes into alert state' },
        { id: 'monitor_resolved', name: 'Monitor Resolved', description: 'Triggered when a monitor returns to OK state' },
        { id: 'monitor_warning', name: 'Monitor Warning', description: 'Triggered when a monitor enters warning state' },
        { id: 'incident_created', name: 'Incident Created', description: 'Triggered when a new incident is created' },
        { id: 'incident_updated', name: 'Incident Updated', description: 'Triggered when an incident is updated' },
        { id: 'incident_resolved', name: 'Incident Resolved', description: 'Triggered when an incident is resolved' },
        { id: 'event_created', name: 'Event Created', description: 'Triggered when a new event is created' },
        { id: 'log_error_threshold', name: 'Log Error Threshold', description: 'Triggered when log errors exceed threshold' },
        { id: 'slo_violation', name: 'SLO Violation', description: 'Triggered when an SLO is breached' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'apiKey', label: 'API Key', description: 'Your Datadog API key', required: true },
          { name: 'clientSecret', label: 'App Key', description: 'Your Datadog application key', required: true },
          { name: 'site', label: 'Site', description: 'Datadog site (e.g., datadoghq.com)', required: false },
        ],
      },
      settings: [
        { name: 'site', label: 'Datadog Site', type: 'string', default: 'datadoghq.com' },
        { name: 'apiVersion', label: 'API Version', type: 'select', options: ['v1', 'v2'], default: 'v2' },
        { name: 'timeout', label: 'Request Timeout', type: 'number', default: 30000 },
        { name: 'maxRetries', label: 'Max Retries', type: 'number', default: 3 },
      ],
      connectionTest: { endpoint: '/v1/validate', method: 'POST' },
    };
  }

  executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    switch (action) {
      case 'get_metrics':
        return this.getMetrics(params.query as string, params.from as number, params.to as number);
      case 'get_monitors':
        return this.getMonitors(params as any);
      case 'get_monitor':
        return this.getMonitor(params.monitorId as number);
      case 'create_monitor':
        return this.createMonitor(params.monitor as Partial<DatadogMonitor>);
      case 'update_monitor':
        return this.updateMonitor(params.monitorId as number, params.monitor as Partial<DatadogMonitor>);
      case 'delete_monitor':
        return this.deleteMonitor(params.monitorId as number);
      case 'mute_monitor':
        return this.muteMonitor(params.monitorId as number, params.message as string);
      case 'unmute_monitor':
        return this.unmuteMonitor(params.monitorId as number);
      case 'get_hosts':
        return this.getHosts(params as any);
      case 'get_host':
        return this.getHost(params.hostName as string);
      case 'get_events':
        return this.getEvents(params as any);
      case 'create_event':
        return this.createEvent(params as any);
      case 'query_logs':
        return this.queryLogs(params as DatadogLogQuery);
      case 'get_services':
        return this.getServices();
      case 'get_traces':
        return this.getTraces(params.service as string, params.from as number, params.to as number);
      case 'get_incidents':
        return this.getIncidents(params as any);
      case 'get_slos':
        return this.getSLOs(params.service as string);
      case 'get_dashboards':
        return this.getDashboards();
      case 'get_tags':
        return this.getTags(params.hostName as string);
      case 'post_metric':
        return this.postMetric(params.series as DatadogMetric[]);
      case 'get_graph_snapshot':
        return this.getGraphSnapshot(params.query as string, params.from as number, params.to as number);
      case 'get_activity_cards':
        return this.getActivityCards(params.from as number, params.to as number, params.types as string[]);
      case 'test_connection':
        return this.testConnection();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'metrics':
        return this.getMetrics(options?.query as string, options?.from as number, options?.to as number);
      case 'monitors':
        return this.getMonitors(options as any);
      case 'hosts':
        return this.getHosts(options as any);
      case 'events':
        return this.getEvents(options as any);
      case 'logs':
        return this.queryLogs(options as DatadogLogQuery);
      case 'services':
        return this.getServices();
      case 'incidents':
        return this.getIncidents(options as any);
      case 'slos':
        return this.getSLOs(options?.service as string);
      case 'dashboards':
        return this.getDashboards();
      case 'tags':
        return this.getTags(options?.hostName as string);
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
}

export const datadogPlugin = new DatadogPlugin();

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  keywords: string[];
  actions?: Array<{ id: string; name: string; description: string }>;
  triggers?: Array<{ id: string; name: string; description: string }>;
  auth?: {
    type: string;
    fields: Array<{ name: string; label: string; description: string; required?: boolean; type?: string; options?: string[]; default?: any }>;
  };
  settings?: Array<{ name: string; label: string; type: string; default?: any; options?: string[] }>;
  connectionTest?: { endpoint: string; method: string };
}