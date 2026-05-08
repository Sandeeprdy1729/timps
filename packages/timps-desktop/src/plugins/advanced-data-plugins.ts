import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class CloudStoragePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/cloud-storage',
    name: 'Cloud Storage',
    version: '1.0.0',
    description: 'Cloud storage abstraction',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['cloud', 'storage', 'files'],
  };

  public capabilities: PluginCapabilities = {
    api: { filesystem: true, network: true },
  };

  private files: Map<string, { data: Uint8Array; metadata: Record<string, unknown> }> = new Map();

  async upload(key: string, data: Uint8Array, metadata?: Record<string, unknown>): Promise<void> {
    this.files.set(key, { data, metadata: metadata || {} });
  }

  async download(key: string): Promise<Uint8Array | null> {
    return this.files.get(key)?.data || null;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async list(): Promise<Array<{ key: string; size: number; metadata: Record<string, unknown> }>> {
    return Array.from(this.files.entries()).map(([key, file]) => ({
      key,
      size: file.data.length,
      metadata: file.metadata,
    }));
  }

  async exists(key: string): Promise<boolean> {
    return this.files.has(key);
  }

  async getMetadata(key: string): Promise<Record<string, unknown> | null> {
    return this.files.get(key)?.metadata || null;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return `https://storage.example.com/${key}?expires=${Date.now() + expiresIn * 1000}`;
  }

  async copy(key: string, destKey: string): Promise<void> {
    const file = this.files.get(key);
    if (file) {
      this.files.set(destKey, { ...file });
    }
  }

  async move(key: string, destKey: string): Promise<void> {
    await this.copy(key, destKey);
    await this.delete(key);
  }

  getSize(): number {
    return Array.from(this.files.values()).reduce((sum, f) => sum + f.data.length, 0);
  }

  getFileCount(): number {
    return this.files.size;
  }
}

