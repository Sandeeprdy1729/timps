import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface MicrosoftTeamsChannel {
  id: string;
  displayName: string;
  description: string;
}

export interface MicrosoftTeamsMessage {
  id: string;
  subject: string | null;
  from: { displayName: string };
  body: { contentType: string; content: string };
  createdDateTime: string;
}

export interface MicrosoftTeamsTeam {
  id: string;
  displayName: string;
  description: string;
}

const MANIFEST: PluginManifest = {
  id: 'microsoft-teams',
  name: 'Microsoft Teams',
  version: '1.0.0',
  description: 'Microsoft Teams messaging and collaboration integration',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['microsoft', 'teams', 'chat', 'collaboration'],
};

const SCOPES = ['getTeams', 'getTeam', 'getChannels', 'getChannel', 'getMessages', 'getMessage', 'sendMessage', 'replyToMessage', 'getMembers', 'addMember', 'getScheduledCalls', 'createOnlineMeeting', 'getChat'];

export default class MicrosoftTeamsIntegration extends IntegrationBase {
  private apiBase = 'https://graph.microsoft.com/v1.0';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = { actions: SCOPES, triggers: ['message_received', 'member_added'], dataModels: ['team', 'channel', 'message'] };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);
    try {
      const me = await this.apiCall<{ id: string }>(`${this.apiBase}/me`, { headers: { Authorization: `Bearer ${config.accessToken}` } });
      return !!me.id;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/me`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getTeams': return this.apiCall<{ value: MicrosoftTeamsTeam[] }>(`${this.apiBase}/me/joinedTeams`, { headers });
      case 'getTeam': return this.apiCall<MicrosoftTeamsTeam>(`${this.apiBase}/teams/${params.teamId}`, { headers });
      case 'getChannels': return this.apiCall<{ value: MicrosoftTeamsChannel[] }>(`${this.apiBase}/teams/${params.teamId}/channels`, { headers });
      case 'getChannel': return this.apiCall<MicrosoftTeamsChannel>(`${this.apiBase}/teams/${params.teamId}/channels/${params.channelId}`, { headers });
      case 'getMessages': return this.apiCall<{ value: MicrosoftTeamsMessage[] }>(`${this.apiBase}/teams/${params.teamId}/channels/${params.channelId}/messages`, { headers });
      case 'sendMessage': return this.apiCall<MicrosoftTeamsMessage>(`${this.apiBase}/teams/${params.teamId}/channels/${params.channelId}/messages`, { method: 'POST', headers, body: JSON.stringify({ body: { contentType: 'html', content: params.content } }) });
      case 'getMembers': return this.apiCall(`${this.apiBase}/teams/${params.teamId}/members`, { headers });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'teams': return this.executeAction('getTeams', options || {});
      case 'messages': return this.executeAction('getMessages', { teamId: options?.teamId, channelId: options?.channelId });
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createMicrosoftTeamsIntegration(): MicrosoftTeamsIntegration { return new MicrosoftTeamsIntegration(); }