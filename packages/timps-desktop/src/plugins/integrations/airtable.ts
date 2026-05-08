import { PluginManifest } from '../types';
import { IntegrationBase, AuthConfig } from './integration-base.js';

export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: 'none' | 'read' | 'create' | 'edit' | 'commenter' | 'owner';
}

export interface AirtableTable {
  id: string;
  name: string;
  description: string | null;
  primaryFieldId: string;
  fields: AirtableField[];
  views: AirtableView[];
}

export interface AirtableField {
  id: string;
  name: string;
  type: string;
  description: string;
  options?: Record<string, unknown>;
  isPrimary: boolean;
}

export interface AirtableView {
  id: string;
  name: string;
  type: string;
  visibility: 'visible' | 'hidden';
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
  cellValuesByFieldId?: Record<string, unknown>;
}

export interface AirtableRecordResponse {
  records: AirtableRecord[];
  offset?: string;
  totalRecordCount?: number;
}

export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  thumbnails?: {
    small: { url: string; width: number; height: number };
    large: { url: string; width: number; height: number };
    full: { url: string; width: number; height: number };
  };
}

export interface AirtableUser {
  id: string;
  email: string;
  name: string;
}

export interface AirtableCollaborator {
  id: string;
  email: string;
  name: string;
  type: 'user' | 'group';
}

export interface AirtableWebhook {
  id: string;
  notificationUrl: string;
  expirationTime: string;
  specification?: {
    recordChangeAll: boolean;
    lastNewRecordCreatedTime: string;
  eventNamespace?: string;
  sourceDatabaseId?: string;
  sourceTableId?: string;
  sourceViewId?: string;
    actionCallbacks?: Record<string, unknown>;
  };
}

export interface AirtableWebhookPayload {
  baseId: string;
  webhookId: string;
  timestamp: string;
  changedTablesById: Record<string, { recordChangeAll: boolean; changedRecordIdsByTableId: Record<string, string[]> }>;
}

const MANIFEST: PluginManifest = {
  id: 'airtable',
  name: 'Airtable',
  version: '1.0.0',
  description: 'Airtable integration for bases, tables, records, and automation',
  author: 'TIMPS Team',
  main: 'index.js',
  keywords: ['airtable', 'database', 'spreadsheet', 'nocode'],
};

const SCOPES = [
  'getBases', 'getBase', 'getTable', 'getTables', 'getRecord', 'getRecords', 'createRecord', 'createRecords', 'updateRecord', 'updateRecords',
  'deleteRecord', 'deleteRecords', 'listRecords', 'listRecordsByView', 'listRecordsBySort', 'listRecordsByFilter',
  'getField', 'getFields', 'createField', 'updateField', 'deleteField',
  'getView', 'getViews', 'createView', 'updateView', 'deleteView',
  'getCollaborators', 'getUsers', 'inviteCollaborator', 'removeCollaborator',
  'getWebhooks', 'createWebhook', 'deleteWebhook', 'testWebhook',
  'getAttachmentThumbnail', 'getAttachments', 'uploadAttachment', 'deleteAttachment',
  'getFormulaField', 'getRollupField', 'getLookupField', 'getCountField', 'getAutonumberField', 'getBarcodeField',
  'getMultipleSelectField', 'getSingleSelectField', 'getUrlField', 'getEmailField', 'getPhoneField', 'getRichTextField',
  'getDateField', 'getDateTimeField', 'getDurationField', 'getPercentField', 'getCurrencyField', 'getNumberField',
  'getCheckboxField', 'getLastModifiedTimeField', 'LastModifiedByField', 'getExternalSyncField',
  'createFormulaField', 'createLinkedRecordField', 'createButtonField',
  'getBasesMetadata', 'getTableMetadata', 'getFieldMetadata', 'getWebhooksMetadata',
  'createTable', 'updateTable', 'deleteTable', 'addFieldFromFieldTemplate', 'addMultipleFields',
  'renameTable', 'reorderTable', 'createViewWithOptions', 'duplicateTable', 'duplicateView',
  'updateRecordField', 'updateMultipleRecordFields', 'setRecordCellValue', 'setRecordCellValues',
  'formatFieldAs', 'getFieldOptions', 'setFieldOptions', 'configureField', 'configureFieldVisibility',
  'getRecordComments', 'createRecordComment', 'updateRecordComment', 'deleteRecordComment',
  'getRecordActivity', 'getRecordHistory', 'revertRecord', 'mergeRecords',
  'createAttachments', 'getAttachmentUploads', 'downloadAttachment', 'refreshAttachments',
  'addRecordsFromCSV', 'exportToCSV', 'convertToCSV',
  'batchCreateRecords', 'batchUpdateRecords', 'batchDeleteRecords',
  'getAuditEvents', 'getRecordVersions', 'getFieldVersions',
  'validateField', 'validateRecord', 'validateRecords',
  'getFieldSchema', 'getTableSchema', 'getBaseSchema',
  'createSharedViewLink', 'deleteSharedViewLink', 'getSharedViewLinks',
  'shareBase', 'revokeBaseAccess', 'getBaseShares', 'createGroupShare',
  'getFieldDescriptions', 'setFieldDescriptions', 'getFieldValidation',
  'setFieldValidation', 'getFieldRollup', 'setFieldRollup',
  'enableFieldPermutations', 'disableFieldPermutations',
  'createFieldPermutation', 'deleteFieldPermutation',
  'getConditionalFieldValues', 'setConditionalFieldValues',
  'createConditionalFormatting', 'deleteConditionalFormatting',
  'getFieldFormattingRules', 'setFieldFormattingRules',
  'createFieldValidationRule', 'deleteFieldValidationRule',
  'getFieldDependencies', 'setFieldDependencies',
  'getFieldPrimaryKey', 'setFieldPrimaryKey',
  'createAutokint', 'updateAutokint', 'deleteAutokint',
  'getAutokintHistory', 'revertAutokint',
  'getCellFormat', 'setCellFormat', 'formatAs', 'detectFormat',
];

