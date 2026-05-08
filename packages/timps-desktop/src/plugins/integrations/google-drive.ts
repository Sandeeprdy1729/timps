import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  shared: boolean;
  webViewLink: string;
  iconLink: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
}

export interface GoogleDrivePermission {
  id: string;
  type: string;
  role: string;
  emailAddress?: string;
}

const MANIFEST: PluginManifest = {
  id: 'google-drive',
  name: 'Google Drive',
  version: '1.0.0',
  description: 'Google Drive file storage and sharing integration',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['google', 'drive', 'storage', 'files'],
};

const SCOPES = ['getFiles', 'getFile', 'createFile', 'updateFile', 'deleteFile', 'copyFile', 'getPermissions', 'createPermission', 'deletePermission', 'getRevisions', 'getComments', 'createComment', 'getReplies', 'createReply', 'watchFile', 'stopWatch', 'exportFile', 'emptyTrash', 'getTrash'];

export default class GoogleDriveIntegration extends IntegrationBase {
  private apiBase = 'https://www.googleapis.com/drive/v3';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = { actions: SCOPES, triggers: ['file_created', 'file_modified', 'file_deleted'], dataModels: ['file', 'permission', 'revision'] };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);
    try {
      const about = await this.apiCall<{ user: { permissionId: string } }>(`${this.apiBase}/about?fields=user`, { headers: { Authorization: `Bearer ${config.accessToken}` } });
      return !!about.user?.permissionId;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/about?fields=user`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getFiles': return this.apiCall<{ files: GoogleDriveFile[] }>(`${this.apiBase}/files?${params.q ? `q=${params.q}` : ''}&pageSize=${params.pageSize || 100}`, { headers });
      case 'getFile': return this.apiCall<GoogleDriveFile>(`${this.apiBase}/files/${params.fileId}`, { headers });
      case 'createFile': return this.apiCall<{ files: GoogleDriveFile }>(`${this.apiBase}/files`, { method: 'POST', headers: { ...headers, 'Content-Type': 'multipart/related' }, body: params.multipart as string });
      case 'updateFile': return this.apiCall<GoogleDriveFile>(`${this.apiBase}/files/${params.fileId}?uploadType=multipart`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'multipart/related' }, body: params.multipart as string });
      case 'deleteFile': return this.apiCall(`${this.apiBase}/files/${params.fileId}`, { method: 'DELETE', headers });
      case 'copyFile': return this.apiCall<GoogleDriveFile>(`${this.apiBase}/files/${params.fileId}/copy`, { method: 'POST', headers, body: JSON.stringify({ name: params.name }) });
      case 'getPermissions': return this.apiCall<{ permissions: GoogleDrivePermission[] }>(`${this.apiBase}/files/${params.fileId}/permissions`, { headers });
      case 'createPermission': return this.apiCall<GoogleDrivePermission>(`${this.apiBase}/files/${params.fileId}/permissions`, { method: 'POST', headers, body: JSON.stringify(params.permission) });
      case 'deletePermission': return this.apiCall(`${this.apiBase}/files/${params.fileId}/permissions/${params.permissionId}`, { method: 'DELETE', headers });
      case 'getRevisions': return this.apiCall(`${this.apiBase}/files/${params.fileId}/revisions`, { headers });
      case 'exportFile': return this.apiCall(`${this.apiBase}/files/${params.fileId}/export?mimeType=${params.mimeType}`, { headers });
      case 'getTrash': return this.apiCall<{ files: GoogleDriveFile[] }>(`${this.apiBase}/files/trashed`, { headers });
      case 'emptyTrash': return this.apiCall(`${this.apiBase}/files/trash`, { method: 'DELETE', headers });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'files': return this.executeAction('getFiles', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createGoogleDriveIntegration(): GoogleDriveIntegration { return new GoogleDriveIntegration(); }