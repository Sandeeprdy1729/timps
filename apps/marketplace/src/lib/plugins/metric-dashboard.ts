import { BasePlugin, PluginResult, PluginConfig } from './base';
import * as ts from 'typescript';
import { execSync } from 'child_process';

export class MetricDashboardPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('metric-dashboard', 'Metric Dashboard', config);
  }

  getDescription(): string {
    return 'Display code metrics in real-time';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');

      let totalLines = 0;
      let totalFiles = 0;
      let totalFunctions = 0;
      let totalClasses = 0;
      let totalInterfaces = 0;
      let tsxCount = 0;
      let tsCount = 0;

      function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
            walk(full);
          } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
            totalFiles++;
            if (entry.name.endsWith('.tsx')) tsxCount++;
            if (entry.name.endsWith('.ts')) tsCount++;
            const content = fs.readFileSync(full, 'utf-8');
            totalLines += content.split('\n').length;

            const sourceFile = ts.createSourceFile(full, content, ts.ScriptTarget.Latest, true);
            function visit(node: ts.Node) {
              if (ts.isFunctionDeclaration(node)) totalFunctions++;
              if (ts.isClassDeclaration(node) && node.name) totalClasses++;
              if (ts.isInterfaceDeclaration(node) && node.name) totalInterfaces++;
              ts.forEachChild(node, visit);
            }
            visit(sourceFile);
          }
        }
      }
      walk(cwd);

      let gitStats = '';
      try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
        const commitCount = execSync('git rev-list --count HEAD', { cwd, encoding: 'utf-8' }).trim();
        gitStats = `Branch: ${branch} | Commits: ${commitCount}`;
      } catch {
        gitStats = 'Not a git repository';
      }

      const metrics = {
        totalFiles,
        totalLines,
        totalFunctions,
        totalClasses,
        totalInterfaces,
        tsxCount,
        tsCount,
        averageFileSize: totalFiles > 0 ? Math.round(totalLines / totalFiles) : 0,
        gitStats,
      };

      return {
        success: true,
        output: `${totalFiles} files | ${totalLines} lines | ${totalFunctions} functions | ${totalClasses} classes | ${gitStats}`,
        data: metrics,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Metrics collection failed' };
    }
  }
}
