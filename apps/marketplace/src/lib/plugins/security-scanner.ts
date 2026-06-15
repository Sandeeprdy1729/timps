import { BasePlugin, PluginResult, PluginConfig } from './base';

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'GitHub Token', pattern: /gh[ps]_[0-9a-zA-Z]{36}/g },
  { name: 'GitLab Token', pattern: /glpat-[0-9a-zA-Z\-_]{20,}/g },
  { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z-]{10,}/g },
  { name: 'Stripe Key', pattern: /(?:sk|pk|rk|wh)_(?:test|live)_[0-9a-zA-Z]{24,}/g },
  { name: 'OpenAI Key', pattern: /sk-[0-9a-zA-Z]{20,}/g },
  { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g },
  { name: 'Private Key', pattern: /-----BEGIN\s?(RSA|DSA|EC|OPENSSH|PRIVATE)\s?KEY-----/g },
  { name: 'Password in Code', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi },
  { name: 'API Key Assignment', pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
];

export class SecurityScannerPlugin extends BasePlugin {
  constructor(config?: PluginConfig) {
    super('security-scanner', 'Security Scanner', config);
  }

  getDescription(): string {
    return 'Scan for vulnerabilities and security issues';
  }

  async run(): Promise<PluginResult> {
    try {
      const cwd = this.config?.cwd || process.cwd();
      const fs = await import('fs');
      const path = await import('path');
      const findings: Array<{ file: string; line: number; type: string; secret: string }> = [];

      function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
            walk(full);
          } else if (entry.isFile() && /\.(ts|js|py|go|rs|env|json|yaml|yml|config)$/.test(entry.name)) {
            try {
              const content = fs.readFileSync(full, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                for (const { name, pattern } of SECRET_PATTERNS) {
                  if (pattern.test(lines[i])) {
                    const match = lines[i].match(pattern);
                    if (match) {
                      findings.push({
                        file: path.relative(cwd, full),
                        line: i + 1,
                        type: name,
                        secret: match[0].substring(0, 12) + '...',
                      });
                    }
                  }
                }
              }
            } catch {
              // skip unreadable files
            }
          }
        }
      }
      walk(cwd);

      return {
        success: true,
        output: `Found ${findings.length} potential secrets in ${new Set(findings.map(f => f.file)).size} files`,
        data: findings,
        warnings: findings.length > 0 ? findings.map(f => `${f.file}:${f.line} - ${f.type}`) : undefined,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Security scan failed' };
    }
  }
}
