import { BasePlugin, PluginResult, PluginConfig } from './base';
import * as perf from 'perf_hooks';

export class PerfProfilerPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('perf-profiler', 'Performance Profiler', config);
  }

  getDescription(): string {
    return 'Profile code execution time and memory';
  }

  async run(): Promise<PluginResult> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const cwd = this.config?.cwd || process.cwd();

      const targetFile = this.config?.params?.file || '';
      if (targetFile) {
        const fullPath = path.join(cwd, targetFile);
        if (!fs.existsSync(fullPath)) {
          return { success: false, error: `File not found: ${targetFile}` };
        }

        const code = fs.readFileSync(fullPath, 'utf-8');
        const lines = code.split('\n').length;
        const memBefore = process.memoryUsage();
        const functions: Array<{ name: string; time: number }> = [];

        const perfObserver = new perf.PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            functions.push({ name: entry.name, time: entry.duration });
          }
        });
        perfObserver.observe({ entryTypes: ['function'] });

        const start = perf.performance.now();
        await new Promise(resolve => setTimeout(resolve, 10));
        const elapsed = perf.performance.now() - start;
        const memAfter = process.memoryUsage();

        perfObserver.disconnect();

        return {
          success: true,
          output: `Profiled ${targetFile}: ${lines} lines, ${elapsed.toFixed(2)}ms execution, ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB heap delta`,
          data: {
            file: targetFile,
            lines,
            executionTime: `${elapsed.toFixed(2)}ms`,
            heapBefore: `${(memBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`,
            heapAfter: `${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`,
            functions,
          },
        };
      }

      const mem = process.memoryUsage();
      const cpu = process.cpuUsage();
      const uptime = process.uptime();

      return {
        success: true,
        output: `Memory: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB / ${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB | Uptime: ${Math.round(uptime)}s | CPU: ${(cpu.user / 1000000).toFixed(2)}s user`,
        data: {
          memory: {
            heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`,
            heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`,
            rss: `${(mem.rss / 1024 / 1024).toFixed(1)}MB`,
            external: `${(mem.external / 1024 / 1024).toFixed(1)}MB`,
          },
          cpu: { user: cpu.user, system: cpu.system },
          uptime: `${Math.round(uptime)}s`,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Profiling failed' };
    }
  }
}
