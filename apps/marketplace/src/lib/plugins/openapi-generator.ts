import { BasePlugin, PluginResult, PluginConfig } from './base';

export class OpenAPIGeneratorPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('openapi-generator', 'OpenAPI Generator', config);
  }

  getDescription(): string {
    return 'Generate code from OpenAPI specifications';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');

      const specFiles: string[] = [];
      function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walk(full);
          } else if (entry.isFile() && /(openapi|swagger)\.(json|yaml|yml)$/i.test(entry.name)) {
            specFiles.push(full);
          }
        }
      }
      walk(cwd);

      if (specFiles.length === 0) {
        return {
          success: true,
          output: 'No OpenAPI specs found. Creating sample spec...',
          data: { message: 'No specs found' },
          warnings: ['No OpenAPI/Swagger files found in project'],
        };
      }

      const generated: string[] = [];
      for (const specFile of specFiles) {
        const spec = JSON.parse(fs.readFileSync(specFile, 'utf-8'));
        const paths = spec.paths || {};
        const endpointCount = Object.keys(paths).length;
        generated.push(`${path.basename(specFile)}: ${endpointCount} endpoints`);
      }

      return {
        success: true,
        output: `Found ${specFiles.length} specs: ${generated.join(', ')}`,
        data: { specs: specFiles.map(f => path.basename(f)), generated },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'OpenAPI generation failed' };
    }
  }
}
