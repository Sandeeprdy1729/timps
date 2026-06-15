import { BasePlugin, PluginResult, PluginConfig } from './base';

export class SchemaMigratorPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('schema-migrator', 'Schema Migrator', config);
  }

  getDescription(): string {
    return 'Migrate database schemas between environments';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');

      const schemaDir = path.join(cwd, 'prisma');
      const foundFiles: string[] = [];
      if (fs.existsSync(schemaDir)) {
        const files = fs.readdirSync(schemaDir);
        foundFiles.push(...files.filter(f => f.endsWith('.prisma')));
      }

      const ormConfigs = [
        { file: 'ormconfig.json', exists: fs.existsSync(path.join(cwd, 'ormconfig.json')) },
        { file: 'typeorm.json', exists: fs.existsSync(path.join(cwd, 'typeorm.json')) },
        { file: 'drizzle.config.ts', exists: fs.existsSync(path.join(cwd, 'drizzle.config.ts')) },
        { file: 'drizzle.config.js', exists: fs.existsSync(path.join(cwd, 'drizzle.config.js')) },
        { file: 'knexfile.js', exists: fs.existsSync(path.join(cwd, 'knexfile.js')) },
        { file: 'knexfile.ts', exists: fs.existsSync(path.join(cwd, 'knexfile.ts')) },
      ];

      const activeConfigs = ormConfigs.filter(c => c.exists);

      return {
        success: true,
        output: `Found ${foundFiles.length} Prisma schemas, ${activeConfigs.length} ORM configs`,
        data: { prismaSchemas: foundFiles, ormConfigs: activeConfigs },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Schema migration failed' };
    }
  }
}
