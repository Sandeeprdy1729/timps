import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface DropboxFile {
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  client_modified: string;
  server_modified: string;
  size: number;
  is_downloadable: boolean;
  has_explicit_shared_members: boolean;
  content_hash: string;
}

export interface DropboxFolder {
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  sharing_info?: { parent_shared_folder_id: string };
}

export interface DropboxMember {
  id: string;
  email: string;
  status?: { '.tag': string };
  member_type?: { '.tag': string };
}

export interface DropboxSharedFolder {
  id: string;
  name: string;
  path_lower: string;
  shared_folder_id: string;
  access_type?: { '.tag': string };
}

export interface DropboxWebhook {
  id: string;
  url: string;
  expires: number;
}

export interface DropboxRevisions {
  entries: Array<{ id: string; server_modified: string; rev: string }>;
}

export interface DropboxSearchResult {
  matches: Array<{ metadata: { '.tag': string; metadata: DropboxFile } }>;
  has_more: boolean;
}

export interface DropboxTemplate {
  template_id: string;
  name: string;
  description?: string;
}

const MANIFEST: PluginManifest = {
  id: 'dropbox',
  name: 'Dropbox',
  version: '1.0.0',
  description: 'Dropbox integration for file storage, sharing, and collaboration',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['dropbox', 'cloud', 'storage', 'files'],
};

const SCOPES = [
  'getFiles', 'getFile', 'uploadFile', 'uploadFiles', 'deleteFile', 'moveFile', 'copyFile', 'getMetadata',
  'getTemporaryLink', 'getThumbnail', 'createFolder', 'deleteFolder', 'listFolder',
  'listFolders', 'searchFiles', 'getRevisions', 'restoreFile', 'getSharing',
  'createSharedLink', 'getSharedLinks', 'removeSharedLink', 'getFileMembers', 'addFileMembers',
  'removeFileMember', 'createSharedFolder', 'shareFolder', 'unshareFolder',
  'getTemplate', 'getTemplates', 'addFileTemplate', 'getWebhooks', 'createWebhook',
  'getSpaceUsage', 'getCurrentAccount', 'getAccounts', 'createFolderSync',
  'listFileMembers', 'modifySharedLink', 'getSharedLinkMetadata', 'getUploadedChunks',
  'checkForChanges', 'getChanges', 'getDelta', 'getRecentFiles',
];

