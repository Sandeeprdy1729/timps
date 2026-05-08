import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface FigmaFile {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
  components: Record<string, FigmaComponent>;
  styles: Record<string, FigmaStyle>;
  schemaVersion: number;
  variantProperties?: Record<string, FigmaVariantProperty[]>;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: FigmaNodeType;
  visible?: boolean;
  locked?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: FigmaBoundingBox;
  relativeBoundingBox?: FigmaBoundingBox;
  constraints?: FigmaConstraints;
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  strokeAlign?: string;
  effects?: FigmaEffect[];
  blendMode?: string;
  opacity?: number;
  absoluteRenderBounds?: FigmaBoundingBox;
  exportSettings?: FigmaExportSetting[];
  componentId?: string;
  componentProperties?: Record<string, FigmaComponentProperty>;
  variantProperties?: Record<string, string>;
}

export type FigmaNodeType =
  | 'DOCUMENT'
  | 'CANVAS'
  | 'FRAME'
  | 'GROUP'
  | 'VECTOR'
  | 'BOOLEAN_OPERATION'
  | 'STAR'
  | 'LINE'
  | 'ELLIPSE'
  | 'REGULAR_POLYGON'
  | 'RECTANGLE'
  | 'TEXT'
  | 'SLICE'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE';

export interface FigmaBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaConstraints {
  vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
  horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
}

export interface FigmaFill {
  type: FigmaFillType;
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
  gradientHandlePositions?: FigmaVector[];
  gradientStops?: FigmaColorStop[];
  scaleMode?: 'FILL' | 'FIT';
  imageRef?: string;
  filters?: FigmaImageFilters;
}

export type FigmaFillType =
  | 'SOLID'
  | 'GRADIENT_LINEAR'
  | 'GRADIENT_RADIAL'
  | 'GRADIENT_ANGULAR'
  | 'GRADIENT_DIAMOND'
  | 'IMAGE'
  | 'EMOJI';

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaVector {
  x: number;
  y: number;
}

export interface FigmaColorStop {
  position: number;
  color: FigmaColor;
}

export interface FigmaImageFilters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

export interface FigmaStroke {
  type: string;
  color?: FigmaColor;
  opacity?: number;
  visible?: boolean;
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible?: boolean;
  radius: number;
  color?: FigmaColor;
  offset?: FigmaVector;
  spread?: number;
}

export interface FigmaExportSetting {
  format: 'PNG' | 'JPG' | 'SVG' | 'PDF';
  suffix?: string;
  constraint?: FigmaConstraint;
}

export interface FigmaConstraint {
  type: 'SCALE' | 'WIDTH' | 'HEIGHT';
  value: number;
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
  documentationLinks?: string[];
  remote?: boolean;
  keyTokenId?: string;
}

export interface FigmaComponentProperty {
  type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT';
  value: string | boolean;
  preferredValues?: FigmaComponentPropertyValue[];
}

export interface FigmaComponentPropertyValue {
  type: 'COMPONENT' | 'COMPONENT_SET';
  key: string;
}

export interface FigmaVariantProperty {
  name: string;
  propertyType: { type: 'VARIANT' };
  values: string[];
}

export interface FigmaStyle {
  key: string;
  name: string;
  styleType: FigmaStyleType;
  description: string;
}

export type FigmaStyleType =
  | 'FILL'
  | 'TEXT'
  | 'EFFECT'
  | 'GRID';

export interface FigmaComment {
  id: string;
  message: string;
  createdAt: string;
  resolvedAt?: string;
  user: FigmaUser;
  clientMeta?: FigmaClientMeta;
  reactions?: FigmaReaction[];
  parentId?: string;
  replies?: FigmaComment[];
}

export interface FigmaUser {
  id: string;
  handle: string;
  email: string;
  imgUrl: string;
}

export interface FigmaClientMeta {
  x?: number;
  y?: number;
  nodeId?: string;
  nodeOffset?: FigmaVector;
  fileKey?: string;
  componentId?: string;
}

