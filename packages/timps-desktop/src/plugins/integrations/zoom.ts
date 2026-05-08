import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface ZoomMeeting {
  id: number;
  uuid: string;
  topic: string;
  type: number;
  status: string;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  join_url: string;
  start_url: string;
}

export interface ZoomParticipant {
  id: number;
  name: string;
  email: string;
  join_time: string;
  leave_time: string;
  duration: number;
}

export interface ZoomRecording {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: string;
  file_size: number;
  play_url: string;
  download_url: string;
}

export interface ZoomUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  type: number;
  verified: number;
}

const MANIFEST: PluginManifest = {
  id: 'zoom',
  name: 'Zoom',
  version: '1.0.0',
  description: 'Zoom video conferencing integration for meetings and recordings',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['zoom', 'video', 'conference', 'meeting'],
};

const SCOPES = [
  'getMeetings', 'getMeeting', 'createMeeting', 'updateMeeting', 'deleteMeeting', 'getMeetingRecordings',
  'getParticipants', 'getParticipant', 'getMeetingParticipants',
  'createUser', 'getUsers', 'getUser', 'updateUser', 'deleteUser',
  'getRecordings', 'deleteRecording', 'getRecordingSettings',
  'getWebhooks', 'createWebhook', 'updateWebhook', 'deleteWebhook',
  'getIMChat', 'getChatMessages', 'createChatMessage',
  'getReport', 'getMeetingReport',
  'getDashboard', 'getDashboardMetrics',
];

export default class ZoomIntegration extends IntegrationBase {
  private apiBase = 'https://api.zoom.us/v2';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['meeting_started', 'meeting_ended', 'participant_joined', 'recording_completed'],
      dataModels: ['meeting', 'participant', 'recording', 'user'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);
    try {
      const user = await this.apiCall<{ id: string }>(`${this.apiBase}/users/me`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return !!user.id;
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
      case 'getMeetings': return this.apiCall<{ meetings: ZoomMeeting[] }>(`${this.apiBase}/users/me/meetings`, { headers });
      case 'getMeeting': return this.apiCall<ZoomMeeting>(`${this.apiBase}/meetings/${params.meetingId}`, { headers });
      case 'createMeeting': return this.apiCall<ZoomMeeting>(`${this.apiBase}/users/me/meetings`, { method: 'POST', headers, body: JSON.stringify(params.meeting) });
      case 'updateMeeting': return this.apiCall(`${this.apiBase}/meetings/${params.meetingId}`, { method: 'PATCH', headers, body: JSON.stringify(params.updates) });
      case 'deleteMeeting': return this.apiCall(`${this.apiBase}/meetings/${params.meetingId}`, { method: 'DELETE', headers });
      case 'getParticipants': return this.apiCall<{ participants: ZoomParticipant[] }>(`${this.apiBase}/metrics/meetings/${params.meetingId}/participants`, { headers });
      case 'getRecordings': return this.apiCall<{ meetings: ZoomRecording[] }>(`${this.apiBase}/users/me/recordings`, { headers });
      case 'deleteRecording': return this.apiCall(`${this.apiBase}/meetings/${params.meetingId}/recordings`, { method: 'DELETE', headers });
      case 'getUsers': return this.apiCall<{ users: ZoomUser[] }>(`${this.apiBase}/users`, { headers });
      case 'getUser': return this.apiCall<ZoomUser>(`${this.apiBase}/users/${params.userId}`, { headers });
      case 'createUser': return this.apiCall<ZoomUser>(`${this.apiBase}/users`, { method: 'POST', headers, body: JSON.stringify(params.user) });
      case 'getReport': return this.apiCall(`${this.apiBase}/report/meetings/${params.meetingId}`, { headers });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'meetings': return this.executeAction('getMeetings', options || {});
      case 'users': return this.executeAction('getUsers', options || {});
      case 'recordings': return this.executeAction('getRecordings', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createZoomIntegration(): ZoomIntegration { return new ZoomIntegration(); }