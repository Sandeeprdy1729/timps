import { IntegrationBase } from './integration-base';

export interface ContentfulEntry {
  sys: {
    id: string;
    type: string;
    createdAt: string;
    updatedAt: string;
    contentType?: { sys: { id: string } };
    revision: number;
    locale: string;
  };
  fields: Record<string, any>;
}

export interface ContentfulAsset {
  sys: {
    id: string;
    type: string;
    createdAt: string;
    updatedAt: string;
    revision: number;
  };
  fields: {
    title?: string;
    description?: string;
    file?: {
      url: string;
      fileName: string;
      contentType: string;
      details: { file: { size: number }; image?: { width: number; height: number } };
    };
  };
}

export interface ContentfulContentType {
  sys: { id: string };
  name: string;
  description: string;
  displayField: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    required: boolean;
    validations: any[];
  }>;
}

export interface ContentfulSpace {
  sys: { id: string };
  name: string;
  locales: string[];
}

export interface ContentfulLocale {
  code: string;
  name: string;
  default: boolean;
}

export interface ContentfulWebhook {
  sys: { id: string };
  name: string;
  url: string;
  topics: string[];
  httpBasicAuth?: string;
  headers?: Record<string, string>;
}

export interface ContentfulTag {
  sys: { id: string; type: 'Tag' };
  name: string;
}

export interface ContentfulUser {
  sys: { id: string };
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  role?: string;
  status: string;
}

export interface ContentfulEnvironment {
  sys: { id: string; type: string };
  name: string;
  description: string;
  version: number;
  status: { sys: { id: string } };
}

export interface ContentfulSnapshot {
  sys: { id: string; type: string; revision: number; createdAt: string };
  snapshot: Record<string, any>;
}

export interface ContentfulRelease {
  sys: { id: string };
  name: string;
  description?: string;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface ContentfulReleaseEntry {
  sys: { id: string };
  release: { sys: { id: string } };
  entry: { sys: { id: string } };
}

interface ContentfulConfig {
  spaceId: string;
  accessToken: string;
  environmentId?: string;
}

export class ContentfulPlugin extends IntegrationBase {
  private config: ContentfulConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('Contentful', 'contentful', 'Headless CMS integration');
    this.config = { environmentId: 'master' } as ContentfulConfig;
  }

  setConfig(spaceId: string, accessToken: string, environmentId = 'master'): void {
    this.config = { spaceId, accessToken, environmentId };
    this.baseHeaders = {
      'Content-Type': 'application/vnd.contentful.management.v1+json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Contentful-Content-Type': 'application/vnd.contentful.management.v1+json',
    };
  }

  private getBaseUrl(): string {
    return `https://api.contentful.com/spaces/${this.config.spaceId}/environments/${this.config.environmentId}`;
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async getSpace(): Promise<ContentfulSpace> {
    return this.apiCall<ContentfulSpace>('GET', '');
  }

  async getLocales(): Promise<{ items: ContentfulLocale[] }> {
    return this.apiCall<{ items: ContentfulLocale[] }>('GET', '/locales');
  }

  async getContentTypes(): Promise<{ items: ContentfulContentType[] }> {
    return this.apiCall<{ items: ContentfulContentType[] }>('GET', '/content_types');
  }

  async getContentType(contentTypeId: string): Promise<ContentfulContentType> {
    return this.apiCall<ContentfulContentType>('GET', `/content_types/${contentTypeId}`);
  }

  async createContentType(contentType: Partial<ContentfulContentType>): Promise<ContentfulContentType> {
    return this.apiCall<ContentfulContentType>('POST', '/content_types', contentType);
  }

  async updateContentType(contentTypeId: string, updates: Partial<ContentfulContentType>): Promise<ContentfulContentType> {
    return this.apiCall<ContentfulContentType>('PUT', `/content_types/${contentTypeId}`, updates);
  }

  async deleteContentType(contentTypeId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/content_types/${contentTypeId}`);
  }

  async getEntries(options?: { content_type?: string; limit?: number; skip?: number }): Promise<{ items: ContentfulEntry[] }> {
    const params = new URLSearchParams();
    if (options?.content_type) params.append('content_type', options.content_type);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.skip) params.append('skip', options.skip.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ items: ContentfulEntry[] }>('GET', `/entries${query}`);
  }

  async getEntry(entryId: string): Promise<ContentfulEntry> {
    return this.apiCall<ContentfulEntry>('GET', `/entries/${entryId}`);
  }

  async createEntry(contentTypeId: string, fields: Record<string, any>): Promise<ContentfulEntry> {
    return this.apiCall<ContentfulEntry>('POST', '/entries', { fields: { ...fields, contentTypeId } });
  }

  async updateEntry(entryId: string, version: number, fields: Record<string, any>): Promise<ContentfulEntry> {
    return this.apiCall<ContentfulEntry>('PUT', `/entries/${entryId}`, {
      fields,
      sys: { id: entryId, revision: version },
    });
  }

  async deleteEntry(entryId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/entries/${entryId}`);
  }

