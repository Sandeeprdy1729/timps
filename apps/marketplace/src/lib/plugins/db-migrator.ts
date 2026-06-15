import { BasePlugin, PluginResult, PluginConfig } from './base';

export class DBMigratorPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('db-migrator', 'Database Migrator', config);
  }

  getDescription(): string {
    return 'Manage database migrations';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');

      const migrationsDir = path.join(cwd, 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
      }

      const existing = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const migrationName = this.config?.params?.name || `migration_${timestamp}`;

      const sql = this.config?.params?.sql || `-- Migration: ${migrationName}\n-- Created: ${new Date().toISOString()}\n\n`;

      const filename = `${timestamp}_${migrationName}.sql`;
      fs.writeFileSync(path.join(migrationsDir, filename), sql, 'utf-8');

      return {
        success: true,
        output: `Created migration: ${filename} (${existing.length + 1} total migrations)`,
        data: {
          newMigration: filename,
          totalMigrations: existing.length + 1,
          migrationsDir,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Migration failed' };
    }
  }
}
