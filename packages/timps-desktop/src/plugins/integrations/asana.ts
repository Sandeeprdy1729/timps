import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface AsanaProject {
  id: string;
  name: string;
  notes: string;
  archived: boolean;
  created_at: string;
}

export interface AsanaTask {
  id: string;
  name: string;
  notes: string;
  completed: boolean;
  due_on: string | null;
  assignee: { name: string } | null;
}

export interface AsanaStory {
  id: string;
  created_at: string;
  type: 'comment' | 'system';
  text: string;
}

const MANIFEST: PluginManifest = {
  id: 'asana',
  name: 'Asana',
  version: '1.0.0',
  description: 'Asana task management integration',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['asana', 'task', 'project'],
};

const SCOPES = [
  'getProjects', 'getProject', 'createProject', 'updateProject', 'deleteProject',
  'getTasks', 'getTask', 'createTask', 'updateTask', 'deleteTask', 'completeTask',
  'getStories', 'createStory',
  'getSections', 'createSection',
  'getTags', 'createTag',
  'getTeam', 'getTeams', 'createTeam',
  'getWorkspace', 'createWorkspace',
  'getProjectMemberships',
];

export default class AsanaIntegration extends IntegrationBase {
  private apiBase = 'https://app.asana.com/api/1.0';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = { actions: SCOPES, triggers: ['task_created', 'task_completed'], dataModels: ['project', 'task', 'story'] };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);
    try {
      const me = await this.apiCall<{ data: { id: string } }>(`${this.apiBase}/users/me`, { headers: { Authorization: `Bearer ${config.accessToken}` } });
      return !!me.data?.id;
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
      case 'getProjects': return this.apiCall<{ data: AsanaProject[] }>(`${this.apiBase}/projects?workspace=${params.workspaceId}`, { headers });
      case 'getProject': return this.apiCall<{ data: AsanaProject }>(`${this.apiBase}/projects/${params.projectId}`, { headers });
      case 'createProject': return this.apiCall<{ data: AsanaProject }>(`${this.apiBase}/projects`, { method: 'POST', headers, body: JSON.stringify({ data: params.project }) });
      case 'updateProject': return this.apiCall(`${this.apiBase}/projects/${params.projectId}`, { method: 'PUT', headers, body: JSON.stringify({ data: params.updates }) });
      case 'getTasks': return this.apiCall<{ data: AsanaTask[] }>(`${this.apiBase}/tasks?project=${params.projectId}`, { headers });
      case 'getTask': return this.apiCall<{ data: AsanaTask }>(`${this.apiBase}/tasks/${params.taskId}`, { headers });
      case 'createTask': return this.apiCall<{ data: AsanaTask }>(`${this.apiBase}/tasks`, { method: 'POST', headers, body: JSON.stringify({ data: params.task }) });
      case 'updateTask': return this.apiCall(`${this.apiBase}/tasks/${params.taskId}`, { method: 'PUT', headers, body: JSON.stringify({ data: params.updates }) });
      case 'completeTask': return this.apiCall(`${this.apiBase}/tasks/${params.taskId}`, { method: 'PUT', headers, body: JSON.stringify({ data: { completed: true } }) });
      case 'getStories': return this.apiCall<{ data: AsanaStory[] }>(`${this.apiBase}/tasks/${params.taskId}/stories`, { headers });
      case 'createStory': return this.apiCall(`${this.apiBase}/tasks/${params.taskId}/stories`, { method: 'POST', headers, body: JSON.stringify({ data: { text: params.text } }) });
      case 'getSections': return this.apiCall(`${this.apiBase}/projects/${params.projectId}/sections`, { headers });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'projects': return this.executeAction('getProjects', { workspaceId: options?.workspaceId });
      case 'tasks': return this.executeAction('getTasks', { projectId: options?.projectId });
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createAsanaIntegration(): AsanaIntegration { return new AsanaIntegration(); }