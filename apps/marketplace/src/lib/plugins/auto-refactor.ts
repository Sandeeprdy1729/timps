import { BasePlugin, PluginResult, PluginConfig } from './base';
import { CodeAnalysisPlugin } from './code-analysis';

export class AutoRefactorPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('auto-refactor', 'Auto Refactor', config);
  }

  getDescription(): string {
    return 'Automatically refactor code for best practices';
  }

  async run(): Promise<PluginResult> {
    try {
      const analysis = new CodeAnalysisPlugin(this.config);
      const analysisResult = await analysis.run();
      const cwd = this.config?.cwd || process.cwd();

      const fs = await import('fs');
      const path = await import('path');

      const files = (analysisResult.data as { files: Array<{ file: string }> })?.files || [];
      let refactored = 0;

      for (const { file } of files.slice(0, 20)) {
        const fullPath = path.join(cwd, file);
        let content = fs.readFileSync(fullPath, 'utf-8');
        let changed = false;

        const anyPattern = /:\s*any\b/g;
        if (anyPattern.test(content)) {
          content = content.replace(anyPattern, ': unknown');
          changed = true;
        }

        const varPattern = /\bvar\s+/g;
        if (varPattern.test(content)) {
          content = content.replace(varPattern, 'let ');
          changed = true;
        }

        if (changed) {
          fs.writeFileSync(fullPath, content, 'utf-8');
          refactored++;
        }
      }

      return {
        success: true,
        output: `Refactored ${refactored} files (any→unknown, var→let/const)`,
        data: { filesRefactored: refactored },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Refactoring failed' };
    }
  }
}
