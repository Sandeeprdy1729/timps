import { BasePlugin, PluginResult, PluginConfig } from './base';
import { execSync } from 'child_process';

export class GitHelperPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('git-helper', 'Git Helper', config);
  }

  getDescription(): string {
    return 'Enhanced git workflows and automation';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();

      const gitDir = execSync('git rev-parse --git-dir 2>/dev/null', { cwd, encoding: 'utf-8' }).trim();
      if (!gitDir) {
        return { success: false, error: 'Not a git repository' };
      }

      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
      const status = execSync('git status --short', { cwd, encoding: 'utf-8' }).trim();
      const logLines = execSync('git log --oneline -10', { cwd, encoding: 'utf-8' }).trim();
      const totalCommits = execSync('git rev-list --count HEAD 2>/dev/null', { cwd, encoding: 'utf-8' }).trim();

      const changedFiles = status ? status.split('\n').length : 0;
      const stagedFiles = status ? status.split('\n').filter(l => l.startsWith('M') || l.startsWith('A')).length : 0;

      const commits = logLines.split('\n').map(l => {
        const [hash, ...msg] = l.split(' ');
        return { hash, message: msg.join(' ') };
      });

      return {
        success: true,
        output: `Branch: ${branch} | ${changedFiles} changed (${stagedFiles} staged) | ${totalCommits} total commits`,
        data: { branch, changedFiles, stagedFiles, totalCommits, recentCommits: commits },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Git operation failed' };
    }
  }
}
