import { BasePlugin, PluginResult, PluginConfig } from './base';
import * as fs from 'fs';
import * as path from 'path';

export class LicenseCheckerPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('license-checker', 'License Checker', config);
  }

  getDescription(): string {
    return 'Check license compliance for dependencies';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();

      const pkgPath = path.join(cwd, 'package.json');
      if (!fs.existsSync(pkgPath)) {
        return { success: false, error: 'No package.json found' };
      }

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const dependencies = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;

      const allowedLicenses = (this.config?.params?.allowed || 'MIT,Apache-2.0,ISC,BSD-2-Clause,BSD-3-Clause,Unlicense').split(',').map(l => l.trim());

      const results: Array<{ name: string; version: string; license: string; allowed: boolean }> = [];

      for (const [name, version] of Object.entries(dependencies)) {
        const depPkgPath = path.join(cwd, 'node_modules', name, 'package.json');
        let license = 'Unknown';
        try {
          if (fs.existsSync(depPkgPath)) {
            const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf-8'));
            license = depPkg.license || 'Unknown';
          }
        } catch {
          license = 'Unknown';
        }
        results.push({
          name,
          version: version.replace('^', '').replace('~', ''),
          license,
          allowed: allowedLicenses.includes(license),
        });
      }

      const allowed = results.filter(r => r.allowed);
      const denied = results.filter(r => !r.allowed);

      return {
        success: true,
        output: `Checked ${results.length} deps. ${allowed.length} allowed, ${denied.length} need review`,
        data: { total: results.length, allowed: allowed.length, denied: denied.length, dependencies: results.slice(0, 50) },
        warnings: denied.length > 0 ? denied.slice(0, 10).map(d => `${d.name}@${d.version}: ${d.license} not in allowed list`) : undefined,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'License check failed' };
    }
  }
}
