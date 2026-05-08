import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  url: string;
  shortUrl: string;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  idBoard: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  idList: string;
  idBoard: string;
  due: string | null;
  dueComplete: boolean;
}

export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

const MANIFEST: PluginManifest = {
  id: 'trello',
  name: 'Trello',
  version: '1.0.0',
  description: 'Trello integration for boards, lists, and cards',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['trello', 'kanban', 'board', 'task'],
};

const SCOPES = [
  'getBoards', 'getBoard', 'createBoard', 'updateBoard', 'deleteBoard',
  'getLists', 'getList', 'createList', 'updateList', 'deleteList',
  'getCards', 'getCard', 'createCard', 'updateCard', 'deleteCard', 'moveCard',
  'getMembers', 'addMember', 'removeMember',
  'getLabels', 'addLabel', 'removeLabel',
  'getChecklists', 'createChecklist', 'updateChecklist',
  'getActions', 'getBoardActions',
  'getWebhooks', 'createWebhook', 'deleteWebhook',
];

export default class TrelloIntegration extends IntegrationBase {
  private apiBase = 'https://api.trello.com/1';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['card_created', 'card_updated', 'board_updated'],
      dataModels: ['board', 'list', 'card', 'member', 'label'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.apiKey || !config.accessToken) throw new Error('API key and token are required');
    this.setApiKey(config.apiKey);
    this.setAccessToken(config.accessToken);
    try {
      const member = await this.apiCall<TrelloMember>(`${this.apiBase}/members/me?key=${config.apiKey}&token=${config.accessToken}`, {});
      return !!member.id;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey || !this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/members/me?key=${this.apiKey}&token=${this.accessToken}`, {});
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.apiKey || !this.accessToken) throw new Error('Not authenticated');
    const key = this.apiKey;
    const token = this.accessToken;
    const auth = `key=${key}&token=${token}`;

    switch (action) {
      case 'getBoards': return this.apiCall<{ id: string }[]>(`${this.apiBase}/members/me/boards?${auth}`, {});
      case 'getBoard': return this.apiCall<TrelloBoard>(`${this.apiBase}/boards/${params.boardId}?${auth}`, {});
      case 'createBoard': return this.apiCall<TrelloBoard>(`${this.apiBase}/boards?${auth}`, { method: 'POST', body: JSON.stringify({ name: params.name }) });
      case 'updateBoard': return this.apiCall(`${this.apiBase}/boards/${params.boardId}?${auth}`, { method: 'PUT', body: JSON.stringify(params.updates) });
      case 'getLists': return this.apiCall<TrelloList[]>(`${this.apiBase}/boards/${params.boardId}/lists?${auth}`, {});
      case 'createList': return this.apiCall<TrelloList>(`${this.apiBase}/lists?${auth}`, { method: 'POST', body: JSON.stringify({ name: params.name, idBoard: params.boardId }) });
      case 'getCards': return this.apiCall<TrelloCard[]>(`${this.apiBase}/lists/${params.listId}/cards?${auth}`, {});
      case 'getCard': return this.apiCall<TrelloCard>(`${this.apiBase}/cards/${params.cardId}?${auth}`, {});
      case 'createCard': return this.apiCall<TrelloCard>(`${this.apiBase}/cards?${auth}`, { method: 'POST', body: JSON.stringify({ name: params.name, idList: params.listId }) });
      case 'updateCard': return this.apiCall(`${this.apiBase}/cards/${params.cardId}?${auth}`, { method: 'PUT', body: JSON.stringify(params.updates) });
      case 'moveCard': return this.apiCall(`${this.apiBase}/cards/${params.cardId}?${auth}`, { method: 'PUT', body: JSON.stringify({ idList: params.listId }) });
      case 'getMembers': return this.apiCall(`${this.apiBase}/boards/${params.boardId}/members?${auth}`, {});
      case 'addMember': return this.apiCall(`${this.apiBase}/boards/${params.boardId}/members?${auth}`, { method: 'PUT', body: JSON.stringify({ email: params.email }) });
      case 'getLabels': return this.apiCall<TrelloLabel[]>(`${this.apiBase}/boards/${params.boardId}/labels?${auth}`, {});
      case 'addLabel': return this.apiCall(`${this.apiBase}/labels?${auth}`, { method: 'POST', body: JSON.stringify({ name: params.name, color: params.color, idBoard: params.boardId }) });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'boards': return this.executeAction('getBoards', options || {});
      case 'lists': return this.executeAction('getLists', { boardId: options?.boardId });
      case 'cards': return this.executeAction('getCards', { listId: options?.listId });
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.apiKey = null; this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createTrelloIntegration(): TrelloIntegration { return new TrelloIntegration(); }