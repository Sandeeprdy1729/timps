import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface ClickUpSpace {
  id: string;
  name: string;
  private: boolean;
  status: string;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  space: string;
  hidden: boolean;
}

export interface ClickUpList {
  id: string;
  name: string;
  folder: { id: string };
  space: { id: string };
}

export interface ClickUpTask {
  id: string;
  name: string;
  description: string;
  status: { status: string; color: string };
  priority: number;
  due_date: string;
  start_date: string;
  assignee: Array<{ id: string; username: string }>;
  tags: Array<{ name: string; color: string }>;
  dependencies: string[];
}

export interface ClickUpComment {
  id: string;
  comment: string;
  user: { id: string; username: string };
  date: string;
}

export interface ClickUpTimeEntry {
  id: string;
  description: string;
  duration: number;
  start: string;
  stop: string;
  task: { id: string };
  user: { id: string };
}

const MANIFEST: PluginManifest = {
  id: 'clickup',
  name: 'ClickUp',
  version: '1.0.0',
  description: 'ClickUp task management integration for spaces, folders, lists, and tasks',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['clickup', 'task', 'project', 'management'],
};

const SCOPES = [
  'getSpaces', 'getSpace', 'createSpace', 'updateSpace', 'deleteSpace',
  'getFolders', 'getFolder', 'createFolder', 'updateFolder', 'deleteFolder',
  'getLists', 'getList', 'createList', 'updateList', 'deleteList', 'getListItems',
  'getTasks', 'getTask', 'createTask', 'updateTask', 'deleteTask', 'moveTask', 'archiveTask', 'duplicateTask',
  'getTaskComments', 'addTaskComment', 'editTaskComment', 'deleteTaskComment',
  'getTaskDependencies', 'addTaskDependency', 'removeTaskDependency',
  'getTaskMembers', 'addTaskMember', 'removeTaskMember',
  'getTaskTags', 'addTaskTag', 'removeTaskTag',
  'getTimeEntries', 'getTimeEntry', 'createTimeEntry', 'updateTimeEntry', 'deleteTimeEntry',
  'getGoals', 'getGoal', 'createGoal', 'updateGoal', 'deleteGoal',
  'getKeyResults', 'getKeyResult', 'createKeyResult', 'updateKeyResult', 'deleteKeyResult',
  'getWebhooks', 'createWebhook', 'deleteWebhook',
  'getViews', 'getView', 'createView', 'updateView', 'deleteView',
  'getTemplates', 'getTemplate', 'createTaskFromTemplate',
  'getTeams', 'getTeam', 'getTeamMembers',
  'getCustomFields', 'getCustomField', 'createCustomField', 'updateCustomField', 'deleteCustomField',
  'getStatuses', 'createStatus', 'deleteStatus',
  'getPriorities', 'createPriority',
  'getAutomations', 'createAutomation',
  'getSprint', 'createSprint', 'completeSprint',
];

