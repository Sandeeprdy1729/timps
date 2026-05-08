import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface TypeformResponse {
  response_id: string;
  landed_at: string;
  submitted_at: string | null;
  definition_id: string;
  form_response: {
    form_id: string;
    token: string;
    landed_at: string;
    submitted_at: string | null;
    hidden: Record<string, string>;
    calculated: { score: number };
    definition: {
      id: string;
      title: string;
      fields: TypeformField[];
      hidden: string[];
    };
    answers: TypeformAnswer[];
  };
}

export interface TypeformField {
  id: string;
  ref: string;
  title: string;
  type: 'text' | 'email' | 'url' | 'file_upload' | 'phone_number' | 'number' | 'boolean' | 'choice' | 'choices' | 'dropdown' | 'multiple_choice' | 'matrix' | 'rating' | 'date' | 'statement';
  description?: string;
  properties?: Record<string, unknown>;
  ref?: string;
  validations?: { required: boolean; min?: number; max?: number; min_length?: number; max_length?: number; pattern?: string };
}

export interface TypeformAnswer {
  field: { id: string; type: string; ref: string };
  type: 'text' | 'email' | 'url' | 'file_url' | 'phone_number' | 'number' | 'boolean' | 'choice' | 'choices' | 'dropdown' | 'multiple_choice' | 'date' | 'boolean' | 'number' | 'rating' | 'array';
  text?: string;
  email?: string;
  url?: string;
  file_url?: string;
  number?: number;
  boolean?: boolean;
  choice?: { label: string };
  choices?: { labels: string[] };
  dropdown?: { label: string };
  date?: { month: string; day: string; year: string };
  array?: { labels: string[] };
}

export interface TypeformForm {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_updated_at: string;
  fields: TypeformField[];
  hidden?: string[];
  settings?: {
    language?: string;
    progress_bar?: boolean;
    show_progress_bar?: boolean;
    show_time_spent?: boolean;
    show_typeform_branding?: boolean;
    allow_view_submissions?: boolean;
    block_same_response?: boolean;
    captcha_enabled?: boolean;
    limit_response_number?: number;
    shuffle_questions?: boolean;
    show_question_number?: boolean;
    metadata?: Record<string, unknown>;
  };
}

export interface TypeformWorkspace {
  id: string;
  name: string;
  created_at: string;
  created_by: TypeformUser;
}

export interface TypeformUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface TypeformImage {
  id: string;
  href: string;
  created_at: string;
}

export interface TypeformTheme {
  id: string;
  name: string;
  colors?: Record<string, string>;
  uploaded_at?: string;
  visibility?: 'private' | 'public';
  last_updated_at?: string;
}

export interface TypeformWebhook {
  id: string;
  url: string;
  enabled: boolean;
  created_at: string;
  verified_at?: string;
}

export interface TypeformWebhookPayload {
  event_id: string;
  event_type: 'form_response';
  form_response: TypeformResponse;
}

const MANIFEST: PluginManifest = {
  id: 'typeform',
  name: 'Typeform',
  version: '1.0.0',
  description: 'Typeform integration for creating forms, managing responses, and webhooks',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['typeform', 'forms', 'survey', 'webhook'],
};

const SCOPES = [
  'createForm',
  'updateForm',
  'deleteForm',
  'getForm',
  'listForms',
  'getResponses',
  'getResponse',
  'getResponsesById',
  'createWorkspace',
  'listWorkspaces',
  'getWorkspace',
  'createImage',
  'deleteImage',
  'createTheme',
  'updateTheme',
  'deleteTheme',
  'getThemes',
  'createWebhook',
  'updateWebhook',
  'deleteWebhook',
  'listWebhooks',
  'verifyWebhook',
  'getSettings',
  'updateSettings',
  'getUser',
  'getUserInfo',
];

export default class TypeformIntegration extends IntegrationBase {
  private apiBase = 'https://api.typeform.com';
  private workspaceId: string | null = null;

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['form_response', 'form_created', 'form_updated', 'form_deleted'],
      dataModels: ['form', 'response', 'workspace', 'theme', 'webhook'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) {
      throw new Error('Access token is required');
    }
    this.setAccessToken(config.accessToken);

    try {
      const user = await this.apiCall<TypeformUser>(`${this.apiBase}/me`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return !!user.id;
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

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (action) {
      case 'createForm':
        return this.apiCall<TypeformForm>(`${this.apiBase}/forms`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: params.title,
            fields: params.fields,
            hidden: params.hidden,
            settings: params.settings,
            theme: params.theme,
            workspace: params.workspace,
          }),
        });

