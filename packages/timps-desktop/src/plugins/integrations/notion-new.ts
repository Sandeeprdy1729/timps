import { IntegrationBase } from './integration-base';

export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: { id: string; object: string };
  last_edited_by: { id: string; object: string };
  cover?: { type: string; external?: { url: string }; file?: { url: string; expiry_time: string } };
  icon?: { type: string; emoji?: string; external?: { url: string }; file?: { url: string; expiry_time: string } };
  parent: { type: string; page_id?: string; database_id?: string; workspace?: boolean; block_id?: string };
  archived: boolean;
  properties: Record<string, any>;
  public_url?: string;
}

export interface NotionDatabase {
  id: string;
  created_time: string;
  last_edited_time: string;
  title: Array<{ type: string; text?: { content: string }; plain_text: string }>;
  description: Array<{ type: string; text?: { content: string }; plain_text: string }>;
  icon?: { type: string; emoji?: string };
  cover?: { type: string; external?: { url: string } };
  properties: Record<string, any>;
  parent: { type: string; database_id?: string; page_id?: string };
}

export interface NotionBlock {
  id: string;
  type: string;
  created_time: string;
  last_edited_time: string;
  created_by: { id: string; object: string };
  last_edited_by: { id: string; object: string };
  has_children: boolean;
  blocks?: NotionBlock[];
  [key: string]: any;
}

export interface NotionUser {
  id: string;
  type: 'person' | 'bot';
  name: string;
  avatar_url?: string;
  person?: { email: string };
  bot?: { owner?: { type: string; workspace_name?: string } };
}

export interface NotionWorkspace {
  id: string;
  name: string;
  icon?: string;
}

export interface NotionComment {
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: { id: string; object: string };
  parent: { type: string; page_id?: string; block_id?: string };
  discussed_url?: string;
  rich_text: Array<{ type: string; plain_text: string }>;
}

export interface NotionSearchResult {
  results: Array<{ object: string; id: string; [key: string]: any }>;
  has_more: boolean;
  next_cursor?: string;
}

export interface NotionPartialUser {
  id: string;
  object: 'user';
  type?: string;
  name?: string;
  avatar_url?: string;
}

export interface NotionPartialPage {
  id: string;
  object: 'page';
  created_time: string;
  last_edited_time: string;
  cover?: any;
  icon?: any;
  parent: any;
  properties?: any;
  archived?: boolean;
}

export interface NotionPartialDatabase {
  id: string;
  object: 'database';
  created_time: string;
  last_edited_time: string;
}

export interface NotionFilter {
  property?: string;
  timestamp?: string;
  number?: any;
  select?: any;
  multi_select?: any;
  status?: any;
  rich_text?: any;
  title?: any;
  people?: any;
  files?: any;
  checkbox?: any;
  date?: any;
  url?: any;
  email?: any;
  phone_number?: any;
}

export interface NotionSort {
  direction: 'ascending' | 'descending';
  timestamp?: string;
  property: string;
}

export interface NotionFilterObject {
  and?: NotionFilter[];
  or?: NotionFilter[];
}

export interface NotionPageRetrieve {
  page_size?: number;
  timestamp?: string;
}

export interface NotionDatabaseQuery {
  database_id: string;
  filter?: NotionFilter | NotionFilterObject;
  sorts?: NotionSort[];
  page_size?: number;
  start_cursor?: string;
}

interface NotionConfig {
  apiKey: string;
}

