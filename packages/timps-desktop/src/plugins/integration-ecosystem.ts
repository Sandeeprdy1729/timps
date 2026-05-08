import { Plugin, PluginManifest, PluginCapabilities } from './types';

export interface ActivityEvent {
  id: string;
  integration: string;
  type: 'trigger' | 'action' | 'sync' | 'error';
  eventType: string;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityFilter {
  integration?: string;
  type?: 'trigger' | 'action' | 'sync' | 'error';
  eventType?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

export interface ActivityGroup {
  date: string;
  events: ActivityEvent[];
}

export class ActivityFeedPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/activity-feed',
    name: 'Activity Feed',
    version: '1.0.0',
    description: 'Unified activity feed aggregating events from all integrations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['activity', 'feed', 'events', 'timeline'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'log-event', name: 'Log Event', description: 'Log an activity event' },
      { id: 'get-events', name: 'Get Events', description: 'Get activity events' },
      { id: 'get-grouped-events', name: 'Get Grouped Events', description: 'Get events grouped by date' },
      { id: 'clear-events', name: 'Clear Events', description: 'Clear activity events' },
      { id: 'export-events', name: 'Export Events', description: 'Export events to JSON' },
    ],
  };

  private events: Map<string, ActivityEvent> = new Map();
  private listeners: ((event: ActivityEvent) => void)[] = [];
  private maxEvents: number = 10000;

  logEvent(event: Omit<ActivityEvent, 'id' | 'timestamp'>): ActivityEvent {
    const fullEvent: ActivityEvent = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.events.set(fullEvent.id, fullEvent);

    if (this.events.size > this.maxEvents) {
      const oldest = this.events.keys().next().value;
      if (oldest) this.events.delete(oldest);
    }

    for (const listener of this.listeners) {
      try {
        listener(fullEvent);
      } catch (e) {
        console.error('Activity listener error:', e);
      }
    }

    return fullEvent;
  }

  getEvents(filter: ActivityFilter = {}): ActivityEvent[] {
    let results = Array.from(this.events.values());

    if (filter.integration) {
      results = results.filter(e => e.integration === filter.integration);
    }
    if (filter.type) {
      results = results.filter(e => e.type === filter.type);
    }
    if (filter.eventType) {
      results = results.filter(e => e.eventType === filter.eventType);
    }
    if (filter.startDate) {
      results = results.filter(e => e.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      results = results.filter(e => e.timestamp <= filter.endDate!);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    if (filter.offset) {
      results = results.slice(filter.offset);
    }
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  getGroupedEvents(filter: ActivityFilter = {}): ActivityGroup[] {
    const events = this.getEvents(filter);
    const groups: Map<string, ActivityEvent[]> = new Map();

    for (const event of events) {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      const group = groups.get(date) || [];
      group.push(event);
      groups.set(date, group);
    }

    return Array.from(groups.entries())
      .map(([date, events]) => ({ date, events }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  clearEvents(filter?: ActivityFilter): number {
    const toDelete = filter
      ? this.getEvents(filter).map(e => e.id)
      : Array.from(this.events.keys());

    for (const id of toDelete) {
      this.events.delete(id);
    }

    return toDelete.length;
  }

  exportEvents(filter: ActivityFilter = {}): string {
    return JSON.stringify(this.getEvents(filter), null, 2);
  }

  subscribe(listener: (event: ActivityEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  getStats(): { total: number; byType: Record<string, number>; byIntegration: Record<string, number> } {
    const events = Array.from(this.events.values());
    const byType: Record<string, number> = {};
    const byIntegration: Record<string, number> = {};

    for (const event of events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      byIntegration[event.integration] = (byIntegration[event.integration] || 0) + 1;
    }

    return { total: events.length, byType, byIntegration };
  }

  getIntegrations(): string[] {
    const integrations = new Set<string>();
    for (const event of Array.from(this.events.values())) {
      integrations.add(event.integration);
    }
    return Array.from(integrations).sort();
  }

  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export class IntegrationRegistryPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/integration-registry',
    name: 'Integration Registry',
    version: '1.0.0',
    description: 'Registry and loader for all integration plugins',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['integration', 'registry', 'loader', 'plugin'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'register', name: 'Register', description: 'Register an integration' },
      { id: 'unregister', name: 'Unregister', description: 'Unregister an integration' },
      { id: 'list', name: 'List', description: 'List all integrations' },
      { id: 'get', name: 'Get', description: 'Get integration by ID' },
      { id: 'enable', name: 'Enable', description: 'Enable an integration' },
      { id: 'disable', name: 'Disable', description: 'Disable an integration' },
    ],
  };

  private integrations: Map<string, { plugin: Plugin; enabled: boolean; config?: Record<string, unknown> }> = new Map();

  register(plugin: Plugin, config?: Record<string, unknown>): void {
    this.integrations.set(plugin.manifest.id, { plugin, enabled: true, config });
  }

  unregister(id: string): boolean {
    return this.integrations.delete(id);
  }

  list(): { id: string; name: string; version: string; enabled: boolean }[] {
    return Array.from(this.integrations.entries()).map(([id, { plugin, enabled }]) => ({
      id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      enabled,
    }));
  }

  get(id: string): Plugin | null {
    const entry = this.integrations.get(id);
    return entry?.plugin || null;
  }

  isEnabled(id: string): boolean {
    return this.integrations.get(id)?.enabled || false;
  }

  enable(id: string): boolean {
    const entry = this.integrations.get(id);
    if (!entry) return false;
    entry.enabled = true;
    return true;
  }

  disable(id: string): boolean {
    const entry = this.integrations.get(id);
    if (!entry) return false;
    entry.enabled = false;
    return true;
  }

  getEnabled(): Plugin[] {
    return Array.from(this.integrations.values())
      .filter(e => e.enabled)
      .map(e => e.plugin);
  }

  getConfig(id: string): Record<string, unknown> | undefined {
    return this.integrations.get(id)?.config;
  }

  updateConfig(id: string, config: Record<string, unknown>): boolean {
    const entry = this.integrations.get(id);
    if (!entry) return false;
    entry.config = { ...entry.config, ...config };
    return true;
  }

  search(query: string): { id: string; name: string; version: string; enabled: boolean; keywords: string[] }[] {
    const lower = query.toLowerCase();
    return this.list().filter(p =>
      p.name.toLowerCase().includes(lower) ||
      p.id.toLowerCase().includes(lower) ||
      (this.get(p.id)?.manifest.keywords?.some(k => k.toLowerCase().includes(lower)) ?? false))
    .map(p => ({ ...p, keywords: this.get(p.id)?.manifest.keywords ?? [] }));
  }
}

export class WebhookPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/webhook',
    name: 'Webhook',
    version: '1.0.0',
    description: 'Webhook receiver and dispatcher for integration events',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['webhook', 'events', 'callback', 'http'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'register-webhook', name: 'Register Webhook', description: 'Register a webhook endpoint' },
      { id: 'unregister-webhook', name: 'Unregister Webhook', description: 'Unregister a webhook' },
      { id: 'trigger-webhook', name: 'Trigger Webhook', description: 'Trigger a webhook manually' },
      { id: 'list-webhooks', name: 'List Webhooks', description: 'List registered webhooks' },
    ],
  };

  private webhooks: Map<string, { url: string; events: string[]; secret?: string; enabled: boolean }> = new Map();
  private handlers: Map<string, (data: Record<string, unknown>) => Promise<void>> = new Map();

  registerWebhook(config: { id: string; url: string; events: string[]; secret?: string }): void {
    this.webhooks.set(config.id, {
      url: config.url,
      events: config.events,
      secret: config.secret,
      enabled: true,
    });
  }

  unregisterWebhook(id: string): boolean {
    return this.webhooks.delete(id);
  }

  async triggerWebhook(id: string, data: Record<string, unknown>): Promise<boolean> {
    const webhook = this.webhooks.get(id);
    if (!webhook || !webhook.enabled) return false;

    try {
      const body = JSON.stringify({ timestamp: Date.now(), data });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (webhook.secret) {
        const signature = await this.signBody(body, webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
      });

      return response.ok;
    } catch (e) {
      console.error(`Webhook ${id} failed:`, e);
      return false;
    }
  }

  onEvent(eventType: string, handler: (data: Record<string, unknown>) => Promise<void>): void {
    this.handlers.set(eventType, handler);
  }

  async handleEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
    const handler = this.handlers.get(eventType);
    if (handler) {
      await handler(data);
    }

    for (const [id, webhook] of Array.from(this.webhooks.entries())) {
      if (webhook.events.includes(eventType) && webhook.enabled) {
        await this.triggerWebhook(id, { eventType, ...data });
      }
    }
  }

  listWebhooks(): { id: string; url: string; events: string[]; enabled: boolean }[] {
    return Array.from(this.webhooks.entries()).map(([id, w]) => ({
      id,
      url: w.url,
      events: w.events,
      enabled: w.enabled,
    }));
  }

  enableWebhook(id: string): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) return false;
    webhook.enabled = true;
    return true;
  }

  disableWebhook(id: string): boolean {
    const webhook = this.webhooks.get(id);
    if (!webhook) return false;
    webhook.enabled = false;
    return true;
  }

  private async signBody(body: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(body + secret);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export class SyncEnginePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/sync-engine',
    name: 'Sync Engine',
    version: '1.0.0',
    description: 'Bidirectional sync engine for integration data',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['sync', 'engine', 'bidirectional', 'data'],
  };

  public capabilities: PluginCapabilities = {
    actions: [
      { id: 'create-sync', name: 'Create Sync', description: 'Create a sync job' },
      { id: 'run-sync', name: 'Run Sync', description: 'Run a sync job' },
      { id: 'pause-sync', name: 'Pause Sync', description: 'Pause a sync job' },
      { id: 'list-syncs', name: 'List Syncs', description: 'List sync jobs' },
      { id: 'get-sync-status', name: 'Get Sync Status', description: 'Get sync job status' },
    ],
  };

  private syncs: Map<string, SyncJob> = new Map();

  createSyncJob(config: SyncJobConfig): void {
    const job: SyncJob = {
      id: config.id,
      name: config.name,
      source: config.source,
      target: config.target,
      direction: config.direction || 'bidirectional',
      schedule: config.schedule,
      mapping: config.mapping || [],
      filters: config.filters || [],
      status: 'idle',
      lastSync: null,
      pendingChanges: [],
      conflicts: [],
    };

    this.syncs.set(job.id, job);
  }

  async runSyncJob(id: string): Promise<SyncResult> {
    const job = this.syncs.get(id);
    if (!job) return { success: false, error: 'Sync job not found' };

    job.status = 'syncing';

    try {
      const sourceData = await this.fetchSource(job);
      const targetData = await this.fetchTarget(job);

      const changes = await this.calculateChanges(job, sourceData, targetData);

      for (const change of changes) {
        if (change.type === 'conflict') {
          job.conflicts.push(change);
        } else {
          await this.applyChange(job, change);
        }
      }

      job.lastSync = Date.now();
      job.status = 'idle';
      job.pendingChanges = [];

      return { success: true, changesCount: changes.length };
    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: job.error };
    }
  }

  pauseSyncJob(id: string): boolean {
    const job = this.syncs.get(id);
    if (!job) return false;
    job.status = 'paused';
    return true;
  }

  listSyncJobs(): { id: string; name: string; status: string; lastSync: number | null }[] {
    return Array.from(this.syncs.entries()).map(([id, job]) => ({
      id,
      name: job.name,
      status: job.status,
      lastSync: job.lastSync,
    }));
  }

  getSyncJobStatus(id: string): SyncJob | null {
    return this.syncs.get(id) || null;
  }

  resolveConflict(syncId: string, conflictId: string, resolution: 'source' | 'target' | 'merge'): boolean {
    const job = this.syncs.get(syncId);
    if (!job) return false;

    const conflictIndex = job.conflicts.findIndex(c => c.id === conflictId);
    if (conflictIndex < 0) return false;

    const conflict = job.conflicts[conflictIndex];
    job.conflicts.splice(conflictIndex, 1);

    if (resolution === 'merge') {
      job.pendingChanges.push({ ...conflict, type: 'update' });
    } else {
      const data = resolution === 'source' ? conflict.sourceData : conflict.targetData;
      job.pendingChanges.push({
        ...conflict,
        type: 'update',
        data,
      });
    }

    return true;
  }

  private async fetchSource(job: SyncJob): Promise<SyncItem[]> {
    return [];
  }

  private async fetchTarget(job: SyncJob): Promise<SyncItem[]> {
    return [];
  }

  private async calculateChanges(job: SyncJob, source: SyncItem[], target: SyncItem[]): Promise<SyncChange[]> {
    const changes: SyncChange[] = [];
    const sourceMap = new Map(source.map(s => [s.id, s]));
    const targetMap = new Map(target.map(t => [t.id, t]));

    for (const item of source) {
      const targetItem = targetMap.get(item.id);
      if (!targetItem) {
        changes.push({ id: item.id, type: 'create', source: 'source', data: item.data });
      } else if (item.modifiedAt > targetItem.modifiedAt) {
        changes.push({ id: item.id, type: 'update', source: 'source', data: item.data });
      }
    }

    for (const item of target) {
      const sourceItem = sourceMap.get(item.id);
      if (!sourceItem) {
        changes.push({ id: item.id, type: 'create', source: 'target', data: item.data });
      }
    }

    return changes;
  }

  private async applyChange(job: SyncJob, change: SyncChange): Promise<void> {
    job.pendingChanges.push({
      id: change.id,
      source: change.source,
      type: change.type === 'create' ? 'create' : 'update',
      data: change.data,
    });
  }
}

