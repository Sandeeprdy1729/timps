import { execSync } from 'child_process';
import { BasePlugin, PluginResult, PluginConfig } from './base';

export class DockerBuildPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('docker-build', 'Docker Build', config);
  }

  getDescription(): string {
    return 'Build and manage Docker containers';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();

      const dockerVersion = execSync('docker --version 2>/dev/null', { encoding: 'utf-8' }).trim() || 'Docker not found';
      if (dockerVersion === 'Docker not found') {
        return { success: false, error: 'Docker is not installed' };
      }

      const images = execSync('docker images --format "{{.Repository}}:{{.Tag}} ({{.Size}})" 2>/dev/null', { encoding: 'utf-8' }).trim();
      const containers = execSync('docker ps --format "{{.Names}} ({{.Image}})" 2>/dev/null', { encoding: 'utf-8' }).trim();

      const hasDockerfile = require('fs').existsSync(require('path').join(cwd, 'Dockerfile'));
      const hasCompose = require('fs').existsSync(require('path').join(cwd, 'docker-compose.yml')) ||
                         require('fs').existsSync(require('path').join(cwd, 'docker-compose.yaml'));

      return {
        success: true,
        output: `Docker: available | ${images ? images.split('\n').length : 0} images | ${containers ? containers.split('\n').length : 0} running containers | Dockerfile: ${hasDockerfile} | Compose: ${hasCompose}`,
        data: {
          version: dockerVersion,
          images: images ? images.split('\n').filter(Boolean) : [],
          runningContainers: containers ? containers.split('\n').filter(Boolean) : [],
          hasDockerfile,
          hasCompose,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Docker operation failed' };
    }
  }
}
