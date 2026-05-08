import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface FigmaFile {
  key: string;
  name: string;
  thumbnail_url: string;
  description: string;
  last_modified: string;
  version: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  locked?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  relativeBoundingBox?: { x: number; y: number; width: number; height: number };
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  effects?: FigmaEffect[];
  constraints?: { vertical: string; horizontal: string };
  blendMode?: string;
  opacity?: number;
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number };
}

export interface FigmaFill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE' | 'EMOJI';
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a: number };
  gradientHandlePositions?: Array<{ x: number; y: number }>;
  gradientStops?: Array<{ position: number; color: { r: number; g: number; b: number; a: number } }>;
}

export interface FigmaStroke {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible?: boolean;
  radius: number;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
  documentationLinks?: string[];
}

export interface FigmaStyle {
  key: string;
  name: string;
  styleType: string;
  description: string;
}

export interface FigmaComment {
  id: string;
  message: string;
  created_at: string;
  resolved_at?: string;
  user: FigmaUser;
  client_meta?: { x: number; y: number; node_id?: string; node_offset?: { x: number; y: number } };
}

export interface FigmaUser {
  id: string;
  handle: string;
  email: string;
  img_url: string;
}

export interface FigmaProject {
  id: string;
  name: string;
  pages: FigmaPage[];
}

export interface FigmaPage {
  id: string;
  name: string;
  document: FigmaNode;
}

export interface FigmaTeam {
  id: string;
  name: string;
  handle: string;
}

export interface FigmaVersion {
  id: string;
  created_at: string;
  label?: string;
  description?: string;
  user: FigmaUser;
}

export interface FigmaWebhook {
  id: string;
  team_id: string;
  event_type: string;
  endpoint: string;
  payload_version: string;
  secret?: string;
  active?: boolean;
}

const MANIFEST: PluginManifest = {
  id: 'figma',
  name: 'Figma',
  version: '1.0.0',
  description: 'Figma integration for file management, components, and design collaboration',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['figma', 'design', 'ui', 'prototype'],
};

const SCOPES = [
  'getFile',
  'getFiles',
  'getFileNodes',
  'getImages',
  'getImageFills',
  'getComments',
  'postComment',
  'deleteComment',
  'getComponents',
  'getStyles',
  'getVersions',
  'getVersion',
  'getProjects',
  'getProjectFiles',
  'getTeamProjects',
  'getTeamComponents',
  'getTeamStyles',
  'getMe',
  'getTeamWebhooks',
  'createWebhook',
  'deleteWebhook',
  'getFileWebhooks',
  'triggerWebhook',
];

export default class FigmaIntegration extends IntegrationBase {
  private apiBase = 'https://api.figma.com/v1';
  private teamId: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['file_updated', 'comment_created', 'comment_deleted', 'library_published'],
      dataModels: ['file', 'node', 'component', 'style', 'comment', 'version', 'project'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('Figma access token is required');
    }
    this.setAccessToken(config.accessToken);

    try {
      const me = await this.apiCall<FigmaUser>(`${this.apiBase}/me`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return !!me.id;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/me`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.accessToken) throw new Error('Not authenticated');

    const headers = { Authorization: `Bearer ${this.accessToken}` };

    switch (action) {
      case 'getFile':
        return this.apiCall<FigmaFile>(`${this.apiBase}/files/${params.fileKey}`, { headers });

      case 'getFileNodes':
        return this.apiCall<{ nodes: Record<string, { document: FigmaNode }> }>(
          `${this.apiBase}/files/${params.fileKey}/nodes`,
          {
            method: 'GET',
            headers,
          }
        );

      case 'getImages':
        return this.apiCall<{ images: Record<string, string> }>(
          `${this.apiBase}/images/${params.fileKey}`,
          {
            method: 'GET',
            headers,
          }
        );

      case 'getImageFills':
        return this.apiCall<{ images: Record<string, string> }>(
          `${this.apiBase}/images/${params.fileKey}/fills`,
          { headers }
        );

      case 'getComments':
        return this.apiCall<{ comments: FigmaComment[] }>(`${this.apiBase}/files/${params.fileKey}/comments`, {
          headers,
        });

      case 'postComment':
        return this.apiCall<FigmaComment>(`${this.apiBase}/files/${params.fileKey}/comments`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: params.message,
            client_meta: params.clientMeta,
          }),
        });

      case 'deleteComment':
        return this.apiCall<{ message: string }>(
          `${this.apiBase}/files/${params.fileKey}/comments/${params.commentId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getComponents':
        return this.apiCall<{ components: Record<string, FigmaComponent> }>(
          `${this.apiBase}/files/${params.fileKey}/components`,
          { headers }
        );

      case 'getStyles':
        return this.apiCall<{ styles: Record<string, FigmaStyle> }>(
          `${this.apiBase}/files/${params.fileKey}/styles`,
          { headers }
        );

      case 'getVersions':
        return this.apiCall<{ versions: FigmaVersion[] }>(
          `${this.apiBase}/files/${params.fileKey}/versions`,
          { headers }
        );

      case 'getVersion':
        return this.apiCall<FigmaVersion>(
          `${this.apiBase}/files/${params.fileKey}/versions/${params.versionId}`,
          { headers }
        );

      case 'getProjects':
        return this.apiCall<{ projects: FigmaProject[] }>(`${this.apiBase}/teams/${params.teamId}/projects`, {
          headers,
        });

      case 'getProjectFiles':
        return this.apiCall<{ files: FigmaFile[] }>(
          `${this.apiBase}/projects/${params.projectId}/files`,
          { headers }
        );

      case 'getTeamProjects':
        return this.apiCall<{ projects: FigmaProject[] }>(
          `${this.apiBase}/teams/${params.teamId}/projects`,
          { headers }
        );

      case 'getTeamComponents':
        return this.apiCall<{ components: Record<string, FigmaComponent> }>(
          `${this.apiBase}/teams/${params.teamId}/components`,
          { headers }
        );

      case 'getTeamStyles':
        return this.apiCall<{ styles: Record<string, FigmaStyle> }>(
          `${this.apiBase}/teams/${params.teamId}/styles`,
          { headers }
        );

      case 'getMe':
        return this.apiCall<FigmaUser>(`${this.apiBase}/me`, { headers });

      case 'getTeamWebhooks':
        return this.apiCall<{ webhooks: FigmaWebhook[] }>(
          `${this.apiBase}/teams/${params.teamId}/webhooks`,
          { headers }
        );

      case 'createWebhook':
        return this.apiCall<FigmaWebhook>(`${this.apiBase}/teams/${params.teamId}/webhooks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            event_type: params.eventType,
            endpoint: params.endpoint,
            payload_version: '1',
            secret: params.secret,
          }),
        });

      case 'deleteWebhook':
        return this.apiCall<{ message: string }>(
          `${this.apiBase}/teams/${params.teamId}/webhooks/${params.webhookId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'file':
        return this.executeAction('getFile', { fileKey: options?.fileKey });
      case 'comments':
        return this.executeAction('getComments', { fileKey: options?.fileKey });
      case 'components':
        return this.executeAction('getComponents', { fileKey: options?.fileKey });
      case 'styles':
        return this.executeAction('getStyles', { fileKey: options?.fileKey });
      case 'versions':
        return this.executeAction('getVersions', { fileKey: options?.fileKey });
      case 'projects':
        return this.executeAction('getProjects', { teamId: options?.teamId });
      case 'me':
        return this.executeAction('getMe', options || {});
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.teamId = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createFigmaIntegration(): FigmaIntegration {
  return new FigmaIntegration();
}