export default class DropboxIntegration extends IntegrationBase {
  private apiBase = 'https://api.dropboxapi.com/2';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['file_added', 'file_deleted', 'file_modified', 'folder_created', 'shared_folder_created'],
      dataModels: ['file', 'folder', 'shared_folder', 'member', 'template'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);
    try {
      const account = await this.apiCall<{ account_id: string }>(`${this.apiBase}/users/get_current_account`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return !!account.account_id;
    } catch { return false; }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/users/get_current_account`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
      return true;
    } catch { return false; }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');
    const headers = { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' };

    switch (action) {
      case 'getFiles': return this.apiCall<{ entries: (DropboxFile | DropboxFolder)[] }>(`${this.apiBase}/files/list_folder`, { method: 'POST', headers, body: JSON.stringify({ path: params.path || '' }) });
      case 'getFile': return this.apiCall<DropboxFile>(`${this.apiBase}/files/get_metadata`, { method: 'POST', headers, body: JSON.stringify({ path: params.path }) });
      case 'uploadFile': return this.apiCall<DropboxFile>(`${this.apiBase}/files/upload`, { method: 'POST', headers, body: JSON.stringify({ path: params.path, contents: params.contents, mode: params.mode }) });
      case 'deleteFile': return this.apiCall(`${this.apiBase}/files/delete_v2`, { method: 'POST', headers, body: JSON.stringify({ path: params.path }) });
      case 'moveFile': return this.apiCall(`${this.apiBase}/files/move_v2`, { method: 'POST', headers, body: JSON.stringify({ from_path: params.fromPath, to_path: params.toPath }) });
      case 'copyFile': return this.apiCall(`${this.apiBase}/files/copy_v2`, { method: 'POST', headers, body: JSON.stringify({ from_path: params.fromPath, to_path: params.toPath }) });
      case 'createFolder': return this.apiCall<DropboxFolder>(`${this.apiBase}/files/create_folder_v2`, { method: 'POST', headers, body: JSON.stringify({ path: params.path }) });
      case 'deleteFolder': return this.apiCall(`${this.apiBase}/files/delete_v2`, { method: 'POST', headers, body: JSON.stringify({ path: params.path }) });
      case 'getTemporaryLink': return this.apiCall<{ link: string }>(`${this.apiBase}/files/get_temporary_link`, { method: 'POST', headers, body: JSON.stringify({ path: params.path }) });
      case 'getThumbnail': return this.apiCall(`${this.apiBase}/files/get_thumbnail_batch`, { method: 'POST', headers, body: JSON.stringify({ entries: params.entries }) });
      case 'searchFiles': return this.apiCall<DropboxSearchResult>(`${this.apiBase}/files/search_v2`, { method: 'POST', headers, body: JSON.stringify({ query: params.query }) });
      case 'getRevisions': return this.apiCall<DropboxRevisions>(`${this.apiBase}/files/list_revisions`, { method: 'POST', headers, body: JSON.stringify({ path: params.path }) });
      case 'restoreFile': return this.apiCall<DropboxFile>(`${this.apiBase}/files/restore`, { method: 'POST', headers, body: JSON.stringify({ path: params.path, rev: params.rev }) });
      case 'createSharedLink': return this.apiCall(`${this.apiBase}/sharing/create_shared_link_with_settings`, { method: 'POST', headers, body: JSON.stringify({ path: params.path }) });
      case 'getSharedLinks': return this.apiCall<{ links: DropboxSharedFolder[] }>(`${this.apiBase}/sharing/list_shared_links`, { method: 'POST', headers });
      case 'getFileMembers': return this.apiCall<{ members: DropboxMember[] }>(`${this.apiBase}/sharing/list_file_members`, { method: 'POST', headers, body: JSON.stringify({ file: params.path }) });
      case 'addFileMembers': return this.apiCall(`${this.apiBase}/sharing/add_file_member`, { method: 'POST', headers, body: JSON.stringify({ file: params.path, members: params.members }) });
      case 'createSharedFolder': return this.apiCall<DropboxSharedFolder>(`${this.apiBase}/sharing/share_folder`, { method: 'POST', headers, body: JSON.stringify({ path: params.path }) });
      case 'getSharing': return this.apiCall(`${this.apiBase}/sharing/get_folder_metadata`, { method: 'POST', headers, body: JSON.stringify({ shared_folder_id: params.folderId }) });
      case 'getSpaceUsage': return this.apiCall(`${this.apiBase}/users/get_space_usage`, { method: 'POST', headers });
      case 'getCurrentAccount': return this.apiCall(`${this.apiBase}/users/get_current_account`, { method: 'POST', headers });
      case 'getAccounts': return this.apiCall(`${this.apiBase}/users/get_account_batch`, { method: 'POST', headers, body: JSON.stringify({ account_ids: params.ids }) });
      case 'getTemplate': return this.apiCall<DropboxTemplate>(`${this.apiBase}/file_properties/templates/get_for_user`, { method: 'POST', headers });
      case 'getTemplates': return this.apiCall<{ templates: DropboxTemplate[] }>(`${this.apiBase}/file_properties/templates/list_for_user`, { method: 'POST', headers });
      case 'getWebhooks': return this.apiCall(`${this.apiBase}/webhooks/notifications`, { method: 'GET', headers });
      case 'getDelta': return this.apiCall(`${this.apiBase}/files/list_folder/continue`, { method: 'POST', headers, body: JSON.stringify({ cursor: params.cursor }) });
      case 'getRecentFiles': return this.apiCall(`${this.apiBase}/files/list_recent_v2`, { method: 'POST', headers });
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'files': return this.executeAction('getFiles', options || {});
      case 'folders': return this.executeAction('listFolders', options || {});
      default: throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> { this.accessToken = null; }
  static getManifest(): PluginManifest { return MANIFEST; }
}

export function createDropboxIntegration(): DropboxIntegration { return new DropboxIntegration(); }