  async publishEntry(entryId: string, version: number): Promise<ContentfulEntry> {
    return this.apiCall<ContentfulEntry>('PUT', `/entries/${entryId}/published`, {
      sys: { id: entryId, revision: version },
    });
  }

  async unpublishEntry(entryId: string, version: number): Promise<ContentfulEntry> {
    return this.apiCall<ContentfulEntry>('DELETE', `/entries/${entryId}/published`, {
      sys: { id: entryId, revision: version },
    });
  }

  async archiveEntry(entryId: string, version: number): Promise<ContentfulEntry> {
    return this.apiCall<ContentfulEntry>('PUT', `/entries/${entryId}/archived`, {
      sys: { id: entryId, revision: version },
    });
  }

  async unarchiveEntry(entryId: string, version: number): Promise<ContentfulEntry> {
    return this.apiCall<ContentfulEntry>('DELETE', `/entries/${entryId}/archived`, {
      sys: { id: entryId, revision: version },
    });
  }

  async getAssets(options?: { limit?: number; skip?: number }): Promise<{ items: ContentfulAsset[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.skip) params.append('skip', options.skip.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ items: ContentfulAsset[] }>('GET', `/assets${query}`);
  }

  async getAsset(assetId: string): Promise<ContentfulAsset> {
    return this.apiCall<ContentfulAsset>('GET', `/assets/${assetId}`);
  }

  async createAsset(file: any, fields: Record<string, any>): Promise<ContentfulAsset> {
    return this.apiCall<ContentfulAsset>('POST', '/assets', { fields });
  }

  async processAsset(assetId: string): Promise<ContentfulAsset> {
    return this.apiCall<ContentfulAsset>('PUT', `/assets/${assetId}/files/process`);
  }

  async publishAsset(assetId: string, version: number): Promise<ContentfulAsset> {
    return this.apiCall<ContentfulAsset>('PUT', `/assets/${assetId}/published`, {
      sys: { id: assetId, revision: version },
    });
  }

