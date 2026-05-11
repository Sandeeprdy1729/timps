// ── TIMPS MCP Auto-Discovery & Marketplace ──
// Scans for MCP servers in package.json, requirements.txt, Cargo.toml
// and suggests/installs relevant servers from the marketplace

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as child_process from 'node:child_process';

export interface MCPServer {
  name: string;
  description: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  categories: string[];
  installCommand?: string;
  homepage?: string;
  stars?: number;
}

export const MCP_MARKETPLACE: MCPServer[] = [
  // Database
  { name: 'postgres', description: 'PostgreSQL database operations', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/postgres'], categories: ['database', 'postgres'], installCommand: 'npm install -g @modelcontextprotocol/server-postgres' },
  { name: 'sqlite', description: 'SQLite database operations', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sqlite'], categories: ['database', 'sqlite'], installCommand: 'npm install -g @modelcontextprotocol/server-sqlite' },
  { name: 'mysql', description: 'MySQL database operations', command: 'npx', args: ['-y', '@modelcontextprotocol/server-mysql'], categories: ['database', 'mysql'], installCommand: 'npm install -g @modelcontextprotocol/server-mysql' },
  { name: 'mongodb', description: 'MongoDB database operations', command: 'npx', args: ['-y', '@modelcontextprotocol/server-mongodb', 'mongodb://localhost:27017'], categories: ['database', 'mongodb'], installCommand: 'npm install -g @modelcontextprotocol/server-mongodb' },
  { name: 'redis', description: 'Redis caching and pub/sub', command: 'npx', args: ['-y', '@modelcontextprotocol/server-redis'], categories: ['database', 'redis', 'caching'], installCommand: 'npm install -g @modelcontextprotocol/server-redis' },

  // Cloud & Infra
  { name: 'aws-kb-retrieval', description: 'AWS Knowledge Base retrieval', command: 'npx', args: ['-y', '@modelcontextprotocol/server-aws-kb-retrieval'], categories: ['cloud', 'aws', 'search'], installCommand: 'npm install -g @modelcontextprotocol/server-aws-kb-retrieval' },
  { name: 'google-search', description: 'Google Search integration', command: 'npx', args: ['-y', '@modelcontextprotocol/server-google-search'], categories: ['search', 'web'], installCommand: 'npm install -g @modelcontextprotocol/server-google-search' },
  { name: 'brave-search', description: 'Brave Search integration', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'], categories: ['search', 'web'], installCommand: 'npm install -g @modelcontextprotocol/server-brave-search' },
  { name: 'github', description: 'GitHub API integration', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], categories: ['git', 'github', 'vcs'], installCommand: 'npm install -g @modelcontextprotocol/server-github' },
  { name: 'gitlab', description: 'GitLab API integration', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gitlab'], categories: ['git', 'gitlab', 'vcs'], installCommand: 'npm install -g @modelcontextprotocol/server-gitlab' },
  { name: 'filesystem', description: 'Full filesystem access', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()], categories: ['filesystem', 'storage'], installCommand: 'npm install -g @modelcontextprotocol/server-filesystem' },

  // Communication
  { name: 'slack', description: 'Slack messaging integration', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], categories: ['communication', 'slack', 'messaging'], installCommand: 'npm install -g @modelcontextprotocol/server-slack' },
  { name: 'sentry', description: 'Sentry error tracking', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sentry'], categories: ['monitoring', 'error-tracking', 'sentry'], installCommand: 'npm install -g @modelcontextprotocol/server-sentry' },
  { name: 'puppeteer', description: 'Browser automation with Puppeteer', command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'], categories: ['browser', 'automation', 'web'], installCommand: 'npm install -g @modelcontextprotocol/server-puppeteer' },
  { name: 'everything', description: 'Windows Everything search', command: 'npx', args: ['-y', '@modelcontextprotocol/server-everything'], categories: ['search', 'windows'], installCommand: 'npm install -g @modelcontextprotocol/server-everything' },

  // Development
  { name: 'memory', description: 'TIMPS persistent memory (built-in)', command: 'timps-mcp', categories: ['memory', 'timps', 'intelligence'], installCommand: 'npm install -g timps-mcp' },
  { name: 'fetch', description: 'HTTP fetch for web requests', command: 'uvx', args: ['mcp-server-fetch'], categories: ['web', 'http', 'api'], installCommand: 'pip install mcp-server-fetch' },
  { name: 'brave', description: 'Brave Search API', command: 'uvx', args: ['mcp-server-brave-search'], categories: ['search', 'web'], installCommand: 'pip install mcp-server-brave-search' },
  { name: 'sqlite3', description: 'SQLite3 database', command: 'uvx', args: ['mcp-server-sqlite'], categories: ['database', 'sqlite'], installCommand: 'pip install mcp-server-sqlite' },
];

export class MCPAutoDiscovery {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async scanDependencies(): Promise<MCPServer[]> {
    const suggested: MCPServer[] = [];
    const deps = new Set<string>();

    const packageJson = path.join(this.projectPath, 'package.json');
    if (fs.existsSync(packageJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const dep of Object.keys(allDeps)) deps.add(dep.toLowerCase());
      } catch { /* ignore */ }
    }

    const requirements = path.join(this.projectPath, 'requirements.txt');
    if (fs.existsSync(requirements)) {
      const content = fs.readFileSync(requirements, 'utf-8');
      for (const line of content.split('\n')) {
        const dep = line.split('==')[0].split('>=')[0].trim().toLowerCase();
        if (dep) deps.add(dep);
      }
    }

    const cargoToml = path.join(this.projectPath, 'Cargo.toml');
    if (fs.existsSync(cargoToml)) {
      const content = fs.readFileSync(cargoToml, 'utf-8');
      const depMatches = content.matchAll(/^\s*(\w+)\s*=/gm);
      for (const m of depMatches) deps.add(m[1].toLowerCase());
    }

    const suggestions: Array<[string, string[]]> = [
      ['postgres', ['pg', 'postgres', 'postgresql', 'pg-pool']],
      ['mysql', ['mysql', 'mysql2']],
      ['mongodb', ['mongodb', 'mongoose']],
      ['redis', ['redis', 'ioredis']],
      ['sqlite', ['sqlite', 'better-sqlite3', 'knex']],
      ['slack', ['@slack', 'slack']],
      ['github', ['@octokit', 'github']],
      ['sentry', ['@sentry', 'sentry']],
      ['puppeteer', ['puppeteer', 'playwright']],
    ];

    for (const [server, keywords] of suggestions) {
      if (keywords.some(k => deps.has(k))) {
        const marketServer = MCP_MARKETPLACE.find(s => s.name === server);
        if (marketServer) suggested.push(marketServer);
      }
    }

    return suggested;
  }

  searchMarketplace(query: string): MCPServer[] {
    const q = query.toLowerCase();
    return MCP_MARKETPLACE.filter(s =>
      s.name.includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.categories.some(c => c.includes(q))
    );
  }

  getByCategory(category: string): MCPServer[] {
    return MCP_MARKETPLACE.filter(s => s.categories.includes(category));
  }

  getCategories(): string[] {
    const cats = new Set<string>();
    for (const s of MCP_MARKETPLACE) {
      for (const c of s.categories) cats.add(c);
    }
    return [...cats].sort();
  }

  installServer(server: MCPServer): Promise<{ success: boolean; output: string }> {
    return new Promise(resolve => {
      if (!server.installCommand) {
        resolve({ success: false, output: 'No install command available' });
        return;
      }

      child_process.exec(server.installCommand, { cwd: this.projectPath }, (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, output: (stderr || err.message).slice(0, 500) });
        } else {
          resolve({ success: true, output: stdout.slice(0, 500) });
        }
      });
    });
  }

  generateMCPConfig(servers: MCPServer[]): Record<string, any> {
    const config: Record<string, any> = {};

    for (const s of servers) {
      const env: Record<string, string> = {};
      if (s.name === 'postgres') env['POSTGRES_URL'] = 'postgresql://localhost/postgres';
      if (s.name === 'redis') env['REDIS_URL'] = 'redis://localhost:6379';
      if (s.name === 'slack') env['SLACK_BOT_TOKEN'] = 'your-slack-bot-token';
      if (s.name === 'github') env['GITHUB_TOKEN'] = process.env.GITHUB_TOKEN || 'your-github-token';
      if (s.name === 'sentry') env['SENTRY_DSN'] = 'your-sentry-dsn';
      if (s.name === 'brave-search') env['BRAVE_API_KEY'] = 'your-brave-api-key';
      if (s.name === 'google-search') env['GOOGLE_API_KEY'] = 'your-google-api-key';

      const serverConfig: any = { command: s.command };
      if (s.args) serverConfig.args = s.args;
      if (Object.keys(env).length > 0) serverConfig.env = env;

      config[s.name] = serverConfig;
    }

    return config;
  }
}

export function createMCPSkill(servers: MCPServer[], name: string, description: string): string {
  return `---importance: high
tags: [mcp, skill, ${servers.map(s => s.name).join(', ')}]
---

# ${name}

${description}

## MCP Servers Used
${servers.map(s => `- **${s.name}**: ${s.description}`).join('\n')}

## Usage
This skill automatically uses the following MCP servers for their respective tasks.

## Auto-Trigger Keywords
${servers.map(s => `- \`${s.name}\`: ${s.categories.join(', ')}`).join('\n')}
`;
}

export async function installMCPFromNPM(packageName: string): Promise<string> {
  return new Promise((resolve) => {
    child_process.exec(`npm install -g ${packageName}`, (err, stdout, stderr) => {
      resolve(err ? `Error: ${stderr || err.message}` : `Installed: ${stdout}`);
    });
  });
}