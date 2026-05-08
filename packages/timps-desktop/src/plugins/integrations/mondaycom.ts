import { IntegrationBase } from './integration-base';

export interface MondayColumn {
  id: string;
  title: string;
  type: string;
  text: string;
  value?: any;
}

export interface MondayItem {
  id: string;
  name: string;
  column_values: MondayColumn[];
}

export interface MondayBoard {
  id: string;
  name: string;
  description: string;
  kind: 'open' | 'closed' | 'private';
  columns: Array<{ id: string; title: string; type: string }>;
}

export interface MondayGroup {
  id: string;
  title: string;
  color: string;
}

export interface MondayUpdate {
  id: string;
  body: string;
  creator: { id: string; name: string };
  created_at: string;
}

export interface MondayWebhook {
  id: string;
  url: string;
  event: string;
  board_id: string;
}

export interface MondayTag {
  id: string;
  name: string;
}

export interface MondayTeam {
  id: string;
  name: string;
  title: string;
  picture_url?: string;
}

export interface MondayUser {
  id: string;
  name: string;
  email: string;
  url: string;
}

export interface MondayWidget {
  id: string;
  data: any;
}

export interface MondayNotification {
  id: string;
  text: string;
  created_at: string;
}

export interface MondayFile {
  id: string;
  name: string;
  url: string;
}

export interface MondaySubscription {
  id: string;
  board_id: string;
  url: string;
}

interface MondayConfig {
  apiKey: string;
}