      case 'updateForm':
        return this.apiCall<TypeformForm>(`${this.apiBase}/forms/${params.formId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteForm':
        return this.apiCall<{ message: string }>(`${this.apiBase}/forms/${params.formId}`, {
          method: 'DELETE',
          headers,
        });

      case 'getForm':
        return this.apiCall<TypeformForm>(`${this.apiBase}/forms/${params.formId}`, { headers });

      case 'listForms':
        return this.apiCall<{ items: TypeformForm[] }>(`${this.apiBase}/forms`, {
          method: 'GET',
          headers,
        });

      case 'getResponses':
        return this.apiCall<{ items: TypeformResponse[] }>(
          `${this.apiBase}/forms/${params.formId}/responses`,
          {
            method: 'GET',
            headers,
          }
        );

      case 'getResponse':
        return this.apiCall<TypeformResponse>(
          `${this.apiBase}/forms/${params.formId}/responses/${params.responseId}`,
          { headers }
        );

      case 'createWorkspace':
        return this.apiCall<TypeformWorkspace>(`${this.apiBase}/workspaces`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: params.name }),
        });

      case 'listWorkspaces':
        return this.apiCall<{ items: TypeformWorkspace[] }>(`${this.apiBase}/workspaces`, {
          method: 'GET',
          headers,
        });

      case 'getWorkspace':
        return this.apiCall<TypeformWorkspace>(`${this.apiBase}/workspaces/${params.workspaceId}`, {
          method: 'GET',
          headers,
        });

      case 'createImage':
        return this.apiCall<TypeformImage>(`${this.apiBase}/images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'multipart/form-data',
          },
          body: params.formData as string,
        });

      case 'deleteImage':
        return this.apiCall<{ message: string }>(`${this.apiBase}/images/${params.imageId}`, {
          method: 'DELETE',
          headers,
        });

      case 'createTheme':
        return this.apiCall<TypeformTheme>(`${this.apiBase}/themes`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.theme),
        });

      case 'updateTheme':
        return this.apiCall<TypeformTheme>(`${this.apiBase}/themes/${params.themeId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.updates),
        });

      case 'deleteTheme':
        return this.apiCall<{ message: string }>(`${this.apiBase}/themes/${params.themeId}`, {
          method: 'DELETE',
          headers,
        });

      case 'getThemes':
        return this.apiCall<{ items: TypeformTheme[] }>(`${this.apiBase}/themes`, {
          method: 'GET',
          headers,
        });

      case 'createWebhook':
        return this.apiCall<TypeformWebhook>(`${this.apiBase}/forms/${params.formId}/webhooks/${params.webhookId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            url: params.url,
            enabled: params.enabled,
            secret: params.secret,
          }),
        });

      case 'updateWebhook':
        return this.apiCall<TypeformWebhook>(
          `${this.apiBase}/forms/${params.formId}/webhooks/${params.webhookId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify(params.updates),
          }
        );

      case 'deleteWebhook':
        return this.apiCall<{ message: string }>(
          `${this.apiBase}/forms/${params.formId}/webhooks/${params.webhookId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'listWebhooks':
        return this.apiCall<{ items: TypeformWebhook[] }>(
          `${this.apiBase}/forms/${params.formId}/webhooks`,
          { headers }
        );

      case 'getSettings':
        return this.apiCall<Record<string, unknown>>(`${this.apiBase}/forms/${params.formId}/settings`, {
          headers,
      });

      case 'updateSettings':
        return this.apiCall<Record<string, unknown>>(`${this.apiBase}/forms/${params.formId}/settings`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(params.settings),
        });

      case 'getUser':
        return this.apiCall<TypeformUser>(`${this.apiBase}/me`, { headers });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'forms':
        return this.executeAction('listForms', options || {});
      case 'form':
        return this.executeAction('getForm', { formId: options?.formId });
      case 'responses':
        return this.executeAction('getResponses', { formId: options?.formId });
      case 'workspaces':
        return this.executeAction('listWorkspaces', options || {});
      case 'themes':
        return this.executeAction('getThemes', options || {});
      case 'user':
        return this.executeAction('getUser', options || {});
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  processWebhook(payload: TypeformWebhookPayload): TypeformResponse {
    return payload.form_response;
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
    this.workspaceId = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createTypeformIntegration(): TypeformIntegration {
  return new TypeformIntegration();
}