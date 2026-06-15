import { BasePlugin, PluginResult, PluginConfig } from './base';

export class QueryBuilderPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('query-builder', 'Query Builder', config);
  }

  getDescription(): string {
    return 'Build SQL queries visually';
  }

  async run(): Promise<PluginResult> {
    try {
      const table = this.config?.params?.table || 'users';
      const action = this.config?.params?.action || 'select';
      const fields = this.config?.params?.fields || '*';
      const where = this.config?.params?.where || '';
      const orderBy = this.config?.params?.orderBy || '';
      const limit = this.config?.params?.limit || '';

      let query = '';
      if (action === 'select') {
        query = `SELECT ${fields} FROM ${table}`;
        if (where) query += ` WHERE ${where}`;
        if (orderBy) query += ` ORDER BY ${orderBy}`;
        if (limit) query += ` LIMIT ${limit}`;
      } else if (action === 'insert') {
        const columns = this.config?.params?.columns || '';
        const values = this.config?.params?.values || '';
        query = `INSERT INTO ${table} (${columns}) VALUES (${values})`;
      } else if (action === 'update') {
        const set = this.config?.params?.set || '';
        query = `UPDATE ${table} SET ${set}`;
        if (where) query += ` WHERE ${where}`;
      } else if (action === 'delete') {
        query = `DELETE FROM ${table}`;
        if (where) query += ` WHERE ${where}`;
      }

      return {
        success: true,
        output: `Generated query:\n${query}`,
        data: { query, table, action, fields, where, orderBy, limit },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Query building failed' };
    }
  }
}