interface SyncJobConfig {
  id: string;
  name: string;
  source: SyncSource;
  target: SyncTarget;
  direction?: 'source-to-target' | 'target-to-source' | 'bidirectional';
  schedule?: string;
  mapping?: FieldMapping[];
  filters?: SyncFilter[];
}

interface SyncJob {
  id: string;
  name: string;
  source: SyncSource;
  target: SyncTarget;
  direction: 'source-to-target' | 'target-to-source' | 'bidirectional';
  schedule?: string;
  mapping: FieldMapping[];
  filters: SyncFilter[];
  status: 'idle' | 'syncing' | 'paused' | 'error';
  lastSync: number | null;
  pendingChanges: SyncChange[];
  conflicts: SyncChange[];
  error?: string;
}

interface SyncSource {
  type: string;
  query?: Record<string, unknown>;
}

interface SyncTarget {
  type: string;
  mapping?: FieldMapping[];
}

interface SyncItem {
  id: string;
  data: Record<string, unknown>;
  modifiedAt: number;
}

interface SyncChange {
  id: string;
  type: 'create' | 'update' | 'delete' | 'conflict';
  source: 'source' | 'target';
  data: Record<string, unknown>;
  sourceData?: Record<string, unknown>;
  targetData?: Record<string, unknown>;
}

interface FieldMapping {
  source: string;
  target: string;
  transform?: (value: unknown) => unknown;
}

interface SyncFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains';
  value: unknown;
}

interface SyncResult {
  success: boolean;
  error?: string;
  changesCount?: number;
}

export const ACTIVITY_FEED_PLUGINS: Plugin[] = [
  new ActivityFeedPlugin(),
  new IntegrationRegistryPlugin(),
  new WebhookPlugin(),
  new SyncEnginePlugin(),
];