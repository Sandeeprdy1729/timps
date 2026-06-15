import { BasePlugin, PluginResult, PluginConfig } from './base';

export class DeployHelperPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('deploy-helper', 'Deploy Helper', config);
  }

  getDescription(): string {
    return 'One-click deploy to various platforms';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');

      const pkgPath = path.join(cwd, 'package.json');
      let scripts: Record<string, string> = {};
      let name = 'unknown';
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        scripts = pkg.scripts || {};
        name = pkg.name || 'unknown';
      }

      const warnings: string[] = [];
      const hasBuildScript = 'build' in scripts;
      const hasDeployScript = 'deploy' in scripts || 'vercel-build' in scripts;

      const detectedPlatforms: string[] = [];
      if (fs.existsSync(path.join(cwd, 'vercel.json'))) detectedPlatforms.push('Vercel');
      if (fs.existsSync(path.join(cwd, 'netlify.toml'))) detectedPlatforms.push('Netlify');
      if (fs.existsSync(path.join(cwd, 'Dockerfile'))) detectedPlatforms.push('Docker');
      if (fs.existsSync(path.join(cwd, 'railway.json'))) detectedPlatforms.push('Railway');
      if (fs.existsSync(path.join(cwd, 'render.yaml'))) detectedPlatforms.push('Render');

      if (!hasBuildScript) warnings.push('No build script found in package.json');
      if (detectedPlatforms.length === 0) warnings.push('No deployment config detected (vercel.json, netlify.toml, Dockerfile, etc.)');

      return {
        success: true,
        output: `Project: ${name} | Platforms: ${detectedPlatforms.join(', ') || 'None detected'} | Build: ${hasBuildScript ? '✓' : '✗'}`,
        data: {
          name,
          platforms: detectedPlatforms,
          scripts,
          buildScriptExists: hasBuildScript,
          deployScriptExists: hasDeployScript,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Deploy check failed' };
    }
  }
}
