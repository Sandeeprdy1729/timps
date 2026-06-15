import { BasePlugin, PluginResult, PluginConfig } from './base';
import * as fs from 'fs';
import * as path from 'path';

export class EnvManagerPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('env-manager', 'Environment Manager', config);
  }

  getDescription(): string {
    return 'Manage environment variables across projects';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();

      const envFiles = fs.readdirSync(cwd).filter(f => f.startsWith('.env'));
      const warnings: string[] = [];
      const vars: Array<{ file: string; key: string; defined: boolean }> = [];

      for (const file of envFiles) {
        const content = fs.readFileSync(path.join(cwd, file), 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        for (const line of lines) {
          const [key] = line.split('=');
          if (key) {
            vars.push({ file, key: key.trim(), defined: true });
          }
        }
      }

      if (fs.existsSync(path.join(cwd, '.env.example'))) {
        const example = fs.readFileSync(path.join(cwd, '.env.example'), 'utf-8');
        const exampleLines = example.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        for (const line of exampleLines) {
          const [key] = line.split('=');
          if (key) {
            const k = key.trim();
            const found = vars.some(v => v.key === k && v.file === '.env');
            if (!found) {
              warnings.push(`Missing env var: ${k} (defined in .env.example but not in .env)`);
            }
          }
        }
      }

      return {
        success: true,
        output: `Found ${vars.length} env vars across ${envFiles.length} files` + (warnings.length > 0 ? `. ${warnings.length} warnings` : ''),
        data: { envFiles, variables: vars, warnings },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Env manager failed' };
    }
  }
}