export default class AirtableIntegration extends IntegrationBase {
  private apiBase = 'https://api.airtable.com/v0';

  constructor() {
    super(MANIFEST.id, MANIFEST.name, MANIFEST.version, MANIFEST.description, MANIFEST.keywords);
    this.capabilities = {
      actions: SCOPES,
      triggers: ['record_created', 'record_changed', 'record_deleted', 'record_updated', 'table_created', 'table_deleted'],
      dataModels: ['base', 'table', 'field', 'record', 'view', 'collaborator', 'webhook', 'attachment'],
    };
  }

  async authenticate(config: AuthConfig): Promise<boolean> {
    if (!config.accessToken) throw new Error('Access token is required');
    this.setAccessToken(config.accessToken);

    try {
      const bases = await this.apiCall<{ bases: AirtableBase[] }>(`${this.apiBase}/bases`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      return bases.bases.length >= 0;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      await this.apiCall(`${this.apiBase}/bases`, {
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
      case 'getBases':
        return this.apiCall<{ bases: AirtableBase[] }>(`${this.apiBase}/bases`, { headers });

      case 'getBase':
        return this.apiCall<AirtableBase>(`${this.apiBase}/bases/${params.baseId}`, { headers });

      case 'getTables':
        return this.apiCall<{ tables: AirtableTable[] }>(`${this.apiBase}/bases/${params.baseId}/tables`, {
          headers,
        });

      case 'getTable':
        return this.apiCall<AirtableTable>(`${this.apiBase}/bases/${params.baseId}/tables/${params.tableId}`, {
          headers,
        });

      case 'createTable':
        return this.apiCall<AirtableTable>(`${this.apiBase}/bases/${params.baseId}/tables`, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.table),
        });

      case 'getRecords':
        return this.apiCall<AirtableRecordResponse>(
          `${this.apiBase}/${params.baseId}/${params.tableId}`,
          { headers }
        );

      case 'listRecords':
        return this.apiCall<AirtableRecordResponse>(
          `${this.apiBase}/${params.baseId}/${params.tableId}`,
          {
            method: 'GET',
            headers,
          }
        );

      case 'listRecordsByView':
        return this.apiCall<AirtableRecordResponse>(
          `${this.apiBase}/${params.baseId}/${params.tableId}?view=${params.viewId}`,
          { headers }
        );

      case 'listRecordsBySort':
        return this.apiCall<AirtableRecordResponse>(
          `${this.apiBase}/${params.baseId}/${params.tableId}`,
          {
            method: 'GET',
            headers,
          }
        );

      case 'listRecordsByFilter':
        return this.apiCall<AirtableRecordResponse>(
          `${this.apiBase}/${params.baseId}/${params.tableId}`,
          {
            method: 'GET',
            headers,
          }
        );

      case 'getRecord':
        return this.apiCall<AirtableRecord>(
          `${this.apiBase}/${params.baseId}/${params.tableId}/${params.recordId}`,
          { headers }
        );

      case 'createRecord':
        return this.apiCall<AirtableRecord>(`${this.apiBase}/${params.baseId}/${params.tableId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ records: [{ fields: params.fields }] }),
        });

      case 'createRecords':
        return this.apiCall<AirtableRecordResponse>(`${this.apiBase}/${params.baseId}/${params.tableId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ records: params.records, typecast: params.typecast }),
        });

      case 'updateRecord':
        return this.apiCall<AirtableRecord>(
          `${this.apiBase}/${params.baseId}/${params.tableId}/${params.recordId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields: params.fields }),
          }
        );

      case 'updateRecords':
        return this.apiCall<AirtableRecordResponse>(
          `${this.apiBase}/${params.baseId}/${params.tableId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ records: params.records }),
          }
        );

      case 'deleteRecord':
        return this.apiCall<{ deleted: boolean; id: string }>(
          `${this.apiBase}/${params.baseId}/${params.tableId}/${params.recordId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'deleteRecords':
        return this.apiCall<{ records: Array<{ id: string; deleted: boolean }> }>(
          `${this.apiBase}/${params.baseId}/${params.tableId}`,
          {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ records: params.recordIds }),
          }
        );

      case 'getFields':
        return this.apiCall<{ fields: AirtableField[] }>(
          `${this.apiBase}/bases/${params.baseId}/tables/${params.tableId}/fields`,
          { headers }
        );

      case 'getField':
        return this.apiCall<AirtableField>(
          `${this.apiBase}/bases/${params.baseId}/tables/${params.tableId}/fields/${params.fieldId}`,
          { headers }
        );

      case 'createField':
        return this.apiCall<AirtableField>(
          `${this.apiBase}/bases/${params.baseId}/tables/${params.tableId}/fields`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.field),
          }
        );

      case 'updateField':
        return this.apiCall<AirtableField>(
          `${this.apiBase}/bases/${params.baseId}/tables/${params.tableId}/fields/${params.fieldId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify(params.updates),
          }
        );

      case 'deleteField':
        return this.apiCall<{ deleted: boolean; id: string }>(
          `${this.apiBase}/bases/${params.baseId}/tables/${params.tableId}/fields/${params.fieldId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getViews':
        return this.apiCall<{ views: AirtableView[] }>(
          `${this.apiBase}/bases/${params.baseId}/tables/${params.tableId}/views`,
          { headers }
        );

      case 'getView':
        return this.apiCall<AirtableView>(
          `${this.apiBase}/bases/${params.baseId}/tables/${params.tableId}/views/${params.viewId}`,
          { headers }
        );

      case 'createView':
        return this.apiCall<AirtableView>(
          `${this.apiBase}/bases/${params.baseId}/tables/${params.tableId}/views`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params.view),
          }
        );

      case 'updateView':
        return this.apiCall<AirtableView>(
          `${this.apiBase}/bases/${params.baseId}/tables/${params.tableId}/views/${params.viewId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify(params.updates),
          }
        );

      case 'getCollaborators':
        return this.apiCall<{ collaborators: AirtableCollaborator[] }>(
          `${this.apiBase}/bases/${params.baseId}/collaborators`,
          { headers }
        );

      case 'inviteCollaborator':
        return this.apiCall<{ collaborator: AirtableCollaborator }>(
          `${this.apiBase}/bases/${params.baseId}/collaborators`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ email: params.email, permission: params.permission }),
          }
        );

      case 'removeCollaborator':
        return this.apiCall<{ deleted: boolean }>(
          `${this.apiBase}/bases/${params.baseId}/collaborators/${params.collaboratorId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'getWebhooks':
        return this.apiCall<{ webhooks: AirtableWebhook[] }>(
          `${this.apiBase}/bases/${params.baseId}/webhooks`,
          { headers }
        );

      case 'createWebhook':
        return this.apiCall<AirtableWebhook>(`${this.apiBase}/bases/${params.baseId}/webhooks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            notificationUrl: params.notificationUrl,
            specification: params.specification,
          }),
        });

      case 'deleteWebhook':
        return this.apiCall<{ deleted: boolean; id: string }>(
          `${this.apiBase}/bases/${params.baseId}/webhooks/${params.webhookId}`,
          {
            method: 'DELETE',
            headers,
          }
        );

      case 'testWebhook':
        return this.apiCall<{ challenge: string; passed: boolean }>(
          `${this.apiBase}/bases/${params.baseId}/webhooks/${params.webhookId}/test`,
          {
            method: 'POST',
            headers,
          }
        );

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async fetchData(resource: string, options?: Record<string, unknown>): Promise<unknown> {
    switch (resource) {
      case 'bases':
        return this.executeAction('getBases', options || {});
      case 'tables':
        return this.executeAction('getTables', { baseId: options?.baseId });
      case 'records':
        return this.executeAction('getRecords', {
          baseId: options?.baseId,
          tableId: options?.tableId,
        });
      case 'fields':
        return this.executeAction('getFields', {
          baseId: options?.baseId,
          tableId: options?.tableId,
        });
      case 'views':
        return this.executeAction('getViews', {
          baseId: options?.baseId,
          tableId: options?.tableId,
        });
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  async cleanup(): Promise<void> {
    this.accessToken = null;
  }

  static getManifest(): PluginManifest {
    return MANIFEST;
  }
}

export function createAirtableIntegration(): AirtableIntegration {
  return new AirtableIntegration();
}