export class NotionPlugin extends IntegrationBase {
  private config: NotionConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('Notion', 'notion', 'All-in-one workspace integration');
    this.config = {} as NotionConfig;
  }

  setApiKey(apiKey: string): void {
    this.config = { apiKey };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  private getBaseUrl(): string {
    return 'https://api.notion.com/v1';
  }

  async apiCall<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    return this.makeRequest<T>(method, url, body, this.baseHeaders);
  }

  async search(query?: string, options?: { filter?: { value: string; property: string }; sort?: { direction: string; timestamp: string }; page_size?: number; start_cursor?: string }): Promise<NotionSearchResult> {
    return this.apiCall<NotionSearchResult>('POST', '/search', { query, ...options });
  }

  async getPage(pageId: string): Promise<NotionPage> {
    return this.apiCall<NotionPage>('GET', `/pages/${pageId}`);
  }

  async getPagePropertyItem(pageId: string, propertyId: string, options?: { page_size?: number; start_cursor?: string }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.page_size) params.append('page_size', options.page_size.toString());
    if (options?.start_cursor) params.append('start_cursor', options.start_cursor);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<any>('GET', `/pages/${pageId}/properties/${propertyId}${query}`);
  }

  async createPage(parent: { page_id?: string; database_id?: string }, properties?: Record<string, any>, children?: Partial<NotionBlock>[]): Promise<NotionPage> {
    const payload: any = { parent, properties };
    if (children) payload.children = children;
    return this.apiCall<NotionPage>('POST', '/pages', payload);
  }

  async updatePage(pageId: string, properties: Record<string, any>): Promise<NotionPage> {
    return this.apiCall<NotionPage>('PATCH', `/pages/${pageId}`, { properties });
  }

  async archivePage(pageId: string, archived = true): Promise<NotionPage> {
    return this.apiCall<NotionPage>('PATCH', `/pages/${pageId}`, { archived });
  }

  async deletePage(pageId: string): Promise<NotionPage> {
    return this.archivePage(pageId, true);
  }

  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    return this.apiCall<NotionDatabase>('GET', `/databases/${databaseId}`);
  }

  async createDatabase(parent: { page_id?: string }, title: any[], properties: Record<string, any>, title_property?: string, description?: any[]): Promise<NotionDatabase> {
    return this.apiCall<NotionDatabase>('POST', '/databases', {
      parent,
      title: title.map(t => ({ type: 'rich_text', rich_text: [t] })),
      properties,
      ...(title_property && { title: [{ type: 'property', property: title_property }] }),
      ...(description && { description: description.map(d => ({ type: 'rich_text', rich_text: [d] })) }),
    });
  }

  async updateDatabase(databaseId: string, updates: { title?: any[]; description?: any[]; properties?: Record<string, any> }): Promise<NotionDatabase> {
    const payload: any = {};
    if (updates.title) payload.title = updates.title.map(t => ({ type: 'rich_text', rich_text: [t] }));
    if (updates.description) payload.description = updates.description.map(d => ({ type: 'rich_text', rich_text: [d] }));
    if (updates.properties) payload.properties = updates.properties;
    return this.apiCall<NotionDatabase>('PATCH', `/databases/${databaseId}`, payload);
  }

  async queryDatabase(databaseId: string, options?: NotionDatabaseQuery): Promise<{ results: NotionPage[]; has_more: boolean; next_cursor?: string }> {
    return this.apiCall<{ results: NotionPage[]; has_more: boolean; next_cursor?: string }>('POST', `/databases/${databaseId}/query`, options);
  }

  async createDatabaseItem(databaseId: string, properties: Record<string, any>): Promise<NotionPage> {
    return this.createPage({ database_id: databaseId }, properties);
  }

  async getBlock(blockId: string): Promise<NotionBlock> {
    return this.apiCall<NotionBlock>('GET', `/blocks/${blockId}`);
  }

  async getBlockChildren(blockId: string, options?: { page_size?: number; start_cursor?: string }): Promise<{ results: NotionBlock[]; has_more: boolean; next_cursor?: string }> {
    const params = new URLSearchParams();
    if (options?.page_size) params.append('page_size', options.page_size.toString());
    if (options?.start_cursor) params.append('start_cursor', options.start_cursor);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ results: NotionBlock[]; has_more: boolean; next_cursor?: string }>('GET', `/blocks/${blockId}/children${query}`);
  }

  async appendBlockChildren(blockId: string, children: Partial<NotionBlock>[]): Promise<{ results: NotionBlock[] }> {
    return this.apiCall<{ results: NotionBlock[] }>('PATCH', `/blocks/${blockId}/children`, { children });
  }

  async addBlockChild(blockId: string, block: Partial<NotionBlock>): Promise<NotionBlock> {
    const result = await this.appendBlockChildren(blockId, [block]);
    return result.results[0];
  }

  async updateBlock(blockId: string, updates: Partial<NotionBlock>): Promise<NotionBlock> {
    return this.apiCall<NotionBlock>('PATCH', `/blocks/${blockId}`, updates);
  }

  async deleteBlock(blockId: string): Promise<NotionBlock> {
    return this.updateBlock(blockId, { archived: true } as any);
  }

  async getUser(userId: string): Promise<NotionUser> {
    return this.apiCall<NotionUser>('GET', `/users/${userId}`);
  }

  async listUsers(options?: { page_size?: number; start_cursor?: string }): Promise<{ results: NotionUser[]; has_more: boolean; next_cursor?: string }> {
    const params = new URLSearchParams();
    if (options?.page_size) params.append('page_size', options.page_size.toString());
    if (options?.start_cursor) params.append('start_cursor', options.start_cursor);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiCall<{ results: NotionUser[]; has_more: boolean; next_cursor?: string }>('GET', `/users${query}`);
  }

  async getMe(): Promise<NotionUser> {
    return this.apiCall<NotionUser>('GET', '/users/me');
  }

  async createComment(body: string, parent: { page_id?: string; block_id?: string }, discussedUrl?: string): Promise<NotionComment> {
    return this.apiCall<NotionComment>('POST', '/comments', {
      parent,
      rich_text: [{ type: 'text', text: { content: body } }],
      ...(discussedUrl && { discussed_url: discussedUrl }),
    });
  }

  async retrieveComment(commentId: string): Promise<NotionComment> {
    return this.apiCall<NotionComment>('GET', `/comments/${commentId}`);
  }

  async deleteComment(commentId: string): Promise<NotionComment> {
    return this.apiCall<NotionComment>('DELETE', `/comments/${commentId}`);
  }

  async getPagePage(pageId: string): Promise<NotionPage> {
    return this.apiCall<NotionPage>('GET', `/pages/${pageId}`);
  }

  async searchDatabase(query: string): Promise<NotionSearchResult> {
    return this.search(query, { filter: { value: 'database', property: 'object' } });
  }

  async searchPages(query: string): Promise<NotionSearchResult> {
    return this.search(query, { filter: { value: 'page', property: 'object' } });
  }

  getManifest() {
    return {
      name: 'Notion',
      id: 'notion',
      description: 'All-in-one workspace integration',
      version: '1.0.0',
      actions: [
        { id: 'search', name: 'Search', description: 'Search all pages and databases' },
        { id: 'get_page', name: 'Get Page', description: 'Get page details' },
        { id: 'get_page_property', name: 'Get Page Property', description: 'Get page property details' },
        { id: 'create_page', name: 'Create Page', description: 'Create a new page' },
        { id: 'update_page', name: 'Update Page', description: 'Update page properties' },
        { id: 'archive_page', name: 'Archive Page', description: 'Archive a page' },
        { id: 'delete_page', name: 'Delete Page', description: 'Delete a page' },
        { id: 'get_database', name: 'Get Database', description: 'Get database details' },
        { id: 'create_database', name: 'Create Database', description: 'Create a new database' },
        { id: 'update_database', name: 'Update Database', description: 'Update database' },
        { id: 'query_database', name: 'Query Database', description: 'Query database entries' },
        { id: 'create_database_item', name: 'Create Database Item', description: 'Add item to database' },
        { id: 'get_block', name: 'Get Block', description: 'Get block details' },
        { id: 'get_block_children', name: 'Get Block Children', description: 'Get block children' },
        { id: 'append_block_children', name: 'Append Block Children', description: 'Add children to block' },
        { id: 'add_block_child', name: 'Add Block Child', description: 'Add child to block' },
        { id: 'update_block', name: 'Update Block', description: 'Update block content' },
        { id: 'delete_block', name: 'Delete Block', description: 'Delete a block' },
        { id: 'get_user', name: 'Get User', description: 'Get user details' },
        { id: 'list_users', name: 'List Users', description: 'List all users' },
        { id: 'get_me', name: 'Get Me', description: 'Get current user' },
        { id: 'create_comment', name: 'Create Comment', description: 'Create a comment' },
        { id: 'retrieve_comment', name: 'Retrieve Comment', description: 'Get comment details' },
        { id: 'delete_comment', name: 'Delete Comment', description: 'Delete a comment' },
        { id: 'search_database', name: 'Search Database', description: 'Search databases' },
        { id: 'search_pages', name: 'Search Pages', description: 'Search pages' },
      ],
      triggers: [
        { id: 'page_created', name: 'Page Created', description: 'Triggered when a page is created' },
        { id: 'page_updated', name: 'Page Updated', description: 'Triggered when a page is updated' },
        { id: 'page_archived', name: 'Page Archived', description: 'Triggered when a page is archived' },
        { id: 'database_item_created', name: 'Database Item Created', description: 'Triggered when database item is created' },
        { id: 'database_item_updated', name: 'Database Item Updated', description: 'Triggered when database item is updated' },
        { id: 'comment_created', name: 'Comment Created', description: 'Triggered when a comment is created' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'apiKey', label: 'API Key', description: 'Your Notion API key', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/users/me',
        method: 'GET',
      },
    };
  }
}

export const notionPlugin = new NotionPlugin();