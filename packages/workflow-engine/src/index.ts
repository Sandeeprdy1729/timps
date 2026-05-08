import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export interface WorkflowTrigger {
  type: 'schedule' | 'event' | 'webhook' | 'manual' | 'cron';
  config: {
    cron?: string;
    event?: string;
    url?: string;
    interval?: number;
  };
}

export interface WorkflowAction {
  type: 'notification' | 'api_call' | 'integration' | 'transform' | 'condition' | 'delay' | 'loop' | 'transform_json';
  config: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  action: WorkflowAction;
  onSuccess?: string;
  onFailure?: string;
  retries?: number;
  timeout?: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt: number;
  runs: number;
  lastRun?: number;
  lastStatus?: 'success' | 'failed';
  tags?: string[];
  version?: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: number;
  completedAt?: number;
  duration?: number;
  steps: {
    stepId: string;
    status: 'pending' | 'running' | 'success' | 'failed';
    output?: any;
    error?: string;
    startedAt?: number;
    completedAt?: number;
  }[];
  logs: WorkflowLog[];
}

export interface WorkflowLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  stepId?: string;
  data?: any;
}

export interface WorkflowFilter {
  enabled?: boolean;
  tags?: string[];
  triggerType?: string;
}

export type WorkflowEventHandler = (workflow: Workflow, run: WorkflowRun) => void | Promise<void>;

export class WorkflowEngine extends EventEmitter {
  private workflows: Map<string, Workflow> = new Map();
  private runs: Map<string, WorkflowRun> = new Map();
  private dataDir: string;
  private handlers: Map<string, WorkflowEventHandler> = new Map();
  private runningWorkflows: Set<string> = new Set();
  private schedulerInterval?: NodeJS.Timeout;
  private cronJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor(dataDir: string = '.timps/workflows') {
    super();
    this.dataDir = dataDir;
    this.loadWorkflows();
    this.startScheduler();
  }

  private loadWorkflows(): void {
    const dir = path.resolve(process.cwd(), this.dataDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const workflowsFile = path.join(dir, 'workflows.json');
    if (fs.existsSync(workflowsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(workflowsFile, 'utf-8'));
        for (const workflow of data.workflows || []) {
          this.workflows.set(workflow.id, workflow);
        }
      } catch (e) {
        console.error('Failed to load workflows:', e);
      }
    }
  }

  private saveWorkflows(): void {
    const dir = path.resolve(process.cwd(), this.dataDir);
    const workflowsFile = path.join(dir, 'workflows.json');
    const data = {
      workflows: Array.from(this.workflows.values()),
      version: 2,
      savedAt: Date.now(),
    };
    fs.writeFileSync(workflowsFile, JSON.stringify(data, null, 2));
  }

  createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'runs'>): Workflow {
    const id = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const newWorkflow: Workflow = {
      ...workflow,
      id,
      createdAt: now,
      updatedAt: now,
      runs: 0,
      version: 1,
      tags: workflow.tags || [],
    };
    this.workflows.set(id, newWorkflow);
    this.saveWorkflows();
    this.emit('workflow:created', newWorkflow);
    this.setupTrigger(newWorkflow);
    return newWorkflow;
  }

  updateWorkflow(id: string, updates: Partial<Workflow>): Workflow | null {
    const workflow = this.workflows.get(id);
    if (!workflow) return null;

    const updated: Workflow = {
      ...workflow,
      ...updates,
      id: workflow.id,
      createdAt: workflow.createdAt,
      updatedAt: Date.now(),
      version: (workflow.version || 0) + 1,
    };
    this.workflows.set(id, updated);
    this.saveWorkflows();
    this.emit('workflow:updated', updated);
    return updated;
  }

  deleteWorkflow(id: string): boolean {
    const workflow = this.workflows.get(id);
    if (!workflow) return false;

    this.workflows.delete(id);
    this.clearTrigger(workflow);
    this.saveWorkflows();
    this.emit('workflow:deleted', id);
    return true;
  }

  getWorkflow(id: string): Workflow | null {
    return this.workflows.get(id) || null;
  }

  listWorkflows(filter?: WorkflowFilter): Workflow[] {
    let workflows = Array.from(this.workflows.values()).sort((a, b) => b.updatedAt - a.updatedAt);

    if (filter) {
      if (filter.enabled !== undefined) {
        workflows = workflows.filter(w => w.enabled === filter.enabled);
      }
      if (filter.tags && filter.tags.length > 0) {
        workflows = workflows.filter(w => 
          w.tags?.some(t => filter.tags!.includes(t))
        );
      }
      if (filter.triggerType) {
        workflows = workflows.filter(w => w.trigger.type === filter.triggerType);
      }
    }

    return workflows;
  }

  enableWorkflow(id: string): Workflow | null {
    const workflow = this.updateWorkflow(id, { enabled: true });
    if (workflow) {
      this.setupTrigger(workflow);
    }
    return workflow;
  }

  disableWorkflow(id: string): Workflow | null {
    const workflow = this.workflows.get(id);
    if (workflow) {
      this.clearTrigger(workflow);
    }
    return this.updateWorkflow(id, { enabled: false });
  }

  duplicateWorkflow(id: string): Workflow | null {
    const original = this.workflows.get(id);
    if (!original) return null;

    return this.createWorkflow({
      name: `${original.name} (Copy)`,
      description: original.description,
      enabled: false,
      trigger: { ...original.trigger },
      steps: original.steps.map(s => ({ ...s })),
      tags: [...(original.tags || [])],
    });
  }

  exportWorkflow(id: string): string | null {
    const workflow = this.workflows.get(id);
    if (!workflow) return null;
    return JSON.stringify(workflow, null, 2);
  }

  importWorkflow(json: string): Workflow | null {
    try {
      const data = JSON.parse(json);
      return this.createWorkflow({
        name: data.name,
        description: data.description || '',
        enabled: false,
        trigger: data.trigger || { type: 'manual', config: {} },
        steps: data.steps || [],
        tags: data.tags || [],
      });
    } catch (e) {
      this.emit('workflow:error', { error: e.message });
      return null;
    }
  }

  async runWorkflow(id: string, payload?: any): Promise<WorkflowRun> {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new Error(`Workflow ${id} not found`);
    }

    if (!workflow.enabled) {
      throw new Error(`Workflow ${id} is disabled`);
    }

    if (this.runningWorkflows.has(id)) {
      throw new Error(`Workflow ${id} is already running`);
    }

    this.runningWorkflows.add(id);

    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const run: WorkflowRun = {
      id: runId,
      workflowId: id,
      status: 'running',
      startedAt: Date.now(),
      steps: workflow.steps.map((step) => ({
        stepId: step.id,
        status: 'pending' as const,
      })),
      logs: [{ timestamp: Date.now(), level: 'info', message: `Workflow ${workflow.name} started` }],
    };
    this.runs.set(runId, run);
    this.emit('run:started', run);
    workflow.runs++;
    workflow.lastRun = Date.now();
    this.saveWorkflows();

    try {
      const result = await this.executeSteps(workflow, run, payload);
      run.status = result.success ? 'success' : 'failed';
      workflow.lastStatus = result.success ? 'success' : 'failed';
    } catch (error: any) {
      run.status = 'failed';
      workflow.lastStatus = 'failed';
      run.logs.push({
        timestamp: Date.now(),
        level: 'error',
        message: error.message,
      });
    }

    run.completedAt = Date.now();
    run.duration = run.completedAt - run.startedAt;
    this.runningWorkflows.delete(id);
    this.emit('run:completed', run);

    this.saveRun(run);
    return run;
  }

  private async executeSteps(workflow: Workflow, run: WorkflowRun, context: any): Promise<{ success: boolean }> {
    let currentStepIndex = 0;
    let attempts = 0;
    const maxRetries = 3;

    while (currentStepIndex < workflow.steps.length) {
      const step = workflow.steps[currentStepIndex];
      run.logs.push({
        timestamp: Date.now(),
        level: 'info',
        message: `Executing step: ${step.name}`,
        stepId: step.id,
      });
      this.emit('step:started', { run, step });

      const stepIndex = workflow.steps.findIndex(s => s.id === step.id);
      if (stepIndex >= 0) {
        run.steps[stepIndex].status = 'running';
        run.steps[stepIndex].startedAt = Date.now();
      }

      try {
        const startTime = Date.now();
        const timeout = step.timeout || 60000;
        const output = await this.executeStepWithTimeout(step, context, timeout);
        const duration = Date.now() - startTime;

        const idx = workflow.steps.findIndex(s => s.id === step.id);
        if (idx >= 0) {
          run.steps[idx].status = 'success';
          run.steps[idx].completedAt = Date.now();
          run.steps[idx].output = output;
        }

        run.logs.push({
          timestamp: Date.now(),
          level: 'info',
          message: `Step completed in ${duration}ms`,
          stepId: step.id,
          data: output,
        });
        this.emit('step:completed', { run, step, output });

        context = { ...context, ...(output || {}), lastOutput: output };
        attempts = 0;

        if (step.onSuccess) {
          const nextIndex = workflow.steps.findIndex(s => s.id === step.onSuccess);
          if (nextIndex >= 0) {
            currentStepIndex = nextIndex;
          } else {
            currentStepIndex++;
          }
        } else {
          currentStepIndex++;
        }
      } catch (error: any) {
        const idx = workflow.steps.findIndex(s => s.id === step.id);
        if (idx >= 0) {
          run.steps[idx].status = 'failed';
          run.steps[idx].error = error.message;
          run.steps[idx].completedAt = Date.now();
        }

        run.logs.push({
          timestamp: Date.now(),
          level: 'error',
          message: `Step failed: ${error.message}`,
          stepId: step.id,
        });
        this.emit('step:failed', { run, step, error });

        attempts++;
        const maxAttempts = step.retries || 1;

        if (attempts >= maxAttempts) {
          if (step.onFailure) {
            const nextIndex = workflow.steps.findIndex(s => s.id === step.onFailure);
            if (nextIndex >= 0) {
              currentStepIndex = nextIndex;
              attempts = 0;
            } else {
              return { success: false };
            }
          } else {
            return { success: false };
          }
        }
      }
    }

    return { success: true };
  }

  private async executeStepWithTimeout(step: WorkflowStep, context: any, timeout: number): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Step timed out after ${timeout}ms`));
      }, timeout);

      try {
        const output = await this.executeStep(step, context);
        clearTimeout(timeoutId);
        resolve(output);
      } catch (error: any) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private async executeStep(step: WorkflowStep, context: any): Promise<any> {
    const { action } = step;
    switch (action.type) {
      case 'notification':
        return this.handleNotification(action.config, context);
      case 'api_call':
        return this.handleApiCall(action.config, context);
      case 'integration':
        return this.handleIntegration(action.config, context);
      case 'transform':
        return this.handleTransform(action.config, context);
      case 'condition':
        return this.handleCondition(action.config, context);
      case 'delay':
        return this.handleDelay(action.config, context);
      case 'loop':
        return this.handleLoop(action.config, context);
      case 'transform_json':
        return this.handleTransformJson(action.config, context);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async handleNotification(config: Record<string, any>, context: any): Promise<any> {
    const message = this.interpolate(config.message || 'No message', context);
    console.log(`[Notification] ${message}`);

    if (config.sound) {
      console.log(`[Sound] ${config.sound}`);
    }

    return { sent: true, message };
  }

  private async handleApiCall(config: Record<string, any>, context: any): Promise<any> {
    const url = this.interpolate(config.url, context);
    const method = (config.method || 'GET').toUpperCase();
    const headers = { 'Content-Type': 'application/json', ...config.headers };

    const body = config.body ? this.interpolate(JSON.stringify(config.body), context) : undefined;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' ? body : undefined,
      });

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        status: response.status,
        ok: response.ok,
        data,
      };
    } catch (error: any) {
      throw new Error(`API call failed: ${error.message}`);
    }
  }

  private async handleIntegration(config: Record<string, any>, context: any): Promise<any> {
    const integration = config.integration;
    const action = this.interpolate(config.action, context);
    const params = this.interpolateObject(config.params || {}, context);

    console.log(`[Integration] ${integration}.${action}`);

    return { integration, action, success: true, input: params };
  }

  private handleTransform(config: Record<string, any>, context: any): any {
    const { operation, field, value } = config;
    let result = context[field] || context;

    switch (operation) {
      case 'set':
        return { [field || 'value']: this.interpolate(value, context) };
      case 'map':
        return result;
      case 'filter':
        return Array.isArray(result) ? result.filter(Boolean) : result;
      case 'map_array':
        if (Array.isArray(result)) {
          return result.map((item: any) => this.interpolateObject(config.expression || {}, { ...context, item }));
        }
        return result;
      case 'pick':
        if (typeof result === 'object') {
          const fields = config.fields?.split(',').map((s: string) => s.trim()) || [];
          return fields.reduce((obj: any, f: string) => {
            obj[f] = result[f];
            return obj;
          }, {});
        }
        return result;
      case 'omit':
        if (typeof result === 'object') {
          const fields = config.fields?.split(',').map((s: string) => s.trim()) || [];
          return Object.fromEntries(
            Object.entries(result).filter(([k]) => !fields.includes(k))
          );
        }
        return result;
      case 'merge':
        return { ...context, ...(value ? JSON.parse(this.interpolate(value, context)) : {}) };
      case 'concat':
        const parts = field?.split(',').map((s: string) => context[s.trim()]) || [];
        return parts.join(config.separator || ', ');
      default:
        return result;
    }
  }

  private handleCondition(config: Record<string, any>, context: any): boolean {
    const { field, operator, value } = config;
    const contextValue = this.interpolate(field ? String(context[field]) : JSON.stringify(context), context);
    const compareValue = this.interpolate(value, context);

    switch (operator) {
      case 'equals':
        return contextValue === compareValue;
      case 'not_equals':
        return contextValue !== compareValue;
      case 'contains':
        return contextValue.includes(compareValue);
      case 'not_contains':
        return !contextValue.includes(compareValue);
      case 'gt':
        return parseFloat(contextValue) > parseFloat(compareValue);
      case 'gte':
        return parseFloat(contextValue) >= parseFloat(compareValue);
      case 'lt':
        return parseFloat(contextValue) < parseFloat(compareValue);
      case 'lte':
        return parseFloat(contextValue) <= parseFloat(compareValue);
      case 'exists':
        return contextValue !== undefined && contextValue !== null && contextValue !== '';
      case 'not_exists':
        return contextValue === undefined || contextValue === null || contextValue === '';
      case 'matches':
        return new RegExp(compareValue).test(contextValue);
      case 'empty':
        return !contextValue || contextValue === '';
      case 'not_empty':
        return !!contextValue && contextValue !== '';
      default:
        return false;
    }
  }

  private handleDelay(config: Record<string, any>, _context: any): Promise<any> {
    const ms = config.ms || config.seconds * 1000 || 1000;
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleLoop(config: Record<string, any>, context: any): any {
    const { items, limit } = config;
    const loopItems = Array.isArray(context[items]) ? context[items] : [];
    const max = limit ? Math.min(limit, loopItems.length) : loopItems.length;
    return { items: loopItems.slice(0, max), total: loopItems.length, processed: max };
  }

  private handleTransformJson(config: Record<string, any>, context: any): any {
    const { field, operation } = config;
    const jsonStr = typeof context[field] === 'string' 
      ? context[field] 
      : JSON.stringify(context[field] || {});
    
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return { error: 'Invalid JSON' };
    }

    switch (operation) {
      case 'pick':
        return config.fields?.split(',').reduce((obj: any, f: string) => {
          obj[f.trim()] = data[f.trim()];
          return obj;
        }, {});
      case 'get':
        return data[config.path];
      case 'map_keys':
        return Object.fromEntries(
          Object.entries(data).map(([k, v]) => [this.interpolate(config.keyTemplate || '{{key}}', { key: k }), v])
        );
      default:
        return data;
    }
  }

  private interpolate(template: string, context: any): string {
    let result = template;
    for (const [key, value] of Object.entries(context)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }
    return result;
  }

  private interpolateObject(obj: any, context: any): any {
    if (typeof obj === 'string') {
      return this.interpolate(obj, context);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateObject(item, context));
    }
    if (typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, this.interpolateObject(v, context)])
      );
    }
    return obj;
  }

  getRuns(workflowId: string, limit: number = 10): WorkflowRun[] {
    return Array.from(this.runs.values())
      .filter(r => r.workflowId === workflowId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  getRun(runId: string): WorkflowRun | null {
    return this.runs.get(runId) || null;
  }

  getRunLogs(runId: string): WorkflowLog[] {
    return this.runs.get(runId)?.logs || [];
  }

  private saveRun(run: WorkflowRun): void {
    const dir = path.resolve(process.cwd(), this.dataDir, 'runs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const file = path.join(dir, `${run.id}.json`);
    fs.writeFileSync(file, JSON.stringify(run, null, 2));
  }

  emitEvent(event: string, payload?: any): void {
    const workflows = this.listWorkflows({ triggerType: 'event' });
    for (const workflow of workflows) {
      if (!workflow.enabled) continue;
      if (workflow.trigger.config.event !== event) continue;

      this.runWorkflow(workflow.id, payload).catch(error => {
        console.error(`Workflow ${workflow.id} failed:`, error.message);
      });
    }
  }

  private setupTrigger(workflow: Workflow): void {
    this.clearTrigger(workflow);

    if (!workflow.enabled) return;

    switch (workflow.trigger.type) {
      case 'cron':
        this.setupCronTrigger(workflow);
        break;
      case 'schedule':
        this.setupScheduleTrigger(workflow);
        break;
    }
  }

  private clearTrigger(workflow: Workflow): void {
    const key = `wf_${workflow.id}`;
    if (this.cronJobs.has(key)) {
      clearInterval(this.cronJobs.get(key));
      this.cronJobs.delete(key);
    }
  }

  private setupCronTrigger(workflow: Workflow): void {
    if (!workflow.trigger.config.cron) return;
    
    const key = `wf_${workflow.id}`;
    const cron = workflow.trigger.config.cron;

    const [minute, hour, day, month, dayOfWeek] = cron.split(' ');
    
    this.cronJobs.set(key, setInterval(() => {
      const now = new Date();
      const matchesMinute = minute === '*' || now.getMinutes() === parseInt(minute);
      const matchesHour = hour === '*' || now.getHours() === parseInt(hour);
      
      if (matchesMinute && matchesHour) {
        this.runWorkflow(workflow.id).catch(e => console.error(e));
      }
    }, 60000));
  }

  private setupScheduleTrigger(workflow: Workflow): void {
    if (!workflow.trigger.config.interval) return;

    const key = `wf_${workflow.id}`;
    this.cronJobs.set(key, setInterval(() => {
      this.runWorkflow(workflow.id).catch(e => console.error(e));
    }, workflow.trigger.config.interval));
  }

  private startScheduler(): void {
    this.schedulerInterval = setInterval(() => {
      const workflows = this.listWorkflows({ enabled: true, triggerType: 'cron' });
      for (const workflow of workflows) {
        if (workflow.trigger.config.cron) {
          const [minute, hour] = workflow.trigger.config.cron.split(' ');
          const now = new Date();
          const matchesMinute = minute === '*' || now.getMinutes() === parseInt(minute);
          const matchesHour = hour === '*' || now.getHours() === parseInt(hour);
          
          if (matchesMinute && matchesHour) {
            this.runWorkflow(workflow.id).catch(e => console.error(e));
          }
        }
      }
    }, 60000);
  }

  on(event: 'workflow:created' | 'workflow:updated' | 'workflow:deleted', handler: WorkflowEventHandler): void {
    super.on(event, handler);
  }

  onWorkflowUpdate(handler: (workflow: Workflow) => void): void {
    this.on('workflow:updated', handler as WorkflowEventHandler);
  }

  onRunComplete(handler: (run: WorkflowRun) => void): void {
    this.on('run:completed', handler as WorkflowEventHandler);
  }

  destroy(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    for (const interval of this.cronJobs.values()) {
      clearInterval(interval);
    }
    this.cronJobs.clear();
  }
}

export class WorkflowTemplate {
  static slackMessage(template: Partial<Workflow>): Workflow {
    return {
      ...template,
      name: template.name || 'Slack Notification',
      description: template.description || 'Send a message to Slack',
      trigger: { type: 'manual', config: {} },
      steps: [
        {
          id: 'step_1',
          name: 'Send Slack Message',
          action: {
            type: 'notification',
            config: {
              message: '{{message}}',
              sound: 'default',
            },
          },
        },
      ],
    };
  }

  static apiPoller(template: Partial<Workflow>): Workflow {
    return {
      ...template,
      name: template.name || 'API Poller',
      description: template.description || 'Poll an API and process results',
      trigger: { type: 'schedule', config: { interval: 60000 } },
      steps: [
        {
          id: 'step_1',
          name: 'Fetch Data',
          action: {
            type: 'api_call',
            config: {
              url: '{{url}}',
              method: 'GET',
            },
          },
          onSuccess: 'step_2',
        },
        {
          id: 'step_2',
          name: 'Process Results',
          action: {
            type: 'transform_json',
            config: {
              field: 'data',
              operation: 'pick',
              fields: 'id,name,email',
            },
          },
        },
      ],
    };
  }

  static gitSync(template: Partial<Workflow>): Workflow {
    return {
      ...template,
      name: template.name || 'Git Sync',
      description: template.description || 'Sync with Git repository',
      trigger: { type: 'event', config: { event: 'git.push' } },
      steps: [
        {
          id: 'step_1',
          name: 'Fetch Changes',
          action: {
            type: 'integration',
            config: {
              integration: 'git',
              action: 'pull',
            },
          },
          onSuccess: 'step_2',
        },
        {
          id: 'step_2',
          name: 'Run Tests',
          action: {
            type: 'integration',
            config: {
              integration: 'npm',
              action: 'test',
            },
          },
          onFailure: 'step_3',
        },
        {
          id: 'step_3',
          name: 'Notify Failure',
          action: {
            type: 'notification',
            config: {
              message: 'Tests failed after git sync',
            },
          },
        },
      ],
    };
  }

  static dailyReport(template: Partial<Workflow>): Workflow {
    return {
      ...template,
      name: template.name || 'Daily Report',
      description: template.description || 'Generate and send daily report',
      trigger: { type: 'cron', config: { cron: '0 9 * * *' } },
      steps: [
        {
          id: 'step_1',
          name: 'Gather Stats',
          action: {
            type: 'integration',
            config: {
              integration: 'analytics',
              action: 'getStats',
            },
          },
          onSuccess: 'step_2',
        },
        {
          id: 'step_2',
          name: 'Format Report',
          action: {
            type: 'transform',
            config: {
              operation: 'set',
              field: 'report',
              value: 'Daily Report: {{stats}}',
            },
          },
          onSuccess: 'step_3',
        },
        {
          id: 'step_3',
          name: 'Send Report',
          action: {
            type: 'notification',
            config: {
              message: '{{report}}',
            },
          },
        },
      ],
    };
  }
}

export function createWorkflowEngine(dataDir?: string): WorkflowEngine {
  return new WorkflowEngine(dataDir);
}