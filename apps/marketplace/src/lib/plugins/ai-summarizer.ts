import { execSync } from 'child_process';
import { BasePlugin, PluginResult, PluginConfig } from './base';

export class AISummarizerPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('ai-summarizer', 'AI Summarizer', config);
  }

  getDescription(): string {
    return 'Summarize code changes with AI';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');

      const gitDir = execSync('git rev-parse --git-dir 2>/dev/null', { cwd, encoding: 'utf-8' }).trim();
      if (!gitDir) {
        return { success: false, error: 'Not a git repository' };
      }

      const diff = execSync('git diff --stat HEAD~5..HEAD 2>/dev/null || git diff --stat', { cwd, encoding: 'utf-8' }).trim();
      const recentCommits = execSync('git log --oneline -5', { cwd, encoding: 'utf-8' }).trim();
      const changedFiles = execSync('git diff --name-only HEAD~5..HEAD 2>/dev/null || git diff --name-only', { cwd, encoding: 'utf-8' }).trim();

      const files = changedFiles.split('\n').filter(Boolean);
      let codeSummary = '';
      for (const file of files.slice(0, 5)) {
        try {
          const fullPath = path.join(cwd, file);
          if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            codeSummary += `\n--- ${file} (${content.split('\n').length} lines) ---\n${content.slice(0, 500)}\n`;
          }
        } catch {
          // skip deleted files
        }
      }

      const summary = `Recent Commits:\n${recentCommits}\n\nFiles Changed:\n${changedFiles}\n\nDiff Stats:\n${diff}\n\nCode Changes:\n${codeSummary || 'No code content available'}`;

      return {
        success: true,
        output: summary.length > 2000 ? summary.slice(0, 2000) + '\n... (truncated)' : summary,
        data: {
          recentCommits: recentCommits.split('\n').filter(Boolean),
          filesChanged: files,
          diffStats: diff,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Summarization failed' };
    }
  }
}