export interface FigmaReaction {
  userId: string;
  emoji: string;
}

export interface FigmaProject {
  id: string;
  name: string;
  files?: FigmaFileMeta[];
}

export interface FigmaFileMeta {
  key: string;
  name: string;
  thumbnailUrl: string;
  lastModified: string;
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
  projects?: FigmaProject[];
  members?: FigmaTeamMember[];
}

export interface FigmaTeamMember {
  id: string;
  handle: string;
  email: string;
  imgUrl: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER' | 'CAN_EDIT' | 'VIEW_ONLY';
  invitedAt?: string;
}

export interface FigmaVersion {
  id: string;
  createdAt: string;
  label?: string;
  description?: string;
  user: FigmaUser;
  thumbnailUrl?: string;
}

export interface FigmaWebhook {
  id: string;
  teamId: string;
  eventType: FigmaWebhookEvent;
  endpoint: string;
  payloadVersion: string;
  secret?: string;
  active: boolean;
  createdAt?: string;
}

export type FigmaWebhookEvent =
  | 'FILE_UPDATE'
  | 'LIBRARY_PUBLISH'
  | 'FILE_COMMENT';

export interface FigmaExport {
  images: Record<string, string>;
  err?: Record<string, string>;
}

export interface FigmaImageFills {
  images: Record<string, string>;
}

export interface FigmaDevResources {
  nodeId: string;
  lastModified: string;
  resources: FigmaDevResource[];
}

export interface FigmaDevResource {
  id: string;
  name: string;
  format: string;
  path: string;
  generatedAt: string;
}

export interface FigmaFileVariables {
  variables: Record<string, FigmaVariable>;
  variableCollections: Record<string, FigmaVariableCollection>;
}

export interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  description?: string;
  valuesByMode: Record<string, FigmaVariableValue>;
}

export interface FigmaVariableCollection {
  id: string;
  name: string;
  modes: Record<string, string>;
  variables: string[];
}

export interface FigmaVariableValue {
  type: string;
  value: unknown;
}

export interface FigmaPluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  keywords: string[];
  actions?: Array<{ id: string; name: string; description: string }>;
  triggers?: Array<{ id: string; name: string; description: string }>;
  auth?: {
    type: string;
    fields: Array<{ name: string; label: string; description: string; required?: boolean }>;
  };
  settings?: Array<{ name: string; label: string; type: string; default?: unknown; options?: string[] }>;
  connectionTest?: { endpoint: string; method: string };
}

interface FigmaConfig {
  accessToken: string;
  teamId?: string;
  timeout?: number;
  maxRetries?: number;
}

export class FigmaPlugin extends IntegrationBase {
  private config: FigmaConfig;
  private apiBase: string;

  constructor() {
    super('figma', 'Figma', 'Figma integration for design files, components, styles, comments, and team collaboration');
    this.config = { accessToken: '' };
    this.apiBase = 'https://api.figma.com/v1';
  }