  async deleteAsset(assetId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/assets/${assetId}`);
  }

  async getTags(): Promise<{ items: ContentfulTag[] }> {
    return this.apiCall<{ items: ContentfulTag[] }>('GET', '/tags');
  }

  async createTag(name: string): Promise<ContentfulTag> {
    return this.apiCall<ContentfulTag>('POST', '/tags', { name });
  }

  async deleteTag(tagId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/tags/${tagId}`);
  }

  async listWebhooks(): Promise<{ items: ContentfulWebhook[] }> {
    return this.apiCall<{ items: ContentfulWebhook[] }>('GET', '/webhook_settings');
  }

  async createWebhook(webhook: Partial<ContentfulWebhook>): Promise<ContentfulWebhook> {
    return this.apiCall<ContentfulWebhook>('POST', '/webhook_settings', webhook);
  }

  async getWebhook(webhookId: string): Promise<ContentfulWebhook> {
    return this.apiCall<ContentfulWebhook>('GET', `/webhook_settings/${webhookId}`);
  }

  async updateWebhook(webhookId: string, updates: Partial<ContentfulWebhook>): Promise<ContentfulWebhook> {
    return this.apiCall<ContentfulWebhook>('PUT', `/webhook_settings/${webhookId}`, updates);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/webhook_settings/${webhookId}`);
  }

  async getSnapshots(contentTypeId: string, entryId: string): Promise<{ items: ContentfulSnapshot[] }> {
    return this.apiCall<{ items: ContentfulSnapshot[] }>('GET', `/entries/${entryId}/snapshots`);
  }

  async getSnapshot(contentTypeId: string, entryId: string, snapshotId: string): Promise<ContentfulSnapshot> {
    return this.apiCall<ContentfulSnapshot>('GET', `/entries/${entryId}/snapshots/${snapshotId}`);
  }

  async getReleases(): Promise<{ items: ContentfulRelease[] }> {
    return this.apiCall<{ items: ContentfulRelease[] }>('GET', '/releases');
  }

  async getRelease(releaseId: string): Promise<ContentfulRelease> {
    return this.apiCall<ContentfulRelease>('GET', `/releases/${releaseId}`);
  }

  async createRelease(name: string, description?: string): Promise<ContentfulRelease> {
    return this.apiCall<ContentfulRelease>('POST', '/releases', { name, description });
  }

  async updateRelease(releaseId: string, updates: { name?: string; description?: string }): Promise<ContentfulRelease> {
    return this.apiCall<ContentfulRelease>('PATCH', `/releases/${releaseId}`, updates);
  }

  async addToRelease(releaseId: string, entryId: string): Promise<ContentfulReleaseEntry> {
    return this.apiCall<ContentfulReleaseEntry>('PUT', `/releases/${releaseId}/entries/${entryId}`);
  }

  async removeFromRelease(releaseId: string, entryId: string): Promise<void> {
    return this.apiCall<void>('DELETE', `/releases/${releaseId}/entries/${entryId}`);
  }

  async publishRelease(releaseId: string): Promise<void> {
    return this.apiCall<void>('POST', `/releases/${releaseId}/publish`);
  }

  getManifest() {
    return {
      name: 'Contentful',
      id: 'contentful',
      description: 'Headless CMS integration',
      version: '1.0.0',
      actions: [
        { id: 'get_space', name: 'Get Space', description: 'Get space details' },
        { id: 'get_locales', name: 'Get Locales', description: 'Get available locales' },
        { id: 'get_content_types', name: 'Get Content Types', description: 'List all content types' },
        { id: 'get_content_type', name: 'Get Content Type', description: 'Get content type details' },
        { id: 'create_content_type', name: 'Create Content Type', description: 'Create a new content type' },
        { id: 'update_content_type', name: 'Update Content Type', description: 'Update content type' },
        { id: 'delete_content_type', name: 'Delete Content Type', description: 'Delete a content type' },
        { id: 'get_entries', name: 'Get Entries', description: 'List all entries' },
        { id: 'get_entry', name: 'Get Entry', description: 'Get entry details' },
        { id: 'create_entry', name: 'Create Entry', description: 'Create a new entry' },
        { id: 'update_entry', name: 'Update Entry', description: 'Update an entry' },
        { id: 'delete_entry', name: 'Delete Entry', description: 'Delete an entry' },
        { id: 'publish_entry', name: 'Publish Entry', description: 'Publish an entry' },
        { id: 'unpublish_entry', name: 'Unpublish Entry', description: 'Unpublish an entry' },
        { id: 'archive_entry', name: 'Archive Entry', description: 'Archive an entry' },
        { id: 'unarchive_entry', name: 'Unarchive Entry', description: 'Unarchive an entry' },
        { id: 'get_assets', name: 'Get Assets', description: 'List all assets' },
        { id: 'get_asset', name: 'Get Asset', description: 'Get asset details' },
        { id: 'create_asset', name: 'Create Asset', description: 'Upload a new asset' },
        { id: 'process_asset', name: 'Process Asset', description: 'Process an asset' },
        { id: 'publish_asset', name: 'Publish Asset', description: 'Publish an asset' },
        { id: 'delete_asset', name: 'Delete Asset', description: 'Delete an asset' },
        { id: 'get_tags', name: 'Get Tags', description: 'List all tags' },
        { id: 'create_tag', name: 'Create Tag', description: 'Create a new tag' },
        { id: 'delete_tag', name: 'Delete Tag', description: 'Delete a tag' },
        { id: 'list_webhooks', name: 'List Webhooks', description: 'List all webhooks' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a new webhook' },
        { id: 'get_webhook', name: 'Get Webhook', description: 'Get webhook details' },
        { id: 'update_webhook', name: 'Update Webhook', description: 'Update webhook' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete a webhook' },
        { id: 'get_snapshots', name: 'Get Snapshots', description: 'List entry snapshots' },
        { id: 'get_snapshot', name: 'Get Snapshot', description: 'Get snapshot details' },
        { id: 'get_releases', name: 'Get Releases', description: 'List all releases' },
        { id: 'get_release', name: 'Get Release', description: 'Get release details' },
        { id: 'create_release', name: 'Create Release', description: 'Create a new release' },
        { id: 'update_release', name: 'Update Release', description: 'Update release' },
        { id: 'add_to_release', name: 'Add to Release', description: 'Add entry to release' },
        { id: 'remove_from_release', name: 'Remove from Release', description: 'Remove entry from release' },
        { id: 'publish_release', name: 'Publish Release', description: 'Publish all entries in release' },
      ],
      triggers: [
        { id: 'entry_published', name: 'Entry Published', description: 'Triggered when an entry is published' },
        { id: 'entry_unpublished', name: 'Entry Unpublished', description: 'Triggered when an entry is unpublished' },
        { id: 'entry_created', name: 'Entry Created', description: 'Triggered when an entry is created' },
        { id: 'entry_updated', name: 'Entry Updated', description: 'Triggered when an entry is updated' },
        { id: 'entry_deleted', name: 'Entry Deleted', description: 'Triggered when an entry is deleted' },
        { id: 'asset_published', name: 'Asset Published', description: 'Triggered when an asset is published' },
        { id: 'asset_deleted', name: 'Asset Deleted', description: 'Triggered when an asset is deleted' },
        { id: 'content_type_published', name: 'Content Type Published', description: 'Triggered when a content type is published' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'spaceId', label: 'Space ID', description: 'Your Contentful Space ID', required: true },
          { name: 'accessToken', label: 'Access Token', description: 'Your Contentful Management API access token', required: true },
          { name: 'environmentId', label: 'Environment ID', description: 'Contentful environment (default: master)', required: false },
        ],
      },
      connectionTest: {
        endpoint: '',
        method: 'GET',
      },
    };
  }
}

export const contentfulPlugin = new ContentfulPlugin();