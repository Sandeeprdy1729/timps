import { BasePlugin, PluginResult, PluginConfig } from './base';
import * as fs from 'fs';

export class LogViewerPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('log-viewer', 'Log Viewer', config);
  }

  getDescription(): string {
    return 'Parse and view log files in real-time';
  }

  async run(): Promise<PluginResult> {
    try {
      const path = await import('path');
      const cwd = this.config?.cwd || process.cwd();
      const logFile = this.config?.params?.file || '';

      if (logFile) {
        const fullPath = path.join(cwd, logFile);
        if (!fs.existsSync(fullPath)) {
          return { success: false, error: `Log file not found: ${logFile}` };
        }
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        const tail = this.config?.params?.tail ? parseInt(this.config.params.tail, 10) : 50;

        const lastNLines = lines.slice(-tail);
        const errorCount = lastNLines.filter(l => /error|fatal|exception|failed/i.test(l)).length;
        const warnCount = lastNLines.filter(l => /warn|deprecated/i.test(l)).length;

        return {
          success: true,
          output: `Log: ${logFile} | ${lines.length} total lines | Last ${tail}: ${errorCount} errors, ${warnCount} warnings`,
          data: {
            file: logFile,
            totalLines: lines.length,
            tailLines: lastNLines,
            stats: { errors: errorCount, warnings: warnCount, total: lastNLines.length },
          },
        };
      }

      const logFiles: string[] = [];
      for (const entry of fs.readdirSync(cwd, { withFileTypes: true })) {
        if (entry.isFile() && /\.(log|out|err)$/i.test(entry.name)) {
          const stat = fs.statSync(path.join(cwd, entry.name));
          logFiles.push(`${entry.name} (${(stat.size / 1024).toFixed(1)} KB)`);
        }
      }

      if (logFiles.length === 0) {
        return {
          success: true,
          output: 'No log files found in current directory',
          data: { logFiles: [] },
        };
      }

      return {
        success: true,
        output: `Found ${logFiles.length} log files:\n${logFiles.join('\n')}`,
        data: { logFiles },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Log viewing failed' };
    }
  }
}