export class DatabaseORMPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/orm',
    name: 'Database ORM',
    version: '1.0.0',
    description: 'Object-relational mapping',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['orm', 'database', 'model'],
  };

  public capabilities: PluginCapabilities = {
    data: { database: true },
  };

  private models: Map<string, ModelDefinition> = new Map();
  private data: Map<string, Map<string, Record<string, unknown>>> = new Map();

  defineModel(name: string, schema: Record<string, { type: string; primaryKey?: boolean; required?: boolean }>): void {
    this.models.set(name, { name, schema });
    this.data.set(name, new Map());
  }

  async create<T extends Record<string, unknown>>(model: string, record: T): Promise<string> {
    const id = `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const modelData = this.data.get(model)!;
    modelData.set(id, { ...record, id });
    return id;
  }

  async findById<T extends Record<string, unknown>>(model: string, id: string): Promise<T | null> {
    return (this.data.get(model)?.get(id) as T) || null;
  }

  async findAll<T extends Record<string, unknown>>(model: string, filter?: Partial<T>): Promise<T[]> {
    const modelData = this.data.get(model);
    if (!modelData) return [];

    let results = Array.from(modelData.values()) as T[];

    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        results = results.filter(r => r[key] === value);
      }
    }

    return results;
  }

  async update<T extends Record<string, unknown>>(model: string, id: string, updates: Partial<T>): Promise<boolean> {
    const modelData = this.data.get(model);
    const existing = modelData?.get(id);
    if (!existing) return false;

    modelData.set(id, { ...existing, ...updates });
    return true;
  }

  async delete(model: string, id: string): Promise<boolean> {
    return this.data.get(model)?.delete(id) || false;
  }

  async count(model: string): Promise<number> {
    return this.data.get(model)?.size || 0;
  }
}

interface ModelDefinition {
  name: string;
  schema: Record<string, { type: string; primaryKey?: boolean; required?: boolean }>;
}

export class KeyValueStorePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/key-value',
    name: 'Key-Value Store',
    version: '1.0.0',
    description: 'In-memory key-value store',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['key', 'value', 'store'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  private store: Map<string, unknown> = new Map();
  private expiries: Map<string, number> = new Map();

  set(key: string, value: unknown, ttl?: number): void {
    this.store.set(key, value);
    if (ttl) {
      this.expiries.set(key, Date.now() + ttl);
    }
  }

  get<T>(key: string): T | null {
    this.cleanup(key);
    return (this.store.get(key) as T) || null;
  }

  has(key: string): boolean {
    this.cleanup(key);
    return this.store.has(key);
  }

  delete(key: string): void {
    this.store.delete(key);
    this.expiries.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.expiries.clear();
  }

  get size(): number {
    return this.store.size;
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  private cleanup(key: string): void {
    const expiry = this.expiries.get(key);
    if (expiry && Date.now() > expiry) {
      this.store.delete(key);
      this.expiries.delete(key);
    }
  }

  async setBatch(entries: Array<{ key: string; value: unknown }>): Promise<void> {
    for (const entry of entries) {
      this.set(entry.key, entry.value);
    }
  }

  async getBatch<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    for (const key of keys) {
      result.set(key, this.get<T>(key));
    }
    return result;
  }
}

export class RateLimiterDatabasePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/rate-limit-db',
    name: 'Rate Limiter Database',
    version: '1.0.0',
    description: 'Database-backed rate limiter',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['rate', 'limit', 'database'],
  };

  public capabilities: PluginCapabilities = {
    api: { network: true },
  };

  private limits: Map<string, { count: number; resetAt: number; windowMs: number; max: number }> = new Map();

  async check(identifier: string, maxRequests: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const limit = this.limits.get(identifier);

    if (!limit || now > limit.resetAt) {
      this.limits.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
        windowMs,
        max: maxRequests,
      });
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
    }

    if (limit.count >= limit.max) {
      return { allowed: false, remaining: 0, resetAt: limit.resetAt };
    }

    limit.count++;
    return {
      allowed: true,
      remaining: limit.max - limit.count,
      resetAt: limit.resetAt,
    };
  }

  async reset(identifier: string): Promise<void> {
    this.limits.delete(identifier);
  }

  async getStatus(identifier: string): Promise<{ count: number; max: number; resetAt: number } | null> {
    const limit = this.limits.get(identifier);
    if (!limit) return null;
    return { count: limit.count, max: limit.max, resetAt: limit.resetAt };
  }
}

export class SoftDeletePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/soft-delete',
    name: 'Soft Delete',
    version: '1.0.0',
    description: 'Soft delete pattern',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['soft', 'delete', 'recovery'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  private storage: Map<string, { data: Record<string, unknown>; deleted: boolean }> = new Map();

  async create<T extends Record<string, unknown>>(id: string, data: T): Promise<void> {
    this.storage.set(id, { data: { ...data }, deleted: false });
  }

  async softDelete(id: string): Promise<boolean> {
    const record = this.storage.get(id);
    if (!record) return false;
    record.deleted = true;
    return true;
  }

  async restore(id: string): Promise<boolean> {
    const record = this.storage.get(id);
    if (!record) return false;
    record.deleted = false;
    return true;
  }

  async hardDelete(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }

  async findById<T extends Record<string, unknown>>(id: string, includeDeleted = false): Promise<T | null> {
    const record = this.storage.get(id);
    if (!record) return null;
    if (!includeDeleted && record.deleted) return null;
    return record.data as T;
  }

  async list<T extends Record<string, unknown>>(options?: { includeDeleted?: boolean }): Promise<T[]> {
    const results: T[] = [];
    for (const record of this.storage.values()) {
      if (!options?.includeDeleted && record.deleted) continue;
      results.push(record.data as T);
    }
    return results;
  }

  async count(includeDeleted = false): Promise<number> {
    if (includeDeleted) return this.storage.size;
    let count = 0;
    for (const record of this.storage.values()) {
      if (!record.deleted) count++;
    }
    return count;
  }
}

export class TenantPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/tenant',
    name: 'Multi-Tenant',
    version: '1.0.0',
    description: 'Multi-tenant data isolation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['tenant', 'multi-tenant', 'isolation'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  private tenants: Map<string, Map<string, unknown>> = new Map();
  private currentTenant: string | null = null;

  async createTenant(id: string, metadata?: Record<string, unknown>): Promise<void> {
    this.tenants.set(id, new Map());
  }

  async deleteTenant(id: string): Promise<void> {
    this.tenants.delete(id);
  }

  async setCurrentTenant(id: string): Promise<void> {
    this.currentTenant = id;
  }

  getCurrentTenant(): string | null {
    return this.currentTenant;
  }

  async set(key: string, value: unknown): Promise<void> {
    const tenant = this.tenants.get(this.currentTenant!);
    tenant?.set(key, value);
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.tenants.get(this.currentTenant!)?.get(key) as T) || null;
  }

  async delete(key: string): Promise<void> {
    this.tenants.get(this.currentTenant!)?.delete(key);
  }

  async listTenants(): Promise<string[]> {
    return Array.from(this.tenants.keys());
  }

  async count(): Promise<number> {
    return this.tenants.size;
  }
}

export class AuditLogPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/audit-log',
    name: 'Audit Log',
    version: '1.0.0',
    description: 'Comprehensive audit logging',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['audit', 'log', 'history'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  private logs: Array<{
    id: string;
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    details?: Record<string, unknown>;
    ip?: string;
    timestamp: number;
  }> = [];

  async log(entry: {
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    details?: Record<string, unknown>;
    ip?: string;
  }): Promise<string> {
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.logs.push({
      ...entry,
      id,
      timestamp: Date.now(),
    });
    return id;
  }

  async query(filter: {
    userId?: string;
    action?: string;
    resource?: string;
    from?: number;
    to?: number;
    limit?: number;
  }): Promise<Array<{
    id: string;
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    timestamp: number;
  }>> {
    let results = this.logs;

    if (filter.userId) {
      results = results.filter(l => l.userId === filter.userId);
    }
    if (filter.action) {
      results = results.filter(l => l.action === filter.action);
    }
    if (filter.resource) {
      results = results.filter(l => l.resource === filter.resource);
    }
    if (filter.from) {
      results = results.filter(l => l.timestamp >= filter.from!);
    }
    if (filter.to) {
      results = results.filter(l => l.timestamp <= filter.to!);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    return results.slice(0, filter.limit || 100).map(l => ({
      id: l.id,
      userId: l.userId,
      action: l.action,
      resource: l.resource,
      resourceId: l.resourceId,
      timestamp: l.timestamp,
    }));
  }

  async getStats(action?: string): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};
    for (const log of this.logs) {
      const key = action ? `${action}` : log.action;
      stats[key] = (stats[key] || 0) + 1;
    }
    return stats;
  }
}

export class WorkflowPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/workflow',
    name: 'Workflow Engine',
    version: '1.0.0',
    description: 'Workflow automation',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['workflow', 'automation', 'steps'],
  };

  public capabilities: PluginCapabilities = {};

  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();

  defineWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
  }

  async start(workflowId: string, input: Record<string, unknown>): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    const executionId = `exec-${Date.now()}`;
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'running',
      currentStep: 0,
      input,
      steps: [],
      startedAt: Date.now(),
    };

    this.executions.set(executionId, execution);

    await this.runWorkflow(execution);

    return executionId;
  }

  private async runWorkflow(execution: WorkflowExecution): Promise<void> {
    const workflow = this.workflows.get(execution.workflowId)!;

    while (execution.currentStep < workflow.steps.length) {
      const step = workflow.steps[execution.currentStep];
      execution.currentStep++;

      const stepResult = await this.executeStep(step, execution.input);

      execution.steps.push({
        stepId: step.id,
        status: 'completed',
        output: stepResult,
      });

      if (stepResult && 'error' in stepResult) {
        break;
      }
    }

    execution.status = 'completed';
    execution.completedAt = Date.now();
  }

  private async executeStep(step: StepDefinition, input: Record<string, unknown>): Promise<unknown> {
    try {
      if (step.handler) {
        return await step.handler(input);
      }
      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  async getExecution(id: string): Promise<WorkflowExecution | null> {
    return this.executions.get(id) || null;
  }

  async listRunning(): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values()).filter(e => e.status === 'running');
  }
}

interface WorkflowDefinition {
  id: string;
  name: string;
  steps: StepDefinition[];
}

interface StepDefinition {
  id: string;
  name: string;
  handler?: (input: Record<string, unknown>) => Promise<unknown>;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: string;
  currentStep: number;
  input: Record<string, unknown>;
  steps: Array<{ stepId: string; status: string; output?: unknown }>;
  startedAt: number;
  completedAt?: number;
}

export class StateMachinePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/state-machine',
    name: 'State Machine',
    version: '1.0.0',
    description: 'Finite state machine',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['state', 'machine', 'fsm'],
  };

  public capabilities: PluginCapabilities = {};

  private machines: Map<string, FiniteStateMachine> = new Map();

  create(id: string, config: {
    initial: string;
    states: Record<string, string[]>;
  }): FiniteStateMachine {
    const machine: FiniteStateMachine = {
      id,
      current: config.initial,
      config,
    };
    this.machines.set(id, machine);
    return machine;
  }

  async transition(id: string, event: string): Promise<boolean> {
    const machine = this.machines.get(id);
    if (!machine) return false;

    const allowed = machine.config.states[machine.current] || [];
    if (!allowed.includes(event)) return false;

    machine.current = event;
    return true;
  }

  getState(id: string): string | null {
    return this.machines.get(id)?.current || null;
  }
}

interface FiniteStateMachine {
  id: string;
  current: string;
  config: {
    initial: string;
    states: Record<string, string[]>;
  };
}

export class EventSourcingPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/event-sourcing',
    name: 'Event Sourcing',
    version: '1.0.0',
    description: 'Event sourcing pattern',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['event', 'sourcing', 'cqrs'],
  };

  public capabilities: PluginCapabilities = {
    data: { storage: true },
  };

  private events: Array<{ aggregateId: string; type: string; data: unknown; timestamp: number }> = [];
  private snapshots: Map<string, { aggregateId: string; version: number; state: unknown }> = new Map();

  async appendEvent(aggregateId: string, type: string, data: unknown): Promise<void> {
    this.events.push({
      aggregateId,
      type,
      data,
      timestamp: Date.now(),
    });
  }

  async getEvents(aggregateId: string, fromVersion?: number): Promise<Array<{ type: string; data: unknown; timestamp: number }>> {
    return this.events
      .filter(e => e.aggregateId === aggregateId)
      .filter(e => !fromVersion || e.timestamp > fromVersion)
      .map(e => ({ type: e.type, data: e.data, timestamp: e.timestamp }));
  }

  async createSnapshot(aggregateId: string, version: number, state: unknown): Promise<void> {
    this.snapshots.set(aggregateId, { aggregateId, version, state });
  }

  async getSnapshot(aggregateId: string): Promise<{ version: number; state: unknown } | null> {
    return this.snapshots.get(aggregateId) || null;
  }

  async replay(aggregateId: string, reducer: (state: unknown, event: { type: string; data: unknown }) => unknown): Promise<unknown> {
    const snapshot = await this.getSnapshot(aggregateId);
    let state = snapshot?.state;
    let version = snapshot?.version || 0;

    const events = await this.getEvents(aggregateId, version);

    for (const event of events) {
      state = reducer(state, { type: event.type, data: event.data });
    }

    return state;
  }
}

export const cloudStoragePlugin = new CloudStoragePlugin();
export const databaseORMPlugin = new DatabaseORMPlugin();
export const keyValueStorePlugin = new KeyValueStorePlugin();
export const rateLimiterDatabasePlugin = new RateLimiterDatabasePlugin();
export const softDeletePlugin = new SoftDeletePlugin();
export const tenantPlugin = new TenantPlugin();
export const auditLogPlugin = new AuditLogPlugin();
export const workflowPlugin = new WorkflowPlugin();
export const stateMachinePlugin = new StateMachinePlugin();
export const eventSourcingPlugin = new EventSourcingPlugin();

export function registerAdvancedDataPlugins(): Plugin[] {
  return [
    cloudStoragePlugin,
    databaseORMPlugin,
    keyValueStorePlugin,
    rateLimiterDatabasePlugin,
    softDeletePlugin,
    tenantPlugin,
    auditLogPlugin,
    workflowPlugin,
    stateMachinePlugin,
    eventSourcingPlugin,
  ];
}