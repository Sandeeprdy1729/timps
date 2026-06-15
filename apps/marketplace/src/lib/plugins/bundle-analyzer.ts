import { BasePlugin, PluginResult, PluginConfig } from './base';

export class BundleAnalyzerPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('bundle-analyzer', 'Bundle Analyzer', config);
  }

  getDescription(): string {
    return 'Analyze and visualize bundle sizes';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');

      const distDir = path.join(cwd, 'dist');
      if (!fs.existsSync(distDir)) {
        return {
          success: false,
          error: 'No dist/ directory found. Build the project first.',
        };
      }

      const files: Array<{ file: string; size: number; sizeFormatted: string }> = [];
      let totalSize = 0;

      function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            walk(full);
          } else if (entry.isFile() && /\.(js|jsx|ts|tsx|css|html)$/i.test(entry.name)) {
            const stat = fs.statSync(full);
            const relPath = path.relative(cwd, full);
            const sizeKB = stat.size / 1024;
            totalSize += stat.size;
            files.push({
              file: relPath,
              size: stat.size,
              sizeFormatted: sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB.toFixed(1)} KB`,
            });
          }
        }
      }
      walk(distDir);

      files.sort((a, b) => b.size - a.size);

      const totalSizeFormatted = totalSize / 1024 > 1024
        ? `${(totalSize / 1024 / 1024).toFixed(2)} MB`
        : `${(totalSize / 1024).toFixed(1)} KB`;

      return {
        success: true,
        output: `Analyzed ${files.length} files. Total bundle size: ${totalSizeFormatted}`,
        data: {
          totalFiles: files.length,
          totalSize,
          totalSizeFormatted,
          files: files.slice(0, 30),
          largestFiles: files.slice(0, 5).map(f => `${f.file}: ${f.sizeFormatted}`),
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Bundle analysis failed' };
    }
  }
}
