import { BasePlugin, PluginResult, PluginConfig } from './base';

export class EnvValidatorPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('env-validator', 'Env Validator', config);
  }

  getDescription(): string {
    return 'Validate environment variables schemas';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');

      const envPath = path.join(cwd, '.env');
      const examplePath = path.join(cwd, '.env.example');

      if (!fs.existsSync(envPath) && !fs.existsSync(examplePath)) {
        return { success: false, error: 'No .env or .env.example found' };
      }

      const requiredVars: string[] = [];
      const actualVars: Record<string, string> = {};
      const warnings: string[] = [];

      if (fs.existsSync(examplePath)) {
        const example = fs.readFileSync(examplePath, 'utf-8');
        for (const line of example.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key] = trimmed.split('=');
            if (key) {
              const k = key.trim();
              if (trimmed.endsWith('=') || trimmed.endsWith('=')) {
                requiredVars.push(k);
              }
            }
          }
        }
      }

      if (fs.existsSync(envPath)) {
        const env = fs.readFileSync(envPath, 'utf-8');
        for (const line of env.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
              const key = trimmed.substring(0, eqIndex).trim();
              const value = trimmed.substring(eqIndex + 1).trim();
              actualVars[key] = value;
            }
          }
        }
      }

      for (const req of requiredVars) {
        if (!(req in actualVars)) {
          warnings.push(`Missing required env var: ${req}`);
        }
      }

      const emptyVars = Object.entries(actualVars).filter(([, v]) => !v);
      for (const [key] of emptyVars) {
        warnings.push(`Empty env var: ${key}`);
      }

      return {
        success: true,
        output: `Validated ${Object.keys(actualVars).length} vars (${requiredVars.length} required)${warnings.length > 0 ? `. ${warnings.length} issues found` : ' - All good!'}`,
        data: {
          total: Object.keys(actualVars).length,
          required: requiredVars.length,
          present: Object.keys(actualVars),
          issues: warnings,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Validation failed' };
    }
  }
}
