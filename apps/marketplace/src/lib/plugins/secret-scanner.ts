import { BasePlugin, PluginResult, PluginConfig } from './base';

export class SecretScannerPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('secret-scanner', 'Secret Scanner', config);
  }

  getDescription(): string {
    return 'Scan code for exposed secrets and API keys';
  }

  async run(): Promise<PluginResult> {
    try {
      const { SecurityScannerPlugin } = await import('./security-scanner');
      const scanner = new SecurityScannerPlugin(this.config);
      return scanner.run();
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Secret scan failed' };
    }
  }
}