export default class ClickUpIntegration extends IntegrationBase {
  private apiBase = 'https://api.clickup.com/api/v2';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['task_created', 'task_updated', 'task_completed', 'task_deleted', 'comment_created'],
      dataModels: ['space', 'folder', 'list', 'task', 'comment', 'time_entry', 'goal'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('API token required');
    this.setAccessToken(config.accessToken);
    try {
      const user = await this.apiCall<{ user: { id: string } }>(`${this.apiBase}/user`, { headers: { Authorization: config.accessToken } });
      return !!user.user?.id;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> { return this.isAuthenticated(); }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: this.accessToken, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getSpaces':
        return this.apiCall<{ spaces: ClickUpSpace[] }>(`${this.apiBase}/team/${params.teamId}/space`, { headers });
      case 'getSpace':
        return this.apiCall<ClickUpSpace>(`${this.apiBase}/space/${params.spaceId}`, { headers });
      case 'createSpace':
        return this.apiCall<ClickUpSpace>(`${this.apiBase}/team/${params.teamId}/space`, { method: 'POST', headers, body: JSON.stringify(params.space) });
      case 'updateSpace':
        return this.apiCall<ClickUpSpace>(`${this.apiBase}/space/${params.spaceId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'getFolders':
        return this.apiCall<{ folders: ClickUpFolder[] }>(`${this.apiBase}/space/${params.spaceId}/folder`, { headers });
      case 'getFolder':
        return this.apiCall<ClickUpFolder>(`${this.apiBase}/folder/${params.folderId}`, { headers });
      case 'createFolder':
        return this.apiCall<ClickUpFolder>(`${this.apiBase}/space/${params.spaceId}/folder`, { method: 'POST', headers, body: JSON.stringify(params.folder) });
      case 'getLists':
        return this.apiCall<{ lists: ClickUpList[] }>(`${this.apiBase}/folder/${params.folderId}/list`, { headers });
      case 'getList':
        return this.apiCall<ClickUpList>(`${this.apiBase}/list/${params.listId}`, { headers });
      case 'createList':
        return this.apiCall<ClickUpList>(`${this.apiBase}/folder/${params.folderId}/list`, { method: 'POST', headers, body: JSON.stringify(params.list) });
      case 'updateList':
        return this.apiCall<ClickUpList>(`${this.apiBase}/list/${params.listId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'getTasks':
        return this.apiCall<{ tasks: ClickUpTask[] }>(`${this.apiBase}/list/${params.listId}/task`, { headers });
      case 'getTask':
        return this.apiCall<ClickUpTask>(`${this.apiBase}/task/${params.taskId}`, { headers });
      case 'createTask':
        return this.apiCall<ClickUpTask>(`${this.apiBase}/list/${params.listId}/task`, { method: 'POST', headers, body: JSON.stringify(params.task) });
      case 'updateTask':
        return this.apiCall<ClickUpTask>(`${this.apiBase}/task/${params.taskId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'deleteTask':
        return this.apiCall(`${this.apiBase}/task/${params.taskId}`, { method: 'DELETE', headers });
      case 'moveTask':
        return this.apiCall<ClickUpTask>(`${this.apiBase}/task/${params.taskId}/move/${params.listId}`, { method: 'POST', headers });
      case 'archiveTask':
        return this.apiCall(`${this.apiBase}/task/${params.taskId}`, { method: 'POST', headers, body: JSON.stringify({ archived: true }) });
      case 'getTaskComments':
        return this.apiCall<{ comments: ClickUpComment[] }>(`${this.apiBase}/task/${params.taskId}/comment`, { headers });
      case 'addTaskComment':
        return this.apiCall<ClickUpComment>(`${this.apiBase}/task/${params.taskId}/comment`, { method: 'POST', headers, body: JSON.stringify({ comment: params.comment }) });
      case 'getTimeEntries':
        return this.apiCall<{ data: ClickUpTimeEntry[] }>(`${this.apiBase}/team/${params.teamId}/time_entries`, { headers });
      case 'createTimeEntry':
        return this.apiCall<ClickUpTimeEntry>(`${this.apiBase}/task/${params.taskId}/time_entry`, { method: 'POST', headers, body: JSON.stringify(params.timeEntry) });
      case 'updateTimeEntry':
        return this.apiCall<ClickUpTimeEntry>(`${this.apiBase}/time_entry/${params.entryId}`, { method: 'PUT', headers, body: JSON.stringify(params.updates) });
      case 'deleteTimeEntry':
        return this.apiCall(`${this.apiBase}/time_entry/${params.entryId}`, { method: 'DELETE', headers });
      case 'getGoals':
        return this.apiCall<{ goals: unknown[] }>(`${this.apiBase}/team/${params.teamId}/goal`, { headers });
      case 'createGoal':
        return this.apiCall(`${this.apiBase}/team/${params.teamId}/goal`, { method: 'POST', headers, body: JSON.stringify(params.goal) });
      case 'getViews':
        return this.apiCall(`${this.apiBase}/team/${params.teamId}/view`, { headers });
      case 'createView':
        return this.apiCall(`${this.apiBase}/space/${params.spaceId}/view`, { method: 'POST', headers, body: JSON.stringify(params.view) });
      case 'getWebhooks':
        return this.apiCall(`${this.apiBase}/team/${params.teamId}/webhook`, { headers });
      case 'createWebhook':
        return this.apiCall(`${this.apiBase}/team/${params.teamId}/webhook`, { method: 'POST', headers, body: JSON.stringify(params.webhook) });
      case 'getTeams':
        return this.apiCall(`${this.apiBase}/team`, { headers });
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'spaces': return this.executeAction('getSpaces', options || {});
      case 'tasks': return this.executeAction('getTasks', options || {});
      case 'lists': return this.executeAction('getLists', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createClickUpIntegration(): ClickUpIntegration { return new ClickUpIntegration(); }