  setConfig(accessToken: string, teamId?: string, timeout?: number, maxRetries?: number): void {
    this.config = { accessToken, teamId, timeout, maxRetries };
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.apiBase}${endpoint}`, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Figma API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('Access token is required');
    }

    this.setConfig(config.accessToken, config.teamId as string);
    return this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    if (!this.config.accessToken) return false;

    try {
      const result = await this.makeRequest<{ id: string }>('/me');
      return !!result.id;
    } catch {
      return false;
    }
  }

  async getMe(): Promise<FigmaUser> {
    return this.makeRequest<FigmaUser>('/me');
  }

  async getFile(fileKey: string, options?: { depth?: number; geometry?: string; version?: string }): Promise<FigmaFile> {
    const params = new URLSearchParams();
    if (options?.depth) params.append('depth', options.depth.toString());
    if (options?.geometry) params.append('geometry', options.geometry);
    if (options?.version) params.append('version', options.version);

    return this.makeRequest<FigmaFile>(`/files/${fileKey}?${params}`);
  }

  async getFileNodes(fileKey: string, nodeIds: string[], options?: { depth?: number; version?: string }): Promise<{ nodes: Record<string, { document: FigmaNode }> }> {
    const params = new URLSearchParams();
    if (options?.depth) params.append('depth', options.depth.toString());
    if (options?.version) params.append('version', options.version);
    params.append('ids', nodeIds.join(','));

    return this.makeRequest<{ nodes: Record<string, { document: FigmaNode }> }>(`/files/${fileKey}/nodes?${params}`);
  }

  async getFilePages(fileKey: string): Promise<{ pages: FigmaPage[] }> {
    return this.makeRequest<{ pages: FigmaPage[] }>(`/files/${fileKey}`);
  }

  async getImages(fileKey: string, options?: {
    ids?: string[];
    scale?: number;
    format?: 'png' | 'jpg' | 'svg' | 'pdf';
    svgIncludeId?: boolean;
    svgSimplifyStroke?: boolean;
    useAbsoluteBounds?: boolean;
  }): Promise<FigmaExport> {
    const params = new URLSearchParams();
    if (options?.ids) params.append('ids', options.ids.join(','));
    if (options?.scale) params.append('scale', options.scale.toString());
    if (options?.format) params.append('format', options.format);
    if (options?.svgIncludeId !== undefined) params.append('svg_include_id', options.svgIncludeId.toString());
    if (options?.svgSimplifyStroke !== undefined) params.append('svg_simplify_stroke', options.svgSimplifyStroke.toString());
    if (options?.useAbsoluteBounds !== undefined) params.append('use_absolute_bounds', options.useAbsoluteBounds.toString());

    return this.makeRequest<FigmaExport>(`/images/${fileKey}?${params}`);
  }

  async getImageFills(fileKey: string): Promise<FigmaImageFills> {
    return this.makeRequest<FigmaImageFills>(`/images/${fileKey}/fills`);
  }

  async getComments(fileKey: string): Promise<{ comments: FigmaComment[] }> {
    return this.makeRequest<{ comments: FigmaComment[] }>(`/files/${fileKey}/comments`);
  }

  async postComment(fileKey: string, message: string, clientMeta?: FigmaClientMeta): Promise<FigmaComment> {
    const body: Record<string, unknown> = { message };
    if (clientMeta) {
      body.client_meta = clientMeta;
    }

    return this.makeRequest<FigmaComment>(`/files/${fileKey}/comments`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async deleteComment(fileKey: string, commentId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/files/${fileKey}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  async editComment(fileKey: string, commentId: string, message: string): Promise<FigmaComment> {
    return this.makeRequest<FigmaComment>(`/files/${fileKey}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ message }),
    });
  }

  async addReaction(fileKey: string, commentId: string, emoji: string): Promise<{ success: boolean }> {
    return this.makeRequest<{ success: boolean }>(`/files/${fileKey}/comments/${commentId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  async deleteReaction(fileKey: string, commentId: string, reactionId: string): Promise<{ success: boolean }> {
    return this.makeRequest<{ success: boolean }>(`/files/${fileKey}/comments/${commentId}/reactions/${reactionId}`, {
      method: 'DELETE',
    });
  }

  async getComponents(fileKey: string): Promise<{ components: Record<string, FigmaComponent> }> {
    return this.makeRequest<{ components: Record<string, FigmaComponent> }>(`/files/${fileKey}/components`);
  }

  async getComponentSets(fileKey: string): Promise<{ componentSets: Record<string, FigmaComponent> }> {
    return this.makeRequest<{ componentSets: Record<string, FigmaComponent> }>(`/files/${fileKey}/component-sets`);
  }

  async getStyles(fileKey: string): Promise<{ styles: Record<string, FigmaStyle> }> {
    return this.makeRequest<{ styles: Record<string, FigmaStyle> }>(`/files/${fileKey}/styles`);
  }

  async getVersions(fileKey: string): Promise<{ versions: FigmaVersion[] }> {
    return this.makeRequest<{ versions: FigmaVersion[] }>(`/files/${fileKey}/versions`);
  }

  async getVersion(fileKey: string, versionId: string): Promise<FigmaVersion> {
    return this.makeRequest<FigmaVersion>(`/files/${fileKey}/versions/${versionId}`);
  }

  async getProjects(teamId: string): Promise<{ projects: FigmaProject[] }> {
    return this.makeRequest<{ projects: FigmaProject[] }>(`/teams/${teamId}/projects`);
  }

  async getProjectFiles(projectId: string): Promise<{ files: FigmaFileMeta[] }> {
    return this.makeRequest<{ files: FigmaFileMeta[] }>(`/projects/${projectId}/files`);
  }

  async getTeamProjects(teamId: string): Promise<{ projects: FigmaProject[] }> {
    return this.makeRequest<{ projects: FigmaProject[] }>(`/teams/${teamId}/projects`);
  }

  async getTeamComponents(teamId: string, options?: { limit?: number }): Promise<{ components: Record<string, FigmaComponent> }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());

    return this.makeRequest<{ components: Record<string, FigmaComponent> }>(`/teams/${teamId}/components?${params}`);
  }

  async getTeamStyles(teamId: string): Promise<{ styles: Record<string, FigmaStyle> }> {
    return this.makeRequest<{ styles: Record<string, FigmaStyle> }>(`/teams/${teamId}/styles`);
  }

  async getTeamLibraries(teamId: string): Promise<{ libraries: FigmaTeamLibrary[] }> {
    return this.makeRequest<{ libraries: FigmaTeamLibrary[] }>(`/teams/${teamId}/libraries`);
  }

  async getTeamWebhooks(teamId: string): Promise<{ webhooks: FigmaWebhook[] }> {
    return this.makeRequest<{ webhooks: FigmaWebhook[] }>(`/teams/${teamId}/webhooks`);
  }

  async createWebhook(teamId: string, webhook: {
    event_type: FigmaWebhookEvent;
    endpoint: string;
    payload_version?: string;
    secret?: string;
  }): Promise<FigmaWebhook> {
    return this.makeRequest<FigmaWebhook>(`/teams/${teamId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify({
        ...webhook,
        payload_version: webhook.payload_version || '1',
      }),
    });
  }

  async updateWebhook(teamId: string, webhookId: string, updates: {
    endpoint?: string;
    event_type?: FigmaWebhookEvent;
    active?: boolean;
  }): Promise<FigmaWebhook> {
    return this.makeRequest<FigmaWebhook>(`/teams/${teamId}/webhooks/${webhookId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteWebhook(teamId: string, webhookId: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/teams/${teamId}/webhooks/${webhookId}`, {
      method: 'DELETE',
    });
  }

  async getFileWebhooks(fileKey: string): Promise<{ webhooks: FigmaWebhook[] }> {
    return this.makeRequest<{ webhooks: FigmaWebhook[] }>(`/files/${fileKey}/webhooks`);
  }

  async getFileDevResources(fileKey: string): Promise<{ resources: FigmaDevResources[] }> {
    return this.makeRequest<{ resources: FigmaDevResources[] }>(`/files/${fileKey}/dev-resources`);
  }

  async getFileVariables(fileKey: string): Promise<FigmaFileVariables> {
    return this.makeRequest<FigmaFileVariables>(`/files/${fileKey}/variables`);
  }

  async getFileLocalVariables(fileKey: string): Promise<FigmaFileVariables> {
    return this.makeRequest<FigmaFileVariables>(`/files/${fileKey}/variables/local`);
  }

  async getFileLocalStyles(fileKey: string): Promise<{ styles: Record<string, FigmaStyle> }> {
    return this.makeRequest<{ styles: Record<string, FigmaStyle> }>(`/files/${fileKey}/styles/local`);
  }

  async getTeamMembers(teamId: string): Promise<{ members: FigmaTeamMember[] }> {
    return this.makeRequest<{ members: FigmaTeamMember[] }>(`/teams/${teamId}/members`);
  }

  async getTeaminvites(teamId: string): Promise<{ invites: FigmaTeamMember[] }> {
    return this.makeRequest<{ invites: FigmaTeamMember[] }>(`/teams/${teamId}/invites`);
  }

  async exportFile(fileKey: string, nodeIds: string[], format: 'png' | 'jpg' | 'svg' | 'pdf', options?: {
    scale?: number;
    contentsOnly?: boolean;
    useAbsoluteBounds?: boolean;
  }): Promise<FigmaExport> {
    const params = new URLSearchParams({
      ids: nodeIds.join(','),
      format,
    });

    if (options?.scale) params.append('scale', options.scale.toString());
    if (options?.contentsOnly !== undefined) params.append('contents_only', options.contentsOnly.toString());
    if (options?.useAbsoluteBounds !== undefined) params.append('use_absolute_bounds', options.useAbsoluteBounds.toString());

    return this.makeRequest<FigmaExport>(`/images/${fileKey}?${params}`);
  }

  async getNodeThumbnail(fileKey: string, nodeId: string): Promise<{ imageUrl: string }> {
    return this.makeRequest<{ imageUrl: string }>(`/images/${fileKey}?ids=${nodeId}&scale=2&format=png`);
  }

  async getFrameAt(path: string, frameId: string): Promise<{ document: FigmaNode }> {
    return this.makeRequest<{ document: FigmaNode }>(`/files/${path}/frames/${frameId}`);
  }

  async getSelectedNodes(fileKey: string, selection: string[]): Promise<{ nodes: Record<string, { document: FigmaNode }> }> {
    return this.getFileNodes(fileKey, selection);
  }

  async searchFiles(query: string, teamId?: string): Promise<{ files: FigmaFileMeta[] }> {
    const params = new URLSearchParams({ query });
    if (teamId) params.append('team_id', teamId);

    return this.makeRequest<{ files: FigmaFileMeta[] }>(`/search/files?${params}`);
  }

  cleanup(): void {
    this.config = { accessToken: '' };
  }

  getManifest(): FigmaPluginManifest {
    return {
      id: 'figma',
      name: 'Figma',
      version: '2.0.0',
      description: 'Figma integration for design files, components, styles, comments, and team collaboration',
      author: 'TIMPS Team',
      main: 'figma-new.js',
      keywords: ['figma', 'design', 'ui', 'prototype', 'components', 'styles'],
      actions: [
        { id: 'get_me', name: 'Get Current User', description: 'Get current user profile' },
        { id: 'get_file', name: 'Get File', description: 'Get full file document' },
        { id: 'get_file_nodes', name: 'Get File Nodes', description: 'Get specific nodes from file' },
        { id: 'get_file_pages', name: 'Get File Pages', description: 'Get all pages in file' },
        { id: 'get_images', name: 'Get Images', description: 'Export nodes as images' },
        { id: 'get_image_fills', name: 'Get Image Fills', description: 'Get image fill references' },
        { id: 'get_comments', name: 'Get Comments', description: 'Get file comments' },
        { id: 'post_comment', name: 'Post Comment', description: 'Add a new comment' },
        { id: 'delete_comment', name: 'Delete Comment', description: 'Remove a comment' },
        { id: 'edit_comment', name: 'Edit Comment', description: 'Edit a comment' },
        { id: 'add_reaction', name: 'Add Reaction', description: 'Add emoji reaction to comment' },
        { id: 'delete_reaction', name: 'Delete Reaction', description: 'Remove reaction from comment' },
        { id: 'get_components', name: 'Get Components', description: 'Get file components' },
        { id: 'get_component_sets', name: 'Get Component Sets', description: 'Get component sets' },
        { id: 'get_styles', name: 'Get Styles', description: 'Get file styles' },
        { id: 'get_versions', name: 'Get Versions', description: 'Get file version history' },
        { id: 'get_version', name: 'Get Version', description: 'Get specific version details' },
        { id: 'get_projects', name: 'Get Projects', description: 'List team projects' },
        { id: 'get_project_files', name: 'Get Project Files', description: 'List files in project' },
        { id: 'get_team_projects', name: 'Get Team Projects', description: 'Get projects for team' },
        { id: 'get_team_components', name: 'Get Team Components', description: 'Get team library components' },
        { id: 'get_team_styles', name: 'Get Team Styles', description: 'Get team library styles' },
        { id: 'get_team_libraries', name: 'Get Team Libraries', description: 'List team libraries' },
        { id: 'get_team_webhooks', name: 'Get Team Webhooks', description: 'List team webhooks' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a new webhook' },
        { id: 'update_webhook', name: 'Update Webhook', description: 'Update webhook configuration' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Remove a webhook' },
        { id: 'get_file_webhooks', name: 'Get File Webhooks', description: 'List file webhooks' },
        { id: 'get_file_dev_resources', name: 'Get Dev Resources', description: 'Get developer resources' },
        { id: 'get_file_variables', name: 'Get Variables', description: 'Get file variables' },
        { id: 'get_file_local_variables', name: 'Get Local Variables', description: 'Get local variables' },
        { id: 'get_file_local_styles', name: 'Get Local Styles', description: 'Get local styles' },
        { id: 'get_team_members', name: 'Get Team Members', description: 'List team members' },
        { id: 'get_team_invites', name: 'Get Team Invites', description: 'List pending invites' },
        { id: 'export_file', name: 'Export File', description: 'Export nodes as images' },
        { id: 'get_node_thumbnail', name: 'Get Node Thumbnail', description: 'Get thumbnail for node' },
        { id: 'search_files', name: 'Search Files', description: 'Search across files' },
        { id: 'test_connection', name: 'Test Connection', description: 'Test Figma connection' },
      ],
      triggers: [
        { id: 'file_updated', name: 'File Updated', description: 'Triggered when file is updated' },
        { id: 'comment_created', name: 'Comment Created', description: 'Triggered when new comment is added' },
        { id: 'comment_deleted', name: 'Comment Deleted', description: 'Triggered when comment is removed' },
        { id: 'library_published', name: 'Library Published', description: 'Triggered when design library is published' },
        { id: 'webhook_triggered', name: 'Webhook Triggered', description: 'Triggered by webhook event' },
      ],
      auth: {
        type: 'bearer',
        fields: [
          { name: 'accessToken', label: 'Access Token', description: 'Your Figma access token', required: true },
          { name: 'teamId', label: 'Team ID', description: 'Optional team ID', required: false },
        ],
      },
      settings: [
        { name: 'timeout', label: 'Request Timeout', type: 'number', default: 30000 },
        { name: 'maxRetries', label: 'Max Retries', type: 'number', default: 3 },
      ],
      connectionTest: { endpoint: '/me', method: 'GET' },
    };
  }

  executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
    switch (action) {
      case 'get_me':
        return this.getMe();
      case 'get_file':
        return this.getFile(params.fileKey as string, params as any);
      case 'get_file_nodes':
        return this.getFileNodes(params.fileKey as string, params.nodeIds as string[], params as any);
      case 'get_file_pages':
        return this.getFilePages(params.fileKey as string);
      case 'get_images':
        return this.getImages(params.fileKey as string, params as any);
      case 'get_image_fills':
        return this.getImageFills(params.fileKey as string);
      case 'get_comments':
        return this.getComments(params.fileKey as string);
      case 'post_comment':
        return this.postComment(params.fileKey as string, params.message as string, params.clientMeta as any);
      case 'delete_comment':
        return this.deleteComment(params.fileKey as string, params.commentId as string);
      case 'edit_comment':
        return this.editComment(params.fileKey as string, params.commentId as string, params.message as string);
      case 'add_reaction':
        return this.addReaction(params.fileKey as string, params.commentId as string, params.emoji as string);
      case 'delete_reaction':
        return this.deleteReaction(params.fileKey as string, params.commentId as string, params.reactionId as string);
      case 'get_components':
        return this.getComponents(params.fileKey as string);
      case 'get_component_sets':
        return this.getComponentSets(params.fileKey as string);
      case 'get_styles':
        return this.getStyles(params.fileKey as string);
      case 'get_versions':
        return this.getVersions(params.fileKey as string);
      case 'get_version':
        return this.getVersion(params.fileKey as string, params.versionId as string);
      case 'get_projects':
        return this.getProjects(params.teamId as string);
      case 'get_project_files':
        return this.getProjectFiles(params.projectId as string);
      case 'get_team_projects':
        return this.getTeamProjects(params.teamId as string);
      case 'get_team_components':
        return this.getTeamComponents(params.teamId as string, params as any);
      case 'get_team_styles':
        return this.getTeamStyles(params.teamId as string);
      case 'get_team_libraries':
        return this.getTeamLibraries(params.teamId as string);
      case 'get_team_webhooks':
        return this.getTeamWebhooks(params.teamId as string);
      case 'create_webhook':
        return this.createWebhook(params.teamId as string, params as any);
      case 'update_webhook':
        return this.updateWebhook(params.teamId as string, params.webhookId as string, params as any);
      case 'delete_webhook':
        return this.deleteWebhook(params.teamId as string, params.webhookId as string);
      case 'get_file_webhooks':
        return this.getFileWebhooks(params.fileKey as string);
      case 'get_file_dev_resources':
        return this.getFileDevResources(params.fileKey as string);
      case 'get_file_variables':
        return this.getFileVariables(params.fileKey as string);
      case 'get_file_local_variables':
        return this.getFileLocalVariables(params.fileKey as string);
      case 'get_file_local_styles':
        return this.getFileLocalStyles(params.fileKey as string);
      case 'get_team_members':
        return this.getTeamMembers(params.teamId as string);
      case 'get_team_invites':
        return this.getTeaminvites(params.teamId as string);
      case 'export_file':
        return this.exportFile(params.fileKey as string, params.nodeIds as string[], params.format as any, params as any);
      case 'get_node_thumbnail':
        return this.getNodeThumbnail(params.fileKey as string, params.nodeId as string);
      case 'search_files':
        return this.searchFiles(params.query as string, params.teamId as string);
      case 'test_connection':
        return this.testConnection();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'me':
        return this.getMe();
      case 'file':
        return this.getFile(options?.fileKey as string, options as any);
      case 'files':
        return this.getFilePages(options?.fileKey as string);
      case 'comments':
        return this.getComments(options?.fileKey as string);
      case 'components':
        return this.getComponents(options?.fileKey as string);
      case 'component-sets':
        return this.getComponentSets(options?.fileKey as string);
      case 'styles':
        return this.getStyles(options?.fileKey as string);
      case 'versions':
        return this.getVersions(options?.fileKey as string);
      case 'projects':
        return this.getProjects(options?.teamId as string);
      case 'project-files':
        return this.getProjectFiles(options?.projectId as string);
      case 'team-components':
        return this.getTeamComponents(options?.teamId as string, options as any);
      case 'team-styles':
        return this.getTeamStyles(options?.teamId as string);
      case 'team-libraries':
        return this.getTeamLibraries(options?.teamId as string);
      case 'team-webhooks':
        return this.getTeamWebhooks(options?.teamId as string);
      case 'team-members':
        return this.getTeamMembers(options?.teamId as string);
      case 'team-invites':
        return this.getTeaminvites(options?.teamId as string);
      case 'variables':
        return this.getFileVariables(options?.fileKey as string);
      case 'local-variables':
        return this.getFileLocalVariables(options?.fileKey as string);
      case 'local-styles':
        return this.getFileLocalStyles(options?.fileKey as string);
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
}

export const figmaPlugin = new FigmaPlugin();

interface FigmaTeamLibrary {
  id: string;
  name: string;
  publishedAt: string;
  updatedAt: string;
}