export class MondayComPlugin extends IntegrationBase {
  private config: MondayConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    super('MondayCom', 'mondaycom', 'Project management integration');
    this.config = {} as MondayConfig;
  }

  setApiKey(apiKey: string): void {
    this.config = { apiKey };
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
      'API-Version': '2024-01',
    };
  }

  private getBaseUrl(): string {
    return 'https://api.monday.com/v2';
  }

  async apiCall<T>(query: string, variables?: any): Promise<T> {
    const url = this.getBaseUrl();
    const body = { query, variables };
    return this.makeRequest<T>('POST', url, body, this.baseHeaders);
  }

  async getBoards(): Promise<{ data: { boards: MondayBoard[] } }> {
    return this.apiCall<{ data: { boards: MondayBoard[] } }>(`query { boards { id name description kind } }`);
  }

  async getBoard(boardId: string): Promise<{ data: { boards: MondayBoard[] } }> {
    return this.apiCall<{ data: { boards: MondayBoard[] } }>(`query($boardId: ID!) { boards(ids: [$boardId]) { id name description kind columns { id title type } } } }`, { boardId });
  }

  async createBoard(name: string, kind: 'open' | 'closed' | 'private' = 'open'): Promise<{ data: { create_board: MondayBoard } }> {
    return this.apiCall<{ data: { create_board: MondayBoard } }>(`mutation($name: String!, $kind: BoardKind!) { create_board(name: $name, kind: $kind) { id name description kind } } }`, { name, kind });
  }

  async duplicateBoard(boardId: string, name: string): Promise<{ data: { duplicate_board: MondayBoard } }> {
    return this.apiCall<{ data: { duplicate_board: MondayBoard } }>(`mutation($boardId: ID!, $name: String!) { duplicate_board(board_id: $boardId, new_board_name: $name) { id name } } }`, { boardId, name });
  }

  async deleteBoard(boardId: string): Promise<{ data: { delete_board: MondayBoard } }> {
    return this.apiCall<{ data: { delete_board: MondayBoard } }>(`mutation($boardId: ID!) { delete_board(board_id: $boardId) { id } } }`, { boardId });
  }

  async updateBoard(boardId: string, name: string): Promise<{ data: { update_board: MondayBoard } }> {
    return this.apiCall<{ data: { update_board: MondayBoard } }>(`mutation($boardId: ID!, $name: String!) { update_board(board_id: $boardId, name: $name) { id name } } }`, { boardId, name });
  }

  async getGroups(boardId: string): Promise<{ data: { boards: MondayGroup[] } }> {
    return this.apiCall<{ data: { boards: MondayGroup[] } }>(`query($boardId: ID!) { boards(ids: [$boardId]) { groups { id title color } } } }`, { boardId });
  }

  async createGroup(boardId: string, name: string): Promise<{ data: { create_group: MondayGroup } }> {
    return this.apiCall<{ data: { create_group: MondayGroup } }>(`mutation($boardId: ID!, $name: String!) { create_group(board_id: $boardId, group_name: $name) { id title } } }`, { boardId, name });
  }

  async updateGroup(groupId: string, name: string): Promise<{ data: { update_group: MondayGroup } }> {
    return this.apiCall<{ data: { update_group: MondayGroup } }>(`mutation($groupId: ID!, $name: String!) { update_group(group_id: $groupId, title: $name) { id title } }`, { groupId, name });
  }

  async deleteGroup(groupId: string): Promise<{ data: { delete_group: MondayGroup } }> {
    return this.apiCall<{ data: { delete_group: MondayGroup } }>(`mutation($groupId: ID!) { delete_group(group_id: $groupId) { id } } }`, { groupId });
  }

  async getItems(boardId: string, limit = 50): Promise<{ data: { boards: MondayItem[] } }> {
    return this.apiCall<{ data: { boards: MondayItem[] } }>(`query($boardId: ID!, $limit: Int!) { boards(ids: [$boardId]) { items_page(limit: $limit) { items { id name column_values { id title text value } } } } } }`, { boardId, limit });
  }

  async getItem(itemId: string): Promise<{ data: { items: MondayItem[] } }> {
    return this.apiCall<{ data: { items: MondayItem[] } }>(`query($itemId: [ID!]!) { items(ids: $itemId) { id name column_values { id title text value } } } }`, { itemId: [itemId] });
  }

  async createItem(boardId: string, groupId: string, name: string, columnValues?: Record<string, any>): Promise<{ data: { create_item: MondayItem } }> {
    return this.apiCall<{ data: { create_item: MondayItem } }>(`mutation($boardId: ID!, $groupId: ID!, $itemName: String!, $columnValues: JSON) { create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) { id name } } }`, { boardId, groupId, itemName: name, columnValues: JSON.stringify(columnValues || {}) });
  }

  async updateItem(itemId: string, columnValues: Record<string, any>): Promise<{ data: { change_multiple_column_values: MondayItem } }> {
    return this.apiCall<{ data: { change_multiple_column_values: MondayItem } }>(`mutation($itemId: ID!, $columnValues: JSON!) { change_multiple_column_values(item_id: $itemId, column_values: $columnValues) { id name } }`, { itemId, columnValues: JSON.stringify(columnValues) });
  }

  async deleteItem(itemId: string): Promise<{ data: { delete_item: MondayItem } }> {
    return this.apiCall<{ data: { delete_item: MondayItem } }>(`mutation($itemId: ID!) { delete_item(item_id: $itemId) { id } } }`, { itemId });
  }

  async duplicateItem(itemId: string, groupId?: string): Promise<{ data: { duplicate_item: MondayItem } }> {
    return this.apiCall<{ data: { duplicate_item: MondayItem } }>(`mutation($itemId: ID!, $groupId: ID) { duplicate_item(item_id: $itemId, with_dependencies: false, group_id: $groupId) { id name } } }`, { itemId, groupId });
  }

  async moveItemToGroup(itemId: string, groupId: string): Promise<{ data: { move_item_to_group: MondayItem } }> {
    return this.apiCall<{ data: { move_item_to_group: MondayItem } }>(`mutation($itemId: ID!, $groupId: ID!) { move_item_to_group(item_id: $itemId, group_id: $groupId) { id name } } }`, { itemId, groupId });
  }

  async moveItemToBoard(itemId: string, boardId: string, groupId: string): Promise<{ data: { move_item_to_board: MondayItem } }> {
    return this.apiCall<{ data: { move_item_to_board: MondayItem } }>(`mutation($itemId: ID!, $boardId: ID!, $groupId: ID!) { move_item_to_board(item_id: $itemId, board_id: $boardId, group_id: $groupId) { id name } } }`, { itemId, boardId, groupId });
  }

  async createUpdate(itemId: string, body: string): Promise<{ data: { create_update: MondayUpdate } }> {
    return this.apiCall<{ data: { create_update: MondayUpdate } }>(`mutation($itemId: ID!, $body: String!) { create_update(item_id: $itemId, body: $body) { id body } } }`, { itemId, body });
  }

  async getUpdates(itemId: string): Promise<{ data: { items: MondayUpdate[] } }> {
    return this.apiCall<{ data: { items: MondayUpdate[] } }>(`query($itemId: ID!) { items(ids: [$itemId]) { updates { id body created_at creator { name } } } } }`, { itemId });
  }

  async getUsers(): Promise<{ data: { users: MondayUser[] } }> {
    return this.apiCall<{ data: { users: MondayUser[] } }>(`query { users { id name email url } }`);
  }

  async getTeammates(): Promise<{ data: { teams: MondayTeam[] } }> {
    return this.apiCall<{ data: { teams: MondayTeam[] } }>(`query { teams { id name title picture_url } }`);
  }

  async createWebhook(boardId: string, url: string, event: string): Promise<{ data: { create_webhook: MondayWebhook } }> {
    return this.apiCall<{ data: { create_webhook: MondayWebhook } }>(`mutation($boardId: ID!, $url: String!, $event: WebhookEventType!) { create_webhook(board_id: $boardId, url: $url, event: $event) { id } } }`, { boardId, url, event });
  }

  async deleteWebhook(webhookId: string): Promise<{ data: { delete_webhook: MondayWebhook } }> {
    return this.apiCall<{ data: { delete_webhook: MondayWebhook } }>(`mutation($webhookId: ID!) { delete_webhook(id: $webhookId) { id } } }`, { webhookId });
  }

  async getWebhooks(boardId: string): Promise<{ data: { webhooks: MondayWebhook[] } }> {
    return this.apiCall<{ data: { webhooks: MondayWebhook[] } }>(`query($boardId: ID!) { webhooks(board_id: $boardId) { id url event board_id } } }`, { boardId });
  }

  async getTags(): Promise<{ data: { tags: MondayTag[] } }> {
    return this.apiCall<{ data: { tags: MondayTag[] } }>(`query { tags { id name } }`);
  }

  async createTag(name: string): Promise<{ data: { create_tag: MondayTag } }> {
    return this.apiCall<{ data: { create_tag: MondayTag } }>(`mutation($name: String!) { create_tag(name: $name) { id } } }`, { name });
  }

  async getWidgets(boardId: string): Promise<{ data: { widgets: MondayWidget[] } }> {
    return this.apiCall<{ data: { widgets: MondayWidget[] } }>(`query($boardId: ID!) { boards(ids: [$boardId]) { widgets { id data } } }`, { boardId });
  }

  async createNotification(userId: string, text: string, itemId?: string): Promise<{ data: { create_notification: MondayNotification } }> {
    return this.apiCall<{ data: { create_notification: MondayNotification } }>(`mutation($userId: ID!, $text: String!, $itemId: ID) { create_notification(user_id: $userId, text: $text, item_id: $itemId) { id text } }`, { userId, text, itemId });
  }

  async uploadFile(itemId: string, fileUrl: string, columnId: string): Promise<{ data: { create_file: MondayFile } }> {
    return this.apiCall<{ data: { create_file: MondayFile } }>(`mutation($itemId: ID!, $fileUrl: String!, $columnId: String!) { create_file(item_id: $itemId, file_url: $fileUrl, column_id: $columnId) { id name url } }`, { itemId, fileUrl, columnId });
  }

  async subscribeToColumn(boardId: string, columnId: string, url: string): Promise<{ data: { add_subscription: MondaySubscription } }> {
    return this.apiCall<{ data: { add_subscription: MondaySubscription } }>(`mutation($boardId: ID!, $columnId: String!, $url: String!) { add_subscription(board_id: $boardId, column_id: $columnId, url: $url) { id board_id } }`, { boardId, columnId, url });
  }

  async getColumnValues(boardId: string, itemId: string): Promise<{ data: { items: MondayColumn[] } }> {
    return this.apiCall<{ data: { items: MondayColumn[] } }>(`query($boardId: ID!, $itemId: ID!) { boards(ids: [$boardId]) { items(ids: [$itemId]) { column_values { id title type text value } } } } }`, { boardId, itemId });
  }

  getManifest() {
    return {
      name: 'MondayCom',
      id: 'mondaycom',
      description: 'Project management integration',
      version: '1.0.0',
      actions: [
        { id: 'get_boards', name: 'Get Boards', description: 'List all boards' },
        { id: 'get_board', name: 'Get Board', description: 'Get board details' },
        { id: 'create_board', name: 'Create Board', description: 'Create a new board' },
        { id: 'duplicate_board', name: 'Duplicate Board', description: 'Duplicate a board' },
        { id: 'delete_board', name: 'Delete Board', description: 'Delete a board' },
        { id: 'update_board', name: 'Update Board', description: 'Update board' },
        { id: 'get_groups', name: 'Get Groups', description: 'List groups in a board' },
        { id: 'create_group', name: 'Create Group', description: 'Create a group' },
        { id: 'update_group', name: 'Update Group', description: 'Update group' },
        { id: 'delete_group', name: 'Delete Group', description: 'Delete a group' },
        { id: 'get_items', name: 'Get Items', description: 'List items in a board' },
        { id: 'get_item', name: 'Get Item', description: 'Get item details' },
        { id: 'create_item', name: 'Create Item', description: 'Create an item' },
        { id: 'update_item', name: 'Update Item', description: 'Update item' },
        { id: 'delete_item', name: 'Delete Item', description: 'Delete an item' },
        { id: 'duplicate_item', name: 'Duplicate Item', description: 'Duplicate an item' },
        { id: 'move_item_to_group', name: 'Move Item to Group', description: 'Move item to group' },
        { id: 'move_item_to_board', name: 'Move Item to Board', description: 'Move item to board' },
        { id: 'create_update', name: 'Create Update', description: 'Create an update' },
        { id: 'get_updates', name: 'Get Updates', description: 'Get item updates' },
        { id: 'get_users', name: 'Get Users', description: 'List all users' },
        { id: 'get_teammates', name: 'Get Teammates', description: 'List teams' },
        { id: 'create_webhook', name: 'Create Webhook', description: 'Create a webhook' },
        { id: 'delete_webhook', name: 'Delete Webhook', description: 'Delete a webhook' },
        { id: 'get_webhooks', name: 'Get Webhooks', description: 'List webhooks' },
        { id: 'get_tags', name: 'Get Tags', description: 'List tags' },
        { id: 'create_tag', name: 'Create Tag', description: 'Create a tag' },
        { id: 'get_widgets', name: 'Get Widgets', description: 'List widgets' },
        { id: 'create_notification', name: 'Create Notification', description: 'Send notification' },
        { id: 'upload_file', name: 'Upload File', description: 'Upload file' },
        { id: 'subscribe_to_column', name: 'Subscribe to Column', description: 'Subscribe to column changes' },
        { id: 'get_column_values', name: 'Get Column Values', description: 'Get column values for item' },
      ],
      triggers: [
        { id: 'item_created', name: 'Item Created', description: 'Triggered when item is created' },
        { id: 'item_updated', name: 'Item Updated', description: 'Triggered when item is updated' },
        { id: 'item_deleted', name: 'Item Deleted', description: 'Triggered when item is deleted' },
        { id: 'column_changed', name: 'Column Changed', description: 'Triggered when column value changes' },
        { id: 'board_created', name: 'Board Created', description: 'Triggered when board is created' },
        { id: 'board_deleted', name: 'Board Deleted', description: 'Triggered when board is deleted' },
        { id: 'update_created', name: 'Update Created', description: 'Triggered when update is created' },
        { id: 'comment_created', name: 'Comment Created', description: 'Triggered when comment is created' },
      ],
      auth: {
        type: 'api_key',
        fields: [
          { name: 'apiKey', label: 'API Key', description: 'Your Monday.com API key', required: true },
        ],
      },
      connectionTest: {
        endpoint: '/query { boards { id } }',
        method: 'POST',
      },
    };
  }
}

export const mondaycomPlugin = new MondayComPlugin();